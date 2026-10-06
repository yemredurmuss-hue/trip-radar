// The hero's list and its "Planlama %N" come from the same needs: "Karar bekliyor" is exactly the needs waiting
// for a decision, "Rezerve edilecek" exactly the planned ones, one row each. The transfers not said yet are their
// own question, outside the stages (review of 2026-10-06: one screen showed three different "karar" counts).
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { categorize, findInSections, planStages, stagedEntries, type CatSection } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { listTodos, planList, type PlanList } from "../src/lib/planList";
import { decisionProgress } from "../src/lib/progress";
import { isPlaceholder } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-01";
const base: Trip = { id: "t1", title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
let n = 0;
const said = (input: Partial<PlannedInput> & Pick<PlannedInput, "kind">, over: Partial<Item> = {}): Item => ({
  ...plannedItem({ date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...input }, "t1", `l${++n}`, n),
  ...over,
});
const stay = (name: string, status: Item["status"]) =>
  makeItem({ name, category: "stay", city: "Porto", needKey: "stay:porto", dates: { start: "2026-10-08", end: "2026-10-14", source: "url" }, status });
const flight = (name: string, from: string, to: string, day: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    name,
    category: "flight",
    needKey: `flight:${from}-${to}`.toLowerCase(),
    city: to === "IST" ? "İstanbul" : "Porto",
    dates: { start: day, end: null, source: "page" },
    status,
    flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 },
    ...over,
  });

function listOf(items: Item[], trip: Trip = base): { list: PlanList; sections: CatSection[] } {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const sections = categorize({ plan, timeline, items, legs, hidden, today: TODAY });
  const ph = (i: Item) => isPlaceholder(trip, i);
  const progress = decisionProgress(timeline, items, plan, undefined, TODAY, ph);
  const list = planList(sections, progress.todos, TODAY, ph);
  // One source of truth: the same counts as planStages, and each row is its own need in that stage.
  expect(list.stages).toEqual(planStages(sections, ph));
  expect(list.open).toHaveLength(list.stages.open);
  expect(list.book).toHaveLength(list.stages.planned);
  const staged = stagedEntries(sections, ph);
  const keysOf = (rows: PlanList["open"]) => rows.map((t) => findInSections(sections, t.target)?.key);
  expect(new Set(keysOf(list.open))).toEqual(new Set(staged.open.map((e) => e.key)));
  expect(new Set(keysOf(list.book))).toEqual(new Set(staged.planned.map((e) => e.key)));
  // The transfers' questions aren't on the Plan, so never one of its needs.
  expect(list.ways.every((t) => t.target.leg && !findInSections(sections, t.target))).toBe(true);
  return { list, sections };
}

describe("planList: the hero's list is its counts", () => {
  it("the sample trip: the box's karar count is the list's, the transfers are a group of their own", async () => {
    const id = await loadDemoTrip();
    const trip = (await (await db()).get("trips", id))!;
    const { list } = listOf(await listItems(id), trip);
    expect(list.stages.open).toBeGreaterThan(0);
    expect(list.ways.length).toBeGreaterThan(0);
    expect(list.ways.every((t) => t.kind === "plan")).toBe(true);
  });

  it("everything booked, the transfers not said: nothing waits for a decision, the transfers are asked apart", () => {
    const { list } = listOf([stay("Jardim", "booked"), flight("Out", "IST", "OPO", "2026-10-08", "booked"), flight("Ret", "OPO", "IST", "2026-10-14", "booked"), said({ kind: "prep", title: "Adaptör al" })]);
    expect(list.stages).toEqual({ booked: 3, planned: 0, open: 0, total: 3 });
    expect(list.open).toEqual([]);
    expect(list.ways.map((t) => t.target.leg).length).toBe(2);
  });

  it("an empty dated trip: the empty cards are the needs, the list says the same", () => {
    const { list } = listOf([]);
    expect(list.open.length).toBe(list.stages.open);
    expect(list.book).toEqual([]);
  });

  it("two people's tickets on one flight card: one need, one row", () => {
    const trip: Trip = { ...base, travellers: { names: ["Sabine"], count: 2 } as Trip["travellers"] };
    const { list } = listOf(
      [stay("Jardim", "booked"), flight("Emre TK", "IST", "OPO", "2026-10-08", "chosen", { forWho: ["Emre"] }), flight("Sabine LH", "IST", "OPO", "2026-10-08", "chosen", { forWho: ["Sabine"] })],
      trip,
    );
    expect(list.stages.planned).toBe(1);
    expect(list.book).toHaveLength(1);
  });

  it("a need with no to-do of its own (a ticket or an eSIM with options) gets its card's row", () => {
    const { list } = listOf([
      stay("Jardim", "booked"),
      makeItem({ name: "Lello bileti", category: "activity", needKey: "activity:lello", status: "saved", city: "Porto", booking: "needed", dates: { start: "2026-10-11", end: null, source: "page" } }),
      makeItem({ name: "Airalo", category: "esim", needKey: "esim:pt", status: "saved" }),
    ]);
    const names = list.open.map((t) => t.title);
    expect(names).toEqual(expect.arrayContaining(["Lello bileti", "Airalo"]));
    expect(list.open.find((t) => t.title === "Lello bileti")).toMatchObject({ kind: "decide", target: { item: expect.any(String) } });
  });

  it("the next step is the soonest row; nothing listed, nothing left", () => {
    const { list } = listOf([stay("Jardim", "chosen"), flight("Out", "IST", "OPO", "2026-10-08", "saved")]);
    const all = listTodos(list);
    expect(all.length).toBe(list.open.length + list.book.length + list.ways.length + list.deadlines.length);
    expect(all.map((t) => t.date ?? "9999")).toEqual([...all.map((t) => t.date ?? "9999")].sort());
  });
});
