import { describe, expect, it } from "vitest";
import { decideGroup, makeContext } from "../src/lib/decision";
import { EMPTY_METRICS } from "../src/lib/items";
import { prosCons, prosConsFor } from "../src/lib/proscons";
import type { Analysis, Finding, Item, ItemMetrics, Listing, Trip } from "../src/lib/types";

const TODAY = "2026-09-29";
const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t", title: "Portekiz", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1, ...over,
});

let seq = 0;
function item(name: string, over: Omit<Partial<Item>, "metrics"> & { metrics?: Partial<ItemMetrics> } = {}): Item {
  const { metrics, ...rest } = over;
  return {
    id: `p${++seq}`, tripId: "t", captureIds: ["c"], key: null, category: "stay", needKey: "stay:porto", name, provider: null,
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
const price = (amount: number) => ({ amount, currency: "EUR", scope: "total" as const, taxesIncluded: "yes" as const, source: "page" as const, observedAt: 1 });

const finding = (over: Partial<Finding> & Pick<Finding, "text" | "polarity" | "topic">): Finding => ({
  id: `${over.topic}:${over.polarity}:${over.text.length}`,
  source: "reviews",
  severity: "medium",
  reviewIds: [],
  quotes: [],
  verified: true,
  ...over,
});
const listing = (key: string, findings: Finding[], reviews: Listing["reviews"] = []): Listing => ({
  key, name: key, reviews, reviewTotal: 96, findings, readCaptureIds: ["c"], readAt: 1, dropped: 0, error: null, errorAt: null, updatedAt: 1,
});

type Scene = { casa: Item; construction: Finding };

function scene(analysisFor?: (s: Scene) => Partial<Analysis>, over: (s: Scene) => Partial<Trip> = () => ({})) {
  const jardim = item("Jardim Stay", { price: price(285), geo: { lat: 41.1455, lng: -8.611, source: "page" }, metrics: { cancellationType: "free" }, cancellation: { summary: "5 Eki'ye kadar ücretsiz iptal", freeUntil: "2026-10-05", source: "page" } });
  const casa = item("Casa Azul", { price: price(240), geo: { lat: 41.162, lng: -8.589, source: "page" }, metrics: { cancellationType: "free" } });
  const ribeira = item("Ribeira Rooms", { price: price(330), geo: { lat: 41.141, lng: -8.613, source: "page" }, metrics: { cancellationType: "non_refundable" }, cancellation: { summary: "İade yok", freeUntil: null, source: "page" } });
  const pois = [
    item("Livraria Lello", { category: "activity", needKey: "activity:porto", geo: { lat: 41.1469, lng: -8.6149, source: "page" } }),
    item("Majestic Café", { category: "food", needKey: "food:porto", geo: { lat: 41.1471, lng: -8.6066, source: "page" } }),
  ];
  const construction = finding({ text: "Yan binada inşaat gürültüsü", polarity: "negative", topic: "condition", severity: "high", reviewIds: ["r1", "r2"] });
  const listings = new Map<string, Listing>([
    [
      `item:${casa.id}`,
      listing(
        `item:${casa.id}`,
        [
          construction,
          finding({ text: "Yanında çok iyi bir İtalyan restoranı", polarity: "positive", topic: "nearby", reviewIds: ["r3"] }),
          finding({ text: "Geniş, rahat yatak", polarity: "positive", topic: "bed", source: "description", quotes: ["king-size bed"] }),
          finding({ text: "TV yok", polarity: "negative", topic: "amenities", source: "amenities", severity: "low", quotes: ["Not included: TV"] }),
          finding({ text: "Havuz var", polarity: "positive", topic: "facilities", source: "description", verified: false }),
          finding({ text: "Karşıda inşaat vardı", polarity: "negative", topic: "noise", reviewIds: ["old"] }),
        ],
        [
          { id: "r1", text: "Construction next door", date: "2026-08", captureId: "c" },
          { id: "r2", text: "Noisy building work", date: "2026-09", captureId: "c" },
          { id: "r3", text: "Great Italian restaurant next door", date: "2026-09", captureId: "c" },
          { id: "old", text: "Building work across the street", date: "2024-03", captureId: "c" },
        ],
      ),
    ],
  ]);
  const t = trip(over({ casa, construction }));
  const analyses: Analysis[] = analysisFor
    ? [{ key: "t|x", tripId: "t", needKey: "stay@2026-10-08_2026-10-11", inputHash: "?", createdAt: 1, verdict: "v", reasons: [], tradeoffs: [], risks: [], question: null, aiScores: [], ...analysisFor({ casa, construction }) }]
    : [];
  const ctx = makeContext(t, [jardim, casa, ribeira, ...pois], { listings, analyses, today: TODAY });
  const decision = decideGroup([jardim, casa, ribeira], ctx);
  const of = (x: Item) => prosConsFor(x, decision, listings, ctx)!;
  return { jardim, casa, ribeira, decision, ctx, of, construction, listings };
}

describe("pros and cons per option", () => {
  it("puts what was read on the page next to how it compares, most important first", () => {
    const { casa, of } = scene();
    const pc = of(casa);
    expect(pc.pros.map((p) => p.text)).toContain("En ucuz: €45 daha az");
    expect(pc.pros.map((p) => p.text)).toContain("Yanında çok iyi bir İtalyan restoranı");
    expect(pc.pros.find((p) => p.text === "Geniş, rahat yatak")?.detail).toBe("açıklamada");
    expect(pc.cons[0].text).toBe("Yan binada inşaat gürültüsü"); // a recent, repeated, serious complaint leads
    expect(pc.cons[0].detail).toBe("2 yorum · en yenisi Eyl 2026");
    expect(pc.cons.map((c) => c.text)).toContain("TV yok");
  });

  it("flags what couldn't be found on the page and what only old reviews say", () => {
    const { casa, of } = scene();
    const pc = of(casa);
    const pool = pc.pros.find((p) => p.text === "Havuz var")!;
    expect(pool).toMatchObject({ unverified: true, detail: "sayfada doğrulanamadı" });
    expect(pc.pros.indexOf(pool)).toBe(pc.pros.length - 1);
    expect(pc.cons.find((c) => c.text === "Karşıda inşaat vardı")).toMatchObject({ stale: true, detail: "eski: 1 yorum · en yenisi Mar 2024" });
  });

  it("shows the comparison lines for the others: price gap, no refunds, distance", () => {
    const { ribeira, jardim, of } = scene();
    expect(of(ribeira).cons.map((c) => c.text)).toEqual(expect.arrayContaining(["En ucuzdan €90 pahalı", "İade yok"]));
    expect(of(jardim).pros.map((p) => p.text)).toEqual(expect.arrayContaining(["5 Eki'ye kadar ücretsiz iptal"]));
    // Not read yet: nothing from its page, and no invented findings.
    expect(of(jardim).pros.every((p) => p.kind === "compare")).toBe(true);
  });

  it("puts the reason an option is out on top", () => {
    const out = scene(({ casa, construction }) => ({
      eliminations: [{ itemId: casa.id, reason: "Yan binada inşaat; sessizlik istiyorsun", findingIds: [construction.id] }],
    }));
    const pc = out.of(out.casa);
    expect(pc.cons[0]).toMatchObject({ text: "Elendi: Yan binada inşaat; sessizlik istiyorsun", decisive: true, detail: "2 yorum" });
    expect(out.decision.options.at(-1)!.item.name).toBe("Casa Azul");
    const plain = scene();
    expect(plain.of(plain.casa).cons[0].decisive).toBeUndefined();
  });

  it("keeps a finding the traveller accepted, quietly", () => {
    const accepted = scene(undefined, ({ casa }) => ({ acceptedFindings: [`item:${casa.id}#condition:negative`] }));
    const cons = accepted.of(accepted.casa).cons;
    expect(cons.find((c) => c.text === "Yan binada inşaat gürültüsü")).toMatchObject({ accepted: true, detail: "sorun değil dedin" });
    expect(cons[0].text).not.toBe("Yan binada inşaat gürültüsü");
  });

  it("falls back to the page summary, labelled, until the page is read", () => {
    const x = item("Tiyatro", { category: "activity", highlights: ["Sahne çok yakın"], concerns: ["Klima yok"] });
    const pc = prosCons({ item: x, ctx: makeContext(trip(), [x], { today: TODAY }) });
    expect(pc.pros).toEqual([expect.objectContaining({ text: "Sahne çok yakın", detail: "sayfa özeti", kind: "summary" })]);
    expect(pc.cons[0].text).toBe("Klima yok");
  });
});
