// One source (lifecycle.ts, categories.needsOf): the hero's numbers, the list's groups and the Plan sections'
// stages are the same needs. "Karar bekliyor" = Aranacak + Seçenekler, "Rezerve edilecek" = Planlandı, "Belge
// eksik" = Rezerve edildi; a group's rows are the parts holding its needs there (one per person when each
// person's options are a group of their own). The transfers not said yet are a question apart (review of
// 2026-10-06: one screen showed three different "karar" counts).
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { categorize, findInSections, needsOf, planStages, type CatSection } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { buildLegs } from "../src/lib/legs";
import { countStages, heroNumbers, noCounts, type StageCounts } from "../src/lib/lifecycle";
import { buildPlan } from "../src/lib/plan";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { listTodos, planList, type PlanList } from "../src/lib/planList";
import { decisionProgress } from "../src/lib/progress";
import { isPlaceholder, placeholderPrint } from "../src/lib/startTrip";
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
const sum = (list: StageCounts[]): StageCounts => list.reduce((a, c) => countStages(Object.entries(c).flatMap(([k, v]) => Array(v).fill(k)).concat(Object.entries(a).flatMap(([k, v]) => Array(v).fill(k)))), noCounts());

/** The board as TripPanel builds it: placeholders and empty cards are Aranacak, `files` the records with a file. */
function listOf(items: Item[], trip: Trip = base, files: string[] = []): { list: PlanList; sections: CatSection[] } {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const docs = (i: Item) => (files.includes(i.id) ? 1 : 0);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, docs(i), items), docs: docs(i) });
  const sections = categorize({ plan, timeline, items, legs, hidden, today: TODAY, stageCtx });
  const progress = decisionProgress(timeline, items, plan, undefined, TODAY, (i) => isPlaceholder(trip, i));
  const list = planList(sections, progress.todos, TODAY);
  // One source of truth: the hero's counts = the list's group headings = the Plan sections' stages added up.
  const hero = planStages(sections);
  expect(list.counts).toEqual(hero);
  expect(sum(sections.map((s) => s.stages))).toEqual(hero);
  expect(list.needs).toEqual({ open: hero.search + hero.options, book: hero.planned, docs: hero.booked });
  // Each row is a part of a need at that need's stage; every need there has at least one row.
  const needs = needsOf(sections);
  const needOfRow = (t: PlanList["open"][number]) => needs.find((nd) => nd.entries.some((e) => e.key === findInSections(sections, t.target)?.key));
  for (const [rows, stages] of [[list.open, ["search", "options"]], [list.book, ["planned"]], [list.docs, ["booked"]]] as const) {
    const of = rows.map(needOfRow);
    expect(of.every((nd) => nd && (stages as readonly string[]).includes(nd.stage))).toBe(true);
    expect(new Set(of.map((nd) => nd!.key)).size).toBe(needs.filter((nd) => (stages as readonly string[]).includes(nd.stage)).length);
  }
  // The transfers' questions aren't on the Plan, so never one of its needs.
  expect(list.ways.every((t) => t.target.leg && !findInSections(sections, t.target))).toBe(true);
  return { list, sections };
}

describe("one source: hero = list = Plan sections", () => {
  it("the sample trip", async () => {
    const id = await loadDemoTrip();
    const trip = (await (await db()).get("trips", id))!;
    const { list } = listOf(await listItems(id), trip);
    expect(list.counts.search + list.counts.options).toBeGreaterThan(0);
    expect(list.ways.length).toBeGreaterThan(0);
  });

  it("everything booked, the transfers not said: nothing waits, the transfers are asked apart; no file yet: Belge eksik", () => {
    const { list } = listOf([stay("Jardim", "booked"), flight("Out", "IST", "OPO", "2026-10-08", "booked"), flight("Ret", "OPO", "IST", "2026-10-14", "booked"), said({ kind: "prep", title: "Adaptör al" })]);
    expect(heroNumbers(list.counts)).toMatchObject({ done: 3, inPlan: 3, open: 0, pct: 100 });
    expect(list.open).toEqual([]);
    expect(list.docs).toHaveLength(3);
    expect(list.ways).toHaveLength(2);
  });

  it("a booking with its file is Hazır: no longer under Belge eksik", () => {
    const out = flight("Out", "IST", "OPO", "2026-10-08", "booked");
    const { list } = listOf([stay("Jardim", "booked"), out], base, [out.id]);
    expect(list.counts.ready).toBe(1);
    expect(list.docs.map((t) => t.title)).not.toContain("Out");
  });

  it("an empty dated trip: the empty cards are Aranacak, no percentage", () => {
    const { list } = listOf([]);
    expect(list.counts.search).toBe(3);
    expect(heroNumbers(list.counts).pct).toBeNull();
  });

  it("a flight the start chat only made room for, and a flight said with nothing concrete: Aranacak", () => {
    const home = flight("Dönüş", "OPO", "IST", "2026-10-14", "chosen", { origin: "chat" });
    const trip: Trip = { ...base, startGuide: { placeholders: { [home.id]: placeholderPrint(home) } } as Trip["startGuide"] };
    const out = said({ kind: "flight", date: "2026-10-08" });
    const { list } = listOf([stay("Jardim", "booked"), out, home], trip);
    expect(list.counts).toMatchObject({ search: 2, booked: 1 });
  });

  it("two people's tickets, each person's options a group of their own: one need, a row each", () => {
    const trip: Trip = { ...base, travellers: { names: ["Sabine"], count: 2 } as Trip["travellers"] };
    const both = listOf(
      [stay("Jardim", "booked"), flight("Emre TK", "IST", "OPO", "2026-10-08", "chosen", { forWho: ["Emre"] }), flight("Sabine LH", "IST", "OPO", "2026-10-08", "chosen", { forWho: ["Sabine"] })],
      trip,
    ).list;
    expect(both.needs.book).toBe(1);
    expect(both.book.map((t) => t.title).sort()).toEqual(["Emre TK", "Sabine LH"]);
    // Emre's booked, Sabine's only planned: the need is Planlandı, and Sabine's is the row that holds it there.
    const half = listOf(
      [stay("Jardim", "booked"), flight("Emre TK", "IST", "OPO", "2026-10-08", "booked", { forWho: ["Emre"] }), flight("Sabine LH", "IST", "OPO", "2026-10-08", "chosen", { forWho: ["Sabine"] })],
      trip,
    ).list;
    expect(half.counts).toMatchObject({ planned: 1, booked: 1 }); // the flight planned, the stay booked
    expect(half.book.map((t) => t.title)).toEqual(["Sabine LH"]);
  });

  it("a need with no to-do of its own (a ticket or an eSIM with options) gets its card's row", () => {
    const { list } = listOf([
      stay("Jardim", "booked"),
      makeItem({ name: "Lello bileti", category: "activity", needKey: "activity:lello", status: "saved", city: "Porto", booking: "needed", dates: { start: "2026-10-11", end: null, source: "page" } }),
      makeItem({ name: "Airalo", category: "esim", needKey: "esim:pt", status: "saved" }),
    ]);
    expect(list.open.map((t) => t.title)).toEqual(expect.arrayContaining(["Lello bileti", "Airalo"]));
  });

  it("a cancelled booking: out of the plan, its need to find again", () => {
    const hotel = stay("Jardim", "booked");
    const cancelled: Item = { ...hotel, status: "dismissed", dismissedFrom: "booked", cancelledAt: 5 };
    const before = listOf([hotel]).list.counts;
    const after = listOf([cancelled]).list.counts;
    expect(before.booked).toBe(1);
    expect(after.booked).toBe(0);
    expect(after.search).toBe(before.search + 1);
  });

  it("the next step is the soonest row; a missing file isn't one", () => {
    const { list } = listOf([stay("Jardim", "chosen"), flight("Out", "IST", "OPO", "2026-10-08", "booked")]);
    const all = listTodos(list);
    expect(all.length).toBe(list.open.length + list.book.length + list.ways.length + list.deadlines.length);
    expect(all.map((t) => t.date ?? "9999")).toEqual([...all.map((t) => t.date ?? "9999")].sort());
  });
});
