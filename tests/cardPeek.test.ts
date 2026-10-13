import { afterEach, describe, expect, it } from "vitest";
import { flightPeek, legPeek, legPeekHasFacts, stayPeek, transferPeek } from "../src/lib/cardPeek";
import { setLang } from "../src/lib/i18n";
import type { Leg } from "../src/lib/legs";
import type { FlightSeen } from "../src/lib/flightData";
import { makeItem } from "./fixtures/makeItem";

afterEach(() => setLang("tr"));

const CTX = { today: "2026-10-05", from: "Sabine" };
const noRefund = { summary: "İade yok", freeUntil: null, source: "page" as const };
const flightRec = {
  from: "LIS", to: "IST", departure: "2026-10-14T19:40:00", arrival: "2026-10-15T01:25:00", carrier: "TAP", flightNumber: "TP1760", stops: 0,
};

describe("a flight's peek", () => {
  it("says only what the record holds: a bare flight has just whose it is", () => {
    expect(flightPeek(makeItem({ category: "flight" }), CTX)).toEqual([{ label: "Kimden", value: "Sabine" }]);
  });
  it("names the number, both ends (+1 on a later landing), the stops, the bag and the terminals once live data is in", () => {
    const flight = makeItem({
      category: "flight",
      flight: flightRec,
      metrics: { reviewAspects: [], amenities: [], cancellationType: "unknown", distanceToCenterKm: null, durationMinutes: 345, checkedBagIncluded: true, dataGb: null, unlimitedData: null, validityDays: null },
      flightLive: {
        number: "TP1760", airline: "TAP", status: "Expected", fetchedAt: "2026-10-14T10:00:00Z",
        departure: { iata: "LIS", airport: null, scheduled: null, revised: null, actual: null, terminal: "2", gate: "14", desk: "12-16" },
        arrival: { iata: "IST", airport: null, scheduled: null, revised: null, actual: null, terminal: null, gate: null, belt: null },
      } as unknown as FlightSeen,
    });
    const facts = flightPeek(flight, { ...CTX, ends: { from: "Lizbon", to: "İstanbul" } });
    expect(facts.map((f) => f.label)).toEqual(["Sefer", "Kalkış", "Varış", "Süre", "Aktarma", "Bagaj", "Check-in masası", "Kimden"]);
    expect(facts[0].value).toBe("TAP TP1760");
    expect(facts[1].value).toBe("Lizbon · 19:40 · Terminal 2 · Kapı 14");
    expect(facts[2].value).toMatch(/^İstanbul · 01:25 \(\+1\)$/);
    expect(facts[4].value).toBe("Yok");
    expect(facts[5].value).toBe("Bavul dahil");
    expect(facts[6].value).toBe("12–16");
  });
  it("keeps the booking code for the flight's day, from a note too", () => {
    const later = makeItem({ category: "flight", flight: flightRec, bookingRef: "ABC123" });
    expect(flightPeek(later, CTX).some((f) => f.label === "Rezervasyon kodu")).toBe(false);
    const today = flightPeek(later, { ...CTX, today: "2026-10-14" });
    expect(today).toContainEqual({ label: "Rezervasyon kodu", value: "ABC123", copy: "ABC123" });
    const noted = makeItem({ category: "flight", statusNote: "PNR K7T2QX" });
    expect(flightPeek(noted, CTX)).toContainEqual({ label: "Rezervasyon kodu", value: "K7T2QX", copy: "K7T2QX" });
  });
  it("says a connection by its count, and a bag that is not known not at all", () => {
    const one = makeItem({ category: "flight", flight: { ...flightRec, stops: 1 } });
    expect(flightPeek(one, CTX).find((f) => f.label === "Aktarma")?.value).toBe("1 aktarma");
    expect(flightPeek(one, CTX).some((f) => f.label === "Bagaj")).toBe(false);
  });
});

describe("a stay's peek", () => {
  it("names the area, rating, cancel terms, note and the whole sum; nothing for what the record lacks", () => {
    const stay = makeItem({ category: "stay", location: { address: null, area: "Alfama", approximate: false }, cancellation: noRefund, statusNote: "Erken giriş istendi" });
    expect(stayPeek(stay, { ...CTX, rating: "9,0 · Muhteşem · 770 yorum", total: "€630" })).toEqual([
      { label: "Semt", value: "Alfama" },
      { label: "Puan", value: "9,0 · Muhteşem · 770 yorum" },
      { label: "İptal", value: "İade yok" },
      { label: "Not", value: "Erken giriş istendi" },
      { label: "Toplam", value: "€630" },
      { label: "Kimden", value: "Sabine" },
    ]);
    expect(stayPeek(makeItem({ category: "stay" }), CTX)).toEqual([{ label: "Kimden", value: "Sabine" }]);
  });
});

describe("a way of travel's peek", () => {
  it("names both ends, how long, the booking and the note", () => {
    const train = makeItem({
      category: "transport", statusNote: "Koltuk 12A", bookingRef: "TRN9",
      flight: { from: "Lisboa Oriente", to: "Porto Campanhã", departure: "2026-10-05T09:00:00", arrival: "2026-10-05T11:50:00", carrier: null, flightNumber: null, stops: null },
      metrics: { reviewAspects: [], amenities: [], cancellationType: "unknown", distanceToCenterKm: null, durationMinutes: 170, checkedBagIncluded: null, dataGb: null, unlimitedData: null, validityDays: null },
    });
    const facts = transferPeek(train, "train", CTX);
    expect(facts.map((f) => f.label)).toEqual(["Kalkış", "Varış", "Süre", "Rezervasyon", "Not", "Kimden"]);
    expect(facts[2].value).toMatch(/2 sa 50/);
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
