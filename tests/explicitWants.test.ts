// tests/explicitWants.test.ts: what the traveller plainly asks for ("bir gece cam tavanlı kulübe", "bir gün husky turu")
// is the spine, never left to the model's own playbook (omurga 2026-10-31, Emre: Tromsø'da kulübe "merkezde otel gecesi"
// oldu, husky hiç konmadı). The model writes them down in two fields; the code puts them on the plan as said.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import { playbookCards } from "../src/lib/startCreate";
import { acceptExtraction, applyAnswer, creationOf, mergeExtracted, newStart, type RawExtraction, type StartState } from "../src/lib/startTrip";

const raw = (over: Record<string, unknown> = {}): RawExtraction => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "",
  start_month: 0, duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
}) as RawExtraction;

const tromso = (over: Partial<StartState> = {}): StartState => {
  let s = applyAnswer(newStart("tr", "plan", 1, "tr"), { q: "where", place: "Tromsø", country: "Norveç", code: "NO" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 5 } }, 3);
  s = applyAnswer(s, { q: "start", date: "2027-02-05", approx: false }, 4);
  return { ...s, from: "İstanbul", ...over };
};

describe("the model writes the plain asks down", () => {
  it("a stay of its own and an activity, as said", () => {
    const e = acceptExtraction(raw({
      special_stays: [{ place: "Tromsø", nights: 1, what: "cam tavanlı kulübe" }],
      wanted: [{ place: "Tromsø", what: "husky turu", day: "" }],
    }), "2026-10-31");
    expect(e.specialStays).toEqual([{ city: "Tromsø", nights: 1, what: "cam tavanlı kulübe" }]);
    expect(e.wanted).toEqual([{ city: "Tromsø", what: "husky turu", day: null }]);
  });
  it("what isn't a real ask is dropped (no name, nights out of range)", () => {
    const e = acceptExtraction(raw({ special_stays: [{ place: "Tromsø", nights: 0, what: "" }], wanted: [{ place: "", what: "", day: "" }] }), "2026-10-31");
    expect(e.specialStays).toBeUndefined();
    expect(e.wanted).toBeUndefined();
  });
  it("the model's lists reach the start", () => {
    const code = acceptExtraction(raw(), "2026-10-31");
    const model = acceptExtraction(raw({ wanted: [{ place: "Tromsø", what: "husky turu", day: "" }] }), "2026-10-31");
    expect(mergeExtracted(code, model).wanted).toEqual([{ city: "Tromsø", what: "husky turu", day: null }]);
  });
});

describe("the plan holds them as said", () => {
  it("one night in the cabin, the other four in the city's stay", () => {
    const c = withLang("tr", () => creationOf(tromso({ specialStays: [{ city: "Tromsø", nights: 1, what: "cam tavanlı kulübe" }] })))!;
    expect(c.stays.map((x) => `${x.title ?? x.city} ${x.date}..${x.end_date}`)).toEqual([
      "Cam tavanlı kulübe 2027-02-05..2027-02-06",
      "Tromsø 2027-02-06..2027-02-10",
    ]);
  });
  it("an activity asked for is a card on the plan, on its city", () => {
    const s = tromso({ wanted: [{ city: "Tromsø", what: "husky turu", day: null }] });
    const cards = withLang("tr", () => playbookCards(s, creationOf(s)!)).plan;
    expect(cards.some((x) => x.kind === "activity" && x.title === "Husky turu" && x.city === "Tromsø")).toBe(true);
  });
});
