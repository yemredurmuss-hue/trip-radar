// Does a capture belong in the trip it is about to go into? (spec 2026-10-06 trip routing.) A page's place is
// checked against the trip's own places before anything is added: a Bali tour never lands in the Portugal trip
// because that trip was open, or because the page's date picker said 8 October. Pure: process.ts acts on it.
import { cityOfAirport, countryOfAirport } from "./airports";
import { nearCountries } from "./countryCenters";
import { ownCountries, type PlacedRecord } from "./tripCountries";
import { cityKeyOf } from "./plan";
import type { Extraction } from "./extract";
import { L } from "./i18n";
import { locative } from "./i18nText";
import { countryCodeOfName, knownPlaceOf, placeOf } from "./startTrip";
import { countryCodeOf, countryName, firstFlight, gapDays, isDemoTrip, profileTrips } from "./trips";
import type { Item, Trip } from "./types";

type Placed = Pick<Item, "category" | "countryCode" | "country" | "city" | "flight">;

/** A place's country from its name, when the code knows it ("Funchal" → PT, "Bali" → ID, "Portekiz" → PT). */
function codeOfPlaceName(name: string | null | undefined): string | null {
  const n = name?.trim();
  if (!n) return null;
  if (knownPlaceOf(n)) return placeOf(n).code ?? null;
  return countryCodeOfName(n) ?? countryOfAirport(/^[A-Za-z]{3}$/.test(n) ? n : null);
}

/**
 * The countries a record is in: its own code, else its country's name, else its city when the code knows it.
 * A flight is in both of its ends (the flight home lands at home, but leaves from the trip).
 */
export function placeCodes(item: Placed): string[] {
  const own = countryCodeOf(item.countryCode) ?? codeOfPlaceName(item.country) ?? codeOfPlaceName(item.city);
  if (item.category !== "flight") return own ? [own] : [];
  const ends = [own ?? codeOfPlaceName(item.flight?.to), codeOfPlaceName(item.flight?.from)];
  return [...new Set(ends.filter((c): c is string => Boolean(c)))];
}

/** A trip's records for ownCountries: its places, and where its first flight lands (tripCountries.ts). */
export function tripRecords(own: Item[]): PlacedRecord[] {
  const places = own
    .filter((i) => i.category !== "flight")
    .map((i) => ({ codes: placeCodes(i), stay: i.category === "stay", start: i.dates.start, end: i.dates.end, kept: i.placeOk }));
  const first = firstFlight(own);
  const arrival = first ? (countryCodeOf(first.countryCode) ?? codeOfPlaceName(first.flight?.to)) : null;
  return arrival ? [...places, { codes: [arrival], stay: false, arrival: true, start: first!.dates.start }] : places;
}

/**
 * The countries a trip is in, from what's in it (not the record being checked): its own countries, where a record
 * far from the rest (a Bali tour saved into the Portugal trip) doesn't count. Empty: no place yet (it takes anything).
 */
export function tripPlaceCodes(tripId: string, items: Item[], exceptId?: string): Set<string> {
  return ownCountries(tripRecords(items.filter((i) => i.tripId === tripId && i.id !== exceptId && i.status !== "dismissed")));
}

/**
 * Where the trip starts from: the country and city its first flight leaves from (İstanbul). An airport hotel, a
 * lounge or an insurance for the way there belongs to the trip, never to another trip in that country.
 */
export function tripStart(tripId: string, items: Item[]): { code: string | null; city: string | null } {
  const from = firstFlight(items.filter((i) => i.tripId === tripId))?.flight?.from ?? null;
  return { code: codeOfPlaceName(from), city: from ? cityKeyOf(cityOfAirport(from.trim())) : null };
}

/**
 * The way to and from the trip: a flight, an airport hotel, a lounge, an airport transfer, insurance, an eSIM.
 * Only these are the trip's when they're at home (review E): a Kapadokya hotel sent in the Bali chat isn't.
 */
export function isWayThere(item: Pick<Item, "category" | "name" | "summary" | "city"> & Partial<Pick<Item, "plannedKind">>): boolean {
  if (item.category === "flight" || item.category === "esim" || item.plannedKind === "insurance") return true;
  const words = `${item.name} ${item.summary ?? ""}`;
  if (/sigorta|insurance|assurance|seguro|versicherung/i.test(words)) return true;
  if (/lounge|salon/i.test(words)) return true;
  return /airport|havaliman|havalimanı|aeroporto|aeropuerto|aéroport|flughafen|\b[A-Z]{3}\s+(?:airport|transfer)\b/i.test(words);
}

/**
 * A record's dates in the trip it is moved to: kept when they fall in that trip's dates (or it has none yet, or it
 * is booked); dropped otherwise, so a page's remembered dates never stretch or break the trip (spec review #2).
 */
export function datesIn(item: Item, trip: Trip, items: Item[]): Item["dates"] {
  if (!item.dates.start || item.status === "booked") return item.dates;
  const range = profileTrips([trip], items.filter((i) => i.id !== item.id))[0]?.range;
  if (!range || gapDays(range, item.dates.start, item.dates.end) === 0) return item.dates;
  return { start: null, end: null, source: "none" };
}

/** The countries a trip's title names ("Porto ve Madeira Gezisi" → PT, "Bali" → ID): only to find a trip, never to refuse one. */
export function titleCodes(title: string): Set<string> {
  const words = title.split(/[\s,·/&+()–-]+/).filter((w) => w.length >= 3);
  const codes = [title, ...words, ...words.slice(1).map((w, i) => `${words[i]} ${w}`)].map(codeOfPlaceName);
  return new Set(codes.filter((c): c is string => Boolean(c)));
}

/**
 * in: the trip is there (or starts there, or it's home); near: another country close enough to be the same
 * journey (Portugal → Spain); far: another trip altogether (Portugal → Bali); unknown: the record's place or the
 * trip's isn't known yet, or the distance can't be measured.
 */
export type Fit = "in" | "near" | "far" | "unknown";

export function placeFit(codes: readonly string[], tripCodes: ReadonlySet<string>, home: ReadonlySet<string> = new Set()): Fit {
  if (codes.some((c) => home.has(c))) return "in";
  if (!codes.length || !tripCodes.size) return "unknown";
  if (codes.some((c) => tripCodes.has(c))) return "in";
  const near = codes.flatMap((c) => [...tripCodes].map((t) => nearCountries(c, t)));
  if (near.includes(true)) return "near";
  if (near.includes(null)) return "unknown";
  return "far";
}

/**
 * Whether a page is something for a trip at all. The model says so (`travel`); an answer from before that
 * field: a page that is "other" with no place, date, price, rating or booking in it isn't (a robots article).
 */
export function looksLikeTravel(x: Pick<Extraction, "category" | "city" | "country" | "country_code" | "price" | "dates" | "rating" | "flight" | "booked"> & { travel?: boolean | null }): boolean {
  if (x.booked) return true;
  if (x.travel === true) return true;
  if (x.travel === false) return false;
  const nothing = !x.city && !x.country && !x.country_code && x.price.amount == null && !x.dates.start && x.rating.value == null && !x.flight;
  return !(x.category === "other" && nothing);
}

/**
 * The trip a place belongs to, other than `except`: one with something in that country first (the nearest dates
 * win), else one whose title names it; never a sample trip. Null when there is none.
 */
export function tripForPlace(codes: readonly string[], trips: Trip[], items: Item[], except: string | null, start: string | null, end: string | null = null): Trip | null {
  if (!codes.length) return null;
  const candidates = trips.filter((t) => t.id !== except && !isDemoTrip(t));
  const profiles = profileTrips(candidates, items);
  const gap = (t: Trip) => {
    const range = profiles.find((p) => p.trip.id === t.id)?.range;
    return start && range ? gapDays(range, start, end) : Infinity;
  };
  const byFit = (list: Trip[]) => [...list].sort((a, b) => gap(a) - gap(b) || b.updatedAt - a.updatedAt)[0] ?? null;
  const placed = candidates.filter((t) => codes.some((c) => tripPlaceCodes(t.id, items).has(c)));
  if (placed.length) return byFit(placed);
  return byFit(candidates.filter((t) => codes.some((c) => titleCodes(t.title).has(c))));
}

/** What to do with a capture once it is read. */
export type Route =
  | { kind: "keep" }
  /** It belongs to another trip: it goes there, and `noteIn` (where it was handed) says so with Aç · Geri al. */
  | { kind: "move"; toTripId: string }
  /**
   * Nothing is added (a record already saved stays as it is): the trip `askIn` (null: none to ask in, the home
   * asks) asks where it goes, or whether it goes at all; `toTripId`: the trip of its place, offered as a choice.
   */
  | { kind: "ask"; reason: "place" | "travel"; askIn: string | null; toTripId?: string | null };

export interface RouteInput {
  /** The record as it would be saved (merged into an earlier save of the same page, when there was one). */
  item: Item;
  /** It merged into a record already saved (that one was checked when it came). */
  merged: boolean;
  /** Its trip is a new one, made only if the record goes into it. */
  newTrip: boolean;
  /** Where it was handed over: a trip's board or chat. Null: from the toolbar, or the home. */
  anchorId: string | null;
  /** Dropped on that trip's board: the traveller put it there, so a far place is asked about, never moved. */
  board?: boolean;
  /** The traveller's home country, when known (Settings → Pasaport): always the trip's own. */
  home?: string | null;
  travel: boolean;
  trips: Trip[];
  /** Every saved record (the one being checked is left out by id). */
  items: Item[];
}

/**
 * The checks, in order: a page that isn't travel is asked about (never when it updates a record already there);
 * a page whose place is far from its trip's goes to the trip of that place, or is asked about. A trip with no
 * place yet, a page whose place isn't known, and a country near the trip's (Portugal → Spain) go in as before.
 */
export function routeCapture(input: RouteInput): Route {
  const { item, anchorId, trips, items } = input;
  const latest = [...trips].filter((t) => !isDemoTrip(t)).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null;
  if (!input.travel && !input.merged) return { kind: "ask", reason: "travel", askIn: anchorId ?? (input.newTrip ? latest : item.tripId) };
  // A record the traveller said stays where it is ("Burada kalsın", strays.ts) isn't moved by a later save of it.
  if (input.merged && item.placeOk) return { kind: "keep" };
  const codes = placeCodes(item);
  // A new trip takes its place from the record (as always); handed to a trip, that trip's places are what count.
  const checked = input.newTrip ? anchorId : item.tripId;
  if (!checked) return { kind: "keep" };
  if (placeFitOf(item, checked, trips, items, input.home ?? null) !== "far") return { kind: "keep" };
  let other = tripForPlace(codes, trips, items.filter((i) => i.id !== item.id), checked, item.dates.start, item.dates.end);
  // A stay or a ticket with its own dates (searched, booked) goes to that trip only on that trip's dates: the
  // İstanbul hotel of 7 October is never the May Kapadokya trip's (review B); asked instead.
  if (other && hardDates(item)) {
    const range = profileTrips([other], items.filter((i) => i.id !== item.id))[0]?.range;
    if (range && gapDays(range, item.dates.start!, item.dates.end) > 7) other = null;
  }
  if (input.board) return { kind: "ask", reason: "place", askIn: checked, toTripId: other?.id ?? null };
  if (other) return { kind: "move", toTripId: other.id };
  // Handed to a trip and far from it, with no trip of its own yet: asked, not a new trip made behind the scenes.
  return { kind: "ask", reason: "place", askIn: anchorId ?? item.tripId };
}

/** Dates that are the record's own, not a page's guess: searched for (in the address), booked, or a stay's or a ticket's. */
export const hardDates = (item: Item): boolean =>
  Boolean(item.dates.start) && (item.dates.source === "url" || item.status === "booked" || ["stay", "flight", "transport"].includes(item.category));

/**
 * A record against a trip: the trip's places (what's in it besides the record, and what its title names) are its
 * own. So are where it starts from and home, but only for the way there (an airport hotel, a lounge, insurance,
 * an eSIM, a transfer, a flight) or a place in the very city it leaves from (review E).
 */
export function placeFitOf(item: Item, tripId: string, trips: Trip[], items: Item[], home: string | null): Fit {
  const trip = trips.find((t) => t.id === tripId);
  const places = new Set([...tripPlaceCodes(tripId, items, item.id), ...(trip ? titleCodes(trip.title) : [])]);
  const start = tripStart(tripId, items.filter((i) => i.id !== item.id));
  const fromCity = Boolean(start.city && item.city && cityKeyOf(item.city) === start.city);
  const own = isWayThere(item) || fromCity ? new Set([start.code, home].filter((c): c is string => Boolean(c))) : new Set<string>();
  return placeFit(placeCodes(item), places, own);
}

/** The countries' names in the board's language, "Portekiz ve İspanya". */
export function countriesText(codes: Iterable<string>): string {
  const names = [...codes].map((c) => countryName(c) ?? c).slice(0, 3);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")}${L(" ve ", " and ")}${names.at(-1)}` : (names[0] ?? "");
}

/** The question's words: "Nusa Penida: bu yer Endonezya'da, gezin Portekiz'de. Nereye ekleyeyim?" */
export function askText(reason: "place" | "travel", name: string, placeCodesOfItem: readonly string[], tripCodes: Iterable<string>): string {
  if (reason === "travel") return L(`${name}: bu sayfa bir gezi planına benzemiyor. Yine de eklensin mi?`, `${name}: this page doesn't look like part of a trip plan. Add it anyway?`);
  const here = countriesText(placeCodesOfItem.slice(0, 1));
  const trip = countriesText(tripCodes);
  return L(
    `${name}: bu yer ${locative(here)}, gezin ${locative(trip)}. Nereye ekleyeyim?`,
    `${name}: this place is in ${here}, your trip is in ${trip}. Where should I add it?`,
  );
}
