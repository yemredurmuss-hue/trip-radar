// A plain saved record for tests; override what the test is about.
import { EMPTY_METRICS } from "../../src/lib/items";
import type { Item } from "../../src/lib/types";

let seq = 0;
export function makeItem(over: Partial<Item> = {}): Item {
  return {
    id: `i${++seq}`, tripId: "t1", captureIds: [], key: null, category: "transport", needKey: "transport:x", name: "Item",
    provider: null, summary: "", optionDetail: null, url: null, imageUrl: null, city: null, country: null, countryCode: null,
    location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "page" },
    guests: { adults: null, children: null, rooms: null },
    price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null, metrics: EMPTY_METRICS, geo: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
    ...over,
  };
}
