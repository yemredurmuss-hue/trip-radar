// A day on the move as one card: its steps in order (check-out, the transfer, the flight, the transfer,
// check-in), with when and where each stands. Times from the records or worked out from them, marked.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { EMPTY_METRICS } from "../src/lib/items";
import { dayRows, daySummary, journeySteps, journeyTitle, rowsLeft, stepsReady } from "../src/lib/journey";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline, type RentalEntry, type TimelineSection } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";

type Journey = Extract<TimelineSection, { kind: "journey" }>;
const row = (s: ReturnType<typeof journeySteps>[number]) =>
  `${s.time ? `${s.estimated ? "~" : ""}${s.time}` : "saat yok"}${s.hint ? ` (${s.hint})` : ""} | ${s.title}${s.sub ? ` · ${s.sub}` : ""} | ${s.status}`;

describe("a day on the move", () => {
  it("lays out Porto → Madeira: check-out, taxi, flight, transfer, check-in", () => {
    const trip: Trip = {
      id: "t", title: "Porto ve Madeira", confirmedDates: { start: "2026-10-07", end: "2026-10-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
      legs: { "2026-10-10:departure:porto": { mode: "taxi", booked: false, note: null, updatedAt: 1 } },
    };
    const base = (over: Partial<Item>): Item => ({
      id: Math.random().toString(36).slice(2), tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name: "x", provider: null, summary: "",
      optionDetail: null, url: null, imageUrl: null, city: "Porto", country: null, countryCode: null, location: { address: null, area: null, approximate: false },
      dates: { start: null, end: null, source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
      price: { amount: 200, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
      metrics: EMPTY_METRICS, geo: null, highlights: [], concerns: [], reviewSummary: null, missing: [], status: "booked", statusNote: null, createdAt: 1, updatedAt: 1,
      ...over,
    });
    const items = [
      base({ name: "Jardim Stay", dates: { start: "2026-10-07", end: "2026-10-10", source: "url" } }),
      base({ name: "Quinta Vista", city: "Madeira", needKey: "stay:madeira", dates: { start: "2026-10-10", end: "2026-10-14", source: "url" } }),
      base({
        name: "TAP TP1693", category: "flight", needKey: "flight:opo-fnc", city: "Madeira", status: "chosen", dates: { start: "2026-10-10", end: null, source: "page" },
        flight: { from: "OPO", to: "FNC", departure: "2026-10-10T15:00", arrival: "2026-10-10T16:55", carrier: "TAP", flightNumber: "TP1693", stops: 0 },
        metrics: { ...EMPTY_METRICS, durationMinutes: 115 },
      }),
    ];
    const plan = buildPlan(trip, items);
    const timeline = buildTimeline(plan, buildLegs(plan, trip), items);
    const move = timeline.sections.find((s): s is Journey => s.kind === "journey" && s.journey.role === "move")!;
    expect(journeyTitle(move.journey)).toBe("4. gün");
    expect([move.journey.from, move.journey.to]).toEqual(["Porto", "Madeira"]);
    const steps = journeySteps(move);
    expect(steps.map(row)).toEqual([
      "~11:00 (genelde) | Check-out · Jardim Stay | Rezerve",
      "13:00 (en geç havalimanında) | Otel → Havalimanı · Jardim Stay → OPO havalimanı | Taksi · rezerve edilmedi",
      "15:00 | Uçuş Porto → Madeira · TAP TP1693 · 15:00 → 16:55 · 1 sa 55 dk | Bilet alınmadı",
      "16:55 (iniş) | Havalimanı → Otel · FNC havalimanı → Quinta Vista | Planlanmadı",
      // Not before landing and getting there: the usual 15:00 check-in is past by then.
      "~17:55 (varıştan sonra) | Check-in · Quinta Vista | Rezerve",
    ]);
    expect(stepsReady(steps)).toBe(2);
    // A taxi is a reservation (its card); the metro is only how they'll go (a line).
    const out = (t: Trip) => {
      const p = buildPlan(t, items);
      const j = buildTimeline(p, buildLegs(p, t), items).sections.find((s): s is Journey => s.kind === "journey" && s.journey.role === "move")!;
      return dayRows({ journey: j }).find((r) => r.leg?.kind === "departure")!;
    };
    expect(out(trip)).toMatchObject({ kind: "leg", state: "pending" });
    const metro: Trip = { ...trip, legs: { "2026-10-10:departure:porto": { mode: "metro", booked: false, note: null, updatedAt: 1 } } };
    expect(out(metro)).toMatchObject({ kind: "leg", state: "info", line: "Metro · planlandı" });
    // The day's own card isn't among Madeira's days any more: it's this card.
    const madeira = timeline.sections.find((s) => s.kind === "city" && s.city === "Madeira")!;
    expect(madeira.kind === "city" && madeira.entries.filter((e) => e.kind === "day").map((e) => e.kind === "day" && e.title)).toEqual(["5. gün", "6. gün", "7. gün"]);
  });

  it("reads a day as rows: reservations as cards (the car on its first day), information as lines", () => {
    const trip: Trip = { id: "t", title: "Madeira", confirmedDates: { start: "2026-10-10", end: "2026-10-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const base = (over: Partial<Item>): Item => ({
      id: Math.random().toString(36).slice(2), tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:madeira", name: "x", provider: null, summary: "",
      optionDetail: null, url: null, imageUrl: null, city: "Madeira", country: null, countryCode: null, location: { address: null, area: null, approximate: false },
      dates: { start: null, end: null, source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
      price: { amount: 90, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
      metrics: EMPTY_METRICS, geo: null, highlights: [], concerns: [], reviewSummary: null, missing: [], status: "booked", statusNote: null, createdAt: 1, updatedAt: 1,
      ...over,
    });
    const at = (day: string, time: string) => ({ from: null, to: null, departure: `${day}T${time}`, arrival: null, carrier: null, flightNumber: null, stops: null });
    const items = [
      base({ name: "Quinta Vista", dates: { start: "2026-10-10", end: "2026-10-14", source: "url" } }),
      base({ name: "FAA Rentals", category: "transport", needKey: "transport:madeira", status: "chosen", dates: { start: "2026-10-11", end: "2026-10-13", source: "page" }, flight: at("2026-10-11", "09:00") }),
      base({ name: "Levada yürüyüşü", category: "activity", needKey: "activity:levada", status: "chosen", dates: { start: "2026-10-11", end: null, source: "page" }, flight: at("2026-10-11", "10:00") }),
      base({ name: "Balina turu", category: "activity", needKey: "activity:balina", status: "booked", dates: { start: "2026-10-11", end: null, source: "page" }, flight: at("2026-10-11", "15:30") }),
      base({ name: "Armazém do Sal", category: "food", needKey: "food:x", status: "saved", dates: { start: "2026-10-11", end: null, source: "page" } }),
    ];
    const plan = buildPlan(trip, items);
    const timeline = buildTimeline(plan, buildLegs(plan, trip), items);
    const rentals = timeline.entries.filter((e): e is RentalEntry => e.kind === "rental");
    expect(rentals.map((r) => [r.date, r.end, r.group.items.map((i) => i.name)])).toEqual([["2026-10-11", "2026-10-13", ["FAA Rentals"]]]);
    const day = (d: string) => timeline.entries.find((e) => e.kind === "day" && e.date === d)!;
    const rowsOf = (d: string) => dayRows({ day: day(d) as never, rentals });
    const show = (d: string) => rowsOf(d).map((r) => `${r.time ?? "-"} ${r.kind}/${r.state} ${r.title}${r.sub ? ` · ${r.sub}` : ""}`);
    expect(show("2026-10-11")).toEqual([
      "09:00 rental/pending Araç kiralama · FAA Rentals",
      "10:00 item/pending Levada yürüyüşü · €90",
      "15:30 item/done Balina turu · €90 · rezerve",
      "- idea/info Armazém do Sal",
    ]);
    expect(show("2026-10-13")).toEqual(["- info/info Araç iade · FAA Rentals"]);
    // Open while something is left to book; folded, a day says itself in a line.
    expect(rowsLeft(rowsOf("2026-10-11"))).toBe(2);
    expect(daySummary(rowsOf("2026-10-11"))).toBe("3 plan · 2 iş kaldı · 1 fikir");
    expect(daySummary(rowsOf("2026-10-13"))).toBe("Araç iade");
    // The car is one entry of the plan (its to-dos point at it), shown as a card of its first day.
    const madeira = timeline.sections.find((x) => x.kind === "city")!;
    expect(madeira.kind === "city" && madeira.entries.map((e) => e.kind)).toEqual(["rental", "day", "day", "day"]); // the 10th is the day they land
  });

  it("says what's missing on the sample trip, and marks usual hours", async () => {
    const id = await loadDemoTrip();
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const { ctx } = await loadDecisions(trip, items);
    const plan = buildPlan(trip, items);
    const timeline = buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items);
    const journeys = timeline.sections.filter((s): s is Journey => s.kind === "journey");
    expect(journeys.map((j) => [journeyTitle(j.journey), j.journey.role])).toEqual([
      ["1. gün", "arrival"],
      ["4. gün", "move"],
      ["7. gün", "departure"],
    ]);
    // In: two flights to pick from, no time until one is picked; the stay isn't chosen yet either.
    expect(journeySteps(journeys[0], ctx.listings).map(row)).toEqual([
      "saat yok | Uçuş IST → OPO | 2 seçenek · karar ver",
      "saat yok | Havalimanı → Otel · OPO havalimanı → Porto konaklaması | Planlanmadı",
      "saat yok | Check-in · Porto · yer seçilmedi | Karar ver",
    ]);
    // Home: the page says nothing about check-out, so it's the usual hour, marked.
    expect(journeySteps(journeys[2], ctx.listings).map(row)).toEqual([
      "~11:00 (genelde) | Check-out · Lisboa Loft | Rezerve",
      "17:40 (en geç havalimanında) | Otel → Havalimanı · Lisboa Loft → LIS havalimanı | Planlanmadı",
      "19:40 | Uçuş LIS → IST · TAP · Lizbon → İstanbul · 19:40 → 01:35 · 4 sa 55 dk | Bilet alındı",
    ]);
  });
});
