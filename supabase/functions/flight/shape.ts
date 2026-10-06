// Trip Radar uçuş verisi (0.36.15), kept free of Deno and Supabase so it's tested with the extension's own tests:
// what may be asked (a flight number and a day), AeroDataBox's answer as the extension reads it, and how long
// a cached answer stays good (a day while the flight is far, minutes on its day, for good once it's landed).

/** "KL 1577", "kl1577" → "KL1577"; null when it isn't a flight number. */
export function flightNumber(raw: string | null | undefined): string | null {
  const s = (raw ?? "").replace(/\s+/g, "").toUpperCase();
  return /^[A-Z0-9]{2}[A-Z]?\d{1,4}[A-Z]?$/.test(s) && /\d/.test(s.slice(2)) ? s : null;
}

/** A day the subscription can answer for: from two days ago to a year ahead. */
export function askableDay(day: string | null | undefined, now: Date): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  const days = (t - now.getTime()) / 864e5;
  return days >= -2 && days <= 365 ? day : null;
}

export interface FlightEnd {
  iata: string | null;
  airport: string | null;
  /** Local times, "YYYY-MM-DDTHH:MM" (the airport's own clock). */
  scheduled: string | null;
  revised: string | null;
  actual: string | null;
  terminal: string | null;
  gate: string | null;
}
export interface FlightLive {
  number: string;
  airline: string | null;
  /** AeroDataBox's word: Expected, CheckIn, Boarding, GateClosed, Departed, EnRoute, Approaching, Arrived, Delayed, Canceled, Diverted, Unknown. */
  status: string;
  /** `desk`: the check-in desks ("12-16"), when the airport gives them. */
  departure: FlightEnd & { desk?: string | null };
  arrival: FlightEnd & { belt: string | null };
  fetchedAt: string;
}

type Raw = Record<string, any>;
/** "2026-10-07 20:30+02:00" → "2026-10-07T20:30". */
const local = (t: Raw | undefined): string | null => {
  const m = typeof t?.local === "string" ? t.local.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/) : null;
  return m ? `${m[1]}T${m[2]}` : null;
};
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const end = (e: Raw | undefined): FlightEnd => ({
  iata: text(e?.airport?.iata),
  airport: text(e?.airport?.shortName) ?? text(e?.airport?.name),
  scheduled: local(e?.scheduledTime),
  revised: local(e?.revisedTime) ?? local(e?.predictedTime),
  actual: local(e?.runwayTime),
  terminal: text(e?.terminal),
  gate: text(e?.gate),
});

/** The flight in AeroDataBox's answer (the operating one, not a codeshare); null when there's none. */
export function shapeFlight(answer: unknown, number: string, fetchedAt: string): FlightLive | null {
  const list = (Array.isArray(answer) ? answer : []) as Raw[];
  const f = list.find((x) => x?.codeshareStatus !== "IsCodeshared") ?? list[0];
  if (!f) return null;
  return {
    number,
    airline: text(f.airline?.name),
    status: text(f.status) ?? "Unknown",
    departure: { ...end(f.departure), desk: text(f.departure?.checkInDesk) },
    arrival: { ...end(f.arrival), belt: text(f.arrival?.baggageBelt) },
    fetchedAt,
  };
}

/**
 * How long an answer stays good, in minutes: a day while the flight is more than two days off, three hours
 * before that, 15 minutes from three hours before take-off until it's landed, and for good once landed.
 */
export function freshFor(data: FlightLive | null, day: string, now: Date): number {
  const dep = data?.departure.revised ?? data?.departure.scheduled ?? `${day}T12:00`;
  const hoursOff = (Date.parse(`${dep}:00Z`) - now.getTime()) / 36e5; // local times read as UTC: hours, roughly
  if (data && (data.status === "Arrived" || data.arrival.actual)) return Infinity;
  if (data?.status === "Canceled") return Infinity;
  if (hoursOff > 48) return 24 * 60;
  if (hoursOff > 3) return 180;
  if (hoursOff > -24) return 15;
  return Infinity;
}
