// tests/undoables.test.ts
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { hideNights, undo } from "../src/app/actions";
import { db } from "../src/lib/db";
import { buildPlan } from "../src/lib/plan";
import { plannedItem } from "../src/lib/planned";
import { deleteItem } from "../src/lib/removal";
import { quickItem, TEMPLATES } from "../src/lib/templates";
import { buildTimeline, hiddenNights } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { undoText, undoTrip, type Undoable } from "../src/lib/undoables";
import { makeItem } from "./fixtures/makeItem";

const trip = (id: string): Trip => ({ id, title: "Portekiz", confirmedDates: { start: "2026-10-08", end: "2026-10-12" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 });
const jardim = (tripId: string) =>
  makeItem({ tripId, category: "stay", name: "Jardim Stay", city: "Porto", status: "chosen", statusAt: 1, needKey: "stay:porto", dates: { start: "2026-10-08", end: "2026-10-10", source: "page" } });
const apart = (tripId: string) =>
  plannedItem({ kind: "stay", date: "2026-10-10", end_date: "2026-10-12", time: null, from: null, to: null, city: "Porto", title: null, booked: false, note: null }, tripId, `slot-${tripId}`, 5);
const blocks = (t: Trip, items: Item[], hidden = new Set<string>()) => {
  const plan = buildPlan(t, items);
  return { plan, timeline: buildTimeline(plan, [], items, hidden) };
};

describe("the toast's words", () => {
  const bus = quickItem(TEMPLATES.find((x) => x.id === "bus")!, { city: "Porto", date: "2026-10-09" }, "t1", "b", 1);
  it("deleted, added, added to Fikirler, hidden", () => {
    const all: Undoable[] = [
      { kind: "removed", removed: { item: makeItem({ name: "Douro tekne turu" }), docs: [] } },
      { kind: "added", item: bus, label: "Otobüs", ideas: false },
      { kind: "added", item: bus, label: "Yapılacak", ideas: true },
      { kind: "hidden", tripId: "t1", key: "nights:2026-10-10_2026-10-12", label: "Porto 10–12 Ekim" },
    ];
    expect(all.map(undoText)).toEqual(["Douro tekne turu silindi", "Otobüs eklendi", "Yapılacak Fikirler'e eklendi", "Porto 10–12 Ekim gizlendi"]);
    expect(all.map(undoTrip)).toEqual(["t1", "t1", "t1", "t1"]);
  });
});

describe("a stay said apart: × deletes it, Geri al brings it back", () => {
  it("its nights go back to the stay around them, then are apart again", async () => {
    const t = trip("tn1");
    const d = await db();
    await d.put("trips", t);
    const items = [jardim(t.id), apart(t.id)];
    for (const i of items) await d.put("items", i);
    expect(blocks(t, items).plan.stayBlocks.map((b) => [b.kind, b.range.start, b.kind === "booked" ? null : (b.slot?.id ?? null)])).toEqual([
      ["chosen", "2026-10-08", null],
      ["open", "2026-10-10", "slot-tn1"],
    ]);
    const removed = await deleteItem(items[1]);
    expect(await d.get("items", "slot-tn1")).toBeUndefined();
    expect(blocks(t, [items[0]]).plan.stayBlocks.map((b) => [b.kind, b.range.start, b.kind === "open" && b.slot ? b.slot.id : null])).toEqual([
      ["chosen", "2026-10-08", null],
      ["open", "2026-10-10", null],
    ]);
    await undo({ kind: "removed", removed });
    expect((await d.get("items", "slot-tn1"))?.name).toBe("Konaklama · Porto");
  });
});

describe("empty nights: × hides them, Geri al brings them back", () => {
  it("'Gerek yok' for those nights; they wait under Gizlenenler until brought back", async () => {
    const t = trip("tn2");
    const d = await db();
    await d.put("trips", t);
    const items = [jardim(t.id)];
    const empty = blocks(t, items).plan.stayBlocks[1];
    expect([empty.kind, empty.range]).toEqual(["open", { start: "2026-10-10", end: "2026-10-12" }]);
    const u = await hideNights(t.id, empty.range, "Porto 10–12 Ekim");
    expect(u).toEqual({ kind: "hidden", tripId: "tn2", key: "nights:2026-10-10_2026-10-12", label: "Porto 10–12 Ekim" });
    const hidden = new Set((await d.get("trips", "tn2"))!.hidden);
    expect(hiddenNights(blocks(t, items, hidden).timeline)).toEqual([{ range: { start: "2026-10-10", end: "2026-10-12" }, city: null }]);
    await undo(u);
    expect((await d.get("trips", "tn2"))!.hidden).toEqual([]);
    expect(hiddenNights(blocks(t, items).timeline)).toEqual([]);
  });
});

describe("a one-tap add taken back", () => {
  it("the record goes again", async () => {
    const made = quickItem(TEMPLATES.find((x) => x.id === "bus")!, { city: "Porto", date: "2026-10-09" }, "tn3", "qb", 1);
    await (await db()).put("items", made);
    await undo({ kind: "added", item: made, label: "Otobüs", ideas: false });
    expect(await (await db()).get("items", "qb")).toBeUndefined();
  });
});
