// "Maderia dan İstanbul a bilet koy" on a Porto–Madeira trip, English board (0.36.36): the reply said the return
// flight card was updated, but its arrival stayed empty, so the card had no `to` and no offers. A flight's ends said
// in the chat land where the card reads them (flight.from / flight.to), a place typed loosely is the trip's own
// (Maderia → Madeira, FNC), and the reply says "updated" only for what really changed on the stored record.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { tripPlaceOf } from "../src/lib/chatBooking";
import { db, listItems } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { airportCode } from "../src/lib/searchLinks";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

type Block = Anthropic.ContentBlock;
const say = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Block[] });
const use = (name: string, input: unknown): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: `tu-${Math.random()}`, name, input, caller: { type: "direct" } }] as Block[],
});
function fake(responses: Partial<Anthropic.Message>[]) {
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
  return { llm: anthropicProvider(client, "claude-opus-5"), calls };
}
const resultOf = (calls: Anthropic.MessageCreateParams[], n: number) => {
  const r = (calls[n].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
  return { error: r.is_error === true, body: String(r.content) };
};

const T = "pm";
const trip: Trip = { id: T, title: "Porto ve Madeira", confirmedDates: { start: "2026-10-14", end: "2026-10-21" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const said = (input: Partial<PlannedInput> & Pick<PlannedInput, "kind">, id: string, over: Partial<Item> = {}): Item => ({
  ...plannedItem({ date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...input }, T, id, 1),
  ...over,
});
const plan = (over: Record<string, unknown>) => ({
  kind: "flight", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null,
  replaces: null, item_id: null, provider: null, price: null, currency: null, ...over,
});
const board = () => [
  said({ kind: "flight", from: "İstanbul", to: "Porto", date: "2026-10-14", booked: true }, "out"),
  makeItem({ id: "porto", tripId: T, category: "stay", needKey: "stay:porto", name: "Porto flat", city: "Porto", status: "booked", dates: { start: "2026-10-14", end: "2026-10-17", source: "page" } }),
  said({ kind: "flight", from: "Porto", to: "Madeira", date: "2026-10-17", booked: true }, "move"),
  makeItem({ id: "fnc", tripId: T, category: "stay", needKey: "stay:funchal", name: "Funchal flat", city: "Funchal", status: "booked", dates: { start: "2026-10-17", end: "2026-10-21", source: "page" } }),
  // The way home the start made room for: from Madeira, arrival empty ("Madeira / Funchal → To").
  said({ kind: "flight", from: "Madeira", date: "2026-10-21" }, "home"),
];

async function put(items: Item[]) {
  const d = await db();
  for (const store of ["items", "messages", "trips"] as const) await d.clear(store);
  await d.put("trips", trip);
  for (const i of items) await d.put("items", i);
}
const flightsOn = async (day: string) => (await listItems(T)).filter((i) => i.category === "flight" && i.dates.start === day);

beforeEach(() => setLang("en"));
afterEach(() => setLang("tr"));

describe("a flight's ends said in the chat", () => {
  it("a place typed loosely is the trip's own: Maderia → Madeira (FNC); a place the code knows stays", () => {
    const items = board();
    expect(tripPlaceOf("Maderia", items)).toBe("Madeira");
    expect(airportCode(tripPlaceOf("Maderia", items))).toBe("FNC");
    expect(tripPlaceOf("İstanbul", items)).toBe("İstanbul");
    expect(tripPlaceOf("Lizbon", items)).toBe("Lizbon");
    // Not on the trip: never guessed.
    expect(tripPlaceOf("Maderia", [])).toBe("Maderia");
  });

  for (const [how, extra] of [
    ["with the empty card's item_id", { item_id: "home" }],
    ["without an item_id (the same plan said again)", {}],
  ] as const) {
    it(`"Maderia dan İstanbul a bilet koy" ${how}: the existing return flight gets İstanbul as its arrival`, async () => {
      await put(board());
      const { llm, calls } = fake([use("plan_item", plan({ from: "Maderia", to: "İstanbul", date: "2026-10-21", ...extra })), say("I updated the return flight card to Madeira → İstanbul.")]);
      await sendMessage(T, "Maderia dan İstanbul a bilet koy", llm);
      const result = resultOf(calls, 1);
      expect(result.error).toBe(false);
      const [home, ...more] = await flightsOn("2026-10-21");
      expect(more).toEqual([]);
      // The card's ends, and the offers' need from them (EmptyCard: airportCode of each end).
      expect(home).toMatchObject({ id: "home", flight: { from: "Madeira", to: "İstanbul" } });
      expect([airportCode(home.flight!.from), airportCode(home.flight!.to)]).toEqual(["FNC", "IST"]);
      // The reply's summary says what really changed, and only that.
      const body = JSON.parse(result.body);
      expect(body.unchanged).toBeUndefined();
      expect(body.changed).toEqual(["Madeira → İstanbul"]);
      expect(body.summary).toContain("Madeira → İstanbul");
    });
  }

  it("said again with nothing new: unchanged, the summary says nothing changed", async () => {
    await put(board().map((i) => (i.id === "home" ? { ...i, flight: { ...i.flight!, to: "İstanbul" }, city: "İstanbul" } : i)));
    const { llm, calls } = fake([use("plan_item", plan({ from: "Madeira", to: "İstanbul", date: "2026-10-21", item_id: "home" })), say("Nothing to change.")]);
    await sendMessage(T, "Madeira'dan İstanbul'a bilet koy", llm);
    const body = JSON.parse(resultOf(calls, 1).body);
    expect(resultOf(calls, 1).body.startsWith('{"unchanged"')).toBe(true);
    expect(body).toMatchObject({ unchanged: true, changed: [] });
    expect(body.summary).toMatch(/nothing changed/);
  });
});
