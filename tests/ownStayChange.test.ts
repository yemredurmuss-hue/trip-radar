// tests/ownStayChange.test.ts: moving from a stay asked for in words to the city's other nights (the glass cabin's night,
// then the hotel) is a change of place the plan shows as a transfer, though neither place is picked yet (omurga 2026-10-31:
// a ring of the trip's spine). Two open nights of the same stay are no change.
import { describe, expect, it } from "vitest";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";
import { tripOf } from "./spine/fixture";

const trip = tripOf({ confirmedDates: { start: "2027-02-15", end: "2027-02-20" } });
const said = (id: string, name: string, start: string, end: string, over: Partial<Item> = {}) =>
  makeItem({ id, category: "stay", needKey: "stay:tromso", name, city: "Tromsø", status: "chosen", origin: "chat", dates: { start, end, source: "user" }, ...over });
const changes = (items: Item[]) => buildLegs(buildPlan(trip, items), trip).filter((l) => l.kind === "change").map((l) => l.date);

describe("a change of place on the trip's spine", () => {
  it("from the cabin's night to the city's hotel: a change transfer on the 16th", () => {
    const cabin = said("a", "Cam tavanlı kulübe", "2027-02-15", "2027-02-16", { part: { ref: "own", section: "stay", frame: "stay", word: "Cam tavanlı kulübe" } });
    expect(changes([cabin, said("b", "Konaklama · Tromsø", "2027-02-16", "2027-02-20")])).toEqual(["2027-02-16"]);
  });
  it("one stay's nights, none apart: no change", () => {
    expect(changes([said("b", "Konaklama · Tromsø", "2027-02-15", "2027-02-20")])).toEqual([]);
  });
});
