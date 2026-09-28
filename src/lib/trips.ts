// Which trip does a new capture belong to? The model suggests one, but the decision is made here
// from facts: a Thailand hotel never lands in the Portugal trip just because the model said so.
import { normalize } from "./evidence";
import type { Item, Trip } from "./types";

export interface TripProfile {
  trip: Trip;
  countryCodes: Set<string>;
  countryNames: Set<string>;
  range: { start: string; end: string } | null;
}

export interface TripSignal {
  countryCode: string | null;
  country: string | null;
  start: string | null;
  end: string | null;
  suggestedTripId: string | null;
  suggestedTitle: string | null;
}

export type TripChoice = { tripId: string } | { newTitle: string };

const name = (value: string | null | undefined) =>
  value ? normalize(value).normalize("NFD").replace(/[̀-ͯ]/g, "") : "";

export function countryCodeOf(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

export function profileTrips(trips: Trip[], items: Item[]): TripProfile[] {
  return trips.map((trip) => {
    const own = items.filter((i) => i.tripId === trip.id && i.status !== "dismissed");
    const starts = own.map((i) => i.dates.start).filter(Boolean) as string[];
    const ends = own.map((i) => i.dates.end ?? i.dates.start).filter(Boolean) as string[];
    const range = trip.confirmedDates ?? (starts.length ? { start: starts.sort()[0], end: ends.sort().at(-1)! } : null);
    return {
      trip,
      countryCodes: new Set(own.map((i) => countryCodeOf(i.countryCode)).filter(Boolean) as string[]),
      countryNames: new Set([...own.map((i) => name(i.country)).filter(Boolean), name(trip.title)]),
      range,
    };
  });
}

const DAY = 24 * 3600e3;

/** Days between two date ranges (0 when they overlap). */
function gapDays(a: { start: string; end: string }, start: string, end: string | null): number {
  const s = Date.parse(start);
  const e = Date.parse(end ?? start);
  const as = Date.parse(a.start);
  const ae = Date.parse(a.end);
  if (e < as) return (as - e) / DAY;
  if (s > ae) return (s - ae) / DAY;
  return 0;
}

/** Trips closer than this in time count as the same journey (e.g. a 2-country trip). */
const SAME_JOURNEY_DAYS = 3;

export function chooseTrip(signal: TripSignal, profiles: TripProfile[]): TripChoice {
  const code = countryCodeOf(signal.countryCode);
  const country = name(signal.country);
  const byRecency = [...profiles].sort((a, b) => b.trip.updatedAt - a.trip.updatedAt);
  const suggested = profiles.find((p) => p.trip.id === signal.suggestedTripId);

  if (code || country) {
    const sameCountry = byRecency.filter(
      (p) => (code && p.countryCodes.has(code)) || (country && p.countryNames.has(country)),
    );
    if (sameCountry.length === 1) return { tripId: sameCountry[0].trip.id };
    if (sameCountry.length > 1) {
      // Same country twice (e.g. Portugal 2026 and 2027): dates decide, then the model, then recency.
      if (signal.start) {
        const dated = sameCountry.filter((p) => p.range);
        const nearest = dated.sort((a, b) => gapDays(a.range!, signal.start!, signal.end) - gapDays(b.range!, signal.start!, signal.end))[0];
        if (nearest) return { tripId: nearest.trip.id };
      }
      return { tripId: (sameCountry.find((p) => p === suggested) ?? sameCountry[0]).trip.id };
    }
    // A new country joins an existing trip only when the dates say it is the same journey.
    if (signal.start) {
      const journey = byRecency.find((p) => p.range && gapDays(p.range, signal.start!, signal.end) <= SAME_JOURNEY_DAYS);
      if (journey) return { tripId: journey.trip.id };
    }
    return { newTitle: signal.suggestedTitle?.trim() || signal.country?.trim() || "Yeni gezi" };
  }

  // No country (e.g. a regional eSIM or an unclear screenshot): trust the model, else the latest trip.
  if (suggested) return { tripId: suggested.trip.id };
  if (byRecency[0]) return { tripId: byRecency[0].trip.id };
  return { newTitle: signal.suggestedTitle?.trim() || "Yeni gezi" };
}
