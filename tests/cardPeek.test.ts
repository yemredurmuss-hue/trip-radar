import { afterEach, describe, expect, it } from "vitest";
import { flightPeek, legPeek, legPeekHasFacts } from "../src/lib/cardPeek";
import { setLang } from "../src/lib/i18n";
import type { Leg } from "../src/lib/legs";
import type { FlightSeen } from "../src/lib/flightData";
import { makeItem } from "./fixtures/makeItem";

afterEach(() => setLang("tr"));

describe("a flight's peek", () => {
  it("says only what the record holds: the bag, the code, and the terminals once live data is in", () => {
    const bare = makeItem({ category: "flight" });
    expect(flightPeek(bare)).toEqual([]);
    const flight = makeItem({
      category: "flight",
      bookingRef: "ABC123",
      metrics: { reviewAspects: [], amenities: [], cancellationType: "unknown", distanceToCenterKm: null, durationMinutes: null, checkedBagIncluded: true, dataGb: null, unlimitedData: null, validityDays: null },
      flightLive: {
        number: "TP1760", airline: "TAP", status: "Expected", fetchedAt: "2026-10-14T10:00:00Z",
        departure: { iata: "LIS", airport: null, scheduled: null, revised: null, actual: null, terminal: "2", gate: "14", desk: "12-16" },
        arrival: { iata: "IST", airport: null, scheduled: null, revised: null, actual: null, terminal: null, gate: null, belt: null },
      } as unknown as FlightSeen,
    });
    expect(flightPeek(flight)).toEqual([
      { label: "Bagaj", value: "Bavul dahil" },
      { label: "Rezervasyon kodu", value: "ABC123", copy: "ABC123" },
      { label: "Kalkış", value: "Terminal 2 · Kapı 14" },
      { label: "Check-in masası", value: "12–16" },
    ]);
  });
  it("takes a code from an older note, and says nothing of a bag that is not known", () => {
    const f = makeItem({ category: "flight", statusNote: "PNR K7T2QX" });
    expect(flightPeek(f)).toEqual([{ label: "Rezervasyon kodu", value: "K7T2QX", copy: "K7T2QX" }]);
  });
});

describe("a transfer's peek", () => {
  const leg = (options: ReturnType<typeof makeItem>[]) => ({ date: "2026-10-14", options }) as unknown as Leg;
  it("names the weekday, the weather, and the options that have a price (never one without)", () => {
    const taxi = makeItem({ name: "Taksi / Bolt", price: { amount: 18, currency: "EUR", scope: "total", taxesIncluded: "unknown", source: "page", observedAt: 0 } });
    const free = makeItem({ name: "Yürümek" });
    const gone = makeItem({ name: "Otobüs", status: "dismissed", price: { amount: 4, currency: "EUR", scope: "total", taxesIncluded: "unknown", source: "page", observedAt: 0 } });
    const p = legPeek(leg([taxi, free, gone]), { city: "Lizbon", high: 19, low: 12, sky: "cloud", rainy: 1, days: 3, source: "forecast" } as never);
    expect(p.day).toMatch(/Çarşamba/);
    expect(p.weather).toBe("Lizbon · gündüz 19°, gece 12° · yağışlı gün 1/3");
    expect(p.options).toEqual([{ name: "Taksi / Bolt", price: expect.stringMatching(/18/), duration: null }]);
    expect(legPeekHasFacts(p)).toBe(true);
  });
  it("has nothing to say with no day, no weather and no priced option", () => {
    const p = legPeek({ date: "", options: [] } as unknown as Leg, null);
    expect(p).toEqual({ day: null, weather: null, options: [] });
    expect(legPeekHasFacts(p)).toBe(false);
  });
});
