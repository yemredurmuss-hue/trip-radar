// Hangi gezi (0.41.0, Emre: "ilk olarak bir kere hangi gezi diye sorar, sonraki seferlerde otomatik o gezinin destesine
// ekler"). The first thing saved from the toolbar (or the site, the right click) for a country asks which trip it is for;
// the answer is remembered as that country's trip, and what comes later for that country on that trip's days goes there
// without asking. A trip over, another country, or a day outside the trip's: asked again. Kept on this device only
// (chrome.storage.local); Settings forgets them. The matching is pure and tested.
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
