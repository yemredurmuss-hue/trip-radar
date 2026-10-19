// 0.39.3, Emre: "Yapılacakları plana ekle deyince otomatik tarih atıyor, onu yapmasın."
import { describe, expect, it } from "vitest";
import { suggestedItem } from "../src/lib/suggestions";
import type { Suggestion } from "../src/lib/types";

const s = (template: string, section: Suggestion["section"]): Suggestion => ({
  key: `ai:${template}`, section, kind: "add", title: "Tanah Lot Tapınağı", why: "Gün batımı için.", source: "ai", template, createdAt: 1, state: "open",
  payload: { city: "Tabanan", start: "2026-12-10", end: "2026-12-14" },
});

describe("a place put on the plan from a suggestion", () => {
  it("a thing to do or a place to eat takes no day: undated, a day given by hand", () => {
    for (const [tpl, sec] of [["todo", "todo"], ["food", "food"]] as const) {
      const item = suggestedItem(s(tpl, sec), "t1", `i-${tpl}`, 1)!;
      expect(item.dates.start).toBeNull();
      expect(item.dates.end).toBeNull();
      expect(item.city).toBe("Tabanan");
    }
  });
  it("a rental keeps its days (only places to see and eat lose them)", () => {
    const item = suggestedItem({ ...s("car", "transport"), title: "Araç kiralama" }, "t1", "i-car", 1)!;
    expect(item.dates.start).toBe("2026-12-10");
  });
});
