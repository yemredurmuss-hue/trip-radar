// The trip map's journeys (Harita tab): every way between places in date order, from the plan and its legs.
import { describe, expect, it } from "vitest";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { formatMinutes, greatCircle } from "../src/lib/mapArc";
import { geocodeQuery, mapLegs, mapRoute, unplaced, type TripMapData } from "../src/lib/mapLegs";
import { buildPlan } from "../src/lib/plan";
import type { Item, ItemStatus, Trip } from "../src/lib/types";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t", title: "Danimarka ve Hollanda", confirmedDates: { start: "2026-10-08", end: "2026-10-17" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1, ...over,
});

let seq = 0;
function item(name: string, over: Partial<Item> = {}): Item {
  return {
    id: `m${++seq}`, tripId: "t", captureIds: [], key: `test:${name}`, category: "stay", needKey: "stay:x", name, provider: null,
    summary: "", optionDetail: null, url: null, imageUrl: null, city: null, country: null, countryCode: null,
    location: { address: null, area: null, approximate: false },
    dates: { start: null, end: null, source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: 200, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null, metrics: EMPTY_METRICS, geo: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
    ...over,
  };
}
const stay = (name: string, city: string, start: string, end: string, status: ItemStatus = "booked") =>
  item(name, { city, dates: { start, end, source: "url" }, status, needKey: `stay:${city.toLowerCase()}` });
const flight = (name: string, from: string, to: string, dep: string, arr: string, status: ItemStatus = "booked", minutes: number | null = null) =>
  item(name, {
    category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), key: null,
    dates: { start: dep.slice(0, 10), end: null, source: "page" },
    flight: { from, to, departure: dep, arrival: arr, carrier: null, flightNumber: null, stops: 0 },
    metrics: { ...EMPTY_METRICS, durationMinutes: minutes },
    status,
  });
const train = (name: string, day: string, city: string, status: ItemStatus = "saved") =>
  item(name, { category: "transport", needKey: `transport:${city.toLowerCase()}`, city, dates: { start: day, end: null, source: "page" }, status });

function mapOf(items: Item[], opts: Parameters<typeof mapLegs>[2] = {}, over: Partial<Trip> = {}) {
  const t = trip(over);
  const plan = buildPlan(t, items);
  const legs = buildLegs(plan, t);
  return { plan, legs, map: mapLegs(plan, legs, opts) };
}
const brief = (m: TripMapData) => m.legs.map((l) => `${l.kind} ${l.from.name} → ${l.to.name} ${l.mode ?? "?"} ${l.booked ? "booked" : "planned"}`);

const DK_NL = [
  flight("Pegasus", "IST", "CPH", "2026-10-08T07:10", "2026-10-08T09:45", "booked", 235),
  stay("Hotel Nyhavn", "Kopenhag", "2026-10-08", "2026-10-12"),
  flight("SAS", "CPH", "AMS", "2026-10-12T11:00", "2026-10-12T12:25", "booked"),
  stay("Canal House", "Amsterdam", "2026-10-12", "2026-10-15", "chosen"),
  train("NS International train Amsterdam → Brussels", "2026-10-15", "Brüksel"),
  stay("Hotel Brussels", "Brüksel", "2026-10-15", "2026-10-17", "chosen"),
  flight("Turkish", "BRU", "IST", "2026-10-17T18:00", "2026-10-17T22:40", "saved"),
];

describe("mapLegs: every journey of the plan, in date order", () => {
  it("draws a multi-country trip: out from home, a city-to-city flight (CPH → AMS), a train, and home again", () => {
    const { map } = mapOf(DK_NL);
    expect(map.home?.name).toBe("İstanbul");
    expect(map.stops.map((s) => `${s.name} ${s.nights}`)).toEqual(["Kopenhag 4", "Amsterdam 3", "Brüksel 2"]);
    expect(brief(map)).toEqual([
      "out İstanbul → Kopenhag flight booked",
      "move Kopenhag → Amsterdam flight booked",
      "move Amsterdam → Brüksel train planned",
      "back Brüksel → İstanbul flight planned",
    ]);
    expect(map.missing).toEqual([]);
    // The time a booking says; a flight across borders without one is worked out from the distance ("~").
    expect(map.legs[0].minutes).toBe(235);
    expect(map.legs[0].estimated).toBe(false);
    expect(map.legs[1].estimated).toBe(true);
    expect(map.legs[1].minutes).toBeGreaterThan(60);
    expect(map.legs[1].minutes).toBeLessThan(150);
    expect(map.legs[2].minutes).toBeNull();
    expect(formatMinutes(235)).toBe("3 sa 55 dk");
    expect(formatMinutes(95, true)).toBe("~1 sa 35 dk");
  });

  it("keeps a train between cities (dashed while it isn't booked, solid once it is)", () => {
    const planned = mapOf(DK_NL).map.legs.find((l) => l.mode === "train")!;
    expect([planned.from.name, planned.to.name, planned.booked]).toEqual(["Amsterdam", "Brüksel", false]);
    const items = DK_NL.map((i) => (i.category === "transport" ? { ...i, status: "booked" as const } : i));
    expect(mapOf(items).map.legs.find((l) => l.mode === "train")!.booked).toBe(true);
  });

  it("leaves off a journey whose end can't be placed, and counts it; a geocoded place puts it back", () => {
    const items = [
      flight("Pegasus", "IST", "CPH", "2026-10-08T07:10", "2026-10-08T09:45"),
      stay("Hotel Nyhavn", "Kopenhag", "2026-10-08", "2026-10-12"),
      stay("Hytte", "Zzyzxby", "2026-10-12", "2026-10-15"),
    ];
    const { plan, legs, map } = mapOf(items);
    expect(map.stops.map((s) => s.name)).toEqual(["Kopenhag"]);
    // The move there and the way home from there (back to where the first flight left).
    expect(map.missing.map((l) => `${l.kind} ${l.from.name} → ${l.to.name}`)).toEqual(["move Kopenhag → Zzyzxby", "back Zzyzxby → İstanbul"]);
    expect(map.legs.map((l) => l.kind)).toEqual(["out"]);
    // Asked of the geocoder once; once it answers, the stop and the journey are on the map.
    const route = mapRoute(plan, legs);
    expect(unplaced(route).map(geocodeQuery)).toEqual(["Zzyzxby"]);
    const found = mapLegs(plan, legs, { geocoded: new Map([["Zzyzxby", { lat: 56.1, lng: 10.2 }]]) });
    expect(found.missing).toEqual([]);
    expect(brief(found)).toEqual(["out İstanbul → Kopenhag flight booked", "move Kopenhag → Zzyzxby ? planned", "back Zzyzxby → İstanbul ? planned"]);
  });

  it("an unknown airport code is looked up as an airport, and left off until it is", () => {
    const items = [stay("Hotel Nyhavn", "Kopenhag", "2026-10-08", "2026-10-12"), flight("Charter", "CPH", "XQZ", "2026-10-12T10:00", "2026-10-12T12:00")];
    const { plan, legs, map } = mapOf(items, {}, { confirmedDates: { start: "2026-10-08", end: "2026-10-12" } });
    // The flight home lands there, so that's home: the way out from it is unknown too.
    expect(map.missing.map((l) => `${l.kind} ${l.from.name} → ${l.to.name}`)).toEqual(["out XQZ → Kopenhag", "back Kopenhag → XQZ"]);
    expect(unplaced(mapRoute(plan, legs)).map(geocodeQuery)).toEqual(["XQZ airport"]);
  });

  it("a trip with nothing to go by draws nothing", () => {
    const { map } = mapOf([], {}, { confirmedDates: null });
    expect(map).toEqual({ home: null, stops: [], legs: [], missing: [] });
  });

  it("goes out from home and back to it: home as known (no flights yet) or where the first flight leaves", () => {
    const stays = [stay("Hotel Nyhavn", "Kopenhag", "2026-10-08", "2026-10-12"), stay("Canal House", "Amsterdam", "2026-10-12", "2026-10-17", "chosen")];
    const { map } = mapOf(stays, { home: "İstanbul" });
    expect(brief(map)).toEqual([
      "out İstanbul → Kopenhag ? planned",
      "move Kopenhag → Amsterdam ? planned",
      "back Amsterdam → İstanbul ? planned",
    ]);
    expect(map.home).toMatchObject({ name: "İstanbul", lat: 41.01, lng: 28.98 });
    // No home and no flights: only the journey between the cities.
    expect(brief(mapOf(stays).map)).toEqual(["move Kopenhag → Amsterdam ? planned"]);
  });

  it("a flight with no stays yet: out to where it lands (named by its city), and home from there", () => {
    const { map } = mapOf([flight("Pegasus", "IST", "AMS", "2026-10-08T07:10", "2026-10-08T09:45", "saved")]);
    expect(brief(map)).toEqual(["out İstanbul → Amsterdam flight planned", "back Amsterdam → İstanbul ? planned"]);
  });

  it("draws a side trip once it's chosen or booked, never while it's only saved (alternatives aren't the route)", () => {
    const oslo = flight("Day trip", "CPH", "OSL", "2026-10-10T08:00", "2026-10-10T09:10", "saved");
    const berlin = flight("Day trip 2", "CPH", "BER", "2026-10-10T08:30", "2026-10-10T09:40", "saved");
    const saved = brief(mapOf([...DK_NL, oslo, berlin]).map);
    expect(saved.some((l) => /Oslo|Berlin/.test(l))).toBe(false);
    const { map } = mapOf([...DK_NL, { ...oslo, status: "chosen" }, berlin]);
    expect(brief(map)).toContain("move Kopenhag → Oslo flight planned");
    expect(brief(map).some((l) => /Berlin/.test(l))).toBe(false);
    expect(map.legs.at(-1)!.kind).toBe("back");
  });

  it("an unchosen flight for another need isn't drawn (IST → LIS saved while IST → OPO is chosen)", () => {
    const { map } = mapOf([
      flight("TK", "IST", "OPO", "2026-10-08T07:00", "2026-10-08T10:00", "chosen"),
      flight("Pegasus", "IST", "LIS", "2026-10-08T08:00", "2026-10-08T11:00", "saved"),
      stay("A", "Porto", "2026-10-08", "2026-10-17"),
    ]);
    expect(brief(map)).toEqual(["out İstanbul → Porto flight planned", "back Porto → İstanbul ? planned"]);
  });

  it("a connection booked on its own is part of the way out: home is where it starts (not Frankfurt)", () => {
    const { map } = mapOf([
      item("LH 1", { ...flight("L1", "IST", "FRA", "2026-10-08T07:00", "2026-10-08T09:00"), needKey: "flight:ist-fra" }),
      item("LH 2", { ...flight("L2", "FRA", "CPH", "2026-10-08T10:00", "2026-10-08T11:30"), needKey: "flight:fra-cph" }),
      stay("A", "Kopenhag", "2026-10-08", "2026-10-17"),
      item("LH 3", { ...flight("L3", "CPH", "FRA", "2026-10-17T12:00", "2026-10-17T13:30"), needKey: "flight:cph-fra" }),
      item("LH 4", { ...flight("L4", "FRA", "IST", "2026-10-17T15:00", "2026-10-17T19:00"), needKey: "flight:fra-ist" }),
    ]);
    expect(map.home?.name).toBe("İstanbul");
    expect(brief(map)).toEqual([
      "out İstanbul → Frankfurt flight booked",
      "out Frankfurt → Kopenhag flight booked",
      "back Kopenhag → Frankfurt flight booked",
      "back Frankfurt → İstanbul flight booked",
    ]);
  });

  it("nights with no place said between two cities: the ways there and on are counted as missing, not dropped", () => {
    const { plan, legs, map } = mapOf([stay("A", "Porto", "2026-10-08", "2026-10-10"), item("B", { dates: { start: "2026-10-10", end: "2026-10-14", source: "url" }, status: "booked" }), stay("C", "Lizbon", "2026-10-14", "2026-10-17")], { home: "İstanbul" });
    expect(map.missing.map((l) => `${l.from.name} → ${l.to.name}`)).toEqual(["Porto → ?", "? → Lizbon"]);
    // Nothing to look up for them.
    expect(unplaced(mapRoute(plan, legs))).toEqual([]);
  });
});

describe("mapArc", () => {
  it("keeps a line across the date line continuous (Tokyo → Los Angeles crosses the Pacific)", () => {
    const line = greatCircle({ lat: 35.68, lng: 139.69 }, { lat: 34.05, lng: -118.24 }, 32);
    for (let i = 1; i < line.length; i++) expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(30);
    expect(line.at(-1)![0]).toBeCloseTo(-118.24 + 360, 1);
  });
});
