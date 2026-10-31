// tests/turnUndo.test.ts: A4 (omurga): a chat turn taken back in one tap: what it added goes, what it rewrote comes back
// (the trip's name, a record's status), and nothing changed since by hand is undone by the older reply.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { db, listItems, listMessages } from "../src/lib/db";
import { ChangedSince, undoEvent } from "../src/lib/eventUndo";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { turnUndo } from "../src/lib/turnUndo";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

function fakeClient(responses: Partial<Anthropic.Message>[]) {
  const client = { messages: { create: async () => responses.shift() ?? Promise.reject(new Error("no more fake responses")) } } as unknown as Anthropic;
  return client;
}
const calls = (...uses: { name: string; input: unknown }[]): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: uses.map((u, n) => ({ type: "tool_use", id: `t${n}`, name: u.name, input: u.input, caller: { type: "direct" } })) as Anthropic.ContentBlock[],
});
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const plan = (over: Record<string, unknown>) => ({ kind: "activity", date: null, end_date: null, time: null, from: null, to: null, city: "Tromsø", title: null, booked: false, note: null, replaces: null, item_id: null, provider: null, price: null, currency: null, confirmed: false, ...over });

async function seed(id: string) {
  const d = await db();
  const trip: Trip = { id, title: "Tromsø", confirmedDates: { start: "2027-02-15", end: "2027-02-20" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  await d.put("trips", trip);
  await d.put("items", makeItem({ id: `${id}-fjord`, tripId: id, category: "activity", name: "Fiyort turu", city: "Tromsø", needKey: "activity:fjord", status: "saved", dates: { start: "2027-02-18", end: null, source: "page" } }));
}

it("one tap takes back the whole turn: the husky tour it added goes, the fjord tour it ruled out and the trip's name come back", async () => {
  await seed("tu1");
  const llm = anthropicProvider(
    fakeClient([
      calls(
        { name: "plan_item", input: plan({ title: "Husky turu", date: "2027-02-16" }) },
        { name: "update_items", input: { changes: [{ item_id: "tu1-fjord", status: "dismissed", note: null }], confirmed: false } },
        { name: "update_trip", input: { title: "Kuzey Işıkları", start: null, end: null, budget_amount: null, budget_currency: null, budget_ceiling: null, confirmed: false } },
      ),
      done("Husky turunu ekledim, fiyort turunu çıkardım, adı Kuzey Işıkları yaptım."),
    ]),
    "claude-opus-5",
  );
  await sendMessage("tu1", "husky ekle, fiyortu çıkar, adını Kuzey Işıkları yap", llm);
  const reply = (await listMessages("tu1")).filter((m) => m.role === "assistant" && m.text).at(-1)!;
  expect(reply.undo).toMatchObject({ kind: "fields", fields: ["title"] });
  expect((await listItems("tu1")).some((i) => i.name === "Husky turu")).toBe(true);

  await undoEvent(reply.id);
  const items = await listItems("tu1");
  expect(items.some((i) => i.name === "Husky turu")).toBe(false);
  expect(items.find((i) => i.id === "tu1-fjord")!.status).toBe("saved");
  expect((await (await db()).get("trips", "tu1"))!.title).toBe("Tromsø");
  expect((await listMessages("tu1")).find((m) => m.id === reply.id)!.undoneAt).toBeTypeOf("number");
});

it("a record changed by hand after the turn is never undone by it", async () => {
  await seed("tu2");
  const llm = anthropicProvider(
    fakeClient([calls({ name: "update_items", input: { changes: [{ item_id: "tu2-fjord", status: "dismissed", note: null }], confirmed: false } }), done("Fiyort turunu çıkardım.")]),
    "claude-opus-5",
  );
  await sendMessage("tu2", "fiyortu çıkar", llm);
  const reply = (await listMessages("tu2")).filter((m) => m.role === "assistant" && m.text).at(-1)!;
  const d = await db();
  const fjord = (await d.get("items", "tu2-fjord"))!;
  await d.put("items", { ...fjord, status: "chosen", updatedAt: fjord.updatedAt + 1000 });
  await expect(undoEvent(reply.id)).rejects.toBeInstanceOf(ChangedSince);
  expect((await d.get("items", "tu2-fjord"))!.status).toBe("chosen");
});

it("a turn that changed nothing has no undo", () => {
  const trip: Trip = { id: "x", title: "A", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  expect(turnUndo({ at: 1, trip, items: [] }, { ...trip, updatedAt: 9 }, [])).toBeNull();
});
