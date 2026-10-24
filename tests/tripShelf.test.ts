// Açılır kart v1.1 (lib/tripShelf.ts, 0.47.2): the popup's trips where nothing can be added, the selected one big.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { tripGlance } from "../src/lib/tripGlance";
import { countdown, SHELF_MAX, shelfOrder } from "../src/lib/tripShelf";
import type { Trip } from "../src/lib/types";

const trip = (id: string, title: string, start: string | null = null, end: string | null = null, updatedAt = 1): Trip =>
  ({ id, title, confirmedDates: start && end ? { start, end } : null, budget: null, heroImage: null, createdAt: 1, updatedAt }) as Trip;
const TODAY = "2026-10-24";
const NOW = Date.parse("2026-10-24T12:00:00Z");

describe("countdown: how long until the trip, said as the card says it", () => {
  const at = (start: string, end = "2027-12-31") => countdown({ start, end }, TODAY);
  it("days, then weeks, then months; two weeks or less is soon", () => {
    expect(at("2026-10-26")).toEqual({ text: "2 gün kaldı", tone: "soon" });
    expect(at("2026-11-07")?.tone).toBe("soon");
    expect(at("2026-11-08")).toEqual({ text: "15 gün kaldı", tone: "far" });
    expect(at("2026-11-23")?.text).toBe("30 gün kaldı");
    expect(at("2026-12-12")?.text).toBe("7 hafta kaldı");
    expect(at("2027-07-27")?.text).toBe("9 ay kaldı");
  });
  it("tomorrow, today, and the day of the trip while on it", () => {
    expect(at("2026-10-25")?.text).toBe("Yarın yola çıkıyorsun");
    expect(at("2026-10-24")).toEqual({ text: "Bugün yola çıkıyorsun", tone: "on" });
    expect(countdown({ start: "2026-10-21", end: "2026-11-04" }, TODAY)).toEqual({ text: "Gezidesin · 4. gün / 15", tone: "on" });
  });
  it("nothing without dates, nothing once over", () => {
    expect(countdown(null, TODAY)).toBeNull();
    expect(countdown({ start: "2026-10-01", end: "2026-10-23" }, TODAY)).toBeNull();
  });
});

describe("shelfOrder: the selected trip first, then by date; never a sample or one over", () => {
  const trips = [
    trip("ozora", "Ozora Festival 2027", "2027-07-27", "2027-08-02"),
    trip("porto", "Porto hafta sonu", "2026-12-12", "2026-12-15"),
    trip("bali", "15-Day Bali Honeymoon", "2026-10-26", "2026-11-09"),
    trip("idea", "Japonya bir gün"),
    trip("old", "Lizbon", "2026-05-01", "2026-05-05"),
    trip("s", "Roma (örnek)"),
  ];
  const ids = (o: ReturnType<typeof shelfOrder>) => o.trips.map((x) => x.trip.id);
  it("nothing selected: the nearest first, the undated last, at most three", () => {
    const o = shelfOrder(trips, [], null, TODAY, NOW);
    expect(ids(o)).toEqual(["bali", "porto", "ozora"]);
    expect(o.selected).toBe(false);
    expect(o.total).toBe(4);
    expect(o.trips.length).toBe(SHELF_MAX);
  });
  it("a selected trip (picked within a day) goes on top; the rest keep their dates", () => {
    const o = shelfOrder(trips, [], { tripId: "porto", country: null, at: NOW - 3600_000 }, TODAY, NOW);
    expect(ids(o)).toEqual(["porto", "bali", "ozora"]);
    expect(o.selected).toBe(true);
  });
  it("a selection older than a day, or of a trip over, isn't one", () => {
    expect(shelfOrder(trips, [], { tripId: "porto", country: null, at: NOW - 2 * 86400_000 }, TODAY, NOW).selected).toBe(false);
    expect(ids(shelfOrder(trips, [], { tripId: "old", country: null, at: NOW }, TODAY, NOW))[0]).toBe("bali");
  });
  it("only the undated: it shows; no trips: nothing", () => {
    expect(ids(shelfOrder([trips[3]], [], null, TODAY, NOW))).toEqual(["idea"]);
    expect(shelfOrder([trips[4], trips[5]], [], null, TODAY, NOW)).toEqual({ trips: [], selected: false, total: 0 });
  });
});

describe("tripGlance's ready: the hero's shares from the records alone", () => {
  it("the sample trip has a plan share and a booked share no bigger than it", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" });
    const t = (await (await db()).get("trips", id))!;
    const g = tripGlance(t, await listItems(id), "2026-10-05");
    expect(g.ready).not.toBeNull();
    expect(g.ready!.plan).toBeGreaterThanOrEqual(g.ready!.booked);
    expect(g.ready!.plan).toBeLessThanOrEqual(100);
  });
});
