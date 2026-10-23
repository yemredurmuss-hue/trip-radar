// Kendiliğinden arama and the trip's shape (lib/autoSearch.ts, 0.40.3): a camper van trip got a hotel for its 14 nights.
import { describe, expect, it } from "vitest";
import { autoSearchBlock, restoredOwnStay } from "../src/lib/autoSearch";
import { EMPTY_METRICS } from "../src/lib/items";
import { shapeOf } from "../src/lib/playbooks/shape";
import { placeholderPrint } from "../src/lib/startTrip";
import type { Item, Trip } from "../src/lib/types";

const hotel = { sleep: "hotel", movingBase: false, preset: "classic", closes: {} } as const;
const van = { sleep: "vehicle", movingBase: true, preset: "road", closes: {} } as const;
const free = { ownStay: false, routeDraft: false, covered: false };
const stay = { kind: "stay", section: "stay" } as const;
const transfer = { kind: "transfer", section: "transport" } as const;
const flight = { kind: "flight", section: "flight" } as const;

describe("autoSearchBlock: never against what the trip already says", () => {
  it("a hotel trip's empty needs are looked for", () => {
    expect(autoSearchBlock(stay, hotel, free)).toBeNull();
    expect(autoSearchBlock(flight, hotel, free)).toBeNull();
    expect(autoSearchBlock(transfer, hotel, free)).toBeNull();
  });
  it("the van's, the camp's, the boat's nights: no hotel looked for", () => {
    expect(autoSearchBlock(stay, van, free)).toBe("sleep");
    expect(autoSearchBlock(stay, { ...hotel, sleep: "camp" }, free)).toBe("sleep");
    expect(autoSearchBlock(stay, { ...hotel, sleep: "boat" }, free)).toBe("sleep");
    expect(autoSearchBlock(stay, hotel, { ...free, ownStay: true })).toBe("ownStay");
  });
  it("the van or the road trip's car drives between the cities: no train or bus looked for", () => {
    expect(autoSearchBlock(transfer, van, free)).toBe("drives");
    expect(autoSearchBlock(transfer, { ...hotel, preset: "road" }, free)).toBe("drives");
    expect(autoSearchBlock(flight, van, free)).toBeNull();
  });
  it("a route still to agree: its nights and ways wait; a covered need and a closed category never", () => {
    expect(autoSearchBlock(stay, hotel, { ...free, routeDraft: true })).toBe("route");
    expect(autoSearchBlock(transfer, hotel, { ...free, routeDraft: true })).toBe("route");
    expect(autoSearchBlock(flight, hotel, { ...free, routeDraft: true })).toBeNull();
    expect(autoSearchBlock(stay, hotel, { ...free, covered: true })).toBe("covered");
    expect(autoSearchBlock(flight, { ...hotel, closes: { flight: "trenle" } }, free)).toBe("closed");
  });
  it("read from the trip: a camper van playbook sleeps in the vehicle; a day trip closes the stays", () => {
    const camper = { intent: { playbook: "custom", custom: { base: "road", stayType: "vehicle" } } } as unknown as Trip;
    expect(shapeOf(camper).sleep).toBe("vehicle");
    expect(autoSearchBlock(stay, shapeOf(camper), free)).toBe("sleep");
    const day = { startGuide: { dayTrip: true } } as unknown as Trip;
    expect(autoSearchBlock(stay, shapeOf(day), free)).not.toBeNull();
  });
});

describe("restoredOwnStay: the van's night a hotel took the place of comes back", () => {
  const van0 = {
    id: "s1", tripId: "t", category: "stay", name: "Camper van · Vancouver", city: "Vancouver", status: "chosen", origin: "chat",
    dates: { start: "2026-12-15", end: "2026-12-29", source: "user" }, flight: null, metrics: { ...EMPTY_METRICS, stayKind: "vehicle" },
    part: { ref: "stay", section: "stay", frame: "stay", word: "Camper van" },
  } as unknown as Item;
  const trip = { startGuide: { placeholders: { s1: placeholderPrint(van0) } } };
  const filled = {
    ...van0, name: "Samesun Vancouver", status: "saved", origin: undefined, addedBy: "ai", forNeed: "stay:x", provider: "Booking.com",
    url: "https://www.booking.com/hotel/ca/samesun.html", price: { amount: 462, currency: "EUR", scope: "total", taxesIncluded: "unknown", source: "url", observedAt: 1 },
    rating: { value: 4.4, scale: 5, count: 71, source: "url" }, summary: "The cheapest I found", metrics: EMPTY_METRICS,
  } as unknown as Item;
  it("put back as the start made it: its name, its days, the van, no price or page", () => {
    const back = restoredOwnStay(filled, trip, "vehicle")!;
    expect(back).toMatchObject({ name: "Camper van · Vancouver", status: "chosen", origin: "chat", provider: null, url: null, city: "Vancouver" });
    expect(back.price.amount).toBeNull();
    expect(back.metrics?.stayKind).toBe("vehicle");
    expect(back.forNeed).toBeUndefined();
    expect(placeholderPrint(back)).toBe(trip.startGuide.placeholders.s1);
  });
  it("never the traveller's own pick, a hotel trip, or a record the start didn't make", () => {
    expect(restoredOwnStay({ ...filled, status: "chosen" }, trip, "vehicle")).toBeNull();
    expect(restoredOwnStay(filled, trip, "hotel")).toBeNull();
    expect(restoredOwnStay({ ...filled, id: "other" }, trip, "vehicle")).toBeNull();
    expect(restoredOwnStay(van0, trip, "vehicle")).toBeNull();
  });
});
