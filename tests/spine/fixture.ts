// Small trips for the spine tests: a trip, a stay, a flight; override what the test is about.
import type { Item, Trip } from "../../src/lib/types";
import { makeItem } from "../fixtures/makeItem";

export const tripOf = (over: Partial<Trip> = {}): Trip => ({
  id: "t1", title: "Japonya", confirmedDates: { start: "2026-04-01", end: "2026-04-11" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1, ...over,
});

export const stay = (city: string, start: string, end: string, over: Partial<Item> = {}): Item =>
  makeItem({ category: "stay", needKey: `stay:${city}`, name: `${city} Hotel`, city, dates: { start, end, source: "page" }, ...over });

export const flight = (from: string, to: string, day: string, over: Partial<Item> = {}): Item =>
  makeItem({
    category: "flight", needKey: `flight:${from}-${to}`, name: `${from} → ${to}`, dates: { start: day, end: null, source: "page" },
    flight: { from, to, departure: `${day}T10:00`, arrival: `${day}T20:00`, carrier: "TK", flightNumber: "TK1", stops: 0 },
    ...over,
  });
