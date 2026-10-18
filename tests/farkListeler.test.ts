import { describe, expect, it } from "vitest";
import { ideaCount } from "../src/app/plan/Section";
import { SECTION_META } from "../src/app/plan/sectionMeta";

const rec = (status: string, doneAt?: number) => ({ piece: { kind: "item", item: { status, doneAt, dates: { start: null }, category: "activity" } } }) as never;

describe("v46 lists as drawn", () => {
  it("Yapılacaklar says what is on the plan and what waits, suggestions included", () => {
    const entries = [rec("chosen"), rec("booked"), rec("saved"), rec("chosen", 1)];
    expect(ideaCount("todo", { total: 4, onDay: 0, done: 1 }, entries, 2)).toBe("2 planda · 3 öneri · 1 yapıldı");
  });
  it("İlham says what it holds; sections carry the drawing's icons", () => {
    expect(ideaCount("inspo", { total: 2, onDay: 0, done: 0 })).toBe("kaydettiğin video ve gönderiler");
    expect([SECTION_META.todo.icon, SECTION_META.prep.color, SECTION_META.inspo.color]).toEqual(["map", "#475467", "#c0256b"]);
  });
});
