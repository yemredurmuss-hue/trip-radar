// tests/ownStayNeed.test.ts: two stays said for back-to-back nights in one city (the start's "1 gece cam tavanlı kulübe"
// carved from Tromsø, the chat's "7 Ekim gecesi başka bir otel") are two needs, each its own card; a city's booked nights
// and the empty ones after them stay one need, as before (omurga 2026-10-31, Emre: kulübe Tromsø'nun 5 gecesine karıştı).
import { describe, expect, it } from "vitest";
import { categorize, needsOf } from "../src/lib/categories";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";
import { tripOf } from "./spine/fixture";

const trip = tripOf({ confirmedDates: { start: "2027-02-15", end: "2027-02-20" } });
const stayNeeds = (items: Item[]) => {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  return needsOf(categorize({ plan, timeline: buildTimeline(plan, legs, items), items, legs, today: "2027-01-01" }).filter((s) => s.id === "stay"));
};
const said = (id: string, name: string, start: string, end: string) =>
  makeItem({ id, category: "stay", needKey: "stay:tromso", name, city: "Tromsø", status: "chosen", origin: "chat", dates: { start, end, source: "user" } });

describe("stays said for back-to-back nights", () => {
  it("the cabin's night and the city's other nights are two needs", () => {
    expect(stayNeeds([said("a", "Cam tavanlı kulübe", "2027-02-15", "2027-02-16"), said("b", "Konaklama · Tromsø", "2027-02-16", "2027-02-20")])).toHaveLength(2);
  });
  it("booked nights and the empty ones after them stay one need", () => {
    const booked = makeItem({ id: "h", category: "stay", needKey: "stay:tromso", name: "Hotel", city: "Tromsø", status: "booked", dates: { start: "2027-02-15", end: "2027-02-17", source: "url" } });
    expect(stayNeeds([booked, said("b", "Konaklama · Tromsø", "2027-02-15", "2027-02-20")])).toHaveLength(1);
  });
});
