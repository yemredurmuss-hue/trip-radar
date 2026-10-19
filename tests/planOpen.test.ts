// The v82 Plan's accordion (lib/planOpen.ts, B8 and E1): one category open at a time, the last one opened remembered,
// all closed when nothing is; the one just opened comes up to the top in one move unless its head is already near it.
import { describe, expect, it } from "vitest";
import { eMove, openOne, scrollBy, staysPut, withOpen } from "../src/lib/planOpen";

const ALL = ["flight", "stay", "other"] as const;

describe("one open at a time", () => {
  it("opening one closes the others; closing leaves them closed", () => {
    expect(withOpen({ flight: true }, "stay", true, ALL)).toEqual({ flight: false, stay: true, other: false });
    expect(withOpen({ stay: true }, "stay", false, ALL)).toEqual({ stay: false });
  });
  it("the remembered one, else none", () => {
    expect(openOne({ flight: false, stay: true }, ALL)).toBe("stay");
    expect(openOne({}, ALL)).toBeNull();
    // An old state with two open (before the accordion): the first in the plan's order.
    expect(openOne({ other: true, flight: true }, ALL)).toBe("flight");
  });
});

describe("E1: up to the top in one move, unless already there", () => {
  const view = { top: 0, height: 800 };
  it("a head in the top quarter (under the pinned bar) stays put", () => {
    expect(staysPut(80, view, 76)).toBe(true);
    expect(staysPut(270, view, 76)).toBe(true);
    expect(staysPut(400, view, 76)).toBe(false);
    expect(staysPut(-200, view, 76)).toBe(false);
  });
  it("the scroll brings it right under the pinned bar", () => {
    expect(scrollBy(500, view, 76)).toBe(424);
    expect(scrollBy(-200, view, 76)).toBe(-276);
    expect(scrollBy(100, view, 76)).toBe(0);
  });
  it("the e-move curve starts slow, ends slow", () => {
    expect(eMove(0)).toBe(0);
    expect(eMove(1)).toBe(1);
    expect(eMove(0.5)).toBeCloseTo(0.5);
    expect(eMove(0.1)).toBeLessThan(0.1);
  });
});

describe("an update waits for nothing a category being open holds (B8)", () => {
  it("the category row's button is no reason to wait; a menu or a card's details still is", async () => {
    const { RELOAD_BLOCKERS } = await import("../src/app/UpdateBanner");
    expect(RELOAD_BLOCKERS).toContain('[aria-expanded="true"]:not(.q-tt)');
    expect(RELOAD_BLOCKERS).not.toMatch(/\[aria-expanded="true"\](,|$)/);
  });
});
