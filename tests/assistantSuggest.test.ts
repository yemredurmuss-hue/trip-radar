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

async function seed(id: string): Promise<void> {
  const d = await db();
  const trip: Trip = { id, title: "Bali", confirmedDates: { start: "2026-12-10", end: "2027-01-10" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  await d.put("trips", trip);
  await d.put("items", makeItem({ id: `${id}-stay`, tripId: id, category: "stay", name: "Ubud Villa", city: "Ubud", countryCode: "ID", needKey: "stay:ubud", status: "chosen", dates: { start: "2026-12-10", end: "2027-01-10", source: "page" } }));
}

const suggestCall = (id: string, input: Record<string, string>): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name: "suggest", input, caller: { type: "direct" } }] as Anthropic.ContentBlock[],
});
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const monthly = {
  section: "transport", kind: "add", title: "Aylık motor kiralama", why: "Ubud'da bir ay kalıyorsunuz; aylık kiralama günlükten genellikle çok daha ucuzdur.",
  template: "moto", city: "Ubud", start: "2026-12-10", end: "2027-01-10",
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
    expect(JSON.parse(String(resultOf(calls[1]).content))).toMatchObject({ result: "dismissed_before", added_to_plan: false });
    expect((await d.get("trips", "sg3"))!.suggestions).toHaveLength(1);
    // The model sees what was said not needed.
    expect(JSON.stringify(calls[0].messages)).toContain("not_needed");
  });
});
