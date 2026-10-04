import { describe, expect, it } from "vitest";
import { COUNTRIES, countryInfo } from "../src/lib/countries";
import { visaFor, VISA_CHECKED } from "../src/lib/visa";
import { tripFacts, utcOffsetHours } from "../src/lib/tripFacts";
import { EMPTY_METRICS } from "../src/lib/items";
import type { Item } from "../src/lib/types";

describe("country table", () => {
  it("knows Portugal", () => {
    const pt = countryInfo("PT")!;
    expect(pt.currency).toBe("EUR");
    expect(pt.timeZone).toBe("Europe/Lisbon");
    expect(pt.plugs).toEqual(["C", "F"]);
    expect(pt.language.tr).toBe("Portekizce");
  });
  it("every entry has a currency and a time zone", () => {
    for (const [code, c] of Object.entries(COUNTRIES)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(c.currency).toMatch(/^[A-Z]{3}$/);
      expect(c.timeZone).toContain("/");
    }
  });
});

describe("visa table (Turkish passport)", () => {
  it("Schengen needs a visa", () => {
    expect(visaFor("TR", "PT")).toMatchObject({ kind: "visa", label: "Schengen vizesi" });
  });
  it("visa-free where we know it", () => {
    expect(visaFor("TR", "JP")).toMatchObject({ kind: "free", days: 90 });
  });
  it("own country needs nothing", () => {
    expect(visaFor("TR", "TR")).toMatchObject({ kind: "none" });
  });
  it("unknown country or passport: only the official link", () => {
    expect(visaFor("TR", "ZZ")).toMatchObject({ kind: "unknown" });
    expect(visaFor("DE", "PT")).toMatchObject({ kind: "unknown" });
    expect(visaFor("TR", "ZZ").link).toMatch(/^https:\/\//);
  });
  it("records when the rules were checked", () => {
    expect(VISA_CHECKED).toMatch(/^\d{4}-\d{2}$/);
  });
});

const base = (over: Partial<Item>): Item => ({
  id: Math.random().toString(36).slice(2), tripId: "t", captureIds: [], key: null, category: "stay", needKey: "n", name: "x",
  provider: null, summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portugal", countryCode: "PT",
  location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "unknown" },
  guests: { adults: 2, children: null, rooms: null },
  price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "unknown", observedAt: 0 },
  priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "unknown" },
  rating: { value: null, scale: null, count: null, source: "unknown" }, flight: null, metrics: EMPTY_METRICS,
  highlights: [], concerns: [], reviewSummary: null, missing: [], status: "chosen", statusNote: null, createdAt: 0, updatedAt: 0,
  ...over,
} as Item);

describe("trip facts", () => {
  const flight = base({ category: "flight", status: "booked", city: "Porto", dates: { start: "2026-10-07", end: null, source: "page" },
    flight: { from: "Istanbul", to: "Porto", departure: "2026-10-07T07:10", arrival: null, carrier: null, flightNumber: null, stops: 0 } });
  const rates = { base: "EUR" as const, date: "2026-10-04", rates: { EUR: 1, TRY: 38.2 } };

  it("reads origin, travellers, visa and local money", () => {
    const f = tripFacts([flight, base({})], { passport: "TR", homeCurrency: "TRY", rates, homeZone: "Europe/Istanbul", start: "2026-10-07" });
    expect(f.origin).toBe("Istanbul");
    expect(f.adults).toBe(2);
    expect(f.visa?.label).toBe("Schengen vizesi");
    expect(f.local?.currency).toBe("EUR");
    expect(f.local?.rateText).toBe("€1 = ₺38,20");
    expect(f.local?.hours).toBe(-2);
  });
  it("hides what it doesn't know", () => {
    const f = tripFacts([base({ countryCode: null, guests: { adults: null, children: null, rooms: null } })], { passport: "TR", homeCurrency: "TRY", rates: null, homeZone: "Europe/Istanbul", start: null });
    expect(f.origin).toBeNull();
    expect(f.adults).toBeNull();
    expect(f.local).toBeNull();
  });
  it("offset follows summer time on the trip's date", () => {
    expect(utcOffsetHours("Europe/Lisbon", "2026-07-01")).toBe(1);
    expect(utcOffsetHours("Europe/Lisbon", "2026-12-01")).toBe(0);
  });
});
