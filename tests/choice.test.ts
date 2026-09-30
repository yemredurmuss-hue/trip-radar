// The decision as the traveller weighs it: a price whose scope isn't known isn't compared, an amenity
// the page doesn't mention is unknown (not missing), one guest's serious complaint is a thing to check,
// a note asks for its own criterion, a must the page answers the other way rules a place out, and the
// board shows the strongest option for each thing that matters with what it costs against the cheapest
// one that fits.
import { describe, expect, it } from "vitest";
import { choiceOf, tradeText } from "../src/lib/choice";
import { amenityState, decideGroup, levelFor, levelSource, makeContext, ratingOutOf10, saidTopics, type GroupDecision } from "../src/lib/decision";
import { textId } from "../src/lib/evidence";
import { EMPTY_METRICS, listingKeyOf } from "../src/lib/items";
import { checkNeeds } from "../src/lib/needs";
import type { Finding, Item, ItemMetrics, Listing, Trip } from "../src/lib/types";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t", title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over,
});

let seq = 0;
function stay(name: string, amount: number | null, over: Omit<Partial<Item>, "metrics"> & { metrics?: Partial<ItemMetrics> } = {}): Item {
  const { metrics, ...rest } = over;
  return {
    id: `s${++seq}`, tripId: "t", captureIds: [], key: `test:${name}`, category: "stay", needKey: "stay:porto", name, provider: "Booking.com",
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: "2026-10-08", end: "2026-10-11", source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: "Ücretsiz iptal", freeUntil: "2026-10-05", source: "page" },
    rating: { value: 8.8, scale: 10, count: 400, source: "page" }, flight: null,
    metrics: { ...EMPTY_METRICS, ...metrics }, geo: null, highlights: [], concerns: [], reviewSummary: null, missing: [],
    status: "saved", statusNote: null, createdAt: 1, updatedAt: 1, ...rest,
  };
}
const at = (lat: number, lng: number) => ({ geo: { lat, lng, source: "page" } as Item["geo"] });
const poi = (name: string, lat: number, lng: number) => stay(name, 10, { category: "activity", needKey: "activity:porto", dates: { start: null, end: null, source: "none" }, ...at(lat, lng) });

type Said = [string, Finding["polarity"], Finding["topic"], Finding["severity"], number, Finding["source"]?];
function read(item: Item, findings: Said[]): Listing {
  return {
    key: listingKeyOf(item), name: item.name, reviewTotal: 100,
    reviews: Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, text: `yorum ${i}`, date: "2026-08", captureId: "c" })),
    findings: findings.map(([text, polarity, topic, severity, n, source]) => ({
      id: `${topic}:${polarity}:${textId(text)}`, text, polarity, topic, source: source ?? "reviews", severity,
      reviewIds: Array.from({ length: n }, (_, i) => `r${i}`), quotes: n ? [] : ["q"], verified: true,
    })),
    readCaptureIds: ["c"], readAt: 1, dropped: 0, error: null, errorAt: null, updatedAt: 1,
  } as Listing;
}

function decide(t: Trip, items: Item[], listings: Listing[] = [], preferences: string[] = []): GroupDecision {
  const ctx = makeContext(t, items, { listings: new Map(listings.map((l) => [l.key, l])), preferences, today: "2026-09-30" });
  return decideGroup(items.filter((i) => i.category === "stay"), ctx, "stay@2026-10-08_2026-10-11");
}
const ctxOf = (t: Trip, items: Item[], listings: Listing[] = [], preferences: string[] = []) =>
  makeContext(t, items, { listings: new Map(listings.map((l) => [l.key, l])), preferences, today: "2026-09-30" });
const ranking = (d: GroupDecision) => d.options.map((o) => [o.item.name, o.fit]);

/** The Porto pair: Casa Ribeira central with a kitchen but bar noise; Bonfim Loft quiet and €60 cheaper, kitchen not listed. */
function porto(over: Partial<Trip> = {}) {
  const t = trip({ wantedAmenities: ["mutfak"], ...over });
  const casa = stay("Casa Ribeira", 390, { rating: { value: 9, scale: 10, count: 500, source: "page" }, metrics: { amenities: ["mutfak"] }, ...at(41.1409, -8.6133) });
  const bonfim = stay("Bonfim Loft", 330, { provider: "Airbnb", rating: { value: 4.9, scale: 5, count: 120, source: "page" }, ...at(41.1478, -8.5905) });
  const items = [casa, bonfim, poi("Livraria Lello", 41.1469, -8.6149), poi("Majestic Café", 41.1473, -8.6066)];
  const listings = [
    read(casa, [["Gece bar gürültüsü", "negative", "noise", "medium", 3], ["Balkondan nehir manzarası", "positive", "view", "medium", 2]]),
    read(bonfim, [["Sessiz sokak", "positive", "noise", "medium", 4]]),
  ];
  return { t, casa, bonfim, items, listings };
}

describe("what's true before any preference", () => {
  it("doesn't compare a stay's price until it's clear what it's for", () => {
    const aliados = stay("Hotel Aliados", 95, { price: { amount: 95, currency: "EUR", scope: "unknown", taxesIncluded: "unknown", source: "page", observedAt: 1 } });
    const batalha = stay("Hotel Batalha", 300);
    const d = decide(trip(), [aliados, batalha]);
    // €95 may be a night (€285) or all three: it doesn't win on it, it waits to be checked.
    expect(ranking(d)).toEqual([["Hotel Batalha", "fit"], ["Hotel Aliados", "check"]]);
    expect(d.options[1].fitNotes).toEqual(["fiyat netleşmedi: toplam mı, gecelik mi?"]);
    const choice = choiceOf(d, ctxOf(trip(), [aliados, batalha]));
    expect(choice.verify).toEqual([{ itemId: aliados.id, name: "Hotel Aliados", what: "fiyat netleşmedi: toplam mı, gecelik mi?" }]);
  });

  it("says an amenity is missing only when the page says so; a must missing rules a place out", () => {
    const { t, casa, bonfim, items, listings } = porto({ requirements: [{ kind: "amenity", amenity: "mutfak" }] });
    const rua = stay("Rua das Flores", 300, at(41.1437, -8.612));
    const all = [...items, rua];
    const pages = [...listings, read(rua, [["Mutfak yok, yalnız su ısıtıcısı", "negative", "amenities", "medium", 0, "description"]])];
    const ctx = ctxOf(t, all, pages);
    expect([casa, bonfim, rua].map((i) => amenityState(i, "mutfak", ctx))).toEqual(["yes", "unknown", "no"]);
    const d = decide(t, all, pages);
    expect(ranking(d)).toEqual([["Casa Ribeira", "fit"], ["Bonfim Loft", "check"], ["Rua das Flores", "unfit"]]);
    expect(d.options.find((o) => o.item.id === bonfim.id)!.fitNotes).toEqual(["mutfak yazmıyor"]);
    expect(d.options.find((o) => o.item.id === rua.id)!.fitNotes).toEqual(["şart karşılanmıyor: mutfak"]);
    // The card says the same three states.
    expect(checkNeeds(rua, undefined, [], ctx, pages[2]).map((n) => n.text)).toContain("Mutfak yok");
  });

  it("holds one guest's serious complaint as a thing to check, not points off", () => {
    const infante = stay("Hotel Infante", 280, { rating: { value: 9.1, scale: 10, count: 900, source: "page" } });
    const carmo = stay("Hotel Carmo", 300, { rating: { value: 8.5, scale: 10, count: 600, source: "page" } });
    const pages = [read(infante, [["Yatakta tahtakurusu", "negative", "cleanliness", "high", 1]]), read(carmo, [])];
    const d = decide(trip(), [infante, carmo], pages);
    const mine = d.options.find((o) => o.item.id === infante.id)!;
    expect(mine.penalties).toEqual([]);
    expect(mine.fit).toBe("check");
    expect(mine.fitNotes).toEqual(["1 misafir bildirmiş: yatakta tahtakurusu"]);
    // Second, marked as the cheaper one, with what to check before choosing it.
    const choice = choiceOf(d, ctxOf(trip(), [infante, carmo], pages));
    expect(choice.ranked.map((r) => [r.rank, r.option.item.name, r.badges])).toEqual([
      [1, "Hotel Carmo", []],
      [2, "Hotel Infante", ["En ekonomik"]],
    ]);
    expect(choice.headline).toBe("Önerim Hotel Carmo. Tasarruf için 2. Hotel Infante (€20 daha ucuz).");
    expect(choice.verify.map((v) => v.what)).toEqual(["1 misafir bildirmiş: yatakta tahtakurusu"]);
  });

  it("uses one review scale everywhere: Airbnb's 4,3 is about 7,3 out of 10, not 8,6", () => {
    const airbnb = stay("Loft", 300, { provider: "Airbnb", rating: { value: 4.3, scale: 5, count: 200, source: "page" } });
    expect(ratingOutOf10(airbnb)).toEqual({ value: 7.25, calibrated: true });
    const t = trip({ priorities: { rating: 3 } });
    const ctx = ctxOf(t, [airbnb]);
    expect(checkNeeds(airbnb, undefined, [], ctx).find((n) => n.key === "c:rating")).toMatchObject({ state: "no", text: "Puan 4,3/5 (≈7,3/10)" });
  });

  it("covers only some nights: partial, after the ones that cover them all", () => {
    const t = trip({ confirmedDates: { start: "2026-10-07", end: "2026-10-12" } });
    const whole = stay("Flat Miragaia", 500, { dates: { start: "2026-10-07", end: "2026-10-12", source: "url" } });
    const part = stay("Flat Sé", 180, { dates: { start: "2026-10-07", end: "2026-10-09", source: "url" }, rating: { value: 9.2, scale: 10, count: 400, source: "page" } });
    const ctx = makeContext(t, [whole, part], { today: "2026-09-30" });
    const d = decideGroup([whole, part], ctx, "stay@2026-10-07_2026-10-12");
    expect(ranking(d)).toEqual([["Flat Miragaia", "fit"], ["Flat Sé", "partial"]]);
    expect(d.options[1].fitNotes).toEqual(["yalnız 2/5 gece; kalan 3 gece için ayrı yer gerekir"]);
  });

  it("rules out what goes over the ceiling they won't cross", () => {
    const { casa, bonfim, items, listings } = porto();
    const flight = stay("Uçuş", 200, { category: "flight", needKey: "flight:ist-opo", status: "booked", dates: { start: "2026-10-08", end: null, source: "page" } });
    const t = trip({ wantedAmenities: ["mutfak"], budget: { amount: 500, currency: "EUR", ceiling: 560 } });
    const d = decide(t, [...items, flight], listings);
    // €200 already booked: Casa's €390 would make €590, over €560; Bonfim's €330 fits.
    expect(d.options.find((o) => o.item.id === casa.id)).toMatchObject({ fit: "unfit", fitNotes: ["bütçe tavanını €30 aşar"] });
    expect(d.options.find((o) => o.item.id === bonfim.id)!.fit).toBe("fit");
  });
});

describe("what they ask for, and how strongly", () => {
  it("makes a note its own criterion, 'Önemli', unless they said otherwise", () => {
    const said = saidTopics(["Sessiz bir yer istiyoruz"]);
    expect(levelFor(trip(), "stay", "quiet", undefined, said)).toBe(3);
    expect(levelSource(trip(), "stay", "quiet", undefined, said)).toBe("said");
    expect(levelFor(trip(), "stay", "quiet")).toBe(0);
    expect(levelFor(trip({ priorities: { quiet: 1 } }), "stay", "quiet", undefined, said)).toBe(1);
    const { t, items, listings } = porto();
    const d = decide(t, items, listings, ["Sessiz bir yer istiyoruz"]);
    expect(d.options.map((o) => [o.item.name, o.parts.find((p) => p.criterion === "quiet")?.display])).toEqual([
      ["Casa Ribeira", "Gece bar gürültüsü · 3 yorum"],
      ["Bonfim Loft", "Sessiz sokak · 4 yorum"],
    ]);
  });

  it("'kesinlikle gürültü olmasın' rules out a place several guests call noisy", () => {
    const { t, casa, items, listings } = porto({ requirements: [{ kind: "avoid", topic: "noise" }] });
    const d = decide(t, items, listings);
    expect(d.options.find((o) => o.item.id === casa.id)).toMatchObject({ fit: "unfit", fitNotes: ["şart karşılanmıyor: gürültü olmasın"] });
  });
});

describe("the choice", () => {
  it("numbers every option best first, says what each is strongest on and why it stands where it does", () => {
    const { t, items, listings } = porto();
    const notes = ["Sessiz bir yer istiyoruz"];
    const d = decide(t, items, listings, notes);
    const choice = choiceOf(d, ctxOf(t, items, listings, notes));
    expect(choice.ranked.map((r) => [r.rank, r.option.item.name, r.badges, r.lenses])).toEqual([
      [1, "Casa Ribeira", ["En iyi konum"], ["konum"]],
      [2, "Bonfim Loft", ["En ekonomik", "En sessiz"], ["tasarruf", "sessizlik"]],
    ]);
    const [casa, bonfim] = choice.ranked;
    // The first against the second; every other one against the first; shortfalls from its own side.
    expect([casa.vsRank, bonfim.vsRank]).toEqual([2, 1]);
    expect(tradeText(casa.trade!, "EUR")).toBe("+€60 (gecelik +€20) · 15 dk daha yakın, mutfak var, yorumlar daha iyi (9/10 – 4,9/5) · eksiği: gece bar gürültüsü · 3 yorum");
    expect(tradeText(bonfim.trade!, "EUR")).toBe("€60 daha ucuz (gecelik −€20) · sessiz sokak · 4 yorum · eksiği: 15 dk daha uzak, mutfak yazmıyor, yorumları daha zayıf (4,9/5 – 9/10)");
    expect(choice.headline).toBe(
      "Önerim Casa Ribeira: en iyi konum; €60 fazlasına mutfak var ve yorumlar daha iyi (9/10 – 4,9/5). Tasarruf ve sessizlik için 2. Bonfim Loft (€60 daha ucuz).",
    );
  });

  it("puts the ones that fit first, then the ones to check, partial, out; and doesn't call equal prices cheaper", () => {
    const a = stay("Hotel A", 300, { rating: { value: 9, scale: 10, count: 500, source: "page" } });
    const b = stay("Hotel B", 300, { rating: { value: 8.2, scale: 10, count: 500, source: "page" } });
    const d = decide(trip(), [a, b]);
    const choice = choiceOf(d, ctxOf(trip(), [a, b]));
    expect(choice.ranked.map((r) => [r.rank, r.option.item.name, r.badges])).toEqual([
      [1, "Hotel A", []],
      [2, "Hotel B", []],
    ]);
    expect(choice.headline).toBe("Önerim Hotel A: yorumlar daha iyi (9/10 – 8,2/10).");
    const cheaper = stay("Hotel C", 250, { rating: { value: 9.2, scale: 10, count: 500, source: "page" } });
    const d2 = decide(trip(), [cheaper, b]);
    expect(choiceOf(d2, ctxOf(trip(), [cheaper, b])).headline).toBe("Önerim Hotel C: en ekonomik; yorumlar daha iyi (9,2/10 – 8,2/10).");
  });
});
