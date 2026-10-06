// tests/startRev3.test.ts — the start chat, revision 3 (the Sri Lanka report): the exact sentence read without the
// model (where, who, when, length); every country by its Turkish or English name, endings typed on; a classic circuit
// for popular countries at once, refined by the model's proposal, built by "Oluştur" when nothing else is there; a
// late reading fills only what is still empty; the generating screen's map (projection, framing, the flight's curve,
// the bundled data) and the photo search's words.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { within } from "../src/app/start/model";
import { setLang, withLang } from "../src/lib/i18n";
import { stepsFor } from "../src/lib/startCreate";
import { CIRCUITS, cityCoord, fitCircuit, stopsFor } from "../src/lib/startCircuits";
import { along, arcControl, centroidOf, frame, LAT_BOTTOM, LAT_TOP, MAP_H, MAP_W, project, tripPoints } from "../src/lib/startMap";
import {
  acceptRoute, applyAnswer, applyExtracted, applyText, canGenerate, checklist, circuitRoute, countryNamed, creationOf, EMPTY_EXTRACTED, mergeExtracted, namesToAsk, newStart, nextLine, placeOf, readyText, skip,
  nextQuestion, onlyEmpty, parseStartText, peopleCount, photoQuery, questionOf, replyText, restoreRoute, routeForGenerate, routeKey, routeSystem, totalNights,
  tripDates, withPreparedRoute, withTypedLang, type StartCtx, type StartState,
} from "../src/lib/startTrip";

const TODAY = "2026-10-06";
const SRI_LANKA = "Sabine ile beraber 20 kasım civarı Sri lankaya gitmek isityorum 2 hafta";
const ctx: StartCtx = { myName: "Emre", fromGuess: "İstanbul", today: TODAY };

/** One typed line as the chat takes it without the model: the language, then the code's reading bound to the question. */
function typed(s: StartState, text: string, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const out = applyText(asked, text, mergeExtracted(parseStartText(text, TODAY, q), null), at, q);
    return out.understood ? out.state : asked;
  });
}

beforeEach(() => setLang("tr"));
afterEach(() => setLang("tr"));

describe("the reported sentence, no model (fix 1)", () => {
  it("Sri Lanka (LK), 2 people, 20 November, 14 nights", () => {
    const read = parseStartText(SRI_LANKA, TODAY, "where");
    expect(read.where).toEqual({ place: "Sri Lanka", country: "Sri Lanka", code: "LK" });
    expect(read.whereSure).toBe(true);
    expect(read.who).toEqual({ kind: null, names: ["Sabine"] });
    expect(read.start).toEqual({ date: "2026-11-20", approx: false });
    expect(read.duration).toEqual({ unit: "week", n: 2 });
    const s = typed(newStart("lk", "plan", 1, "tr"), SRI_LANKA);
    expect(s.lang).toBe("tr");
    expect(s.where?.code).toBe("LK");
    expect(peopleCount(s.who)).toBe(2);
    expect(totalNights(s)).toBe(14);
    expect(tripDates(s)).toEqual({ start: "2026-11-20", end: "2026-12-04" });
    // Not asked again where to: the next question is where from.
    expect(nextQuestion(s)).toBe("from");
  });

  it("a multi-word name with a Turkish ending typed on, with or without an apostrophe", () => {
    const to = (text: string) => parseStartText(text, TODAY, "where");
    expect(to("Sri Lanka'ya gidiyoruz").where?.code).toBe("LK");
    expect(to("sri lankaya gidelim").where?.code).toBe("LK");
    expect(to("Srilanka").where?.code).toBe("LK");
    expect(to("Seylan'a").where?.code).toBe("LK");
    expect(to("Yeni Zelanda'ya gitmek istiyoruz").where).toMatchObject({ place: "Yeni Zelanda", code: "NZ" });
    expect(to("Güney Kore'ye 10 gün").where).toMatchObject({ place: "Güney Kore", code: "KR" });
    expect(to("Dominik Cumhuriyeti'ne gideceğiz").where).toMatchObject({ code: "DO" });
    expect(to("Kosta Rika'ya").where?.code).toBe("CR");
    expect(to("Maldivlere").where?.place).toBe("Maldivler");
    expect(to("Tayland'a").where?.code).toBe("TH");
    expect(withLang("en", () => to("Going to New Zealand in March").where)).toMatchObject({ place: "New Zealand", code: "NZ" });
    expect(withLang("en", () => to("Costa Rica for two weeks").where?.code)).toBe("CR");
    // An ending pointing away: where from.
    const from = parseStartText("Japonya'dan Vietnam'a", TODAY, "where");
    expect(from.from).toBe("Japonya");
    expect(from.where?.code).toBe("VN");
  });

  it("every country, by Intl: Turkish and English names, endings, never an ordinary word or a person", () => {
    expect(countryNamed("Peru")?.p.en).toBe("Peru");
    expect(countryNamed("Fasa")?.dir).toBe("to");
    expect(countryNamed("Kolombiyadan")).toMatchObject({ dir: "from" });
    expect(countryNamed("İzlanda")?.p.tr).toBe("İzlanda");
    // Today's codes, never the old ones Intl still names the same.
    expect(countryNamed("Almanya")?.p.en).toBe("Germany");
    expect(parseStartText("Almanya'ya", TODAY, "where").where?.code).toBe("DE");
    expect(parseStartText("Vietnam", TODAY, "where").where?.code).toBe("VN");
    // A lower-case word that is also a country's name isn't one; a person's name next to "with"/"ile" neither.
    expect(parseStartText("mali durumum iyi değil", TODAY, "where").where).toBeNull();
    expect(withLang("en", () => parseStartText("with Jordan and me", TODAY, "who").where)).toBeNull();
    expect(withLang("en", () => parseStartText("Jordan and I want to travel", TODAY, "where").where)).toBeNull();
    expect(withLang("en", () => parseStartText("New Jersey", TODAY, "where").where?.code)).not.toBe("JE");
  });
});

describe("instant capture, most important first (the owner's second report)", () => {
  const EN = "Lets go to Papua New Gune with my friend for 3 weeks on nov";
  const TR = "Kasımda arkadaşımla 3 haftalığına Papua Yeni Gine'ye gidelim";

  it("the English sentence, no model: Papua New Guinea asked back, a friend, 3 weeks, November", () => {
    const read = withLang("en", () => parseStartText(EN, TODAY, "where"));
    expect(read.guess).toMatchObject({ typed: "Papua New Gune", slot: "where", place: { place: "Papua New Guinea", code: "PG" } });
    expect(read.who).toEqual({ kind: "friends", names: [], count: 2 });
    expect(read.duration).toEqual({ unit: "week", n: 3 });
    expect(read.start).toEqual({ date: "2026-11-01", approx: true });
    const before = newStart("png", "plan", 1, "en");
    const s = typed(before, EN);
    expect(s.lang).toBe("en");
    expect(nextQuestion(s)).toBe("guess");
    expect(withLang("en", () => replyText(before, s, ctx))).toBe("3 weeks in November with a friend.\nDid you mean Papua New Guinea?");
    const rows = withLang("en", () => checklist(s, ctx));
    expect(rows.find((r) => r.id === "who")).toMatchObject({ done: true, value: "With a friend · 2 people" });
    expect(rows.find((r) => r.id === "when")).toMatchObject({ done: true, value: "November · 3 weeks" });
    // "Yes": the canonical name, said back once in full; then where from (no names, no day first).
    const yes = withLang("en", () => applyAnswer(s, { q: "guess", accept: true }, 3));
    expect(yes.where).toEqual({ place: "Papua New Guinea", country: "Papua New Guinea", code: "PG" });
    expect(nextQuestion(yes)).toBe("from");
    expect(withLang("en", () => replyText(s, yes, ctx, false, true))).toBe("Papua New Guinea, 3 weeks in November with a friend.\nWhere are you leaving from?");
    expect(canGenerate(yes)).toBe(true);
    // Then the day (not needed), the style, who: never the names.
    let next = withLang("en", () => applyAnswer(yes, { q: "from", city: "London" }, 4));
    expect(nextQuestion(next)).toBe("day");
    next = skip(next, "day", 5);
    expect(nextQuestion(next)).toBe("want");
    next = withLang("en", () => applyAnswer(next, { q: "want", styles: ["adventure"], budget: null }, 6));
    expect(nextQuestion(next)).toBe("route");
  });

  it("typed again loosely, the title is the country's own name, never the misspelling", () => {
    const s = typed(newStart("png2", "plan", 1, "en"), "Papua new guine");
    expect(s.guess?.place.place).toBe("Papua New Guinea");
    expect(withLang("en", () => placeOf("papua new guinea").place)).toBe("Papua New Guinea");
    expect(withLang("tr", () => placeOf("Papua New Guinea").place)).toBe("Papua Yeni Gine");
  });

  it("the Turkish sentence: exact, so taken at once; where from is next", () => {
    const before = newStart("png3", "plan", 1, "tr");
    const s = typed(before, TR);
    expect(s.where).toEqual({ place: "Papua Yeni Gine", country: "Papua Yeni Gine", code: "PG" });
    expect(s.who).toEqual({ kind: "friends", names: [], count: 2 });
    expect(s.duration).toEqual({ unit: "week", n: 3 });
    expect(s.start).toEqual({ date: "2026-11-01", approx: true });
    expect(nextQuestion(s)).toBe("from");
    expect(withLang("tr", () => replyText(before, s, ctx))).toBe("Bir arkadaşınla Papua Yeni Gine, Kasım'da 3 hafta.\nNereden yola çıkıyorsun?");
    expect(withLang("tr", () => checklist(s, ctx).find((r) => r.id === "when"))).toMatchObject({ done: true, value: "Kasım · 3 hafta" });
  });

  it("companions and counts; months with endings and short forms; lengths with endings", () => {
    const who = (t: string) => parseStartText(t, TODAY, null).who;
    expect(who("eşimle gidiyoruz")).toMatchObject({ kind: "partner" });
    expect(peopleCount(who("sevgilimle")!)).toBe(2);
    expect(who("ailemle")).toMatchObject({ kind: "family" });
    expect(peopleCount(who("with 3 friends")!)).toBe(4);
    expect(peopleCount(who("3 arkadaşımla")!)).toBe(4);
    expect(peopleCount(who("4 kişiyiz")!)).toBe(4);
    expect(peopleCount(who("with my friends")!)).toBeNull();
    const start = (t: string) => parseStartText(t, TODAY, null).start;
    expect(start("aralıkta")).toEqual({ date: "2026-12-01", approx: true });
    expect(start("in dec")).toEqual({ date: "2026-12-01", approx: true });
    expect(start("around jan")).toEqual({ date: "2027-01-01", approx: true });
    expect(start("ara sıra")).toBeNull();
    const length = (t: string) => parseStartText(t, TODAY, null).duration;
    expect(length("10 günlüğüne")).toEqual({ unit: "day", n: 10 });
    expect(length("1 aylığına")).toEqual({ unit: "month", n: 1 });
    expect(length("2 haftalık")).toEqual({ unit: "week", n: 2 });
  });

  it("the names are asked once in the board's chat, after the trip is made", () => {
    const s = typed(newStart("png4", "plan", 1, "tr"), TR);
    const made = withLang("tr", () => creationOf(s))!;
    expect(withLang("tr", () => readyText(made, [], namesToAsk(s)))).toMatch(/Bu arada, kimlerle gidiyorsun\? İstersen adlarını yazabilirsin\.$/);
    expect(namesToAsk({ who: { kind: "partner", names: ["Sabine"] } })).toBe(false);
  });
});

describe("classic circuits (fix 2)", () => {
  const where = (place: string, code: string, nights: number, styles: string[] = []) =>
    ({ where: { place, country: place, code }, duration: { unit: "night" as const, n: nights }, start: null, styles }) as unknown as StartState;

  it("Sri Lanka, 14 nights: four stops in travel order, the nights adding up, flights to Colombo", () => {
    const r = circuitRoute(where("Sri Lanka", "LK", 14))!;
    expect(r.source).toBe("circuit");
    expect(r.confirmed).toBe(false);
    expect(r.stops.map((x) => `${x.city} ${x.nights}`)).toEqual(["Sigiriya 3", "Kandy 3", "Ella 3", "Mirissa 5"]);
    expect(r.stops.every((x) => x.code === "LK")).toBe(true);
    expect([r.arrive, r.leave]).toEqual(["Kolombo", "Kolombo"]);
    expect(withLang("en", () => circuitRoute(where("Sri Lanka", "LK", 14))!.arrive)).toBe("Colombo");
  });

  it("fewer stops for fewer nights; a beach trip gives the beach more; a city or a short trip has none", () => {
    expect(stopsFor(6)).toBe(1);
    expect(stopsFor(7)).toBe(2);
    expect(stopsFor(10)).toBe(3);
    expect(stopsFor(21)).toBe(4);
    const week = circuitRoute(where("Tayland", "TH", 7))!;
    expect(week.stops.map((x) => x.city)).toEqual(["Bangkok", "Krabi"]);
    expect(week.stops.reduce((n, x) => n + x.nights, 0)).toBe(7);
    const plain = circuitRoute(where("Sri Lanka", "LK", 14))!;
    const beach = circuitRoute(where("Sri Lanka", "LK", 14, ["beach"]))!;
    expect(beach.stops.at(-1)!.nights).toBeGreaterThan(plain.stops.at(-1)!.nights);
    expect(circuitRoute(where("Sri Lanka", "LK", 6))).toBeNull();
    expect(circuitRoute({ where: { place: "Roma", country: "İtalya", code: "IT" }, duration: { unit: "night", n: 10 }, start: null, styles: [] })).toBeNull();
    expect(circuitRoute({ where: { place: "Koh Phangan", country: "Tayland", code: "TH" }, duration: { unit: "night", n: 14 }, start: null, styles: [] })).toBeNull();
    expect(circuitRoute({ where: { place: "Bali", country: "Endonezya", code: "ID" }, duration: { unit: "night", n: 10 }, start: null, styles: [] })?.stops[0].city).toBe("Ubud");
  });

  it("every circuit fits every length from a week to two months exactly, each stop at least one night", () => {
    for (const [code, c] of Object.entries(CIRCUITS))
      for (let n = 7; n <= 60; n++) {
        const fit = fitCircuit(c, n)!;
        expect(fit, `${code} ${n}`).not.toBeNull();
        expect(fit.stops.reduce((a, b) => a + b.nights, 0), `${code} ${n}`).toBe(n);
        expect(fit.stops.every((x) => x.nights >= 1)).toBe(true);
        expect(new Set(fit.stops.map((x) => x.city)).size).toBe(fit.stops.length);
        // Each stop is placed on the map.
        for (const x of fit.stops) expect(cityCoord(x.city), x.city).not.toBeNull();
      }
  });

  it("proposed at once in the chat; the model's proposal refines it; one agreed is never replaced", () => {
    let s = typed(newStart("lk2", "plan", 1, "tr"), SRI_LANKA);
    expect(s.route?.source).toBe("circuit");
    s = withLang("tr", () => applyAnswer(s, { q: "from", city: "İstanbul" }, 3));
    s = withLang("tr", () => applyAnswer(s, { q: "want", styles: ["nature"], budget: null }, 4));
    expect(nextQuestion(s)).toBe("route");
    expect(withLang("tr", () => questionOf(s, "route", ctx).text)).toBe("Rota önerim: Sigiriya 3 · Kandy 3 · Ella 3 · Mirissa 5 gece. Bu olsun mu?");
    const key = routeKey(s)!;
    const model = acceptRoute({ stops: [{ city: "Kandy", nights: 4, country_code: "LK" }, { city: "Ella", nights: 4, country_code: "LK" }, { city: "Galle", nights: 6, country_code: "LK" }], arrival_airport_city: "Kolombo", departure_airport_city: "Kolombo" }, 14)!;
    const refined = withPreparedRoute(s, key, model);
    expect(refined.route?.stops.map((x) => x.city)).toEqual(["Kandy", "Ella", "Galle"]);
    // A failed call (one stop) never replaces the circuit.
    expect(withPreparedRoute(s, key, { stops: [{ city: "Sri Lanka", nights: 14 }], arrive: null, leave: null, confirmed: false, source: "single" }).route?.source).toBe("circuit");
    // Agreed: kept.
    const agreed = withLang("tr", () => applyAnswer(s, { q: "route", action: "accept" }, 5));
    expect(withPreparedRoute(agreed, key, model).route?.stops[0].city).toBe("Sigiriya");
    // Back to the destination later: the model's kept proposal comes back before the circuit.
    expect(restoreRoute({ ...refined, route: null }).route?.stops[0].city).toBe("Kandy");
  });

  it("the route prompt asks for the classic circuit and names its example", () => {
    const sys = withLang("tr", routeSystem);
    expect(sys).toMatch(/klasik rotasını/);
    expect(sys).toMatch(/Sri Lanka 14 gece/);
    expect(sys.length).toBeLessThan(700);
  });
});

describe("Oluştur with what there is (fix 3)", () => {
  const base = () => typed(newStart("g3", "plan", 1, "tr"), SRI_LANKA);

  it("the best route there is: the agreed one, the proposal on screen, the circuit, one stop when skipped", () => {
    const s = base();
    const r = routeForGenerate(s)!;
    expect(r.confirmed).toBe(true);
    expect(r.source).toBe("circuit");
    const made = withLang("tr", () => creationOf({ ...s, route: r }))!;
    expect(made.stays.map((x) => `${x.city} ${x.date}..${x.end_date}`)).toEqual([
      "Sigiriya 2026-11-20..2026-11-23", "Kandy 2026-11-23..2026-11-26", "Ella 2026-11-26..2026-11-29", "Mirissa 2026-11-29..2026-12-04",
    ]);
    expect(made.travel.map((x) => x.to ?? x.from)).toEqual(["Kolombo", "Kolombo"]);
    const steps = stepsFor({ ...s, route: r }, made);
    expect(steps.find((x) => x.id === "route")!.done).toBe("Klasik rota çizildi: Sigiriya 3 gece → Kandy 3 gece → Ella 3 gece → Mirissa 5 gece");
    const skipped = { ...s, skipped: [...s.skipped, "route" as const] };
    expect(routeForGenerate(skipped)!.stops).toEqual([{ city: "Sri Lanka", nights: 14 }]);
    const agreed = withLang("tr", () => applyAnswer(s, { q: "route", action: "single" }, 3));
    expect(routeForGenerate(agreed)!.stops.length).toBe(1);
  });

  it("no circuit and no proposal yet: one stop", () => {
    const s = typed(newStart("g4", "plan", 1, "tr"), "Kolombiya'ya 2 hafta, 1 Mart");
    expect(s.where?.code).toBe("CO");
    expect(s.route?.source).not.toBe("circuit");
    expect(routeForGenerate({ ...s, route: null })!.stops).toEqual([{ city: "Kolombiya", nights: 14 }]);
  });

  it("the route being drawn is said, and the chat goes on", () => {
    const s = { ...typed(newStart("g5", "plan", 1, "tr"), "Kolombiya'ya 2 hafta, 1 Mart"), from: "İstanbul", wantDone: true, who: { kind: "solo" as const, names: [] }, route: null };
    expect(nextQuestion(s)).toBe("route");
    expect(withLang("tr", () => nextLine(s, ctx, true))).toMatch(/^Rotayı çiziyorum; hazır olunca burada öneririm\./);
    expect(withLang("tr", () => replyText(s, s, ctx, false))).toMatch(/Şehirleri ve geceleri yaz/);
  });
});

describe("a late reading (fix 1)", () => {
  it("fills only what is still empty; nothing said since is overwritten", () => {
    const s = { ...newStart("late", "plan", 1, "tr"), where: { place: "Sri Lanka", country: "Sri Lanka", code: "LK" }, from: "Ankara" };
    const read = { ...EMPTY_EXTRACTED, where: { place: "Hindistan", country: "Hindistan", code: "IN" }, from: "İstanbul", who: { kind: "partner" as const, names: ["Sabine"] }, styles: ["beach" as const] };
    const fill = onlyEmpty(s, read);
    expect(fill.where).toBeNull();
    expect(fill.from).toBeNull();
    expect(fill.who).toEqual({ kind: "partner", names: ["Sabine"] });
    const after = applyExtracted(s, fill, 3);
    expect(after.where?.place).toBe("Sri Lanka");
    expect(after.from).toBe("Ankara");
    expect(after.styles).toEqual(["beach"]);
    // Skipped and answered slots stay as they are.
    expect(onlyEmpty({ ...s, wantDone: true }, read).styles).toEqual([]);
    expect(onlyEmpty({ ...s, skipped: ["who"] }, read).who).toBeNull();
  });

  it("the reply is waited for a while only; the promise runs on", async () => {
    const LATE = Symbol("late");
    let resolve!: (v: string) => void;
    const slow = new Promise<string>((r) => (resolve = r));
    expect(await within(slow, 5, LATE)).toBe(LATE);
    resolve("read");
    expect(await slow).toBe("read");
    expect(await within(Promise.resolve("fast"), 50, LATE)).toBe("fast");
    expect(await within(Promise.reject(new Error("x")), 50, LATE)).toBe(LATE);
  });
});

describe("photos and the map (fix 4)", () => {
  it("asks the photo search the right words: a country's landscape, a stop with its country", () => {
    const s = { where: { place: "Sri Lanka", country: "Sri Lanka", code: "LK" } };
    expect(photoQuery("Sri Lanka", s)).toEqual({ query: "Sri Lanka landscape", titles: [] });
    expect(photoQuery("Ella", s)).toEqual({ query: "Ella Sri Lanka", titles: ["Ella, Sri Lanka"] });
    expect(photoQuery("Floransa", { where: { place: "İtalya", country: "İtalya", code: "IT" } })).toEqual({ query: "Florence Italy", titles: ["Florence, Italy"] });
    expect(photoQuery("Koh Phangan", { where: { place: "Koh Phangan", country: "Tayland", code: "TH" } })).toEqual({ query: "Koh Phangan", titles: [] });
    expect(photoQuery("Tayland", { where: { place: "Koh Phangan", country: "Tayland", code: "TH" } }).query).toBe("Thailand landscape");
  });

  it("projects the world into the bundled map's frame", () => {
    expect(MAP_H).toBe(Math.round((MAP_W * (LAT_TOP - LAT_BOTTOM)) / 360));
    expect(project({ lat: LAT_TOP, lng: -180 })).toEqual({ x: 0, y: 0 });
    expect(project({ lat: LAT_BOTTOM, lng: 180 })).toEqual({ x: MAP_W, y: MAP_H });
    const ist = project({ lat: 41.01, lng: 28.98 });
    expect(ist.x).toBeCloseTo(580.5, 0);
  });

  it("frames the flight with room around it, at the screen's ratio; the curve bends up and starts and ends at the points", () => {
    const a = project({ lat: 41.01, lng: 28.98 });
    const b = project({ lat: 7.29, lng: 80.63 });
    const c = arcControl(a, b);
    expect(c.y).toBeLessThan((a.y + b.y) / 2);
    const v = frame([a, b, c], 16 / 9);
    expect(v.w / v.h).toBeCloseTo(16 / 9, 5);
    for (const p of [a, b, c]) {
      expect(p.x).toBeGreaterThan(v.x);
      expect(p.x).toBeLessThan(v.x + v.w);
      expect(p.y).toBeGreaterThan(v.y);
      expect(p.y).toBeLessThan(v.y + v.h);
    }
    expect(along(a, c, b, 0)).toMatchObject({ x: a.x, y: a.y });
    const end = along(a, c, b, 1);
    expect(end.x).toBeCloseTo(b.x, 6);
    expect(end.y).toBeCloseTo(b.y, 6);
    // The plane turns as the curve bends (clockwise, flying east): up first, down on landing.
    expect(along(a, c, b, 0).angle).toBeLessThan(along(a, c, b, 1).angle);
    expect(along(a, c, b, 1).angle).toBeGreaterThan(0);
  });

  it("the trip's points: home, the first stop away, the stops; a country with no known city at its centre", () => {
    const s = { from: "İstanbul", where: { place: "Sri Lanka", country: "Sri Lanka", code: "LK" }, route: circuitRoute({ where: { place: "Sri Lanka", country: "Sri Lanka", code: "LK" }, duration: { unit: "night", n: 14 }, start: null, styles: [] }), duration: { unit: "night" as const, n: 14 }, start: null };
    const p = tripPoints(s, null);
    expect(p.from).toMatchObject({ name: "İstanbul", lat: 41.01 });
    expect(p.to).toMatchObject({ name: "Sri Lanka", lat: 7.96 });
    expect(p.stops.map((x) => x.name)).toEqual(["Sigiriya", "Kandy", "Ella", "Mirissa"]);
    const nz = tripPoints({ from: "Berlin", where: { place: "Yeni Zelanda", country: null, code: "NZ" }, route: null, duration: null, start: null }, { NZ: [172.5, -41.8] });
    expect(nz.to).toEqual({ lat: -41.8, lng: 172.5, name: "Yeni Zelanda" });
    expect(centroidOf("MV", null)).toEqual({ lat: 4.18, lng: 73.51 });
    // At home: the first stop that isn't where they leave from.
    const tr = circuitRoute({ where: { place: "Türkiye", country: "Türkiye", code: "TR" }, duration: { unit: "night", n: 14 }, start: null, styles: [] });
    expect(tripPoints({ from: "İstanbul", where: { place: "Türkiye", country: "Türkiye", code: "TR" }, route: tr, duration: null, start: null }, null).to).toMatchObject({ name: "Türkiye", lat: 38.64 });
  });

  it("the bundled map: small, no network, land and borders, a centroid per country", () => {
    const text = readFileSync("static/map/world.json", "utf8");
    expect(text.length).toBeLessThan(150 * 1024);
    const w = JSON.parse(text) as { w: number; h: number; top: number; bottom: number; land: string; borders: string; centroids: Record<string, [number, number]> };
    expect([w.w, w.h, w.top, w.bottom]).toEqual([MAP_W, MAP_H, LAT_TOP, LAT_BOTTOM]);
    expect(w.land).toMatch(/^M[\d.]+ [\d.]+l/);
    expect(w.borders.length).toBeGreaterThan(1000);
    expect(Object.keys(w.centroids).length).toBeGreaterThan(160);
    const [lng, lat] = w.centroids.LK;
    expect(Math.abs(lng - 80.7)).toBeLessThan(1);
    expect(Math.abs(lat - 7.7)).toBeLessThan(1);
    expect(w.centroids.FR[0]).toBeCloseTo(2.3, 0);
  });
});
