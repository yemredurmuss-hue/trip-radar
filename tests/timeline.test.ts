// The trip in the order it happens, for the sample trip and the edge cases: what's missing gets a
// slot to fill, and nothing saved falls off the board.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { buildTimeline, flightSearchUrl } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";

const titles = (t: ReturnType<typeof buildTimeline>) =>
  t.entries.map((e) => (e.kind === "leg" ? `  ${e.leg.from.label} → ${e.leg.to.label}` : `${e.title}${"subtitle" in e && e.subtitle ? ` | ${e.subtitle}` : ""}`));

describe("timeline", () => {
  it("lays out the sample trip from the flight in to the flight home", async () => {
    const id = await loadDemoTrip();
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const { ctx } = await loadDecisions(trip, items);
    const plan = buildPlan(trip, items);
    const timeline = buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items);
    expect(titles(timeline)).toEqual([
      "8 Ekim · Uçuş | IST → OPO",
      "  OPO havalimanı → Porto konaklaması",
      "8–11 Ekim · Konaklama | Porto · 3 gece",
      "9 Ekim · Etkinlik",
      "  Porto konaklaması → Porto Campanhã",
      "11 Ekim · Şehir değişimi | Porto → Lizbon",
      "  Lisboa Santa Apolónia → Lisboa Loft",
      "11–14 Ekim · Konaklama | Lizbon · 3 gece",
      "  Lisboa Loft → LIS havalimanı",
      "14 Ekim · Dönüş | LIS → IST",
    ]);
    const day = timeline.entries.find((e) => e.kind === "day")!;
    expect(day.kind === "day" && day.items.map((i) => i.name)).toEqual(["Douro tekne turu"]);
    const move = timeline.entries.find((e) => e.kind === "travel" && e.role === "move")!;
    expect(move.kind === "travel" && move.travel?.items.map((i) => i.name)).toEqual(["CP Alfa Pendular · Porto → Lizbon"]);
    expect(timeline.unplaced).toEqual([]);
    expect(timeline.undated.map((i) => i.name).sort()).toEqual(["Livraria Lello", "Majestic Café", "Serralves Müzesi", "Tiyatro"]);
  });

  it("leaves a slot to fill when nothing gets the traveller there or home, unless they said how", () => {
    const trip: Trip = { id: "t", title: "Porto", confirmedDates: { start: "2026-10-07", end: "2026-10-10" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const stay: Item = {
      id: "s", tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name: "Jardim Stay", provider: null, summary: "", optionDetail: null,
      url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT", location: { address: null, area: null, approximate: false },
      dates: { start: "2026-10-07", end: "2026-10-10", source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
      price: { amount: 200, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
      metrics: EMPTY_METRICS, geo: null, highlights: [], concerns: [], reviewSummary: null, missing: [], status: "booked", statusNote: null, createdAt: 1, updatedAt: 1,
    };
    const plan = buildPlan(trip, [stay]);
    const open = buildTimeline(plan, buildLegs(plan, trip), [stay]);
    const arrival = open.entries[0];
    expect(arrival).toMatchObject({ kind: "travel", role: "arrival", title: "7 Ekim · Varış", subtitle: "→ Porto", travel: null });
    expect(arrival.kind === "travel" && arrival.searchUrl).toBe(flightSearchUrl("to", "Porto", "2026-10-07", null));
    expect(open.entries.at(-1)).toMatchObject({ kind: "travel", role: "departure", title: "10 Ekim · Dönüş", subtitle: "Porto →" });
    // "Arabayla geliyoruz": no flight slot for the way in.
    const driving = { ...trip, legs: { "2026-10-07:arrival:porto": { mode: "car" as const, booked: false, note: null, updatedAt: 1 } } };
    const t = buildTimeline(plan, buildLegs(plan, driving), [stay]);
    expect(t.entries[0].kind).toBe("leg");
  });

  it("searches flights in plain words, with home when the saved flights tell it", () => {
    expect(decodeURIComponent(flightSearchUrl("from", "Lizbon", "2026-10-14", "IST")!)).toBe(
      "https://www.google.com/travel/flights?q=Flights from Lizbon to IST on 2026-10-14",
    );
  });
});

describe("timeline from what's said and saved", () => {
  const trip: Trip = { id: "t", title: "Porto ve Madeira", confirmedDates: { start: "2026-10-07", end: "2026-10-17" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  const base = (over: Partial<Item>): Item => ({
    id: Math.random().toString(36).slice(2), tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name: "x", provider: null, summary: "",
    optionDetail: null, url: null, imageUrl: null, city: "Porto", country: null, countryCode: null, location: { address: null, area: null, approximate: false },
    dates: { start: null, end: null, source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: 200, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 }, priceHistory: [],
    cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
    metrics: EMPTY_METRICS, geo: null, highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
    ...over,
  });
  const stay = (name: string, start: string, end: string, city: string, status: Item["status"] = "booked") =>
    base({ name, city, needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "url" }, status });
  const flight = (name: string, from: string, to: string, day: string, status: Item["status"], needKey = `flight:${from}-${to}`.toLowerCase()) =>
    base({ name, category: "flight", needKey, city: to, dates: { start: day, end: null, source: "page" }, status, flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 } });
  const said = (input: Partial<PlannedInput> & Pick<PlannedInput, "kind" | "date">) =>
    plannedItem({ end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...input }, "t", `chat-${input.kind}-${input.date}`, 1);
  const build = (items: Item[], t = trip) => {
    const plan = buildPlan(t, items);
    return { plan, timeline: buildTimeline(plan, buildLegs(plan, t), items) };
  };
  const outline = (t: ReturnType<typeof buildTimeline>) =>
    t.sections.map((s) =>
      s.kind === "travel"
        ? `${s.entry.role}: ${(s.entry.travel?.items ?? []).map((i) => i.name).join(", ") || s.entry.subtitle}`
        : `[${s.index} ${s.city} · ${s.nights} gece] ${s.entries.map((e) => (e.kind === "leg" ? "transfer" : e.kind === "day" ? e.title : e.kind === "travel" ? `${e.role}:${e.travel?.items[0].name}` : e.kind)).join(" / ")}`,
    );

  it("never lets a booked flight home hide the flight out, even with the same need key from the pages", () => {
    const items = [
      flight("Pegasus IST-OPO", "IST", "OPO", "2026-10-07", "saved", "flight:ist-opo"),
      flight("TAP FNC-IST", "FNC", "IST", "2026-10-17", "booked", "flight:ist-opo"),
      stay("Jardim Stay", "2026-10-07", "2026-10-10", "Porto"),
      stay("FAA Rentals", "2026-10-10", "2026-10-17", "Funchal"),
    ];
    const { plan, timeline } = build(items);
    expect(plan.closed).toEqual([]);
    expect(outline(timeline)).toEqual([
      "arrival: Pegasus IST-OPO",
      "[1 Porto · 3 gece] transfer / stay",
      "move: Porto → Funchal", // how is still open: no station transfers yet
      "[2 Funchal · 7 gece] stay / transfer",
      "departure: TAP FNC-IST",
    ]);
    expect(timeline.unplaced).toEqual([]);
  });

  it("puts what was said in the chat on its day: the flight in, the flight to Madeira, the car there", () => {
    const items = [
      stay("Jardim Stay", "2026-10-07", "2026-10-11", "Porto"),
      stay("FAA Rentals", "2026-10-11", "2026-10-17", "Funchal"),
      said({ kind: "flight", date: "2026-10-07", from: "İstanbul", to: "Porto" }),
      said({ kind: "flight", date: "2026-10-11", from: "Porto", to: "Funchal" }),
      said({ kind: "car_rental", date: "2026-10-12", end_date: "2026-10-16", city: "Funchal" }),
    ];
    const { timeline } = build(items);
    expect(outline(timeline)).toEqual([
      "arrival: Uçuş · İstanbul → Porto",
      "[1 Porto · 4 gece] transfer / stay / transfer",
      "move: Uçuş · Porto → Funchal",
      "[2 Funchal · 6 gece] transfer / stay / 12 Ekim · Araç kiralama / transfer",
      "departure: Funchal →",
    ]);
    const move = timeline.sections.find((s) => s.kind === "travel" && s.entry.role === "move")!;
    expect(move.kind === "travel" && move.entry.travel?.settled?.status).toBe("chosen"); // planned, not booked
  });

  it("lets a flight page saved for that day take the place of the one said in the chat", () => {
    const planned = said({ kind: "flight", date: "2026-10-07", from: "İstanbul", to: "Porto" });
    const page = flight("Pegasus PC1201", "IST", "OPO", "2026-10-07", "saved");
    const { plan } = build([stay("Jardim Stay", "2026-10-07", "2026-10-10", "Porto"), planned, page]);
    const group = plan.groups.find((g) => g.category === "flight")!;
    expect(group.items.map((i) => i.name).sort()).toEqual(["Pegasus PC1201", "Uçuş · İstanbul → Porto"]);
    const chosen = build([stay("Jardim Stay", "2026-10-07", "2026-10-10", "Porto"), planned, { ...page, status: "chosen" }]);
    expect(chosen.plan.groups.find((g) => g.category === "flight")!.items.map((i) => i.name)).toEqual(["Pegasus PC1201"]);
    expect(chosen.plan.closed.map((c) => c.reason)).toEqual(["Yerine Pegasus PC1201 geldi"]);
  });

  it("puts a flight that isn't a way in, out or between cities on its own day, inside its city", () => {
    const items = [
      stay("Jardim Stay", "2026-10-07", "2026-10-17", "Porto"),
      flight("Day trip", "OPO", "LIS", "2026-10-12", "chosen"),
    ];
    const { timeline } = build(items);
    expect(outline(timeline)).toEqual(["arrival: → Porto", "[1 Porto · 10 gece] transfer / stay / other:Day trip / transfer", "departure: Porto →"]);
  });
});
