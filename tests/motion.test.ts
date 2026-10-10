import { describe, expect, it } from "vitest";
import { countAt, dropsIn } from "../src/app/motion";

describe("motion dictionary: the pure parts", () => {
  it("a number counts from where it was to where it is going, never past it", () => {
    expect(countAt(100, 200, 0)).toBe(100);
    expect(countAt(100, 200, 1)).toBe(200);
    expect(countAt(100, 200, 2)).toBe(200);
    expect(countAt(100, 200, -1)).toBe(100);
    const mid = countAt(100, 200, 0.5);
    expect(mid).toBeGreaterThan(150); // ease-out: most of the way early
    expect(mid).toBeLessThan(200);
    expect(countAt(200, 100, 0.5)).toBeLessThan(150);
  });
  it("a card the chat just added drops in once; old cards and cards of other origins never do", () => {
    const now = 1_000_000;
    expect(dropsIn("a", now - 500, true, now, false)).toBe(true);
    expect(dropsIn("a", now - 400, true, now, false)).toBe(false); // once
    expect(dropsIn("b", now - 60_000, true, now, false)).toBe(false); // an old card
    expect(dropsIn("c", now - 500, false, now, false)).toBe(false); // not from the chat
    expect(dropsIn("d", now - 500, true, now, true)).toBe(false); // reduced motion
  });
});
