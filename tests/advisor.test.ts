// tests/advisor.test.ts: the start's advisor (omurga Tur 18): its spine folded into the start never overrules what was
// said, fills what the reading missed (the stay asked for, the husky tour), places the special night where it decided,
// keeps the anchors within the budget, and the judge leaves one way per leg (a rental car and a bus never both).
import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { adviceFor, adviseStart, applyAdvice, resetAdvice, type Advice } from "../src/lib/advisor";
import { listItems } from "../src/lib/db";
import { holdsOwnStay } from "../src/lib/autoSearch";
import { setLang } from "../src/lib/i18n";
import type { LlmProvider } from "../src/lib/llm/types";
import { fitStops, oneWay, runStep, stepsFor, type ShapedInput } from "../src/lib/startCreate";
import { db } from "../src/lib/db";
import { tripState } from "../src/lib/assistant";
import { acceptExtraction, applyAnswer, creationOf, newStart, type Creation, type StartState } from "../src/lib/startTrip";

afterEach(() => resetAdvice());

const TROMSO: Advice = {
  rationale: "Ana amaç kuzey ışığı; cam tavanlı gece ortada, önce ve sonra ışık şansı kalsın. Kışın araç gereksiz.",
  stays: [
    { place: "Tromsø", nights: 2, kind: "hotel", what: null, source: "assumed" },
    { place: "Tromsø çevresi", nights: 1, kind: "special", what: "cam tavanlı konaklama", source: "user" },
    { place: "Tromsø", nights: 2, kind: "hotel", what: null, source: "assumed" },
  ],
  legs: [
    { from: "havalimanı", to: "Tromsø", day: 1, mode: "transfer", source: "assumed" },
    { from: "Tromsø", to: "havalimanı", day: 6, mode: "transfer", source: "assumed" },
  ],
  anchors: [
    { what: "kuzey ışığı avı turu", day: 1, source: "assumed" },
    { what: "husky turu", day: 2, source: "user" },
    { what: "cam tavanlı yerde ışık gecesi", day: 3, source: "assumed" },
    { what: "fiyort teknesi", day: 5, source: "assumed" },
  ],
  facts: ["Kuzey ışığı garanti değil"],
  wishes: [{ place: "Tromsø", about: "stay", text: "cam tavanlı" }, { place: null, about: "general", text: "  " }],
  question: { text: "Kuzey ışıklarını rehberli bir turla mı kovalayalım?", topic: "main_experience", choices: ["Rehberli tur", "Kendimiz bakarız"] },
};

function tromso(): StartState {
  let s = applyAnswer(newStart("adv", "plan", 1, "tr"), { q: "where", place: "Tromsø", country: "Norveç", code: "NO" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 5 } }, 3);
  s = applyAnswer(s, { q: "start", date: "2027-02-15", approx: false }, 4);
  return { ...s, from: "İstanbul", who: { kind: "partner", names: [] } };
}

it("Tromsø: the reading missed both wishes; the advice makes the glass night the middle one and the husky card, two anchors in all", async () => {
  setLang("tr");
  let state = applyAdvice(tromso(), TROMSO);
  expect(state.wanted?.map((w) => w.what)).toEqual(["husky turu", "kuzey ışığı avı turu"]);
  for (const step of stepsFor(state, creationOf(state)!)) {
    const { tripId } = await runStep(step.id, state, { provider: "gemini" });
    if (step.id === "trip") state = { ...state, tripId };
  }
  const items = await listItems(state.tripId!);
  const stays = items.filter((i) => i.category === "stay").sort((a, b) => (a.dates.start ?? "").localeCompare(b.dates.start ?? ""));
  expect(stays.map((i) => [i.dates.start, i.dates.end, holdsOwnStay(i)])).toEqual([
    ["2027-02-15", "2027-02-17", false],
    ["2027-02-17", "2027-02-18", true],
    ["2027-02-18", "2027-02-20", false],
  ]);
  expect(stays[1].name).toBe("Cam tavanlı konaklama");
  const acts = items.filter((i) => i.category === "activity").map((i) => i.name);
  expect(acts).toContain("Husky turu");
  expect(acts).toContain("Kuzey ışığı avı turu");
  expect(acts.some((n) => /fiyort|cam tavanlı/i.test(n))).toBe(false);
  // The reasons stay with the trip, and the trip's chat reads them (omurga Tur 19: "neden 3. gece?").
  const trip = (await (await db()).get("trips", state.tripId!))!;
  expect(trip.spine).toEqual({ rationale: TROMSO.rationale, facts: TROMSO.facts });
  expect(JSON.parse(tripState(trip, items, [])).trip.spine_reasons.rationale).toBe(TROMSO.rationale);
});

it("never overrules what was said: the traveller's own stay keeps its words, only its place among the nights comes from the advice", () => {
  const said = { ...tromso(), specialStays: [{ city: "Tromsø", nights: 1, what: "cam tavanlı kulübe" }], wanted: [{ city: "Tromsø", what: "husky turu", day: null }] };
  const s = applyAdvice(said, TROMSO);
  expect(s.specialStays).toEqual([{ city: "Tromsø", nights: 1, what: "cam tavanlı kulübe", after: 2 }]);
  expect(s.wanted?.map((w) => w.what)).toEqual(["husky turu", "kuzey ışığı avı turu"]);
  expect(s.advice?.legs).toEqual([{ day: 1, mode: "transfer" }, { day: 6, mode: "transfer" }]);
  expect(s.advice?.wishes).toEqual(["Tromsø · Konaklama → cam tavanlı"]);
  expect(applyAdvice(said, null)).toBe(said);
});

const at = (kind: string, date: string, end: string | null = null): ShapedInput => ({ kind, date, end_date: end, time: null, from: null, to: null, city: "Tromsø", title: null, booked: false, note: null }) as ShapedInput;
const trip = (travel: ShapedInput[] = []) => ({ dates: { start: "2027-02-15", end: "2027-02-20" }, travel, stays: [] }) as unknown as Creation;

it("one way per leg: a rental car and the airport bus on its days never both", () => {
  const bus = at("bus", "2027-02-15");
  const car = at("car_rental", "2027-02-15", "2027-02-20");
  // No advice: the car covers the airport way.
  expect(oneWay([bus, car], trip(), null).map((x) => x.kind)).toEqual(["car_rental"]);
  // The advisor chose no car (Tromsø in winter): the car the model opened goes, the bus stays.
  expect(oneWay([bus, car], trip(), { legs: [{ day: 1, mode: "bus" }], rationale: "", facts: [] }).map((x) => x.kind)).toEqual(["bus"]);
  // Napoli: a transfer on day 1, the car (the road trip's own) from day 3: both, each on its days.
  const napoli = { legs: [{ day: 1, mode: "transfer" }, { day: 3, mode: "car_rental" }], rationale: "", facts: [] };
  expect(oneWay([at("transfer", "2027-02-15")], trip([car]), napoli).map((x) => x.kind)).toEqual(["transfer"]);
});

it("asked again when the checklist knows more; the newest answer is the one used, a late one is not waited for", async () => {
  const answers: string[] = [];
  const model = (rationale: string, ms = 0) => async () =>
    ({ generateJson: async (_s: string, prompt: string) => (answers.push(prompt), await new Promise((r) => setTimeout(r, ms)), { ...TROMSO, rationale }) }) as unknown as LlmProvider;
  adviseStart({ id: "a", text: "Tromsø 5 gece", known: "Nereye: Tromsø", today: "2026-10-31", lang: "tr" }, model("ilk"));
  adviseStart({ id: "a", text: "Tromsø 5 gece", known: "Nereye: Tromsø", today: "2026-10-31", lang: "tr" }, model("aynı"));
  await new Promise((r) => setTimeout(r, 0));
  expect(answers).toHaveLength(1);
  adviseStart({ id: "a", text: "Tromsø 5 gece", known: "Nereye: Tromsø\nKimle: çocuklarla", today: "2026-10-31", lang: "tr" }, model("yeni"));
  expect((await adviceFor("a", 1000))?.rationale).toBe("yeni");
  expect(answers[1]).toContain("çocuklarla");
  expect(await adviceFor("b", 1000)).toBeNull();
  adviseStart({ id: "c", text: "x", known: "Nereye: Tromsø", today: "2026-10-31", lang: "tr" }, model("geç", 500));
  expect(await adviceFor("c", 20)).toBeNull();
});

const bali = (travel: ShapedInput[] = []) =>
  ({
    dates: { start: "2027-05-01", end: "2027-05-15" },
    road: false,
    travel,
    stays: [
      { kind: "stay", city: "Ubud", date: "2027-05-01", end_date: "2027-05-08" },
      { kind: "stay", city: "Uluwatu", date: "2027-05-08", end_date: "2027-05-15" },
    ],
  }) as unknown as Creation;
const way = (kind: string, date: string, end: string | null, from: string | null, to: string | null, title: string | null = null) =>
  ({ kind, date, end_date: end, time: null, from, to, city: null, title, booked: false, note: null }) as ShapedInput;

it("Bali, two stops: in from where the flight lands, home from the last stop, no second card for the change of city, the motorbike one per stop", () => {
  const flights = [way("flight", "2027-05-01", null, "İstanbul", "Denpasar"), way("flight", "2027-05-15", null, "Denpasar", "İstanbul")];
  const cards = [
    way("taxi", "2027-05-01", null, "Ubud Havalimanı", "Konaklama"),
    way("transfer", "2027-05-01", "2027-05-15", null, null, "Ubud-Uluwatu özel transfer"),
    way("taxi", "2027-05-08", null, null, null, "Ubud → Uluwatu transferi"),
    way("taxi", "2027-05-15", null, "Ubud", "Denpasar"),
    way("moto_rental", "2027-05-01", "2027-05-15", null, null, "Motosiklet kiralama"),
  ];
  const fitted = fitStops(cards, bali(flights));
  expect(fitted.map((x) => [x.kind, x.date, x.from, x.to])).toEqual([
    ["taxi", "2027-05-01", "Denpasar", "Ubud"],
    ["taxi", "2027-05-15", "Uluwatu", "Denpasar"],
    ["moto_rental", "2027-05-01", null, null],
  ]);
  // No advice: the motorbike stays, one per stop on its days.
  const motos = oneWay(fitted, bali(flights), null).filter((x) => x.kind === "moto_rental");
  expect(motos.map((x) => [x.title, x.date, x.end_date])).toEqual([
    ["Motosiklet kiralama · Ubud", "2027-05-01", "2027-05-08"],
    ["Motosiklet kiralama · Uluwatu", "2027-05-08", "2027-05-15"],
  ]);
  // A honeymoon the advisor gave transfers only: no motorbike.
  const honeymoon = { legs: [{ day: 1, mode: "transfer" }, { day: 8, mode: "transfer" }, { day: 15, mode: "transfer" }], rationale: "", facts: [] };
  expect(oneWay(fitted, bali(flights), honeymoon).some((x) => x.kind === "moto_rental")).toBe(false);
});

it("the summary asks the advisor's question, not the reading's asked before the route was agreed", () => {
  const s = applyAdvice({ ...tromso(), spineQuestion: "Ubud'da kaç gece kalıp Uluwatu'ya geçelim?" }, TROMSO);
  expect(s.spineQuestion).toBe("Kuzey ışıklarını rehberli bir turla mı kovalayalım?");
});

it("never asks first about what the plan decided itself: the nights, the route, the special night, the ways", () => {
  const nights = { ...TROMSO, question: { text: "Ubud'daki ormana bakan villada kaç gece kalmak istersiniz?", topic: "nights" as const, choices: ["3 gece", "7 gece"] } };
  expect(applyAdvice(tromso(), nights).spineQuestion).toBeUndefined();
  const read = acceptExtraction({ spine_question: "Ubud'da kaç gece kalıp Uluwatu'ya geçelim?", spine_topic: "nights" } as never, "2026-10-31");
  expect(read.spineQuestion).toBeUndefined();
  const good = acceptExtraction({ spine_question: "Husky turu yarım gün mü olsun, tam gün mü?", spine_topic: "main_experience" } as never, "2026-10-31");
  expect(good.spineQuestion).toBe("Husky turu yarım gün mü olsun, tam gün mü?");
});

it("the start's title is the one made, even when another trip has it (no month put on it)", async () => {
  setLang("tr");
  const titles: string[] = [];
  for (const id of ["t1", "t2"]) {
    let state: StartState = { ...tromso(), id };
    for (const step of stepsFor(state, creationOf(state)!)) {
      const { tripId } = await runStep(step.id, state, { provider: "gemini" });
      if (step.id === "trip") state = { ...state, tripId };
    }
    titles.push((await (await db()).get("trips", state.tripId!))!.title);
  }
  expect(titles[1]).toBe(titles[0]);
  expect(titles[1]).not.toMatch(/Şubat|2027/);
});
