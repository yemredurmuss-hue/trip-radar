// tests/ownStayPipeline.test.ts: the real making of the trip (its steps, the database) keeps a stay asked for in words as
// its own record, marked so the board's search never fills it, beside the city's other nights; the activity asked for is a
// record too (omurga 2026-10-31).
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { listItems } from "../src/lib/db";
import { holdsOwnStay } from "../src/lib/autoSearch";
import { setLang } from "../src/lib/i18n";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { applyAnswer, creationOf, newStart, type StartState } from "../src/lib/startTrip";

it("Tromsø: 1 night cabin (held from the search) + 4 nights, and the husky tour", async () => {
  setLang("tr");
  let s = applyAnswer(newStart("tp", "plan", 1, "tr"), { q: "where", place: "Tromsø", country: "Norveç", code: "NO" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 5 } }, 3);
  s = applyAnswer(s, { q: "start", date: "2027-02-15", approx: false }, 4);
  let state: StartState = { ...s, from: "İstanbul", who: { kind: "partner", names: [] }, specialStays: [{ city: "Tromsø", nights: 1, what: "cam tavanlı kulübe" }], wanted: [{ city: "Tromsø", what: "husky turu", day: null }] };
  for (const step of stepsFor(state, creationOf(state)!)) {
    const { tripId } = await runStep(step.id, state, { provider: "gemini" });
    if (step.id === "trip") state = { ...state, tripId };
  }
  const items = await listItems(state.tripId!);
  const stays = items.filter((i) => i.category === "stay").sort((a, b) => (a.dates.start ?? "").localeCompare(b.dates.start ?? ""));
  expect(stays.map((i) => [i.name, i.dates.start, i.dates.end, holdsOwnStay(i)])).toEqual([
    ["Cam tavanlı kulübe", "2027-02-15", "2027-02-16", true],
    ["Konaklama · Tromsø", "2027-02-16", "2027-02-20", false],
  ]);
  expect(items.some((i) => i.category === "activity" && i.name === "Husky turu")).toBe(true);
});
