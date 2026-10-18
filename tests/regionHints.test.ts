// The empty stay's area chips (lib/regionHints.ts, v82 Aranıyor): the candidates' areas, the most first, each with the middle
// of its priced nights; an area never priced is named without a price; no area, no chip (nothing made up, C19).
import { describe, expect, it } from "vitest";
import type { StayCandidate } from "../src/lib/offerSources";
import { regionHints } from "../src/lib/regionHints";

let n = 0;
const c = (area: string | null, nightly: number | null): StayCandidate => ({
  id: `c${++n}`, name: `Otel ${n}`, rating: null, reviews: null, photo: null, geo: null, area, labels: [], url: `https://example.com/${n}`,
  nightly, total: null, nights: 4, priceRange: null, source: "Booking.com", currency: "EUR", fetchedAt: 1,
});

describe("regionHints", () => {
  it("the areas with the most candidates first, each with its median night", () => {
    const hints = regionHints([c("Namba", 100), c("Namba", 120), c("namba ", 140), c("Umeda", 150), c("Umeda", 130), c("Shin-Osaka", 90), c("Tennoji", 80)]);
    expect(hints).toEqual([
      { area: "Namba", nightly: 120, currency: "EUR", n: 3 },
      { area: "Umeda", nightly: 140, currency: "EUR", n: 2 },
      // One candidate each: the cheaper one first.
      { area: "Tennoji", nightly: 80, currency: "EUR", n: 1 },
    ]);
  });
  it("an area with no priced night keeps its name, no price; none named, nothing", () => {
    expect(regionHints([c("Gion", null), c(null, 90), c("  ", 80)])).toEqual([{ area: "Gion", nightly: null, currency: "EUR", n: 1 }]);
    expect(regionHints([c(null, 90)])).toEqual([]);
    expect(regionHints([c("A", 1), c("B", 2)], 1)).toHaveLength(1);
  });
});
