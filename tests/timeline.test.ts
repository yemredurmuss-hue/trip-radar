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
  t.entries.map((e) => {
    if (e.kind === "leg") return `  ${e.leg.from.label} → ${e.leg.to.label}`;
    if (e.kind === "day") return `${e.title} [${[...e.legs.map((l) => `${l.from.label} → ${l.to.label}`), ...e.items.map((i) => i.name)].join("; ")}]`;
    if (e.kind === "plan") return `Planlar [${e.items.map((i) => i.name).join("; ")}]`;
    if (e.kind === "rental") return `Araç ${e.date}–${e.end} [${e.group.items.map((i) => i.name).join("; ")}]`;
    return `${e.title}${"subtitle" in e && e.subtitle ? ` | ${e.subtitle}` : ""}`;
  });

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
      "1. gün []",
      "2. gün [Douro tekne turu]",
      "3. gün []",
      "  Porto konaklaması → Porto Campanhã",
      "11 Ekim · Şehir değişimi | Porto → Lizbon",
      "  Lisboa Santa Apolónia → Lisboa Loft",
      "11–14 Ekim · Konaklama | Lizbon · 3 gece",
      "4. gün []",
      "5. gün []",
      "6. gün []",
      "7. gün []",
      "  Lisboa Loft → LIS havalimanı",
      "14 Ekim · Dönüş | LIS → IST",
    ]);
    // Each city shows its stays first, then a card for every day; days on the move are one card on the line.
    expect(timeline.sections.map((x) => (x.kind === "journey" ? `${x.journey.dayNo}. gün ${x.journey.role}` : x.kind === "city" ? x.city : x.kind))).toEqual([
      "1. gün arrival",
      "Porto",
      "4. gün move",
      "Lizbon",
      "7. gün departure",
    ]);
    const porto = timeline.sections.find((x) => x.kind === "city")!;
    expect(porto.kind === "city" && [porto.stays.length, porto.entries.map((e) => e.kind)]).toEqual([1, ["day", "day"]]);
    const move = timeline.sections.find((x) => x.kind === "journey" && x.journey.role === "move")!;
    expect(move.kind === "journey" && [move.journey.out?.kind, move.journey.in?.kind, move.entries.map((e) => e.kind)]).toEqual([
      "open",
      "booked",
      ["leg", "travel", "leg", "day"],
    ]);
    const day = timeline.entries.find((e) => e.kind === "day" && e.items.length)!;
    expect(day.kind === "day" && [day.title, day.items.map((i) => i.name)]).toEqual(["2. gün", ["Douro tekne turu"]]);
    const train = timeline.entries.find((e) => e.kind === "travel" && e.role === "move")!;
    expect(train.kind === "travel" && train.travel?.items.map((i) => i.name)).toEqual(["CP Alfa Pendular · Porto → Lizbon"]);
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
    expect(t.entries.some((e) => e.kind === "travel" && e.role === "arrival")).toBe(false);
    const way = t.sections[0];
    expect(way.kind === "journey" && way.entries.map((e) => (e.kind === "leg" ? e.leg.mode : e.kind))).toEqual(["car", "day"]);
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
  /** Travel on the line; a city as its stays, how many days, and what's in the days that have something. */
  const outline = (t: ReturnType<typeof buildTimeline>) =>
    t.sections.map((s) => {
      if (s.kind === "travel") return `${s.entry.role}: ${(s.entry.travel?.items ?? []).map((i) => i.name).join(", ") || s.entry.subtitle}`;
      if (s.kind === "journey") {
        const parts = s.entries.map((e) =>
          e.kind === "travel"
            ? `${e.role}:${(e.travel?.items ?? []).map((i) => i.name).join(", ") || e.subtitle}`
            : e.kind === "leg"
              ? "transfer"
              : e.kind === "day"
                ? `${e.title}${e.items.length ? `[${e.items.map((i) => i.name).join(" + ")}]` : ""}`
                : e.kind,
        );
        return `{${s.journey.dayNo ? `${s.journey.dayNo}. gün ` : ""}${s.journey.from ?? "?"} → ${s.journey.to ?? "?"}} ${parts.join(" / ")}`;
      }
      const days = s.entries.filter((e) => e.kind === "day");
      const filled = s.entries.flatMap((e) => {
        if (e.kind === "day") {
          const what = [...e.legs.map(() => "transfer"), ...e.items.map((i) => i.name)];
          return what.length ? [`${e.title}: ${what.join(" + ")}`] : [];
        }
        if (e.kind === "plan") return [`plan: ${e.items.map((i) => i.name).join(" + ")}`];
        if (e.kind === "rental") return [`rental ${e.date.slice(8)}–${e.end?.slice(8)}: ${e.group.items.map((i) => i.name).join(" + ")}`];
        return [e.kind === "leg" ? `transfer ${e.date.slice(8)}` : e.kind === "travel" ? `${e.role}:${e.travel?.items[0].name}` : e.kind];
      });
      return `[${s.index} ${s.city} · ${s.nights} gece · ${s.stays.length} konaklama · ${days.length} gün] ${filled.join(" / ")}`;
    });

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
      "{1. gün IST → Porto} arrival:Pegasus IST-OPO / transfer / 1. gün",
      "[1 Porto · 3 gece · 1 konaklama · 2 gün] ",
      "{4. gün Porto → Funchal} move:Porto → Funchal / 4. gün", // how is still open: no station transfers yet
      "[2 Funchal · 7 gece · 1 konaklama · 6 gün] ",
      "{11. gün Funchal → IST} 11. gün / transfer / departure:TAP FNC-IST",
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
      "{1. gün İstanbul → Porto} arrival:Uçuş · İstanbul → Porto / transfer / 1. gün",
      "[1 Porto · 4 gece · 1 konaklama · 3 gün] ",
      "{5. gün Porto → Funchal} transfer / move:Uçuş · Porto → Funchal / transfer / 5. gün",
      // The car is its own booking above the day it starts (12th), like the hotel.
      "[2 Funchal · 6 gece · 1 konaklama · 5 gün] rental 12–16: Araç kiralama · Funchal",
      "{11. gün Funchal → ?} 11. gün / transfer / departure:Funchal →",
    ]);
    const move = timeline.entries.find((e) => e.kind === "travel" && e.role === "move")!;
    expect(move.kind === "travel" && move.travel?.settled?.status).toBe("chosen"); // planned, not booked
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
    expect(outline(timeline)).toEqual([
      "{1. gün ? → Porto} arrival:→ Porto / transfer / 1. gün",
      "[1 Porto · 10 gece · 1 konaklama · 9 gün] other:Day trip",
      "{11. gün Porto → ?} 11. gün / transfer / departure:Porto →",
    ]);
  });

  it("lays out a trip with a connection on the way in and nights still to plan in the next city", () => {
    const t: Trip = { ...trip, confirmedDates: { start: "2026-10-07", end: "2026-10-18" } };
    const leg1 = base({
      name: "Pegasus SAW-CPH", category: "flight", needKey: "flight:saw-cph", city: "Kopenhag", status: "booked",
      dates: { start: "2026-10-07", end: null, source: "page" },
      flight: { from: "SAW", to: "CPH", departure: "2026-10-07T09:40", arrival: "2026-10-07T12:10", carrier: null, flightNumber: null, stops: 0 },
    });
    const leg2 = base({
      name: "SAS CPH-OPO", category: "flight", needKey: "flight:cph-opo", city: "Porto", status: "booked",
      dates: { start: "2026-10-07", end: null, source: "page" },
      flight: { from: "CPH", to: "OPO", departure: "2026-10-07T18:50", arrival: "2026-10-07T22:15", carrier: null, flightNumber: null, stops: 0 },
    });
    const car = base({ name: "FAA Rentals", category: "transport", needKey: "transport:madeira", city: "Madeira", status: "chosen", dates: { start: "2026-10-11", end: "2026-10-18", source: "page" } });
    const items = [leg1, leg2, stay("Büyük TERAS DAİRE", "2026-10-07", "2026-10-11", "Porto"), car, said({ kind: "flight", date: "2026-10-11", from: "Porto", to: "Madeira" })];
    const { timeline } = build(items, t);
    expect(outline(timeline)).toEqual([
      // The connection comes first, in the day's card: SAW → CPH, CPH → OPO, the transfer, check-in.
      "{1. gün SAW → Porto} other:Pegasus SAW-CPH / arrival:SAS CPH-OPO / transfer / 1. gün",
      "[1 Porto · 4 gece · 1 konaklama · 3 gün] ",
      "{5. gün Porto → Madeira} transfer / move:Uçuş · Porto → Madeira / transfer / 5. gün",
      // Picked up on the day they land: its card opens Madeira's block, its pick-up is a line of that day.
      "[2 Madeira · 7 gece · 1 konaklama · 6 gün] rental 11–18: FAA Rentals",
      "{12. gün Madeira → ?} 12. gün / transfer / departure:Madeira →",
    ]);
    const madeira = timeline.sections.filter((x) => x.kind === "city")[1];
    expect(madeira.kind === "city" && madeira.stays[0].block.kind).toBe("open"); // "Planlanmadı"
    // Without the flight said in the chat, the car rented there still says where those nights are.
    const quiet = build(items.slice(0, 4), t);
    expect(quiet.timeline.sections.filter((x) => x.kind === "city").map((x) => x.kind === "city" && x.city)).toEqual(["Porto", "Madeira"]);
  });

  it("puts a car said in the chat without a day in its city's block at once, then on its day", () => {
    const stays = [stay("Jardim Stay", "2026-10-07", "2026-10-11", "Porto"), stay("FAA Rentals", "2026-10-11", "2026-10-17", "Funchal")];
    const undated = plannedItem({ kind: "car_rental", date: null, end_date: null, time: null, from: null, to: null, city: "Madeira", title: null, booked: false, note: null }, "t", "car", 1);
    const { timeline } = build([...stays, undated]);
    const madeira = timeline.sections.filter((x) => x.kind === "city")[1];
    expect(madeira.kind === "city" && madeira.entries[0]).toMatchObject({ kind: "plan", items: [{ name: "Araç kiralama · Madeira" }] });
    // Days known later: it moves to its day.
    const dated = { ...undated, dates: { start: "2026-10-12", end: "2026-10-16", source: "unverified" as const } };
    const later = build([...stays, dated]).timeline;
    expect(later.entries.some((e) => e.kind === "plan")).toBe(false);
    expect(later.entries.find((e) => e.kind === "rental" && e.group.items.some((i) => i.id === "car"))?.date).toBe("2026-10-12");
  });
});
