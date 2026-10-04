import { describe, expect, it } from "vitest";
import { countdown, countdownText } from "../src/lib/countdown";

const R = { start: "2026-10-07", end: "2026-10-18" };

describe("countdown", () => {
  it("counts the days before the trip", () => {
    expect(countdown(R, "2026-10-04")).toEqual({ kind: "before", days: 3 });
    expect(countdownText(countdown(R, "2026-10-04"))).toBe("3 gün kaldı");
    expect(countdownText(countdown(R, "2026-10-06"))).toBe("Yarın");
  });
  it("says which day it is during the trip", () => {
    expect(countdown(R, "2026-10-10")).toEqual({ kind: "during", day: 4, total: 12 });
    expect(countdownText(countdown(R, "2026-10-07"))).toBe("1. gün / 12");
  });
  it("says done after the last day", () => {
    expect(countdownText(countdown(R, "2026-10-19"))).toBe("Bitti");
  });
  it("is null without dates", () => {
    expect(countdown(null, "2026-10-04")).toBeNull();
    expect(countdownText(null)).toBeNull();
  });
});
