// The ticket frame (bilet ailesi, v82 "niyet kutusu standardı", v83 "Diğer türler" and "Uçuş günü"): what a flight, a train,
// a transfer, a bus, a boat, a rented car or a pass draws in its box. The carrier's line (the operator's logo, the service
// bold, the small line under it), the two ends big with the airport or the station and the hour small, the length and the
// stops in the middle with the way's drawing, the chips (the bag, the platform, the seats, what a pass covers), one stub
// per leg (a connecting flight is one box with two: D7), a pass's days, a rental's pick-up and return, and on the
// flight's day the live strip (C4: the gate, the delay, the terminal, "Biniş başladı", the new times). Only what the
// record says (C19): nothing is guessed, a part with no data isn't there. Pure.
import { brandOf, type Brand } from "./brands";
import { cityOfAirport } from "./airports";
import { durationText } from "./cardFacts";
import type { CardKind } from "./cardKinds";
import { rentalLine } from "./cardTicket";
import { hubWord, legEnd, transportFace } from "./cardView";
import { isPass } from "./covers";
import { delayOf, flightTiles, phaseOf, sourceText, stageOf, type FlightSeen, type FlightTile } from "./flightData";
import { L } from "./i18n";
import { nStops } from "./i18nText";
import { formatDateRange, isoDate, metricsOf, nightsBetween } from "./items";
import type { Leg } from "./legs";
import { wayName } from "./tripShape";
import type { Item, LegMode } from "./types";

/** The way's drawing family: also the static/illus picture in the middle of the ticket. */
export type TicketMode = "flight" | "train" | "bus" | "ferry" | "car" | "transfer" | "pass";

export interface TicketCarrier {
  /** The operator's label and colour (its logo): "JR", "Turkish Airlines", "Odakyu". */
  brand: Brand | null;
  /** Bold: the service or the airline ("Nozomi", "Turkish Airlines", "Hakone Free Pass"). */
  name: string;
  /** Small after it: "JR · Shinkansen", "TK52 · 1 Nis". */
  sub: string | null;
}

export interface TicketEnd {
  /** Big: the city ("İstanbul"); an airport's code when the table can't name its city. */
  city: string;
  /** Small under it: the airport's code or the station ("IST", "Tokyo İst."), when it isn't the city itself. */
  place: string | null;
  time: string | null;
  /** It lands this many days after it leaves ("+1"). */
  plus: number | null;
  /** A transfer's hub by its full name, for a map ("Porto Havalimanı"), when the big word is only "Havalimanı". */
  full?: string;
}

/** One stub (koçan) of the ticket: a connecting flight has one per leg. */
export interface TicketLeg {
  itemId: string;
  carrier: TicketCarrier | null;
  from: TicketEnd | null;
  to: TicketEnd | null;
  duration: string | null;
  stops: { text: string; direct: boolean } | null;
  /** "1 Nis". */
  date: string | null;
}

export interface TicketChip {
  kind: "bag" | "platform" | "seat" | "covers" | "where";
  text: string;
}

/** Uçuş günü (C4): the chip line becomes the live strip, only on the flight's day and while the data is there. */
export interface TicketLive {
  phase: "before" | "air" | "landed" | "canceled" | "diverted";
  /** The pulsing dot: green on time, red late; none once it's landed or off. */
  dot: "on" | "late" | null;
  gate: string | null;
  /** "KIX T1": where it leaves from. */
  terminal: string | null;
  /** Late by this many minutes (10 or more). */
  delay: number | null;
  /** "Biniş başladı", "Kapı kapandı", "İnişe geçiyor" (fresh only). */
  stage: FlightTile | null;
  /** The boxes as the old card drew them (FlightLive), for the details. */
  tiles: FlightTile[];
  /** Late: "Yeni kalkış 11:25, varış 18:05. Planı yeni saate kaydırdım." */
  shift: string | null;
  /** "AeroDataBox · 2 dk önce". */
  source: string;
}

export interface TicketVM {
  mode: TicketMode;
  /** The drawing in the middle (static/illus/<art>.png). */
  art: string;
  carrier: TicketCarrier | null;
  from: TicketEnd | null;
  to: TicketEnd | null;
  /** "11 sa 30 dk": the whole way's (a connection's first leg out to its last in, when both hours are known). */
  duration: string | null;
  /** "Direkt", "1 aktarma"; null where the record doesn't say. */
  stops: { text: string; direct: boolean } | null;
  chips: TicketChip[];
  /** One per leg, in order: two for İstanbul → Doha → Tokyo saved as two flights (D7). Empty while nothing is shown. */
  legs: TicketLeg[];
  /** A pass (Hakone Free Pass): its days, its area, how many ways on the plan it covers. */
  pass: { days: number | null; area: string | null; covers: number } | null;
  /** A rented car, a camper, a bike: "alış yeri · n gün · iade". */
  rental: { line: string | null; pick: string | null; days: number | null; back: string | null } | null;
  live: TicketLive | null;
  /** A transfer or a change of city with no record of its own: the way said on it ("metro"), if any. */
  wayMode?: LegMode | null;
}

const ART: Record<string, string> = {
  flight: "ucus", train: "tren", bus: "otobus", minibus: "minibus", ferry: "vapur", car: "arac-kiralama", moto: "motosiklet", rv: "karavan", bike: "bisiklet", taxi: "taksi-transfer", transport: "taksi-transfer",
};
const MODE: Record<string, TicketMode> = { flight: "flight", train: "train", bus: "bus", minibus: "bus", ferry: "ferry", car: "car", moto: "car", rv: "car", bike: "car", taxi: "transfer", transport: "transfer" };
const RENTED = new Set(["car", "moto", "rv", "bike"]);

/** A train's service and its class ("Shinkansen Nozomi" → "Nozomi", "Shinkansen"); one word stays whole. */
const SERVICE_CLASS = /^(Shinkansen)\s+(\S.*)$/i;

/** The carrier's line: a flight by its airline and number; a train, a bus, a boat by its service and its operator. */
export function ticketCarrier(item: Item, kind: CardKind): TicketCarrier | null {
  const f = item.flight;
  const day = isoDate(f?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  const date = day ? formatDateRange(day, null) : null;
  if (kind === "flight") {
    const airline = f?.carrier?.trim() || item.provider?.trim() || null;
    if (!airline && !f?.flightNumber) return null;
    return { brand: brandOf(airline), name: airline ?? f!.flightNumber!, sub: [airline ? f?.flightNumber : null, date].filter(Boolean).join(" · ") || null };
  }
  const operator = f?.carrier?.trim() || item.provider?.trim() || null;
  const way = wayName(item) ?? item.name;
  const split = way.match(SERVICE_CLASS);
  const name = split ? split[2] : way;
  const sub = [operator && !name.toLowerCase().includes(operator.toLowerCase()) ? operator : null, split ? split[1] : null, date].filter(Boolean).join(" · ") || null;
  return { brand: operator ? brandOf(operator) : null, name, sub };
}

/** An end as the ticket says it: the face's city and its small line (a code or a station), its hour, a later day. */
function endOf(end: ReturnType<typeof transportFace>["from"]): TicketEnd | null {
  if (!end) return null;
  return { city: end.city, place: end.sub, time: end.time, plus: end.plus?.days ?? null };
}

/** One record as a stub: its carrier, its ends, its length and stops. */
function legOf(item: Item, kind: CardKind, ends: { from?: string | null; to?: string | null }): TicketLeg {
  const face = transportFace(item, kind === "flight" ? "flight" : (RENTED.has(kind) ? (kind as "car") : "transport"), ends);
  const minutes = metricsOf(item).durationMinutes;
  const f = item.flight;
  const stops = f?.stops == null ? null : f.stops === 0 ? { text: L("Direkt", "Direct"), direct: true } : { text: nStops(f.stops), direct: false };
  const day = isoDate(f?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  return { itemId: item.id, carrier: ticketCarrier(item, kind), from: endOf(face.from), to: endOf(face.to), duration: minutes ? durationText(minutes) : null, stops, date: day ? formatDateRange(day, null) : null };
}

/** Minutes between two local times at one place (a connection's layover: both on the airport's own clock). */
const between = (a: string | null | undefined, b: string | null | undefined): number | null => {
  if (!a || !b || a.length < 16 || b.length < 16) return null;
  const m = Math.round((Date.parse(`${b.slice(0, 16)}:00Z`) - Date.parse(`${a.slice(0, 16)}:00Z`)) / 6e4);
  return m >= 0 && m < 48 * 60 ? m : null;
};

/**
 * A connection's whole length: each leg's own minutes and the layovers between them (the times at each end are local,
 * so the first departure and the last arrival are never taken on one clock). Null when a part isn't known.
 */
function spanMinutes(shown: readonly Item[]): number | null {
  let total = 0;
  for (const [n, item] of shown.entries()) {
    const own = metricsOf(item).durationMinutes;
    if (!own) return null;
    total += own;
    if (n > 0) {
      const wait = between(shown[n - 1].flight?.arrival, item.flight?.departure);
      if (wait == null) return null;
      total += wait;
    }
  }
  return total || null;
}

/** What the record's own words say of the seats, the coach and the platform ("Vagon 8 · 4D, 4E", "peron 14"). */
function seatChips(item: Item): TicketChip[] {
  const text = [item.statusNote, item.when, item.summary, item.optionDetail].filter(Boolean).join(" · ");
  const out: TicketChip[] = [];
  const coach = text.match(/\b(?:vagon|coach|car)\s*(\d{1,2})\b/i)?.[1];
  const seats = text.match(/\b(?:koltuk(?:lar)?|seats?)\s*((?:\d{1,3}[A-K](?:\s*,\s*|\s+)?)+)/i)?.[1]?.trim().replace(/\s*,\s*/g, ", ");
  const platform = text.match(/\b(?:peron|platform)\s*(\d{1,2}[A-Z]?)\b/i)?.[1];
  if (coach || seats) out.push({ kind: "seat", text: [coach ? L(`Vagon ${coach}`, `Car ${coach}`) : null, seats].filter(Boolean).join(" · ") });
  if (platform) out.push({ kind: "platform", text: L(`Peron ${platform}`, `Platform ${platform}`) });
  return out;
}

/** The bag a flight comes with, when the page says it. */
export function bagChip(item: Item): TicketChip | null {
  const bag = metricsOf(item).checkedBagIncluded;
  return bag == null ? null : { kind: "bag", text: bag ? L("1 bagaj dahil", "1 checked bag") : L("Yalnız el bagajı", "Cabin bag only") };
}

/** The live strip of a booked flight on its day (flightData's reading of AeroDataBox), else null. */
export function liveOf(item: Item, now: Date): TicketLive | null {
  const live = item.flightLive as FlightSeen | null | undefined;
  if (!live || item.status !== "booked") return null;
  const phase = phaseOf(live, now);
  if (phase === "far") return null;
  const late = delayOf(live);
  const lateNow = phase === "before" && late >= 10;
  const clock = (iso: string | null | undefined) => iso?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;
  const leaves = clock(live.departure.revised);
  const lands = clock(live.arrival.revised);
  const terminal = live.departure.terminal ? [live.departure.iata, live.departure.terminal.replace(/^T?/i, "T")].filter(Boolean).join(" ") : null;
  return {
    phase,
    dot: phase === "before" || phase === "air" ? (lateNow ? "late" : "on") : null,
    gate: phase === "before" ? live.departure.gate : null,
    terminal: phase === "before" ? terminal : null,
    delay: lateNow ? late : null,
    stage: stageOf(live, now),
    tiles: flightTiles(live, now),
    shift: lateNow && leaves ? (lands ? L(`Yeni kalkış ${leaves}, varış ${lands}. Planı yeni saate kaydırdım.`, `New departure ${leaves}, arrival ${lands}. I moved the plan to the new time.`) : L(`Yeni kalkış ${leaves}. Planı yeni saate kaydırdım.`, `New departure ${leaves}. I moved the plan to the new time.`)) : null,
    source: sourceText(live, now),
  };
}

export interface TicketCtx {
  kind: CardKind;
  /** The change of city or the transfer it is for (its ends when nothing is shown). */
  leg: Leg | null;
  /** The box's two ends (IntentHead.route). */
  route: { from: string; to: string } | null;
  /** The cities the plan names its ends by (a change of city both, the way in where it lands). */
  ends?: { from?: string | null; to?: string | null };
  now: Date;
  /** How many ways on the plan a pass covers. */
  covers?: number;
}

/**
 * The ticket of a way of travel: the records it shows (the one chosen, booked or suggested; a connecting flight's legs in
 * order), or none while it's still to find (then its two ends only).
 */
export function ticketViewOf(shown: readonly Item[], ctx: TicketCtx): TicketVM {
  const lead = shown[0] ?? null;
  const pass = lead ? isPass(lead) && !RENTED.has(ctx.kind) : false;
  const mode: TicketMode = pass ? "pass" : (MODE[ctx.kind] ?? "transfer");
  const art = pass ? "tren" : (ART[ctx.kind] ?? "taksi-transfer");
  const empty = (city: string | null | undefined): TicketEnd | null => (city ? { city, place: null, time: null, plus: null } : null);
  if (!lead) {
    // A transfer with nothing of its own says its ends as its card did (F5a): the airport and its code, the stay and its name.
    const end = (side: "from" | "to"): TicketEnd | null => {
      if (!ctx.leg || ctx.leg.kind === "move" || ctx.leg.kind === "change") return empty(ctx.route?.[side]);
      const e = legEnd(ctx.leg, side);
      // On the ticket the hub is its one word, big ("Havalimanı"), its code and city small ("OPO · Porto"), as the design's.
      const hub = hubWord(ctx.leg, side);
      if (hub && e.city) return { city: hub, place: [e.sub, ctx.leg[side].city].filter(Boolean).join(" · ") || null, time: e.time, plus: null, full: e.city };
      return e.city ? { city: e.city, place: e.sub, time: e.time, plus: null } : empty(ctx.route?.[side]);
    };
    return { mode, art, carrier: null, from: end("from"), to: end("to"), duration: null, stops: null, chips: [], legs: [], pass: null, rental: null, live: null, wayMode: ctx.leg ? (ctx.leg.choice?.mode ?? ctx.leg.mode ?? null) : null };
  }
  // The plan's cities name the first leg's way out and the last leg's way in (one leg: both its ends).
  const legs = shown.map((item, n) => legOf(item, ctx.kind, { from: n === 0 ? ctx.ends?.from : null, to: n === shown.length - 1 ? ctx.ends?.to : null }));
  const many = legs.length > 1;
  const span = many ? spanMinutes(shown) : null;
  const stops = many ? { text: nStops(legs.length - 1), direct: false } : legs[0].stops;
  const chips: TicketChip[] = [bagChip(lead), ...seatChips(lead)].filter((c): c is TicketChip => Boolean(c));
  if (pass && ctx.covers) chips.push({ kind: "covers", text: L(`${ctx.covers} yolculuk dahil`, ctx.covers === 1 ? "1 way included" : `${ctx.covers} ways included`) });
  if (lead.status === "booked" && lead.location.address) chips.push({ kind: "where", text: lead.location.address });
  const start = isoDate(lead.dates.start);
  const end = isoDate(lead.dates.end);
  const days = start && end ? nightsBetween(start, end) + (pass ? 1 : 0) : (lead.metrics?.validityDays ?? null);
  const rented = RENTED.has(ctx.kind);
  return {
    mode,
    art,
    carrier: legs[0].carrier,
    from: legs[0].from ?? empty(ctx.route?.from),
    to: legs.at(-1)!.to ?? empty(ctx.route?.to),
    duration: many ? (span ? durationText(span) : null) : legs[0].duration,
    stops,
    chips,
    legs,
    pass: pass ? { days: days || null, area: lead.city ?? null, covers: ctx.covers ?? 0 } : null,
    rental: rented
      ? { line: rentalLine(lead), pick: lead.location.area ?? lead.location.address ?? (lead.city ? cityOfAirport(lead.city) : null), days: days || null, back: end ? formatDateRange(end, null) : null }
      : null,
    live: ctx.kind === "flight" ? (shown.map((i) => liveOf(i, ctx.now)).find(Boolean) ?? null) : null,
  };
}

/** A departure's time in hours from now (local times read on one clock, as the flight data does); null without an hour. */
export function hoursTo(item: Pick<Item, "flight" | "dates">, now: Date): number | null {
  const at = item.flight?.departure;
  if (!at || at.length < 16) return null;
  const t = Date.parse(`${at.slice(0, 16)}:00Z`);
  return Number.isFinite(t) ? (t - now.getTime()) / 36e5 : null;
}
