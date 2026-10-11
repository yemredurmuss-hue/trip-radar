import { describe, expect, it } from "vitest";
import { GAP, MAX_START, OFF_KEY, claimOpening, countAt, openedKey, schedule } from "../src/app/opening";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe("pıt pıt: the beat (B · Ritim ve sayaçlar, 2026-10-10)", () => {
  it("starts from the first frame, each piece one beat after the one before, in reading order", () => {
    expect(schedule(4)).toEqual([0, GAP, 2 * GAP, 3 * GAP]);
    expect(schedule(0)).toEqual([]);
    expect(schedule(1)).toEqual([0]);
  });
  it("squeezes the beat when there are many pieces, so what is in view is in within the cap", () => {
    const starts = schedule(40);
    expect(starts[0]).toBe(0);
    expect(starts.at(-1)).toBe(MAX_START);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(starts[1]).toBeLessThan(GAP);
  });
});

describe("the counters", () => {
  it("count from 0 to the figure, fast at first, and land on it exactly", () => {
    expect(countAt(67, 0)).toBe(0);
    expect(countAt(67, 1)).toBe(67);
    expect(countAt(67, 0.5)).toBeGreaterThan(67 / 2);
    expect(countAt(4, 2)).toBe(4);
    expect(countAt(4, -1)).toBe(0);
  });
});

describe("when it plays", () => {
  it("once per trip, ever (kept in the browser), never again, and per trip", () => {
    const store = memory();
    expect(claimOpening("t1", store)).toBe(true);
    expect(store.getItem(openedKey("t1"))).toBe("1");
    expect(claimOpening("t1", store)).toBe(false);
    expect(claimOpening("t2", store)).toBe(true);
  });
  it("never while the off switch is set, and it leaves no mark then", () => {
    const store = memory();
    store.setItem(OFF_KEY, "1");
    expect(claimOpening("t1", store)).toBe(false);
    expect(store.getItem(openedKey("t1"))).toBeNull();
  });
  it("plays when there is no storage to ask", () => {
    expect(claimOpening("t1", null)).toBe(true);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(claimOpening("t1", broken)).toBe(true);
  });
});
