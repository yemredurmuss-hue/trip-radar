// tests/startTrip.test.ts — starting a trip by chat (spec 2026-10-06 §2): the interview's state machine,
// reading a message with and without the model, the route, what gets made, and the start card.
import { describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import {
  acceptExtraction, acceptRoute, countryCodeOfName, isPlaceholder, placeholderPrint, placeOf, startLead, addMonths, applyAnswer, applyText, askAgain, canGenerate, checklist, creationOf, dative, endOf,
  EMPTY_EXTRACTED, guessOrigin, guideSteps, guideVisible, historyRows, mergeExtracted, monthOf, newStart, nextDate, nextQuestion,
  parseRouteText, parseStartText, peopleCount, progressOf, questionOf, replyText, singleRoute, skip, totalNights, tripNamedIn,
  wantsRouteAdvice, weekendStart, whenText, type RawExtraction, type StartCtx, type StartState,
} from "../src/lib/startTrip";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

setLang("tr");
const TODAY = "2026-10-06";
const ctx: StartCtx = { myName: null, fromGuess: "İstanbul", today: TODAY };
const fresh = (mode: StartState["mode"] = "plan") => newStart("s1", mode, 1);
const typed = (s: StartState, text: string, model: RawExtraction | null = null) =>
  applyText(s, text, mergeExtracted(parseStartText(text, TODAY), model ? acceptExtraction(model, TODAY) : null), 2);

const rawModel = (over: Partial<RawExtraction> = {}): RawExtraction => ({
  destination: "", destination_country: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", destination_country_code: "", ...over,
});

describe("dates and lengths", () => {
  it("a month is a calendar month; the next time a day comes is this year or next", () => {
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-10");
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(endOf("2026-12-10", { unit: "month", n: 1 })).toBe("2027-01-10");
    expect(endOf("2026-12-10", { unit: "week", n: 2 })).toBe("2026-12-24");
    expect(nextDate(12, 10, TODAY)).toBe("2026-12-10");
    expect(nextDate(3, 1, TODAY)).toBe("2027-03-01");
    expect(nextDate(2, 30, TODAY)).toBeNull();
  });
  it("\"10 gün\" is 9 nights, \"10 gece\" 10, a week 7; the checklist says nights", () => {
    expect(totalNights({ start: { date: "2026-12-10", approx: false }, duration: { unit: "day", n: 10 } })).toBe(9);
    expect(whenText({ start: { date: "2026-12-10", approx: false }, duration: { unit: "day", n: 10 } })).toBe("10–19 Aralık · 9 gece");
    expect(parseStartText("Porto'da 10 gece", TODAY).duration).toEqual({ unit: "night", n: 10 });
    expect(totalNights({ start: { date: "2026-12-10", approx: false }, duration: { unit: "night", n: 10 } })).toBe(10);
    expect(totalNights({ start: { date: "2026-12-10", approx: false }, duration: { unit: "week", n: 1 } })).toBe(7);
    expect(totalNights({ start: null, duration: { unit: "day", n: 1 } })).toBe(1);
  });
  it("months by name and abbreviation, never a word that only starts like one", () => {
    expect(monthOf("Aralık")).toBe(12);
    expect(monthOf("ara")).toBe(12);
    expect(monthOf("December")).toBe(12);
    expect(monthOf("ay")).toBeNull();
    expect(monthOf("arada")).toBeNull();
  });
  it("this weekend starts on the coming Friday", () => {
    expect(weekendStart("2026-10-06")).toBe("2026-10-09"); // a Tuesday
    expect(weekendStart("2026-10-09")).toBe("2026-10-09");
    expect(weekendStart("2026-10-10")).toBe("2026-10-09");
    expect(weekendStart("2026-10-06", true)).toBe("2026-10-16");
  });
});

describe("reading a message without the model (the no-key path, item 6)", () => {
  it("\"Sabine'yle 10 Aralık'tan 1 ay Bali\": who, start, length and where in one go", () => {
    const e = parseStartText("Sabine'yle 10 Aralık'tan 1 ay Bali", TODAY);
    expect(e.where).toEqual({ place: "Bali", country: "Endonezya", code: "ID" });
    expect(e.who).toEqual({ kind: null, names: ["Sabine"] });
    expect(e.start).toEqual({ date: "2026-12-10", approx: false });
    expect(e.duration).toEqual({ unit: "month", n: 1 });
    expect(e.from).toBeNull();
  });
  it("where from by its ending, companions by their word, lengths in words, styles and budget", () => {
    const e = parseStartText("İstanbul'dan Porto'ya partnerimle iki hafta, deniz ve gastronomi, ekonomik", TODAY);
    expect(e.from).toBe("İstanbul");
    expect(e.where?.place).toBe("Porto");
    expect(e.who).toEqual({ kind: "partner", names: [] });
    expect(e.duration).toEqual({ unit: "week", n: 2 });
    expect(e.styles).toEqual(["beach", "food"]);
    expect(e.budget).toBe("low");
  });
  it("numeric dates, a month alone, a weekend", () => {
    expect(parseStartText("15.03 ile 10 gün", TODAY).start).toEqual({ date: "2027-03-15", approx: false });
    expect(parseStartText("15.03 ile 10 gün", TODAY).duration).toEqual({ unit: "day", n: 10 });
    expect(parseStartText("Aralık'ta Lizbon", TODAY).start).toEqual({ date: "2026-12-01", approx: true });
    const weekend = parseStartText("bu hafta sonu Bodrum", TODAY);
    expect(weekend.duration).toEqual({ unit: "weekend", n: 1 });
    expect(weekend.start?.date).toBe("2026-10-09");
  });
  it("in English too", () => {
    setLang("en");
    const e = parseStartText("Lisbon with Sabine from London, December 10 for 2 weeks", TODAY);
    expect(e.where?.place).toBe("Lisbon");
    expect(e.from).toBe("London");
    expect(e.who?.names).toEqual(["Sabine"]);
    expect(e.start?.date).toBe("2026-12-10");
    expect(e.duration).toEqual({ unit: "week", n: 2 });
    setLang("tr");
  });
});

describe("reading a message with the model (strict shape, checked)", () => {
  it("keeps what holds: a real future date, a sane length, a place's name, listed styles", () => {
    const e = acceptExtraction(rawModel({ destination: "Ubud'a", origin: "Ankara", companions: "friends", names: ["Ali", "<b>"], start_date: "2026-11-20", duration_days: 9, styles: ["nature", "spa"], budget: "mid" }), TODAY);
    expect(e.where?.place).toBe("Ubud");
    expect(e.from).toBe("Ankara");
    expect(e.who).toEqual({ kind: "friends", names: ["Ali"] });
    expect(e.start).toEqual({ date: "2026-11-20", approx: false });
    expect(e.duration).toEqual({ unit: "day", n: 9 });
    expect(e.styles).toEqual(["nature"]);
    expect(e.budget).toBe("mid");
  });
  it("drops what doesn't: a past date, a 400-day length, a sentence as a place, an unknown budget", () => {
    const e = acceptExtraction(rawModel({ destination: "somewhere nice by the sea with a pool and friends", start_date: "2020-01-01", duration_days: 400, budget: "cheapish", companions: "cats" }), TODAY);
    expect(e).toEqual({ ...EMPTY_EXTRACTED, styles: [] });
  });
  it("the code's dates win; the model fills what the code missed", () => {
    const code = parseStartText("10 Aralık'tan 1 ay Ubud", TODAY);
    const model = acceptExtraction(rawModel({ destination: "Ubud", destination_country: "Endonezya", start_date: "2026-12-11", duration_days: 30, names: ["Sabine"] }), TODAY);
    const merged = mergeExtracted(code, model);
    expect(merged.start?.date).toBe("2026-12-10");
    expect(merged.duration).toEqual({ unit: "month", n: 1 });
    expect(merged.where).toEqual({ place: "Ubud", country: "Endonezya", code: "ID" });
    expect(merged.who?.names).toEqual(["Sabine"]);
  });
});

describe("the interview", () => {
  it("asks only what the first message left out (item 2): from, what you're after, then the route", () => {
    const { state, understood } = typed(fresh(), "Sabine'yle 10 Aralık'tan 1 ay Bali");
    expect(understood).toBe(true);
    expect(nextQuestion(state)).toBe("from");
    const from = applyAnswer(state, { q: "from", city: "İstanbul" }, 3);
    expect(nextQuestion(from)).toBe("want");
    const want = applyAnswer(from, { q: "want", styles: ["nature", "beach"], budget: "mid" }, 4);
    expect(nextQuestion(want)).toBe("route");
    expect(totalNights(want)).toBe(31);
    expect(whenText(want)).toBe("10 Aralık – 10 Ocak · 31 gece");
  });
  it("the full order from nothing, names asked only for a named companion", () => {
    let s = fresh();
    expect(nextQuestion(s)).toBe("where");
    s = applyAnswer(s, { q: "where", place: "Lizbon", country: "Portekiz" }, 2);
    expect(nextQuestion(s)).toBe("from");
    s = applyAnswer(s, { q: "from", city: "İzmir" }, 2);
    s = applyAnswer(s, { q: "who", kind: "partner" }, 2);
    expect(nextQuestion(s)).toBe("names");
    s = typed(s, "Sabine").state;
    expect(s.who).toEqual({ kind: "partner", names: ["Sabine"] });
    expect(nextQuestion(s)).toBe("duration");
    s = applyAnswer(s, { q: "duration", duration: { unit: "week", n: 1 } }, 2);
    expect(nextQuestion(s)).toBe("start");
    s = applyAnswer(s, { q: "start", date: "2026-11-01", approx: true }, 2);
    // A month only: never a day made up; the day is asked next (item 3, the review's decision).
    expect(nextQuestion(s)).toBe("day");
    const day = questionOf(s, "day", ctx);
    expect(day.text).toBe("Kasım ayının hangi günü başlıyor?");
    expect(day.chips.map((c) => [c.label, (c.answer as { date: string }).date])).toEqual([["Ayın başı", "2026-11-01"], ["Ortası", "2026-11-15"], ["Sonu", "2026-11-24"]]);
    const mid = applyAnswer(s, day.chips[1].answer, 3);
    expect(mid.start).toEqual({ date: "2026-11-15", approx: true, part: "mid" });
    expect(replyText(s, mid, ctx)).toBe("15 Kasım'ı başlangıç aldım, değiştirebilirsin. Bu gezide en çok ne istiyorsun? (birden çok seçebilirsin)");
    expect(whenText(mid)).toBe("15–22 Kasım · 7 gece (yaklaşık)");
    const picked = applyAnswer(s, { q: "day", date: "2026-11-09", part: null }, 3);
    expect(picked.start).toEqual({ date: "2026-11-09", approx: false });
    expect(whenText(picked)).toBe("9–16 Kasım · 7 gece");
    s = mid;
    expect(nextQuestion(s)).toBe("want");
    // Solo: no names asked.
    expect(nextQuestion(applyAnswer(fresh(), { q: "who", kind: "solo" }, 2))).toBe("where");
  });
  it("Atla moves on, and a pressed checklist row asks again", () => {
    let s = skip(fresh(), "where", 2);
    expect(nextQuestion(s)).toBe("from");
    s = skip(s, "from", 2);
    expect(nextQuestion(s)).toBe("who");
    s = askAgain(s, "where", 3);
    expect(nextQuestion(s)).toBe("where");
    s = applyAnswer(s, { q: "where", place: "Roma", country: "İtalya" }, 4);
    expect(s.asking).toBeNull();
    expect(nextQuestion(s)).toBe("who");
  });
  it("a bare place typed answers the question on screen (\"İzmir\" to \"Nereden?\")", () => {
    const s = applyAnswer(fresh(), { q: "where", place: "Bali", country: "Endonezya" }, 2);
    const { state } = typed(s, "İzmir", rawModel({ destination: "İzmir" }));
    expect(state.from).toBe("İzmir");
    expect(state.where?.place).toBe("Bali");
    const unknown = typed(s, "Kadıköy");
    expect(unknown.state.from).toBe("Kadıköy");
  });
  it("nothing recognised: not understood, the state stays", () => {
    const s = applyAnswer(fresh(), { q: "where", place: "Bali", country: null }, 2);
    const s2 = applyAnswer(s, { q: "from", city: "İstanbul" }, 2);
    const out = typed(s2, "hmm 123 ???");
    expect(out.understood).toBe(false);
    expect(out.state).toBe(s2);
  });
  it("the destination is all it takes to generate (revision 2, item 4); the rest is asked later", () => {
    expect(canGenerate(fresh())).toBe(false);
    let s = applyAnswer(fresh(), { q: "where", place: "Bali", country: null }, 2);
    expect(canGenerate(s)).toBe(true);
    s = applyAnswer(s, { q: "duration", duration: { unit: "week", n: 1 } }, 2);
    expect(canGenerate(s)).toBe(true);
    s = applyAnswer(s, { q: "start", date: "2026-11-02", approx: false }, 2);
    expect(canGenerate(s)).toBe(true);
    const done = progressOf(checklist(s, ctx));
    expect(done).toEqual({ done: 2, total: 6 });
  });
  it("the reply says back what was understood, then asks the next question", () => {
    const before = fresh();
    const { state } = typed(before, "Sabine'yle 10 Aralık'tan 1 ay Bali");
    expect(replyText(before, state, ctx)).toBe(
      "Sabine ile Bali kulağa harika geliyor: Ubud'un pirinç terasları, tapınaklar ve okyanusta gün batımları. Not aldım: Bali · Sabine ile · 2 kişi · 10 Aralık – 10 Ocak · 31 gece. Nereden yola çıkıyorsun?",
    );
    const where = applyAnswer(before, { q: "where", place: "Bali", country: null }, 2);
    expect(replyText(before, where, ctx)).toBe("Bali kulağa harika geliyor: Ubud'un pirinç terasları, tapınaklar ve okyanusta gün batımları. Nereden yola çıkıyorsun?");
    // A place the small table doesn't know: the plain word.
    const other = applyAnswer(before, { q: "where", place: "Zagreb", country: null }, 2);
    expect(replyText(before, other, ctx)).toBe("Harika, Zagreb! Nereden yola çıkıyorsun?");
  });
  it("quick answers: the origin guess first; lengths and start months asked apart (item 3)", () => {
    const s = applyAnswer(fresh(), { q: "where", place: "Bali", country: null }, 2);
    expect(questionOf(s, "from", { ...ctx, fromGuess: "Ankara" }).chips.map((c) => c.label)).toEqual(["Ankara", "İstanbul", "İzmir", "Antalya"]);
    expect(questionOf(s, "duration", ctx).chips.map((c) => c.label)).toEqual(["Hafta sonu", "1 hafta", "10 gün", "2 hafta", "3 hafta", "1 ay"]);
    const start = questionOf(s, "start", ctx);
    expect(start.chips.map((c) => c.label)).toEqual(["Ekim", "Kasım", "Aralık", "Ocak", "Şubat", "Mart"]);
    expect(start.date).toBe(true);
    expect(questionOf(s, "who", ctx).chips.map((c) => c.label)).toEqual(["Yalnız", "Partnerimle", "Arkadaşlarla", "Ailemle"]);
  });
  it("the last-minute mode offers weekends; inspire asks what you're after first, then places that fit", () => {
    expect(questionOf(fresh("lastminute"), "start", ctx).chips.map((c) => c.label)).toEqual(["Bu hafta sonu", "Gelecek hafta sonu"]);
    const inspire = fresh("inspire");
    expect(nextQuestion(inspire)).toBe("want");
    const after = applyAnswer(inspire, { q: "want", styles: ["beach"], budget: null }, 2);
    expect(nextQuestion(after)).toBe("where");
    expect(questionOf(after, "where", ctx).chips.map((c) => c.label)).toEqual(["Bali", "Phuket", "Maldivler"]);
  });
});

describe("the route (item 1)", () => {
  const ready = () => {
    let s = typed(fresh(), "Sabine'yle 10 Aralık'tan 1 ay Bali").state;
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 2);
    return applyAnswer(s, { q: "want", styles: [], budget: null }, 2);
  };
  it("the model's route is kept only when it holds", () => {
    expect(acceptRoute({ stops: [{ city: "Ubud", nights: 12, country_code: "" }, { city: "Canggu", nights: 10, country_code: "" }, { city: "Uluwatu", nights: 9, country_code: "" }], arrival_airport_city: "Denpasar", departure_airport_city: "Denpasar" }, 31))
      .toEqual({ stops: [{ city: "Ubud", nights: 12 }, { city: "Canggu", nights: 10 }, { city: "Uluwatu", nights: 9 }], arrive: "Denpasar", leave: "Denpasar", confirmed: false, source: "ai" });
    expect(acceptRoute({ stops: [{ city: "Ubud", nights: 12, country_code: "" }, { city: "Canggu", nights: 10, country_code: "" }], arrival_airport_city: "", departure_airport_city: "" }, 31)).toBeNull(); // 22 ≠ 31
    expect(acceptRoute({ stops: [{ city: "Ubud", nights: 31.5, country_code: "" }], arrival_airport_city: "", departure_airport_city: "" }, 31)).toBeNull();
    expect(acceptRoute({ stops: [{ city: "Ubud", nights: 20, country_code: "" }, { city: "ubud", nights: 11, country_code: "" }], arrival_airport_city: "", departure_airport_city: "" }, 31)).toBeNull();
    expect(acceptRoute({ stops: [{ city: "1) Ubud!!", nights: 31, country_code: "" }], arrival_airport_city: "", departure_airport_city: "" }, 31)).toBeNull();
    expect(acceptRoute({ stops: Array.from({ length: 5 }, (_, i) => ({ city: `Yer${"abcde"[i]}`, nights: i === 0 ? 27 : 1, country_code: "" })), arrival_airport_city: "", departure_airport_city: "" }, 31)).toBeNull();
  });
  it("short trips and single cities are one stop; a long trip to an island asks the model", () => {
    expect(wantsRouteAdvice(ready())).toBe(true);
    const city = applyAnswer(ready(), { q: "where", place: "Porto", country: "Portekiz" }, 3);
    expect(wantsRouteAdvice(city)).toBe(false);
    const short = applyAnswer(ready(), { q: "duration", duration: { unit: "weekend", n: 1 } }, 3);
    expect(wantsRouteAdvice(short)).toBe(false);
    expect(singleRoute(short)?.stops).toEqual([{ city: "Bali", nights: 2 }]);
  });
  it("Bu olsun confirms it; Değiştir takes the stops in words; a new length drops a route made for another", () => {
    const route = acceptRoute({ stops: [{ city: "Ubud", nights: 12, country_code: "" }, { city: "Canggu", nights: 19, country_code: "" }], arrival_airport_city: "Denpasar", departure_airport_city: "" }, 31)!;
    const s = { ...ready(), route };
    expect(questionOf(s, "route", ctx).text).toBe("Rota önerim: Ubud 12 · Canggu 19 gece. Bu olsun mu?");
    const ok = applyAnswer(s, { q: "route", action: "accept" }, 3);
    expect(ok.route?.confirmed).toBe(true);
    expect(nextQuestion(ok)).toBeNull();
    const change = applyAnswer(s, { q: "route", action: "change" }, 3);
    expect(change.editingRoute).toBe(true);
    expect(nextQuestion(change)).toBe("route");
    expect(parseRouteText("Ubud 10, Canggu 21", 31)).toEqual({ route: { stops: [{ city: "Ubud", nights: 10 }, { city: "Canggu", nights: 21 }], arrive: null, leave: null, confirmed: true, source: "user" } });
    expect(parseRouteText("Ubud 10 ve Canggu 10", 31)).toEqual({ error: "Geceler toplamı 31 olmalı (yazdığın: 20)." });
    const longer = applyAnswer(ok, { q: "duration", duration: { unit: "week", n: 2 } }, 4);
    // The route agreed for 31 nights is gone; Bali's classic circuit for 14 nights is proposed at once (rev 3).
    expect(longer.route?.source).toBe("circuit");
    expect(longer.route?.confirmed).toBe(false);
    expect(longer.route?.stops.reduce((n, x) => n + x.nights, 0)).toBe(14);
  });
});

describe("what gets made", () => {
  const base = () => {
    let s = typed(fresh(), "Sabine'yle 10 Aralık'tan 1 ay Bali").state;
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 2);
    return applyAnswer(s, { q: "want", styles: ["nature", "beach"], budget: "mid" }, 2);
  };
  it("an unconfirmed route is built as one stop for all the nights", () => {
    const route = acceptRoute({ stops: [{ city: "Ubud", nights: 12, country_code: "" }, { city: "Canggu", nights: 19, country_code: "" }], arrival_airport_city: "Denpasar", departure_airport_city: "Denpasar" }, 31)!;
    const c = creationOf({ ...base(), route })!;
    expect(c.stays.map((x) => [x.city, x.date, x.end_date])).toEqual([["Bali", "2026-12-10", "2027-01-10"]]);
    expect(c.travel.map((x) => [x.kind, x.date, x.from, x.to])).toEqual([
      ["flight", "2026-12-10", "İstanbul", "Denpasar"],
      ["flight", "2027-01-10", "Denpasar", "İstanbul"],
    ]);
  });
  it("a confirmed route: the nights split in order; the flights land where the route says", () => {
    const route = acceptRoute({ stops: [{ city: "Ubud", nights: 12, country_code: "" }, { city: "Canggu", nights: 10, country_code: "" }, { city: "Uluwatu", nights: 9, country_code: "" }], arrival_airport_city: "Denpasar", departure_airport_city: "Denpasar" }, 31)!;
    const c = creationOf({ ...base(), route: { ...route, confirmed: true } })!;
    expect(c.title).toBe("Bali Gezisi");
    expect(c.dates).toEqual({ start: "2026-12-10", end: "2027-01-10" });
    expect(c.stays.map((x) => [x.city, x.date, x.end_date])).toEqual([
      ["Ubud", "2026-12-10", "2026-12-22"],
      ["Canggu", "2026-12-22", "2027-01-01"],
      ["Uluwatu", "2027-01-01", "2027-01-10"],
    ]);
    expect(c.travel.map((x) => `${x.from}→${x.to}`)).toEqual(["İstanbul→Denpasar", "Denpasar→İstanbul"]);
    expect(c.travellers).toEqual({ names: ["Sabine"], count: 2 });
    expect(c.styles).toEqual(["nature", "beach"]);
    // Each stop is in Indonesia; the stops are Bali's (the hero's main place without asking the model).
    expect(c.countries).toEqual({ ubud: { code: "ID", name: "Endonezya" }, canggu: { code: "ID", name: "Endonezya" }, uluwatu: { code: "ID", name: "Endonezya" } });
    expect(c.parents?.parents).toEqual({ ubud: "Bali", canggu: "Bali", uluwatu: "Bali" });
  });
  it("a route across two countries keeps each stop's own; a country's cities stay the main places", () => {
    let s = typed(fresh(), "10 Aralık'tan 2 hafta Portekiz").state;
    s = { ...s, route: { stops: [{ city: "Lizbon", nights: 7, code: "PT" }, { city: "Sevilla", nights: 7, code: "ES" }], arrive: null, leave: null, confirmed: true, source: "ai" } };
    const c = creationOf(s)!;
    expect(c.countries).toEqual({ lizbon: { code: "PT", name: "Portekiz" }, sevilla: { code: "ES", name: null } });
    expect(c.parents).toBeNull();
  });
  it("a road trip has a car for the whole trip instead of flights", () => {
    let s = applyAnswer(fresh("road"), { q: "where", place: "Toskana", country: "İtalya" }, 2);
    s = applyAnswer(s, { q: "duration", duration: { unit: "week", n: 1 } }, 2);
    s = applyAnswer(s, { q: "start", date: "2027-05-01", approx: false }, 2);
    const c = creationOf(s)!;
    expect(c.road).toBe(true);
    expect(c.travel.map((x) => [x.kind, x.city, x.date, x.end_date])).toEqual([["car_rental", "Toskana", "2027-05-01", "2027-05-08"]]);
  });
  it("nothing without where; with only where, an undated stay and flights to fill, the trip without dates", () => {
    expect(creationOf(fresh())).toBeNull();
    const c = creationOf(applyAnswer(fresh(), { q: "where", place: "Bali", country: "Endonezya", code: "ID" }, 2))!;
    expect(c.dates).toBeNull();
    expect(c.stays.map((x) => [x.kind, x.city, x.date, x.end_date])).toEqual([["stay", "Bali", null, null]]);
    expect(c.travel.map((x) => [x.kind, x.from, x.to, x.date])).toEqual([["flight", null, "Denpasar", null]]);
    expect(c.approxStart).toBeNull();
  });
  it("people: one alone, two with a partner, everyone named and the traveller", () => {
    expect(peopleCount({ kind: "solo", names: [] })).toBe(1);
    expect(peopleCount({ kind: "partner", names: [] })).toBe(2);
    expect(peopleCount({ kind: "friends", names: ["Ali", "Can"] })).toBe(3);
    expect(peopleCount({ kind: "family", names: [] })).toBeNull();
  });
});

describe("the conversation becomes the trip's chat (item 8)", () => {
  it("alternates, starts with the traveller, ends with the assistant, in the provider's format", () => {
    const rows = historyRows(
      [
        { role: "assistant", text: "Nereye gidiyoruz?", at: 10 },
        { role: "user", text: "Bali", at: 11 },
        { role: "user", text: "Atla", at: 12 },
        { role: "assistant", text: "Nereden?", at: 13 },
      ],
      "Bali Gezisi hazır.",
      "anthropic",
      "t1",
    );
    expect(rows.map((r) => [r.role, r.text])).toEqual([
      ["user", "Yeni gezi planla"],
      ["assistant", "Nereye gidiyoruz?"],
      ["user", "Bali\n\nAtla"],
      ["assistant", "Nereden?\n\nBali Gezisi hazır."],
    ]);
    expect(rows[0].content).toEqual([{ type: "text", text: "Yeni gezi planla" }]);
    expect(rows.every((r, i) => i === 0 || r.createdAt > rows[i - 1].createdAt)).toBe(true);
    const gemini = historyRows([{ role: "user", text: "Bali", at: 1 }], "Hazır.", "gemini", "t1");
    expect(gemini[0].content).toEqual([{ text: "Bali" }]);
    expect(gemini.map((r) => r.provider)).toEqual(["gemini", "gemini"]);
  });
});

describe("adding to a trip there is, or a new one (item 4)", () => {
  const trip = (over: Partial<Trip>): Trip => ({ id: "t1", title: "x", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over });
  const porto = trip({ id: "pm", title: "Porto ve Madeira Gezisi", updatedAt: 5 });
  it("names the trip whose place the text mentions, by its plans' cities or its title", () => {
    const items = [makeItem({ tripId: "pm", city: "Funchal", category: "stay" })];
    expect(tripNamedIn("Porto'da bir otel daha", [porto], items)?.trip.id).toBe("pm");
    expect(tripNamedIn("Funchal'da tekne turu", [porto], items)?.trip.id).toBe("pm");
    expect(tripNamedIn("Bali'ye 3 hafta", [porto], items)).toBeNull();
    expect(tripNamedIn("Porto'da otel", [trip({ id: "demo", title: "Portekiz (örnek)", demo: true })], [makeItem({ tripId: "demo", city: "Porto" })])).toBeNull();
  });
  it("the question's Turkish: Gezisi'ne, Bali'ye, Paris'e, Roma'ya", () => {
    expect(dative("Porto ve Madeira Gezisi")).toBe("Porto ve Madeira Gezisi'ne");
    expect(dative("Bali")).toBe("Bali'ye");
    expect(dative("Paris")).toBe("Paris'e");
    expect(dative("Roma")).toBe("Roma'ya");
    expect(dative("Tayland")).toBe("Tayland'a");
  });
});

describe("where they leave from", () => {
  it("the city the trips' first flights leave from, else the passport's main city", () => {
    const t = (id: string): Trip => ({ id, title: id, confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 });
    const flight = (tripId: string, from: string, departure: string) => makeItem({ tripId, category: "flight", flight: { from, to: "X", departure, arrival: null, carrier: null, flightNumber: null, stops: null } });
    const items = [flight("a", "Ankara", "2026-05-01T10:00"), flight("a", "Porto", "2026-05-09T10:00"), flight("b", "ankara", "2026-07-01T10:00"), flight("c", "İzmir", "2026-08-01T10:00")];
    expect(guessOrigin([t("a"), t("b"), t("c")], items, "TR")).toBe("Ankara");
    expect(guessOrigin([], [], "DE")).toBe("Berlin");
    expect(guessOrigin([], [], null)).toBeNull();
  });
});

describe("the start card (item 7) and the places the start made", () => {
  const trip = (over: Partial<Trip> = {}): Trip => ({ id: "t1", title: "Bali Gezisi", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, startGuide: { createdAt: 1 }, ...over });
  const flight = (id: string, over: Partial<Item> = {}) =>
    makeItem({ id, category: "flight", origin: "chat", status: "chosen", dates: { start: "2026-12-10", end: null, source: "unverified" }, flight: { from: "İstanbul", to: "Denpasar", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null }, ...over });
  const made = (...items: Item[]) => trip({ startGuide: { createdAt: 1, placeholders: Object.fromEntries(items.map((i) => [i.id, placeholderPrint(i)])) } });
  const plan = (open: number, blocks = 1, closed: string[] = []) => ({ nights: { open }, stayBlocks: Array.from({ length: blocks }), closed: closed.map((id) => ({ item: { id } })) });

  it("a flight the start made is a place to fill, not a choice, until the traveller changes it", () => {
    const f = flight("f1");
    const t = made(f);
    expect(isPlaceholder(t, f)).toBe(true);
    expect(isPlaceholder(t, { ...f, status: "booked" })).toBe(false);
    expect(isPlaceholder(t, { ...f, flight: { ...f.flight!, departure: "2026-12-10T09:40" } })).toBe(false);
    // Coordinates arriving later (or any field the traveller doesn't see) change nothing.
    expect(isPlaceholder(t, { ...f, geo: { lat: 1, lng: 2, source: "geocoded" }, updatedAt: 99 })).toBe(true);
    expect(isPlaceholder(trip(), f)).toBe(false);
  });
  it("the hero says what's waiting: \"2 uçuş ve 31 gece seni bekliyor.\"; nothing once they're filled", () => {
    const [a, b] = [flight("f1"), flight("f2", { dates: { start: "2027-01-10", end: null, source: "unverified" } })];
    const t = made(a, b);
    expect(startLead(t, [a, b], 31)).toBe("2 uçuş ve 31 gece seni bekliyor.");
    expect(startLead(t, [a, b], 0)).toBe("2 uçuş seni bekliyor.");
    expect(startLead(t, [a, { ...b, status: "booked" }], 0)).toBe("1 uçuş seni bekliyor.");
    expect(startLead(t, [a, b], 0, new Set(["f1", "f2"]))).toBeNull();
    expect(startLead(trip(), [a, b], 31)).toBeNull();
  });
  it("ticks each step from the board's own state, and hides when all are done or closed", () => {
    const [a, b] = [flight("f1"), flight("f2")];
    const steps = guideSteps(made(a, b), { items: [a, b], plan: plan(31, 3), openSuggestions: 2 });
    expect(steps.map((s) => [s.label, s.done])).toEqual([["Uçuşları bul", false], ["Konaklamaları seç", false], ["Önerilere bak", false]]);
    expect(guideVisible(made(a, b), steps)).toBe(true);
    // A saved flight took one's place (the plan set it aside), the other was booked; every night has a place; none open.
    const done = guideSteps(made(a, b), { items: [a, { ...b, status: "booked" }], plan: plan(0, 3, ["f1"]), openSuggestions: 0 });
    expect(done.every((s) => s.done)).toBe(true);
    expect(guideVisible(made(a, b), done)).toBe(false);
    expect(guideVisible(trip({ startGuide: { createdAt: 1, closed: true } }), steps)).toBe(false);
    expect(guideVisible(trip({ startGuide: undefined }), steps)).toBe(false);
    // Looked at: the suggestions step is done even with some still open.
    expect(guideSteps(trip({ startGuide: { createdAt: 1, looked: true } }), { items: [], plan: plan(0), openSuggestions: 3 })[2].done).toBe(true);
  });
  it("a road trip's first step is the car", () => {
    const car = makeItem({ id: "c1", category: "transport", origin: "chat", status: "chosen" });
    const t = trip({ startGuide: { createdAt: 1, road: true, placeholders: { c1: placeholderPrint(car) } } });
    expect(guideSteps(t, { items: [car], plan: plan(0), openSuggestions: 0 })[0]).toEqual({ id: "flights", label: "Aracı seç", done: false });
    expect(startLead(t, [car], 7)).toBe("1 araç ve 7 gece seni bekliyor.");
  });
});

describe("countries", () => {
  it("a country's name in either language gives its code; a known place carries its country's", () => {
    expect(countryCodeOfName("Endonezya")).toBe("ID");
    expect(countryCodeOfName("Portugal")).toBe("PT");
    expect(countryCodeOfName("Narnia")).toBeNull();
    expect(placeOf("Bali")).toEqual({ place: "Bali", country: "Endonezya", code: "ID" });
    expect(placeOf("Ubud", "Endonezya")).toEqual({ place: "Ubud", country: "Endonezya", code: "ID" });
    expect(placeOf("Hoi An", null, "vn")).toEqual({ place: "Hoi An", country: null, code: "VN" });
  });
});
