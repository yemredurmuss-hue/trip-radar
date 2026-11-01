// tests/advisorReview.test.ts: the advisor's review (omurga Tur 23, Emre 2026-11-01: "danışman bir daha baktığında
// düzeltebilmeli", with his rules): a chat turn of its own from an event, its note never on screen; nothing booked or
// chosen touched whatever the call says; three changes at most; nothing to say leaves no trace; once per event and never
// two close together; stopped the moment the traveller writes. The code's own look finds a rental over several stops.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, expect, it } from "vitest";
import { reviewTiming, reviewTrip, sendMessage } from "../src/lib/assistant";
import { db, listItems, listMessages } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { planFaults } from "../src/lib/preview";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

afterEach(() => void (reviewTiming.gapMs = 2 * 60_000));

function fakeClient(responses: (Partial<Anthropic.Message> | ((signal?: AbortSignal) => Promise<Partial<Anthropic.Message>>))[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams, opts?: { signal?: AbortSignal }) => {
        calls.push(structuredClone(params));
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        return typeof next === "function" ? next(opts?.signal) : next;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const call = (id: string, name: string, input: unknown): Partial<Anthropic.Message> => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input, caller: { type: "direct" } }] as Anthropic.ContentBlock[] });
const calls = (...c: [string, string, unknown][]): Partial<Anthropic.Message> => ({ stop_reason: "tool_use", content: c.map(([id, name, input]) => ({ type: "tool_use", id, name, input, caller: { type: "direct" } })) as Anthropic.ContentBlock[] });
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const shown = async (id: string) => (await listMessages(id)).filter((m) => m.role !== "event" && m.text.trim()).map((m) => m.text);

async function seed(id: string) {
  const d = await db();
  const trip: Trip = { id, title: "Tayland", confirmedDates: { start: "2027-03-01", end: "2027-03-11" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  await d.put("trips", trip);
  await d.put("items", makeItem({ id: `${id}-bkk`, tripId: id, category: "stay", name: "Konaklama · Bangkok", city: "Bangkok", needKey: "stay:bkk", status: "saved", dates: { start: "2027-03-01", end: "2027-03-05", source: "page" } }));
  await d.put("items", makeItem({ id: `${id}-cm`, tripId: id, category: "stay", name: "Lanna Hotel", city: "Chiang Mai", needKey: "stay:cm", status: "booked", dates: { start: "2027-03-05", end: "2027-03-11", source: "page" } }));
  await d.put("items", makeItem({ id: `${id}-bike`, tripId: id, category: "transport", plannedKind: "bike_rental", name: "Bisiklet kiralama", city: "Bangkok", needKey: "transport:bike", status: "saved", dates: { start: "2027-03-01", end: "2027-03-11", source: "page" } }));
  for (const n of [1, 2, 3, 4]) await d.put("items", makeItem({ id: `${id}-a${n}`, tripId: id, category: "activity", name: `Fikir ${n}`, city: "Bangkok", needKey: `activity:${n}`, status: "saved", dates: { start: "2027-03-02", end: null, source: "page" } }));
}

it("the code's own look: a rental over two stops is found", async () => {
  setLang("tr");
  await seed("rv0");
  const d = await db();
  expect(planFaults((await d.get("trips", "rv0"))!, await listItems("rv0"))[0]).toMatch(/^Bisiklet kiralama 2 durağa yayılmış/);
});

it("fixes what is wrong, says so with 🧭 and its undo; the note it read is never on screen; the booked hotel it asks about", async () => {
  setLang("tr");
  await seed("rv1");
  const { client, calls: sent } = fakeClient([
    calls(["t1", "remove_from_plan", { target_id: "rv1-bike", confirmed: false }], ["t2", "remove_from_plan", { target_id: "rv1-cm", confirmed: true }]),
    done("Bütün geziye yayılan bisikleti kaldırdım. Chiang Mai oteli rezerve; tarihi değişsin mi?"),
  ]);
  expect(await reviewTrip("rv1", "Plan yeni kuruldu.", "first", anthropicProvider(client, "claude-opus-5"))).toBe("done");
  expect(JSON.stringify(sent[0].messages.at(-1))).toContain("Bisiklet kiralama 2 durağa yayılmış");
  const items = await listItems("rv1");
  expect(items.find((i) => i.id === "rv1-bike")!.status).toBe("dismissed");
  // booked: never touched in a review, even with confirmed: true
  expect(items.find((i) => i.id === "rv1-cm")!.status).toBe("booked");
  const results = sent[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
  expect(results[1].is_error).toBe(true);
  expect(await shown("rv1")).toEqual(["🧭 Bütün geziye yayılan bisikleti kaldırdım. Chiang Mai oteli rezerve; tarihi değişsin mi?"]);
  const reply = (await listMessages("rv1")).find((m) => m.text.startsWith("🧭"))!;
  expect(reply.undo?.kind).toBe("fields");
});

it("three changes at most", async () => {
  setLang("tr");
  await seed("rv2");
  const { client } = fakeClient([
    calls(["t1", "remove_from_plan", { target_id: "rv2-a1", confirmed: false }], ["t2", "remove_from_plan", { target_id: "rv2-a2", confirmed: false }], ["t3", "remove_from_plan", { target_id: "rv2-a3", confirmed: false }], ["t4", "remove_from_plan", { target_id: "rv2-a4", confirmed: false }]),
    done("Bangkok'taki fazla fikirleri ayıkladım."),
  ]);
  await reviewTrip("rv2", "Plan yeni kuruldu.", "first", anthropicProvider(client, "claude-opus-5"));
  expect((await listItems("rv2")).filter((i) => i.category === "activity" && i.status === "dismissed")).toHaveLength(3);
});

it("nothing to change or ask: no trace in the chat; the same event never twice, two never close together", async () => {
  setLang("tr");
  await seed("rv3");
  const { client } = fakeClient([done("TAMAM")]);
  expect(await reviewTrip("rv3", "Plan yeni kuruldu.", "first", anthropicProvider(client, "claude-opus-5"))).toBe("silent");
  expect(await listMessages("rv3")).toEqual([]);
  expect(await reviewTrip("rv3", "Plan yeni kuruldu.", "first", anthropicProvider(fakeClient([]).client, "claude-opus-5"))).toBe("skipped");
  expect(await reviewTrip("rv3", "Geziye bir ay kaldı.", "d30", anthropicProvider(fakeClient([]).client, "claude-opus-5"))).toBe("skipped");
  reviewTiming.gapMs = 0;
  expect(await reviewTrip("rv3", "Geziye bir ay kaldı.", "d30", anthropicProvider(fakeClient([done("TAMAM")]).client, "claude-opus-5"))).toBe("silent");
});

it("the traveller writes while it runs: the review stops and leaves nothing; their message is answered", async () => {
  setLang("tr");
  await seed("rv4");
  const aborted = () => Object.assign(new Error("aborted"), { name: "AbortError" });
  const slow = (signal?: AbortSignal) => new Promise<Partial<Anthropic.Message>>((_, reject) => (signal?.aborted ? reject(aborted()) : signal?.addEventListener("abort", () => reject(aborted()))));
  const { client } = fakeClient([slow, done("Bangkok'ta sokak yemeği turu iyi olur.")]);
  const llm = anthropicProvider(client, "claude-opus-5");
  const review = reviewTrip("rv4", "Plan yeni kuruldu.", "first", llm);
  await new Promise((r) => setTimeout(r, 20));
  await sendMessage("rv4", "Bangkok'ta ne yapayım?", llm);
  expect(await review).toBe("skipped");
  expect(await shown("rv4")).toEqual(["Bangkok'ta ne yapayım?", "Bangkok'ta sokak yemeği turu iyi olur."]);
});
