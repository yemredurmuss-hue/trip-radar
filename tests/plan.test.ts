import { describe, expect, it } from "vitest";
import { decideTrip, makeContext } from "../src/lib/decision";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildPlan, groupKeyOf, liveGroups, tripRange, type StayBlock } from "../src/lib/plan";
import type { Item, ItemStatus, Trip } from "../src/lib/types";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t", title: "Porto ve Madeira", confirmedDates: { start: "2026-10-07", end: "2026-10-17" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1, ...over,
});

let seq = 0;
function item(name: string, over: Partial<Item> = {}): Item {
  return {
    id: `p${++seq}`, tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name, provider: null,
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
const flight = (name: string, from: string, to: string, day: string, status: ItemStatus = "saved", city: string | null = null) =>
  item(name, {
    category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), city,
    dates: { start: day, end: null, source: "page" },
    flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 },
    status,
  });

const names = (block: StayBlock) => (block.kind === "booked" ? [] : block.groups.map((g) => g.items.map((i) => i.name)));

describe("plan: nights, bookings and gaps", () => {
  // The traveller's own example: flying in on the 7th, 10–14 booked in Funchal.
  function example() {
    const faa = stay("FAA Rentals", "2026-10-10", "2026-10-14", "booked", "Funchal");
    const items = [
      flight("Pegasus", "IST", "OPO", "2026-10-07", "booked", "Porto"),
      faa,
      stay("Jardim Stay", "2026-10-07", "2026-10-10"),
      stay("Casa Azul", "2026-10-07", "2026-10-10"),
      stay("Late Inn", "2026-10-08", "2026-10-10"),
      stay("Clash Suites", "2026-10-09", "2026-10-12", "saved", "Funchal"),
      stay("Other Funchal", "2026-10-10", "2026-10-14", "saved", "Funchal"),
    ];
    return { faa, items };
  }

  it("shows booked nights, open nights with the options that fit, and closes what a booking made irrelevant", () => {
    const { items } = example();
    const plan = buildPlan(trip(), items);
    expect(plan.nights).toEqual({ total: 10, booked: 4, chosen: 0, open: 6 });
    expect(plan.stayBlocks.map((b) => [b.kind, b.range.start, b.range.end])).toEqual([
      ["open", "2026-10-07", "2026-10-10"],
      ["booked", "2026-10-10", "2026-10-14"],
      ["open", "2026-10-14", "2026-10-17"],
    ]);
    const [first, , last] = plan.stayBlocks;
    expect(names(first)).toEqual([["Jardim Stay", "Casa Azul"], ["Late Inn"]]);
    expect(first.city).toBe("Porto");
    // Nothing saved for the last three nights: say so, and link a search with the right dates.
    expect(names(last)).toEqual([]);
    expect(last.kind === "open" && last.searchUrl).toContain("checkin=2026-10-14&checkout=2026-10-17");
    expect(plan.closed.map((c) => c.item.name)).toEqual(["Clash Suites", "Other Funchal"]);
    expect(plan.closed[0].reason).toContain("FAA Rentals");
  });

  it("brings the closed options back when the booking is undone (nothing was deleted)", () => {
    const { faa, items } = example();
    const plan = buildPlan(trip(), items.map((i) => (i === faa ? { ...i, status: "saved" as const } : i)));
    expect(plan.closed).toEqual([]);
    expect(plan.stayBlocks.map((b) => b.kind)).toEqual(["open"]);
    expect(liveGroups(plan).map((g) => g.key)).toContain(groupKeyOf(faa));
  });

  it("keeps a choice with its alternatives and flags a missing transfer between cities", () => {
    const jardim = stay("Jardim Stay", "2026-10-07", "2026-10-10", "chosen");
    const items = [
      jardim,
      stay("Casa Azul", "2026-10-07", "2026-10-10"),
      stay("Late Inn", "2026-10-08", "2026-10-10"),
      stay("FAA Rentals", "2026-10-10", "2026-10-14", "booked", "Funchal"),
    ];
    const plan = buildPlan(trip(), items);
    const chosen = plan.stayBlocks[0];
    expect(chosen.kind).toBe("chosen");
    expect(names(chosen)).toEqual([["Jardim Stay", "Casa Azul"], ["Late Inn"]]);
    expect(plan.notices).toEqual([{ kind: "transfer", date: "2026-10-10", text: "10 Ekim: Porto → Funchal ulaşımı yok" }]);
    // A flight that day covers it.
    const covered = buildPlan(trip(), [...items, flight("TAP", "OPO", "FNC", "2026-10-10")]);
    expect(covered.notices).toEqual([]);
  });

  it("warns about overlapping bookings", () => {
    const plan = buildPlan(trip(), [
      stay("A", "2026-10-07", "2026-10-10", "booked"),
      stay("B", "2026-10-09", "2026-10-11", "booked"),
    ]);
    expect(plan.notices.map((n) => n.text)).toEqual(["9–10 Ekim (1 gece) için iki rezervasyon var: A ve B"]);
  });

  it("derives the nights from booked flights, not alternatives, when no dates were confirmed", () => {
    const items = [
      flight("Out", "IST", "OPO", "2026-10-07", "booked"),
      flight("Back", "FNC", "IST", "2026-10-17", "booked"),
      flight("Earlier out", "IST", "OPO", "2026-10-06"),
    ];
    expect(tripRange(trip({ confirmedDates: null }), items)).toEqual({ start: "2026-10-07", end: "2026-10-17" });
    const undecided = items.map((i) => ({ ...i, status: "saved" as const }));
    expect(tripRange(trip({ confirmedDates: null }), undecided)).toEqual({ start: "2026-10-06", end: "2026-10-17" });
    // Even with nothing saved for them yet, the nights show as open.
    const plan = buildPlan(trip({ confirmedDates: null }), items);
    expect(plan.stayBlocks).toHaveLength(1);
    expect(plan.stayBlocks[0].kind).toBe("open");
  });

  it("puts undated stays and stays outside the trip aside, and never trusts broken dates", () => {
    const plan = buildPlan(trip(), [
      stay("No dates", null as never, null as never),
      stay("Next month", "2026-11-03", "2026-11-05"),
      stay("Reversed", "2026-10-12", "2026-10-09"),
      stay("Booked after", "2026-10-17", "2026-10-19", "booked"),
    ]);
    expect(plan.looseStays.map((g) => g.items.map((i) => i.name))).toEqual([["Next month"], ["No dates", "Reversed"]]);
    // A booking outside the given dates widens the trip rather than disappearing.
    expect(plan.range).toEqual({ start: "2026-10-07", end: "2026-10-19" });
    expect(plan.stayBlocks.at(-1)!.kind).toBe("booked");
    expect(tripRange(trip({ confirmedDates: { start: "2026-01-01", end: "2027-06-01" } }), [])).toBeNull();
  });

  it("closes a booked flight leg's alternatives but not other legs", () => {
    const plan = buildPlan(trip(), [
      flight("SAS A", "IST", "CPH", "2026-10-07", "booked"),
      flight("SAS B", "IST", "CPH", "2026-10-07"),
      flight("TAP 1", "CPH", "OPO", "2026-10-07"),
      flight("TAP 2", "CPH", "OPO", "2026-10-07"),
    ]);
    expect(plan.closed.map((c) => [c.item.name, c.reason])).toEqual([["SAS B", "SAS A rezerve edildi"]]);
    expect(plan.groups.map((g) => [g.title, g.items.map((i) => i.name), g.booked?.name ?? null])).toEqual([
      ["7 Ekim · CPH → OPO", ["TAP 1", "TAP 2"], null],
      ["7 Ekim · IST → CPH", ["SAS A"], "SAS A"],
    ]);
    expect(liveGroups(plan).map((g) => g.key)).toEqual(["flight:cph-opo"]);
  });
});

describe("decisions follow the plan", () => {
  it("ranks only open needs, grouping stays by exact nights, and never booked or closed options", () => {
    const items = [
      stay("Jardim Stay", "2026-10-07", "2026-10-10"),
      stay("Casa Azul", "2026-10-07", "2026-10-10"),
      stay("Late Inn", "2026-10-08", "2026-10-10"),
      stay("FAA Rentals", "2026-10-10", "2026-10-14", "booked", "Funchal"),
      stay("Other Funchal", "2026-10-10", "2026-10-14", "saved", "Funchal"),
    ];
    const decisions = decideTrip(items, makeContext(trip(), items));
    expect([...decisions.keys()].sort()).toEqual(["stay@2026-10-07_2026-10-10", "stay@2026-10-08_2026-10-10"]);
    expect(decisions.get("stay@2026-10-07_2026-10-10")!.options.map((o) => o.item.name).sort()).toEqual(["Casa Azul", "Jardim Stay"]);
    expect(decisions.get("stay@2026-10-08_2026-10-10")!.status).toBe("single");
  });
});
