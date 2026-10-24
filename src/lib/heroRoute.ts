// The route line on the hero's photo (A · Kapak, 2026-10-19): where the trip starts, each main place with its nights and
// whether its stay is booked, and where it ends, with how each step is made (a plane, a car, a train, a ferry) when the
// plan knows it; an arrow when it doesn't. The start and the end are the first flight's departure and the last flight's
// arrival, said only when they aren't one of the trip's places (home, for a trip flown to and from). Pure.
import { cityKeyOf } from "./plan";
import type { LegMode } from "./types";

/** How a step of the route is drawn; null: a plain arrow. */
export type RouteWay = "flight" | "car" | "train" | "ferry" | null;

export interface RouteStop {
  name: string;
  /** Its nights, from its stays; null when none are known. */
  nights: number | null;
  /** Every stay of it booked (green); else planned or still open (amber). */
  booked: boolean;
  /** Its country's code on the first stop of each country (0.46.0: its flag before it), else absent. */
  flag?: string;
}

export interface HeroRoute {
  /** Where it starts (home), or null. */
  from: string | null;
  stops: RouteStop[];
  /** Where it ends (home again), or null. */
  to: string | null;
  /** The ways between the points in order (from?, stops…, to?): one fewer than the points. */
  ways: RouteWay[];
}

const WAYS: Partial<Record<LegMode, RouteWay>> = { flight: "flight", train: "train", ferry: "ferry", car: "car", taxi: "car", transfer: "car" };

/** A leg's mode as the route draws it: a taxi or a transfer goes by road (the car); a bus, the metro or a walk is an arrow. */
export const routeWay = (mode: LegMode | null | undefined): RouteWay => (mode ? (WAYS[mode] ?? null) : null);

export function heroRoute(input: {
  /** The main places in the order of their nights (a region with its member towns, destinations.ts). */
  places: readonly (string | { name: string; members: readonly string[] })[];
  /** The plan's stay blocks: their city, their nights, booked or not. */
  stays: readonly { kind: string; nights: number; city: string | null }[];
  /** The plan's legs (legs.ts): a "move" from one place to the next carries its mode. */
  legs: readonly { kind: string; from: { city: string | null }; to: { city: string | null }; mode: LegMode | null; travel?: { mode: LegMode | null } | null }[];
  /** The trip's flights in time order, each end as a city. */
  flights: readonly { from: string | null; to: string | null }[];
  /** A place's country (its flag on the first stop of each country). */
  countryOf?: (place: string) => string | null;
}): HeroRoute | null {
  const keys = input.places.map((p) => new Set((typeof p === "string" ? [p] : [p.name, ...p.members]).map(cityKeyOf).filter((k): k is string => !!k)));
  const at = (city: string | null | undefined) => {
    const key = cityKeyOf(city ?? null);
    return key ? keys.findIndex((k) => k.has(key)) : -1;
  };
  const stops = input.places.map((p, n): RouteStop => {
    const mine = input.stays.filter((s) => at(s.city) === n);
    const nights = mine.reduce((sum, s) => sum + s.nights, 0);
    return { name: typeof p === "string" ? p : p.name, nights: nights || null, booked: mine.length > 0 && mine.every((s) => s.kind === "booked") };
  });
  if (!stops.length) return null;
  if (input.countryOf) {
    let was: string | null = null;
    for (const s of stops) {
      const c = input.countryOf(s.name);
      if (c && c !== was) s.flag = c;
      if (c) was = c;
    }
  }
  const first = input.flights[0]?.from?.trim() || null;
  const last = input.flights.at(-1)?.to?.trim() || null;
  const from = first && at(first) < 0 ? first : null;
  const to = last && at(last) < 0 ? last : null;
  const between = stops.slice(1).map((_, n) => {
    const move = input.legs.find((l) => l.kind === "move" && at(l.from.city) === n && at(l.to.city) === n + 1);
    return routeWay(move?.mode ?? move?.travel?.mode ?? null);
  });
  return { from, stops, to, ways: [...(from ? ["flight" as const] : []), ...between, ...(to ? ["flight" as const] : [])] };
}
