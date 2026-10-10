// The trip's shape (v11, lib/tripShape.ts): the stops from the nights and the flights in and out, their stages.
import { describe, expect, it } from "vitest";
import type { Plan } from "../src/lib/plan";
import { journeyOf } from "../src/lib/tripShape";
import { makeItem } from "./fixtures/makeItem";

const flight = (from: string, to: string, at: string, status: "saved" | "chosen" | "booked") =>
  makeItem({ name: `${from}-${to}`, category: "flight", status, flight: { from, to, departure: at, arrival: null, carrier: null, flightNumber: null, stops: 0 } });
const stay = (city: string, start: string, end: string, nights: number, kind: "booked" | "chosen" | "open") =>
  (kind === "open"
    ? { kind, range: { start, end }, nights, city, groups: [], searchUrl: "" }
    : kind === "chosen"
      ? { kind, range: { start, end }, nights, city, item: makeItem({ name: city, category: "stay", city }), groups: [] }
      : { kind, range: { start, end }, nights, city, item: makeItem({ name: city, category: "stay", city }) }) as Plan["stayBlocks"][number];

describe("the trip's shape", () => {
  it("starts and ends with the flights, a stop a city (its nights added up), each in its stage", () => {
    const plan = { stayBlocks: [stay("Tokyo", "2027-04-01", "2027-04-04", 3, "booked"), stay("Tokyo", "2027-04-04", "2027-04-06", 2, "chosen"), stay("Kyoto", "2027-04-06", "2027-04-11", 5, "open")] };
    const items = [flight("IST", "HND", "2027-04-01T01:55", "booked"), flight("KIX", "IST", "2027-04-11T22:30", "chosen")];
    const shape = journeyOf(plan, [], items)!;
    expect(shape.stops.map((s) => [s.city, s.sub, s.stage])).toEqual([
      ["İstanbul", "1 Nisan", "booked"],
      ["Tokyo", "5 gece", "chosen"],
      ["Kyoto", "5 gece", "open"],
      ["İstanbul", "11 Nisan", "chosen"],
    ]);
    expect(shape.hops.map((h) => h.mode)).toEqual(["flight", "train", "flight"]);
  });

  it("nothing slept anywhere yet: no shape", () => {
    expect(journeyOf({ stayBlocks: [] }, [], [])).toBeNull();
  });
});
