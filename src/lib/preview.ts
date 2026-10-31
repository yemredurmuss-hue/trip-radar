// "Dur, şöyle olursa böyle olur" (omurga Tur 19, step 2): a change tried on a copy of the plan, never saved, and what it
// would do counted by the code, never guessed by the model: the nights each place gets, nights left with no bed, what is
// booked or chosen it moves or leaves outside the dates, the changes of city it makes or takes away (each a transfer to
// find), days it fills too full, flights left outside the dates, and the board's own warnings it brings. The chat tells it
// in its words and asks before doing it. Pure.
import { formatDateRange, isoDate } from "./items";
import { buildLegs } from "./legs";
import { addDays, buildPlan, cityKeyOf, stayRange, type Plan } from "./plan";
import { plannedItem, type PlannedInput } from "./planned";
import type { Item, Trip } from "./types";

export interface TriedChange {
  /** The trip's new dates (YYYY-MM-DD); null keeps them. */
  start?: string | null;
  end?: string | null;
  /** Records put on other days (a stay's nights, an activity's day). */
  moves?: { item_id: string; date: string | null; end_date: string | null }[];
  /** Records taken off the plan. */
  removes?: string[];
  /** New plans (a stop's nights, an activity on a day). */
  adds?: Pick<PlannedInput, "kind" | "title" | "city" | "date" | "end_date">[];
}

export interface Effects {
  dates: { before: string | null; after: string | null } | null;
  /** The nights each place gets, where they change. */
  nights: { place: string; before: number; after: number }[];
  /** Nights of the trip no stay holds after the change (and did before). */
  no_bed: string[];
  /** Booked or chosen records the change moves, takes off, or leaves outside the dates: never done without asking. */
  held: { name: string; status: string; what: string }[];
  /** Changes of city it adds (a transfer to find) or takes away. */
  moves_added: string[];
  moves_gone: string[];
  /** Days with three things or more to do after it. */
  full_days: string[];
  /** Flights outside the new dates. */
  flights_outside: string[];
  /** The board's warnings it brings (a stay outside the dates, two bookings on one night). */
  warnings: string[];
}

const LIVE = (i: Item) => i.status !== "dismissed";
const HELD = (i: Item) => i.status === "booked" || i.status === "chosen";
const rangeText = (r: { start: string; end: string } | null) => (r ? formatDateRange(r.start, r.end) : null);

/** The trip and its records with the change made, on copies. */
export function tried(trip: Trip, items: Item[], change: TriedChange, now = Date.now()): { trip: Trip; items: Item[] } {
  const start = isoDate(change.start ?? null) ?? trip.confirmedDates?.start ?? null;
  const end = isoDate(change.end ?? null) ?? trip.confirmedDates?.end ?? null;
  const next: Trip = { ...trip, confirmedDates: start && end && start < end ? { start, end } : trip.confirmedDates };
  const gone = new Set(change.removes ?? []);
  const moved = new Map((change.moves ?? []).map((m) => [m.item_id, m]));
  const kept = items
    .filter((i) => !gone.has(i.id))
    .map((i) => {
      const m = moved.get(i.id);
      return m ? { ...i, dates: { ...i.dates, start: isoDate(m.date) ?? i.dates.start, end: m.end_date === null ? null : (isoDate(m.end_date) ?? i.dates.end) } } : i;
    });
  const added = (change.adds ?? []).map((a, n) =>
    plannedItem({ kind: a.kind, title: a.title ?? null, city: a.city ?? null, date: a.date ?? null, end_date: a.end_date ?? null, time: null, from: null, to: null, booked: false, note: null }, trip.id, `tried-${n}`, now),
  );
  return { trip: next, items: [...kept, ...added] };
}

const nightsByPlace = (plan: Plan) => {
  const out = new Map<string, { place: string; n: number }>();
  for (const b of plan.stayBlocks) {
    const key = cityKeyOf(b.city) ?? "?";
    out.set(key, { place: b.city ?? "?", n: (out.get(key)?.n ?? 0) + b.nights });
  }
  return out;
};

/** The trip's nights no stay record holds (the board shows such nights inside the city's open stretch: still no bed). */
const bedless = (plan: Plan, items: Item[]): Set<string> => {
  const out = new Set<string>();
  if (!plan.range) return out;
  const stays = items.filter((i) => LIVE(i) && i.category === "stay").map(stayRange).filter((r): r is NonNullable<typeof r> => Boolean(r));
  for (let night = plan.range.start; night < plan.range.end; night = addDays(night, 1)) {
    if (!stays.some((r) => r.start <= night && night < r.end)) out.add(night);
  }
  return out;
};

const moveKeys = (trip: Trip, plan: Plan) =>
  new Map(buildLegs(plan, trip).filter((l) => l.kind === "move").map((l) => [`${l.date}:${cityKeyOf(l.from.city)}>${cityKeyOf(l.to.city)}`, `${l.from.city ?? l.from.label} → ${l.to.city ?? l.to.label} (${formatDateRange(l.date, null)})`]));

const fullDays = (items: Item[]) => {
  const by = new Map<string, number>();
  for (const i of items) {
    const day = isoDate(i.dates.start);
    if (LIVE(i) && day && (i.category === "activity" || i.category === "food")) by.set(day, (by.get(day) ?? 0) + 1);
  }
  return new Set([...by].filter(([, n]) => n >= 3).map(([d]) => d));
};

/** What the change would do, counted on the plan before and after it. */
export function effectsOf(trip: Trip, items: Item[], change: TriedChange, now = Date.now()): Effects {
  const after = tried(trip, items, change, now);
  const [p0, p1] = [buildPlan(trip, items), buildPlan(after.trip, after.items)];
  const before = rangeText(p0.range);
  const later = rangeText(p1.range);
  const [n0, n1] = [nightsByPlace(p0), nightsByPlace(p1)];
  const nights = [...new Set([...n0.keys(), ...n1.keys()])]
    .map((k) => ({ place: n1.get(k)?.place ?? n0.get(k)?.place ?? k, before: n0.get(k)?.n ?? 0, after: n1.get(k)?.n ?? 0 }))
    .filter((x) => x.before !== x.after);
  const [b0, b1] = [bedless(p0, items), bedless(p1, after.items)];
  const range = p1.range;
  const outside = (i: Item) => {
    const s = isoDate(i.dates.start);
    return Boolean(range && s && (s < range.start || s > range.end));
  };
  const byId = new Map(after.items.map((i) => [i.id, i]));
  const held = items.filter((i) => LIVE(i) && HELD(i)).flatMap((i) => {
    const now1 = byId.get(i.id);
    if (!now1) return [{ name: i.name, status: i.status, what: "removed" }];
    if (now1.dates.start !== i.dates.start || now1.dates.end !== i.dates.end) return [{ name: i.name, status: i.status, what: `moved to ${rangeText(isoDate(now1.dates.start) && isoDate(now1.dates.end) ? { start: isoDate(now1.dates.start)!, end: isoDate(now1.dates.end)! } : null) ?? now1.dates.start}` }];
    return outside(now1) ? [{ name: i.name, status: i.status, what: "outside the new dates" }] : [];
  });
  const [m0, m1] = [moveKeys(trip, p0), moveKeys(after.trip, p1)];
  const [f0, f1] = [fullDays(items), fullDays(after.items)];
  const w0 = new Set(p0.notices.map((x) => x.text));
  return {
    dates: before !== later ? { before, after: later } : null,
    nights,
    no_bed: [...b1].filter((d) => !b0.has(d)).map((d) => formatDateRange(d, null)),
    held,
    moves_added: [...m1].filter(([k]) => !m0.has(k)).map(([, v]) => v),
    moves_gone: [...m0].filter(([k]) => !m1.has(k)).map(([, v]) => v),
    full_days: [...f1].filter((d) => !f0.has(d)).map((d) => formatDateRange(d, null)),
    flights_outside: after.items.filter((i) => LIVE(i) && i.category === "flight" && outside(i)).map((i) => i.name),
    warnings: p1.notices.map((x) => x.text).filter((t) => !w0.has(t)),
  };
}

/** Nothing to say: the change moves nothing that matters. */
export const quiet = (e: Effects): boolean =>
  !e.dates && !e.nights.length && !e.no_bed.length && !e.held.length && !e.moves_added.length && !e.moves_gone.length && !e.full_days.length && !e.flights_outside.length && !e.warnings.length;

