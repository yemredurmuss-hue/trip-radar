import { afterEach, describe, expect, it } from "vitest";
import { cityOfAirport } from "../src/lib/airports";
import { setLang } from "../src/lib/i18n";
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
  it("Montenegro is no longer listed (its rule changes in Nov 2026)", () => {
    expect(visaFor("TR", "ME")).toMatchObject({ kind: "unknown" });
  });
  it("reads the passport case-insensitively", () => {
    expect(visaFor("tr", "PT")).toMatchObject({ kind: "visa" });
    expect(visaFor("tr", "pt")).toMatchObject({ kind: "visa" });
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

describe("origin from an airport code", () => {
  afterEach(() => setLang("tr"));
  it("maps exact uppercase codes to the city, in the board's language, and leaves other text alone", () => {
    expect(cityOfAirport("IST")).toBe("İstanbul");
    expect(cityOfAirport("LGW")).toBe("Londra");
    expect(cityOfAirport("MUC")).toBe("Münih");
    setLang("en");
    expect(cityOfAirport("IST")).toBe("Istanbul");
    expect(cityOfAirport("FCO")).toBe("Rome");
    for (const text of ["Istanbul", "ist", "XYZ", "IST ", "Ist", ""]) expect(cityOfAirport(text)).toBe(text);
  });
  it("shows the city for a flight that stores a code", () => {
    const f = tripFacts([base({ category: "flight", status: "booked", flight: { from: "SAW", to: "OPO", departure: null, arrival: null, carrier: null, flightNumber: null, stops: 0 } })], { passport: "TR", homeCurrency: "TRY", rates: null, homeZone: "Europe/Istanbul", start: null });
    expect(f.origin).toBe("İstanbul");
  });
});

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
  it("scales the rate unit so the right side is at least 1", () => {
    const idr = { base: "EUR" as const, date: "2026-10-04", rates: { EUR: 1, TRY: 38.2, IDR: 17000 } };
    const f = tripFacts([base({ country: "Indonesia", countryCode: "ID" })], { passport: "TR", homeCurrency: "TRY", rates: idr, homeZone: "Europe/Istanbul", start: "2026-10-07" });
    // 1 IDR = 38.2 / 17000 TRY = 0.00225 -> unit 1000 gives 2.25
    expect(f.local?.rateText).toMatch(/^Rp\s?1\.000 = ₺\s?2,25$/);
  });
  it("leaves the time difference out for an unknown home zone instead of throwing", () => {
    const f = tripFacts([base({})], { passport: "TR", homeCurrency: "TRY", rates, homeZone: "Nowhere/Land", start: "2026-10-07" });
    expect(f.local?.hours).toBeNull();
  });
  it("reads the country code case-insensitively", () => {
    const f = tripFacts([base({ countryCode: "pt" })], { passport: "TR", homeCurrency: "TRY", rates, homeZone: "Europe/Istanbul", start: "2026-10-07" });
    expect(f.country).toBe("PT");
    expect(f.visa?.kind).toBe("visa");
  });
  it("takes the earliest flight as the way out, even when only the return is booked", () => {
    const back = base({ category: "flight", status: "booked", dates: { start: "2026-10-18", end: null, source: "page" },
      flight: { from: "Porto", to: "Istanbul", departure: "2026-10-18T10:00", arrival: null, carrier: null, flightNumber: null, stops: 0 } });
    const out = base({ category: "flight", status: "saved" as Item["status"], dates: { start: "2026-10-07", end: null, source: "page" },
      flight: { from: "Istanbul", to: "Porto", departure: "2026-10-07T07:10", arrival: null, carrier: null, flightNumber: null, stops: 0 } });
    const f = tripFacts([back, out], { passport: "TR", homeCurrency: "TRY", rates, homeZone: "Europe/Istanbul", start: "2026-10-07" });
    expect(f.origin).toBe("Istanbul");
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
