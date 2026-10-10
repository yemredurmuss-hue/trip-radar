import { describe, expect, it } from "vitest";
import { GAP, MAX_GLIDE, MAX_START, MIN_GLIDE, OFF_KEY, PHASE, claimOpening, easeInOut, glideTime, openedKey, schedule } from "../src/app/opening";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe("pıt pıt: the order and the beat", () => {
  it("starts each piece after the gap of the one before it, in reading order", () => {
    expect(schedule(["fade", "photo", "wipe", "rise"])).toEqual([0, GAP.fade, GAP.fade + GAP.photo, GAP.fade + GAP.photo + GAP.wipe]);
    expect(schedule([])).toEqual([]);
    expect(schedule(["card"])).toEqual([0]);
  });
  it("squeezes the beat when there are many pieces, so the last still starts within the cap", () => {
    const many = Array.from({ length: 40 }, () => "card" as const);
    const starts = schedule(many);
    expect(starts.at(-1)).toBeLessThanOrEqual(MAX_START);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(starts[1]).toBeLessThan(GAP.card);
    // few pieces keep the drawn beat
    expect(schedule(Array.from({ length: 5 }, () => "card" as const)).at(-1)).toBe(4 * GAP.card);
  });
});

describe("when it plays", () => {
  it("once per trip per session, never again, and per trip", () => {
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

describe("the mascot's beat and the glide (2026-10-10: a slow wink, then the panel glides down)", () => {
  it("winks long enough to be seen, before anything fills", () => {
    expect(PHASE.burst - PHASE.wink).toBeGreaterThanOrEqual(900);
    expect(PHASE.fill).toBeGreaterThanOrEqual(PHASE.burst);
  });
  it("glides at a steady speed, never too short or too long", () => {
    expect(glideTime(0)).toBe(MIN_GLIDE);
    expect(glideTime(900)).toBe(2000);
    expect(glideTime(100000)).toBe(MAX_GLIDE);
  });
  it("eases in and out, from 0 to 1", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
  });
});
