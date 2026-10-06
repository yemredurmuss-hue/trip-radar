// Which trip does a new capture belong to? The model suggests one, but the decision is made here
// from facts: a Thailand hotel never lands in the Portugal trip just because the model said so.
import { nearCountries } from "./countryCenters";
import { normalize } from "./evidence";
import { L, lang } from "./i18n";
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
  /**
   * The dates are only the page's (an activity's date picker, a restaurant's booking box), not what was searched
   * for: a trip to the same place is still that trip whatever they say (spec 2026-10-06 trip routing).
   */
  softDates?: boolean;
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
export function gapDays(a: { start: string; end: string }, start: string, end: string | null): number {
  const s = Date.parse(start);
  const e = Date.parse(end ?? start);
  const as = Date.parse(a.start);
  const ae = Date.parse(a.end);
  if (e < as) return (as - e) / DAY;
  if (s > ae) return (s - ae) / DAY;
  return 0;
}

/** Same country and dates at most this far apart = the same trip ("benzer tarihler"). */
const SAME_TRIP_DAYS = 7;
/** A different country joins a trip only when its dates touch it (e.g. Portugal → Spain). */
const SAME_JOURNEY_DAYS = 2;

/** "PT" → "Portekiz" / "Portugal" (used when the model gave a code but no name). */
export function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([lang()], { type: "region" }).of(code) ?? null;
  } catch {
    return null;
  }
}

/** Sample trips never receive real captures. */
export const isDemoTrip = (trip: Trip) => Boolean(trip.demo) || /\((örnek|sample)\)$/.test(trip.title.trim());

export function chooseTrip(signal: TripSignal, allProfiles: TripProfile[]): TripChoice {
  const profiles = allProfiles.filter((p) => !isDemoTrip(p.trip));
  const code = countryCodeOf(signal.countryCode);
  const country = name(signal.country);
  const byRecency = [...profiles].sort((a, b) => b.trip.updatedAt - a.trip.updatedAt);
  const suggested = profiles.find((p) => p.trip.id === signal.suggestedTripId);
  const gap = (p: TripProfile) =>
    signal.start && p.range ? gapDays(p.range, signal.start, signal.end) : null; // null = can't tell
  const newTrip = (): TripChoice => ({
    newTitle: signal.suggestedTitle?.trim() || signal.country?.trim() || countryName(code) || L("Yeni gezi", "New trip"),
  });

  if (code || country) {
    const sameCountry = byRecency.filter(
      (p) => (code && p.countryCodes.has(code)) || (country && p.countryNames.has(country)),
    );
    // Same place and similar (or unknown) dates → same trip; the nearest dates win.
    const compatible = sameCountry.filter((p) => {
      const g = gap(p);
      return g === null || g <= SAME_TRIP_DAYS || signal.softDates;
    });
    if (compatible.length) {
      const dated = compatible.filter((p) => gap(p) !== null).sort((a, b) => gap(a)! - gap(b)!);
      return { tripId: (dated[0] ?? compatible.find((p) => p === suggested) ?? compatible[0]).trip.id };
    }
    // Different country whose dates touch an existing trip → one journey, but only a country near the trip's
    // own (Portugal → Spain). Bali never joins the Portugal trip because a page's date picker said 8 October.
    const journey = byRecency.find((p) => {
      const g = gap(p);
      const near = p.countryCodes.size === 0 || (code != null && [...p.countryCodes].some((c) => nearCountries(c, code)));
      return g !== null && g <= SAME_JOURNEY_DAYS && near;
    });
    return journey ? { tripId: journey.trip.id } : newTrip();
  }

  // No country (e.g. a regional eSIM or an unclear screenshot): trust the model, else the latest trip.
  if (suggested) return { tripId: suggested.trip.id };
  if (byRecency[0]) return { tripId: byRecency[0].trip.id };
  return newTrip();
}

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Portekiz" is taken by another trip → "Portekiz · Haziran 2027" (or a number when undated). */
export function uniqueTitle(title: string, start: string | null, trips: Trip[]): string {
  const taken = new Set(trips.map((t) => t.title.trim().toLowerCase()));
  if (!taken.has(title.toLowerCase())) return title;
  if (start) {
    const [y, m] = start.split("-").map(Number);
    const dated = `${title} · ${L(MONTHS_TR[m - 1], MONTHS_EN[m - 1])} ${y}`;
    if (!taken.has(dated.toLowerCase())) return dated;
  }
  for (let n = 2; ; n++) if (!taken.has(`${title} ${n}`.toLowerCase())) return `${title} ${n}`;
}
