// The scaffolding case (real, from the traveller): three stays for the same nights, already filtered by
// the traveller (good vibe, fair price). The Airbnb is the best on price and rating, but two guests in
// March said scaffolding was put up outside; the ten guests after them don't mention it. One passing
// event, reported by two, must not sink the best option to the bottom.
import { EMPTY_METRICS } from "../../src/lib/items";
import type { Finding, Item, ItemMetrics, Listing, ReviewEvidence, Trip } from "../../src/lib/types";

export const TODAY = "2026-09-30";

export const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t", title: "Portekiz", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1, ...over,
});

let seq = 0;
export function stay(name: string, over: Omit<Partial<Item>, "metrics"> & { metrics?: Partial<ItemMetrics> } = {}): Item {
  const { metrics, ...rest } = over;
  return {
    id: `s${++seq}`, tripId: "t", captureIds: ["c"], key: null, category: "stay", needKey: "stay:porto", name, provider: null,
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: "2026-10-08", end: "2026-10-11", source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: null, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
    metrics: { ...EMPTY_METRICS, cancellationType: "free", ...metrics }, geo: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null,
    createdAt: 1, updatedAt: 1, ...rest,
  };
}

export const price = (amount: number) => ({ amount, currency: "EUR", scope: "total" as const, taxesIncluded: "yes" as const, source: "page" as const, observedAt: 1 });
export const rating = (value: number, scale: number, count: number) => ({ value, scale, count, source: "page" as const });

export const finding = (over: Partial<Finding> & Pick<Finding, "text" | "polarity" | "topic">): Finding => ({
  id: `${over.topic}:${over.polarity}:${over.text.length}`,
  source: "reviews",
  severity: "medium",
  reviewIds: [],
  quotes: [],
  verified: true,
  ...over,
});

export const review = (id: string, date: string | null, text: string): ReviewEvidence => ({ id, text, date, captureId: "c" });

export const listingOf = (item: Item, findings: Finding[], reviews: ReviewEvidence[]): Listing => ({
  key: `item:${item.id}`, name: item.name, reviews, reviewTotal: 180, findings, readCaptureIds: ["c"], readAt: 1, dropped: 0,
  error: null, errorAt: null, updatedAt: 1,
});

/** Ten guests after March, none of them mentioning the scaffolding. */
export const LATER_REVIEWS: ReviewEvidence[] = [
  ["2026-04", "Lovely flat, spotless and bright. Host was very helpful."],
  ["2026-04", "Perfect location for exploring, we walked everywhere."],
  ["2026-05", "Great stay, comfortable bed and a well equipped kitchen."],
  ["2026-05", "Ana was a wonderful host, quick to answer."],
  ["2026-06", "Very clean and exactly like the photos."],
  ["2026-06", "Quiet at night, we slept very well."],
  ["2026-07", "Beautiful apartment, would come back."],
  ["2026-07", "Easy self check-in, great value."],
  ["2026-08", "Everything was perfect, thank you!"],
  ["2026-09", "Cosy and clean, close to the river."],
].map(([date, text], i) => review(`later${i + 1}`, date, text));

export const SCAFFOLDING = finding({
  id: "condition:negative:iskele",
  text: "Dışarıda iskele kuruldu",
  polarity: "negative",
  topic: "condition",
  severity: "high",
  reviewIds: ["r1", "r2"],
});

/** A (the Airbnb) is the cheapest and best rated; B and C are fine but cost more. */
export function scaffoldingScene(over: Partial<Trip> = {}) {
  const a = stay("Casa Andaime", { provider: "Airbnb", price: price(240), rating: rating(4.9, 5, 180) });
  const b = stay("Hotel Bravo", { price: price(300), rating: rating(8.6, 10, 900) });
  const c = stay("Loft Central", { price: price(320), rating: rating(8.7, 10, 400) });
  const listings = new Map<string, Listing>([
    [
      `item:${a.id}`,
      listingOf(
        a,
        [
          SCAFFOLDING,
          finding({ text: "Ev sahibi çok ilgili", polarity: "positive", topic: "host", reviewIds: ["later1", "later4"] }),
          finding({ text: "Tertemiz ve aydınlık", polarity: "positive", topic: "cleanliness", reviewIds: ["later1", "later5", "later10"] }),
        ],
        [
          review("r1", "2026-03", "Scaffolding was put up outside the week we arrived, a bit noisy in the morning."),
          review("r2", "2026-03", "There is scaffolding on the building now, the view is blocked."),
          ...LATER_REVIEWS,
        ],
      ),
    ],
    [
      `item:${b.id}`,
      listingOf(
        b,
        [
          finding({ text: "Kahvaltı çok iyi", polarity: "positive", topic: "food", reviewIds: ["b1", "b2"] }),
          finding({ text: "Oda küçük", polarity: "negative", topic: "space", reviewIds: ["b3", "b4"] }),
          finding({ text: "Tertemiz odalar", polarity: "positive", topic: "cleanliness", reviewIds: ["b1"] }),
        ],
        [
          review("b1", "2026-08", "Breakfast was excellent, room spotless."),
          review("b2", "2026-07", "Great breakfast buffet."),
          review("b3", "2026-09", "Room was small for two."),
          review("b4", "2026-06", "Tiny room but good location."),
        ],
      ),
    ],
    [
      `item:${c.id}`,
      listingOf(
        c,
        [
          finding({ text: "Duvarlar ince, ses geçiyor", polarity: "negative", topic: "noise", reviewIds: ["c1", "c2"] }),
          finding({ text: "Geniş salon", polarity: "positive", topic: "space", reviewIds: ["c3"] }),
          finding({ text: "Temiz", polarity: "positive", topic: "cleanliness", reviewIds: ["c3"] }),
        ],
        [
          review("c1", "2026-09", "Thin walls, we heard the neighbours."),
          review("c2", "2026-08", "Noise from next door at night."),
          review("c3", "2026-07", "Big living room, clean."),
        ],
      ),
    ],
  ]);
  return { a, b, c, items: [a, b, c], listings, trip: trip(over) };
}
