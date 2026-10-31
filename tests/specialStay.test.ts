// tests/specialStay.test.ts: a stay of its own the trip's kind asks for ("1 gece cam tavanlı kulübe", a ryokan night)
// takes its nights out of the city's stay, never a second card over the same nights (omurga 2026-10-31, Emre: Tromsø'da
// otel 5 geceyi tuttu, kulübe aynı geceye ayrı kart oldu).
import { describe, expect, it } from "vitest";
import { carveSpecialStays, type ShapedInput } from "../src/lib/startCreate";

const base = { time: null, from: null, to: null, booked: false, note: null } as const;
const stay = (city: string, date: string, end: string): ShapedInput => ({ ...base, kind: "stay", city, date, end_date: end, title: null });
const cabin = (over: Partial<ShapedInput> = {}): ShapedInput => ({
  ...base, kind: "other", city: "Tromsø", date: "2027-02-12", end_date: null, title: "Cam tavanlı kulübe",
  part: { ref: "cabin", section: "stay", frame: "stay", word: "Kulübe" }, ...over,
});
const nights = (list: ShapedInput[]) => list.map((x) => `${x.title ?? x.city} ${x.date}..${x.end_date}`);

describe("a stay of its own", () => {
  it("one night on the first day: the cabin, then the hotel for the rest", () => {
    const { stays, used } = carveSpecialStays([stay("Tromsø", "2027-02-12", "2027-02-17")], [cabin()]);
    expect(nights(stays)).toEqual(["Cam tavanlı kulübe 2027-02-12..2027-02-13", "Tromsø 2027-02-13..2027-02-17"]);
    expect(stays[0].kind).toBe("stay");
    expect(stays[0].part?.word).toBe("Kulübe");
    expect(used).toHaveLength(1);
  });

  it("two nights in the middle: the stay on both sides", () => {
    const { stays } = carveSpecialStays([stay("Tromsø", "2027-02-12", "2027-02-17")], [cabin({ date: "2027-02-14", end_date: "2027-02-16" })]);
    expect(nights(stays)).toEqual(["Tromsø 2027-02-12..2027-02-14", "Cam tavanlı kulübe 2027-02-14..2027-02-16", "Tromsø 2027-02-16..2027-02-17"]);
  });

  it("no day said: its city's first night", () => {
    const { stays } = carveSpecialStays([stay("Oslo", "2027-02-10", "2027-02-12"), stay("Tromsø", "2027-02-12", "2027-02-17")], [cabin({ date: null })]);
    expect(nights(stays)).toEqual(["Oslo 2027-02-10..2027-02-12", "Cam tavanlı kulübe 2027-02-12..2027-02-13", "Tromsø 2027-02-13..2027-02-17"]);
  });

  it("nowhere to take nights from (no dates, or another city): it stays a card", () => {
    expect(carveSpecialStays([stay("Oslo", "2027-02-10", "2027-02-12")], [cabin()]).used).toEqual([]);
    expect(carveSpecialStays([{ ...stay("Tromsø", "", ""), date: null, end_date: null }], [cabin({ date: null })]).used).toEqual([]);
  });

  it("what a package covers (a boat's transfer) or a covering part is no stay of its own", () => {
    const held = cabin({ part: { ref: "dive", section: "stay", frame: "stay", by: "stay" } });
    expect(carveSpecialStays([stay("Tromsø", "2027-02-12", "2027-02-17")], [held]).used).toEqual([]);
  });
});
