// Trip skeleton: which nights are booked, planned or still open, and which saved options are still
// live. Pure and derived from the saved items on every render, so it can never go stale: un-booking
// a stay brings its alternatives straight back, and nothing is ever deleted to "close" a need.
import { L } from "./i18n";
import { nNights } from "./i18nText";
import { formatDateRange, isoDate, nightsBetween } from "./items";
import { isLocalTransfer, isRental, isTrip } from "./travelKinds";
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
  | {
      kind: "booked";
      range: DateRange;
      nights: number;
      city: string | null;
      item: Item;
      /** Other bookings for some of the same nights (a clash, see notices): shown here so none goes missing. */
      clashes?: Item[];
    }
  | {
      kind: "chosen";
      range: DateRange;
      nights: number;
      city: string | null;
      item: Item;
      groups: OptionGroup[];
      /** A stay said in the chat these nights are (one block, whatever was chosen for part of it). */
      slot?: Item;
      /** Nights of it the choice doesn't cover (Impar for 7–10 of a stay said for 7–12): still to fill. */
      gap?: DateRange[];
    }
  | {
      kind: "open";
      range: DateRange;
      nights: number;
      city: string | null;
      groups: OptionGroup[];
      searchUrl: string;
      /** A stay said in the chat ("7 Ekim gecesi başka bir yerde kalalım"): these nights are one stay of their own. */
      slot?: Item;
    };

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
  closed: { item: Item; reason: string; /** The record that took its place or whose booking closed it. */ by?: string }[];
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

/** Things planned on a day in a place. */
const DAY_PLACES: Category[] = ["activity", "food", "other"];
const isSettled = (i: Item) => i.status === "booked" || i.status === "chosen";

/**
 * The span of nights the trip needs a bed for: the confirmed dates, else from the trips in and out and
 * the stays, always widened to show the bookings and choices that stand. Each trip counts once (its
 * booked or chosen option when there is one, else all its options), and a bed is needed from the day
 * one lands to the day one leaves: an overnight flight doesn't add a night.
 */
export function tripRange(trip: Trip, items: Item[]): DateRange | null {
  const live = items.filter((i) => i.status !== "dismissed");
  const c = trip.confirmedDates;
  let range: DateRange | null =
    c && isoDate(c.start) && isoDate(c.end) && c.start < c.end ? { start: c.start, end: c.end } : null;
  const stays = live.filter((i) => i.category === "stay");

  if (!range) {
    const starts: string[] = [];
    const ends: string[] = [];
    const byNeed = new Map<string, Item[]>();
    for (const i of live.filter(isTrip)) byNeed.set(`${i.category}|${i.needKey}`, [...(byNeed.get(`${i.category}|${i.needKey}`) ?? []), i]);
    for (const [key, list] of byNeed) {
      for (const need of travelNeeds(key, list)) {
        const settled = need.items.filter(isSettled);
        for (const i of settled.length ? settled : need.items) {
          const [arrives, leaves] = [arrivalDay(i), departureDay(i)];
          if (arrives) starts.push(arrives);
          if (leaves) ends.push(leaves);
        }
      }
    }
    for (const i of stays) {
      const r = stayRange(i);
      if (r) starts.push(r.start), ends.push(r.end);
    }
    if (!starts.length || !ends.length) return null;
    const start = starts.sort()[0];
    const end = ends.sort().at(-1)!;
    if (start >= end) return null;
    range = { start, end };
  }

  const replaced = replacedChatStays(stays);
  const booked = stays.filter((i) => i.status === "booked" && stayRange(i) && !replaced.has(i.id));
  const standing = [
    ...booked,
    // A choice a booking closed, or a plan a saved page replaced, doesn't widen the trip.
    ...stays.filter((i) => i.status === "chosen" && stayRange(i) && !replaced.has(i.id) && !booked.some((b) => overlaps(stayRange(b)!, stayRange(i)!))),
  ];
  for (const i of standing) {
    const r = stayRange(i)!;
    range = { start: minDate(range.start, r.start), end: maxDate(range.end, r.end) };
  }
  return nightsBetween(range.start, range.end) <= MAX_NIGHTS ? range : null;
}

/** When a choice was made (older items only know when they last changed). */
const chosenAt = (i: Item) => i.statusAt ?? i.updatedAt;

/** A stay said in the chat and not booked: its nights are one stay of their own, a hotel still to pick. */
const isSlot = (i: Item) => i.origin === "chat" && i.category === "stay" && i.status === "chosen" && Boolean(stayRange(i));

/**
 * Whether a chosen page takes a stay said in the chat: one for those nights only (or fewer), or one
 * chosen after it was said. A choice made before ("7 Ekim gecesi başka bir yerde kalalım" said after
 * choosing a place for 7–11) keeps only its other nights.
 */
function fills(choice: Item, slot: Item): boolean {
  const [c, s] = [stayRange(choice)!, stayRange(slot)!];
  return (s.start <= c.start && c.end <= s.end) || chosenAt(choice) >= slot.updatedAt;
}

/**
 * Stays said in the chat ("Madeira'da kalacağız") that a saved page now covers: one booked, or chosen
 * for them (see fills), in the same place for all of those nights. A plan only partly covered stays
 * (for the other nights).
 */
function replacedChatStays(stays: Item[]): Map<string, Item> {
  // A choice a booking closed takes nothing over.
  const booked = stays.filter((i) => i.status === "booked" && stayRange(i));
  const standing = (i: Item) => i.status === "booked" || !booked.some((b) => overlaps(stayRange(b)!, stayRange(i)!));
  const real = stays.filter((i) => i.origin !== "chat" && (i.status === "chosen" || i.status === "booked") && stayRange(i) && standing(i));
  const out = new Map<string, Item>();
  for (const i of stays) {
    const r = i.origin === "chat" ? stayRange(i) : null;
    if (!r) continue;
    const by = real.find((x) => {
      const xr = stayRange(x)!;
      return xr.start <= r.start && xr.end >= r.end && samePlace([x], [i]) && (x.status === "booked" || fills(x, i));
    });
    if (by) out.set(i.id, by);
  }
  return out;
}

// --- grouping -----------------------------------------------------------------------------------------

/** The nights a stay group is for ("stay@2026-10-07_2026-10-10"), or null for other keys. */
export function rangeOfGroupKey(key: string): DateRange | null {
  const m = key.match(/^stay@(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})(?:#.*)?$/);
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

const rangeTitle = (r: DateRange) => `${formatDateRange(r.start, r.end)} · ${nNights(nightsBetween(r.start, r.end))}`;
/** Why a saved option left the plan: something else took its place. */
const replacedReason = (by: string) => L(`Yerine ${by} geldi`, `Replaced by ${by}`);

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
    // The island and its capital: a stay "in Madeira" answers the Funchal nights (pages far apart still aren't).
    funchal: ["madeira", "madeira island", "ilha da madeira"],
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
    // Airport codes, as flight pages and the chat write them ("OPO → FNC").
    istanbul: ["ist", "saw", "isl"],
    ankara: ["esb"],
    izmir: ["adb"],
    antalya: ["ayt"],
    madrid: ["mad"],
    malaga: ["agp"],
    palma: ["pmi", "palma de mallorca"],
    paris: ["cdg", "ory"],
    amsterdam: ["ams"],
    frankfurt: ["fra"],
    berlin: ["ber"],
    dublin: ["dub"],
    faro: ["fao"],
    "ponta delgada": ["pdl"],
    "porto santo": ["pxo"],
    "new york": ["jfk", "ewr", "lga", "nyc"],
    // Where the start chat's flights land for an island or a region (startTrip.ts KNOWN_PLACES airport).
    denpasar: ["dps", "ngurah rai", "bali denpasar"],
    kayseri: ["asr"],
    male: ["mle", "velana"],
    dubai: ["dxb"],
  }).flatMap(([name, others]) => others.map((o) => [o, name])),
);
Object.assign(
  CITY_ALIASES,
  Object.fromEntries(
    Object.entries({
      lizbon: ["lis"],
      porto: ["opo"],
      funchal: ["fnc"],
      roma: ["fco", "cia"],
      atina: ["ath"],
      munih: ["muc"],
      viyana: ["vie"],
      prag: ["prg"],
      floransa: ["flr"],
      venedik: ["vce"],
      napoli: ["nap"],
      milano: ["mxp", "lin", "bgy"],
      sevilla: ["svq"],
      bruksel: ["bru", "crl"],
      kopenhag: ["cph"],
      varsova: ["waw"],
      cenevre: ["gva"],
      londra: ["lhr", "lgw", "stn", "ltn", "lcy"],
      barselona: ["bcn"],
      nis: ["nce"],
      marsilya: ["mrs"],
      budapeste: ["bud"],
      bukres: ["otp"],
      belgrad: ["beg"],
      selanik: ["skg"],
      kahire: ["cai"],
      edinburg: ["edi"],
      zurih: ["zrh"],
      tiflis: ["tbs"],
    }).flatMap(([name, others]) => others.map((o) => [o, name])),
  ),
);

/** Words around a place's name in a flight or station field ("Aeroporto do Porto", "Madeira Airport"). */
const HUB_WORDS = new Set(
  "international intl airport aeroporto aeropuerto aeroport flughafen havalimani terminal station railway train bus coach port harbour harbor pier estacao estacion gare bahnhof hbf gar gari otogar ferry iskele central centrale centro do da de di del the".split(" "),
);
const KNOWN_PLACES = new Set([...Object.keys(CITY_ALIASES), ...Object.values(CITY_ALIASES)]);

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

/**
 * Where a flight or train goes, as a city key: its name, airport code or a station in it ("OPO",
 * "Lisboa Santa Apolónia", "Madeira Airport"). Null when nothing names a place.
 */
export function placeKeyOf(value: string | null | undefined): string | null {
  const whole = cityKeyOf(value);
  if (!whole || KNOWN_PLACES.has(whole)) return whole;
  const words = whole.split(" ").filter((w) => !HUB_WORDS.has(w));
  const bare = words.join(" ");
  if (KNOWN_PLACES.has(bare)) return CITY_ALIASES[bare] ?? bare;
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const part = words.slice(i, i + n).join(" ");
      if (KNOWN_PLACES.has(part)) return CITY_ALIASES[part] ?? part;
    }
  }
  return bare || whole;
}

/** A place the app knows by name (so a different one really is somewhere else). */
export const knownPlace = (key: string | null) => Boolean(key && KNOWN_PLACES.has(key));

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
  // A stay said in the chat ("Madeira'da kalacağız") gives way to a saved page chosen or booked for those nights.
  const replacedBy = replacedChatStays(stays);
  const bookedStays = stays.filter((i) => i.status === "booked" && stayRange(i) && !replacedBy.has(i.id)).sort(byStart);
  for (let a = 0; a < bookedStays.length; a++) {
    for (let b = a + 1; b < bookedStays.length; b++) {
      const ra = stayRange(bookedStays[a])!;
      const rb = stayRange(bookedStays[b])!;
      if (!overlaps(ra, rb)) continue;
      const clash = { start: maxDate(ra.start, rb.start), end: minDate(ra.end, rb.end) };
      notices.push({
        kind: "conflict",
        date: clash.start,
        text: L(
          `${formatDateRange(clash.start, clash.end)} (${nightsBetween(clash.start, clash.end)} gece) için iki rezervasyon var: ${bookedStays[a].name} ve ${bookedStays[b].name}`,
          `Two bookings for ${formatDateRange(clash.start, clash.end)} (${nNights(nightsBetween(clash.start, clash.end))}): ${bookedStays[a].name} and ${bookedStays[b].name}`,
        ),
      });
    }
  }
  const openStays: Item[] = [];
  for (const i of stays) {
    const replaced = replacedBy.get(i.id);
    if (replaced) {
      closed.push({ item: i, reason: replacedReason(replaced.name), by: replaced.id });
      continue;
    }
    const r = stayRange(i);
    if (i.status === "booked" && r) continue;
    // A stay said in the chat keeps the nights a booking leaves (it's closed below if none are left).
    const blocker = r && !isSlot(i) ? bookedStays.find((b) => overlaps(stayRange(b)!, r)) : undefined;
    if (blocker) closed.push({ item: i, reason: L(`${blocker.name} rezervasyonu bu geceleri kapsıyor`, `The ${blocker.name} booking covers these nights`), by: blocker.id });
    else openStays.push(i);
  }
  const chosenStays = openStays.filter((i) => i.status === "chosen" && stayRange(i)).sort(byStart);

  const byKey = new Map<string, Item[]>();
  // A stay said in the chat is a stretch of nights, not an option to pick.
  for (const i of openStays.filter((x) => !isSlot(x))) byKey.set(groupKeyOf(i), [...(byKey.get(groupKeyOf(i)) ?? []), i]);
  // The same nights in different places (Porto and Braga, 8–12) are two needs; pages without a city go
  // with the rest of those nights.
  const stayGroups = [...byKey].flatMap(([key, list]) => {
    if (!stayRange(list[0])) return [stayGroup(key, list)];
    const places: Item[][] = [];
    for (const i of list.filter((x) => x.city || x.geo)) {
      const same = places.find((p) => samePlace(p, [i]));
      if (same) same.push(i);
      else places.push([i]);
    }
    const placeless = list.filter((x) => !x.city && !x.geo);
    if (!places.length) return [stayGroup(key, list)];
    places.sort((a, b) => b.length - a.length);
    places[0].push(...placeless);
    if (places.length === 1) return [stayGroup(key, places[0])];
    return places.map((p) => stayGroup(`${key}#${cityKeyOf(mostCommon(p.map((i) => i.city))) ?? "x"}`, p));
  });
  stayGroups.sort((a, b) => (a.range?.start ?? "9").localeCompare(b.range?.start ?? "9") || a.key.localeCompare(b.key));

  // The nights, merged into runs covered by the same booking / choice, or open.
  const stayBlocks: StayBlock[] = [];
  const looseStays: OptionGroup[] = [];
  if (range) {
    type Run = { key: string; start: string; end: string; item: Item | null; booked: boolean; slot: Item | null; picks: (Item | null)[] };
    const runs: Run[] = [];
    const covers = (a: DateRange, b: DateRange) => a.start <= b.start && a.end >= b.end;
    // The latest choice wins a night two choices share; a stay said in the chat keeps its nights to
    // itself (the latest said first), open until a page is chosen for it.
    const picks = chosenStays.filter((i) => i.origin !== "chat").sort((a, b) => chosenAt(b) - chosenAt(a) || byStart(a, b));
    const slots = stays.filter(isSlot).sort((a, b) => b.updatedAt - a.updatedAt);
    for (let night = range.start; night < range.end; night = addDays(night, 1)) {
      const booked = bookedStays.find((b) => holds(stayRange(b)!, night));
      const slot = booked ? undefined : slots.find((s) => holds(stayRange(s)!, night));
      const holding = booked ? [] : picks.filter((c) => holds(stayRange(c)!, night) && (!slot || fills(c, slot)));
      // In a said stay, a choice for all of it before one for part of it.
      const chosen = (slot && holding.find((c) => covers(stayRange(c)!, stayRange(slot)!))) || holding[0];
      // A stay said in the chat stays one block: a choice for only part of it is shown with the nights it leaves.
      const whole = !chosen || !slot || covers(stayRange(chosen)!, stayRange(slot)!);
      const item = booked ?? (whole ? chosen : undefined) ?? null;
      const key = item ? `${booked ? "b" : "c"}:${item.id}` : slot ? `s:${slot.id}` : "open";
      const last = runs.at(-1);
      if (last && last.key === key) {
        last.end = addDays(night, 1);
        last.picks.push(chosen ?? null);
      } else runs.push({ key, start: night, end: addDays(night, 1), item, booked: Boolean(booked), slot: item ? null : (slot ?? null), picks: [chosen ?? null] });
    }
    for (const run of runs) {
      const r = { start: run.start, end: run.end };
      const nights = nightsBetween(r.start, r.end);
      if (run.item && run.booked) stayBlocks.push({ kind: "booked", range: r, nights, city: run.item.city, item: run.item });
      else if (run.item) stayBlocks.push({ kind: "chosen", range: r, nights, city: run.item.city, item: run.item, groups: [] });
      else if (run.slot && run.picks.some(Boolean)) {
        // Part of a said stay chosen: the block is the whole stay, its choice the one with the most nights.
        const counts = new Map<Item, number>();
        for (const p of run.picks) if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
        const main = [...counts].sort((a, b) => b[1] - a[1])[0][0];
        const gap: DateRange[] = [];
        run.picks.forEach((p, i) => {
          if (p === main) return;
          const night = addDays(run.start, i);
          const last = gap.at(-1);
          if (last && last.end === night) last.end = addDays(night, 1);
          else gap.push({ start: night, end: addDays(night, 1) });
        });
        stayBlocks.push({ kind: "chosen", range: r, nights, city: run.slot.city ?? main.city, item: main, groups: [], slot: run.slot, gap });
      } else if (run.slot) stayBlocks.push({ kind: "open", range: r, nights, city: run.slot.city, groups: [], searchUrl: "", slot: run.slot });
      else stayBlocks.push({ kind: "open", range: r, nights, city: null, groups: [], searchUrl: "" });
    }
    // A stay said in the chat whose nights were all taken (chosen pages for each of them): its job is done.
    for (const slot of slots) {
      if (closed.some((c) => c.item.id === slot.id) || stayBlocks.some((b) => b.kind !== "booked" && b.slot === slot)) continue;
      const by = stayBlocks.filter((b) => b.kind !== "open" && overlaps(b.range, stayRange(slot)!)).map((b) => (b.kind === "open" ? "" : b.item.name));
      const byId = stayBlocks.find((b) => b.kind !== "open" && overlaps(b.range, stayRange(slot)!));
      closed.push({ item: slot, reason: replacedReason([...new Set(by)].join(", ")), by: byId && byId.kind !== "open" ? byId.item.id : undefined });
    }
    // A booking wholly inside another one's nights got no stretch of its own: it sits with the one it clashes with.
    for (const b of bookedStays) {
      if (stayBlocks.some((x) => x.kind === "booked" && x.item.id === b.id)) continue;
      const host = stayBlocks.find((x) => x.kind === "booked" && overlaps(x.range, stayRange(b)!));
      if (host?.kind === "booked") host.clashes = [...(host.clashes ?? []), b];
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
      // Nights in its own city first (Funchal's options don't belong to Porto's stay for the same nights).
      const place = mostCommon(group.items.map((i) => i.city));
      const fits = stayBlocks.filter((b) => b.kind !== "booked" && overlaps(b.range, group.range!));
      const target = own ?? fits.find((b) => !b.city || !place || sameCity(b.city, place)) ?? fits[0];
      if (target && target.kind !== "booked") target.groups.push(group);
      else looseStays.push(group);
    }

    // Nights with nothing chosen still have a place when the plan says it: the options for them, the
    // trip arriving that day ("11 Ekim'de Madeira'ya uçuyoruz") or leaving at the end, or what's planned
    // in those days (a car rented in Madeira).
    for (const block of stayBlocks) {
      if (block.kind !== "open") continue;
      const trips = live.filter(isTrip);
      // With a connection (Istanbul → Copenhagen → Porto) the last flight in says where, the first one out where from.
      const when = (i: Item, end: "arrival" | "departure") => i.flight?.[end] ?? i.flight?.departure ?? "";
      const arriving = trips
        .filter((i) => arrivalDay(i) === block.range.start && (i.flight?.to || i.city))
        .sort((a, b) => when(b, "arrival").localeCompare(when(a, "arrival")))[0];
      const leaving = trips
        .filter((i) => departureDay(i) === block.range.end && i.flight?.from)
        .sort((a, b) => when(a, "departure").localeCompare(when(b, "departure")))[0];
      const during = live.filter((i) => {
        const d = departureDay(i);
        return i.city && d && d >= block.range.start && d < block.range.end && (DAY_PLACES.includes(i.category) || isRental(i));
      });
      const candidates = [
        block.slot?.city,
        mostCommon(block.groups.flatMap((g) => g.items.map((i) => i.city))),
        arriving?.city ?? arriving?.flight?.to,
        leaving?.flight?.from,
        mostCommon(during.map((i) => i.city)),
      ];
      block.city = candidates.find((c): c is string => Boolean(c)) ?? null;
    }
    // Nights between two stays in the same city are in that city.
    stayBlocks.forEach((block, i) => {
      if (block.kind !== "open") return;
      const [before, after] = [stayBlocks[i - 1]?.city ?? null, stayBlocks[i + 1]?.city ?? null];
      if (!block.city && before && sameCity(before, after)) block.city = before;
      block.searchUrl = bookingSearchUrl(block.range, block.city, stays);
    });

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
      // Two stretches in its city (a night said apart, the rest chosen): the one still open.
      const open = fits.filter((b) => b.kind === "open");
      const block = fits.length === 1 ? fits[0] : open.length === 1 ? open[0] : null;
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
    // Without the trip's nights (no dates, or too far apart to lay out) bookings still show, each on its own.
    for (const b of bookedStays) looseStays.push(stayGroup(`${groupKeyOf(b)}#booked`, [b]));
  }
  // Groups for the same nights in different places (Porto and Madeira, 7–10) stay apart, so their keys must
  // too: a key names one decision (and one card row on the board).
  const taken = new Set<string>();
  for (const g of [...stayBlocks.flatMap((b) => (b.kind === "booked" ? [] : b.groups)), ...looseStays]) {
    if (taken.has(g.key)) g.key = `${g.key}#${cityKeyOf(mostCommon(g.items.map((i) => i.city))) ?? "x"}`;
    while (taken.has(g.key)) g.key = `${g.key}+`;
    taken.add(g.key);
  }

  // Flights, transfers, eSIM: a booking settles its own need (one leg), not the others.
  const groups: OptionGroup[] = [];
  for (const category of COMPARABLE.filter((c) => c !== "stay")) {
    const byNeed = new Map<string, Item[]>();
    for (const i of live.filter((x) => x.category === category)) byNeed.set(i.needKey, [...(byNeed.get(i.needKey) ?? []), i]);
    const needs = [...byNeed].flatMap(([key, list]) => (category === "esim" ? [{ key, items: list }] : travelNeeds(key, list)));
    // A trip said in the chat ("7 Ekim'de uçuyoruz", "Madeira'da araba kiralarız") and a page saved for it
    // (the same kind of trip, within a day, not known to go elsewhere) are the same need.
    if (category === "flight" || category === "transport") {
      for (const plan of needs.filter((n) => n.items.every((i) => i.origin === "chat"))) {
        const said = plan.items[0];
        const real = needs.find((n) => n !== plan && n.items.some((i) => i.origin !== "chat" && sameTrip(said, i)));
        if (!real) continue;
        real.items.push(...plan.items);
        plan.items = [];
      }
    }
    for (const need of needs.filter((n) => n.items.length)) {
      const { key } = need;
      let list = need.items;
      // Once a saved page is chosen or booked, the plan said in the chat has done its job.
      const real = list.find((i) => i.origin !== "chat" && (i.status === "chosen" || i.status === "booked"));
      if (real) {
        for (const i of list.filter((x) => x.origin === "chat")) closed.push({ item: i, reason: replacedReason(real.name), by: real.id });
        list = list.filter((x) => x.origin !== "chat");
      }
      const booked = list.filter((i) => i.status === "booked");
      if (booked.length) {
        for (const i of list.filter((x) => x.status !== "booked")) closed.push({ item: i, reason: L(`${booked[0].name} rezerve edildi`, `${booked[0].name} was booked`), by: booked[0].id });
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

  const gapNights = (b: StayBlock) => (b.kind === "chosen" ? (b.gap ?? []).reduce((n, r) => n + nightsBetween(r.start, r.end), 0) : 0);
  const count = (kind: StayBlock["kind"]) => stayBlocks.filter((b) => b.kind === kind).reduce((s, b) => s + b.nights - gapNights(b), 0);
  const gaps = stayBlocks.reduce((n, b) => n + gapNights(b), 0);
  notices.sort((a, b) => a.date.localeCompare(b.date));
  return {
    range,
    nights: { total: range ? nightsBetween(range.start, range.end) : 0, booked: count("booked"), chosen: count("chosen"), open: count("open") + gaps },
    stayBlocks,
    notices,
    looseStays,
    groups,
    closed,
  };
}

const tripKind = (i: Item) => (isRental(i) ? "rental" : isLocalTransfer(i) ? "local" : "trip");
const tripEnds = (i: Item) => ({
  from: tripKind(i) === "trip" ? placeKeyOf(i.flight?.from) : null,
  to: placeKeyOf(tripKind(i) === "trip" ? (i.flight?.to ?? i.city) : i.city),
});
const agree = (a: string | null, b: string | null) => !a || !b || a === b;

/** A plan said in the chat and a saved page for the same trip: same kind, within a day, same way. */
function sameTrip(said: Item, page: Item): boolean {
  const [a, b] = [departureDay(said), departureDay(page)];
  if (!a || !b || daysApart(a, b) > 1 || tripKind(said) !== tripKind(page)) return false;
  const [x, y] = [tripEnds(said), tripEnds(page)];
  return agree(x.from, y.from) && agree(x.to, y.to);
}

const daysApart = (a: string, b: string) => Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS));

/**
 * Flights and transport split into one need per trip: the same direction on the same day (options a
 * day apart count as alternatives). Pages can give the flight out and the flight home the same need
 * key; a booked flight home must never settle, close or hide the flight out.
 */
export function travelNeeds(key: string, list: Item[]): { key: string; items: Item[] }[] {
  const direction = (i: Item) => (i.flight?.from && i.flight.to ? `${cityKeyOf(i.flight.from)}>${cityKeyOf(i.flight.to)}` : "");
  const byDirection = new Map<string, Item[]>();
  for (const i of list) byDirection.set(direction(i), [...(byDirection.get(direction(i)) ?? []), i]);
  // Options without a route go with the only route there is.
  const routes = [...byDirection.keys()].filter(Boolean);
  if (routes.length === 1 && byDirection.has("")) {
    byDirection.set(routes[0], [...byDirection.get(routes[0])!, ...byDirection.get("")!]);
    byDirection.delete("");
  }
  const needs: Item[][] = [];
  for (const items of byDirection.values()) {
    const sorted = [...items].sort((a, b) => (departureDay(a) ?? "9").localeCompare(departureDay(b) ?? "9"));
    const clusters: Item[][] = [];
    for (const i of sorted) {
      const day = departureDay(i);
      const last = clusters.at(-1);
      const lastDay = last ? departureDay(last[0]) : null;
      if (last && (!day || (lastDay && daysApart(day, lastDay) <= 1))) last.push(i);
      else clusters.push([i]);
    }
    needs.push(...clusters);
  }
  if (needs.length <= 1) return needs.map((items) => ({ key, items }));
  const seen = new Set<string>();
  return needs.map((items, n) => {
    let k = `${key}@${departureDay(items[0]) ?? "tarihsiz"}`;
    if (seen.has(k)) k = `${k}#${n}`;
    seen.add(k);
    return { key: k, items };
  });
}

/** Every group whose options are still being decided (what the decision engine ranks). */
export function liveGroups(plan: Plan): OptionGroup[] {
  const fromBlocks = plan.stayBlocks.flatMap((b) => (b.kind === "booked" ? [] : b.groups));
  return [...fromBlocks, ...plan.looseStays, ...plan.groups].filter((g) => !g.booked);
}
