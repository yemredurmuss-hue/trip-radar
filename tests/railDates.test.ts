// The category's date rail (lib/railDates.ts, onay paketi 2026-10-21): a day over its weekday, a stay's nights as one range
// over its weekdays and its count, a rental's days, and the short open stretch between two stays drawn as an empty night.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import type { IntentVM } from "../src/lib/intents";
import { emptyNights, emptyNightText, isDatedSection, nightAlerts, overlapNights, overlapText, railDate, stayCheckOut, stretchText } from "../src/lib/railDates";
import { makeItem } from "./fixtures/makeItem";

type V = Pick<IntentVM, "key" | "kind" | "status" | "head" | "itemIds" | "options" | "ticket" | "chosen">;
const head = (over: Partial<IntentVM["head"]>): IntentVM["head"] => ({ name: "x", route: null, parts: [], kindWord: null, word: null, wants: [], image: null, city: null, date: null, nights: 0, ...over });
const stay = (key: string, city: string, date: string, nights: number, over: Partial<V> = {}): V => ({ key, kind: "stay", status: "chosen", head: head({ city, date, nights }), itemIds: ["i"], options: [], ticket: null, chosen: null, ...over });

describe("railDate", () => {
  it("a day: its short date over its weekday", () => {
    expect(railDate({ kind: "flight", head: head({ date: "2027-03-20" }), ticket: null, chosen: null })).toEqual({ when: "20 Mar", sub: "Cumartesi", span: null, notches: 0 });
  });
  it("a stay: its check-in in full and its nights, a notch a night; its check-out on its card (onay paketi 2026-10-22)", () => {
    expect(railDate({ kind: "stay", head: head({ date: "2027-03-24", nights: 3 }), ticket: null, chosen: null })).toEqual({ when: "24 Mart", sub: null, span: "3 gece", notches: 3 });
    expect(stayCheckOut({ kind: "stay", head: head({ date: "2027-03-24", nights: 3 }) })).toBe("Çıkış 27 Mart Cumartesi");
  });
  it("across two months: still two lines", () => {
    expect(railDate({ kind: "stay", head: head({ date: "2026-11-27", nights: 4 }), ticket: null, chosen: null })?.when).toBe("27 Kasım");
    expect(stayCheckOut({ kind: "stay", head: head({ date: "2026-11-27", nights: 4 }) })).toBe("Çıkış 1 Aralık Salı");
    expect(stretchText("2027-03-31", "2027-04-02")).toBe("31 Mar – 2 Nis");
    expect(stretchText("2027-03-27", "2027-03-27")).toBe("27 Mar");
  });
  it("a rental: its days are its 24-hour stretches, pick-up to return (11 → 18 Ekim is 7, Emre 2026-10-24)", () => {
    const item = makeItem({ id: "m", category: "transport", dates: { start: "2027-03-28", end: "2027-03-30", source: "page" } });
    const d = railDate({ kind: "transport", head: head({ date: "2027-03-28" }), ticket: { rental: { line: null, pick: null, days: 3, back: null } } as IntentVM["ticket"], chosen: { item } as IntentVM["chosen"] });
    expect(d).toEqual({ when: "28–30 Mar", sub: "Paz → Sal", span: "2 gün", notches: 2 });
  });
  it("no day: nothing to say (C19)", () => {
    expect(railDate({ kind: "flight", head: head({}), ticket: null, chosen: null })).toBeNull();
  });
  it("in English", () => {
    withLang("en", () => expect(railDate({ kind: "stay", head: head({ date: "2027-03-24", nights: 1 }), ticket: null, chosen: null })).toEqual({ when: "24 March", sub: null, span: "1 night", notches: 1 }));
  });
  it("only flights, stays and getting around are dated", () => {
    expect(["flight", "stay", "transport", "activity", "other"].map(isDatedSection)).toEqual([true, true, true, false, false]);
  });
});

describe("emptyNights", () => {
  const bkk = stay("a", "Bangkok", "2027-03-24", 3, { status: "booked" });
  const cnx = stay("b", "Chiang Mai", "2027-03-27", 3);
  const gap = stay("c", "Bangkok", "2027-03-30", 1, { status: "searching", itemIds: [] });
  const bkk2 = stay("d", "Bangkok", "2027-03-31", 2, { status: "searching", itemIds: [] });
  it("the short open stretch between two stays, nothing saved for it", () => {
    expect([...emptyNights([bkk, cnx, gap, bkk2])]).toEqual(["c"]);
  });
  it("not the last stay, not one with options or a record, not a long one", () => {
    expect(emptyNights([bkk, cnx, { ...gap, options: [{} as IntentVM["options"][number]] }, bkk2]).size).toBe(0);
    expect(emptyNights([bkk, cnx, { ...gap, itemIds: ["x"] }, bkk2]).size).toBe(0);
    expect(emptyNights([bkk, cnx, { ...gap, head: { ...gap.head, nights: 3 } }, bkk2]).size).toBe(0);
    expect(emptyNights([bkk, gap]).size).toBe(0);
  });
  it("says which night and the two stays around it", () => {
    expect(emptyNightText(gap, cnx, bkk2)).toEqual({ title: "30 Mar gecesi boş", line: "Chiang Mai çıkışı 30 Mar, Bangkok girişi 31 Mar" });
    expect(emptyNightText({ head: head({ date: "2027-03-30", nights: 2 }) }, null, null)).toEqual({ title: "30 Mar – 1 Nis · 2 gece boş", line: null });
  });
});

describe("overlapNights", () => {
  const rec = (id: string, city: string, start: string, end: string, status: "chosen" | "booked" | "saved" = "chosen") => makeItem({ id, category: "stay", city, name: city, status, dates: { start, end, source: "url" } });
  const cnx = rec("b", "Chiang Mai", "2027-03-27", "2027-03-30");
  const pai = rec("p", "Pai", "2027-03-29", "2027-03-31", "booked");
  it("two stays chosen or booked for the same night: once, on the later", () => {
    const m = overlapNights([pai, cnx]);
    expect([...m.keys()]).toEqual(["p"]);
    expect(overlapText(m.get("p")!)).toEqual({ title: "29 Mar gecesi iki konaklama", line: "Chiang Mai (27–30 Mar) ve Pai (29–31 Mar) çakışıyor · biri boşa ödenir" });
  });
  it("back to back is no overlap; an option only saved holds no night", () => {
    expect(overlapNights([cnx, rec("q", "Bangkok", "2027-03-30", "2027-04-01")]).size).toBe(0);
    expect(overlapNights([cnx, { ...pai, status: "saved" }]).size).toBe(0);
  });
  it("a closed category says the empty and the doubled nights", () => {
    const bkk = stay("a", "Bangkok", "2027-03-24", 3, { status: "booked" });
    const cnxV = stay("b", "Chiang Mai", "2027-03-27", 3);
    const gap = stay("c", "Bangkok", "2027-03-30", 1, { status: "searching", itemIds: [] });
    const bkk2 = stay("d", "Bangkok", "2027-03-31", 2, { status: "searching", itemIds: [] });
    expect(nightAlerts([bkk, cnxV, gap, bkk2])).toEqual([{ text: "1 gece boş", tone: "warn" }]);
    expect(nightAlerts([cnxV], [cnx, pai])).toEqual([{ text: "1 gece çakışıyor", tone: "bad" }]);
  });
});

describe("undatedLast", () => {
  it("the needs with no day go last, after a line; the rest keep their order", async () => {
    const { undatedLast } = await import("../src/lib/railDates");
    const a = stay("a", "Bangkok", "2027-03-24", 3), b = { ...stay("b", "Chiang Mai", "", 0), head: head({ city: "Chiang Mai" }) }, c = stay("c", "Pai", "2027-03-29", 2);
    expect(undatedLast([a, b, c])).toEqual({ list: [a, c, b], first: "b" });
    expect(undatedLast([a, c]).first).toBeNull();
  });
});
