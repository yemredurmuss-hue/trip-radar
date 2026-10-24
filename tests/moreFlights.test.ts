// Karar Masası (getirme anları, benle gezen eklenti): a flight search's list saved, its other flights in view become options
// of the same need beside the one picked (items.moreFlights), never a guessed price, never the picked one twice.
import { describe, expect, it } from "vitest";
import { MORE_FLIGHTS_MAX, moreFlights } from "../src/lib/items";
import { setLang } from "../src/lib/i18n";
import { makeItem } from "./fixtures/makeItem";

setLang("tr");

const picked = makeItem({
  category: "flight", needKey: "flight:bkk-ist", name: "Turkish Airlines TK69", url: "https://www.skyscanner.com.tr/transport/flights/bkk/ist/270402/",
  forNeed: "flight:bangkok:istanbul:2027-04-02", dates: { start: "2027-04-02", end: null, source: "page" },
  price: { amount: 326, currency: "EUR", scope: "per_person", taxesIncluded: "yes", source: "page", observedAt: 1 },
  flight: { from: "BKK", to: "IST", departure: "2027-04-02T15:15", arrival: "2027-04-02T22:30", carrier: "Turkish Airlines", flightNumber: "TK69", stops: 0 },
});
const f = (carrier: string, number: string | null, departure: string | null, price: number | null, stops = 1) => ({ carrier, flight_number: number, departure, arrival: "2027-04-02T19:55", stops, price_amount: price, currency: "EUR" });

describe("moreFlights", () => {
  it("each flight in view is an option of the same need, page and day, its own hours, stops and price", () => {
    const out = moreFlights({ more_flights: [f("Emirates", "EK373", "2027-04-02T09:40", 288), f("Qatar Airways", "QR833", "2027-04-02T20:05", 354)] }, picked, 1000);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: "Emirates EK373", needKey: "flight:bkk-ist", forNeed: picked.forNeed, url: picked.url, status: "saved", key: "flight:EK373:2027-04-02" });
    expect(out[0].flight).toMatchObject({ from: "BKK", to: "IST", departure: "2027-04-02T09:40", carrier: "Emirates", flightNumber: "EK373", stops: 1 });
    expect(out[0].price).toMatchObject({ amount: 288, currency: "EUR", scope: "per_person", source: "screenshot" });
    expect(out[0].id).not.toBe(picked.id);
  });
  it("no price shown, none written; no hours, not an option; the picked one never twice; at most four", () => {
    const out = moreFlights({ more_flights: [f("Pegasus", "PC1171", "2027-04-02T23:50", null), f("X", "XX1", null, 300), f("Turkish Airlines", "TK 69", "2027-04-02T15:15", 326)] }, picked);
    expect(out.map((o) => o.name)).toEqual(["Pegasus PC1171"]);
    expect(out[0].price).toMatchObject({ amount: null, currency: null, source: "none" });
    const many = Array.from({ length: 7 }, (_, n) => f("A", `AA${n}`, "2027-04-02T10:00", 100 + n));
    expect(moreFlights({ more_flights: many }, picked)).toHaveLength(MORE_FLIGHTS_MAX);
  });
  it("nothing for a booking, a stay, or a page with no list", () => {
    expect(moreFlights({ more_flights: [f("Emirates", "EK373", "2027-04-02T09:40", 288)] }, { ...picked, status: "booked" })).toEqual([]);
    expect(moreFlights({ more_flights: [f("Emirates", "EK373", "2027-04-02T09:40", 288)] }, { ...picked, category: "stay" })).toEqual([]);
    expect(moreFlights({}, picked)).toEqual([]);
  });
});
