// The trip map's journeys (the board's "Harita" tab), pure: from the plan and its legs (legs.ts), every way between
// places in date order: the way out from home to the first stop, each change of city (a flight, a train, a bus, a
// ferry, a car), the way home from the last stop, and any flight or trip saved that no change of city took. The
// stops are the plan's cities with their nights. Two steps, so the places the tables don't know can be looked up
// (geocoded) in between: mapRoute names the ends, placeRoute puts them on the map; a journey with an end that
// can't be placed is left off and counted (the tab says so).
import { airportName, cityOfAirport, countryOfAirport } from "./airports";
import { flightMinutes, km, type LatLng } from "./mapArc";
import { travelsOf, type Leg, type Travel } from "./legs";
import { cityKeyOf, sameCity, type Plan } from "./plan";
import { cityCoord } from "./startCircuits";
import type { Item, LegMode } from "./types";

export type { LatLng };
/** How a journey goes, as the map draws it (a taxi or a transfer between cities is by car). */
export type MapMode = "flight" | "train" | "bus" | "ferry" | "car";

/** A place by name, with the coordinates a saved page gave when it did. */
export interface PlaceRef {
  name: string;
  geo?: LatLng | null;
  /** No place is said (nights without a city): never looked up, never on the map. */
  unknown?: boolean;
}
export interface MapPlace extends LatLng {
  name: string;
}

export interface StopRef extends PlaceRef {
  key: string;
  nights: number;
  /** The first night and the morning they leave (check-out day). */
  start: string;
  end: string;
}
export type MapStop = StopRef & MapPlace;

export interface LegRef {
  key: string;
  /** Out from home, a change of city (or a saved trip between places), back home. */
  kind: "out" | "move" | "back";
  date: string;
  from: PlaceRef;
  to: PlaceRef;
  mode: MapMode | null;
  /** How long it takes, when a saved booking says (null: not known yet). */
  minutes: number | null;
  /** Booked (drawn solid); anything else is still a plan (dashed). */
  booked: boolean;
}
export interface MapLeg extends Omit<LegRef, "from" | "to"> {
  from: MapPlace;
  to: MapPlace;
  /** The time is worked out from the distance (a flight with no times saved yet). */
  estimated: boolean;
}

export interface MapRoute {
  home: PlaceRef | null;
  stops: StopRef[];
  legs: LegRef[];
}
export interface TripMapData {
  home: MapPlace | null;
  stops: MapStop[];
  legs: MapLeg[];
  /** Journeys left off the map: an end of theirs can't be placed. */
  missing: LegRef[];
}

const MODES: Partial<Record<LegMode, MapMode>> = { flight: "flight", train: "train", bus: "bus", ferry: "ferry", car: "car", taxi: "car", transfer: "car" };
export const mapModeOf = (mode: LegMode | null | undefined): MapMode | null => (mode ? (MODES[mode] ?? null) : null);

const isCode = (text: string) => /^[A-Z]{3}$/.test(text.trim());

/** A place's name as written on the map: an airport code is its city ("CPH" → "Kopenhag"). */
const placeName = (text: string) => cityOfAirport(text.trim());

/** The settled item of a trip (booked, else chosen), else its first option. */
const itemOf = (t: Travel | null): Item | null => (t ? (t.settled ?? t.items[0] ?? null) : null);

const travelKey = (t: Travel) => `${t.group.key}|${t.day}`;

/** Minutes between two local times, when they can be trusted: a flight's only within one country (one time zone). */
function minutesOf(item: Item | null, mode: MapMode | null): number | null {
  if (!item) return null;
  const said = item.metrics?.durationMinutes;
  if (typeof said === "number" && said > 0) return said;
  const f = item.flight;
  if (!f?.departure || !f.arrival) return null;
  if (mode === "flight") {
    const [a, b] = [countryOfAirport(f.from), countryOfAirport(f.to)];
    if (!a || a !== b) return null;
  }
  const d = (Date.parse(f.arrival) - Date.parse(f.departure)) / 60_000;
  return d > 0 && d < 24 * 60 ? Math.round(d) : null;
}

/** The plan's cities in order, consecutive stays in one city as one stop with their nights added up. */
function stopsOf(plan: Plan): StopRef[] {
  const out: StopRef[] = [];
  for (const b of plan.stayBlocks) {
    if (!b.city) continue;
    const last = out[out.length - 1];
    if (last && sameCity(last.name, b.city) && last.end === b.range.start) {
      last.nights += b.nights;
      last.end = b.range.end;
      continue;
    }
    const geo = b.kind !== "open" && b.item.geo ? { lat: b.item.geo.lat, lng: b.item.geo.lng } : null;
    out.push({ key: cityKeyOf(b.city) ?? b.city, name: placeName(b.city), geo, nights: b.nights, start: b.range.start, end: b.range.end });
  }
  return out;
}

/**
 * The trip's journeys and stops by name, in date order. `home`: where the trip starts from when known otherwise
 * (else the first flight's departure, else the last flight's arrival).
 */
export function mapRoute(plan: Plan, legs: Leg[], opts: { home?: string | null } = {}): MapRoute {
  const stops = stopsOf(plan);
  const blocks = plan.stayBlocks.length;
  const travels = travelsOf(plan);
  const inbound = legs.find((l) => l.kind === "arrival" && l.slot === 0) ?? null;
  const outbound = [...legs].reverse().find((l) => l.kind === "departure" && l.slot === blocks) ?? null;
  const end = (t: Travel | null, side: "from" | "to") => {
    const v = itemOf(t)?.flight?.[side]?.trim();
    return v ? placeName(v) : null;
  };
  const used = new Set<string>();
  [inbound?.travel, outbound?.travel, ...legs.filter((l) => l.kind === "move").map((l) => l.travel)].forEach((t) => t && used.add(travelKey(t)));
  /**
   * A connection booked on its own (IST → FRA, then FRA → CPH): the same-day trips that land where this one leaves
   * (`back`: that leave where this one lands), in order. Home is where the first of them leaves, not Frankfurt.
   */
  const chain = (t: Travel | null, back: boolean): Travel[] => {
    const found: Travel[] = [];
    let at = t;
    while (at) {
      const here = at;
      const next = travels.find(
        (u) => !used.has(travelKey(u)) && !found.includes(u) &&
          (back ? u.day === here.arrives && sameCity(end(u, "from"), end(here, "to")) : u.arrives === here.day && sameCity(end(u, "to"), end(here, "from"))),
      );
      if (!next) break;
      found.push(next);
      used.add(travelKey(next));
      at = next;
    }
    return back ? found : found.reverse();
  };
  const before = chain(inbound?.travel ?? null, false);
  const after = chain(outbound?.travel ?? null, true);
  const homeName =
    opts.home?.trim() || end(before[0] ?? inbound?.travel ?? null, "from") || end(after.at(-1) ?? outbound?.travel ?? null, "to") || null;
  const home: PlaceRef | null = homeName ? { name: homeName } : null;
  const stopAt = (city: string | null) => (city ? (stops.find((s) => sameCity(s.name, city)) ?? null) : null);
  const refOf = (s: StopRef): PlaceRef => ({ name: s.name, geo: s.geo });

  const outs: LegRef[] = [];
  const rest: LegRef[] = [];
  const backs: LegRef[] = [];
  const legOf = (key: string, kind: LegRef["kind"], date: string, from: PlaceRef, to: PlaceRef, t: Travel | null, mode: LegMode | null, booked: boolean): LegRef => {
    const m = mapModeOf(mode ?? t?.mode ?? null);
    return { key, kind, date, from, to, mode: m, minutes: minutesOf(itemOf(t), m), booked };
  };
  const ownLeg = (t: Travel, kind: LegRef["kind"]) =>
    legOf(`${kind}:${travelKey(t)}`, kind, t.day, { name: end(t, "from")! }, { name: end(t, "to")! }, t, t.mode, t.settled?.status === "booked");

  const first = stops[0];
  if (first && inbound) {
    const t = inbound.travel;
    const from = end(t, "from") ?? home?.name ?? null;
    for (const c of before) outs.push(ownLeg(c, "out"));
    if (from) outs.push(legOf(`out:${inbound.key}`, "out", t?.day ?? inbound.date, { name: from }, refOf(first), t, t?.mode ?? inbound.via, t?.settled?.status === "booked"));
  }
  for (const l of legs) {
    if (l.kind !== "move") continue;
    const [a, b] = [stopAt(l.from.city), stopAt(l.to.city)];
    if (!a || !b) continue;
    rest.push(legOf(`move:${l.key}`, "move", l.date, refOf(a), refOf(b), l.travel, l.mode, l.status === "booked"));
  }
  // Nights with no place said between two cities: the way there and on can't be drawn (counted, not dropped).
  const bs = plan.stayBlocks;
  for (let i = 0; i < bs.length; i++) {
    if (bs[i].city || (i > 0 && !bs[i - 1].city)) continue;
    let j = i;
    while (j < bs.length && !bs[j].city) j++;
    const [prev, next] = [bs.slice(0, i).reverse().find((x) => x.city), bs[j]];
    if (!prev || !next) continue;
    const nowhere: PlaceRef = { name: "?", unknown: true };
    rest.push(legOf(`gap:${bs[i].range.start}:in`, "move", bs[i].range.start, { name: placeName(prev.city!) }, nowhere, null, null, false));
    rest.push(legOf(`gap:${bs[i].range.start}:on`, "move", next.range.start, nowhere, { name: placeName(next.city!) }, null, null, false));
  }
  const last = stops[stops.length - 1];
  if (last && outbound) {
    const t = outbound.travel;
    const to = end(t, "to") ?? home?.name ?? null;
    if (to) backs.push(legOf(`back:${outbound.key}`, "back", t?.day ?? outbound.date, refOf(last), { name: to }, t, t?.mode ?? outbound.via, t?.settled?.status === "booked"));
    for (const c of after) backs.push(ownLeg(c, "back"));
  }
  // Flights and trips chosen or booked that no change of city took (a trip with no stays yet, a side trip): their
  // own ends. An option only saved isn't drawn: it's one of the alternatives, not a way the trip goes.
  for (const t of travels) {
    if (used.has(travelKey(t)) || !t.settled) continue;
    const [from, to] = [end(t, "from"), end(t, "to")];
    if (!from || !to || sameCity(from, to)) continue;
    rest.push(ownLeg(t, "move"));
  }
  rest.sort((x, y) => x.date.localeCompare(y.date));
  return { home, stops, legs: [...outs, ...rest, ...backs] };
}

/** Coordinates the app knows without asking: the saved page's, else the city table's (an airport code by its city). */
export function knownCoord(ref: PlaceRef): LatLng | null {
  if (ref.unknown) return null;
  if (ref.geo) return ref.geo;
  return cityCoord(ref.name) ?? cityCoord(cityOfAirport(ref.name)) ?? null;
}

/** What to ask the geocoder for a place the tables don't know ("RTM" → "RTM airport"). */
export const geocodeQuery = (ref: PlaceRef): string => (isCode(ref.name) ? `${airportName(ref.name.trim())} airport` : ref.name);

/** The places of a route the tables can't place (to geocode), each once. */
export function unplaced(route: MapRoute): PlaceRef[] {
  const all = [...(route.home ? [route.home] : []), ...route.stops, ...route.legs.flatMap((l) => [l.from, l.to])];
  const seen = new Map<string, PlaceRef>();
  for (const r of all) if (!r.unknown && !knownCoord(r) && !seen.has(geocodeQuery(r))) seen.set(geocodeQuery(r), r);
  return [...seen.values()];
}

/** The route on the map: `coordOf` places what the tables don't (geocoded); a journey with an end it can't place is left off. */
export function placeRoute(route: MapRoute, coordOf: (ref: PlaceRef) => LatLng | null = () => null): TripMapData {
  const place = (r: PlaceRef): MapPlace | null => {
    if (r.unknown) return null;
    const c = knownCoord(r) ?? coordOf(r);
    return c ? { name: r.name, lat: c.lat, lng: c.lng } : null;
  };
  const home = route.home ? place(route.home) : null;
  const stops = route.stops.flatMap((s) => {
    const p = place(s);
    return p ? [{ ...s, ...p }] : [];
  });
  const legs: MapLeg[] = [];
  const missing: LegRef[] = [];
  for (const l of route.legs) {
    const [from, to] = [place(l.from), place(l.to)];
    if (!from || !to) {
      missing.push(l);
      continue;
    }
    const far = km(from, to);
    const estimated = l.minutes == null && l.mode === "flight" && far > 150;
    legs.push({ ...l, from, to, minutes: estimated ? flightMinutes(far) : l.minutes, estimated });
  }
  return { home, stops, legs, missing };
}

/** Both steps at once, with geocoded places by `geocodeQuery` (what the board has looked up so far). */
export function mapLegs(plan: Plan, legs: Leg[], opts: { home?: string | null; geocoded?: ReadonlyMap<string, LatLng | null> } = {}): TripMapData {
  return placeRoute(mapRoute(plan, legs, opts), (r) => opts.geocoded?.get(geocodeQuery(r)) ?? null);
}
