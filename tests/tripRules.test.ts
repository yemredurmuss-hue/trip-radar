// Hangi gezi (lib/tripRules.ts, 0.41.0): asked once a country which trip, remembered, then put there without asking.
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { db, listItems, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { processPending, saveSnapshot, type Deps } from "../src/lib/process";
import { answerHeld, moveToTrip } from "../src/lib/routing";
import { loadRules, ruleFor, type TripRule } from "../src/lib/tripRules";
import type { Item, Trip } from "../src/lib/types";

const store: Record<string, unknown> = {};
beforeAll(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: { get: async (k: string) => ({ [k]: store[k] }), set: async (o: Record<string, unknown>) => void Object.assign(store, o) } },
  };
});

const trip = (id: string, title: string, start: string | null = null, end: string | null = null): Trip =>
  ({ id, title, confirmedDates: start && end ? { start, end } : null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 }) as Trip;

describe("ruleFor: the remembered trip, only while it still fits", () => {
  const trips = [trip("pt", "Portekiz", "2026-11-12", "2026-11-19"), trip("old", "Lizbon", "2025-05-01", "2025-05-05")];
  const rules: TripRule[] = [{ country: "PT", tripId: "pt", at: 1 }];
  it("the country's trip on its days, or with no day of its own", () => {
    expect(ruleFor(rules, ["PT"], trips, [], "2026-11-14", "2026-11-16", "2026-10-23")?.id).toBe("pt");
    expect(ruleFor(rules, ["PT"], trips, [], null, null, "2026-10-23")?.id).toBe("pt");
    expect(ruleFor(rules, ["PT"], trips, [], "2026-11-10", null, "2026-10-23")?.id).toBe("pt");
  });
  it("another country, a day outside the trip's, a trip over or gone: asked again", () => {
    expect(ruleFor(rules, ["ES"], trips, [], null, null, "2026-10-23")).toBeNull();
    expect(ruleFor(rules, ["PT"], trips, [], "2027-03-02", "2027-03-09", "2026-10-23")).toBeNull();
    expect(ruleFor([{ country: "PT", tripId: "old", at: 1 }], ["PT"], trips, [], null, null, "2026-10-23")).toBeNull();
    expect(ruleFor([{ country: "PT", tripId: "gone", at: 1 }], ["PT"], trips, [], null, null, "2026-10-23")).toBeNull();
  });
});

const base: Extraction = {
  category: "stay", name: "Memmo Alfama", provider: "Booking.com", summary: "", option_detail: null, city: "Lizbon", country: "Portekiz", country_code: "PT",
  location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "none" }, guests: { adults: null, children: null, rooms: null },
  price: { amount: 912, currency: "EUR", scope: "total", taxes_included: "yes", source: "page", evidence: "€ 912" },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null }, rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null, metrics: null, highlights: [], concerns: [], review_summary: null, image_url: null, missing: [], trip: { existing_trip_id: null, new_trip_title: "Portekiz" }, need_key: "stay:lizbon",
};
const page = (url: string) => ({ url, title: "t", pageText: url, viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] });
const deps = (x: Partial<Extraction>): Deps => ({ extract: async () => ({ ...base, ...x }), heroImage: async () => null, geocode: async () => null });

describe("from the toolbar: asked once a country, then put there", () => {
  it("the first trip is remembered; a second country is asked, answered, remembered; a move moves the rule", async () => {
    await saveSnapshot(page("https://www.booking.com/hotel/pt/memmo.html"), null);
    await processPending(deps({}));
    const [pt] = await listTrips();
    expect(pt.title).toBe("Portekiz");
    expect((await loadRules())?.map((r) => [r.country, r.tripId])).toEqual([["PT", pt.id]]);

    // (another Portugal trip, more recent: the remembered one still wins, nothing asked)
    const d = await db();
    await d.put("trips", trip("pt2", "Madeira, bahar"));
    await saveSnapshot(page("https://www.booking.com/hotel/pt/lumiares.html"), null);
    await processPending(deps({ name: "Lumiares" }));
    expect((await listItems(pt.id)).map((i) => i.name).sort()).toEqual(["Lumiares", "Memmo Alfama"]);

    // Spain, never answered: asked which trip, the Portugal trips offered; the answer is Spain's trip from now on.
    const asked = await saveSnapshot(page("https://www.booking.com/hotel/es/only-you.html"), null);
    await processPending(deps({ name: "Only YOU", city: "Madrid", country: "İspanya", country_code: "ES" }));
    const held = (await d.get("captures", asked.id))!.held!;
    expect(held.reason).toBe("trip");
    expect(held.candidates).toEqual(expect.arrayContaining([pt.id, "pt2"]));
    expect(await answerHeld(asked.id, "there", pt.id)).toBe(pt.id);
    expect((await loadRules())?.find((r) => r.country === "ES")?.tripId).toBe(pt.id);
    await saveSnapshot(page("https://www.booking.com/hotel/es/dear-madrid.html"), null);
    await processPending(deps({ name: "Dear Madrid", city: "Madrid", country: "İspanya", country_code: "ES" }));
    expect((await listItems(pt.id)).some((i) => i.name === "Dear Madrid")).toBe(true);

    // "Başka geziye taşı": the country's trip follows it.
    const dear = (await listItems(pt.id)).find((i) => i.name === "Dear Madrid") as Item;
    await moveToTrip(dear.id, "pt2");
    expect((await loadRules())?.find((r) => r.country === "ES")?.tripId).toBe("pt2");
  });
});
