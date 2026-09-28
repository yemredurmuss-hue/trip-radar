import { describe, expect, it } from "vitest";
import { advantageOver, decideGroup, levelFor, makeContext, resetPriorities, withPriorities } from "../src/lib/decision";
import { EMPTY_METRICS } from "../src/lib/items";
import { distanceKm, walkingMinutes } from "../src/lib/geo";
import type { Analysis, Item, ItemMetrics, Trip } from "../src/lib/types";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t", title: "Portekiz", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1, ...over,
});

let seq = 0;
function item(name: string, over: Omit<Partial<Item>, "metrics"> & { metrics?: Partial<ItemMetrics> } = {}): Item {
  const { metrics, ...rest } = over;
  return {
    id: `i${++seq}`, tripId: "t", captureIds: ["c"], key: null, category: "stay", needKey: "stay:porto", name, provider: null,
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: "2026-10-08", end: "2026-10-11", source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: null, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
    metrics: { ...EMPTY_METRICS, ...metrics }, geo: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null,
    createdAt: 1, updatedAt: 1, ...rest,
  };
}

const price = (amount: number, currency = "EUR") => ({ amount, currency, scope: "total" as const, taxesIncluded: "yes" as const, source: "page" as const, observedAt: 1 });
const rating = (value: number, scale: number, count: number) => ({ value, scale, count, source: "page" as const });
// Places the traveller saved (a bookshop and a café in central Porto).
const POIS = [
  item("Livraria Lello", { category: "activity", needKey: "activity:porto", geo: { lat: 41.1469, lng: -8.6149, source: "page" } }),
  item("Majestic Café", { category: "food", needKey: "food:porto", geo: { lat: 41.1471, lng: -8.6066, source: "page" } }),
];

function portoStays() {
  const jardim = item("Jardim Stay", {
    price: price(285), rating: rating(8.9, 10, 1204), geo: { lat: 41.1455, lng: -8.6110, source: "page" },
    metrics: { cancellationType: "free" },
  });
  const casa = item("Casa Azul", {
    price: price(240), rating: rating(4.8, 5, 96), geo: { lat: 41.1620, lng: -8.5890, source: "page" },
    metrics: { cancellationType: "free" }, location: { address: null, area: "Bonfim", approximate: true },
  });
  const ribeira = item("Ribeira Rooms", {
    price: price(330), rating: rating(9.2, 10, 640), geo: { lat: 41.1410, lng: -8.6130, source: "page" },
    metrics: { cancellationType: "non_refundable" },
  });
  return { jardim, casa, ribeira };
}

describe("geo", () => {
  it("estimates walking time from straight-line distance", () => {
    const km = distanceKm({ lat: 41.1455, lng: -8.611 }, { lat: 41.1469, lng: -8.6149 });
    expect(km).toBeGreaterThan(0.3);
    expect(km).toBeLessThan(0.45);
    expect(walkingMinutes(1)).toBe(16);
  });
});

describe("priorities", () => {
  it("keeps per-category overrides apart from trip-wide priorities", () => {
    const stayOnly = withPriorities(trip(), [{ criterion: "price", level: 4, category: "stay" }]);
    expect(levelFor(stayOnly, "stay", "price")).toBe(4);
    expect(levelFor(stayOnly, "flight", "price")).toBe(3);
    // A trip-wide statement ("fiyat o kadar önemli değil") replaces the category override.
    const everywhere = withPriorities(stayOnly, [{ criterion: "price", level: 1, category: null }]);
    expect(levelFor(everywhere, "stay", "price")).toBe(1);
    expect(levelFor(everywhere, "flight", "price")).toBe(1);
    expect(levelFor(resetPriorities(everywhere, "stay"), "stay", "price")).toBe(3);
    // Criteria that don't apply to a category stay off.
    expect(levelFor(everywhere, "stay", "stops")).toBe(0);
  });
});

describe("decideGroup", () => {
  it("ranks by weighted criteria and explains the win with concrete numbers", () => {
    const { jardim, casa, ribeira } = portoStays();
    const d = decideGroup([jardim, casa, ribeira], makeContext(trip(), [jardim, casa, ribeira, ...POIS]));
    expect(d.status).toBe("ok");
    expect(d.winner?.item.name).toBe("Jardim Stay");
    expect(d.runnerUp?.item.name).toBe("Casa Azul");
    expect(d.criteria).toEqual(expect.arrayContaining(["price", "location", "rating", "cancellation"]));
    expect(d.criteria).not.toContain("comfort"); // no data for anyone → not compared
    expect(d.reasons[0].criterion).toBe("location");
    expect(d.reasons[0].text).toMatch(/^Konum: kaydettiğin 2 yere \d+ dk yürüme — Casa Azul: \d+ dk yürüme$/);
    expect(d.tradeoffs[0].criterion).toBe("price");
    expect(d.summary).toContain("Jardim Stay öne çıkıyor");
    // Casa Azul's reason to still be considered is its price.
    expect(advantageOver(d.options[1], d.winner!, "EUR")).toBe("€45 daha ucuz");
    // Ribeira: non-refundable scores 0 on cancellation.
    const r = d.options.find((o) => o.item.name === "Ribeira Rooms")!;
    expect(r.parts.find((p) => p.criterion === "cancellation")!.s).toBe(0);
  });

  it("changes the winner when the user's priorities change, and predicts it", () => {
    const { jardim, casa, ribeira } = portoStays();
    const all = [jardim, casa, ribeira, ...POIS];
    const d = decideGroup([jardim, casa, ribeira], makeContext(trip({ priorities: { location: 0 } }), all));
    expect(d.winner?.item.name).toBe("Casa Azul");
    const back = decideGroup([jardim, casa, ribeira], makeContext(trip({ priorities: { location: 0 } }), all));
    expect(back.flips.some((f) => f.criterion === "location" && f.winner === "Jardim Stay")).toBe(true);
  });

  it("does not score options without the essentials and says what is missing", () => {
    const { jardim } = portoStays();
    const noPrice = item("Mystery Loft", { rating: rating(9, 10, 50) });
    const d = decideGroup([jardim, noPrice], makeContext(trip(), [jardim, noPrice]));
    expect(d.status).toBe("insufficient");
    expect(d.options.find((o) => o.item.name === "Mystery Loft")!.score).toBeNull();
    expect(d.options.find((o) => o.item.name === "Mystery Loft")!.missing[0]).toBe("fiyat");
  });

  it("handles a single option and ties honestly", () => {
    const { jardim } = portoStays();
    expect(decideGroup([jardim], makeContext(trip(), [jardim])).status).toBe("single");
    const a = item("A", { price: price(100), rating: rating(9, 10, 500) });
    const b = item("B", { price: price(101), rating: rating(9, 10, 500) });
    const tie = decideGroup([a, b], makeContext(trip(), [a, b]));
    expect(tie.status).toBe("tie");
    expect(tie.winner).toBeNull();
  });

  it("keeps stays for other dates out of the ranking", () => {
    const { jardim, casa } = portoStays();
    const later = item("Later Inn", { price: price(90), rating: rating(9.5, 10, 900), dates: { start: "2026-10-12", end: "2026-10-15", source: "url" } });
    const d = decideGroup([jardim, casa, later], makeContext(trip(), [jardim, casa, later]));
    expect(d.options.find((o) => o.item.name === "Later Inn")!.excluded).toBe("Farklı tarih için fiyat");
    expect(d.winner?.item.name).not.toBe("Later Inn");
  });

  it("compares prices across currencies with exchange rates, and not without them", () => {
    const eur = item("Euro Hotel", { price: price(300), rating: rating(8.5, 10, 300) });
    const tl = item("Lira Hotel", { price: price(9000, "TRY"), rating: rating(8.5, 10, 300) });
    const rates = { base: "EUR" as const, date: "2026-09-28", rates: { EUR: 1, TRY: 40 } };
    const d = decideGroup([eur, tl], makeContext(trip({ budget: { amount: 1500, currency: "EUR" } }), [eur, tl], { rates }));
    const lira = d.options.find((o) => o.item.name === "Lira Hotel")!;
    expect(lira.parts.find((p) => p.criterion === "price")!.display).toBe("€225 (₺9.000)");
    expect(d.winner?.item.name).toBe("Lira Hotel");
    const noRates = decideGroup([eur, tl], makeContext(trip({ budget: { amount: 1500, currency: "EUR" } }), [eur, tl]));
    expect(noRates.options.find((o) => o.item.name === "Lira Hotel")!.score).toBeNull();
  });

  it("scores flights on stops, times and baggage", () => {
    const flight = (name: string, stops: number, dep: string, arr: string, bag: boolean, amount: number) =>
      item(name, {
        category: "flight", needKey: "flight:ist-opo", price: price(amount), dates: { start: "2026-10-08", end: null, source: "page" },
        flight: { from: "IST", to: "OPO", departure: `2026-10-08T${dep}`, arrival: `2026-10-08T${arr}`, carrier: null, flightNumber: null, stops },
        metrics: { checkedBagIncluded: bag, durationMinutes: stops ? 420 : 240 },
      });
    const direct = flight("Direkt sabah", 0, "09:10", "12:10", true, 180);
    const cheap = flight("Gece aktarmalı", 1, "02:30", "09:30", false, 120);
    const d = decideGroup([direct, cheap], makeContext(trip(), [direct, cheap]));
    expect(d.winner?.item.name).toBe("Direkt sabah");
    expect(d.criteria).toEqual(expect.arrayContaining(["price", "stops", "schedule", "baggage", "duration"]));
    expect(advantageOver(d.options[1], d.winner!, "EUR")).toBe("€60 daha ucuz");
  });

  it("marks an option another one beats on price and everything else as safe to drop", () => {
    const best = item("Best", { price: price(200), rating: rating(9.2, 10, 900), metrics: { cancellationType: "free" }, geo: { lat: 41.1455, lng: -8.611, source: "page" } });
    const worse = item("Worse", { price: price(260), rating: rating(8.1, 10, 900), metrics: { cancellationType: "non_refundable" }, geo: { lat: 41.1620, lng: -8.5890, source: "page" } });
    const tradeoff = item("Tradeoff", { price: price(150), rating: rating(7.9, 10, 900), metrics: { cancellationType: "free" }, geo: { lat: 41.1455, lng: -8.611, source: "page" } });
    const all = [best, worse, tradeoff, ...POIS];
    const d = decideGroup([best, worse, tradeoff], makeContext(trip(), all));
    const find = (n: string) => d.options.find((o) => o.item.name === n)!;
    expect(find("Worse").dominatedBy).toBe("Best");
    expect(find("Tradeoff").dominatedBy).toBeNull(); // cheaper: a real trade-off, not dominated
    expect(find("Best").dominatedBy).toBeNull();
  });

  it("scores eSIM data against the trip length", () => {
    const esim = (name: string, amount: number, metrics: Partial<ItemMetrics>) =>
      item(name, { category: "esim", needKey: "esim:pt", price: price(amount), dates: { start: null, end: null, source: "none" }, metrics });
    const small = esim("1 GB", 5, { dataGb: 1, validityDays: 7 });
    const plenty = esim("Sınırsız", 12, { unlimitedData: true, validityDays: 7 });
    const d = decideGroup([small, plenty], makeContext(trip(), [small, plenty]));
    const data = (o: string) => d.options.find((x) => x.item.name === o)!.parts.find((p) => p.criterion === "data")!;
    expect(data("1 GB").display).toBe("1 GB (günde ~0,3 GB)");
    expect(data("Sınırsız").s).toBe(1);
    expect(d.winner?.item.name).toBe("Sınırsız");
  });

  it("uses the AI score only when the analysis matches the current inputs", () => {
    const { jardim, casa } = portoStays();
    const ctxFor = (analysis?: Analysis) => makeContext(trip(), [jardim, casa, ...POIS], { analyses: analysis ? [analysis] : [] });
    const plain = decideGroup([jardim, casa], ctxFor());
    const analysis: Analysis = {
      key: "t|stay@2026-10-08_2026-10-11", tripId: "t", needKey: "stay@2026-10-08_2026-10-11", inputHash: plain.inputHash, createdAt: 1,
      verdict: "", reasons: [], tradeoffs: [], risks: [], question: null,
      aiScores: [{ itemId: jardim.id, score: 6, note: "gece gürültüsü" }, { itemId: casa.id, score: 9, note: "sakin" }],
    };
    const fresh = decideGroup([jardim, casa], ctxFor(analysis));
    expect(fresh.analysis).not.toBeNull();
    expect(fresh.criteria).toContain("ai");
    expect(fresh.inputHash).toBe(plain.inputHash);
    const stale = decideGroup([jardim, casa], ctxFor({ ...analysis, inputHash: "old" }));
    expect(stale.analysis).toBeNull();
    expect(stale.criteria).not.toContain("ai");
  });
});
