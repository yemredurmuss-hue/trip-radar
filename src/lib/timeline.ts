// The whole trip in the order it happens: getting there, each stretch of nights with the transfers
// between them, what's on each day, and getting home. Placement only, derived from the plan and its
// legs on every render; nothing here is stored. Whatever can't be placed on a day (another flight,
// an undated museum) is returned separately, so nothing saved goes missing from the board.
import { L } from "./i18n";
import { liveLabels, nNights } from "./i18nText";
import { formatDateRange, isoDate, nightsBetween } from "./items";
import { endsOf, isHiddenLeg, isRental, travelsOf, type Leg, type Travel } from "./legs";
import { cityKeyOf, sameCity, type DateRange, type OptionGroup, type Plan, type StayBlock } from "./plan";
import { isIdea, needsBooking } from "./booking";
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
      /** Nothing saved: the trip's city at this end (arrival: the first, departure: the last), for its empty card. */
      city?: string | null;
    }
  /** A transfer on a day that has no card of its own (landing the night before, leaving for the station). */
  | { kind: "leg"; key: string; date: string; leg: Leg }
  | {
      kind: "stay";
      key: string;
      date: string;
      block: StayBlock;
      title: string;
      subtitle: string;
      /** Its days of the trip, check-out day included ("1–5. gün"). */
      days?: string;
      skipped?: boolean;
    }
  /** Something decided for a day (a tour, a table): its own block on the plan's front. */
  | { kind: "event"; key: string; date: string; dayNo: number | null; item: Item }
  /** One day of the trip in its city: its transfers and what's planned, empty until something is. */
  | { kind: "day"; key: string; date: string; dayNo: number; title: string; items: Item[]; legs: Leg[] }
  /** Plans for a city without a day yet ("Madeira'da araba kiralarız"): in its block until the day is known. */
  | { kind: "plan"; key: string; date: string; city: string | null; items: Item[] }
  /**
   * A car rented for some days: one booking above the day it starts (like the hotel, it spans days);
   * picking it up and bringing it back are lines on those days.
   */
  | { kind: "rental"; key: string; date: string; end: string | null; group: OptionGroup };

export type RentalEntry = Extract<TimelineEntry, { kind: "rental" }>;

export type StayEntry = Extract<TimelineEntry, { kind: "stay" }>;

export type JourneyRole = "arrival" | "move" | "departure";

/**
 * A day on the move (the way in, a change of city, the way home): one card on the line between the
 * cities with the day's steps in order — check-out, the transfer, the flight, the transfer, check-in.
 */
export interface Journey {
  key: string;
  role: JourneyRole;
  date: string;
  /** Its day of the trip ("4. gün"); null when it falls outside the trip's days (landing the day before). */
  dayNo: number | null;
  from: string | null;
  to: string | null;
  /** The stay left that day (check-out) and the one reached (check-in); null for none or nights said not needed. */
  out: StayBlock | null;
  in: StayBlock | null;
}

/**
 * The board's blocks: each city with its stays (in date order) and its days, the trips between
 * them on the line, and a day on the move as one card there.
 */
export type TimelineSection =
  | { kind: "travel"; key: string; entry: Extract<TimelineEntry, { kind: "travel" }> }
  /** Its travel and transfer entries in order, and that day's card (what else is planned on it). */
  | { kind: "journey"; key: string; journey: Journey; entries: TimelineEntry[] }
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
  /** Day by day, a day on the move as one: the itinerary. */
  sections: TimelineSection[];
  /**
   * The plan's front: a block for each thing booked or to decide (flights, transfers with a plan,
   * stays, what's chosen for a day, a rented car), no days or check-in lines.
   */
  board: TimelineSection[];
  /** Flights and transport not tied to a day of the plan (e.g. an extra flight); shown after the timeline. */
  unplaced: OptionGroup[];
  /** Places to visit, eat or do without a day in the trip. */
  undated: Item[];
}

const DAY_CATEGORIES: Category[] = ["activity", "food", "other"];
/** Things that belong to a day in a place: visits, meals, plans, and a car rented there. */
const onADay = (i: Item) => DAY_CATEGORIES.includes(i.category) || isRental(i);
const DAY_ORDER: Category[] = ["transport", ...DAY_CATEGORIES];
const MODE_WORDS: Readonly<Partial<Record<LegMode, string>>> = liveLabels({
  flight: ["Uçuş", "Flight"],
  train: ["Tren", "Train"],
  bus: ["Otobüs", "Bus"],
  ferry: ["Feribot", "Ferry"],
  car: ["Araba", "Car"],
});
/** "4. gün" / "Day 4". */
const dayTitle = (n: number) => L(`${n}. gün`, `Day ${n}`);
/** "1–5. gün" / "Days 1–5". */
const daysText = (from: number, to: number) => L(`${from}–${to}. gün`, `Days ${from}–${to}`);
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

/** Nights marked "Gerek yok" that the plan still has: listed under Gizlenenler with "Geri getir". */
export function hiddenNights(timeline: Timeline): { range: DateRange; city: string | null }[] {
  return timeline.entries.filter((e): e is StayEntry => e.kind === "stay" && Boolean(e.skipped)).map((e) => ({ range: e.block.range, city: e.block.city }));
}

export function buildTimeline(plan: Plan, allLegs: Leg[], items: Item[], hidden: Set<string> = new Set()): Timeline {
  // A transfer the traveller said isn't needed stays out (a change of city only while nothing is saved or said
  // for it: one with a flight is the way on, see canHideLeg).
  const legs = allLegs.filter((l) => !isHiddenLeg(l, hidden));
  const blocks = plan.stayBlocks;
  // A rental set aside by the plan (another booked, or a page chosen instead of the one said in the chat) isn't on its day.
  const closed = new Set(plan.closed.map((c) => c.item.id));
  const dayItems = items.filter((i) => onADay(i) && i.status !== "dismissed" && !closed.has(i.id));
  if (!blocks.length || !plan.range) {
    return {
      entries: [],
      sections: [],
      board: [],
      unplaced: plan.groups.filter((g) => g.category === "flight" || g.category === "transport"),
      undated: dayItems.filter((i) => i.category !== "transport" && !isIdea(i)),
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
    title: `${fmt(t.day)} · ${(t.mode && MODE_WORDS[t.mode]) ?? L("Ulaşım", "Transport")}`,
    subtitle: route(t),
    travel: t,
    leg: null,
    searchUrl: null,
  });

  // What's planned on each day of the trip. Days after the flight home aren't on this trip's line: they
  // stay in the list below, with their date.
  const lastDay = last && last.travel && last.date < end ? last.date : end;
  // Rentals during the trip: one entry per need (its options together), from the chosen one's day.
  const rentalLists = new Map<string, { group: OptionGroup | null; items: Item[] }>();
  for (const i of dayItems) {
    const d = isoDate(i.dates.start);
    if (!isRental(i) || !d || d < start || d > lastDay) continue;
    const group = plan.groups.find((g) => g.items.some((x) => x.id === i.id)) ?? null;
    const key = group?.key ?? `rental:${i.id}`;
    const list = rentalLists.get(key) ?? { group, items: [] };
    list.items.push(i);
    rentalLists.set(key, list);
  }
  const rentals: RentalEntry[] = [...rentalLists].map(([key, { group, items: list }]) => {
    const settled = list.find((i) => i.status === "booked") ?? list.find((i) => i.status === "chosen") ?? null;
    const starts = list.map((i) => isoDate(i.dates.start)!).sort();
    const ends = list.map((i) => isoDate(i.dates.end)).filter((d): d is string => Boolean(d)).sort();
    return {
      kind: "rental",
      key: `rental:${key}`,
      date: settled ? isoDate(settled.dates.start)! : starts[0],
      end: settled ? isoDate(settled.dates.end) : (ends.at(-1) ?? null),
      group: { key, category: "transport", title: null, range: null, booked: null, ...group, items: list },
    };
  });
  const inRental = new Set(rentals.flatMap((r) => r.group.items.map((i) => i.id)));

  const byDay = new Map<string, Item[]>();
  for (const i of dayItems) {
    const d = isoDate(i.dates.start);
    if (!d || d < start || d > lastDay || inRental.has(i.id)) continue;
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
      days.push({ kind: "day", key: `day:${d}`, date: d, dayNo, title: dayTitle(dayNo), items: byDay.get(d) ?? [], legs: [] });
    }
    return days;
  });
  const placedDays = new Set([...dayCards.flat().flatMap((d) => d.items.map((i) => i.id)), ...inRental]);
  // What's planned in a city without a day (a car to rent there, a tour they chose) goes in that city's
  // block; places only saved as ideas stay in the lists below.
  const cityPlans = blocks.map(() => [] as Item[]);
  for (const i of dayItems) {
    // An idea (no booking needed) is a row of Yapılacak şeyler or Restoranlar, never a block of the front.
    if (placedDays.has(i.id) || !i.city || isoDate(i.dates.start) || isIdea(i) || (i.status === "saved" && !isRental(i))) continue;
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

  // Days on the move: their trips, transfers and that day's card go in one card on the line.
  const journeyOf = new Map<string, Journey>();
  const claimed = new Set<string>();
  const needed = (b: StayBlock | undefined) => (!b || (b.kind === "open" && !b.groups.length && hidden.has(nightsKey(b.range))) ? null : b);
  const journey = (role: JourneyRole, date: string, from: string | null, to: string | null, out: StayBlock | null, reached: StayBlock | null): Journey => ({
    key: `journey:${role}:${date}`, role, date, dayNo: null, from, to, out: needed(out ?? undefined), in: needed(reached ?? undefined),
  });
  const join = (j: Journey | null, e: TimelineEntry): TimelineEntry => {
    if (j) journeyOf.set(e.key, j);
    return e;
  };
  /** That day's card goes in the journey (once), and gives it its number. */
  const claimDay = (j: Journey, index: number, date: string) => {
    const day = dayCards[index]?.find((d) => d.date === date);
    if (!day || claimed.has(day.key)) return;
    claimed.add(day.key);
    journeyOf.set(day.key, j);
    j.dayNo = day.dayNo;
  };
  const end_ = (t: Travel | null | undefined, which: "from" | "to") => (t ? ((t.settled ?? t.items[0])?.flight?.[which] ?? null) : null);

  // Getting there.
  const inJ = first ? journey("arrival", first.date, end_(before[0] ?? inbound, "from"), blocks[0].city, null, blocks[0]) : null;
  entries.push(...before.map((t) => join(inJ, tripEntry(t))));
  if (first) {
    const t = first.travel;
    const date = t?.day ?? first.date;
    if (t || !first.choice?.mode) {
      entries.push(join(inJ, {
        kind: "travel",
        key: `travel:arrival:${date}`,
        role: "arrival",
        date,
        title: `${fmt(date)} · ${(t?.mode && MODE_WORDS[t.mode]) ?? L("Varış", "Arrival")}`,
        subtitle: route(t) ?? (first.to.city ? `→ ${first.to.city}` : null),
        travel: t,
        leg: null,
        searchUrl: t ? null : flightSearchUrl("to", first.to.city, date, home),
        city: first.to.city,
      }));
    }
    if (shown(first)) entries.push(join(inJ, legRow(first)));
    claimDay(inJ!, 0, first.date);
  }

  blocks.forEach((block, index) => {
    if (index > 0) {
      const slot = legs.filter((l) => l.slot === index);
      const move = slot.find((l) => l.kind === "move");
      const j = move ? journey("move", move.date, move.from.city ?? move.from.label, move.to.city ?? move.to.label, blocks[index - 1], block) : null;
      for (const leg of slot) {
        if (leg.kind === "move") {
          entries.push(join(j, {
            kind: "travel",
            key: `travel:move:${leg.key}`,
            role: "move",
            date: leg.date,
            title: `${fmt(leg.date)} · ${L("Şehir değişimi", "Change of city")}`,
            subtitle: `${leg.from.city ?? leg.from.label} → ${leg.to.city ?? leg.to.label}`,
            travel: leg.travel,
            leg,
            searchUrl: null,
          }));
        } else if (j) {
          // The station transfers of a change of city are steps of that day's journey.
          entries.push(join(j, legRow(leg)));
        } else if (!into(leg, leg.kind === "departure" ? index - 1 : index)) {
          entries.push(legRow(leg));
        }
      }
      if (j && move) claimDay(j, index, move.date);
    }
    const nights = nightsBetween(block.range.start, block.range.end);
    entries.push({
      kind: "stay",
      key: `stay:${block.range.start}`,
      date: block.range.start,
      block,
      title: `${formatDateRange(block.range.start, block.range.end)} · ${L("Konaklama", "Stay")}`,
      subtitle: [block.city, nNights(nights)].filter(Boolean).join(" · "),
      days: daysText(nightsBetween(start, block.range.start) + 1, nightsBetween(start, block.range.end) + 1),
      ...(block.kind === "open" && !block.groups.length && hidden.has(nightsKey(block.range)) ? { skipped: true } : {}),
    });
    if (cityPlans[index].length) {
      entries.push({ kind: "plan", key: `plan:${block.range.start}`, date: block.range.start, city: block.city, items: cityPlans[index] });
    }
    for (const day of dayCards[index]) {
      entries.push(...rentals.filter((r) => r.date === day.date));
      entries.push(day);
    }
  });

  // Getting home.
  const outJ = last ? journey("departure", last.date, blocks.at(-1)!.city, end_(after.at(-1) ?? outbound, "to"), blocks.at(-1)!, null) : null;
  if (last) {
    claimDay(outJ!, blocks.length - 1, last.date);
    if (shown(last)) entries.push(join(outJ, legRow(last)));
    const t = last.travel;
    const date = t?.day ?? last.date;
    if (t || !last.choice?.mode) {
      entries.push(join(outJ, {
        kind: "travel",
        key: `travel:departure:${date}`,
        role: "departure",
        date,
        title: `${fmt(date)} · ${L("Dönüş", "Return")}`,
        subtitle: route(t) ?? (last.from.city ? `${last.from.city} →` : null),
        travel: t,
        leg: null,
        searchUrl: t ? null : flightSearchUrl("from", last.from.city, date, home),
        city: last.from.city,
      }));
    }
  }
  entries.push(...after.map((t) => join(outJ, tripEntry(t))));

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
  // The front: days give way to what's in them that is a block of its own; a transfer shows once there's
  // a plan for it (an empty one is a to-do, and a line of the itinerary).
  const board: TimelineEntry[] = [];
  for (const e of entries) {
    if (e.kind === "day") {
      for (const l of e.legs) if (l.status !== "empty") board.push(legRow(l));
      for (const i of e.items) {
        // Only what needs booking is a block of the plan; an idea put on this day is a line of the itinerary.
        if ((i.status === "chosen" || i.status === "booked") && needsBooking(i)) board.push({ kind: "event", key: `event:${i.id}`, date: e.date, dayNo: e.dayNo, item: i });
      }
    } else if (!(e.kind === "leg" && e.leg.status === "empty")) {
      board.push(e);
    }
  }
  return {
    entries,
    sections: sectionsOf(entries, journeyOf),
    board: sectionsOf(board, new Map()),
    unplaced,
    undated: dayItems.filter((i) => !placedDays.has(i.id) && i.category !== "transport" && !isIdea(i)),
  };
}

/**
 * "Rezerve edilecekler · N · M alındı" under the plan: what needs booking and has no block of its own on
 * the front (no day, or saved for a day and not chosen yet), with how many of them are booked.
 */
export function toBook(timeline: Timeline): { items: Item[]; booked: number } {
  const onDays = timeline.entries.flatMap((e) => (e.kind === "day" ? e.items.filter((i) => i.status === "saved" && needsBooking(i) && !isRental(i)) : []));
  const items = [...timeline.undated.filter(needsBooking), ...onDays];
  return { items, booked: items.filter((i) => i.status === "booked").length };
}

const addDaysIso = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Blocks by city: the way in, between cities and home stay on the line; everything else (transfers,
 * nights, days, other trips) goes in the block of the city it happens in, a new block starting where
 * the stays move to another city.
 */
function sectionsOf(entries: TimelineEntry[], journeyOf: Map<string, Journey>): TimelineSection[] {
  const sections: TimelineSection[] = [];
  let current: Extract<TimelineSection, { kind: "city" }> | null = null;
  let index = 0;
  const open = () => {
    current = { kind: "city", key: "", index: ++index, city: null, range: null, nights: 0, stays: [], entries: [] };
    sections.push(current);
    return current;
  };
  const journeys = new Map<string, Extract<TimelineSection, { kind: "journey" }>>();
  for (const e of entries) {
    // A day on the move sits on the line; its day card joins it from inside the city's days.
    const j = journeyOf.get(e.key);
    if (j) {
      let section = journeys.get(j.key);
      if (!section) {
        section = { kind: "journey", key: j.key, journey: j, entries: [] };
        journeys.set(j.key, section);
        sections.push(section);
      }
      if (sections.at(-1) === section) current = null;
      section.entries.push(e);
      continue;
    }
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
