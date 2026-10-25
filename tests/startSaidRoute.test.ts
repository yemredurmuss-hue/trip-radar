// 0.39.10 (Emre, 2026-10-20): "Kasım sonunda 10 gün Japonya: önce Tokyo'da 3 gece, sonra Kyoto'da kızıl yapraklar ve bir
// gece ryokan" became "Tek durak öneriyorum: Tokyo 9 gece". The stops said are the route, said back as theirs; a stop's
// nights never become the trip's length; the part of the month is read; "evet" typed agrees; the model sees the chat.
import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import {
  acceptExtraction, applyAnswer, applyExtracted, applyText, historyOf, mergeExtracted, newStart, nextQuestion, parseStartText, questionOf, turnPrompt,
  type RawExtraction, type StartState,
} from "../src/lib/startTrip";

const TODAY = "2026-10-20";
const FIRST = "Kasım sonunda 10 gün Japonya: önce Tokyo'da 3 gece, sonra Kyoto'da kızıl yapraklar ve bir gece ryokan.";
const ctx = { myName: null, fromGuess: null, today: TODAY };
const raw = (over: Partial<RawExtraction>): RawExtraction => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
});
// What the model reads of the first message (its words, as the schema asks).
const modelFirst = raw({
  destination: "Japonya", destination_country: "Japonya", destination_country_code: "JP", start_month: 11, start_part: "end", duration_days: 10, styles: ["culture", "nature"],
  stops: [{ place: "Tokyo", nights: 3, note: "" }, { place: "Kyoto", nights: 0, note: "kızıl yapraklar, 1 gece ryokan" }],
});

beforeEach(() => setLang("tr"));

function firstTurn(): StartState {
  const s = { ...newStart("t", "plan", 1, "tr"), messages: [{ role: "user" as const, text: FIRST, at: 1 }] };
  const code = parseStartText(FIRST, TODAY, null);
  return applyText(s, FIRST, mergeExtracted(code, acceptExtraction(modelFirst, TODAY)), 2, null).state;
}

describe("the code's reading of a route said in words", () => {
  it("the trip's length is the 10 days, never a stop's nights; the end of November is read", () => {
    const e = parseStartText(FIRST, TODAY);
    expect(e.duration).toEqual({ unit: "day", n: 10 });
    expect(e.start).toMatchObject({ approx: true, part: "end", date: "2026-11-24" });
  });
  it("a correction naming stops sets no length: \"önce Tokyo'da 3 gece, sonra Kyoto'da ve bir gece ryokan\"", () => {
    expect(parseStartText("önce Tokyo'da 3 gece, sonra Kyoto'da ve bir gece ryokan.", TODAY).duration).toBeNull();
  });
  it("one place with its nights is still the length", () => {
    expect(parseStartText("Porto'da 10 gece", TODAY).duration).toEqual({ unit: "night", n: 10 });
  });
  it("the part of the month, in its ways", () => {
    expect(parseStartText("Kasım ortasında Roma", TODAY).start).toMatchObject({ part: "mid", date: "2026-11-15" });
    expect(parseStartText("Kasım'ın başında Roma", TODAY).start).toMatchObject({ part: "begin", date: "2026-11-01" });
    expect(parseStartText("Rome in late November", TODAY).start).toMatchObject({ part: "end" });
    expect(parseStartText("Kasım'da Roma", TODAY).start).toEqual({ date: "2026-11-01", approx: true });
  });
});

describe("the stops said are the route (Emre's Japan)", () => {
  it("Japan is where, the route is theirs: Tokyo 3 as said, Kyoto the rest with what was said of it", () => {
    const s = firstTurn();
    expect(s.where?.place).toBe("Japonya");
    expect(s.route).toMatchObject({ source: "user", confirmed: false });
    expect(s.route!.stops.map((x) => [x.city, x.nights, x.said])).toEqual([["Tokyo", 3, true], ["Kyoto", 6, false]]);
    expect(s.route!.stops[1].note).toBe("kızıl yapraklar, 1 gece ryokan");
  });
  it("what of a stop's note can be seen is kept as its photo search (2026-10-25: \"kızıl yapraklı bir şey gelmiyor\")", () => {
    const s0 = { ...newStart("t", "plan", 1, "tr"), messages: [{ role: "user" as const, text: FIRST, at: 1 }] };
    const said = raw({ ...modelFirst, stops: [{ place: "Tokyo", nights: 3, note: "", photo: "" }, { place: "Kyoto", nights: 0, note: "kızıl yapraklar, 1 gece ryokan", photo: "autumn leaves" }] });
    const s = applyText(s0, FIRST, mergeExtracted(parseStartText(FIRST, TODAY, null), acceptExtraction(said, TODAY)), 2, null).state;
    expect(s.route!.stops.map((x) => x.scene ?? null)).toEqual([null, "autumn leaves"]);
  });
  it("asked back as theirs, the nights worked out said as mine; never \"Tek durak\"", () => {
    const s = { ...firstTurn(), wantDone: true, start: { date: "2026-11-24", approx: false } };
    expect(nextQuestion(s)).toBe("route");
    const q = questionOf(s, "route", ctx);
    expect(q.text).toBe("Rotanı şöyle aldım: Tokyo 3 gece → Kyoto 6 gece (kızıl yapraklar, 1 gece ryokan). Bu olsun mu?");
    expect(q.hint).toContain("Kyoto için geceleri ben böldüm");
    expect(q.text).not.toContain("Tek durak");
  });
  it("the length changed: the nights said stay, the rest follow", () => {
    const s = applyExtracted(firstTurn(), { ...parseStartText("12 gün olsun", TODAY) }, 3);
    expect(s.route!.stops.map((x) => [x.city, x.nights])).toEqual([["Tokyo", 3], ["Kyoto", 8]]);
  });
  it("a stop changed later (the model's whole list again): the route follows, no stop lost", () => {
    const later = acceptExtraction(raw({ stops: [{ place: "Tokyo", nights: 4, note: "" }, { place: "Kyoto", nights: 0, note: "kızıl yapraklar" }, { place: "Hakone", nights: 1, note: "ryokan" }] }), TODAY);
    const s = applyExtracted(firstTurn(), later, 3);
    expect(s.route!.stops.map((x) => [x.city, x.nights])).toEqual([["Tokyo", 4], ["Kyoto", 4], ["Hakone", 1]]);
  });
  it("\"evet\" typed to the route agrees, as the chip", () => {
    const s = { ...firstTurn(), wantDone: true, start: { date: "2026-11-24", approx: false } };
    const r = applyText(s, "evet", parseStartText("evet", TODAY), 3, "route");
    expect(r.understood).toBe(true);
    expect(r.state.route?.confirmed).toBe(true);
  });
  it("agreed, then the same said again: still agreed", () => {
    const agreed = applyAnswer({ ...firstTurn(), wantDone: true }, { q: "route", action: "accept" }, 3);
    expect(applyExtracted(agreed, acceptExtraction(modelFirst, TODAY), 4).route?.confirmed).toBe(true);
  });
});

describe("the model sees the chat", () => {
  it("the earlier lines go with the message, the route in what's known", () => {
    const s = firstTurn();
    const prompt = turnPrompt({ text: "evet kyoto ve ryokan da var", today: TODAY, pending: "route", next: null, known: "Rota: Tokyo 3 gece → Kyoto 6 gece", history: historyOf(s) });
    expect(prompt).toContain(`- ${FIRST}`);
    expect(prompt).toContain("Rota: Tokyo 3 gece");
  });
});

describe("0.39.12: the code reads the route itself (the model out: its free quota spent)", () => {
  it("Emre's sentence, without the model: Japan, Tokyo 3 as said, Kyoto the rest; never \"Tek durak\"", () => {
    const e = parseStartText(FIRST, TODAY);
    expect(e.where).toMatchObject({ place: "Japonya", code: "JP" });
    expect(e.stops).toEqual([{ city: "Tokyo", nights: 3, note: null }, { city: "Kyoto", nights: null, note: null }]);
    const s = applyText({ ...newStart("t", "plan", 1, "tr"), messages: [] }, FIRST, mergeExtracted(e, null), 2, null).state;
    expect(s.route?.stops.map((x) => [x.city, x.nights, x.said])).toEqual([["Tokyo", 3, true], ["Kyoto", 6, false]]);
    expect(questionOf({ ...s, wantDone: true }, "route", ctx).text).toMatch(/^Rotanı şöyle aldım: Tokyo 3 gece → Kyoto 6 gece\./);
  });
  it("in English too, the nights before the city", () => {
    setLang("en");
    const e = parseStartText("10 days in Japan: 3 nights in Tokyo, then Kyoto", TODAY);
    expect(e.stops?.map((x) => [x.city, x.nights])).toEqual([["Tokyo", 3], ["Kyoto", null]]);
  });
  it("cities in different countries, or no route said: no stops from the code", () => {
    expect(parseStartText("Tokyo ve Kyoto çok güzelmiş", TODAY).stops).toBeUndefined();
    expect(parseStartText("önce Roma sonra Paris", TODAY).stops).toBeUndefined();
  });
});
