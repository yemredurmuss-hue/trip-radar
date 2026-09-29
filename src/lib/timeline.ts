// The whole trip in the order it happens: getting there, each stretch of nights with the transfers
// between them, what's on each day, and getting home. Placement only, derived from the plan and its
// legs on every render; nothing here is stored. Whatever can't be placed on a day (another flight,
// an undated museum) is returned separately, so nothing saved goes missing from the board.
import { formatDateRange, isoDate, nightsBetween } from "./items";
import { isRental, travelsOf, type Leg, type Travel } from "./legs";
import { sameCity, type DateRange, type OptionGroup, type Plan, type StayBlock } from "./plan";
import type { Category, Item, LegMode } from "./types";

/** In, between cities, out; "other" is any other trip on its day (a day trip, a flight the plan can't pair). */
export type TravelRole = "arrival" | "move" | "departure" | "other";

export type TimelineEntry =
  | {
      kind: "travel";
      key: string;
      role: TravelRole;
      date: string;
      title: string;
      subtitle: string | null;
      /** What's saved for it; null when nothing is ("Henüz eklenmedi"). */
      travel: Travel | null;
      /** The move itself between two cities (its status and how the traveller will go). */
      leg: Leg | null;
      /** Where to look for one when nothing is saved. */
      searchUrl: string | null;
    }
  | { kind: "leg"; key: string; date: string; leg: Leg }
  | { kind: "stay"; key: string; date: string; block: StayBlock; title: string; subtitle: string }
  | { kind: "day"; key: string; date: string; category: Category; title: string; items: Item[] };

/**
 * The board's blocks: each city with everything in it (its transfers, nights, days, a rented car), and
 * the trips between them on the line.
 */
export type TimelineSection =
  | { kind: "travel"; key: string; entry: Extract<TimelineEntry, { kind: "travel" }> }
  | { kind: "city"; key: string; index: number; city: string | null; range: DateRange | null; nights: number; entries: TimelineEntry[] };

export interface Timeline {
  entries: TimelineEntry[];
  sections: TimelineSection[];
  /** Flights and transport not tied to a day of the plan (e.g. an extra flight); shown after the timeline. */
  unplaced: OptionGroup[];
  /** Places to visit, eat or do without a day in the trip. */
  undated: Item[];
}

const DAY_CATEGORIES: Category[] = ["activity", "food", "other"];
const DAY_LABELS: Partial<Record<Category, string>> = { activity: "Etkinlik", food: "Yeme-içme", other: "Plan", transport: "Araç kiralama" };
/** Things that belong to a day in a place: visits, meals, plans, and a car rented there. */
const onADay = (i: Item) => DAY_CATEGORIES.includes(i.category) || isRental(i);
const DAY_ORDER: Category[] = [...DAY_CATEGORIES, "transport"];
const MODE_WORDS: Partial<Record<LegMode, string>> = { flight: "Uçuş", train: "Tren", bus: "Otobüs", ferry: "Feribot", car: "Araba" };
const fmt = (date: string) => formatDateRange(date, null);

function route(travel: Travel | null): string | null {
  const f = (travel?.settled ?? travel?.items[0])?.flight;
  return f?.from && f.to ? `${f.from} → ${f.to}` : null;
}

/** Where the trip starts from, as the saved flights say: the way home's destination, or the way in's origin. */
function homeOf(inbound: Travel | null, outbound: Travel | null): string | null {
  const back = (outbound?.settled ?? outbound?.items[0])?.flight?.to;
  const out = (inbound?.settled ?? inbound?.items[0])?.flight?.from;
  return back ?? out ?? null;
}

/** A flight search for the day (Google Flights reads plain words; without a home it uses the traveller's location). */
export function flightSearchUrl(direction: "to" | "from", city: string | null, date: string, home: string | null): string | null {
  if (!city) return null;
  const q = direction === "to" ? `Flights to ${city}${home ? ` from ${home}` : ""} on ${date}` : `Flights from ${city}${home ? ` to ${home}` : ""} on ${date}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export function buildTimeline(plan: Plan, legs: Leg[], items: Item[]): Timeline {
  const blocks = plan.stayBlocks;
  const dayItems = items.filter((i) => onADay(i) && i.status !== "dismissed");
  if (!blocks.length || !plan.range) {
    return {
      entries: [],
      sections: [],
      unplaced: plan.groups.filter((g) => g.category === "flight" || g.category === "transport"),
      undated: dayItems.filter((i) => i.category !== "transport"),
    };
  }
  const start = plan.range.start;
  const end = plan.range.end;
  const entries: TimelineEntry[] = [];
  const first = legs.find((l) => l.slot === 0 && l.kind === "arrival") ?? null;
  const last = legs.find((l) => l.slot === blocks.length && l.kind === "departure") ?? null;
  const home = homeOf(first?.travel ?? null, last?.travel ?? null);

  // What's planned on each day of the trip, by category.
  const byDay = new Map<string, Map<Category, Item[]>>();
  const placedDays = new Set<string>();
  for (const i of dayItems) {
    const d = isoDate(i.dates.start);
    if (!d || d < start || d > end) continue;
    const day = byDay.get(d) ?? new Map<Category, Item[]>();
    day.set(i.category, [...(day.get(i.category) ?? []), i]);
    byDay.set(d, day);
    placedDays.add(i.id);
  }
  const daysIn = (from: string, to: string, inclusive: boolean) => {
    for (const d of [...byDay.keys()].sort()) {
      if (d < from || (inclusive ? d > to : d >= to)) continue;
      for (const category of DAY_ORDER) {
        const list = byDay.get(d)!.get(category);
        if (list) entries.push({ kind: "day", key: `day:${d}:${category}`, date: d, category, title: `${fmt(d)} · ${DAY_LABELS[category]}`, items: list });
      }
      byDay.delete(d);
    }
  };

  // Getting there.
  if (first) {
    const t = first.travel;
    const date = t?.day ?? first.date;
    if (t || !first.choice?.mode) {
      entries.push({
        kind: "travel",
        key: `travel:arrival:${date}`,
        role: "arrival",
        date,
        title: `${fmt(date)} · ${(t?.mode && MODE_WORDS[t.mode]) ?? "Varış"}`,
        subtitle: route(t) ?? (first.to.city ? `→ ${first.to.city}` : null),
        travel: t,
        leg: null,
        searchUrl: t ? null : flightSearchUrl("to", first.to.city, date, home),
      });
    }
    entries.push({ kind: "leg", key: `leg:${first.key}`, date: first.date, leg: first });
  }

  blocks.forEach((block, index) => {
    if (index > 0) {
      for (const leg of legs.filter((l) => l.slot === index)) {
        if (leg.kind === "move") {
          entries.push({
            kind: "travel",
            key: `travel:move:${leg.key}`,
            role: "move",
            date: leg.date,
            title: `${fmt(leg.date)} · Şehir değişimi`,
            subtitle: `${leg.from.city ?? leg.from.label} → ${leg.to.city ?? leg.to.label}`,
            travel: leg.travel,
            leg,
            searchUrl: null,
          });
        } else {
          entries.push({ kind: "leg", key: `leg:${leg.key}`, date: leg.date, leg });
        }
      }
    }
    const nights = nightsBetween(block.range.start, block.range.end);
    entries.push({
      kind: "stay",
      key: `stay:${block.range.start}`,
      date: block.range.start,
      block,
      title: `${formatDateRange(block.range.start, block.range.end)} · Konaklama`,
      subtitle: [block.city, `${nights} gece`].filter(Boolean).join(" · "),
    });
    const isLast = index === blocks.length - 1;
    daysIn(block.range.start, block.range.end, isLast);
  });

  // Getting home.
  if (last) {
    entries.push({ kind: "leg", key: `leg:${last.key}`, date: last.date, leg: last });
    const t = last.travel;
    const date = t?.day ?? last.date;
    if (t || !last.choice?.mode) {
      entries.push({
        kind: "travel",
        key: `travel:departure:${date}`,
        role: "departure",
        date,
        title: `${fmt(date)} · Dönüş`,
        subtitle: route(t) ?? (last.from.city ? `${last.from.city} →` : null),
        travel: t,
        leg: null,
        searchUrl: t ? null : flightSearchUrl("from", last.from.city, date, home),
      });
    }
  }

  // Any other trip with a day goes on that day: a flight the plan can't pair with a change of city
  // is still where it happens, never at the bottom.
  const used = new Set(legs.flatMap((l) => l.travel?.items ?? []).map((i) => i.id));
  for (const t of travelsOf(plan)) {
    if (t.items.some((i) => used.has(i.id)) || t.day < addDaysIso(start, -7) || t.day > addDaysIso(end, 7)) continue;
    t.items.forEach((i) => used.add(i.id));
    const entry: TimelineEntry = {
      kind: "travel",
      key: `travel:other:${t.group.key}:${t.day}`,
      role: "other",
      date: t.day,
      title: `${fmt(t.day)} · ${(t.mode && MODE_WORDS[t.mode]) ?? "Ulaşım"}`,
      subtitle: route(t),
      travel: t,
      leg: null,
      searchUrl: null,
    };
    const at = entries.findIndex((e) => e.date > t.day);
    entries.splice(at < 0 ? entries.length : at, 0, entry);
  }

  // Everything saved still shows somewhere: travel the plan didn't use, and places without a day.
  const placed = new Set([...legs.flatMap((l) => [...(l.travel?.items ?? []), ...l.options]).map((i) => i.id), ...used, ...placedDays]);
  const unplaced = plan.groups
    .filter((g) => g.category === "flight" || g.category === "transport")
    .map((g) => {
      const rest = g.items.filter((i) => !placed.has(i.id));
      return { ...g, items: rest, booked: rest.find((i) => i.status === "booked") ?? null };
    })
    .filter((g) => g.items.length > 0);
  return {
    entries,
    sections: sectionsOf(entries),
    unplaced,
    undated: dayItems.filter((i) => !placedDays.has(i.id) && i.category !== "transport"),
  };
}

const addDaysIso = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Blocks by city: the way in, between cities and home stay on the line; everything else (transfers,
 * nights, days, other trips) goes in the block of the city it happens in, a new block starting where
 * the stays move to another city.
 */
function sectionsOf(entries: TimelineEntry[]): TimelineSection[] {
  const sections: TimelineSection[] = [];
  let current: Extract<TimelineSection, { kind: "city" }> | null = null;
  let index = 0;
  const open = () => {
    current = { kind: "city", key: `city:${sections.length}`, index: ++index, city: null, range: null, nights: 0, entries: [] };
    sections.push(current);
    return current;
  };
  for (const e of entries) {
    if (e.kind === "travel" && e.role !== "other") {
      sections.push({ kind: "travel", key: e.key, entry: e });
      current = null;
      continue;
    }
    let block = current as Extract<TimelineSection, { kind: "city" }> | null;
    if (e.kind === "stay" && block?.city && e.block.city && !sameCity(block.city, e.block.city)) block = null;
    block ??= open();
    block.entries.push(e);
    if (e.kind === "stay") {
      block.city ??= e.block.city;
      block.nights += e.block.nights;
      block.range = block.range
        ? { start: block.range.start < e.block.range.start ? block.range.start : e.block.range.start, end: block.range.end > e.block.range.end ? block.range.end : e.block.range.end }
        : { ...e.block.range };
    }
  }
  return sections;
}
