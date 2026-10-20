// The chat's change lines: a run of FOLD_MIN (two since P8, F29) or more is folded into one line; a lone one and everything else stay.
import { describe, expect, it } from "vitest";
import { FOLD_MIN, foldLabel, foldRuns } from "../src/app/ChatFold";
import { setLang } from "../src/lib/i18n";
setLang("tr");

const ev = (n: number) => `event ${n}`;
const isEvent = (s: string) => s.startsWith("event");

describe("foldRuns", () => {
  it("folds a run of change lines at the minimum length and keeps what is said by people", () => {
    const rows = ["user", ...Array.from({ length: FOLD_MIN }, (_, i) => ev(i)), "assistant"];
    expect(foldRuns(rows, isEvent)).toEqual([{ row: "user" }, { fold: Array.from({ length: FOLD_MIN }, (_, i) => ev(i)) }, { row: "assistant" }]);
  });
  it("leaves a lone change line as it was", () => {
    const rows = [ev(0), "assistant", ev(1)];
    expect(foldRuns(rows, isEvent)).toEqual([{ row: ev(0) }, { row: "assistant" }, { row: ev(1) }]);
  });
  it("says what the fold holds", () => {
    expect(foldLabel(["Ribeira Douro kaydedildi", "Vincci kaydedildi", "Wine & Books güncellendi"])).toBe("2 kaydedildi, 1 güncellendi");
    expect(foldLabel(["a", "b"])).toBe("2 değişiklik");
  });
  it("folds two runs apart, and a run at the end", () => {
    const rows = [...Array.from({ length: 5 }, (_, i) => ev(i)), "user", ...Array.from({ length: 4 }, (_, i) => ev(10 + i))];
    expect(foldRuns(rows, isEvent)).toEqual([{ fold: [ev(0), ev(1), ev(2), ev(3), ev(4)] }, { row: "user" }, { fold: [ev(10), ev(11), ev(12), ev(13)] }]);
  });
  it("is empty for no rows", () => {
    expect(foldRuns([], isEvent)).toEqual([]);
  });
});
