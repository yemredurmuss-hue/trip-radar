// The chat on the Şarm El-Şeyh trip (Emre, 0.38.9): "Şnorkel ekipmanı kiralama" sent as a thing to do is Hazırlık, never
// Yapılacaklar; "Ras Muhammed'de gün batımı" stays a thing to do; a car rental stays in Ulaşım.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { db, listItems } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { isPrep } from "../src/lib/prep";
import type { Trip } from "../src/lib/types";

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

async function seed(id: string, packing?: Trip["packing"]): Promise<void> {
  const trip: Trip = { id, title: "Mısır", confirmedDates: { start: "2026-11-10", end: "2026-11-17" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...(packing ? { packing } : {}) };
  await (await db()).put("trips", trip);
}
const call = (id: string, name: string, input: Record<string, unknown>): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input, caller: { type: "direct" } }] as Anthropic.ContentBlock[],
});
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const resultOf = (c: Anthropic.MessageCreateParams) => (c.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
const gear = { section: "todo", kind: "add", title: "Şnorkel ekipmanı kiralama", why: "Mercan resiflerinde şnorkel için gerekir.", template: "todo", city: "Şarm El-Şeyh", start: "", end: "", place: "" };
const todo = (title: string) => ({ kind: "todo", date: null, end_date: null, time: null, from: null, to: null, city: "Şarm El-Şeyh", title, booked: false, note: null });

describe("chat: what goes in Yapılacaklar", () => {
  it("the prompt says what Yapılacaklar is", async () => {
    await seed("y0");
    const { client, calls } = fakeClient([done("Tamam.")]);
    await sendMessage("y0", "merhaba", anthropicProvider(client, "claude-opus-5"));
    expect(JSON.stringify(calls[0].system)).toContain("Yapılacak şeyler (todo) orada yapılacak ya da görülecek şeylerdir: gezilecek yer, manzara noktası, gün batımı, yerel yemek ya da tatlı, pazar, deneyim.");
  });

  it("suggest: gear in Yapılacaklar becomes a line on the trip's Bavul, no card", async () => {
    await seed("y1", { list: { at: 1, groups: [{ title: "Hava", lines: [{ name: "Güneş kremi", why: null, buy: false }] }], ask: [], tips: [] } });
    const { client, calls } = fakeClient([call("s1", "suggest", gear), done("Hazırlık'a ekledim.")]);
    await sendMessage("y1", "şnorkel yapacağız", anthropicProvider(client, "claude-opus-5"));
    const result = resultOf(calls[1]);
    expect(result.is_error).toBeFalsy();
    expect(JSON.parse(String(result.content))).toMatchObject({ added: "Şnorkel ekipmanı kiralama" });
    const trip = (await (await db()).get("trips", "y1"))!;
    expect(trip.suggestions).toBeUndefined();
    expect(trip.packing?.list?.groups.at(-1)).toEqual({ title: "Ekipman", lines: [{ name: "Şnorkel ekipmanı kiralama", why: "Mercan resiflerinde şnorkel için gerekir.", buy: false }] });
  });

  it("suggest: with no Bavul yet, it's dropped and said unchanged", async () => {
    await seed("y2");
    const { client, calls } = fakeClient([call("s2", "suggest", gear), done("Tamam.")]);
    await sendMessage("y2", "şnorkel yapacağız", anthropicProvider(client, "claude-opus-5"));
    const content = String(resultOf(calls[1]).content);
    expect(content.startsWith('{"unchanged"')).toBe(true);
    const trip = (await (await db()).get("trips", "y2"))!;
    expect(trip.suggestions).toBeUndefined();
    expect(trip.packing).toBeUndefined();
  });

  it("plan_item: gear said as a to-do is a Hazırlık chore; the sunset stays a thing to do", async () => {
    await seed("y3");
    const { client } = fakeClient([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "p1", name: "plan_item", input: todo("Şnorkel ekipmanı kiralama"), caller: { type: "direct" } }, { type: "tool_use", id: "p2", name: "plan_item", input: todo("Ras Muhammed'de gün batımı"), caller: { type: "direct" } }] as Anthropic.ContentBlock[] },
      done("Ekledim."),
    ]);
    await sendMessage("y3", "şnorkel ekipmanı kiralayalım, Ras Muhammed'de gün batımını da izleyelim", anthropicProvider(client, "claude-opus-5"));
    const items = await listItems("y3");
    const byName = new Map(items.map((i) => [i.name, i]));
    expect(byName.get("Şnorkel ekipmanı kiralama")).toMatchObject({ plannedKind: "prep" });
    expect(isPrep(byName.get("Şnorkel ekipmanı kiralama")!)).toBe(true);
    expect(byName.get("Ras Muhammed'de gün batımı")).toMatchObject({ plannedKind: "todo" });
    expect(isPrep(byName.get("Ras Muhammed'de gün batımı")!)).toBe(false);
  });
});
