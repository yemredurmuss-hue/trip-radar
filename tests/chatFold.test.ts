// The chat's change lines: a run of four or more is folded into one line, shorter runs and everything else stay.
import { describe, expect, it } from "vitest";
import { FOLD_MIN, foldRuns } from "../src/app/ChatFold";

const ev = (n: number) => `event ${n}`;
const isEvent = (s: string) => s.startsWith("event");

describe("foldRuns", () => {
  it("folds a run of change lines at the minimum length and keeps what is said by people", () => {
    const rows = ["user", ...Array.from({ length: FOLD_MIN }, (_, i) => ev(i)), "assistant"];
    expect(foldRuns(rows, isEvent)).toEqual([{ row: "user" }, { fold: [ev(0), ev(1), ev(2), ev(3)] }, { row: "assistant" }]);
  });
  it("leaves a shorter run as it was", () => {
    const rows = [ev(0), ev(1), ev(2), "assistant"];
    expect(foldRuns(rows, isEvent)).toEqual([{ row: ev(0) }, { row: ev(1) }, { row: ev(2) }, { row: "assistant" }]);
  });
  it("folds two runs apart, and a run at the end", () => {
    const rows = [...Array.from({ length: 5 }, (_, i) => ev(i)), "user", ...Array.from({ length: 4 }, (_, i) => ev(10 + i))];
    expect(foldRuns(rows, isEvent)).toEqual([{ fold: [ev(0), ev(1), ev(2), ev(3), ev(4)] }, { row: "user" }, { fold: [ev(10), ev(11), ev(12), ev(13)] }]);
  });
  it("is empty for no rows", () => {
    expect(foldRuns([], isEvent)).toEqual([]);
  });
});
