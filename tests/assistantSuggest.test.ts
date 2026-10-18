// The chat's `suggest` tool (spec 2026-10-06 §1.3): what the assistant recommends unasked lands as a card in the
// right section (a monthly scooter rental → Ulaşım), never as a to-do; its result says truthfully what happened.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { db, listItems } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

function fakeClient(responses: Partial<Anthropic.Message>[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams) => {
        calls.push(structuredClone(params));
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        return next;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

/** A trip in Ubud: 18 nights by default (under the rules' 21: no rental card of their own). */
async function seed(id: string, end = "2026-12-28"): Promise<void> {
  const d = await db();
  const trip: Trip = { id, title: "Bali", confirmedDates: { start: "2026-12-10", end }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  await d.put("trips", trip);
  await d.put("items", makeItem({ id: `${id}-stay`, tripId: id, category: "stay", name: "Ubud Villa", city: "Ubud", countryCode: "ID", needKey: "stay:ubud", status: "chosen", dates: { start: "2026-12-10", end, source: "page" } }));
}

const suggestCall = (id: string, input: Record<string, string>): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name: "suggest", input, caller: { type: "direct" } }] as Anthropic.ContentBlock[],
});
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const monthly = {
  section: "transport", kind: "add", title: "Aylık motor kiralama", why: "Ubud'da bir ay kalıyorsunuz; aylık kiralama günlükten genellikle çok daha ucuzdur.",
  template: "moto", city: "Ubud", start: "2026-12-10", end: "2026-12-28",
};
const resultOf = (call: Anthropic.MessageCreateParams) => (call.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];

describe("assistant: suggest", () => {
  it("'uzun dönem kalıyoruz, ne önerirsin' → a card in Ulaşım, not a to-do; the plan is unchanged", async () => {
    await seed("sg1");
    const { client, calls } = fakeClient([suggestCall("tu1", monthly), done("Aylık motor kiralamayı Ulaşım'a öneri olarak bıraktım.")]);
    await sendMessage("sg1", "uzun dönem kalıyoruz, ne önerirsin", anthropicProvider(client, "claude-opus-5"));

    // The prompt says where suggestions go, and the tool is strict.
    expect(JSON.stringify(calls[0].system)).toContain("Önerdiğin şeyi suggest ile doğru bölüme bırak (ör. aylık motor kiralama → Ulaşım); kullanıcı açıkça eklemeni isterse plan_item.");
    const tool = (calls[0].tools as Anthropic.Tool[]).find((t) => t.name === "suggest")!;
    expect(tool.strict).toBe(true);

    const result = resultOf(calls[1]);
    expect(result.is_error).toBeFalsy();
    expect(JSON.parse(String(result.content))).toMatchObject({ result: "added", added_to_plan: false, section: expect.stringContaining("Ulaşım") });

    const trip = (await (await db()).get("trips", "sg1"))!;
    expect(trip.suggestions).toMatchObject([{ source: "chat", section: "transport", template: "moto", state: "open", title: "Aylık motor kiralama", payload: { city: "Ubud" } }]);
    // Nothing went on the plan: no to-do, no rental.
    expect((await listItems("sg1")).map((i) => i.id)).toEqual(["sg1-stay"]);
  });

  it("refuses a made-up price and leaves nothing; says so to the model", async () => {
    await seed("sg2");
    const { client, calls } = fakeClient([suggestCall("tu2", { ...monthly, why: "Günlükten ~%60 ucuz." }), done("Tamam.")]);
    await sendMessage("sg2", "ne önerirsin", anthropicProvider(client, "claude-opus-5"));
    const result = resultOf(calls[1]);
    expect(result.is_error).toBe(true);
    expect(String(result.content)).toContain("Hiçbir öneri bırakılmadı");
    expect((await (await db()).get("trips", "sg2"))!.suggestions).toBeUndefined();
  });

  it("doesn't leave again what the user said 'Gerek yok' to, and says that", async () => {
    await seed("sg3");
    const d = await db();
    const t = (await d.get("trips", "sg3"))!;
    await d.put("trips", { ...t, suggestions: [{ key: "rule:monthly-vehicle:ubud", section: "transport", kind: "add", title: "Aylık motor ya da araç kiralama", why: "x", source: "rule", template: "moto", createdAt: 0, state: "dismissed", stateAt: 1 }] });
    const { client, calls } = fakeClient([suggestCall("tu3", monthly), done("Tamam.")]);
    await sendMessage("sg3", "ne önerirsin", anthropicProvider(client, "claude-opus-5"));
    const content = String(resultOf(calls[1]).content);
    // Nothing new on the board: said as unchanged (the turn doesn't count it as a change).
    expect(content.startsWith('{"unchanged"')).toBe(true);
    expect(JSON.parse(content)).toMatchObject({ result: "dismissed_before", added_to_plan: false });
    expect((await d.get("trips", "sg3"))!.suggestions).toHaveLength(1);
    // The model sees what was said not needed.
    expect(JSON.stringify(calls[0].messages)).toContain("not_needed");
  });

  it("says when the board already shows it (a rule's card), and the model sees the rules' cards", async () => {
    await seed("sg4", "2027-01-10"); // 31 nights: the rules' monthly rental card is on the board
    const { client, calls } = fakeClient([suggestCall("tu4", monthly), done("Panoda zaten var.")]);
    await sendMessage("sg4", "uzun dönem kalıyoruz, ne önerirsin", anthropicProvider(client, "claude-opus-5"));
    // Ubud is Bali's (the table of regions): the card is the main place's.
    expect(JSON.stringify(calls[0].messages)).toContain("rule:monthly-vehicle:bali");
    const content = String(resultOf(calls[1]).content);
    expect(content.startsWith('{"unchanged"')).toBe(true);
    expect(JSON.parse(content)).toMatchObject({ result: "covered_by_rule", added_to_plan: false });
    expect((await (await db()).get("trips", "sg4"))!.suggestions).toBeUndefined();
  });

  it("says when the plan already has it (a vehicle for those days), and when it was added already", async () => {
    await seed("sg5");
    const d = await db();
    await d.put("items", makeItem({ id: "sg5-car", tripId: "sg5", category: "transport", plannedKind: "car_rental", name: "Araba", dates: { start: "2026-12-12", end: "2026-12-20", source: "page" }, status: "chosen" }));
    let mock = fakeClient([suggestCall("tu5", monthly), done("Tamam.")]);
    await sendMessage("sg5", "ne önerirsin", anthropicProvider(mock.client, "claude-opus-5"));
    expect(JSON.parse(String(resultOf(mock.calls[1]).content))).toMatchObject({ unchanged: true, result: "already_on_plan" });

    await seed("sg6");
    const t = (await d.get("trips", "sg6"))!;
    await d.put("trips", { ...t, suggestions: [{ key: "chat:transport:vehicle", section: "transport", kind: "add", title: "Aylık motor kiralama", why: "x", source: "chat", template: "moto", createdAt: 0, state: "added", stateAt: 1 }] });
    mock = fakeClient([suggestCall("tu6", monthly), done("Tamam.")]);
    await sendMessage("sg6", "ne önerirsin", anthropicProvider(mock.client, "claude-opus-5"));
    expect(JSON.parse(String(resultOf(mock.calls[1]).content))).toMatchObject({ unchanged: true, result: "already_added" });
  });
});
