// The "Bugün" strip (v83 "gezi sırasında", D8, F2; hero83.py today_html): on the trip, in the hero's place, the day as
// it is lived: its date, city and number, the weather the hero has, hour by hour what happens (the ones gone by, the one
// on now, the next), each with the one thing to do with it then (open the ticket, the map, write to the hotel, the
// booking), and tomorrow's first thing. On a day with a flight, that flight as its live data says it (gate, delay, the new
// time). Its rows are the day's lines as Gün gün's Günlük akış has them (dayCards: the hours worked out, the traveller's own
// hours and order), nothing the plan doesn't say. Also the one "next" the hero can show in time (F2, F4): the next thing
// today while on the trip, check-in in the last 48 hours before a booked flight. Pure.
import { cityOfAirport } from "./airports";
import { cardKind, cardKindLabel, type CardKind } from "./cardKinds";
import { safeContactUrl } from "./cardTicket";
import { cityOfNight } from "./categories";
import type { CityWeather, Sky } from "./climate";
import { delayOf, delayShiftNote, flightAlert, flightTiles, sourceText, stageOf, type FlightTile } from "./flightData";
import { L, locale } from "./i18n";
import { formatDateRange, nightsBetween, placeMapUrl } from "./items";
import { dayCards, flowRows, isAsideRow, orderRows } from "./dayCards";
import type { DayRow } from "./journey";
import { docOpenLabel } from "./journeyChapters";
import { addMinutes, clockOf, legItem, minutesOf, stayTimes, type Leg } from "./legs";
import { LANDING_EXIT_MINUTES, TRANSFER_MINUTES } from "./dayTimes";
import { addDays, sameCity, type Plan } from "./plan";
import { transferLinks } from "./searchLinks";
import type { RentalEntry, Timeline, TimelineSection } from "./timeline";
import { checkinFlights, hoursUntil, tripModeOf } from "./tripPhase";
import type { DocMeta, Item, Listing, Trip } from "./types";

/** Gone by, on now, the next one, later today (or with no hour). */
export type TodayPhase = "past" | "now" | "next" | "later";

/** The one thing a row of today does: its file, the place on the map, the way there, a note to the hotel. */
export interface TodayAction {
  kind: "doc" | "map" | "route" | "host";
  label: string;
  itemId: string | null;
  /** The map, the directions, the hotel's address to write to; none for a file (the board opens it by `itemId`). */
  url: string | null;
}

export interface TodayRow {
  key: string;
  /** What the line is: a stay's door (in, out, its night), a way of travel leaving, one landing, a transfer, a thing planned. */
  kind: "stay" | "travel" | "arrival" | "transfer" | "item";
  time: string | null;
  /** A usual or worked-out time (a stay's 15:00 its page doesn't state): drawn with "~". */
  estimated: boolean;
  /** "Etkinlik", "Konaklama", "Transfer", "Uçuş", "Varış". */
  kindWord: string;
  title: string;
  sub: string | null;
  phase: TodayPhase;
  action: TodayAction | null;
  itemId: string | null;
  /** The day's flight leaving now-ish: late, so its row says so in red. */
  alert: boolean;
}

/** The day's flight as its live data says it (C4 on the strip): its new times, gate and stage, the plan moved with it. */
export interface FlightToday {
  itemId: string;
  /** "TK49 · KIX → IST". */
  title: string;
  departure: string | null;
  arrival: string | null;
  /** Minutes late (0 on time or not known). */
  delay: number;
  gate: string | null;
  terminal: string | null;
  /** "Biniş başladı", "Kapı kapandı", while fresh. */
  stage: string | null;
  tiles: FlightTile[];
  alert: boolean;
  /** "Planı yeni saate göre kaydırdım: iniş 18:05", when it's late. */
  shift: string | null;
  /** "AeroDataBox · 2 dk önce". */
  source: string;
}

export interface TodayVM {
  date: string;
  dayNo: number;
  total: number;
  city: string | null;
  /** "6 Nisan Salı · Kyoto · gezinin 6. günü", the last day "… · eve dönüş". */
  title: string;
  /** The hero's weather for today's city (climate.ts), else none. */
  weather: { sky: Sky; high: number; low: number; text: string } | null;
  rows: TodayRow[];
  nowKey: string | null;
  nextKey: string | null;
  /** Tomorrow's first thing ("Yarın 08:30 · Kyoto → Hakone"), none on the last day. */
  tomorrow: { time: string | null; kindWord: string; title: string; sub: string | null; itemId: string | null } | null;
  flight: FlightToday | null;
}

export interface TodayInput {
  /** The traveller's own hours and order of a day (Günlük akış). */
  trip: Pick<Trip, "dayTimes" | "dayOrder">;
  plan: Plan;
  timeline: Timeline;
  items: readonly Item[];
  /** The day and the time where the trip is (tripPhase.localNow). */
  today: string;
  time: string;
  /** The moment, for the flight's live phase (flightData.phaseOf). */
  at: Date;
  listings?: Map<string, Listing>;
  docsFor?: (itemId: string) => readonly DocMeta[];
  /** The hero's weather by city (useWeather), when it has it. */
  weather?: readonly CityWeather[];
}

// --- the day's rows ------------------------------------------------------------------------------------------------

type JourneySection = Extract<TimelineSection, { kind: "journey" }>;

/** The day on the move that is this date's (the way in, a change of city, the way home), if it is one. */
const journeyOn = (sections: readonly TimelineSection[], date: string): JourneySection | undefined =>
  sections.find((s): s is JourneySection => s.kind === "journey" && s.journey.date === date);

const rentalsOf = (sections: readonly TimelineSection[]): RentalEntry[] =>
  sections.flatMap((s) => (s.kind === "city" || s.kind === "journey" ? s.entries.filter((e): e is RentalEntry => e.kind === "rental") : []));

/** A booking's code in a few words: "bilet VI-77310", "onay GH-5531", "rezervasyon TC-4471", "PNR K7T2QX". */
function codeWords(item: Item, kind: CardKind): string | null {
  const ref = item.bookingRef;
  if (!ref) return null;
  if (kind === "flight") return `PNR ${ref}`;
  if (kind === "stay") return L(`onay ${ref}`, `confirmation ${ref}`);
  if (kind === "food") return L(`rezervasyon ${ref}`, `booking ${ref}`);
  return L(`bilet ${ref}`, `ticket ${ref}`);
}

interface Env {
  t: TodayInput;
  docs: (id: string) => number;
}

/** The file when there is one; else the place on the map (a place, a table, an event); else nothing. */
function docOrMap(item: Item, kind: CardKind, env: Env): TodayAction | null {
  if (item.status === "booked" && env.docs(item.id) > 0) return { kind: "doc", label: kind === "flight" ? L("E-bileti aç", "Open the e-ticket") : docOpenLabel(kind), itemId: item.id, url: null };
  if (kind === "flight" || kind === "train" || kind === "bus" || kind === "ferry" || kind === "minibus") return null;
  return item.geo || item.location.address || item.name ? { kind: "map", label: L("Haritada aç", "Open in Maps"), itemId: item.id, url: placeMapUrl(item) } : null;
}

/** A stay's row: write to the hotel when its booking gives a way to, else its place on the map. */
function stayAction(item: Item | null): TodayAction | null {
  if (!item) return null;
  const host = safeContactUrl(item.host?.url);
  if (host) return { kind: "host", label: L("Otele yaz", "Write to the hotel"), itemId: item.id, url: host };
  return { kind: "map", label: L("Haritada aç", "Open in Maps"), itemId: item.id, url: placeMapUrl(item) };
}

const travelItem = (r: DayRow): Item | null => {
  const e = r.entry;
  if (e?.kind !== "travel") return null;
  return e.travel?.settled ?? (e.travel?.items.length === 1 ? e.travel.items[0] : null);
};

/** A flight's own short name ("TK49"), else its name. */
const flightName = (item: Item) => item.flight?.flightNumber?.replace(/\s+/g, "") ?? item.name;
/** "KIX → IST" for a flight, "Tokyo → Kyoto" for a train. */
const ends = (item: Item) => (item.flight?.from && item.flight.to ? `${item.flight.from} → ${item.flight.to}` : null);
const departsOn = (item: Item) => item.flight?.departure?.slice(0, 10) ?? null;

/** A way of travel leaving today: the flight's live state when it has one (late, its gate, boarding), else who and the code. */
function travelRow(item: Item, key: string, env: Env): TodayRow {
  const kind = cardKind(item);
  const live = item.flightLive ?? null;
  const late = live ? delayOf(live) : 0;
  const liveBits = (live ? [late >= 10 ? L(`Rötar +${late} dk`, `Delayed +${late} min`) : null, live.departure.gate ? L(`Kapı ${live.departure.gate}`, `Gate ${live.departure.gate}`) : null, stageOf(live, env.t.at)?.value ?? null] : []).filter(Boolean);
  return {
    key,
    kind: "travel",
    time: clockOf(item.flight?.departure),
    estimated: false,
    kindWord: cardKindLabel(kind),
    title: kind === "flight" ? [flightName(item), ends(item)].filter(Boolean).join(" · ") : (ends(item) ?? item.name),
    sub: (liveBits.length ? liveBits : [kind === "flight" ? null : item.provider, codeWords(item, kind)]).filter(Boolean).join(" · ") || null,
    phase: "later",
    action: docOrMap(item, kind, env),
    itemId: item.id,
    alert: live ? flightAlert(live, env.t.at) : false,
  };
}

/** A flight that left another day lands today: "18:40 Varış · TK52 · IST → HND". */
function landedRow(item: Item, key: string): TodayRow {
  return {
    key: `landing:${key}`,
    kind: "arrival",
    time: clockOf(item.flight?.arrival),
    estimated: false,
    kindWord: L("Varış", "Arrival"),
    title: [flightName(item), ends(item)].filter(Boolean).join(" · "),
    sub: item.flight?.to ? cityOfAirport(item.flight.to) : null,
    phase: "later",
    action: null,
    itemId: item.id,
    alert: false,
  };
}

/** A transfer in a few words: what was chosen for it ("Otelin servisi · sen hallettin"), else its state; nothing while empty. */
function legSub(leg: Leg, r: DayRow): string | null {
  if (leg.status === "empty") return null;
  const item = legItem(leg);
  if (item) return [item.name, item.arranged ? L("sen hallettin", "you sorted it") : null].filter(Boolean).join(" · ");
  return r.line ?? (r.status || null);
}

function rowOf(r: DayRow, date: string, env: Env): TodayRow | null {
  const base = { key: r.key, time: r.time, estimated: r.estimated, phase: "later" as TodayPhase, alert: false };
  if (r.kind === "info" && r.stay) {
    // A stay with no place chosen has no door to leave or reach: no line for it.
    if (!r.stay.placed) return null;
    const out = r.key.endsWith(":checkout");
    const block = env.t.plan.stayBlocks.find((b) => `stay:${b.range.start}` === r.stayKey);
    const item = block && block.kind !== "open" ? block.item : null;
    return {
      ...base,
      kind: "stay",
      kindWord: cardKindLabel("stay"),
      title: out ? L("Otelden çıkış", "Check-out") : L("Otele giriş", "Check-in"),
      sub: [r.stay.name, item ? codeWords(item, "stay") : null].filter(Boolean).join(" · ") || null,
      action: out ? null : stayAction(item),
      itemId: item?.id ?? null,
    };
  }
  if (r.kind === "travel") {
    const item = travelItem(r);
    if (!item) return null;
    // Left the day before (a night flight): today it lands.
    return departsOn(item) && departsOn(item) !== date ? landedRow(item, r.key) : travelRow(item, r.key, env);
  }
  if (r.kind === "leg" && r.leg) {
    const leg: Leg = r.leg;
    const maps = transferLinks({ from: leg.from.item?.location.address ?? leg.from.label, to: leg.to.item?.location.address ?? leg.to.label }).find((l) => l.brand === "maps");
    return {
      ...base,
      kind: "transfer",
      kindWord: L("Transfer", "Transfer"),
      title: `${leg.from.label} → ${leg.to.label}`,
      sub: legSub(leg, r),
      action: maps ? { kind: "route", label: L("Yol tarifi", "Directions"), itemId: null, url: maps.url } : null,
      itemId: null,
    };
  }
  if ((r.kind === "item" || r.kind === "idea" || r.kind === "rental") && (r.item || r.rental)) {
    const item = r.item ?? r.rental?.group.items.find((i) => i.status === "booked") ?? r.rental?.group.items.find((i) => i.status === "chosen") ?? null;
    if (!item) return null;
    const kind = cardKind(item);
    const planned = item.status !== "booked" ? L("planda", "on the plan") : null;
    return {
      ...base,
      kind: "item",
      kindWord: r.kind === "idea" ? cardKindLabel("todo") : cardKindLabel(kind),
      title: item.name,
      sub: [item.status === "booked" ? item.provider : (item.summary.trim() || null), codeWords(item, kind), planned].filter(Boolean).join(" · ") || null,
      action: docOrMap(item, kind, env),
      itemId: item.id,
    };
  }
  return null;
}

/** On a day of a stay (not its first or last): "Gion Hatanaka · 2. gece", from its check-in hour. */
function stayNightRow(plan: Plan, date: string, env: Env): TodayRow | null {
  const block = plan.stayBlocks.find((b) => b.range.start < date && date < b.range.end);
  if (!block || block.kind === "open") return null;
  const item = block.item;
  const times = stayTimes(item, env.t.listings);
  const night = nightsBetween(block.range.start, date) + 1;
  return {
    key: `stay-night:${date}`,
    kind: "stay",
    time: times.checkIn,
    estimated: !times.stated.checkIn,
    kindWord: cardKindLabel("stay"),
    title: L(`${item.name} · ${night}. gece`, `${item.name} · night ${night}`),
    sub: codeWords(item, "stay"),
    phase: "later",
    action: stayAction(item),
    itemId: item.id,
    alert: false,
  };
}

/** The check-in of a bed starting today (and the check-out of one ending), when no line of the day says it already. */
function stayDoorRows(plan: Plan, date: string, rows: readonly TodayRow[], env: Env): TodayRow[] {
  const out: TodayRow[] = [];
  for (const b of plan.stayBlocks) {
    if (b.kind === "open" || (b.range.start !== date && b.range.end !== date)) continue;
    const item = b.item;
    if (rows.some((r) => r.kind === "stay" && r.itemId === item.id)) continue;
    const inn = b.range.start === date;
    const times = stayTimes(item, env.t.listings);
    out.push({
      key: `stay-door:${item.id}:${inn ? "in" : "out"}`,
      kind: "stay",
      time: inn ? times.checkIn : times.checkOut,
      estimated: !(inn ? times.stated.checkIn : times.stated.checkOut),
      kindWord: cardKindLabel("stay"),
      title: inn ? L("Otele giriş", "Check-in") : L("Otelden çıkış", "Check-out"),
      sub: [item.name, codeWords(item, "stay")].filter(Boolean).join(" · ") || null,
      phase: "later",
      action: inn ? stayAction(item) : null,
      itemId: item.id,
      alert: false,
    });
  }
  return out;
}

/** The way home lands today: its arrival is a row of its own ("18:05 Varış · İstanbul"), the new time when it's late. */
function landingRow(journey: JourneySection | undefined, rows: DayRow[]): TodayRow | null {
  if (journey?.journey.role !== "departure") return null;
  const flight = rows.map(travelItem).filter((i): i is Item => i?.category === "flight").at(-1);
  if (!flight?.flight?.to) return null;
  const late = flight.flightLive ? delayOf(flight.flightLive) >= 10 : false;
  return {
    key: `landing:${flight.id}`,
    kind: "arrival",
    time: clockOf(flight.flight.arrival),
    estimated: false,
    kindWord: L("Varış", "Arrival"),
    title: cityOfAirport(flight.flight.to),
    sub: [flight.flight.to, late ? L("yeni saat", "new time") : null].filter(Boolean).join(" · ") || null,
    phase: "later",
    action: null,
    itemId: flight.id,
    alert: false,
  };
}

/** A night flight's day of leaving is another day's journey (it is on the day it lands): its row on the day it leaves. */
function leavingTonight(sections: readonly TimelineSection[], date: string, env: Env): TodayRow[] {
  return sections.flatMap((s) =>
    s.kind === "journey" && s.journey.date !== date
      ? s.entries.flatMap((e) => {
          const item = e.kind === "travel" ? (e.travel?.settled ?? (e.travel?.items.length === 1 ? e.travel.items[0] : null)) : null;
          return item && departsOn(item) === date ? [travelRow(item, e.key, env)] : [];
        })
      : [],
  );
}

/**
 * The day's lines as Günlük akış has them (dayCards: the times worked out, the traveller's own hours and order), by the
 * clock: what is on the plan that day, not the options saved for it, nor what isn't part of a day (insurance, a chore).
 */
function linesOfDay(date: string, t: TodayInput): DayRow[] {
  const cards = dayCards([...t.timeline.sections], { rentals: rentalsOf(t.timeline.sections), listings: t.listings, times: t.trip.dayTimes ?? undefined, merge: false });
  const lines = cards
    .filter((c) => c.date === date)
    .flatMap((c) => flowRows(c, t.trip.dayTimes ?? undefined))
    .filter((r) => !isAsideRow(r) && r.kind !== "ideas" && !(r.kind === "idea" && r.item?.status === "saved"));
  return orderRows(lines, t.trip.dayOrder?.[date]);
}

function rowsOfDay(date: string, env: Env): TodayRow[] {
  const { timeline, plan } = env.t;
  const journey = journeyOn(timeline.sections, date);
  const raw = linesOfDay(date, env.t);
  const rows = raw.map((r) => rowOf(r, date, env)).filter((r): r is TodayRow => r != null);
  for (const r of leavingTonight(timeline.sections, date, env)) {
    const at = r.time ? rows.findIndex((x) => x.time != null && minutesOf(x.time) > minutesOf(r.time!)) : -1;
    rows.splice(at < 0 ? rows.length : at, 0, r);
  }
  // A stay's own line when the day's journey doesn't carry it: its night, or its door on a day it starts (D14: the
  // way in landing after a night on the plane reaches the first bed on a day of its own).
  for (const r of [journey ? null : stayNightRow(plan, date, env), ...stayDoorRows(plan, date, rows, env)]) {
    if (!r) continue;
    const at = r.time ? rows.findIndex((x) => x.time != null && minutesOf(x.time) > minutesOf(r.time!)) : -1;
    rows.splice(at < 0 ? rows.length : at, 0, r);
  }
  const landing = landingRow(journey, raw);
  if (landing) rows.push(landing);
  return byClock(afterLanding(checkoutFirst(rows)));
}

/** By the clock, a line with no hour kept right after the one before it (dayCards.orderRows on the strip's lines). */
function byClock(rows: TodayRow[]): TodayRow[] {
  const out = rows
    .map((r, n) => ({ r, n }))
    .filter((x) => x.r.time)
    .sort((a, b) => minutesOf(a.r.time!) - minutesOf(b.r.time!) || a.n - b.n)
    .map((x) => x.r);
  rows.forEach((r, i) => {
    if (!r.time) out.splice(i > 0 ? out.indexOf(rows[i - 1]) + 1 : 0, 0, r);
  });
  return out;
}

const isCheckOut = (r: TodayRow) => r.kind === "stay" && (r.key.endsWith(":checkout") || r.key.endsWith(":out"));
const isCheckIn = (r: TodayRow) => r.kind === "stay" && (r.key.endsWith(":checkin") || r.key.endsWith(":in"));

/** A check-out with only the usual hour, on a day the way on leaves earlier: it's done first, its hour isn't the day's. */
function checkoutFirst(rows: TodayRow[]): TodayRow[] {
  const leaves = rows.find((r) => r.kind === "travel" && r.time);
  const out = rows.find((r) => isCheckOut(r) && r.estimated && r.time && leaves?.time && minutesOf(r.time) > minutesOf(leaves.time));
  if (!out || !leaves) return rows;
  const rest = rows.filter((r) => r !== out);
  rest.splice(rest.indexOf(leaves), 0, { ...out, time: null, estimated: false });
  return rest;
}

/** A landing today: no check-in before getting out of the airport and there (dayTimes' own minutes), worked out, "~". */
function afterLanding(rows: TodayRow[]): TodayRow[] {
  const landed = rows.find((r) => r.kind === "arrival" && r.time);
  if (!landed?.time) return rows;
  const ready = addMinutes(landed.time, LANDING_EXIT_MINUTES + TRANSFER_MINUTES);
  return rows.map((r) => (isCheckIn(r) && (!r.time || (r.estimated && minutesOf(r.time) < minutesOf(ready))) ? { ...r, time: ready, estimated: true } : r));
}

/** Gone by, on now, the next: the last row whose hour has come is on now; a row with no hour is never "now". */
function withPhases(rows: TodayRow[], time: string): TodayRow[] {
  const at = minutesOf(time);
  let now = -1;
  rows.forEach((r, n) => {
    if (r.time && minutesOf(r.time) <= at) now = n;
  });
  const next = rows.findIndex((r, n) => n > now && r.time != null);
  return rows.map((r, n) => ({ ...r, phase: n === now ? "now" : n === next ? "next" : r.time && n < now ? "past" : "later" }));
}

function flightToday(rows: readonly TodayRow[], items: readonly Item[], at: Date): FlightToday | null {
  // The one leaving today first; else the one landing today.
  const pick = (kind: TodayRow["kind"]) => rows.filter((r) => r.kind === kind && r.itemId).map((r) => items.find((i) => i.id === r.itemId)).find((i): i is Item => i?.category === "flight" && i.status === "booked");
  const item = pick("travel") ?? pick("arrival");
  if (!item) return null;
  const live = item.flightLive ?? null;
  const late = live ? delayOf(live) : 0;
  return {
    itemId: item.id,
    title: [flightName(item), ends(item)].filter(Boolean).join(" · "),
    departure: clockOf(item.flight?.departure),
    arrival: clockOf(item.flight?.arrival),
    delay: late,
    gate: live?.departure.gate ?? null,
    terminal: live?.departure.terminal ?? null,
    stage: live ? (stageOf(live, at)?.value ?? null) : null,
    tiles: live ? flightTiles(live, at) : [],
    alert: live ? flightAlert(live, at) : false,
    shift: live && late >= 10 ? delayShiftNote(live) : null,
    source: live ? sourceText(live, at) : "",
  };
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "long", timeZone: "UTC" });

/**
 * The strip for today, on the trip's days (null before and after it, D8: the plan is an archive then). Its rows are the
 * day's lines (Günlük akış), with a stay's night, a night flight leaving and the landing home added; each row has its
 * phase by `time`.
 */
export function todayStrip(t: TodayInput): TodayVM | null {
  const range = t.plan.range;
  if (!range || tripModeOf(range, t.today) !== "trip") return null;
  const env: Env = { t, docs: (id) => t.docsFor?.(id).length ?? 0 };
  const rows = withPhases(rowsOfDay(t.today, env), t.time);
  const city = cityOfNight(t.plan, t.today) ?? (t.today === range.end ? (t.plan.stayBlocks.at(-1)?.city ?? null) : null);
  const dayNo = nightsBetween(range.start, t.today) + 1;
  const total = nightsBetween(range.start, range.end) + 1;
  const last = t.today === range.end;
  const title = [L(`${formatDateRange(t.today, null)} ${weekday(t.today)}`, `${weekday(t.today)} ${formatDateRange(t.today, null)}`), city, last ? L("eve dönüş", "going home") : L(`gezinin ${dayNo}. günü`, `day ${dayNo} of the trip`)].filter(Boolean).join(" · ");
  const w = city ? t.weather?.find((x) => sameCity(x.city, city)) : undefined;
  const tomorrowDay = addDays(t.today, 1);
  const tomorrowRows = tomorrowDay <= range.end ? rowsOfDay(tomorrowDay, env).filter((r) => !r.key.endsWith(":checkout") && !r.key.startsWith("stay-night:")) : [];
  const timed = tomorrowRows.filter((r) => r.time).sort((a, b) => minutesOf(a.time!) - minutesOf(b.time!));
  const first = timed[0] ?? tomorrowRows[0] ?? null;
  return {
    date: t.today,
    dayNo,
    total,
    city,
    title,
    weather: w ? { sky: w.sky, high: w.high, low: w.low, text: `${w.high}°` } : null,
    rows,
    nowKey: rows.find((r) => r.phase === "now")?.key ?? null,
    nextKey: rows.find((r) => r.phase === "next")?.key ?? null,
    tomorrow: first ? { time: first.time, kindWord: first.kindWord, title: first.title, sub: first.sub, itemId: first.itemId } : null,
    flight: flightToday(rows, t.items, t.at),
  };
}

// --- the one "next" in time (F2, F4) ---------------------------------------------------------------------------------

/**
 * What the hero's "Sıradaki" says when time decides it rather than a decision (nextStep.ts): on the trip, the next row
 * of today (or tomorrow's first once today's are done); in the last 48 hours before a booked flight, its check-in.
 * Null otherwise: the decisions lead.
 */
export type TimedNext =
  | { kind: "today"; row: TodayRow }
  | { kind: "tomorrow"; title: string; time: string | null; itemId: string | null }
  | { kind: "checkin"; item: Item; hours: number };

export function timedNext(t: TodayInput, strip: TodayVM | null = todayStrip(t)): TimedNext | null {
  if (strip) {
    // A stay's door and a worked-out hour aren't a thing to head for: the next booking or plan of the day is.
    const now = strip.rows.findIndex((r) => r.phase === "now");
    const row = strip.rows.find((r, n) => n > now && r.time && !r.estimated && r.kind !== "stay");
    if (row) return { kind: "today", row };
    if (strip.tomorrow) return { kind: "tomorrow", title: strip.tomorrow.title, time: strip.tomorrow.time, itemId: strip.tomorrow.itemId };
    return null;
  }
  const flight = checkinFlights(t.items, t.at)[0];
  if (!flight) return null;
  return { kind: "checkin", item: flight, hours: Math.round(hoursUntil(flight.flight?.departure, t.at) ?? 0) };
}

/** "Sıradaki: Nishiki pazarı 12:30", "Sıradaki: yarın 08:30 Kyoto → Hakone", "Sıradaki: check-in · TK49". */
export function timedNextLabel(n: TimedNext): string {
  switch (n.kind) {
    case "today":
      return L(`Sıradaki: ${[n.row.title, n.row.time].filter(Boolean).join(" ")}`, `Next: ${[n.row.title, n.row.time].filter(Boolean).join(" ")}`);
    case "tomorrow":
      return L(`Sıradaki: yarın ${[n.time, n.title].filter(Boolean).join(" ")}`, `Next: tomorrow ${[n.time, n.title].filter(Boolean).join(" ")}`);
    case "checkin":
      return L(`Sıradaki: check-in · ${flightName(n.item)}`, `Next: check in · ${flightName(n.item)}`);
  }
}
