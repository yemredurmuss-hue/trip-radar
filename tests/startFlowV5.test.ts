// tests/startFlowV5.test.ts — the start flow v5 (spec 2026-10-06-niyet-planlayici §1, mockup v5): the generating map's
// timeline and frames for any trip's shape (one place, several stops, no home, at home, across the date line), the
// board opening once made and landed (or at the cap, never waiting on the map for the steps), the line under the
// title, the steps in the map's order; the chat's step lines and the rows a message being read can still fill.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setLang, withLang } from "../src/lib/i18n";
import { genSubLine, stepsFor } from "../src/lib/startCreate";
import {
  fliesBetween, flightView, genTimeline, groundPath, MAP_W, OPEN_CAP_MS, openDelay, project, stopsView, worldView, GEN_ASPECT, tripPoints,
} from "../src/lib/startMap";
import {
  accusative, applyAnswer, applyText, creationOf, mergeExtracted, newStart, nextQuestion, parseStartText, readingLine, readingName, readingRows, routeThinkingLine,
  withTypedLang, type StartCtx, type StartState,
} from "../src/lib/startTrip";
import { GenMap } from "../src/app/start/GenMap";

const TODAY = "2026-10-06";
const ctx: StartCtx = { myName: "Emre", fromGuess: "İstanbul", today: TODAY };
function typed(s: StartState, text: string, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const out = applyText(asked, text, mergeExtracted(parseStartText(text, TODAY, q), null), at, q);
    return out.understood ? out.state : asked;
  });
}
const afrikaBurn = () => {
  let s = typed(newStart("ab", "plan", 1, "tr"), "AfrikaBurn'e arkadaşlarımla gitmek istiyorum");
  s = applyAnswer(s, { q: "duration", duration: { unit: "day", n: 11 } }, 3);
  return applyAnswer(applyAnswer(s, { q: "from", city: "İstanbul" }, 4), { q: "count", n: 4 }, 5);
};

beforeEach(() => setLang("tr"));
afterEach(() => setLang("tr"));

describe("the map's timeline", () => {
  it("with a flight: zoom, labels, flight, landing, the stops' zoom, drops, ground legs, photos (~9 s)", () => {
    const t = genTimeline(true, 3, 3);
    expect(t.zoom).toEqual([0, 1200]);
    expect(t.flight).toEqual([1750, 4250]);
    expect(t.land).toBe(4250);
    expect(t.zoom2).toEqual([4250, 5650]);
    expect(t.stops).toEqual([5750, 6050, 6350]);
    expect(t.ground).toEqual([[5750, 6100], [6100, 6450], [6450, 6800]]);
    expect(t.photos).toBe(7050);
    expect(t.end).toBe(7950);
  });
  it("without a flight: the world closes in on the stops directly", () => {
    const t = genTimeline(false, 1, 0);
    expect(t.flight).toBeNull();
    expect(t.zoom2).toBeNull();
    expect(t.land).toBe(1400);
    expect(t.stops).toEqual([1500]);
  });
  it("the board opens once landed, never later than the cap, a breath when both have passed", () => {
    expect(OPEN_CAP_MS).toBe(6000);
    expect(openDelay(4250, 1000)).toBe(3250);
    expect(openDelay(9000, 1000)).toBe(5000);
    expect(openDelay(4250, 8000)).toBe(300);
  });
});

describe("the map's frames, for any shape", () => {
  it("the world at the card's ratio first", () => {
    expect(GEN_ASPECT).toBe(2.5);
    expect(worldView()).toMatchObject({ x: 0, w: MAP_W, h: 400 });
  });
  it("no home, or home at the place: no flight", () => {
    expect(fliesBetween(null, { lat: 0, lng: 0 })).toBe(false);
    expect(fliesBetween({ lat: 41.01, lng: 28.98 }, { lat: 41.0, lng: 28.97 })).toBe(false);
  });
  it("at home, a short arc; across the date line, the shorter way round", () => {
    expect(fliesBetween({ lat: 39.93, lng: 32.86 }, { lat: 37.03, lng: 27.43 })).toBe(true);
    const tokyo = project({ lat: 35.68, lng: 139.69 });
    const la = project({ lat: 34.05, lng: -118.24 });
    // LA from Tokyo is drawn a map's width to the right: the frame spans the Pacific, not the whole world.
    const v = flightView(tokyo, { ...la, x: la.x + MAP_W }, { x: (tokyo.x + la.x + MAP_W) / 2, y: 60 });
    expect(v.w).toBeLessThan(MAP_W);
    expect(v.x + v.w).toBeGreaterThan(MAP_W);
  });
  it("one place isn't zoomed into a blur; stops are framed close", () => {
    expect(stopsView([project({ lat: -8.41, lng: 115.19 })]).w).toBeGreaterThanOrEqual(36);
    const stops = [project({ lat: 47.5, lng: 19.04 }), project({ lat: 46.75, lng: 18.4 }), project({ lat: 46.95, lng: 17.9 })];
    expect(stopsView(stops).w).toBeLessThan(80);
  });
  it("the ground route draws leg by leg", () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const legs: [number, number][] = [[0, 100], [100, 200]];
    expect(groundPath(pts, legs, 0)).toBe("");
    expect(groundPath(pts, legs, 50)).toBe("M0 0L5 0");
    expect(groundPath(pts, legs, 150)).toBe("M0 0L10 0L10 5");
    expect(groundPath(pts, legs, 999)).toBe("M0 0L10 0L10 10");
  });
  it("an event's route is on the map: Cape Town → Tankwa Karoo → Cape Town", () => {
    const p = tripPoints(afrikaBurn(), {});
    expect(p.from?.name).toBe("İstanbul");
    expect(p.stops.map((x) => x.name)).toEqual(["Cape Town", "Tankwa Karoo", "Cape Town"]);
  });
});

describe("the map itself", () => {
  const world = { w: 1000, h: 392, land: "M0 0h10v10z", borders: "", centroids: {} };
  const base = { world, label: "AfrikaBurn · Tankwa Karoo", photos: [{ place: "Cape Town", url: null }], lang: "tr" as const, t0: 0 };
  it("with reduced motion: the last frame (stops in, photos in, no plane), the event's stop pink, no canvas", () => {
    const stops = [{ name: "Cape Town", lat: -33.92, lng: 18.42, nights: 4, fest: false }, { name: "Tankwa Karoo", lat: -32.33, lng: 19.75, nights: 6, fest: true }];
    const html = renderToStaticMarkup(createElement(GenMap, {
      ...base, from: { name: "İstanbul", lat: 41.01, lng: 28.98 }, to: { name: "Cape Town", lat: -33.92, lng: 18.42 }, stops,
      ground: [stops[0], stops[1], stops[0]], timeline: genTimeline(true, 2, 2), still: true,
    }));
    expect(html).toContain('data-phase="done"');
    expect(html).toContain('data-flies="yes"');
    expect(html.match(/class="gm-land"/g)?.length).toBe(3);
    expect(html).toContain('class="gm-stop fest');
    expect(html.match(/gm-stop[^"]* in"/g)?.length).toBe(2);
    expect(html).toContain("gm-card gm-card-0 in");
    expect(html).not.toContain("gm-plane");
    expect(html).not.toContain("<canvas");
  });
  it("no home: no flight, no arc, no home marker", () => {
    const html = renderToStaticMarkup(createElement(GenMap, {
      ...base, from: null, to: { name: "Bali", lat: -8.41, lng: 115.19 }, stops: [{ name: "Bali", lat: -8.41, lng: 115.19, nights: 9, fest: false }], ground: [],
      timeline: genTimeline(false, 1, 0), still: true,
    }));
    expect(html).toContain('data-flies="no"');
    expect(html).not.toContain("gm-trail");
    expect(html).not.toContain("gm-home");
  });
});

describe("the generating screen's words", () => {
  it("the line under the title: from, the stays (the event's 🎪), the nights", () => {
    const s = afrikaBurn();
    expect(genSubLine(s, creationOf(s)!)).toBe("İstanbul → Cape Town → Tankwa Karoo 🎪 → Cape Town · 10 gece");
  });
  it("the steps in the map's order: the trip, the flights, the stays, who goes", () => {
    const s = afrikaBurn();
    expect(stepsFor(s, creationOf(s)!).map((x) => x.id).slice(0, 4)).toEqual(["trip", "travel", "route", "people"]);
  });
});

describe("the chat's step line and the rows being read", () => {
  it("names what the running call reads, in the chat's language", () => {
    expect(readingLine({ name: null, datesPending: false })).toBe("Okuyorum…");
    expect(readingLine({ name: "Ozora Festivali", datesPending: false })).toBe("Ozora Festivali'ni tanıyorum…");
    expect(readingLine({ name: "Formula 1 Türkiye GP", datesPending: true })).toBe("Formula 1 Türkiye GP tarihlerini kontrol ediyorum…");
    expect(withLang("en", () => readingLine({ name: "Bali", datesPending: false }))).toBe("Recognising Bali…");
    expect(routeThinkingLine()).toBe("Rotayı düşünüyorum…");
  });
  it("the Turkish accusative", () => {
    expect(["Bali", "Roma", "Berlin", "AfrikaBurn", "Porto", "Köln", "Kuzey Işıkları", "Ölüler Günü", "Sri Lanka", "New York"].map(accusative)).toEqual([
      "Bali'yi", "Roma'yı", "Berlin'i", "AfrikaBurn'u", "Porto'yu", "Köln'ü", "Kuzey Işıkları'nı", "Ölüler Günü'nü", "Sri Lanka'yı", "New York'u",
    ]);
  });
  it("the event or place the code read in the message; its dates being looked for when it has none", () => {
    const before = newStart("x", "plan", 1, "tr");
    const read = parseStartText("Formula 1 Türkiye GP'ye gidelim", TODAY, "where");
    const after = typed(before, "Formula 1 Türkiye GP'ye gidelim");
    expect(readingName(before, after, read)).toEqual({ name: "Formula 1 Türkiye GP", datesPending: true });
    const bali = parseStartText("Bali'ye gidelim", TODAY, "where");
    expect(readingName(before, typed(before, "Bali'ye gidelim"), bali)).toEqual({ name: "Bali", datesPending: false });
  });
  it("on the first message the essential rows still empty; after it, the row of the question it answers", () => {
    const first = typed(newStart("x", "plan", 1, "tr"), "Bali'ye gidelim");
    expect(readingRows(first, "where", true, ctx)).toEqual(["from", "who", "when"]);
    const sabine = typed(newStart("y", "plan", 1, "tr"), "Sabine'yle 10 Aralık'tan 1 ay Bali");
    expect(readingRows(sabine, "where", true, ctx)).toEqual(["from"]);
    expect(readingRows(first, "duration", false, ctx)).toEqual(["when"]);
    expect(readingRows(applyAnswer(first, { q: "duration", duration: { unit: "week", n: 1 } }, 3), "duration", false, ctx)).toEqual([]);
  });
});
