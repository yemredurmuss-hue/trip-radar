// A booked flight's real data (0.36.15): its schedule and, on the day, status, gate, terminal and baggage belt,
// from AeroDataBox through our own server (supabase/functions/flight, the key stays there). Kept on this
// computer by flight number and day (chrome.storage `flightLive`), asked again only when the server's rule says
// it may have changed (shape.ts freshFor: a day while far, 15 minutes on the day, never once landed). Read
// where the board reads the records (withLive): a landing time the page didn't give is filled from it (the
// traveller's own, typed or said, still wins), and the line shows what's live.
import { freshFor, flightNumber, type FlightLive } from "../../supabase/functions/flight/shape";
import { L } from "./i18n";
import { isoDate } from "./items";
import { chromeKV, DEFAULT_SERVER, type KV } from "./share/store";
import type { Item } from "./types";

const LIVE_KEY = "flightLive";
type Stored = Record<string, { flight: FlightLive | null; at: number; prevGate?: string | null }>;

/**
 * The flight's data as the board reads it: AeroDataBox's, the gate it had before a change, and the ticket's
 * own times (what the page or the traveller said), to tell when the schedule differs.
 */
export type FlightSeen = FlightLive & { prevGate?: string | null; ticket?: { departure: string | null; arrival: string | null } };

/** The flight's number and day to ask for ("KL1577|2026-10-07"); null when it has neither. */
export function liveKey(item: Item): string | null {
  if (item.category !== "flight" || !item.flight) return null;
  const number = flightNumber(item.flight.flightNumber) ?? flightNumber(item.name.match(/\b([A-Z0-9]{2}\s?\d{2,4})\b/)?.[1]);
  const day = isoDate(item.flight.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  return number && day ? `${number}|${day}` : null;
}

export async function getLiveFlights(kv: KV = chromeKV): Promise<Stored> {
  return (await kv.get<Stored>(LIVE_KEY)) ?? {};
}

const clock = (iso: string | null | undefined) => iso?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;
const minutesBetween = (a: string | null | undefined, b: string | null | undefined) =>
  a && b ? Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 6e4) : 0;
/** How late it leaves, in minutes (0 when on time or not known). */
export const delayOf = (live: FlightLive): number => Math.max(minutesBetween(live.departure.scheduled, live.departure.revised), 0);
const LATE = 10;

/**
 * The record with its flight's real data beside it (flightLive). A landing the page didn't give is filled from
 * the schedule; on a late day the new times stand in (the plan moves with them); the traveller's own times,
 * typed or said, still win.
 */
export function withLive(item: Item, stored: Stored): Item {
  const key = liveKey(item);
  const entry = key ? stored[key] : undefined;
  const live = entry?.flight;
  if (!live || !item.flight) return item;
  const own = item.userEdits ?? {};
  const late = delayOf(live) >= LATE;
  const leaves = late ? live.departure.revised : (live.departure.scheduled ?? null);
  const lands = late ? (live.arrival.revised ?? live.arrival.scheduled) : (live.arrival.revised ?? live.arrival.scheduled);
  const hasHour = (iso: string | null) => !!iso && iso.length > 10;
  const flight = {
    ...item.flight,
    departure: own.time ? item.flight.departure : late || !hasHour(item.flight.departure) ? (leaves ?? item.flight.departure) : item.flight.departure,
    arrival: own.arrival ? item.flight.arrival : late || !item.flight.arrival ? (lands ?? item.flight.arrival) : item.flight.arrival,
  };
  const seen: FlightSeen = { ...live, prevGate: entry?.prevGate ?? null, ticket: { departure: item.flight.departure, arrival: item.flight.arrival } };
  return { ...item, flight, flightLive: seen };
}

/** The flights worth asking about: the ones with a ticket bought (booked), from two days ago to a year ahead. */
const wanted = (item: Item) => item.status === "booked" && liveKey(item) != null;

/**
 * Asks the server for the flights whose data may have changed (at most `max` at a time); true when something
 * new came. Quiet on failure: the board works without it.
 */
export async function refreshFlights(items: Item[], opts: { kv?: KV; now?: Date; fetcher?: typeof fetch; max?: number } = {}): Promise<boolean> {
  const kv = opts.kv ?? chromeKV;
  const now = opts.now ?? new Date();
  const get = opts.fetcher ?? fetch;
  const stored = await getLiveFlights(kv);
  const keys = [...new Set(items.filter(wanted).map(liveKey))].filter((k): k is string => !!k);
  const due = keys.filter((k) => {
    const had = stored[k];
    if (!had) return true;
    return (now.getTime() - had.at) / 6e4 >= freshFor(had.flight, k.split("|")[1], now);
  });
  let changed = false;
  for (const k of due.slice(0, opts.max ?? 8)) {
    const [number, day] = k.split("|");
    try {
      const res = await get(`${DEFAULT_SERVER.url}/functions/v1/flight?number=${encodeURIComponent(number)}&day=${day}`);
      if (!res.ok) continue;
      const body = (await res.json()) as { flight?: FlightLive | null };
      if (body.flight === undefined) continue;
      if (JSON.stringify(stored[k]?.flight ?? null) !== JSON.stringify(body.flight)) changed = true;
      const was = stored[k]?.flight?.departure.gate ?? null;
      const gate = body.flight?.departure.gate ?? null;
      stored[k] = { flight: body.flight, at: now.getTime(), prevGate: was && gate && was !== gate ? was : (stored[k]?.prevGate ?? null) };
    } catch {
      // offline or the server's down: asked again next time
    }
  }
  if (due.length) await kv.set(LIVE_KEY, stored);
  return changed;
}

export type TileIcon = "up" | "down" | "desk" | "gate" | "belt" | "term" | "alert";
/** A box on the flight's card: always something known ("Kapı · D5"), never a word for it ("Zamanında"). */
export interface FlightTile {
  icon: TileIcon;
  label: string;
  value: string;
  /** Beside the value, small: "+25 dk". */
  note?: string;
  tone?: "bad" | "ok";
}

/** Where the flight is: far off (no boxes), its day before take-off, in the air, landed, or off. */
export function phaseOf(live: FlightLive, now: Date = new Date()): "far" | "before" | "air" | "landed" | "canceled" | "diverted" {
  if (/^Canceled/.test(live.status)) return "canceled";
  if (live.status === "Diverted") return "diverted";
  // Local times read as UTC: hours off by the time zone at most, enough for "within a day".
  const hoursTo = (t: string | null) => (t ? (Date.parse(`${t}:00Z`) - now.getTime()) / 36e5 : Infinity);
  // By its status first: a runway time can be a forecast for a flight still days off (AeroDataBox fills it in
  // early), so it counts only once it's well in the past.
  if (live.status === "Arrived" || hoursTo(live.arrival.actual) < -4) return "landed";
  if (["Departed", "EnRoute", "Approaching"].includes(live.status) || hoursTo(live.departure.actual) < -4) return "air";
  const hours = hoursTo(live.departure.revised ?? live.departure.scheduled);
  return hours > 30 ? "far" : "before";
}

/** The boxes for where the flight is (only what's known; none while it's far off). */
export function flightTiles(live: FlightLive | null | undefined, now: Date = new Date()): FlightTile[] {
  if (!live) return [];
  const phase = phaseOf(live, now);
  const late = delayOf(live);
  const tiles: FlightTile[] = [];
  const at = (iso: string | null | undefined) => clock(iso);
  if (phase === "canceled") return [{ icon: "alert", label: L("Uçuş", "Flight"), value: L("İptal edildi", "Cancelled"), tone: "bad" }];
  if (phase === "diverted") return [{ icon: "alert", label: L("Uçuş", "Flight"), value: L("Başka yere indi", "Diverted"), tone: "bad" }];
  if (phase === "before") {
    const leaves = at(live.departure.revised ?? live.departure.scheduled);
    if (leaves)
      tiles.push(
        late >= LATE
          ? { icon: "up", label: L("Yeni kalkış", "New departure"), value: leaves, note: L(`+${late} dk`, `+${late} min`), tone: "bad" }
          : { icon: "up", label: L("Tahmini kalkış", "Expected departure"), value: leaves },
      );
    if (live.departure.desk) tiles.push({ icon: "desk", label: L("Check-in masası", "Check-in desks"), value: live.departure.desk.replace(/\s*-\s*/, "–") });
    if (live.departure.gate) {
      const prev = (live as FlightSeen).prevGate;
      tiles.push(prev ? { icon: "gate", label: L(`Kapı (${prev}'ti)`, `Gate (was ${prev})`), value: live.departure.gate, tone: "bad" } : { icon: "gate", label: L("Kapı", "Gate"), value: live.departure.gate });
    }
    if (late >= LATE && at(live.arrival.revised)) tiles.push({ icon: "down", label: L("Tahmini iniş", "Expected landing"), value: at(live.arrival.revised)! });
  } else if (phase === "air") {
    const left = at(live.departure.actual ?? live.departure.revised);
    if (left) tiles.push({ icon: "up", label: L("Kalktı", "Took off"), value: left });
    const lands = at(live.arrival.revised ?? live.arrival.scheduled);
    if (lands) tiles.push({ icon: "down", label: L("Tahmini iniş", "Expected landing"), value: lands });
  } else if (phase === "landed") {
    const landed = at(live.arrival.actual ?? live.arrival.revised ?? live.arrival.scheduled);
    if (landed) tiles.push({ icon: "down", label: L("İndi", "Landed"), value: landed, tone: "ok" });
    if (live.arrival.belt) tiles.push({ icon: "belt", label: L("Bagaj bandı", "Baggage belt"), value: live.arrival.belt });
    if (live.arrival.terminal) tiles.push({ icon: "term", label: L("Varış terminali", "Arrival terminal"), value: live.arrival.terminal });
  }
  return tiles;
}

/** The card goes red: late, cancelled or diverted. */
export const flightAlert = (live: FlightLive | null | undefined, now: Date = new Date()): boolean =>
  !!live && (["canceled", "diverted"].includes(phaseOf(live, now)) || (phaseOf(live, now) === "before" && delayOf(live) >= LATE));

/** "Biletinde iniş 22:05, tarifede 22:15": the ticket's time against the schedule's (5 minutes or more apart). */
export function ticketDiff(live: FlightSeen | null | undefined): string | null {
  if (!live?.ticket) return null;
  const off = (ticket: string | null, schedule: string | null) => (ticket && schedule && clock(ticket) && clock(schedule) && Math.abs(minutesBetween(ticket, schedule)) >= 5 ? [clock(ticket)!, clock(schedule)!] : null);
  const dep = off(live.ticket.departure, live.departure.scheduled);
  if (dep) return L(`Biletinde kalkış ${dep[0]}, tarifede ${dep[1]}`, `Your ticket says ${dep[0]} out, the schedule ${dep[1]}`);
  const arr = off(live.ticket.arrival, live.arrival.scheduled);
  if (arr) return L(`Biletinde iniş ${arr[0]}, tarifede ${arr[1]}`, `Your ticket says ${arr[0]} in, the schedule ${arr[1]}`);
  return null;
}

/** "AeroDataBox · 2 dk önce" (the free plan asks for the source). */
export function sourceText(live: FlightLive, now: Date = new Date()): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(live.fetchedAt)) / 6e4));
  const ago = !Number.isFinite(min) ? "" : min < 1 ? L(" · az önce", " · just now") : min < 60 ? L(` · ${min} dk önce`, ` · ${min} min ago`) : "";
  return `AeroDataBox${ago}`;
}

/** The day view's line under the flight: its boxes in words ("Tahmini kalkış 20:30 · Kapı D5"). */
export function liveLine(live: FlightLive | null | undefined, now: Date = new Date()): { text: string; alert: boolean } | null {
  const tiles = flightTiles(live, now);
  if (!tiles.length) return null;
  return { text: tiles.map((t) => `${t.label} ${t.value}${t.note ? ` (${t.note})` : ""}`).join(" · "), alert: flightAlert(live, now) };
}
