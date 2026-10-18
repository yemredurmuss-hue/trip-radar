// Where the trip stands in time (F2, D8; v83 "gezi sırasında"; D raporu K17, K18, İ10, H8): planning it, on it, or back
// from it, and what that changes. While it is on, a need left open whose day has gone by isn't a decision any more ("Kaçtı":
// not in "n karar", not in the hero's shares); once it is over, nothing is a decision (the plan is an archive). Before it,
// the last two weeks bring the documents forward (DOC_SOON_DAYS) and the last 48 hours make check-in a booked flight's main
// button. The clock is the destination's: what the plan says ("09:00") is always local. Pure.
import { citiesOfPlan } from "./categories";
import { DOC_SOON_DAYS, type IntentStatus, type IntentVM } from "./intents";
import { isoDate, nightsBetween } from "./items";
import { addDays, sameCity, type DateRange, type Plan } from "./plan";
import type { Item } from "./types";

/** Planning it (before the first day), on it (its days), back from it (after the last). */
export type TripMode = "plan" | "trip" | "archive";

export function tripModeOf(range: DateRange | null, today: string): TripMode {
  if (!range) return "plan";
  if (today < range.start) return "plan";
  return today > range.end ? "archive" : "trip";
}

/** F2: a booked flight's main button is check-in from this many hours before it leaves. */
export const CHECKIN_HOURS = 48;
export { DOC_SOON_DAYS };

/** Today and the time where the trip is ("2027-04-06", "12:40"): the device's own clock when the zone isn't known. */
export function localNow(at: Date, zone?: string | null): { day: string; time: string } {
  const parts = (timeZone?: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .reduce<Record<string, string>>((o, p) => ((o[p.type] = p.value), o), {});
  let p: Record<string, string>;
  try {
    p = parts(zone ?? undefined);
  } catch {
    // An unknown zone name: the device's clock rather than a guess.
    p = parts();
  }
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * Hours from `at` to a local time on the plan ("2027-04-16T11:00"). Local times are read as UTC, as flightData.ts does:
 * off by the time zone at most, which is enough for "within two days".
 */
export function hoursUntil(local: string | null | undefined, at: Date): number | null {
  if (!local || local.length < 16) return null;
  const t = Date.parse(`${local.slice(0, 16)}:00Z`);
  return Number.isFinite(t) ? (t - at.getTime()) / 36e5 : null;
}

/** F2: what a booked flight's box leads with: check-in in its last 48 hours (before it leaves), else the e-ticket. */
export function flightFocus(item: Pick<Item, "status" | "category" | "flight">, at: Date): "checkin" | "ticket" | null {
  if (item.category !== "flight" || item.status !== "booked") return null;
  const h = hoursUntil(item.flight?.departure, at);
  return h != null && h > 0 && h <= CHECKIN_HOURS ? "checkin" : "ticket";
}

/** F2: the booked flights whose check-in is the thing to do now (they leave within 48 hours), the soonest first. */
export function checkinFlights(items: readonly Item[], at: Date): Item[] {
  return items
    .filter((i) => flightFocus(i, at) === "checkin")
    .sort((a, b) => (a.flight?.departure ?? "").localeCompare(b.flight?.departure ?? ""));
}

/** F2: two weeks before the first day (and until it), the documents and Hazırlık come forward; "belge yok" shows. */
export function docsForward(range: DateRange | null, today: string): boolean {
  if (!range || today > range.start) return false;
  return nightsBetween(today, range.start) <= DOC_SOON_DAYS;
}

const OPEN: readonly IntentStatus[] = ["searching", "deciding", "suggested"];

/** A range's nights, one date each ("2027-04-01" for the night of the 1st). */
export const nightsOf = (r: DateRange): string[] => Array.from({ length: Math.max(0, nightsBetween(r.start, r.end)) }, (_, n) => addDays(r.start, n));

/**
 * D14: the nights a flight spends in the air (it leaves one day and lands the next), each with its flights: the need's
 * booked or chosen one alone; with none taken, every option of the need has to agree (they are all listed).
 */
export function nightsAboard(items: readonly Item[]): Map<string, Item[]> {
  const out = new Map<string, Item[]>();
  const byNeed = new Map<string, Item[]>();
  for (const i of items) if (i.category === "flight" && i.status !== "dismissed") byNeed.set(i.needKey, [...(byNeed.get(i.needKey) ?? []), i]);
  for (const list of byNeed.values()) {
    const settled = list.find((i) => i.status === "booked") ?? list.find((i) => i.status === "chosen") ?? null;
    const pool = settled ? [settled] : list;
    const nights = pool.map((i) => {
      const dep = isoDate(i.flight?.departure?.slice(0, 10));
      const arr = isoDate(i.flight?.arrival?.slice(0, 10));
      return new Set(dep && arr && dep < arr ? nightsOf({ start: dep, end: arr }) : []);
    });
    for (const night of nights[0] ?? []) if (nights.every((n) => n.has(night))) out.set(night, [...(out.get(night) ?? []), ...pool]);
  }
  return out;
}

/** D14: a bed still to find for nights the flight spends in the air (nightsAboard): no need at all, the "Uçakta" line. */
export function isAboardNight(intent: Pick<IntentVM, "section" | "status" | "head">, aboard: ReadonlyMap<string, unknown>): boolean {
  if (intent.section !== "stay" || intent.status !== "searching" || !intent.head.date) return false;
  return nightsOf({ start: intent.head.date, end: addDays(intent.head.date, Math.max(1, intent.head.nights)) }).every((d) => aboard.has(d));
}

/**
 * K17 / H8: a need still open whose day has gone by: a stay whose nights are over, a ticket whose day has passed, a city's
 * row of things to do and book when the city's days are behind and nothing of it was put on the plan. A whole-trip need
 * (an eSIM, insurance) and anything without a day never is.
 */
export function isMissed(intent: Pick<IntentVM, "status" | "frame" | "section" | "head">, today: string, plan?: Pick<Plan, "stayBlocks"> | null): boolean {
  if (!OPEN.includes(intent.status) && !(intent.frame === "collection" && intent.status === "deciding")) return false;
  const date = intent.head.date;
  if (!date) return false;
  if (intent.section === "stay") return addDays(date, Math.max(1, intent.head.nights)) <= today;
  if (intent.frame === "ticket") return date < today;
  if (intent.frame === "collection" && plan) {
    const city = intent.head.city;
    const ends = citiesOfPlan(plan).filter((c) => city && sameCity(c.city, city)).map((c) => c.end);
    return ends.length > 0 && ends.every((end) => end <= today);
  }
  return false;
}

/**
 * The intents the hero's shares and "n karar bekliyor" count (row 127): while planning, all of them; on the trip, all but
 * those left open whose day has gone by; afterwards only what was done (no decision is left after the trip). Never a
 * night spent on the plane (D14).
 */
export function countedIntents<T extends Pick<IntentVM, "status" | "frame" | "section" | "head">>(
  intents: readonly T[],
  opts: { today: string; mode: TripMode; plan?: Pick<Plan, "stayBlocks"> | null; /** With the records, a night on the plane is no need (D14). */ items?: readonly Item[] },
): T[] {
  const aboard = opts.items ? nightsAboard(opts.items) : new Map<string, Item[]>();
  const needs = intents.filter((i) => !isAboardNight(i, aboard));
  if (opts.mode === "plan") return needs;
  if (opts.mode === "archive") return needs.filter((i) => !OPEN.includes(i.status) && !(i.frame === "collection" && i.status === "deciding"));
  return needs.filter((i) => !isMissed(i, opts.today, opts.plan));
}

