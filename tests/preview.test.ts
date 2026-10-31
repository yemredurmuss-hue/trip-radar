// tests/preview.test.ts: "dur, şöyle olursa böyle olur" (omurga Tur 19, step 2): a change tried on copies says what it would
// do, counted by the code: nothing saved, the booked cabin it would move, the nights it leaves with no bed, the flight left
// outside shorter dates, the change of city a new stop makes.
import { expect, it } from "vitest";
import { tools } from "../src/lib/assistant";
import { effectsOf, quiet, tried } from "../src/lib/preview";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const trip: Trip = { id: "t1", title: "Tromsø", confirmedDates: { start: "2027-02-15", end: "2027-02-20" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const stay = (id: string, name: string, city: string, start: string, end: string, status: Item["status"] = "saved") =>
  makeItem({ id, name, category: "stay", city, countryCode: "NO", needKey: `stay:${id}`, dates: { start, end, source: "url" }, status });
const flight = (id: string, day: string, from: string, to: string) =>
  makeItem({ id, name: `Uçuş · ${from} → ${to}`, category: "flight", needKey: `flight:${id}`, city: to, dates: { start: day, end: null, source: "page" }, flight: { from, to, departure: `${day}T10:00`, arrival: `${day}T14:00`, carrier: null, flightNumber: null, stops: 0 } });
const items = [
  flight("out", "2027-02-15", "İstanbul", "Tromsø"),
  stay("a", "Konaklama · Tromsø", "Tromsø", "2027-02-15", "2027-02-17"),
  stay("cabin", "Cam tavanlı kulübe", "Tromsø", "2027-02-17", "2027-02-18", "booked"),
  stay("b", "Konaklama · Tromsø", "Tromsø", "2027-02-18", "2027-02-20"),
  flight("home", "2027-02-20", "Tromsø", "İstanbul"),
];

it("nothing is saved: the change is made on copies", () => {
  const copy = tried(trip, items, { moves: [{ item_id: "cabin", date: "2027-02-19", end_date: "2027-02-20" }] });
  expect(copy.items.find((i) => i.id === "cabin")!.dates.start).toBe("2027-02-19");
  expect(items.find((i) => i.id === "cabin")!.dates.start).toBe("2027-02-17");
  expect(trip.confirmedDates!.end).toBe("2027-02-20");
});

it("the cabin on the last night: the booking it moves and the night it leaves with no bed", () => {
  const e = effectsOf(trip, items, { moves: [{ item_id: "cabin", date: "2027-02-19", end_date: "2027-02-20" }] });
  expect(e.held).toEqual([{ name: "Cam tavanlı kulübe", status: "booked", what: expect.stringMatching(/^moved to 19/) }]);
  expect(e.no_bed).toEqual(["17 Şubat"]);
  expect(quiet(e)).toBe(false);
});

it("one day shorter: the flight home falls outside the dates", () => {
  const e = effectsOf(trip, items, { end: "2027-02-19" });
  expect(e.dates).toEqual({ before: "15–20 Şubat", after: "15–19 Şubat" });
  expect(e.flights_outside).toEqual(["Uçuş · Tromsø → İstanbul"]);
});

it("a new stop makes a change of city (a transfer to find) and its nights", () => {
  const e = effectsOf(trip, items, {
    moves: [{ item_id: "b", date: "2027-02-18", end_date: "2027-02-19" }],
    adds: [{ kind: "stay", title: null, city: "Lyngen", date: "2027-02-19", end_date: "2027-02-20" }],
  });
  expect(e.nights).toEqual(expect.arrayContaining([{ place: "Tromsø", before: 5, after: 4 }, { place: "Lyngen", before: 0, after: 1 }]));
  expect(e.moves_added.some((m) => m.startsWith("Tromsø → Lyngen"))).toBe(true);
  expect(e.held).toEqual([]);
});

it("a change that moves nothing that matters says so", () => {
  expect(quiet(effectsOf(trip, items, {}))).toBe(true);
});

it("the chat has it as a tool that saves nothing", () => {
  const tool = tools().find((t) => t.name === "try_change");
  expect(tool?.description).toMatch(/HİÇBİR ŞEY KAYDETMEZ|SAVES NOTHING/);
});
