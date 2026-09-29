// The whole trip in the order it happens: getting there, each stretch of nights with the transfers
// between them, what's on each day, and getting home. Placement only, derived from the plan and its
// legs on every render; nothing here is stored. Whatever can't be placed on a day (another flight,
// an undated museum) is returned separately, so nothing saved goes missing from the board.
import { formatDateRange, isoDate, nightsBetween } from "./items";
import type { Leg, Travel } from "./legs";
import type { OptionGroup, Plan, StayBlock } from "./plan";
import type { Category, Item, LegMode } from "./types";

export type TravelRole = "arrival" | "move" | "departure";

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

export interface Timeline {
  entries: TimelineEntry[];
  /** Flights and transport not tied to a day of the plan (e.g. an extra flight); shown after the timeline. */
  unplaced: OptionGroup[];
  /** Places to visit, eat or do without a day in the trip. */
  undated: Item[];
}

const DAY_CATEGORIES: Category[] = ["activity", "food", "other"];
const DAY_LABELS: Partial<Record<Category, string>> = { activity: "Etkinlik", food: "Yeme-içme", other: "Plan" };
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
  const dayItems = items.filter((i) => DAY_CATEGORIES.includes(i.category) && i.status !== "dismissed");
  if (!blocks.length || !plan.range) {
    return { entries: [], unplaced: plan.groups.filter((g) => g.category === "flight" || g.category === "transport"), undated: dayItems };
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
      for (const category of DAY_CATEGORIES) {
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

  // Everything saved still shows somewhere: travel the plan didn't use, and places without a day.
  const placed = new Set(legs.flatMap((l) => [...(l.travel?.items ?? []), ...l.options]).map((i) => i.id));
  const unplaced = plan.groups
    .filter((g) => g.category === "flight" || g.category === "transport")
    .map((g) => {
      const rest = g.items.filter((i) => !placed.has(i.id));
      return { ...g, items: rest, booked: rest.find((i) => i.status === "booked") ?? null };
    })
    .filter((g) => g.items.length > 0);
  return { entries, unplaced, undated: dayItems.filter((i) => !placedDays.has(i.id)) };
}
