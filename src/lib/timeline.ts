// The whole trip in the order it happens: getting there, each stretch of nights with the transfers
// between them, what's on each day, and getting home. Placement only, derived from the plan and its
// legs on every render; nothing here is stored. Whatever can't be placed on a day (another flight,
// an undated museum) is returned separately, so nothing saved goes missing from the board.
import { formatDateRange, isoDate, nightsBetween } from "./items";
import { endsOf, isRental, travelsOf, type Leg, type Travel } from "./legs";
import { cityKeyOf, sameCity, type DateRange, type OptionGroup, type Plan, type StayBlock } from "./plan";
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
  /** A transfer on a day that has no card of its own (landing the night before, leaving for the station). */
  | { kind: "leg"; key: string; date: string; leg: Leg }
  | { kind: "stay"; key: string; date: string; block: StayBlock; title: string; subtitle: string; skipped?: boolean }
  /** One day of the trip in its city: its transfers and what's planned, empty until something is. */
  | { kind: "day"; key: string; date: string; dayNo: number; title: string; items: Item[]; legs: Leg[] }
  /** Plans for a city without a day yet ("Madeira'da araba kiralarız"): in its block until the day is known. */
  | { kind: "plan"; key: string; date: string; city: string | null; items: Item[] };

export type StayEntry = Extract<TimelineEntry, { kind: "stay" }>;

/**
 * The board's blocks: each city with its stays (in date order) and its days, and the trips between
 * them on the line.
 */
export type TimelineSection =
  | { kind: "travel"; key: string; entry: Extract<TimelineEntry, { kind: "travel" }> }
  | {
      kind: "city";
      key: string;
      index: number;
      city: string | null;
      range: DateRange | null;
      nights: number;
      stays: StayEntry[];
      /** Its days, and any transfer or trip on a day without a card, in order. */
      entries: TimelineEntry[];
    };

export interface Timeline {
  entries: TimelineEntry[];
  sections: TimelineSection[];
  /** Flights and transport not tied to a day of the plan (e.g. an extra flight); shown after the timeline. */
  unplaced: OptionGroup[];
  /** Places to visit, eat or do without a day in the trip. */
  undated: Item[];
}

const DAY_CATEGORIES: Category[] = ["activity", "food", "other"];
/** Things that belong to a day in a place: visits, meals, plans, and a car rented there. */
const onADay = (i: Item) => DAY_CATEGORIES.includes(i.category) || isRental(i);
const DAY_ORDER: Category[] = ["transport", ...DAY_CATEGORIES];
const MODE_WORDS: Partial<Record<LegMode, string>> = { flight: "Uçuş", train: "Tren", bus: "Otobüs", ferry: "Feribot", car: "Araba" };
const fmt = (date: string) => formatDateRange(date, null);

function route(travel: Travel | null): string | null {
  const f = (travel?.settled ?? travel?.items[0])?.flight;
  return f?.from && f.to ? `${f.from} → ${f.to}` : null;
}

/** When a trip leaves ("2026-10-07T09:40"), for ordering trips on the same day. */
const leaves = (t: Travel) => (t.settled ?? t.items[0])?.flight?.departure ?? t.day;

/** Where the trip starts from, as the saved flights say: the way home's destination, or the first flight's origin. */
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

/** The key under which a stretch of nights is hidden ("no place needed"). */
export const nightsKey = (range: DateRange) => `nights:${range.start}_${range.end}`;

export function buildTimeline(plan: Plan, allLegs: Leg[], items: Item[], hidden: Set<string> = new Set()): Timeline {
  // A transfer the traveller said isn't needed stays out (a change of city never does: it's the way on).
  const legs = allLegs.filter((l) => l.kind === "move" || !hidden.has(`leg:${l.key}`));
  const blocks = plan.stayBlocks;
  // A rental set aside by the plan (another booked, or a page chosen instead of the one said in the chat) isn't on its day.
  const closed = new Set(plan.closed.map((c) => c.item.id));
  const dayItems = items.filter((i) => onADay(i) && i.status !== "dismissed" && !closed.has(i.id));
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
  // The flights in and out stay on the line even when their transfer is hidden.
  const first = allLegs.find((l) => l.slot === 0 && l.kind === "arrival") ?? null;
  const last = allLegs.find((l) => l.slot === blocks.length && l.kind === "departure") ?? null;
  const shown = (l: Leg) => legs.includes(l);

  // Trips the transfers didn't take: connections on the way in or home go with them on the line
  // (Istanbul → Copenhagen before Copenhagen → Porto); the rest go on their day.
  const used = new Set(allLegs.flatMap((l) => l.travel?.items ?? []).map((i) => i.id));
  const others = travelsOf(plan).filter((t) => !t.items.some((i) => used.has(i.id)) && t.day >= addDaysIso(start, -7) && t.day <= addDaysIso(end, 7));
  others.forEach((t) => t.items.forEach((i) => used.add(i.id)));
  const [firstCity, lastCity] = [cityKeyOf(blocks[0].city), cityKeyOf(blocks.at(-1)!.city)];
  const inbound = first?.travel ?? null;
  const outbound = last?.travel ?? null;
  const connectsIn = (t: Travel) => {
    const ends = endsOf(t);
    if (inbound) {
      const chain = Boolean(ends.to && ends.to === endsOf(inbound).from);
      return t.day <= inbound.day && t.day >= addDaysIso(inbound.day, -2) && (chain || leaves(t) < leaves(inbound));
    }
    return t.day <= start && t.day >= addDaysIso(start, -2) && !(ends.from && ends.from === firstCity);
  };
  const connectsOut = (t: Travel) => {
    const ends = endsOf(t);
    if (outbound) {
      const chain = Boolean(ends.from && ends.from === endsOf(outbound).to);
      return t.day >= outbound.day && t.day <= addDaysIso(outbound.day, 2) && (chain || leaves(t) > leaves(outbound));
    }
    return t.day >= end && t.day <= addDaysIso(end, 2) && !(ends.to && ends.to === lastCity);
  };
  const before = others.filter(connectsIn).sort((a, b) => leaves(a).localeCompare(leaves(b)));
  const after = others.filter((t) => !before.includes(t) && connectsOut(t)).sort((a, b) => leaves(a).localeCompare(leaves(b)));
  const rest = others.filter((t) => !before.includes(t) && !after.includes(t));
  const home = homeOf(before[0] ?? inbound, after.at(-1) ?? outbound);
  const tripEntry = (t: Travel): TimelineEntry => ({
    kind: "travel",
    key: `travel:other:${t.group.key}:${t.day}`,
    role: "other",
    date: t.day,
    title: `${fmt(t.day)} · ${(t.mode && MODE_WORDS[t.mode]) ?? "Ulaşım"}`,
    subtitle: route(t),
    travel: t,
    leg: null,
    searchUrl: null,
  });

  // What's planned on each day of the trip. Days after the flight home aren't on this trip's line: they
  // stay in the list below, with their date.
  const lastDay = last && last.travel && last.date < end ? last.date : end;
  const byDay = new Map<string, Item[]>();
  for (const i of dayItems) {
    const d = isoDate(i.dates.start);
    if (!d || d < start || d > lastDay) continue;
    byDay.set(d, [...(byDay.get(d) ?? []), i]);
  }
  const at = (i: Item) => i.flight?.departure?.slice(11, 16) ?? "99";
  for (const list of byDay.values()) list.sort((a, b) => DAY_ORDER.indexOf(a.category) - DAY_ORDER.indexOf(b.category) || at(a).localeCompare(at(b)));

  // Every day of every stay gets a card (the last city's also the day home), empty until something's planned.
  const dayCards = blocks.map((block, index) => {
    const days: Extract<TimelineEntry, { kind: "day" }>[] = [];
    const isLast = index === blocks.length - 1;
    for (let d = block.range.start; isLast ? d <= lastDay : d < block.range.end; d = addDaysIso(d, 1)) {
      const dayNo = nightsBetween(start, d) + 1;
      days.push({ kind: "day", key: `day:${d}`, date: d, dayNo, title: `${dayNo}. gün`, items: byDay.get(d) ?? [], legs: [] });
    }
    return days;
  });
  const placedDays = new Set(dayCards.flat().flatMap((d) => d.items.map((i) => i.id)));
  // What's planned in a city without a day (a car to rent there, a tour they chose) goes in that city's
  // block; places only saved as ideas stay in the lists below.
  const cityPlans = blocks.map(() => [] as Item[]);
  for (const i of dayItems) {
    if (placedDays.has(i.id) || !i.city || isoDate(i.dates.start) || (i.status === "saved" && !isRental(i))) continue;
    const index = blocks.findIndex((b) => sameCity(b.city, i.city));
    if (index < 0) continue;
    cityPlans[index].push(i);
    placedDays.add(i.id);
  }
  /** A transfer goes in its day's card in its city; without one it has its own row. */
  const into = (leg: Leg, index: number) => {
    const day = dayCards[index]?.find((d) => d.date === leg.date);
    if (day) day.legs.push(leg);
    return Boolean(day);
  };
  const legRow = (leg: Leg): TimelineEntry => ({ kind: "leg", key: `leg:${leg.key}`, date: leg.date, leg });

  // Getting there.
  entries.push(...before.map(tripEntry));
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
    if (shown(first) && !into(first, 0)) entries.push(legRow(first));
  }

  blocks.forEach((block, index) => {
    if (index > 0) {
      const slot = legs.filter((l) => l.slot === index);
      for (const leg of slot) {
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
        } else if (!into(leg, leg.kind === "departure" ? index - 1 : index)) {
          entries.push(legRow(leg));
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
      ...(block.kind === "open" && !block.groups.length && hidden.has(nightsKey(block.range)) ? { skipped: true } : {}),
    });
    if (cityPlans[index].length) {
      entries.push({ kind: "plan", key: `plan:${block.range.start}`, date: block.range.start, city: block.city, items: cityPlans[index] });
    }
    entries.push(...dayCards[index]);
  });

  // Getting home.
  if (last) {
    if (shown(last) && !into(last, blocks.length - 1)) entries.push(legRow(last));
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
  entries.push(...after.map(tripEntry));

  // Any other trip with a day goes on that day (after its card): a flight the plan can't pair with a
  // change of city is still where it happens, never at the bottom.
  for (const t of rest) {
    const index = entries.findIndex((e) => e.date > t.day);
    entries.splice(index < 0 ? entries.length : index, 0, tripEntry(t));
  }

  // Everything saved still shows somewhere: travel the plan didn't use, and places without a day.
  const placed = new Set([...allLegs.flatMap((l) => [...(l.travel?.items ?? []), ...l.options]).map((i) => i.id), ...used, ...placedDays]);
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
    current = { kind: "city", key: "", index: ++index, city: null, range: null, nights: 0, stays: [], entries: [] };
    sections.push(current);
    return current;
  };
  for (const e of entries) {
    // Arriving, moving on and leaving sit on the rail between the places; so does any other trip
    // that isn't during a stay (one during a stay, like a day trip, stays in that place).
    if (e.kind === "travel" && (e.role !== "other" || !current)) {
      sections.push({ kind: "travel", key: e.key, entry: e });
      current = null;
      continue;
    }
    let block = current as Extract<TimelineSection, { kind: "city" }> | null;
    // Stays somewhere else (or somewhere not known yet) start their own block.
    if (e.kind === "stay" && block?.city && !(e.block.city && sameCity(block.city, e.block.city))) block = null;
    block ??= open();
    if (e.kind === "stay") {
      block.stays.push(e);
      block.city ??= e.block.city;
      block.nights += e.block.nights;
      block.range = block.range
        ? { start: block.range.start < e.block.range.start ? block.range.start : e.block.range.start, end: block.range.end > e.block.range.end ? block.range.end : e.block.range.end }
        : { ...e.block.range };
    } else {
      block.entries.push(e);
    }
  }
  // Keys follow what a block holds, not its position, so a block added earlier doesn't remount the rest.
  const used = new Set<string>();
  for (const section of sections) {
    if (section.kind !== "city") continue;
    let key = `city:${section.range?.start ?? section.entries[0]?.key ?? section.index}`;
    while (used.has(key)) key += "+";
    used.add(key);
    section.key = key;
  }
  return sections;
}
