// "Yolculuk sırasıyla" (plan v46, F5b): the trip as one column in the order it is lived. Only the order is made here.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { setLang } from "../src/lib/i18n";
import { journeyFlow, type FlowNode } from "../src/lib/journey";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";
import type { Item } from "../src/lib/types";
import { dayChip, inOut, rangeText } from "../src/lib/storyDates";

const flowOf = async (edit: (items: Item[]) => Item[] = (x) => x): Promise<FlowNode[]> => {
  const id = await loadDemoTrip({ today: "2026-10-05" });
  const trip = (await (await db()).get("trips", id))!;
  const items = edit(await listItems(id));
  const { ctx } = await loadDecisions(trip, items);
  const plan = buildPlan(trip, items);
  return journeyFlow(buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items), items);
};
const shape = (nodes: FlowNode[]) =>
  nodes.map((n) => (n.kind === "entry" ? `entry:${n.entry.kind === "travel" ? n.entry.role : n.entry.kind}` : n.kind === "city" ? `city:${n.city}` : n.kind === "event" ? `event:${n.item.name}` : n.kind));

describe("journeyFlow", () => {
  beforeEach(() => setLang("tr"));

  it("runs from 'Yola çıkış' to 'Eve dönüş', each city with its stay and events between", async () => {
    const nodes = await flowOf();
    expect(shape(nodes)).toEqual(["start", "entry:arrival", "city:Porto", "stay", "event:Douro tekne turu", "entry:move", "city:Lizbon", "stay", "entry:departure", "end"]);
    expect(nodes[0]).toMatchObject({ kind: "start", city: "İstanbul" });
    expect(nodes.at(-1)).toMatchObject({ kind: "end", city: "İstanbul" });
  });

  it("an event with no day comes last in its city and has no date", async () => {
    const nodes = await flowOf((items) =>
      items.map((i) => (i.name === "Livraria Lello" ? { ...i, status: "chosen" as const, price: { ...i.price, amount: 5, currency: "EUR", scope: "per_person" as const }, provider: "Viator" } : i)),
    );
    const events = nodes.filter((n): n is Extract<FlowNode, { kind: "event" }> => n.kind === "event");
    const porto = events.filter((e) => e.item.city === "Porto");
    expect(porto.map((e) => e.item.name)).toEqual(["Douro tekne turu", "Livraria Lello"]);
    expect(porto[0].date).toBe("2026-10-09");
    expect(porto[1].date).toBeNull();
  });

  it("chosen or booked places and tables share one box; saved ideas stay out", async () => {
    const nodes = await flowOf((items) => items.map((i) => (i.name === "Majestic Café" ? { ...i, status: "chosen" as const } : i)));
    const todo = nodes.filter((n): n is Extract<FlowNode, { kind: "todo" }> => n.kind === "todo");
    expect(todo).toHaveLength(1);
    expect(todo[0].items.map((i) => i.name)).toEqual(["Majestic Café"]);
    expect(nodes.some((n) => n.kind === "event" && n.item.name === "Majestic Café")).toBe(false);
    const none = await flowOf();
    expect(none.some((n) => n.kind === "todo")).toBe(false);
  });

  it("every chosen or booked place appears once", async () => {
    const nodes = await flowOf((items) => items.map((i) => (["Majestic Café", "Livraria Lello", "Serralves Müzesi"].includes(i.name) ? { ...i, status: "chosen" as const } : i)));
    const ids = nodes.flatMap((n) => (n.kind === "event" ? [n.item.id] : n.kind === "todo" ? n.items.map((i) => i.id) : []));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("a city visited twice", () => {
  beforeEach(() => setLang("tr"));
  it("draws a place of it once", async () => {
    const nodes = await flowOf((items) => {
      const out = items.map((i) => (i.name === "Majestic Café" ? { ...i, status: "chosen" as const, city: "Lizbon" } : i));
      const stay = out.find((i) => i.name === "Lisboa Loft")!;
      return [...out, { ...stay, id: "again", name: "Lisboa Again", dates: { ...stay.dates, start: "2026-10-14", end: "2026-10-15" }, status: "chosen" as const }];
    });
    expect(nodes.filter((n) => n.kind === "todo").flatMap((n) => (n.kind === "todo" ? n.items : [])).filter((i) => i.name === "Majestic Café")).toHaveLength(1);
  });
});

describe("storyDates (v46)", () => {
  beforeEach(() => setLang("tr"));
  it("says a stretch, a day's capsule and a stay's check-in and check-out", () => {
    expect(rangeText("2027-04-01", "2027-04-06")).toBe("1–6 Nis");
    expect(rangeText("2027-04-01", null)).toBe("1 Nis");
    expect(dayChip("2027-04-01")).toMatch(/^1 Nis Per/);
    expect(dayChip(null)).toBeNull();
    expect(inOut("2027-04-01", "2027-04-06")).toEqual({ in: "1 Nis", out: "6 Nis" });
    expect(inOut("2027-04-01", null)).toBeNull();
  });
});
