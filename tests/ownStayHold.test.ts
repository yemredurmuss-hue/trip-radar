// tests/ownStayHold.test.ts: a stay asked for in words ("1 gece cam tavanlı kulübe") is never filled by the board's own
// search with the first hotel it finds: its card stays as asked, the traveller searches it (omurga 2026-10-31, Emre: kart ilk
// başta ayrıydı, arama başlayınca adı Tromsø oldu). Like a camp's or a boat's nights.
import { describe, expect, it } from "vitest";
import { holdsOwnStay } from "../src/lib/autoSearch";
import { EMPTY_METRICS } from "../src/lib/items";
import { makeItem } from "./fixtures/makeItem";

describe("a stay the search never fills", () => {
  it("one asked for in words (its part: own)", () => {
    expect(holdsOwnStay(makeItem({ category: "stay", name: "Cam tavanlı kulübe", part: { ref: "own", section: "stay", frame: "stay", word: "Cam tavanlı kulübe" } }))).toBe(true);
  });
  it("a camp's night, as before", () => {
    expect(holdsOwnStay(makeItem({ category: "stay", name: "Kamp", metrics: { ...EMPTY_METRICS, stayKind: "camp" } }))).toBe(true);
  });
  it("the city's ordinary stay is searched and filled as before", () => {
    expect(holdsOwnStay(makeItem({ category: "stay", name: "Konaklama · Tromsø" }))).toBe(false);
    expect(holdsOwnStay(undefined)).toBe(false);
  });
});
