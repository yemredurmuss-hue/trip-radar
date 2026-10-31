// tests/heldGuard.test.ts: A2 held by the code (omurga, Emre 2026-10-31: "seçilen, rezerve edilen sohbetle sessizce oynamaz"):
// a step that would take off, replace, rule out or leave outside the dates something booked or chosen is refused unless the
// call says the user asked for it in this message (confirmed); with it, it is done.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { expect, it } from "vitest";
import { heldTouched, sendMessage } from "../src/lib/assistant";
import { db, listItems } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

function fakeClient(responses: Partial<Anthropic.Message>[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = { messages: { create: async (params: Anthropic.MessageCreateParams) => (calls.push(structuredClone(params)), responses.shift() ?? Promise.reject(new Error("no more fake responses"))) } } as unknown as Anthropic;
  return { client, calls };
}
const call = (id: string, name: string, input: unknown): Partial<Anthropic.Message> => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input, caller: { type: "direct" } }] as Anthropic.ContentBlock[] });
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const resultOf = (c: Anthropic.MessageCreateParams) => (c.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];

async function seed(id: string) {
  const d = await db();
  const trip: Trip = { id, title: "Tromsø", confirmedDates: { start: "2027-02-15", end: "2027-02-20" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  await d.put("trips", trip);
  await d.put("items", makeItem({ id: `${id}-cabin`, tripId: id, category: "stay", name: "Cam tavanlı kulübe", city: "Tromsø", needKey: "stay:cabin", status: "booked", dates: { start: "2027-02-17", end: "2027-02-18", source: "page" } }));
  await d.put("items", makeItem({ id: `${id}-tour`, tripId: id, category: "activity", name: "Husky turu", city: "Tromsø", needKey: "activity:husky", status: "chosen", dates: { start: "2027-02-19", end: null, source: "page" } }));
}

it("the booked cabin isn't taken off on the model's word alone; with the user's yes it is", async () => {
  await seed("hg1");
  const { client, calls } = fakeClient([
    call("t1", "remove_from_plan", { target_id: "hg1-cabin", confirmed: false }),
    done("Kulübe rezerve; kaldırayım mı?"),
  ]);
  await sendMessage("hg1", "planı sadeleştir", anthropicProvider(client, "claude-opus-5"));
  const refused = resultOf(calls[1]);
  expect(refused.is_error).toBe(true);
  expect(String(refused.content)).toContain("Cam tavanlı kulübe");
  expect((await listItems("hg1")).find((i) => i.id === "hg1-cabin")!.status).toBe("booked");

  const yes = fakeClient([call("t2", "remove_from_plan", { target_id: "hg1-cabin", confirmed: true }), done("Kaldırdım, Gizlenenler'de.")]);
  await sendMessage("hg1", "evet kaldır", anthropicProvider(yes.client, "claude-opus-5"));
  expect(resultOf(yes.calls[1]).is_error).toBeFalsy();
  expect((await listItems("hg1")).find((i) => i.id === "hg1-cabin")!.status).toBe("dismissed");
});

it("what counts as touching something held", () => {
  const byId = new Map<string, Item>([
    ["cabin", makeItem({ id: "cabin", name: "Kulübe", status: "booked" })],
    ["tour", makeItem({ id: "tour", name: "Husky turu", status: "chosen" })],
    ["idea", makeItem({ id: "idea", name: "Fiyort", status: "saved" })],
  ]);
  expect(heldTouched("update_items", { changes: [{ item_id: "tour", status: "dismissed" }] }, byId, null)).toEqual(["Husky turu"]);
  // Marking a chosen one booked is the user telling what they did.
  expect(heldTouched("update_items", { changes: [{ item_id: "tour", status: "booked" }] }, byId, null)).toEqual([]);
  expect(heldTouched("update_items", { changes: [{ item_id: "idea", status: "dismissed" }] }, byId, null)).toEqual([]);
  expect(heldTouched("plan_item", { replaces: "cabin" }, byId, null)).toEqual(["Kulübe"]);
  expect(heldTouched("remove_from_plan", { target_id: "idea" }, byId, null)).toEqual([]);
  expect(heldTouched("update_trip", { start: null, end: "2027-02-18" }, byId, () => ["Husky turu"])).toEqual(["Husky turu"]);
});

it("shorter dates that leave the chosen husky tour outside are refused without the user's word", async () => {
  await seed("hg2");
  const { client, calls } = fakeClient([
    call("t1", "update_trip", { title: null, start: null, end: "2027-02-18", budget_amount: null, budget_currency: null, budget_ceiling: null, confirmed: false }),
    done("Husky turu 19'unda; kısaltırsam dışarıda kalır. Yine de kısaltayım mı?"),
  ]);
  await sendMessage("hg2", "geziyi 18'inde bitirelim mi acaba", anthropicProvider(client, "claude-opus-5"));
  expect(resultOf(calls[1]).is_error).toBe(true);
  expect(String(resultOf(calls[1]).content)).toContain("Husky turu");
  expect((await (await db()).get("trips", "hg2"))!.confirmedDates!.end).toBe("2027-02-20");
});
