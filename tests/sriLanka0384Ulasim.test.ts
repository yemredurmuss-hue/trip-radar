// 0.38.4 (Y3): Emre's Sri Lanka trip, landing at Colombo (CMB) and staying in Ahangama. The road from the airport is one box
// in Ulaşım named by its two cities (Kolombo → Ahangama, the airport's code small); the start's "Havalimanı transferi"
// said at the airport's city is that road's, not a box of its own; Önerimiz offers public transport (0.39.1; the train in 0.38.4), then a taxi or a private
// transfer, each with a real search and no made-up length, hour or price; "Bunu seç" says the way as C15's tiles do.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { withLang } from "../src/lib/i18n";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs, farEnd } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { isPlaceholder, placeholderPrint } from "../src/lib/startTrip";
import { wayPicks } from "../src/lib/ticketFrame";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, LegMode, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-19";
const base: Trip = {
  id: "t1", title: "Sri Lanka", confirmedDates: { start: "2026-11-01", end: "2026-11-15" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: [], count: 2 },
};

let n = 0;
const said = (over: Partial<Item>): Item => makeItem({ id: `c${++n}`, origin: "chat", status: "chosen", dates: { start: null, end: null, source: "unverified" }, ...over });
const ends = (from: string | null, to: string | null) => ({ from, to, departure: null, arrival: null, carrier: null, flightNumber: null, stops: null });
const flight = (name: string, from: string, to: string, day: string, over: Partial<Item> = {}) =>
  said({ name, category: "flight", plannedKind: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), city: to, dates: { start: day, end: null, source: "unverified" }, flight: ends(from, to), ...over });
const sriLanka = () => [
  flight("Bodrum → Kolombo Uçuşu", "BJV", "CMB", "2026-11-01"),
  said({ name: "Ahangama Konaklama", category: "stay", plannedKind: "stay", city: "Ahangama", needKey: "stay:ahangama", dates: { start: "2026-11-01", end: "2026-11-10", source: "unverified" } }),
  flight("Sri Lanka → Bali", "CMB", "DPS", "2026-11-10", { city: "Bali" }),
];
/** The start's playbook card "Havalimanı transferi" (anchor arrive) made before any flight was known: to the airport's city. */
const startTransfer = () =>
  said({ name: "Havalimanı transferi", category: "transport", plannedKind: "transfer", needKey: "transport:kolombo", city: "Kolombo", dates: { start: "2026-11-01", end: null, source: "unverified" }, flight: ends(null, "Kolombo") });

const ARRIVAL = "2026-11-01:arrival:ahangama";

function board(items: Item[], over: Partial<Trip> = {}) {
  const t: Trip = { ...base, ...over };
  const ctx = makeContext(t, items, { today: TODAY });
  const plan = buildPlan(t, items);
  const legs = buildLegs(plan, t);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(t, i), empty: isEmptyRecord(t, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip: t, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx };
  const transport = collectionsOf(input).find((c) => c.section.id === "transport")?.intents ?? [];
  return { legs, transport };
}

/** The trip with the start's transfer set aside as its placeholder, and a way said on the arrival when given. */
function withStart(mode: LegMode | null = null, booked = false) {
  const tr = startTransfer();
  const over: Partial<Trip> = {
    startGuide: { placeholders: { [tr.id]: placeholderPrint(tr) } } as Trip["startGuide"],
    ...(mode || booked ? { legs: { [ARRIVAL]: { mode, booked, note: null, updatedAt: 1 } } } : {}),
  };
  return board([...sriLanka(), tr], over);
}

describe("Kolombo → Ahangama in Ulaşım", () => {
  it("is one box named by its two cities, the airport's code small, its ends Kolombo (CMB) → Ahangama", () => {
    for (const r of [board(sriLanka()), withStart()]) {
      expect(r.transport.map((i) => i.head.name)).toEqual(["Kolombo → Ahangama", "Ahangama → Kolombo"]);
      const road = r.transport[0];
      expect(road.head.route).toEqual({ from: "Kolombo", to: "Ahangama" });
      expect(road.head.hub).toBe("CMB");
      expect(road.head.kindWord).toBe("Transfer");
      expect(road.ticket?.from).toMatchObject({ city: "Kolombo", place: "CMB" });
      expect(road.ticket?.to).toMatchObject({ city: "Ahangama", place: null });
      expect(road.status).toBe("searching");
    }
    expect(farEnd(board(sriLanka()).legs.find((l) => l.kind === "arrival")!)).toEqual({ city: "Kolombo", code: "CMB" });
  });

  it("takes the start's transfer said at the airport's city onto that road (no box of its own)", () => {
    const { legs, transport } = withStart();
    expect(legs.find((l) => l.key === ARRIVAL)!.options.map((i) => i.name)).toEqual(["Havalimanı transferi"]);
    expect(transport.some((i) => i.head.name === "Havalimanı transferi")).toBe(false);
  });

  it("offers Önerimiz: public transport, then a taxi or a private transfer, with real searches and no length, hour or price", () => {
    const road = withStart().transport[0];
    expect(road.modes).toEqual(["train", "bus", "transfer", "taxi", "car"]);
    expect(road.wayPicks).toEqual(["train", "taxi"]);
    expect(road.estimate).toBeNull();
    const picks = withLang("tr", () => wayPicks(road, { countries: ["LK"] }));
    // (Sri Lanka has its coast line: a train, on the map's directions as no rail site is registered; 0.39.1 kept it)
    expect(picks.map((p) => [p.mode, p.label])).toEqual([["train", "Tren"], ["taxi", "Taksi ya da özel transfer"]]);
    const train = new URL(picks[0].site!.url);
    expect(train.origin + train.pathname).toBe("https://www.google.com/maps/dir/");
    expect(Object.fromEntries(train.searchParams)).toEqual({ api: "1", origin: "Kolombo Havalimanı", destination: "Ahangama", travelmode: "transit" });
    expect(picks[1].site).toMatchObject({ id: "uber" });
    expect(picks[1].site!.url).toMatch(/^https:\/\/m\.uber\.com\/ul\/\?action=setPickup&pickup\[formatted_address\]=Kolombo%20Havaliman%C4%B1&dropoff\[formatted_address\]=Ahangama$/);
    // Nothing made up: no figures in the rows' words.
    expect(picks.map((p) => p.label).join(" ")).not.toMatch(/\d/);
  });

  it("a place with no passenger rail (Bali, 0.39.1): public transport there, picked as a bus, never a train made up", () => {
    const vm = { wayPicks: ["train", "taxi"] as LegMode[], head: { ...withStart().transport[0].head, city: "Canggu" }, ticket: null };
    expect(withLang("tr", () => wayPicks(vm as never, { countries: ["ID"] })).map((p) => [p.mode, p.label])).toEqual([["bus", "Toplu taşıma"], ["taxi", "Taksi ya da özel transfer"]]);
  });

  it("uses the country's own rail site when the register has one (JR in Japan)", () => {
    const vm = { wayPicks: ["train"] as LegMode[], head: withStart().transport[0].head, ticket: withStart().transport[0].ticket };
    expect(wayPicks(vm, { countries: ["JP"] })[0].site).toMatchObject({ id: "jr" });
  });

  it("Bunu seç says the way: a taxi is arranged with nothing to book, the train a train", () => {
    const taxi = withStart("taxi").transport[0];
    expect(taxi).toMatchObject({ status: "arranged", kind: "taxi", note: "rezervasyon gerekmez", chosen: null });
    expect(taxi.wayPicks).toBeUndefined();
    const train = withStart("train").transport[0];
    expect(train).toMatchObject({ status: "arranged", kind: "train", head: { kindWord: "Tren", route: { from: "Kolombo", to: "Ahangama" } } });
    // Değiştir draws the ways again in place.
    expect(train.modes).toEqual(["train", "bus", "transfer", "taxi", "car"]);
    // "Ben hallettim" with no way said: sorted out.
    expect(withStart(null, true).transport[0]).toMatchObject({ status: "arranged", note: "sen hallettin", chosen: null });
  });

  it("offers nothing of the kind on a transfer within the city the flight lands in", () => {
    const items = [
      flight("İstanbul → Porto", "IST", "OPO", "2026-11-01"),
      said({ name: "Porto Konaklama", category: "stay", plannedKind: "stay", city: "Porto", needKey: "stay:porto", dates: { start: "2026-11-01", end: "2026-11-15", source: "unverified" } }),
    ];
    expect(board(items).transport.every((i) => i.wayPicks === undefined && i.head.hub === undefined)).toBe(true);
  });
});
