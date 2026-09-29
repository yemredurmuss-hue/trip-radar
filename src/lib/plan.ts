// Trip skeleton: which nights are booked, planned or still open, and which saved options are still
// live. Pure and derived from the saved items on every render, so it can never go stale: un-booking
// a stay brings its alternatives straight back, and nothing is ever deleted to "close" a need.
import { formatDateRange, isoDate, nightsBetween } from "./items";
import type { Category, Item, Trip } from "./types";

/** Categories whose saved options are alternatives for one need (places to visit are not). */
export const COMPARABLE: Category[] = ["stay", "flight", "transport", "esim"];

/** Longer spans are almost certainly bad data; the timeline is skipped rather than drawn wrong. */
const MAX_NIGHTS = 120;
const DAY_MS = 86_400_000;

/** Nights from `start` up to (not including) the check-out day `end`. */
export interface DateRange {
  start: string;
  end: string;
}

/** Live alternatives for one need: one stay date range, one flight leg, one eSIM... */
export interface OptionGroup {
  key: string;
  category: Category;
  /** "Porto · 8–11 Ekim · 3 gece", "7 Ekim · IST → OPO". */
  title: string | null;
  /** Options still in play (a chosen one included); never closed or dismissed ones. */
  items: Item[];
  /** Stays: the nights this group's options cover. */
  range: DateRange | null;
  /** A booking settles the need: the group then holds only what was booked. */
  booked: Item | null;
}

export type StayBlock =
  | { kind: "booked"; range: DateRange; nights: number; city: string | null; item: Item }
  | { kind: "chosen"; range: DateRange; nights: number; city: string | null; item: Item; groups: OptionGroup[] }
  | { kind: "open"; range: DateRange; nights: number; city: string | null; groups: OptionGroup[]; searchUrl: string };

/** Transfers (between cities, to the airport...) are legs, see legs.ts. */
export interface PlanNotice {
  kind: "conflict";
  /** The day it concerns, so the board can show it in place. */
  date: string;
  text: string;
}

export interface Plan {
  range: DateRange | null;
  nights: { total: number; booked: number; chosen: number; open: number };
  /** The trip's nights in order, when the dates are known. */
  stayBlocks: StayBlock[];
  notices: PlanNotice[];
  /** Stays without dates, or outside the trip's dates. */
  looseStays: OptionGroup[];
  /** Flights, transport and eSIM needs in date order. */
  groups: OptionGroup[];
  /** Options a booking made irrelevant; kept (and restored if the booking is undone). */
  closed: { item: Item; reason: string }[];
}

// --- dates ------------------------------------------------------------------------------------------

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** The nights a stay covers; null when its dates are missing, reversed or implausible. */
export function stayRange(item: Item): DateRange | null {
  const start = isoDate(item.dates.start);
  const end = isoDate(item.dates.end);
  if (!start || !end || start >= end || nightsBetween(start, end) > MAX_NIGHTS) return null;
  return { start, end };
}

const overlaps = (a: DateRange, b: DateRange) => a.start < b.end && b.start < a.end;
const holds = (r: DateRange, night: string) => r.start <= night && night < r.end;
const minDate = (a: string, b: string) => (a < b ? a : b);
const maxDate = (a: string, b: string) => (a > b ? a : b);

/** Day a flight/transfer leaves (or the item's start date). */
export function departureDay(item: Item): string | null {
  return isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
}

/** Day a flight/transfer arrives (falls back to the departure day). */
export function arrivalDay(item: Item): string | null {
  return isoDate(item.flight?.arrival?.slice(0, 10)) ?? departureDay(item);
}

const TRAVEL: Category[] = ["flight", "transport"];
const isSettled = (i: Item) => i.status === "booked" || i.status === "chosen";

/**
 * The span of nights the trip needs a bed for: the confirmed dates, else from the flights and stays
 * (booked/chosen flights win over alternatives), always widened to show booked and chosen stays.
 */
export function tripRange(trip: Trip, items: Item[]): DateRange | null {
  const live = items.filter((i) => i.status !== "dismissed");
  const c = trip.confirmedDates;
  let range: DateRange | null =
    c && isoDate(c.start) && isoDate(c.end) && c.start < c.end ? { start: c.start, end: c.end } : null;

  if (!range) {
    const travel = live.filter((i) => TRAVEL.includes(i.category));
    const decided = travel.filter(isSettled);
    const days: string[] = [];
    for (const i of decided.length ? decided : travel) {
      for (const d of [departureDay(i), arrivalDay(i)]) if (d) days.push(d);
    }
    for (const i of live.filter((x) => x.category === "stay")) {
      const r = stayRange(i);
      if (r) days.push(r.start, r.end);
    }
    if (days.length < 2) return null;
    days.sort();
    if (days[0] === days.at(-1)) return null;
    range = { start: days[0], end: days.at(-1)! };
  }

  for (const i of live.filter((x) => x.category === "stay" && isSettled(x))) {
    const r = stayRange(i);
    if (r) range = { start: minDate(range.start, r.start), end: maxDate(range.end, r.end) };
  }
  return nightsBetween(range.start, range.end) <= MAX_NIGHTS ? range : null;
}

// --- grouping -----------------------------------------------------------------------------------------

/** The nights a stay group is for ("stay@2026-10-07_2026-10-10"), or null for other keys. */
export function rangeOfGroupKey(key: string): DateRange | null {
  const m = key.match(/^stay@(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  return m && m[1] < m[2] ? { start: m[1], end: m[2] } : null;
}

/**
 * Which options are compared with each other: stays by exact nights, everything else by need. The
 * site a page came from (Booking, Airbnb, a hotel's own site...) never matters. (A stay saved without
 * dates may still join the comparison for its city's open nights; see buildPlan.)
 */
export function groupKeyOf(item: Item): string {
  if (item.category !== "stay") return item.needKey;
  const range = stayRange(item);
  return range ? `stay@${range.start}_${range.end}` : `stay@${item.needKey}`;
}

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
}

const rangeTitle = (r: DateRange) => `${formatDateRange(r.start, r.end)} · ${nightsBetween(r.start, r.end)} gece`;

function stayGroup(key: string, items: Item[], range: DateRange | null = stayRange(items[0])): OptionGroup {
  const city = mostCommon(items.map((i) => i.city));
  const booked = items.find((i) => i.status === "booked") ?? null;
  return {
    key,
    category: "stay",
    title: [city, range ? rangeTitle(range) : null].filter(Boolean).join(" · ") || null,
    items,
    range,
    booked,
  };
}

function travelTitle(items: Item[]): string | null {
  const day = items.map(departureDay).filter(Boolean).sort()[0] ?? null;
  const f = items.find((i) => i.flight?.from && i.flight?.to)?.flight;
  const route = f ? `${f.from} → ${f.to}` : null;
  return [day ? formatDateRange(day, null) : null, route].filter(Boolean).join(" · ") || null;
}

function bookingSearchUrl(range: DateRange, city: string | null, stays: Item[]): string {
  const adults = Number(mostCommon(stays.map((i) => (i.guests.adults ? String(i.guests.adults) : null)))) || 2;
  const params = new URLSearchParams({
    ...(city ? { ss: city } : {}),
    checkin: range.start,
    checkout: range.end,
    group_adults: String(adults),
    no_rooms: "1",
  });
  return `https://www.booking.com/searchresults.html?${params}`;
}

const byStart = (a: Item, b: Item) => (stayRange(a)?.start ?? "").localeCompare(stayRange(b)?.start ?? "");
// --- places -----------------------------------------------------------------------------------------

/** The same city as pages in other languages name it ("Lisbon", "Lisboa" and "Lizbon" are one). */
const CITY_ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries({
    lizbon: ["lisbon", "lisboa", "lisbonne", "lissabon", "lisbona"],
    porto: ["oporto"],
    roma: ["rome", "rom"],
    atina: ["athens", "athina", "athen", "athenes"],
    munih: ["munich", "munchen", "muenchen"],
    viyana: ["vienna", "wien", "vienne"],
    prag: ["prague", "praha", "praga"],
    floransa: ["florence", "firenze", "florenz"],
    venedik: ["venice", "venezia", "venise", "venedig"],
    napoli: ["naples", "neapel"],
    milano: ["milan", "mailand"],
    sevilla: ["seville"],
    bruksel: ["brussels", "bruxelles", "brussel"],
    kopenhag: ["copenhagen", "kobenhavn", "kopenhagen"],
    varsova: ["warsaw", "warszawa"],
    moskova: ["moscow", "moskva"],
    cenevre: ["geneva", "geneve", "genf"],
    koln: ["cologne", "koeln"],
    londra: ["london"],
    barselona: ["barcelona"],
    nis: ["nice", "nizza"],
    marsilya: ["marseille"],
    budapeste: ["budapest"],
    bukres: ["bucharest", "bucuresti"],
    belgrad: ["belgrade", "beograd"],
    selanik: ["thessaloniki", "thessalonica", "salonica"],
    lefkosa: ["nicosia", "lefkosia"],
    kahire: ["cairo"],
    edinburg: ["edinburgh"],
    lahey: ["the hague", "den haag"],
    anvers: ["antwerp", "antwerpen"],
    zurih: ["zurich"],
    kudus: ["jerusalem"],
    tiflis: ["tbilisi"],
  }).flatMap(([name, others]) => others.map((o) => [o, name])),
);

/** A city's name reduced to compare: case, accents and other languages' names don't matter. */
export function cityKeyOf(city: string | null | undefined): string | null {
  if (!city) return null;
  const plain = city
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return plain ? (CITY_ALIASES[plain] ?? plain) : null;
}

export const sameCity = (a: string | null, b: string | null) => {
  const [x, y] = [cityKeyOf(a), cityKeyOf(b)];
  return Boolean(x && y && x === y);
};

/** Pages this close on the map are the same place to stay (Porto and Gaia across the river). */
const NEAR_KM = 25;

/** Great-circle distance (kept here so the plan stays free of the network-bound geo module). */
function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Stays in the same place: the same city by name, or map points close together. */
function samePlace(a: Item[], b: Item[], cityA = mostCommon(a.map((i) => i.city)), cityB = mostCommon(b.map((i) => i.city))): boolean {
  if (sameCity(cityA, cityB)) return true;
  return a.some((x) => x.geo && b.some((y) => y.geo && kmBetween(x.geo!, y.geo!) <= NEAR_KM));
}

/**
 * Stays whose nights overlap in the same place answer the same need, whatever the site: a flat for
 * 8–12 and a hotel for 7–12 are one decision, compared per night over 7–12 (see decision.ts).
 */
function mergeOverlapping(groups: OptionGroup[]): OptionGroup[] {
  let merged = [...groups];
  for (let changed = true; changed; ) {
    changed = false;
    outer: for (let a = 0; a < merged.length; a++) {
      for (let b = a + 1; b < merged.length; b++) {
        const [x, y] = [merged[a], merged[b]];
        if (!x.range || !y.range || !overlaps(x.range, y.range) || !samePlace(x.items, y.items)) continue;
        const range = { start: minDate(x.range.start, y.range.start), end: maxDate(x.range.end, y.range.end) };
        const joined = stayGroup(`stay@${range.start}_${range.end}`, [...x.items, ...y.items], range);
        merged = [...merged.slice(0, a), joined, ...merged.slice(a + 1, b), ...merged.slice(b + 1)];
        changed = true;
        break outer;
      }
    }
  }
  return merged;
}

// --- the plan -----------------------------------------------------------------------------------------

export function buildPlan(trip: Trip, items: Item[]): Plan {
  const live = items.filter((i) => i.status !== "dismissed");
  const closed: Plan["closed"] = [];
  const notices: PlanNotice[] = [];
  const range = tripRange(trip, items);

  // Stays. A booking closes every other option that needs any of the same nights.
  const stays = live.filter((i) => i.category === "stay");
  const bookedStays = stays.filter((i) => i.status === "booked" && stayRange(i)).sort(byStart);
  for (let a = 0; a < bookedStays.length; a++) {
    for (let b = a + 1; b < bookedStays.length; b++) {
      const ra = stayRange(bookedStays[a])!;
      const rb = stayRange(bookedStays[b])!;
      if (!overlaps(ra, rb)) continue;
      const clash = { start: maxDate(ra.start, rb.start), end: minDate(ra.end, rb.end) };
      notices.push({
        kind: "conflict",
        date: clash.start,
        text: `${formatDateRange(clash.start, clash.end)} (${nightsBetween(clash.start, clash.end)} gece) için iki rezervasyon var: ${bookedStays[a].name} ve ${bookedStays[b].name}`,
      });
    }
  }
  const openStays: Item[] = [];
  for (const i of stays) {
    if (i.status === "booked" && stayRange(i)) continue;
    const r = stayRange(i);
    const blocker = r ? bookedStays.find((b) => overlaps(stayRange(b)!, r)) : undefined;
    if (blocker) closed.push({ item: i, reason: `${blocker.name} rezervasyonu bu geceleri kapsıyor` });
    else openStays.push(i);
  }
  const chosenStays = openStays.filter((i) => i.status === "chosen" && stayRange(i)).sort(byStart);

  const byKey = new Map<string, Item[]>();
  for (const i of openStays) byKey.set(groupKeyOf(i), [...(byKey.get(groupKeyOf(i)) ?? []), i]);
  const stayGroups = [...byKey].map(([key, list]) => stayGroup(key, list));
  stayGroups.sort((a, b) => (a.range?.start ?? "9").localeCompare(b.range?.start ?? "9") || a.key.localeCompare(b.key));

  // The nights, merged into runs covered by the same booking / choice, or open.
  const stayBlocks: StayBlock[] = [];
  const looseStays: OptionGroup[] = [];
  if (range) {
    type Run = { key: string; start: string; end: string; item: Item | null; booked: boolean };
    const runs: Run[] = [];
    for (let night = range.start; night < range.end; night = addDays(night, 1)) {
      const booked = bookedStays.find((b) => holds(stayRange(b)!, night));
      const chosen = booked ? undefined : chosenStays.find((c) => holds(stayRange(c)!, night));
      const item = booked ?? chosen ?? null;
      const key = item ? `${booked ? "b" : "c"}:${item.id}` : "open";
      const last = runs.at(-1);
      if (last && last.key === key) last.end = addDays(night, 1);
      else runs.push({ key, start: night, end: addDays(night, 1), item, booked: Boolean(booked) });
    }
    for (const run of runs) {
      const r = { start: run.start, end: run.end };
      const nights = nightsBetween(r.start, r.end);
      if (run.item && run.booked) stayBlocks.push({ kind: "booked", range: r, nights, city: run.item.city, item: run.item });
      else if (run.item) stayBlocks.push({ kind: "chosen", range: r, nights, city: run.item.city, item: run.item, groups: [] });
      else stayBlocks.push({ kind: "open", range: r, nights, city: null, groups: [], searchUrl: "" });
    }

    // Each group of alternatives sits under the first stretch of nights it could fill; a chosen
    // option's own group always stays with its choice.
    const undated: OptionGroup[] = [];
    for (const group of stayGroups) {
      if (!group.range) {
        undated.push(group);
        continue;
      }
      const own = stayBlocks.find((b) => b.kind === "chosen" && group.items.includes(b.item));
      const target = own ?? stayBlocks.find((b) => b.kind !== "booked" && overlaps(b.range, group.range!));
      if (target && target.kind !== "booked") target.groups.push(group);
      else looseStays.push(group);
    }

    for (const block of stayBlocks) {
      if (block.kind !== "open") continue;
      const arriving = live.find((i) => TRAVEL.includes(i.category) && arrivalDay(i) === block.range.start && i.city);
      block.city = mostCommon(block.groups.flatMap((g) => g.items.map((i) => i.city))) ?? arriving?.city ?? null;
      block.searchUrl = bookingSearchUrl(block.range, block.city, stays);
    }

    for (const block of stayBlocks) if (block.kind !== "booked") block.groups = mergeOverlapping(block.groups);

    // A stay saved without dates (e.g. an Airbnb page before picking dates) is for the nights still
    // to fill in its city. With exactly one such stretch it joins that comparison, whatever the site
    // or the language the page named the city in; the decision engine treats its price as
    // provisional until it's saved again with the dates.
    for (const group of undated) {
      const city = mostCommon(group.items.map((i) => i.city));
      const fits = stayBlocks.filter(
        (b) => b.kind !== "booked" && (sameCity(b.city, city) || samePlace(group.items, b.groups.flatMap((g) => g.items), city, b.city)),
      );
      const block = fits.length === 1 ? fits[0] : null;
      if (!block || block.kind === "booked") {
        looseStays.push(group);
        continue;
      }
      const whole = block.groups.find((g) => g.range?.start === block.range.start && g.range.end === block.range.end);
      const largest = [...block.groups].sort((a, b) => b.items.length - a.items.length)[0];
      const target = whole ?? largest;
      if (target) target.items.push(...group.items);
      else {
        block.groups.push({
          key: `stay@${block.range.start}_${block.range.end}`,
          category: "stay",
          title: [city, rangeTitle(block.range)].filter(Boolean).join(" · "),
          items: group.items,
          range: block.range,
          booked: null,
        });
      }
    }
  } else {
    looseStays.push(...stayGroups);
  }

  // Flights, transfers, eSIM: a booking settles its own need (one leg), not the others.
  const groups: OptionGroup[] = [];
  for (const category of COMPARABLE.filter((c) => c !== "stay")) {
    const byNeed = new Map<string, Item[]>();
    for (const i of live.filter((x) => x.category === category)) byNeed.set(i.needKey, [...(byNeed.get(i.needKey) ?? []), i]);
    for (const [key, list] of byNeed) {
      const booked = list.filter((i) => i.status === "booked");
      if (booked.length) {
        for (const i of list.filter((x) => x.status !== "booked")) closed.push({ item: i, reason: `${booked[0].name} rezerve edildi` });
      }
      const itemsInPlay = booked.length ? booked : list;
      groups.push({
        key,
        category,
        title: category === "esim" ? null : travelTitle(itemsInPlay),
        items: itemsInPlay,
        range: null,
        booked: booked[0] ?? null,
      });
    }
  }
  const firstDay = (g: OptionGroup) => g.items.map(departureDay).filter(Boolean).sort()[0] ?? "9999";
  groups.sort(
    (a, b) =>
      COMPARABLE.indexOf(a.category) - COMPARABLE.indexOf(b.category) || firstDay(a).localeCompare(firstDay(b)) || a.key.localeCompare(b.key),
  );

  const count = (kind: StayBlock["kind"]) => stayBlocks.filter((b) => b.kind === kind).reduce((s, b) => s + b.nights, 0);
  notices.sort((a, b) => a.date.localeCompare(b.date));
  return {
    range,
    nights: { total: range ? nightsBetween(range.start, range.end) : 0, booked: count("booked"), chosen: count("chosen"), open: count("open") },
    stayBlocks,
    notices,
    looseStays,
    groups,
    closed,
  };
}

/** Every group whose options are still being decided (what the decision engine ranks). */
export function liveGroups(plan: Plan): OptionGroup[] {
  const fromBlocks = plan.stayBlocks.flatMap((b) => (b.kind === "booked" ? [] : b.groups));
  return [...fromBlocks, ...plan.looseStays, ...plan.groups].filter((g) => !g.booked);
}
