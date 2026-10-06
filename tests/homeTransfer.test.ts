// The way from home to the first flight's airport (and from the last flight's airport home) is on the day when the
// traveller added it: "sabah evden çıkış 06:15, Sabiha Gökçen'e" from the chat is its own row before the flight,
// at the time they said; never taken for the transfer at the other end, and nothing at all when they added none.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { applyDayTimes } from "../src/lib/dayTimes";
import { dayCards } from "../src/lib/dayCards";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

async function day(extra: (tripId: string) => Item[], date: string) {
  const id = await loadDemoTrip();
  const trip = (await (await db()).get("trips", id))!;
  // The flight in booked (Pegasus 07:10, İstanbul → Porto): the way to its airport is before it.
  const saved = (await listItems(id)).map((i) => (i.flight?.flightNumber === "PC 1201" ? { ...i, status: "booked" as const } : i));
  const items = [...saved, ...extra(id)];
  const { ctx } = await loadDecisions(trip, items);
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip, ctx.listings);
  const timeline = buildTimeline(plan, legs, items);
  const cards = dayCards(timeline.sections, { listings: ctx.listings });
  return { legs, card: cards.find((c) => c.date === date || (c.end && c.date <= date && date <= c.end))! };
}

const homeTransfer = (tripId: string, over: Partial<Item> = {}) =>
  makeItem({
    tripId, category: "transport", plannedKind: "transfer", origin: "chat", status: "chosen", needKey: "transport:home",
    name: "Evden havalimanına", city: "Sabiha Gökçen", dates: { start: "2026-10-08", end: null, source: "unverified" },
    flight: { from: "Ev", to: "Sabiha Gökçen", departure: "2026-10-08T04:30", arrival: null, carrier: null, flightNumber: null, stops: null },
    ...over,
  });

describe("the way from home to the airport", () => {
  it("is a row of its own before the flight, at the time the traveller said", async () => {
    const { card } = await day((id) => [homeTransfer(id)], "2026-10-08");
    const rows = card.rows.map((r) => `${r.time ?? "—"} ${r.kind}`);
    const at = card.rows.findIndex((r) => r.time === "04:30");
    expect(at, rows.join("\n")).toBeGreaterThanOrEqual(0);
    expect(card.rows[at]).toMatchObject({ kind: "leg", hint: null });
    expect(card.rows[at].leg?.key).toBe("2026-10-08:departure:home");
    expect(`${card.rows[at].leg?.from.label} → ${card.rows[at].leg?.to.label}`).toBe("Ev → Sabiha Gökçen");
    const flight = card.rows.findIndex((r) => r.kind === "travel");
    expect(at).toBeLessThan(flight);
  });

  it("isn't taken for the transfer from Porto's airport", async () => {
    const { legs } = await day((id) => [homeTransfer(id)], "2026-10-08");
    const porto = legs.find((l) => l.kind === "arrival" && l.date === "2026-10-08")!;
    expect(porto.options.map((o) => o.name)).not.toContain("Evden havalimanına");
  });

  it("is nothing when the traveller added none, nor for a transfer said after the flight leaves or without a time", async () => {
    expect((await day(() => [], "2026-10-08")).legs.filter((l) => l.key.includes("home"))).toEqual([]);
    const late = (id: string) => [homeTransfer(id, { flight: { from: "Ev", to: "Sabiha Gökçen", departure: "2026-10-08T08:00", arrival: null, carrier: null, flightNumber: null, stops: null } })];
    expect((await day(late, "2026-10-08")).legs.filter((l) => l.key.includes("home"))).toEqual([]);
    const untimed = (id: string) => [homeTransfer(id, { flight: null })];
    expect((await day(untimed, "2026-10-08")).legs.filter((l) => l.key.includes("home"))).toEqual([]);
  });
});

describe("a transfer's own time on the day", () => {
  it("is kept, not worked out from the flight; too late to make it, it says so", async () => {
    const { card } = await day((id) => [homeTransfer(id)], "2026-10-08");
    const leaving = card.rows.find((r) => r.leg?.key === "2026-10-08:departure:home")!;
    // The booked Pegasus leaves 07:10 abroad: at the airport by 04:10, so 04:30 from home is said to be late.
    expect(leaving.leg?.before).toBe("04:10");
    expect(leaving.time).toBe("04:30");
    expect(leaving.warn).toContain("04:10");
    const withBy = (by: string, at: string) => applyDayTimes([{ ...leaving, warn: undefined, time: at, leg: { ...leaving.leg!, before: by, at } }]);
    // Be at the airport by 07:10: leaving at 04:30 is kept as said, no "~", no warning.
    expect(withBy("07:10", "04:30")[0]).toMatchObject({ time: "04:30", estimated: false });
    expect(withBy("07:10", "04:30")[0].warn).toBeUndefined();
    // Leaving at 06:45 for 07:10 at the airport: kept, with the warning.
    expect(withBy("07:10", "06:45")[0].time).toBe("06:45");
    expect(withBy("07:10", "06:45")[0].warn).toContain("07:10");
  });
});
