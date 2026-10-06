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
type Stored = Record<string, { flight: FlightLive | null; at: number }>;

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

/** The record with its flight's real data beside it, and its landing filled when the page didn't say it. */
export function withLive(item: Item, stored: Stored): Item {
  const key = liveKey(item);
  const live = key ? stored[key]?.flight : undefined;
  if (!live || !item.flight) return item;
  const lands = live.arrival.revised ?? live.arrival.scheduled;
  const leaves = live.departure.scheduled;
  const flight = {
    ...item.flight,
    arrival: item.flight.arrival ?? lands,
    // A departure read without its hour ("2026-10-07") gets the schedule's.
    departure: item.flight.departure && item.flight.departure.length > 10 ? item.flight.departure : (leaves ?? item.flight.departure),
  };
  return { ...item, flight, flightLive: live };
}

/** The flights worth asking about: on the plan (booked or chosen), from two days ago to a year ahead. */
const wanted = (item: Item) => (item.status === "booked" || item.status === "chosen") && liveKey(item) != null;

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
      stored[k] = { flight: body.flight, at: now.getTime() };
    } catch {
      // offline or the server's down: asked again next time
    }
  }
  if (due.length) await kv.set(LIVE_KEY, stored);
  return changed;
}

const STATUS: Record<string, readonly [string, string]> = {
  CheckIn: ["Check-in açık", "Check-in open"],
  Boarding: ["Biniş başladı", "Boarding"],
  GateClosed: ["Kapı kapandı", "Gate closed"],
  Departed: ["Kalktı", "Departed"],
  EnRoute: ["Yolda", "En route"],
  Approaching: ["İnişe geçiyor", "Approaching"],
  Arrived: ["İndi", "Landed"],
  Delayed: ["Rötarlı", "Delayed"],
  Canceled: ["İptal edildi", "Cancelled"],
  CanceledUncertain: ["İptal olabilir", "May be cancelled"],
  Diverted: ["Başka havalimanına yönlendirildi", "Diverted"],
};

const minutes = (a: string | null, b: string | null) => (a && b ? Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 6e4) : 0);

/**
 * What the flight's line says live: "Rötar 25 dk · Terminal 1 · Kapı D5 · Bant 4" (only what's known; the
 * status when it's more than "as planned"). `alert`: cancelled, diverted or late.
 */
export function liveLine(live: FlightLive | null | undefined): { text: string; alert: boolean } | null {
  if (!live) return null;
  const late = Math.max(minutes(live.departure.scheduled, live.departure.revised), 0);
  const status = STATUS[live.status];
  const parts = [
    // "Rötarlı" says nothing more than "Rötar 25 dk".
    status && !(live.status === "Delayed" && late >= 10) ? L(status[0], status[1]) : null,
    late >= 10 ? L(`Rötar ${late} dk`, `${late} min late`) : null,
    live.departure.terminal ? L(`Terminal ${live.departure.terminal}`, `Terminal ${live.departure.terminal}`) : null,
    live.departure.gate ? L(`Kapı ${live.departure.gate}`, `Gate ${live.departure.gate}`) : null,
    live.arrival.belt ? L(`Bant ${live.arrival.belt}`, `Belt ${live.arrival.belt}`) : null,
  ].filter((p): p is string => !!p);
  if (!parts.length) return null;
  return { text: parts.join(" · "), alert: late >= 10 || ["Canceled", "CanceledUncertain", "Diverted", "Delayed"].includes(live.status) };
}
