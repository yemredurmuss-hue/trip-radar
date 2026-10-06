// Does a capture belong in the trip it is about to go into? (spec 2026-10-06 trip routing.) A page's place is
// checked against the trip's own places before anything is added: a Bali tour never lands in the Portugal trip
// because that trip was open, or because the page's date picker said 8 October. Pure: process.ts acts on it.
import { countryOfAirport } from "./airports";
import { nearCountries } from "./countryCenters";
import type { Extraction } from "./extract";
import { L } from "./i18n";
import { locative } from "./i18nText";
import { countryCodeOfName, knownPlaceOf, placeOf } from "./startTrip";
import { countryCodeOf, countryName, gapDays, isDemoTrip, profileTrips } from "./trips";
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

/**
 * The countries a trip is in, from what's in it (not the record being checked): its places' countries; a trip
 * with only flights so far, the first flight's arrival. Empty: the trip has no place yet (it takes anything).
 */
export function tripPlaceCodes(tripId: string, items: Item[], exceptId?: string): Set<string> {
  const own = items.filter((i) => i.tripId === tripId && i.id !== exceptId && i.status !== "dismissed");
  const places = own.filter((i) => i.category !== "flight").flatMap(placeCodes);
  if (places.length) return new Set(places);
  const first = own
    .filter((i) => i.category === "flight")
    .sort((a, b) => (a.flight?.departure ?? a.dates.start ?? "9").localeCompare(b.flight?.departure ?? b.dates.start ?? "9"))[0];
  const arrival = first ? (countryCodeOf(first.countryCode) ?? codeOfPlaceName(first.flight?.to)) : null;
  return new Set(arrival ? [arrival] : []);
}

/** The countries a trip's title names ("Porto ve Madeira Gezisi" → PT, "Bali" → ID): only to find a trip, never to refuse one. */
export function titleCodes(title: string): Set<string> {
  const words = title.split(/[\s,·/&+()–-]+/).filter((w) => w.length >= 3);
  const codes = [title, ...words, ...words.slice(1).map((w, i) => `${words[i]} ${w}`)].map(codeOfPlaceName);
  return new Set(codes.filter((c): c is string => Boolean(c)));
}

/**
 * in: the trip is there; near: another country close enough to be the same journey (Portugal → Spain); far:
 * another trip altogether (Portugal → Bali); unknown: the record's place or the trip's isn't known yet.
 */
export type Fit = "in" | "near" | "far" | "unknown";

export function placeFit(codes: readonly string[], tripCodes: ReadonlySet<string>): Fit {
  if (!codes.length || !tripCodes.size) return "unknown";
  if (codes.some((c) => tripCodes.has(c))) return "in";
  if (codes.some((c) => [...tripCodes].some((t) => nearCountries(c, t)))) return "near";
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
  /** Nothing is added: the trip `askIn` (null: none to ask in) asks where it goes, or whether it goes at all. */
  | { kind: "ask"; reason: "place" | "travel"; askIn: string | null };

export interface RouteInput {
  /** The record as it would be saved (merged into an earlier save of the same page, when there was one). */
  item: Item;
  /** It merged into a record already saved (that one was checked when it came). */
  merged: boolean;
  /** Its trip is a new one, made only if the record goes into it. */
  newTrip: boolean;
  /** Where it was handed over: a trip's board or chat. Null: from the toolbar, or the home. */
  anchorId: string | null;
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
  const codes = placeCodes(item);
  // A new trip takes its place from the record (as always); handed to a trip, that trip's places are what count.
  const checked = input.newTrip ? anchorId : item.tripId;
  if (!checked) return { kind: "keep" };
  const fit = placeFit(codes, tripPlaceCodes(checked, items, item.id));
  if (fit !== "far") return { kind: "keep" };
  const other = tripForPlace(codes, trips, items.filter((i) => i.id !== item.id), checked, item.dates.start, item.dates.end);
  if (other) return { kind: "move", toTripId: other.id };
  // Handed to a trip and far from it, with no trip of its own yet: asked, not a new trip made behind the scenes.
  return { kind: "ask", reason: "place", askIn: anchorId ?? item.tripId };
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
