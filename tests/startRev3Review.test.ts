// tests/startRev3Review.test.ts — the review of start rev 3 (d4db14d), its probes kept as regressions: ordinary
// words are never countries ("to go" is not Togo, "I ran" not Iran, "us a" not the US); a one-word country only where
// a place is meant ("Mali durumum", "Chad is coming", "Hindistan cevizi" are not); the last country said wins; lengths,
// head counts and months only from the right words; a lower-case reading gives way to the model's; the map wraps
// round the date line; a circuit's airports only with their stops; the origin is never a circuit's stop.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorldFlight } from "../src/app/start/FlightMap";
import { setLang, withLang } from "../src/lib/i18n";
import { CIRCUITS, cityCoord, fitCircuit } from "../src/lib/startCircuits";
import { MAP_W, nearSide, project, tripPoints } from "../src/lib/startMap";
import {
  applyText, circuitRoute, countryCodeOfName, creationOf, EMPTY_EXTRACTED, mergeExtracted, newStart, nextQuestion, parseStartText, routeForGenerate,
  withoutOverruled, type Extracted, type StartState,
} from "../src/lib/startTrip";

const TODAY = "2026-10-06";
const read = (text: string, pending: Parameters<typeof parseStartText>[2] = null) => parseStartText(text, TODAY, pending);
const where = (text: string) => read(text).where?.code ?? null;

beforeEach(() => setLang("tr"));
afterEach(() => setLang("tr"));

describe("FIX FIRST 1: ordinary words are never countries", () => {
  it("English phrases joined without their spaces were countries", () => {
    withLang("en", () => {
      expect(read("We want to go to Japan")).toMatchObject({ where: { code: "JP" }, from: null });
      expect(read("I want to go somewhere warm").where).toBeNull();
      expect(read("book us a trip").where).toBeNull();
      expect(read("send us a plan").where).toBeNull();
      expect(read("I ran out of ideas, maybe Japan").where?.code).toBe("JP");
      expect(read("o man").where).toBeNull();
      expect(read("we have to go back").where).toBeNull();
      expect(read("we plan to go in May").where).toBeNull();
      expect(read("I'd love to go to Bali")).toMatchObject({ where: { place: "Bali" }, from: null });
      expect(read("we are 4 and want to go to Spain")).toMatchObject({ where: { code: "ES" }, from: null });
    });
  });

  it("no two words make a one-word name (the brute-force list)", () => {
    for (const w of ["to go", "i ran", "o man", "us a", "can ada", "be nin", "ben in", "ma li", "per u", "in dia", "ton ga", "sam oa", "ye men", "ken ya", "fi ji", "cu ba", "ni ger", "pa lau", "nau ru", "mal ta"])
      expect(where(w), w).toBeNull();
  });

  it("names of several words still match, endings read off the last word", () => {
    expect(read("sri lankaya").where?.code).toBe("LK");
    expect(read("Sri Lanka'ya").where?.code).toBe("LK");
    expect(read("yeni zelandaya gidelim").where?.code).toBe("NZ");
    expect(read("Dominik Cumhuriyeti'ne").where?.code).toBe("DO");
    expect(read("Bosna Hersek").where?.code).toBe("BA");
    expect(withLang("en", () => read("South Africa").where?.code)).toBe("ZA");
  });

  it("a lower-case reading of several words gives way to the model's, even an empty one", () => {
    const code = read("sri lankaya gidelim");
    expect(code.whereWeak).toBe(true);
    const none: Extracted = { ...EMPTY_EXTRACTED, styles: [] };
    expect(mergeExtracted(code, none).where).toBeNull();
    expect(mergeExtracted(code, { ...none, where: { place: "Hindistan", country: "Hindistan", code: "IN" } }).where?.code).toBe("IN");
    // Capitalised, the code's stays.
    expect(mergeExtracted(read("Sri Lanka'ya gidelim"), none).where?.code).toBe("LK");
    // On the screen: the slot taken at once goes back to what it was.
    const before = newStart("w", "plan", 1, "tr");
    const s = applyText(before, "sri lankaya gidelim", code, 2, "where").state;
    expect(s.where?.code).toBe("LK");
    expect(withoutOverruled(s, before, code, mergeExtracted(code, none)).where).toBeNull();
    expect(withoutOverruled(s, before, code, mergeExtracted(code, { ...none, where: { place: "Sri Lanka", country: null, code: "LK" } }))).toBe(s);
  });
});

describe("SHOULD FIX 4: a one-word country only where a place is meant; the last one said wins", () => {
  it("words that happen to be countries", () => {
    expect(where("Mali durumum iyi değil")).toBeNull();
    expect(where("mali durumum iyi değil")).toBeNull();
    expect(withLang("en", () => where("Chad is coming"))).toBeNull();
    expect(where("Hindistan cevizi yemek istiyorum")).toBeNull();
    expect(where("Mısır gevreği")).toBeNull();
    expect(where("mısır yemek")).toBeNull();
    expect(withLang("en", () => read("Atlanta, Georgia for 5 days").where)).toBeNull();
  });
  it("still countries: the whole answer, with a direction, or where a name stands", () => {
    for (const [t, c] of [["Mali", "ML"], ["Hindistan", "IN"], ["Mısır'a", "EG"], ["Gürcistan", "GE"], ["Fas'a gidelim", "MA"], ["Japonya'ya 2 haftalığına", "JP"], ["Yunanistan 10 gün", "GR"], ["Kanada", "CA"]] as const)
      expect(where(t), t).toBe(c);
    withLang("en", () => {
      for (const [t, c] of [["Georgia", "GE"], ["Spain in May", "ES"], ["Chile in May", "CL"], ["I want to go to China", "CN"], ["we'll go to Chile", "CL"], ["Bali for 3 days", "ID"]] as const)
        expect(where(t), t).toBe(c);
    });
  });
  it("the last country said, when none is marked", () => {
    expect(withLang("en", () => where("I loved Peru last year, now Spain"))).toBe("ES");
  });
});

describe("SHOULD FIX 5: lengths, head counts and months from the right words", () => {
  it("a time before or after is not the trip's length", () => {
    expect(read("3 hafta önce döndüm, şimdi Bali").duration).toBeNull();
    expect(read("Tayland'a gidecektim ama 3 gün önce iptal").duration).toBeNull();
    expect(withLang("en", () => read("back 2 weeks ago").duration)).toBeNull();
    expect(read("3 hafta").duration).toEqual({ unit: "week", n: 3 });
  });
  it("a room for two is no head count; \"4 kişiyiz\" is", () => {
    expect(read("2 kişilik oda").who).toBeNull();
    expect(read("10 kişilik").who).toBeNull();
    expect(read("4 kişiyiz").who?.count).toBe(4);
    expect(read("3 kişi olarak gidiyoruz").who?.count).toBe(3);
    expect(withLang("en", () => read("4 people").who?.count)).toBe(4);
  });
  it("an English month in lower case needs a cue", () => {
    expect(withLang("en", () => read("november rain").start)).toBeNull();
    expect(withLang("en", () => read("in november").start)).toEqual({ date: "2026-11-01", approx: true });
    expect(withLang("en", () => read("November").start)).toEqual({ date: "2026-11-01", approx: true });
    expect(read("kasım").start).toEqual({ date: "2026-11-01", approx: true });
  });
});

describe("nits: more names", () => {
  it("America, UK, Myanmar, Burma, Hong Kong, Macau, Kore, Korea, Congo, Kongo", () => {
    expect(["America", "UK", "Myanmar", "Burma", "Hong Kong", "Macau", "Kore", "Korea", "Congo", "Kongo"].map(countryCodeOfName)).toEqual(["US", "GB", "MM", "MM", "HK", "MO", "KR", "KR", "CD", "CD"]);
    withLang("en", () => {
      expect(read("The UK").where?.code).toBe("GB");
      expect(read("call uk").where).toBeNull();
      // Their short names, not Intl's long ones.
      expect(read("Hong Kong").where?.place).toBe("Hong Kong");
      expect(read("Fildişi Sahili").where?.code).toBe("CI");
    });
  });
  it("more cities to leave from", () => {
    for (const c of ["Los Angeles", "New York", "London", "Berlin", "Amsterdam", "Dubai", "San Francisco", "Toronto", "Sydney"]) expect(cityCoord(c), c).not.toBeNull();
  });
});

describe("FIX FIRST 3: a circuit's airports with their stops; never the origin as a stop", () => {
  it("a return airport only when the stop it serves is kept", () => {
    const leave = (k: string, n: number) => withLang("tr", () => fitCircuit(CIRCUITS[k], n)!);
    expect(leave("TR", 7).leave).toBeNull();
    expect(leave("TR", 10).leave).toBe("Dalaman");
    expect(leave("IT", 10).leave).toBeNull();
    expect(leave("IT", 14).leave).toBe("Napoli");
    expect(leave("PT", 7).leave).toBeNull();
    expect(leave("PT", 10).leave).toBe("Faro");
    expect(leave("ES", 10).leave).toBeNull();
    expect(leave("ES", 14).leave).toBe("Malaga");
    expect(leave("LK", 7).arrive).toBe("Kolombo");
    // Every circuit, every length: the airport out serves the last stop kept, the one in the first.
    for (const [k, c] of Object.entries(CIRCUITS))
      for (let n = 7; n <= 30; n++) {
        const f = fitCircuit(c, n)!;
        if (f.leave && c.leave?.near) expect(c.leave.near, `${k} ${n}`).toContain(c.stops.find((s) => s.tr === f.stops.at(-1)!.city || s.en === f.stops.at(-1)!.city)!.en);
      }
  });

  it("leaving from İstanbul for Türkiye: İstanbul isn't a stop, the flights aren't İstanbul → İstanbul", () => {
    const s: StartState = { ...newStart("tr", "plan", 1, "tr"), where: { place: "Türkiye", country: "Türkiye", code: "TR" }, from: "İstanbul", duration: { unit: "week", n: 1 }, start: { date: "2026-11-02", approx: false } };
    const route = circuitRoute(s)!;
    expect(route.stops.map((x) => x.city)).not.toContain("İstanbul");
    expect(route.stops.reduce((a, b) => a + b.nights, 0)).toBe(7);
    const made = withLang("tr", () => creationOf({ ...s, route: routeForGenerate(s) }))!;
    for (const t of made.travel) expect(t.from === t.to, JSON.stringify(t)).toBe(false);
    expect(made.travel.some((t) => t.to === "Dalaman" || t.from === "Dalaman") && !made.stays.some((x) => x.city === "Fethiye")).toBe(false);
    expect(nextQuestion(s)).not.toBeNull();
  });
});

describe("FIX FIRST 2: the map round the date line", () => {
  const map = JSON.parse(readFileSync("static/map/world.json", "utf8")) as { land: string; borders: string; centroids: Record<string, [number, number]> };
  it("centroids are on the map: Fiji, Russia, Kiribati, all within ±180°", () => {
    const [fl, fa] = map.centroids.FJ;
    expect(fl).toBeGreaterThan(170);
    expect(fa).toBeLessThan(-14);
    expect(map.centroids.RU[0]).toBeGreaterThan(30);
    expect(map.centroids.RU[0]).toBeLessThan(180);
    expect(map.centroids.KI).toBeDefined();
    for (const [code, [lng, lat]] of Object.entries(map.centroids)) {
      expect(Math.abs(lng), code).toBeLessThanOrEqual(180);
      expect(Math.abs(lat), code).toBeLessThanOrEqual(90);
    }
  });
  it("no ring jumps across the map (a stripe over the ocean)", () => {
    // Each subpath's relative steps: none wider than half the map.
    for (const d of [map.land, map.borders]) {
      const steps = [...d.matchAll(/l(-?[\d.]+)(?: |(?=-))(-?[\d.]+)/g)].map((m) => Math.abs(Number(m[1])));
      expect(Math.max(...steps)).toBeLessThan(MAP_W / 2);
    }
  });
  it("the map speaks the chat's language, not the board's (SHOULD FIX 6)", () => {
    setLang("en");
    const points = { from: { lat: 41.01, lng: 28.98, name: "İstanbul" }, to: { lat: 7.96, lng: 80.76, name: "Sri Lanka" }, stops: [] };
    const html = renderToStaticMarkup(createElement(WorldFlight, { world: { w: 1000, h: 392, land: "", borders: "", centroids: {} }, ...points, lang: "tr" }));
    expect(html).toContain("Harita: Natural Earth");
    expect(html).toContain("İstanbul → Sri Lanka uçuşu, haritada");
    expect(html).not.toContain("Map:");
    // Drawn three times side by side (the flight may cross the date line).
    expect(html.match(/class="st-map-land"/g)?.length).toBe(3);
  });

  it("a flight across the Pacific goes the short way", () => {
    const ny = project({ lat: 40.71, lng: -74.01 });
    const jp = project({ lat: 36.02, lng: 136.88 });
    const near = nearSide(ny, jp);
    expect(Math.abs(near.x - ny.x)).toBeLessThan(MAP_W / 2);
    expect(near.x).toBeLessThan(0);
    const p = tripPoints({ from: "Los Angeles", where: { place: "Japonya", country: "Japonya", code: "JP" }, route: null, duration: null, start: null }, map.centroids);
    expect(p.from?.name).toBe("Los Angeles");
    expect(p.to?.lng).toBeCloseTo(136.88, 1);
  });
});
