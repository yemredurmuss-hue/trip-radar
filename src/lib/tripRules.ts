// Hangi gezi (0.41.0, Emre: "ilk olarak bir kere hangi gezi diye sorar, sonraki seferlerde otomatik o gezinin destesine
// ekler"). The first thing saved from the toolbar (or the site, the right click) for a country asks which trip it is for;
// the answer is remembered as that country's trip, and what comes later for that country on that trip's days goes there
// without asking. A trip over, another country, or a day outside the trip's: asked again. Kept on this device only
// (chrome.storage.local); Settings forgets them. The matching is pure and tested.
import { titleCodes, tripPlaceCodes } from "./placeCheck";
import { gapDays, isDemoTrip, profileTrips } from "./trips";
import type { Item, Trip } from "./types";

export interface TripRule {
  /** The country (ISO code) the trip was picked for. */
  country: string;
  tripId: string;
  at: number;
}

export const RULES_KEY = "tripRules";
/** A day this many days off the trip's own still counts as the trip's (the flight the day before). */
export const RULE_SLACK_DAYS = 3;

/** The remembered trips; null where there is no extension storage (tests, a page that isn't ours): nothing is asked then. */
export async function loadRules(): Promise<TripRule[] | null> {
  try {
    if (!globalThis.chrome?.storage?.local) return null;
    const got = await chrome.storage.local.get(RULES_KEY);
    const list: unknown = got[RULES_KEY];
    return Array.isArray(list) ? list.filter((r): r is TripRule => typeof r?.country === "string" && typeof r?.tripId === "string") : [];
  } catch {
    return null;
  }
}

/** The country's trip from now on (one trip a country: the last answer wins). */
export async function rememberTrip(country: string | null | undefined, tripId: string): Promise<void> {
  if (!country) return;
  const rules = await loadRules();
  if (!rules) return;
  const next = [...rules.filter((r) => r.country !== country), { country, tripId, at: Date.now() }].slice(-40);
  await chrome.storage.local.set({ [RULES_KEY]: next }).catch(() => undefined);
}

/** Forgotten (Settings): the next save for that country asks again. */
export async function forgetRule(country: string): Promise<void> {
  const rules = await loadRules();
  if (!rules) return;
  await chrome.storage.local.set({ [RULES_KEY]: rules.filter((r) => r.country !== country) }).catch(() => undefined);
}

/**
 * The remembered trip for a record in these countries on these days: the trip still there, not a sample, not over, and
 * the record's day (when it has one) on the trip's days. Null: ask.
 */
export function ruleFor(rules: readonly TripRule[], codes: readonly string[], trips: Trip[], items: Item[], start: string | null, end: string | null, today: string): Trip | null {
  for (const rule of [...rules].reverse()) {
    if (!codes.includes(rule.country)) continue;
    const trip = trips.find((t) => t.id === rule.tripId);
    if (!trip || isDemoTrip(trip)) continue;
    const range = profileTrips([trip], items)[0]?.range ?? (trip.confirmedDates ? { start: trip.confirmedDates.start, end: trip.confirmedDates.end } : null);
    if (range && range.end < today) continue;
    if (start && range && gapDays(range, start, end) > RULE_SLACK_DAYS) continue;
    return trip;
  }
  return null;
}

/**
 * The answer kept as the country's trip only when it says something for sure: a page with its own day, or the only trip
 * of that country (two Portugal trips and an undated page: asked again next time, nothing written).
 */
export function worthRemembering(code: string | null, day: string | null, own: Trip[], items: Item[]): boolean {
  if (!code) return false;
  if (day) return true;
  return own.filter((t) => tripPlaceCodes(t.id, items).has(code) || titleCodes(t.title).has(code)).length <= 1;
}

/**
 * Şu anki gezi (0.43.0, Emre: "bir kere seçtikten sonra tekrar seyahati sormaması gerek"): the trip picked or saved into
 * last. What comes next goes there without asking, until a page of another country comes (then the country's own trip,
 * or the question). Kept a day; this device only.
 */
export interface CurrentTrip {
  tripId: string;
  /** The country it was picked for, when the page said one. */
  country: string | null;
  at: number;
}
export const CURRENT_KEY = "currentTrip";
export const CURRENT_MS = 24 * 3600_000;

export async function loadCurrent(): Promise<CurrentTrip | null> {
  try {
    if (!globalThis.chrome?.storage?.local) return null;
    const v = (await chrome.storage.local.get(CURRENT_KEY))[CURRENT_KEY] as CurrentTrip | undefined;
    return v && typeof v.tripId === "string" ? v : null;
  } catch {
    return null;
  }
}

export async function setCurrent(tripId: string, country: string | null): Promise<void> {
  try {
    if (!globalThis.chrome?.storage?.local) return;
    await chrome.storage.local.set({ [CURRENT_KEY]: { tripId, country, at: Date.now() } satisfies CurrentTrip });
  } catch {
    // (nothing kept: the next save asks)
  }
}

/**
 * The current trip for a page of this country, when it still holds: the trip there, not a sample, not over, kept within a
 * day, and the page of the same country (or of none it could tell, or a country that trip has).
 */
export function currentFor(cur: CurrentTrip | null, code: string | null, trips: Trip[], items: Item[], today: string, now = Date.now()): Trip | null {
  if (!cur || now - cur.at > CURRENT_MS) return null;
  const trip = trips.find((t) => t.id === cur.tripId);
  if (!trip || isDemoTrip(trip)) return null;
  const range = profileTrips([trip], items)[0]?.range ?? (trip.confirmedDates ? { start: trip.confirmedDates.start, end: trip.confirmedDates.end } : null);
  if (range && range.end < today) return null;
  if (!code || !cur.country || cur.country === code) return trip;
  return tripPlaceCodes(trip.id, items).has(code) || titleCodes(trip.title).has(code) ? trip : null;
}
