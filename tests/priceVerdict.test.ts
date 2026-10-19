import { describe, expect, it, vi } from "vitest";
import { makeLiveSource } from "../src/lib/offerSources";
import { fareEach, historyDrawing, historySentence, priceAsk, validInsight, verdictOf, type PriceInsight } from "../src/lib/priceVerdict";
import { makeItem } from "./fixtures/makeItem";

const day = 864e5;
const t0 = Date.parse("2026-09-28T12:00:00Z");
const google: PriceInsight = {
  low: 110, high: 200, lowest: 202, level: "high", source: "google", currency: "EUR",
  history: [[t0, 118], [t0 + 7 * day, 104], [t0 + 14 * day, 96], [t0 + 21 * day, 74]],
};
const flight = (over: Parameters<typeof makeItem>[0] = {}) =>
  makeItem({
    category: "flight", status: "saved",
    flight: { from: "IST", to: "OPO", departure: "2026-11-12T07:10", arrival: "2026-11-12T10:05", carrier: "PC", flightNumber: "1201", stops: 0 },
    price: { amount: 148, currency: "EUR", scope: "total", taxesIncluded: "unknown", source: "url", observedAt: 1 },
    guests: { adults: 2, children: null, rooms: null },
    ...over,
  });

describe("which flight is judged (spec 2026-10-19 SerpApi, item 2)", () => {
  it("asks for a flight with both airports and a day to come, not one already bought", () => {
    expect(priceAsk(flight(), "2026-10-19")).toEqual({ from: "IST", to: "OPO", day: "2026-11-12" });
    expect(priceAsk(flight({ status: "booked" }), "2026-10-19")).toBeNull();
    expect(priceAsk(flight(), "2026-11-13")).toBeNull();
    expect(priceAsk(flight({ flight: { from: "İstanbul", to: "OPO", departure: "2026-11-12T07:10", arrival: null, carrier: null, flightNumber: null, stops: null } }), "2026-10-19")).toBeNull();
    expect(priceAsk(flight({ category: "transport" as never }), "2026-10-19")).toBeNull();
  });
  it("judges one person's fare in euros only", () => {
    expect(fareEach(flight())).toBe(74);
    expect(fareEach(flight({ price: { amount: 74, currency: "EUR", scope: "per_person", taxesIncluded: "unknown", source: "url", observedAt: 1 } }))).toBe(74);
    expect(fareEach(flight({ price: { amount: 3000, currency: "TRY", scope: "total", taxesIncluded: "unknown", source: "url", observedAt: 1 } }))).toBeNull();
    expect(fareEach(flight({ price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: 1 } }))).toBeNull();
  });
});

describe("the pill and the sentence", () => {
  it("sets the card's fare against Google's usual range", () => {
    expect(verdictOf(74, google)).toEqual({ tone: "low", pill: "↓ Fiyat düşük · normali €110–200", sentence: "Bu fiyat iyi: bu rota için normal €110–200, kartta €74." });
    expect(verdictOf(150, google)?.tone).toBe("typical");
    expect(verdictOf(221, google)).toMatchObject({ tone: "high", pill: "↑ Fiyat yüksek · normali €110–200" });
  });
  it("with no range or no fare, only a history to open; with neither, nothing", () => {
    const log: PriceInsight = { ...google, low: null, high: null, source: "log", history: [...google.history, [t0 + 22 * day, 80]] };
    expect(verdictOf(74, log)).toEqual({ tone: "history", pill: "Fiyat geçmişi", sentence: null });
    expect(verdictOf(null, { ...google, history: [] })).toBeNull();
  });
  it("says how the fare moved", () => {
    expect(historySentence(google, t0 + 21 * day)).toBe("3 hafta önce €118 → şimdi €74");
    expect(historySentence({ ...google, history: [[t0, 90], [t0 + 3 * day, 85]] }, t0 + 3 * day)).toBe("3 gün önce €90 → şimdi €85");
  });
  it("draws the history to scale with the usual range as a band", () => {
    const d = historyDrawing(google, 640, 120)!;
    expect(d.points.split(" ")).toHaveLength(4);
    expect(d.last.x).toBeCloseTo(640);
    expect(d.band!.y).toBeLessThan(d.band!.y + d.band!.h);
    // The lowest price (€74) is the lowest point, below the band's bottom (€110).
    expect(d.last.y).toBeGreaterThan(d.band!.y + d.band!.h);
    expect(historyDrawing({ ...google, history: [[t0, 1]] }, 640, 120)).toBeNull();
    // The card's own fare drawn as a level, inside the box even below everything else.
    const m = historyDrawing(google, 640, 120, 60)!;
    expect(m.mark).toBeGreaterThan(m.last.y);
    expect(m.mark).toBeLessThanOrEqual(120);
    expect(historyDrawing(google, 640, 120)!.mark).toBeNull();
  });
});

describe("what the server sent", () => {
  it("keeps a well-formed answer", () => {
    expect(validInsight({ low: 110, high: 200, lowest: 202, level: "high", history: [[1, 2]], source: "google" })).toMatchObject({ low: 110, high: 200, level: "high" });
    expect(validInsight({ low: 300, high: 200, history: [] })).toBeNull();
    expect(validInsight({ history: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]], source: "log" })).toMatchObject({ low: null, source: "log" });
    expect(validInsight(null)).toBeNull();
  });
  it("asks the offers function once per route and day, and keeps the answer a day", async () => {
    const store = new Map<string, unknown>();
    const kv = { get: async <T,>(k: string) => store.get(k) as T | undefined, set: async (k: string, v: unknown) => void store.set(k, v) };
    const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify({ insight: { low: 110, high: 200, lowest: 202, level: "high", history: [], source: "google" } })));
    let now = 1_000;
    const src = makeLiveSource({ kv: kv as never, fetcher: fetcher as never, now: () => now, server: "https://x.supabase.co" });
    const ask = { from: "IST", to: "OPO", day: "2026-11-12" };
    const [a, b] = await Promise.all([src.price(ask), src.price(ask)]);
    expect(a).toMatchObject({ low: 110 });
    expect(b).toEqual(a);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe("https://x.supabase.co/functions/v1/offers?kind=price&from=IST&to=OPO&day=2026-11-12");
    now += 23 * 36e5;
    await src.price(ask);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 2 * 36e5;
    await src.price(ask);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("the day either side (spec 2026-10-19 SerpApi, item 5)", () => {
  const days = [
    { day: "2026-11-09", price: 96 }, { day: "2026-11-10", price: 88 }, { day: "2026-11-11", price: 81 },
    { day: "2026-11-12", price: 74 }, { day: "2026-11-13", price: 79 }, { day: "2026-11-14", price: 102 }, { day: "2026-11-15", price: 118 },
  ];
  it("keeps the days in order, each once, seven at most", async () => {
    const { validDays } = await import("../src/lib/priceVerdict");
    expect(validDays([{ day: "2026-11-13", price: 79.4 }, { day: "2026-11-12", price: 74 }, { day: "2026-11-12", price: 1 }, { day: "x", price: 3 }, { day: "2026-11-14", price: 0 }])).toEqual([{ day: "2026-11-12", price: 74 }, { day: "2026-11-13", price: 79 }]);
    expect(validDays(null)).toEqual([]);
  });
  it("draws the card's day and the cheapest, and says it", async () => {
    const { dayBars, daysSentence } = await import("../src/lib/priceVerdict");
    const bars = dayBars(days, "2026-11-12");
    expect(bars).toHaveLength(7);
    expect(bars.find((b) => b.chosen)).toMatchObject({ day: "2026-11-12", cheapest: true, label: "12 Kas" });
    expect(bars.at(-1)!.share).toBe(1);
    expect(daysSentence(days, "2026-11-12")).toBe("Seçtiğin gün bu haftanın en ucuzu");
    expect(daysSentence(days, "2026-11-14")).toBe("12 Kas €28 daha ucuz");
    expect(daysSentence(days.filter((d) => d.day !== "2026-11-10"), "2026-11-10")).toBe("En ucuz gün 12 Kas, €74");
    expect(dayBars(days.slice(0, 2), "2026-11-09")).toEqual([]);
  });
});
