// tests/japanWays.test.ts: Emre's Japan (2026-10-31): the Shinkansen card is a train, on the day they change city, so the
// change of city takes it (one card); a night in a ryokan the advisor wrote as a hotel is a stay of its own, and the ways in
// and out of it say its name.
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { applyAdvice, type Advice } from "../src/lib/advisor";
import { modeOfText } from "../src/lib/cardKinds";
import { db, listItems } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem } from "../src/lib/planned";
import { fitStops, runStep, stepsFor, typedWays, type ShapedInput } from "../src/lib/startCreate";
import { applyAnswer, creationOf, newStart, type StartState } from "../src/lib/startTrip";

function japan(id: string): StartState {
  let s = applyAnswer(newStart(id, "plan", 1, "tr"), { q: "where", place: "Japonya", country: "Japonya", code: "JP" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 7 } }, 3);
  s = applyAnswer(s, { q: "start", date: "2026-11-24", approx: false }, 4);
  return { ...s, from: "İstanbul", who: { kind: "partner", names: [] }, route: { stops: [{ city: "Tokyo", nights: 3, code: "JP" }, { city: "Kyoto", nights: 4, code: "JP" }], arrive: null, leave: null, confirmed: true, source: "user" } };
}

it("'Shinkansen' is a train", () => {
  expect(modeOfText("Tokyo-Kyoto Shinkansen bileti")).toBe("train");
});

it("the Shinkansen card written as 'other' over the stay becomes the train of the day they change city, Tokyo → Kyoto", () => {
  setLang("tr");
  const c = creationOf(japan("jw1"))!;
  const card = { kind: "other", title: "Tokyo-Kyoto Shinkansen bileti", date: "2026-11-24", end_date: "2026-12-01", time: null, from: null, to: null, city: null, booked: false, note: null } as unknown as ShapedInput;
  expect(fitStops(typedWays([card]), c)).toEqual([expect.objectContaining({ kind: "train", date: "2026-11-27", end_date: null, from: "Tokyo", to: "Kyoto" })]);
});

it("the change of city takes that train as its own way (one card, not two)", async () => {
  setLang("tr");
  let s = japan("jw2");
  for (const step of stepsFor(s, creationOf(s)!)) {
    if (step.id === "suggestions") continue;
    const { tripId } = await runStep(step.id, s, { provider: "gemini" });
    if (step.id === "trip") s = { ...s, tripId };
  }
  const train = plannedItem({ kind: "train", title: "Tokyo-Kyoto Shinkansen bileti", date: "2026-11-27", end_date: null, time: null, from: "Tokyo", to: "Kyoto", city: null, booked: false, note: null }, s.tripId!, "jw2-train", 1);
  const items = [...(await listItems(s.tripId!)), train];
  const trip = (await (await db()).get("trips", s.tripId!))!;
  const move = buildLegs(buildPlan(trip, items), trip).find((l) => l.kind === "move")!;
  expect(move.options.map((i) => i.id)).toContain("jw2-train");
});

it("a ryokan night written as a hotel is a stay of its own; the ways in and out of it say 'Ryokan'", async () => {
  setLang("tr");
  const advice: Advice = {
    rationale: "", facts: [], wishes: [], anchors: [], legs: [],
    stays: [
      { place: "Tokyo", nights: 3, kind: "hotel", what: null, source: "assumed" },
      { place: "Kyoto", nights: 3, kind: "hotel", what: null, source: "assumed" },
      { place: "Kyoto", nights: 1, kind: "hotel", what: "ryokan", source: "user" },
    ],
    question: { text: "Tapınaklar mı yemek mi?", topic: "main_experience", choices: [] },
  };
  let s = applyAdvice(japan("jw3"), advice);
  expect(s.specialStays).toEqual([{ city: "Kyoto", nights: 1, what: "ryokan", after: 3 }]);
  for (const step of stepsFor(s, creationOf(s)!)) {
    if (step.id === "suggestions") continue;
    const { tripId } = await runStep(step.id, s, { provider: "gemini" });
    if (step.id === "trip") s = { ...s, tripId };
  }
  const items = await listItems(s.tripId!);
  const trip = (await (await db()).get("trips", s.tripId!))!;
  const changes = buildLegs(buildPlan(trip, items), trip).filter((l) => l.kind === "change");
  expect(changes.map((l) => `${l.date} ${l.from.label} → ${l.to.label}`)).toEqual(["2026-11-30 Kyoto konaklaması → Ryokan"]);
});
