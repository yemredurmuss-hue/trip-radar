// Bitti ve yaklaştı (lib/planRing.ts): each plan a part of the ring, options never counted.
import { describe, expect, it } from "vitest";
import { ringArcs, ringDone, ringParts } from "../src/lib/planRing";

describe("ringParts: the bought, then the chosen, then the rest", () => {
  it("Uçuş: two plans, the flight out bought, the flight home to decide (its eight options count for nothing)", () => {
    expect(ringParts({ done: 1, near: 0, total: 2 })).toEqual(["done", "open"]);
  });
  it("Ulaşım: three journeys, one bought, one chosen, one to decide", () => {
    expect(ringParts({ done: 1, near: 1, total: 3 })).toEqual(["done", "near", "open"]);
  });
  it("never more parts than plans, never negative", () => {
    expect(ringParts({ done: 5, near: 4, total: 3 })).toEqual(["done", "done", "done"]);
    expect(ringParts({ done: -1, near: 0, total: 0 })).toEqual([]);
  });
  it("all bought: done; nothing to count: not done", () => {
    expect(ringDone({ done: 2, near: 0, total: 2 })).toBe(true);
    expect(ringDone({ done: 1, near: 1, total: 2 })).toBe(false);
    expect(ringDone({ done: 0, near: 0, total: 0 })).toBe(false);
  });
});

describe("ringArcs: one arc a plan, gaps between them", () => {
  it("two plans are two halves from the top, a gap at each join", () => {
    const [a, b] = ringArcs(["done", "open"]);
    expect(a.d.startsWith("M")).toBe(true);
    expect(a.part).toBe("done");
    expect(b.part).toBe("open");
    expect(a.d).not.toBe(b.d);
  });
  it("one plan is the whole ring; many plans touch", () => {
    expect(ringArcs(["near"])).toHaveLength(1);
    expect(ringArcs(Array(20).fill("open"))).toHaveLength(20);
  });
});
