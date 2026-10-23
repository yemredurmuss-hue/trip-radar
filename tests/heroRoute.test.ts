// The route on the hero's photo (lib/heroRoute.ts, A · Kapak 2026-10-19): home, each main place with its nights and
// whether its stay is booked, home again; a plane, a car, a train or a ferry between when the plan knows it, else an arrow.
import { describe, expect, it } from "vitest";
import { heroRoute, routeWay } from "../src/lib/heroRoute";
import type { LegMode } from "../src/lib/types";

const stay = (city: string, nights: number, kind = "booked") => ({ kind, nights, city });
const move = (from: string, to: string, mode: LegMode | null, travel: LegMode | null = null) => ({ kind: "move", from: { city: from }, to: { city: to }, mode, travel: { mode: travel } });

describe("heroRoute", () => {
  it("0.46.0: a country's flag on its first stop, the next country's on its own", () => {
    const of: Record<string, string> = { "Buenos Aires": "AR", "El Calafate": "AR", "Puerto Natales": "CL", Santiago: "CL" };
    const r = heroRoute({
      places: ["Buenos Aires", "El Calafate", "Puerto Natales", "Santiago"],
      stays: [stay("Buenos Aires", 3), stay("El Calafate", 2), stay("Puerto Natales", 2), stay("Santiago", 2)],
      legs: [],
      flights: [],
      countryOf: (p) => of[p] ?? null,
    });
    expect(r?.stops.map((s) => s.flag ?? null)).toEqual(["AR", null, "CL", null]);
  });

  it("goes from home through each place with its nights and back, by plane at the ends", () => {
    const r = heroRoute({
      places: ["Tromsø", "Senja"],
      stays: [stay("Tromsø", 4), stay("Senja", 3, "chosen")],
      legs: [move("Tromsø", "Senja", null)],
      flights: [
        { from: "İstanbul", to: "Tromsø" },
        { from: "Tromsø", to: "İstanbul" },
      ],
    });
    expect(r).toEqual({
      from: "İstanbul",
      stops: [
        { name: "Tromsø", nights: 4, booked: true },
        { name: "Senja", nights: 3, booked: false },
      ],
      to: "İstanbul",
      ways: ["flight", null, "flight"],
    });
  });

  it("draws the way between two places as the plan has it (a car, a train, a ferry), a region's towns as one place", () => {
    const r = heroRoute({
      places: ["Positano", { name: "Madeira", members: ["Funchal", "Gaula"] }, "Lizbon"],
      stays: [stay("Positano", 3), stay("Funchal", 2), stay("Gaula", 1, "open"), stay("Lizbon", 2)],
      legs: [move("Positano", "Funchal", null, "ferry"), { kind: "change", from: { city: "Funchal" }, to: { city: "Gaula" }, mode: "taxi" }, move("Gaula", "Lizbon", "train")],
      flights: [],
    });
    expect(r?.stops).toEqual([
      { name: "Positano", nights: 3, booked: true },
      { name: "Madeira", nights: 3, booked: false },
      { name: "Lizbon", nights: 2, booked: true },
    ]);
    expect(r?.ways).toEqual(["ferry", "train"]);
    expect([r?.from, r?.to]).toEqual([null, null]);
  });

  it("says no home when a flight starts or ends at one of the places, and nights unknown as null", () => {
    const r = heroRoute({ places: ["Porto", "Lizbon"], stays: [], legs: [move("Porto", "Lizbon", "car")], flights: [{ from: "Porto", to: "Lizbon" }] });
    expect(r).toEqual({ from: null, stops: [{ name: "Porto", nights: null, booked: false }, { name: "Lizbon", nights: null, booked: false }], to: null, ways: ["car"] });
    expect(heroRoute({ places: [], stays: [], legs: [], flights: [] })).toBeNull();
  });

  it("draws a taxi or a transfer as the road, a bus or a walk as an arrow", () => {
    expect([routeWay("taxi"), routeWay("transfer"), routeWay("car"), routeWay("bus"), routeWay("walk"), routeWay(null)]).toEqual(["car", "car", "car", null, null, null]);
  });
});
