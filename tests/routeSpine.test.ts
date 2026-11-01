// tests/routeSpine.test.ts: one brain draws the spine (omurga Tur 22, Emre's month through Thailand, Laos and Cambodia:
// Bangkok 4 · Chiang Mai 5 · Luang Prabang 5 · Siem Reap 17, no way between them). The code judges the advisor's route by
// rules that hold for any trip (the nights add up, every country named is on it, one stop per 3 nights at most, no stop of
// its own more than half the trip, a way for every change), the route proposal is the advisor's with the way to each stop,
// and those ways become the plan's cards on the days they change.
import { expect, it } from "vitest";
import { applyAdvice, routeAfterDrawing, routeFaults, routeOfAdvice, type Advice } from "../src/lib/advisor";
import { setLang } from "../src/lib/i18n";
import { stopWays } from "../src/lib/startCreate";
import { acceptRoute, applyAnswer, checklist, creationOf, maxStops, newStart, nextQuestion, otherCountries, routeForGenerate, routeShaped, routeToPrepare, tripPlaceName, waysText, withPreparedRoute, type StartState } from "../src/lib/startTrip";

const SAID = "1 aylık tayland laos kamboçya rotası planı yap backpacking";
const stay = (place: string, nights: number, country_code: string) => ({ place, country_code, nights, kind: "hotel" as const, what: null, source: "assumed" as const });
const leg = (from: string, to: string, day: number, mode: Advice["legs"][number]["mode"], note = "") => ({ from, to, day, mode, note, source: "assumed" as const });
const base = { rationale: "", anchors: [], facts: [], wishes: [], arrival_airport_city: "Bangkok", departure_airport_city: "", question: { text: "Ne?", topic: "main_experience" as const, choices: [] } };

const HEAPED: Advice = { ...base, stays: [stay("Bangkok", 4, "TH"), stay("Chiang Mai", 5, "TH"), stay("Luang Prabang", 5, "LA"), stay("Siem Reap", 17, "KH")], legs: [] };
const GOOD: Advice = {
  ...base,
  stays: [stay("Bangkok", 3, "TH"), stay("Chiang Mai", 4, "TH"), stay("Pai", 3, "TH"), stay("Pakbeng", 1, "LA"), stay("Luang Prabang", 4, "LA"), stay("Vang Vieng", 3, "LA"), stay("Siem Reap", 4, "KH"), stay("Phnom Penh", 3, "KH"), stay("Kampot", 6, "KH")],
  legs: [
    leg("Bangkok", "Chiang Mai", 4, "night_train", "gece treni, 12 saat"), leg("Chiang Mai", "Pai", 8, "bus"), leg("Pai", "Pakbeng", 11, "boat", "Huay Xai sınırından yavaş tekne, 1. gün"),
    leg("Pakbeng", "Luang Prabang", 12, "boat", "yavaş tekne, 2. gün"), leg("Luang Prabang", "Vang Vieng", 16, "train"), leg("Vang Vieng", "Siem Reap", 19, "flight"),
    leg("Siem Reap", "Phnom Penh", 23, "bus"), leg("Phnom Penh", "Kampot", 26, "bus"),
  ],
};

it("Emre's route breaks the rules any trip is judged by: a stop of more than half the trip, no ways", () => {
  setLang("tr");
  const faults = routeFaults(HEAPED, SAID, 31, "İstanbul");
  expect(faults).toContain("Siem Reap gezinin yarısından fazlası (17 gece)");
  expect(faults.filter((f) => f.endsWith("arası yol yok"))).toHaveLength(3);
});

it("a country named and left out is a fault; where they leave from never is", () => {
  setLang("tr");
  const noLaos = { ...GOOD, stays: GOOD.stays.map((x) => (x.country_code === "LA" ? { ...x, country_code: "TH" } : x)) };
  expect(routeFaults(noLaos, SAID, 31, "İstanbul")).toContain("söylenen ülke rotada yok: laos");
  expect(routeFaults(GOOD, "Türkiye'den Japonya'ya 10 gece", 31, "Türkiye").some((f) => f.includes("türkiye"))).toBe(false);
});

it("the known circuit holds: no fault, nine stops for a month", () => {
  setLang("tr");
  expect(routeFaults(GOOD, SAID, 31, "İstanbul")).toEqual([]);
  expect(maxStops(31)).toBe(12);
  expect(maxStops(21)).toBe(8);
  expect(maxStops(7)).toBe(4);
});

it("the advisor's route is the proposal, with the way to each stop said under it", () => {
  setLang("tr");
  const route = routeOfAdvice(GOOD, 31, "İstanbul", "TH")!;
  expect(route.stops.map((x) => `${x.city} ${x.nights}`)).toEqual(["Bangkok 3", "Chiang Mai 4", "Pai 3", "Pakbeng 1", "Luang Prabang 4", "Vang Vieng 3", "Siem Reap 4", "Phnom Penh 3", "Kampot 6"]);
  expect(route.stops[1].way).toEqual({ mode: "night_train", note: "gece treni, 12 saat" });
  expect(waysText(route)).toMatch(/^Yol: Bangkok → Chiang Mai: gece treni, 12 saat · Chiang Mai → Pai: otobüs/);
  expect(route.arrive).toBe("Bangkok");
});

it("a long trip's proposal of seven stops is kept (four was the most: the model's good route was thrown away)", () => {
  const raw = { stops: [["Bangkok", 3, "TH"], ["Chiang Mai", 4, "TH"], ["Pai", 4, "TH"], ["Luang Prabang", 5, "LA"], ["Vang Vieng", 5, "LA"], ["Phnom Penh", 4, "KH"], ["Siem Reap", 6, "KH"]].map(([city, nights, country_code]) => ({ city: city as string, nights: nights as number, country_code: country_code as string })), arrival_airport_city: "Bangkok", departure_airport_city: "Siem Reap" };
  expect(acceptRoute(raw, 31, "İstanbul", "TH")?.stops).toHaveLength(7);
  expect(acceptRoute({ ...raw, stops: raw.stops.slice(0, 5).map((x) => ({ ...x, nights: 2 })) }, 10, "İstanbul", "TH")).toBeNull();
});

it("the ways become the plan's cards on the days they change (the slow boat a ferry, the night train a train)", () => {
  setLang("tr");
  let s: StartState = applyAnswer(newStart("rs1", "plan", 1, "tr"), { q: "where", place: "Tayland", country: "Tayland", code: "TH" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 31 } }, 3);
  s = applyAnswer(s, { q: "start", date: "2027-01-01", approx: false }, 4);
  s = { ...s, from: "İstanbul", route: { ...routeOfAdvice(GOOD, 31, "İstanbul", "TH")!, confirmed: true } };
  const ways = stopWays(s, creationOf(s)!, []);
  expect(ways.find((x) => x.to === "Chiang Mai")).toMatchObject({ kind: "train", date: "2027-01-04", from: "Bangkok", note: "gece treni, 12 saat" });
  expect(ways.find((x) => x.to === "Pakbeng")).toMatchObject({ kind: "ferry", date: "2027-01-11" });
  expect(ways.find((x) => x.to === "Siem Reap")).toMatchObject({ kind: "flight" });
  expect(ways).toHaveLength(8);
  // A card the kind made between those two stops is that way already: never a second one.
  expect(stopWays(s, creationOf(s)!, [{ kind: "bus", date: null, end_date: null, time: null, from: "Bangkok", to: "Chiang Mai", city: null, title: null, booked: false, note: null }])).toHaveLength(7);
});

it("a city come back to for the flight home is a fault, and its nights go to the stop before it", () => {
  setLang("tr");
  const peru: Advice = { ...base, stays: [stay("Lima", 2, "PE"), stay("Cusco", 6, "PE"), stay("Puno", 3, "PE"), stay("La Paz", 4, "BO"), stay("Uyuni", 4, "BO"), stay("Lima", 2, "PE")], legs: [leg("Lima", "Cusco", 3, "flight"), leg("Cusco", "Puno", 9, "bus"), leg("Puno", "La Paz", 12, "bus"), leg("La Paz", "Uyuni", 16, "night_bus"), leg("Uyuni", "Lima", 20, "flight")] };
  expect(routeFaults(peru, "Peru ve Bolivya 3 hafta", 21, "İstanbul")).toEqual(["Lima rotada iki kez geçiyor (dönüş uçuşu için departure_airport_city yeter)"]);
  expect(routeOfAdvice(peru, 21, "İstanbul", "PE")!.stops.map((x) => `${x.city} ${x.nights}`)).toEqual(["Lima 2", "Cusco 6", "Puno 3", "La Paz 4", "Uyuni 6"]);
});

it("the advisor's stay in a country the agreed route doesn't go to is never folded into a stop", () => {
  setLang("tr");
  let s: StartState = applyAnswer(newStart("rs2", "plan", 1, "tr"), { q: "where", place: "Peru", country: "Peru", code: "PE" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 21 } }, 3);
  s = { ...s, route: { stops: [{ city: "Lima", nights: 4 }, { city: "Arequipa", nights: 6 }, { city: "Cusco", nights: 7 }, { city: "Urubamba", nights: 4 }], arrive: null, leave: null, confirmed: true, source: "ai" } };
  const uyuni = { place: "Uyuni", country_code: "BO", nights: 4, kind: "special" as const, what: "tuz çölünde konaklamalı tur", source: "user" as const };
  expect(applyAdvice(s, { ...base, stays: [stay("Lima", 4, "PE"), stay("Cusco", 13, "PE"), uyuni], legs: [] }).specialStays).toEqual([]);
});

it("the flight home from elsewhere than the last stop: a fault without the way there, a card with it", () => {
  setLang("tr");
  const kampot = { ...GOOD, departure_airport_city: "Bangkok" };
  expect(routeFaults(kampot, SAID, 31, "İstanbul")).toEqual(["dönüş uçuşu Bangkok havalimanından; Kampot → Bangkok yolu yok"]);
  const withWay = { ...kampot, legs: [...GOOD.legs, leg("Kampot", "Bangkok", 32, "bus", "sınırdan otobüs, 12 saat")] };
  expect(routeFaults(withWay, SAID, 31, "İstanbul")).toEqual([]);
  let s: StartState = applyAnswer(newStart("rs3", "plan", 1, "tr"), { q: "where", place: "Tayland", country: "Tayland", code: "TH" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 31 } }, 3);
  s = applyAnswer(s, { q: "start", date: "2027-01-01", approx: false }, 4);
  s = { ...s, from: "İstanbul", route: { ...routeOfAdvice(withWay, 31, "İstanbul", "TH")!, confirmed: true } };
  expect(stopWays(s, creationOf(s)!, []).at(-1)).toMatchObject({ kind: "bus", date: "2027-02-01", from: "Kampot", to: "Bangkok" });
});

// --- Tur 22c: what shapes the route first, the advisor behind the questions, the route agreed last -------------------

const thai = (id: string) => {
  let s: StartState = applyAnswer(newStart(id, "plan", 1, "tr"), { q: "where", place: "Tayland", country: "Tayland", code: "TH" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "month", n: 1 } }, 3);
  const out: StartState = { ...s, messages: [{ role: "user", text: SAID, at: 1 }] };
  return out;
};

it("the advisor is asked once the route's own questions are answered: the month, what they're after, who goes", () => {
  setLang("tr");
  let s = thai("rs4");
  expect(nextQuestion(s)).toBe("start");
  s = applyAnswer(s, { q: "start", date: "2027-03-01", approx: true }, 4);
  expect(nextQuestion(s)).toBe("want");
  expect(routeShaped(s)).toBe(false);
  expect(routeToPrepare(s)).toBeNull();
  s = applyAnswer(s, { q: "want", styles: ["adventure"], budget: "low" }, 5);
  expect(nextQuestion(s)).toBe("who");
  s = applyAnswer(s, { q: "who", kind: "solo" }, 6);
  expect(routeShaped(s)).toBe(true);
  expect(routeToPrepare(s)).toBe("tayland|TH|31");
  // The day and where from are asked while it draws; the route comes last.
  expect(nextQuestion(s)).toBe("day");
});

it("nothing stands in while it draws; its route, drawn for a month, follows a day said after it by a night", () => {
  setLang("tr");
  let s = applyAnswer(applyAnswer(applyAnswer(thai("rs5"), { q: "start", date: "2027-03-15", approx: true }, 4), { q: "want", styles: ["adventure"], budget: "low" }, 5), { q: "who", kind: "solo" }, 6);
  expect(s.route ?? null).toBeNull();
  s = withPreparedRoute(s, routeToPrepare(s)!, routeOfAdvice({ ...GOOD, stays: GOOD.stays.map((x) => (x.place === "Kampot" ? { ...x, nights: 5 } : x)) }, 30, null, "TH")!);
  expect(s.route?.stops.reduce((n, x) => n + x.nights, 0)).toBe(30);
  // February: one night fewer, Kampot (the longest stop) gives it; never drawn again.
  const feb = applyAnswer(s, { q: "start", date: "2027-02-01", approx: false }, 7);
  expect(feb.route?.source).toBe("ai");
  expect(feb.route?.stops.reduce((n, x) => n + x.nights, 0)).toBe(28);
});

it("several countries named: the place is said back as all of them, never as the first alone", () => {
  setLang("tr");
  const s = thai("rs6");
  expect(otherCountries(s)).toEqual(["Laos", "Kamboçya"]);
  expect(tripPlaceName(s)).toBe("Tayland, Laos ve Kamboçya");
  expect(checklist(s, { myName: null, today: "2026-11-01" } as never).find((r) => r.id === "where")?.value).toBe("Tayland · Laos · Kamboçya");
  expect(tripPlaceName({ ...s, messages: [{ role: "user", text: "Tayland'a 1 ay", at: 1 }] })).toBe("Tayland");
});

it("Oluştur while it draws: one stop stands in, then the advisor's route (or the classic circuit when none came)", () => {
  setLang("tr");
  const s = applyAnswer(applyAnswer(applyAnswer(thai("rs7"), { q: "start", date: "2027-01-01", approx: false }, 4), { q: "want", styles: ["adventure"], budget: "low" }, 5), { q: "who", kind: "solo" }, 6);
  const standIn = routeForGenerate(s)!;
  expect(standIn).toMatchObject({ drawing: true, proposed: true, stops: [{ city: "Tayland", nights: 31 }] });
  const drawn = routeAfterDrawing({ ...s, route: standIn }, GOOD)!;
  expect(drawn).toMatchObject({ source: "ai", confirmed: true, proposed: true });
  expect(drawn.stops).toHaveLength(9);
  expect(routeAfterDrawing({ ...s, route: standIn }, null)?.source).toBe("circuit");
});
