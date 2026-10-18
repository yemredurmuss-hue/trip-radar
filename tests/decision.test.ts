import { describe, expect, it } from "vitest";
import { advantageOver, cancellationType, decideGroup, levelFor, makeContext, resetPriorities, withPriorities } from "../src/lib/decision";
import { activeSignals, inferSignals, toInferred, pendingSignals } from "../src/lib/intent";
import { budgetState, rolesOf, valueCard } from "../src/lib/value";
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
    expect(d.reasons[0].text).toMatch(/^Konum: kaydettiğin 2 yere \d+ dk yürüme; Casa Azul: \d+ dk yürüme$/);
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

  it("scores an option without its price provisionally, after complete ones, and says what is missing", () => {
    const { jardim } = portoStays();
    const noPrice = item("Mystery Loft", { rating: rating(9.6, 10, 800) });
    const d = decideGroup([jardim, noPrice], makeContext(trip(), [jardim, noPrice]));
    const mystery = d.options.find((o) => o.item.name === "Mystery Loft")!;
    expect(mystery.score).not.toBeNull();
    expect(mystery.limited).toEqual(["fiyat"]);
    expect(mystery.missing[0]).toBe("fiyat");
    // Missing information limits the verdict instead of stopping it.
    expect(d.status).toBe("ok");
    expect(d.winner?.item.name).toBe("Jardim Stay");
    expect(d.summary).toContain("Mystery Loft: fiyat eksik, gelince yeniden tartılır.");
  });

  it("prices a stay saved without dates for its group's nights, and keeps it provisional", () => {
    const { jardim } = portoStays();
    const undated = item("Airbnb loft", {
      provider: "Airbnb", dates: { start: null, end: null, source: "none" },
      price: { amount: 80, currency: "EUR", scope: "per_night", taxesIncluded: "unknown", source: "page", observedAt: 1 },
      rating: rating(4.9, 5, 300),
    });
    const ctx = makeContext(trip({ confirmedDates: { start: "2026-10-01", end: "2026-10-20" } }), [jardim, undated]);
    const d = decideGroup([jardim, undated], ctx, "stay@2026-10-08_2026-10-11");
    const loft = d.options.find((o) => o.item.name === "Airbnb loft")!;
    expect(loft.parts.find((p) => p.criterion === "price")!.value).toBe(240); // €80 × 3 nights, not × the whole trip
    expect(loft.limited).toEqual(["bu gecelerin fiyatı"]);
    expect(d.options[0].item.name).toBe("Jardim Stay"); // complete options first
  });

  it("still says what is missing when too little is known to score", () => {
    const bare = (name: string) => item(name, { price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: 0 } });
    const d = decideGroup([bare("A"), bare("B")], makeContext(trip(), []));
    expect(d.status).toBe("insufficient");
    expect(d.options.every((o) => o.score == null)).toBe(true);
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
    const provisional = noRates.options.find((o) => o.item.name === "Lira Hotel")!;
    expect(provisional.limited).toEqual(["kur bilgisi"]);
    expect(noRates.options[0].item.name).toBe("Euro Hotel");
    expect(noRates.summary).toContain("Lira Hotel: kur bilgisi eksik");
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

describe("requirements", () => {
  it("never recommends an option that breaks a hard requirement, and flags unknowns", () => {
    const { jardim, casa, ribeira } = portoStays();
    const all = [jardim, casa, ribeira, ...POIS];
    const t = trip({ requirements: [{ kind: "free_cancellation" }, { kind: "amenity", amenity: "mutfak" }], priorities: { rating: 4 } });
    const d = decideGroup([jardim, casa, ribeira], makeContext(t, all));
    const find = (n: string) => d.options.find((o) => o.item.name === n)!;
    expect(find("Ribeira Rooms").unmet).toEqual(["ücretsiz iptal"]); // non-refundable
    expect(d.winner?.item.name).not.toBe("Ribeira Rooms");
    expect(d.options.findIndex((o) => o.item.name === "Ribeira Rooms")).toBe(2); // after compliant ones
    expect(find("Jardim Stay").unsure).toEqual(["mutfak"]); // not listed on the page ≠ absent
    expect(d.summary).toContain("Ribeira Rooms şartına uymuyor (ücretsiz iptal)");
  });

  it("checks walking distance and direct flights", () => {
    const { jardim, casa } = portoStays();
    const d = decideGroup([jardim, casa], makeContext(trip({ requirements: [{ kind: "max_walk", minutes: 15 }] }), [jardim, casa, ...POIS]));
    expect(d.options.find((o) => o.item.name === "Casa Azul")!.unmet).toEqual(["en fazla 15 dk yürüme"]);
    expect(d.winner?.item.name).toBe("Jardim Stay");
  });
});

describe("intent", () => {
  it("lets what the traveller said win over a signal, and a signal over the default", () => {
    const inferred = new Map([["stay:location", { delta: -1, evidence: "x" }]]);
    expect(levelFor(trip(), "stay", "location")).toBe(3);
    expect(levelFor(trip(), "stay", "location", inferred)).toBe(2);
    expect(levelFor(trip({ priorities: { location: 4 } }), "stay", "location", inferred)).toBe(4);
    expect(levelFor(trip(), "stay", "rating", new Map([["stay:rating", { delta: 1, evidence: "x" }]]))).toBe(3);
  });

  it("learns from choosing against the engine: paying more for location, or saving money", () => {
    const { jardim, casa } = portoStays();
    // Engine prefers Jardim; picking Casa (cheaper, farther) says price matters, location less.
    const choseCasa = [jardim, { ...casa, status: "chosen" as const }, ...POIS];
    const cheap = inferSignals(choseCasa, makeContext(trip(), choseCasa));
    expect(cheap.map((s) => s.id).sort()).toEqual(["stay:location:down", "stay:price:up"]);
    expect(cheap[0].evidence).toContain("Seçimin Casa Azul, Jardim Stay yerine: €45 daha ucuz");
    // With location unimportant the engine prefers Casa; picking Jardim then says location matters.
    const t = trip({ priorities: { location: 0 } });
    const choseJardim = [{ ...jardim, status: "chosen" as const }, casa, ...POIS];
    const signals = inferSignals(choseJardim, makeContext(t, choseJardim));
    expect(signals.map((s) => s.id).sort()).toEqual(["stay:location:up", "stay:price:down"]);
    // A guess changes nothing until confirmed: it's a question first ("Fiyat senin için ikinci planda mı?").
    expect(activeSignals(signals, t)).toEqual([]);
    expect(pendingSignals(signals, t).map((s) => s.id)).toEqual(["stay:price:down"]);
    expect(pendingSignals(signals, t)[0].question).toBe("Fiyat senin için ikinci planda mı?");
    // Confirmed, it counts; but an explicit setting always wins (location was said), and "Hayır" drops it.
    const confirmed = { ...t, confirmedSignals: ["stay:price:down", "stay:location:up"] };
    expect(activeSignals(signals, confirmed).map((s) => s.id)).toEqual(["stay:price:down"]);
    expect(activeSignals(signals, { ...confirmed, ignoredSignals: ["stay:price:down"] })).toEqual([]);
  });

  it("reads patterns in saved stays only with enough evidence", () => {
    const near = (name: string) => item(name, { geo: { lat: 41.1462, lng: -8.6112, source: "page" } });
    const centers = { cityCenters: { "porto, portekiz": { lat: 41.1496, lng: -8.6109 } } };
    const three = [near("A"), near("B"), near("C")];
    expect(inferSignals(three, makeContext(trip(), three, centers))).toEqual([]);
    const four = [...three, near("D")];
    const [s] = inferSignals(four, makeContext(trip(), four, centers));
    expect(s).toMatchObject({ id: "stay:location:up", evidence: "Kaydettiğin 4 konaklamadan 4 tanesi 15 dk yürüme içinde" });
    // Applied as a one-step nudge, visible in the context.
    expect(toInferred([s]).get("stay:location")?.delta).toBe(1);
  });
});

describe("value card", () => {
  it("says what the extra money buys, why it's worth it for this traveller, and what would change it", () => {
    const { jardim, casa } = portoStays();
    const all = [jardim, casa, ...POIS];
    const t = trip({ budget: { amount: 1000, currency: "EUR" }, priorities: { location: 4 } });
    const ctx = makeContext(t, all);
    const d = decideGroup([jardim, casa], ctx);
    const card = valueCard(d, ctx, budgetState(null, all, ctx))!;
    expect(card.pick.item.name).toBe("Jardim Stay");
    expect(card.priceDiff).toBe(45);
    expect(card.because).toMatch(/^Konum senin için "Çok önemli": €45 fazlasına her yolda ~\d+ dk daha yakın; günde bir gidiş-dönüşle 3 gecede ~\d+ saat \(saat başı ~€\d+\)/);
    expect(card.unless).toBe("Konum o kadar önemli değilse Casa Azul: €45 cebinde kalır.");
    expect(card.budget).toBe("Bununla kalan bütçe €715 (Casa Azul ile €760)");
  });

  it("doesn't count the current choice twice, and says so when the traveller chose differently", () => {
    const { jardim, casa } = portoStays();
    const chosenCasa = { ...casa, status: "chosen" as const };
    const all = [jardim, chosenCasa, ...POIS];
    const ctx = makeContext(trip({ budget: { amount: 1000, currency: "EUR" } }), all);
    const d = decideGroup([jardim, chosenCasa], ctx);
    const card = valueCard(d, ctx, budgetState(null, all, ctx))!;
    expect(card.budget).toBe("Bununla kalan bütçe €715 (Casa Azul ile €760)");
    expect(card.chosenOther).toMatch(/^Seçimin: Casa Azul \(€45 daha ucuz, daha iyi yorumlar\)\. Önceliklerine göre Jardim Stay \d+ puan önde; karar senin\.$/);
  });

  it("explains a cheaper winner and a tie without inventing a trade-off", () => {
    const a = item("A", { price: price(100), rating: rating(9, 10, 500) });
    const b = item("B", { price: price(101), rating: rating(9, 10, 500) });
    const tieCtx = makeContext(trip(), [a, b]);
    const tie = valueCard(decideGroup([a, b], tieCtx), tieCtx, null)!;
    expect(tie.tie).toBe(true);
    expect(tie.because).toContain("A ile B başa baş.");
    const cheap = item("Cheap", { price: price(80), rating: rating(9.1, 10, 500) });
    const ctx = makeContext(trip(), [cheap, b]);
    const card = valueCard(decideGroup([cheap, b], ctx), ctx, null)!;
    expect(card.because).toMatch(/^Hem €21 daha ucuz hem /);
  });

  it("takes a stance on a tie: the cheaper of two level options is the better value", () => {
    // Level on the priorities: one is central, the other €50 cheaper.
    const central = item("Central", { price: price(300), rating: rating(8.8, 10, 500), geo: { lat: 41.1462, lng: -8.6125, source: "page" }, metrics: { cancellationType: "free" } });
    const cheaper = item("Cheaper", { price: price(250), rating: rating(9.0, 10, 500), geo: { lat: 41.155, lng: -8.602, source: "page" }, metrics: { cancellationType: "free" } });
    const ctx = makeContext(trip(), [central, cheaper, ...POIS]);
    const d = decideGroup([central, cheaper], ctx);
    expect(d.status).toBe("tie");
    const card = valueCard(d, ctx, null)!;
    expect(card.kicker).toBe("Fiyat/performans");
    expect(card.pick.item.name).toBe("Cheaper");
    expect(card.because).toMatch(/^Puanlar başa baş \(\d+–\d+\); Cheaper €50 daha ucuz, fiyat\/performans onda\./);
    expect(card.unless).toMatch(/senin için daha önemliyse Central\.$/);
    const roles = rolesOf(d);
    expect(roles.get(cheaper.id)).toContain("Fiyat/performans");
    expect(roles.get(central.id)).toContain("En iyi konum");
  });
});

describe("what the traveller asked for weighs in, and every card checks it", () => {
  // "Mutfak şart": a kitchen said as a requirement counts in the score too, not only as a filter.
  it("a required amenity scores; the card says it's there, or that the page doesn't say", async () => {
    const { needsFor } = await import("../src/lib/cardFacts");
    const withKitchen = item("Kitchen Loft", { price: price(300), metrics: { amenities: ["mutfak"] } });
    const without = item("Plain Room", { price: price(300) });
    const t = trip({ requirements: [{ kind: "amenity", amenity: "mutfak" }] });
    const ctx = makeContext(t, [withKitchen, without]);
    expect(levelFor(t, "stay", "amenities")).toBeGreaterThan(0);
    const d = decideGroup([withKitchen, without], ctx);
    expect(d.winner?.item.name).toBe("Kitchen Loft");
    expect(needsFor(withKitchen, d, ctx).map((n) => [n.state, n.text])).toEqual([["yes", "Mutfak var"]]);
    expect(needsFor(without, d, ctx).map((n) => [n.state, n.text])).toEqual([["unknown", "Mutfak yazmıyor"]]);
  });
});

describe("sifting what was read: facts aren't minuses, one review isn't a verdict, only the traveller rules out", () => {
  it("keeps the usual check-in hour and 'no information' out; an odd hour or a complaint stays", async () => {
    const { isInfoFinding } = await import("../src/lib/listing");
    expect(isInfoFinding({ topic: "check_in", text: "Giriş saati 16" })).toBe(true);
    expect(isInfoFinding({ topic: "check_in", text: "Check-in 15:00'ten itibaren" })).toBe(true);
    expect(isInfoFinding({ topic: "access", text: "Binalarda asansör bilgisi yok" })).toBe(true);
    expect(isInfoFinding({ topic: "check_in", text: "En geç giriş 20:00" })).toBe(false); // a late arrival needs to know
    expect(isInfoFinding({ topic: "check_in", text: "Giriş zor, kimse yoktu" })).toBe(false);
    expect(isInfoFinding({ topic: "noise", text: "Hafta sonu gürültü" })).toBe(false);
  });

  it("never rules a place out on what was read alone; the traveller's 'Önemli, kalsın' does, 'sorun değil' wins", async () => {
    const { dealbreakersOf } = await import("../src/lib/decision");
    const { emptyListing } = await import("../src/lib/listing");
    const place = item("Loud Flat", { price: price(200) });
    const reviews = ["r1", "r2"].map((id) => ({ id, text: "construction", date: "2026-09", captureId: "c" }));
    const f = (reviewIds: string[], source: "reviews" | "description" = "reviews") => ({
      id: `condition:negative:${reviewIds.length}${source}`, text: "Yan binada inşaat", polarity: "negative" as const, topic: "condition" as const,
      source, severity: "high" as const, reviewIds, quotes: source === "description" ? ["building works next door"] : [], verified: true,
    });
    const listingWith = (finding: ReturnType<typeof f>) => ({ ...emptyListing(place, 1), readAt: 1, reviews, findings: [finding] });
    const ctxWith = (finding: ReturnType<typeof f>, over: Partial<Trip> = {}) => {
      const l = listingWith(finding);
      return makeContext(trip(over), [place], { listings: new Map([[l.key, l]]), today: "2026-09-30" });
    };
    const key = `${listingWith(f(["r1", "r2"])).key}#condition:negative`;
    expect(dealbreakersOf(place, ctxWith(f(["r1"])))).toHaveLength(0); // one angry review
    expect(dealbreakersOf(place, ctxWith(f(["r1", "r2"])))).toHaveLength(0); // two: points off, not out
    expect(dealbreakersOf(place, ctxWith(f([], "description")))).toHaveLength(0);
    expect(dealbreakersOf(place, ctxWith(f(["r1", "r2"]), { confirmedFindings: [key] }))).toHaveLength(1);
    // "Sorun değil" wins.
    expect(dealbreakersOf(place, ctxWith(f(["r1", "r2"]), { confirmedFindings: [key], acceptedFindings: [key] }))).toHaveLength(0);
    // Unconfirmed, it costs points once (not in "Yorum ve detaylar" as well) and stays in the race.
    const other = item("Quiet Flat", { price: price(260) });
    const l = listingWith(f(["r1", "r2"]));
    const decide = (over: Partial<Trip> = {}) =>
      decideGroup([place, other], makeContext(trip(over), [place, other], { listings: new Map([[l.key, l]]), today: "2026-09-30" }));
    const loud = decide().options.find((o) => o.item.name === "Loud Flat")!;
    expect(loud).toMatchObject({ eliminated: null, fit: "fit" });
    expect(loud.penalties.map((p) => p.text)).toEqual(["Yan binada inşaat"]);
    // Confirmed by the traveller: out, last, with the reason.
    expect(decide({ confirmedFindings: [key] }).options.at(-1)).toMatchObject({
      item: { name: "Loud Flat" },
      fit: "unfit",
      eliminated: { reason: "Yan binada inşaat (2 yorum); önemli dedin" },
    });
  });
});

describe("cancellation read from its words", () => {
  it("knows 'İade yok' with a capital İ, and English in capitals", () => {
    const item = (summary: string) => ({ cancellation: { summary, freeUntil: null, source: "page" }, metrics: { ...EMPTY_METRICS } }) as unknown as Item;
    expect(cancellationType(item("İade yok"))).toBe("non_refundable");
    expect(cancellationType(item("İADE EDİLMEZ"))).toBe("non_refundable");
    expect(cancellationType(item("FREE CANCELLATION"))).toBe("free");
    expect(cancellationType(item("PARTIAL REFUND"))).toBe("partial");
  });
});
