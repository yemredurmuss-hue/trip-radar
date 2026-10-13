// Gün gün's three views: the saved choice, the day's photo, a journey day as one card, the day's reservations.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { dayCards, dayLinesOf, type DayCard } from "../src/lib/dayCards";
import { dayPhotoUrl, journeyDay, journeyRows, parseDayMode, reservationRows, reservationsReady } from "../src/lib/dayView";
import { loadDemoTrip } from "../src/lib/demo";
import type { DayRow } from "../src/lib/journey";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";

async function demoDays() {
  const id = await loadDemoTrip({ today: "2026-10-05" });
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const { ctx } = await loadDecisions(trip, items);
  const plan = buildPlan(trip, items);
  const timeline = buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items);
  return dayCards(timeline.sections, { listings: ctx.listings, merge: false });
}

describe("Gün gün views", () => {
  it("the saved choice: anything unknown is the compact row", () => {
    expect(parseDayMode("list")).toBe("list");
    expect(parseDayMode("cards")).toBe("cards");
    expect(parseDayMode("compact")).toBe("compact");
    expect(parseDayMode("grid")).toBe("compact");
    expect(parseDayMode(null)).toBe("compact");
  });
  it("a day's photo is its page's picture, else the city's, else none", () => {
    const card = { city: "Porto", rows: [] } as unknown as DayCard;
    expect(dayPhotoUrl(card, (c) => `https://x/${c}.jpg`)).toBe("https://x/Porto.jpg");
    expect(dayPhotoUrl(card, () => null)).toBeNull();
    expect(dayPhotoUrl(card)).toBeNull();
  });
  it("only the day that changes city is a journey: check-out and transfer, the trip, transfer and check-in", async () => {
    const days = await demoDays();
    const flowOf = (c: DayCard) => dayLinesOf(c, {});
    expect(days.filter((c) => journeyDay(c, flowOf(c))).map((c) => c.date)).toEqual(["2026-10-11"]);
    const move = days.find((c) => c.role === "move")!;
    const j = journeyDay(move, flowOf(move))!;
    expect(j.body.map((r) => r.kind)).toEqual(["travel"]);
    expect(j.before.map((r) => r.kind)).toEqual(["info", "leg"]);
    expect(j.after.map((r) => r.kind)).toEqual(["leg", "info"]);
    expect(journeyRows(j)).toHaveLength(5);
  });
  it("a day's reservations are its tickets and cards to settle; check-ins, ideas and a plain way are not", () => {
    const r = (key: string, over: Partial<DayRow>) => ({ key, kind: "item", state: "done", entry: null, leg: null, rental: null, item: null, ...over }) as DayRow;
    const rows = [
      r("in", { kind: "info", state: "info", stayKey: "s" }),
      r("fl", { kind: "travel", entry: {} as DayRow["entry"] }),
      r("metro", { kind: "leg", state: "info", leg: {} as DayRow["leg"] }),
      r("taxi", { kind: "leg", state: "open", leg: {} as DayRow["leg"] }),
      r("idea", { kind: "idea", state: "info", item: {} as DayRow["item"] }),
      r("lay", { kind: "info", state: "info", layover: { airport: "LIS", minutes: 60 } }),
    ];
    expect(reservationRows(rows).map((x) => x.key)).toEqual(["fl", "taxi"]);
    expect(reservationsReady([r("a", {}), r("b", { state: "pending" })])).toEqual({ ready: 1, total: 2, all: false });
    expect(reservationsReady([r("a", {})]).all).toBe(true);
    expect(reservationsReady([]).all).toBe(false);
  });
});
