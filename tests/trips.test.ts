import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { listItems, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { processPending, saveSnapshot, type Deps } from "../src/lib/process";
import { chooseTrip, profileTrips, type TripProfile } from "../src/lib/trips";
import type { Item, Trip } from "../src/lib/types";

const trip = (id: string, title: string, updatedAt = 1): Trip => ({
  id, title, confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt,
});
const item = (tripId: string, countryCode: string | null, country: string | null, start: string | null, end: string | null = null) =>
  ({ tripId, countryCode, country, status: "saved", dates: { start, end, source: "url" } }) as Item;
const signal = (over: Partial<Parameters<typeof chooseTrip>[0]>) => ({
  countryCode: null, country: null, start: null, end: null, suggestedTripId: null, suggestedTitle: null, ...over,
});

describe("chooseTrip", () => {
  const pt = trip("pt", "Portekiz", 2);
  const th = trip("th", "Tayland", 1);
  const profiles: TripProfile[] = profileTrips([pt, th], [
    item("pt", "PT", "Portekiz", "2026-10-08", "2026-10-14"),
    item("th", "TH", "Tayland", "2027-01-10", "2027-01-20"),
  ]);

  it("follows the country, not the model's suggestion", () => {
    expect(chooseTrip(signal({ countryCode: "TH", country: "Tayland", suggestedTripId: "pt" }), profiles)).toEqual({ tripId: "th" });
    expect(chooseTrip(signal({ countryCode: "pt", suggestedTripId: "th" }), profiles)).toEqual({ tripId: "pt" });
  });

  it("matches country names across spellings when no code is given", () => {
    expect(chooseTrip(signal({ country: "portekiz" }), profiles)).toEqual({ tripId: "pt" });
  });

  it("opens a new trip for a new country with unrelated dates", () => {
    expect(chooseTrip(signal({ countryCode: "JP", country: "Japonya", start: "2027-05-01", suggestedTripId: "pt" }), profiles)).toEqual({
      newTitle: "Japonya",
    });
  });

  it("keeps a second country in the same journey when dates touch (e.g. Portugal → Spain)", () => {
    expect(chooseTrip(signal({ countryCode: "ES", country: "İspanya", start: "2026-10-14", end: "2026-10-17" }), profiles)).toEqual({
      tripId: "pt",
    });
  });

  it("uses dates to pick between two trips to the same country", () => {
    const pt2 = trip("pt2", "Portekiz 2027", 3);
    const two = profileTrips([pt, pt2], [item("pt", "PT", "Portekiz", "2026-10-08", "2026-10-14"), item("pt2", "PT", "Portekiz", "2027-06-01", "2027-06-07")]);
    expect(chooseTrip(signal({ countryCode: "PT", start: "2026-10-09" }), two)).toEqual({ tripId: "pt" });
    expect(chooseTrip(signal({ countryCode: "PT", start: "2027-06-02" }), two)).toEqual({ tripId: "pt2" });
  });

  it("falls back to the model, then the latest trip, when the country is unknown", () => {
    expect(chooseTrip(signal({ suggestedTripId: "th" }), profiles)).toEqual({ tripId: "th" });
    expect(chooseTrip(signal({}), profiles)).toEqual({ tripId: "pt" });
    expect(chooseTrip(signal({ suggestedTitle: "Gezi" }), [])).toEqual({ newTitle: "Gezi" });
  });
});

describe("pipeline keeps trips apart", () => {
  it("routes Portugal and Thailand captures to their own trips even when the model mixes them up", async () => {
    const base: Omit<Extraction, "category" | "name" | "city" | "country" | "country_code" | "dates" | "trip" | "need_key"> = {
      provider: null, summary: "", option_detail: null, location: { address: null, area: null, approximate: false },
      guests: { adults: null, children: null, rooms: null },
      price: { amount: null, currency: null, scope: "unknown", taxes_included: "unknown", source: "none", evidence: null },
      cancellation: { summary: null, free_until: null, source: "none", evidence: null },
      rating: { value: null, scale: null, count: null, source: "none", evidence: null },
      flight: null, highlights: [], concerns: [], review_summary: null, image_url: null, missing: [],
    };
    const byPage: Record<string, (trips: Trip[]) => Extraction> = {
      lisbon: () => ({ ...base, category: "stay", name: "Lisbon Loft", city: "Lizbon", country: "Portekiz", country_code: "PT",
        dates: { start: "2026-10-11", end: "2026-10-14", source: "page" }, trip: { existing_trip_id: null, new_trip_title: "Portekiz" }, need_key: "stay:lisbon" }),
      // The model wrongly suggests the Portugal trip for a Bangkok hotel.
      bangkok: (trips) => ({ ...base, category: "stay", name: "Bangkok River Hotel", city: "Bangkok", country: "Tayland", country_code: "TH",
        dates: { start: "2027-01-10", end: "2027-01-14", source: "page" }, trip: { existing_trip_id: trips[0]?.id ?? null, new_trip_title: null }, need_key: "stay:bangkok" }),
      // ...and the Thailand trip for a Porto restaurant without dates.
      porto: (trips) => ({ ...base, category: "food", name: "Majestic Café", city: "Porto", country: "Portugal", country_code: "PT",
        dates: { start: null, end: null, source: "none" }, trip: { existing_trip_id: trips.find((t) => t.title === "Tayland")?.id ?? null, new_trip_title: null }, need_key: "food:porto" }),
    };
    const deps: Deps = {
      extract: async (capture, _facts, trips) => byPage[capture.pageText](trips),
      heroImage: async () => null,
    };
    const snap = (page: string) => ({ url: `https://example.com/${page}`, title: page, pageText: page, viewportText: "", selection: "", jsonLd: [], meta: {} });

    await saveSnapshot(snap("lisbon"), null);
    await processPending(deps);
    await saveSnapshot(snap("bangkok"), null);
    await processPending(deps);
    await saveSnapshot(snap("porto"), null);
    await processPending(deps);

    const trips = await listTrips();
    expect(trips.map((t) => t.title).sort()).toEqual(["Portekiz", "Tayland"]);
    const portugal = trips.find((t) => t.title === "Portekiz")!;
    const thailand = trips.find((t) => t.title === "Tayland")!;
    expect((await listItems(portugal.id)).map((i) => i.name).sort()).toEqual(["Lisbon Loft", "Majestic Café"]);
    expect((await listItems(thailand.id)).map((i) => i.name)).toEqual(["Bangkok River Hotel"]);
  });
});
