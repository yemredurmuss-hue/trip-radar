// Fixes from the 0.13.1 audit: provider schema limits, plans said in the chat, the assistant's tools,
// travel directions, transfer keys and prices.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnalysisSchema } from "../src/lib/analysis";
import { sendMessage, TOOLS } from "../src/lib/assistant";
import { durationText } from "../src/lib/cardFacts";
import { db, listItems } from "../src/lib/db";
import { ExtractionSchema } from "../src/lib/extract";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { anthropicProvider, jsonText } from "../src/lib/llm/anthropic";
import { fitsStrict, schemaLoad, STRICT_LIMITS, strictTools } from "../src/lib/llm/schemaBudget";
import { buildPlan, placeKeyOf } from "../src/lib/plan";
import { checkPlanned, fillPlanned, plannedInput, plannedItem, samePlan } from "../src/lib/planned";
import { ReaderSchema } from "../src/lib/reader";
import { isRental } from "../src/lib/travelKinds";
import type { Item, ItemStatus, Trip } from "../src/lib/types";

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

let seq = 0;
function item(name: string, over: Partial<Item> = {}): Item {
  return {
    id: `a${++seq}`, tripId: "t1", captureIds: [], key: `test:${name}`, category: "stay", needKey: "stay:porto", name, provider: null,
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: null, end: null, source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: 200, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null, metrics: EMPTY_METRICS, geo: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
    ...over,
  };
}
const stay = (name: string, start: string, end: string, status: ItemStatus = "saved", city = "Porto") =>
  item(name, { dates: { start, end, source: "url" }, status, city, needKey: `stay:${city.toLowerCase()}` });
const flight = (name: string, from: string, to: string, dep: string, arr: string, status: ItemStatus = "saved") =>
  item(name, {
    category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), key: null,
    dates: { start: dep.slice(0, 10), end: null, source: "page" },
    flight: { from, to, departure: dep, arrival: arr, carrier: null, flightNumber: null, stops: 0 },
    status,
  });
const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1", title: "Portekiz", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over,
});
const said = (over: Record<string, unknown>) =>
  plannedInput({ kind: "flight", date: "2026-10-11", end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...over });

describe("Claude schema limits", () => {
  it("keeps the strict tools inside the request limits", () => {
    const strict = strictTools(TOOLS.map((t) => t.schema));
    const loads = TOOLS.filter((_, i) => strict[i]).map((t) => schemaLoad(t.schema));
    expect(loads.reduce((s, l) => s + l.unions, 0)).toBeLessThanOrEqual(STRICT_LIMITS.unions);
    expect(loads.reduce((s, l) => s + l.optional, 0)).toBeLessThanOrEqual(STRICT_LIMITS.optional);
    expect(strict.filter(Boolean).length).toBeGreaterThanOrEqual(TOOLS.length - 2); // most stay strict
  });

  it("counts type arrays and nested fields, and sends the page extraction without constrained decoding", () => {
    expect(schemaLoad({ type: "object", properties: { a: { type: ["string", "null"] }, b: { type: "array", items: { type: "object", properties: { c: { anyOf: [{ type: "number" }, { type: "null" }] } }, required: [] } } }, required: ["a", "b"] })).toEqual({ optional: 1, unions: 2 });
    expect(fitsStrict(schemaLoad(zodOutputFormat(ExtractionSchema).schema))).toBe(false);
    expect(fitsStrict(schemaLoad(zodOutputFormat(ReaderSchema).schema))).toBe(true);
    expect(fitsStrict(schemaLoad(zodOutputFormat(AnalysisSchema).schema))).toBe(true);
  });

  it("asks for a large schema by instruction, validates it and retries once", async () => {
    const Big = z.object(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, z.string().nullable()])));
    const good = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, i === 3 ? "x" : null]));
    const { client, calls } = fakeClient([
      { stop_reason: "end_turn", content: [{ type: "text", text: "İşte: {\"f0\": 1}", citations: null }] as Anthropic.ContentBlock[] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "```json\n" + JSON.stringify(good) + "\n```", citations: null }] as Anthropic.ContentBlock[] },
    ]);
    const out = await anthropicProvider(client, "claude-opus-5").generateJson("sys", "prompt", Big);
    expect(out.f3).toBe("x");
    expect(calls).toHaveLength(2);
    expect("output_config" in calls[0] && (calls[0] as any).output_config?.format).toBeFalsy();
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain("şemaya uymadı");
    expect(jsonText('Tamam {"a": {"b": 1}} bitti')).toBe('{"a": {"b": 1}}');
  });
});

describe("plans said in the chat", () => {
  it("refuses impossible dates and a stay without a night", () => {
    expect(checkPlanned(said({ date: "2026-02-30", to: "Porto" }))).toMatch(/Tarih/);
    expect(checkPlanned(said({ kind: "stay", city: "Porto", end_date: "2026-10-11" }))).toMatch(/çıkış/);
    expect(checkPlanned(said({ kind: "stay", city: "Porto", end_date: "2026-10-14" }))).toBeNull();
    expect(plannedInput({ kind: "flight", date: "2026-10-11", to: " Madeira " })).toMatchObject({ to: "Madeira", from: null, booked: false, note: null });
  });

  it("finds the same trip said again without where it leaves from, and keeps what was said before", () => {
    const before = plannedItem(said({ from: "Porto", to: "Madeira", time: "09:40", note: "TAP" }), "t1", "x", 1);
    const again = plannedItem(said({ to: "Funchal", booked: true }), "t1", "y", 2);
    expect(samePlan(before, again)).toBe(true);
    expect(samePlan(before, plannedItem(said({ from: "Lisbon", to: "Madeira" }), "t1", "z", 2))).toBe(false);
    const filled = fillPlanned(said({ to: "Funchal", booked: true }), before);
    expect(filled).toMatchObject({ from: "Porto", time: "09:40", note: "TAP" });
    const activity = (title: string) => plannedItem(said({ kind: "activity", city: "Porto", title }), "t1", title, 1);
    expect(samePlan(activity("Fado"), activity("Tekne turu"))).toBe(false);
  });

  it("knows a car rental said in the chat whatever its title", () => {
    const car = plannedItem(said({ kind: "car_rental", city: "Madeira", title: "Madeira arabası" }), "t1", "c", 1);
    expect(isRental(car)).toBe(true);
  });

  it("gives a rental said in the chat the place of the rental page chosen for it", () => {
    const t = trip({ confirmedDates: { start: "2026-10-07", end: "2026-10-17" } });
    const car = plannedItem(said({ kind: "car_rental", date: "2026-10-11", city: "Madeira" }), "t1", "c", 1);
    const page = item("Sixt Funchal car rental", { category: "transport", needKey: "transport:funchal", city: "Funchal", dates: { start: "2026-10-11", end: "2026-10-17", source: "page" }, status: "chosen" });
    const plan = buildPlan(t, [stay("Porto", "2026-10-07", "2026-10-11"), stay("Jardim", "2026-10-11", "2026-10-17", "saved", "Funchal"), car, page]);
    expect(plan.closed.map((c) => c.item.id)).toContain("c");
  });
});

describe("travel directions and transfer keys", () => {
  it("reads airport codes and station names as their city", () => {
    expect(placeKeyOf("OPO")).toBe("porto");
    expect(placeKeyOf("Lisboa Santa Apolónia")).toBe("lizbon");
    expect(placeKeyOf("Madeira Airport")).toBe("funchal");
    expect(placeKeyOf("Porto Santo")).toBe("porto santo");
    expect(placeKeyOf("İstanbul Havalimanı")).toBe("istanbul");
  });

  it("doesn't take a flight leaving the first city as the way in", () => {
    const t = trip({ confirmedDates: { start: "2026-10-08", end: "2026-10-10" } });
    // The only flight near the start leaves Porto: it isn't how they arrive, it's how they leave.
    const items = [stay("Jardim", "2026-10-08", "2026-10-10", "chosen"), flight("Back", "OPO", "IST", "2026-10-09T10:00", "2026-10-09T16:00", "chosen")];
    const legs = buildLegs(buildPlan(t, items), t);
    expect(legs[0].travel).toBeNull();
    expect(legs.at(-1)!.travel?.items[0].name).toBe("Back");
  });

  it("keeps the plan for the way in when a different flight day is chosen", () => {
    const t = trip({ confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, legs: { "2026-10-08:arrival:porto": { mode: "metro", booked: false, note: null, updatedAt: 1 } } });
    const items = [stay("Jardim", "2026-10-08", "2026-10-11", "chosen"), flight("Early", "IST", "OPO", "2026-10-07T20:00", "2026-10-07T23:00", "chosen")];
    const legs = buildLegs(buildPlan(t, items), t);
    expect(legs[0]).toMatchObject({ key: "2026-10-08:arrival:porto", date: "2026-10-07", mode: "metro" });
  });

  it("still reads a plan saved under an older key", () => {
    const t = trip({ confirmedDates: { start: "2026-10-08", end: "2026-10-14" }, legs: { "2026-10-11:move:porto>lisbon": { mode: "train", booked: false, note: null, updatedAt: 1 } } });
    const items = [stay("Jardim", "2026-10-08", "2026-10-11", "chosen"), stay("Alfama", "2026-10-11", "2026-10-14", "chosen", "Lisbon")];
    const move = buildLegs(buildPlan(t, items), t).find((l) => l.kind === "move")!;
    expect(move.key).toBe("2026-10-11:move:porto>lizbon");
    expect(move.mode).toBe("train");
  });
});

describe("assistant tools", () => {
  it("chooses one option per need, keeps the note, and refuses bad statuses and dates", async () => {
    const d = await db();
    await d.put("trips", trip());
    const [a, b] = [stay("Jardim", "2026-10-08", "2026-10-11", "chosen"), stay("Casa Azul", "2026-10-08", "2026-10-11")];
    a.statusNote = "merkezi";
    for (const i of [a, b]) await d.put("items", i);
    const call = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input, caller: { type: "direct" } });
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          call("u1", "update_items", { changes: [{ item_id: b.id, status: "chosen", note: null }] }),
          call("u2", "update_items", { changes: [{ item_id: a.id, status: "picked", note: null }] }),
          call("u3", "update_trip", { title: null, start: "2026-10-12", end: "2026-10-08", budget_amount: null, budget_currency: null }),
        ] as Anthropic.ContentBlock[],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Tamam.", citations: null }] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("t1", "Casa Azul olsun", anthropicProvider(client, "claude-opus-5"));
    const results = calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    expect(results.map((r) => Boolean(r.is_error))).toEqual([false, true, true]);
    const items = await listItems("t1");
    expect(items.find((i) => i.id === a.id)).toMatchObject({ status: "saved", statusNote: "merkezi" });
    expect(items.find((i) => i.id === b.id)!.status).toBe("chosen");
    expect((await d.get("trips", "t1"))!.confirmedDates).toBeNull();
    // plan_item isn't strict (too many nullable fields to fit with the rest), the others are.
    const tools = calls[0].tools as Anthropic.Tool[];
    expect(tools.find((t) => t.name === "plan_item")!.strict).toBeUndefined();
    expect(tools.find((t) => t.name === "update_items")!.strict).toBe(true);
  });
});

describe("numbers", () => {
  it("rounds durations to whole minutes", () => {
    expect(durationText(59.6)).toBe("1 sa");
    expect(durationText(125)).toBe("2 sa 5 dk");
  });
});
