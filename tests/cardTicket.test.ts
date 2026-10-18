// A ticket's stub prices, a rental's line, "Bilet gerekmez", a stay's drawing, a contact link (lib/cardTicket.ts).
import { describe, expect, it } from "vitest";
import { needsNoTicket, rentalLine, safeContactUrl, stayArt, ticketPrices } from "../src/lib/cardTicket";
import { EMPTY_METRICS } from "../src/lib/items";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const priced = (amount: number | null, scope: Item["price"]["scope"], adults: number | null) =>
  makeItem({ category: "flight", price: { amount, currency: "EUR", scope, taxesIncluded: "unknown", source: "page", observedAt: 1 }, guests: { adults, children: null, rooms: null } });

describe("a chosen flight's stub: per person and in all, from what was saved", () => {
  it("a price per person for two: the person's and the whole", () => {
    const p = ticketPrices(priced(74, "per_person", 2))!;
    expect(p).toEqual({ each: "€74", total: "€148" });
  });
  it("a total for two: halved for the person", () => {
    expect(ticketPrices(priced(148, "total", 2))).toEqual({ each: "€74", total: "€148" });
  });
  it("one passenger: a single figure", () => {
    const p = ticketPrices(priced(148, "total", 1))!;
    expect(p).toEqual({ each: null, total: "€148" });
  });
  it("nothing is invented: no price, or one whose scope is unknown, says nothing", () => {
    expect(ticketPrices(priced(null, "total", 2))).toBeNull();
    expect(ticketPrices(priced(148, "unknown", 2))).toBeNull();
    expect(ticketPrices(priced(0, "total", 2))).toBeNull();
  });
  it("a record that does not say how many go takes the trip's count, never a fixed two", () => {
    expect(ticketPrices(priced(300, "total", null), undefined, 3)).toEqual({ each: "€100", total: "€300" });
    expect(ticketPrices(priced(300, "total", null), undefined, 1)).toEqual({ each: null, total: "€300" });
    expect(ticketPrices(priced(300, "total", null))).toEqual({ each: null, total: "€300" });
    expect(ticketPrices(priced(300, "total", 2), undefined, 3)).toEqual({ each: "€150", total: "€300" });
  });
  it("the compared price (the engine's) wins when it has the person's share", () => {
    expect(ticketPrices(priced(148, "total", 2), { text: "€160", label: null, perNight: null, provisional: false, each: "€80" })).toEqual({ each: "€80", total: "€160" });
  });
});

describe("a rental's line", () => {
  const car = (over: Partial<Item> = {}) =>
    makeItem({ plannedKind: "car_rental", dates: { start: "2026-07-25", end: "2026-08-02", source: "page" }, location: { address: null, area: "Havalimanı", approximate: false },
      flight: { from: null, to: null, departure: "2026-07-25T09:45", arrival: null, carrier: null, flightNumber: null, stops: null }, ...over });
  it("pick-up day, hour and place, then the return day, from the record", () => {
    expect(rentalLine(car())).toBe("Al 25 Temmuz 09:45 · Havalimanı → bırak 2 Ağustos");
  });
  it("only what is known: no hour, no place, no return day", () => {
    expect(rentalLine(car({ flight: null }))).toBe("Al 25 Temmuz · Havalimanı → bırak 2 Ağustos");
    expect(rentalLine(car({ flight: null, location: { address: null, area: null, approximate: false }, dates: { start: "2026-07-25", end: null, source: "page" } }))).toBe("Al 25 Temmuz");
    expect(rentalLine(car({ dates: { start: null, end: null, source: "none" } }))).toBeNull();
  });
  it("the record's own line (when) is used as it was said", () => {
    expect(rentalLine(car({ when: "Al 25 Tem 09:45 · Havalimanı → bırak 2 Ağu · Deák tér" }))).toBe("Al 25 Tem 09:45 · Havalimanı → bırak 2 Ağu · Deák tér");
  });
});

describe("Bilet gerekmez", () => {
  const bus = (over: Partial<Item> = {}) => makeItem({ plannedKind: "bus", status: "chosen", ...over });
  it("a taxi, or a way set aside as needing no ticket", () => {
    expect(needsNoTicket(makeItem({ plannedKind: "taxi", status: "chosen" }), "taxi", true)).toBe(true);
    expect(needsNoTicket(bus({ noBooking: 1 }), "bus", true)).toBe(true);
    expect(needsNoTicket(bus({ booking: "none" }), "bus", true)).toBe(true);
  });
  it("not a ticketed way, a flight, a rental, something bought, or a card that isn't a way of travel", () => {
    expect(needsNoTicket(bus(), "bus", true)).toBe(false);
    expect(needsNoTicket(makeItem({ category: "flight", noBooking: 1 }), "flight", true)).toBe(false);
    expect(needsNoTicket(makeItem({ plannedKind: "car_rental", noBooking: 1 }), "car", true)).toBe(false);
    expect(needsNoTicket(bus({ noBooking: 1, status: "booked" }), "bus", true)).toBe(false);
    expect(needsNoTicket(makeItem({ category: "activity", noBooking: 1 }), "activity", false)).toBe(false);
  });
});

describe("a stay's drawing", () => {
  const stay = (kind: Item["metrics"] extends infer M ? (M extends { stayKind?: infer K } ? K : never) : never) => makeItem({ category: "stay", metrics: { ...EMPTY_METRICS, stayKind: kind } });
  it("a flat or a house, a caravan, a hotel; a camp or a boat has none of its own", () => {
    expect(stayArt(stay("apartment"), false)).toBe("ev-daire");
    expect(stayArt(stay("house"), false)).toBe("ev-daire");
    expect(stayArt(stay("vehicle"), false)).toBe("karavan");
    expect(stayArt(stay("hotel_room"), true)).toBe("otel");
    expect(stayArt(stay("camp"), false)).toBeNull();
    expect(stayArt(stay("boat"), false)).toBeNull();
  });
  it("where the record doesn't say, an Airbnb is a home and anything else a hotel", () => {
    expect(stayArt(makeItem({ category: "stay" }), true)).toBe("ev-daire");
    expect(stayArt(makeItem({ category: "stay" }), false)).toBe("otel");
  });
});

describe("a contact link", () => {
  it("only a web page or a mail address", () => {
    expect(safeContactUrl("https://www.airbnb.com/users/show/1")).toBe("https://www.airbnb.com/users/show/1");
    expect(safeContactUrl("mailto:host@example.com")).toBe("mailto:host@example.com");
    expect(safeContactUrl("javascript:alert(1)")).toBeNull();
    expect(safeContactUrl("")).toBeNull();
    expect(safeContactUrl(undefined)).toBeNull();
  });
});
