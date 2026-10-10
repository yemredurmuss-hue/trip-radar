// The flight function's rules (supabase/functions/flight/shape.ts): what may be asked, AeroDataBox's answer as
// the extension reads it, and how long a cached answer stays good.
import { describe, expect, it } from "vitest";
import { askableDay, flightNumber, freshFor, shapeFlight } from "../supabase/functions/flight/shape";

const now = new Date("2026-10-06T12:00:00Z");
// AeroDataBox's answer for one flight, as its docs give it (trimmed).
const answer = [
  {
    number: "KL 1577",
    status: "Expected",
    codeshareStatus: "IsOperator",
    airline: { name: "KLM" },
    departure: { airport: { iata: "AMS", shortName: "Schiphol" }, scheduledTime: { utc: "2026-10-07 18:30Z", local: "2026-10-07 20:30+02:00" }, terminal: "2", gate: "D5" },
    arrival: { airport: { iata: "OPO", name: "Porto" }, scheduledTime: { utc: "2026-10-07 21:05Z", local: "2026-10-07 22:05+01:00" }, runwayTime: { utc: "2026-10-07 20:58Z", local: "2026-10-07 21:58+01:00" }, baggageBelt: "4" },
  },
  { number: "DL 9520", status: "Expected", codeshareStatus: "IsCodeshared", airline: { name: "Delta" }, departure: {}, arrival: {} },
];

describe("what may be asked", () => {
  it("a flight number, spaces and case aside", () => {
    expect(flightNumber("KL 1577")).toBe("KL1577");
    expect(flightNumber("pc1071")).toBe("PC1071");
    expect(flightNumber("Porto Campanhã")).toBeNull();
    expect(flightNumber("")).toBeNull();
  });
  it("a day from two days ago to a year ahead", () => {
    expect(askableDay("2026-10-07", now)).toBe("2026-10-07");
    expect(askableDay("2026-09-01", now)).toBeNull();
    expect(askableDay("2028-01-01", now)).toBeNull();
    expect(askableDay("7 Ekim", now)).toBeNull();
  });
});

describe("the answer as the extension reads it", () => {
  it("the operating flight, its local times, gate, terminal and belt", () => {
    expect(shapeFlight(answer, "KL1577", "t")).toEqual({
      number: "KL1577",
      airline: "KLM",
      status: "Expected",
      departure: { iata: "AMS", airport: "Schiphol", scheduled: "2026-10-07T20:30", revised: null, actual: null, terminal: "2", gate: "D5", desk: null },
      arrival: { iata: "OPO", airport: "Porto", scheduled: "2026-10-07T22:05", revised: null, actual: "2026-10-07T21:58", terminal: null, gate: null, belt: "4" },
      minutes: 155,
      fetchedAt: "t",
    });
  });
  it("nothing found: null", () => {
    expect(shapeFlight([], "KL1577", "t")).toBeNull();
    expect(shapeFlight({ message: "nope" }, "KL1577", "t")).toBeNull();
  });
});

describe("how long an answer stays good", () => {
  const f = shapeFlight(answer, "KL1577", "t")!;
  it("a day while far, minutes on its day, for good once landed", () => {
    expect(freshFor(f, "2026-10-07", new Date("2026-10-01T12:00:00Z"))).toBe(24 * 60);
    expect(freshFor(f, "2026-10-07", new Date("2026-10-07T10:00:00Z"))).toBe(180);
    expect(freshFor(f, "2026-10-07", new Date("2026-10-07T19:00:00Z"))).toBe(15);
    expect(freshFor({ ...f, status: "Arrived" }, "2026-10-07", now)).toBe(Infinity);
    // A runway time days ahead is a forecast: still asked again.
    expect(freshFor(f, "2026-10-07", new Date("2026-10-01T12:00:00Z"))).toBe(24 * 60);
  });
});
