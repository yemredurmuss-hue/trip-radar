// The day's times, worked out from what is fixed (spec docs/superpowers/specs/2026-10-05-akilli-saat-design.md).
// A ticket's time, a booking's, or one the traveller set stays as it is; from them: leave for the airport an
// hour before being there, check out before leaving, out of the airport 45 minutes after landing, check in an
// hour after. A time the traveller sets is fixed too and the rest follow it. Computed times are never stored
// (they're worked out again on every view, so a changed flight moves them); one that can't be worked out
// safely is left without a clock rather than wrong (0.36.13): past midnight it says "gece ~00:45", and a
// check-in after a flight whose landing isn't known says "inişten sonra", never the hotel's usual 15:00
// while the traveller is still in the air. Pure.
import { L } from "./i18n";
import type { DayRow } from "./journey";

/** Leaving for the airport or station: this long before being there, unless the traveller says otherwise. */
export const TRANSFER_MINUTES = 60;
/** Off the plane, through passport control and baggage, out of the airport. */
export const LANDING_EXIT_MINUTES = 45;
/** Checked out this long before leaving. */
export const CHECKOUT_LEAD_MINUTES = 15;

/** The traveller's own times, by row key ("HH:MM"). */
export type DayTimeOverrides = Record<string, string>;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toClock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** A time moved by some minutes; null when it would leave the day (safer empty than on the wrong day). */
const shift = (t: string, by: number): string | null => {
  const m = toMin(t) + by;
  return m >= 0 && m < 24 * 60 ? toClock(m) : null;
};
const isClock = (t: string | null | undefined): t is string => !!t && /^\d{2}:\d{2}$/.test(t);

/**
 * A time with its Turkish locative, as it's read aloud: "22:15'te" (on beş), "20:30'da" (otuz), "09:00'da"
 * (dokuz). The last number said picks the suffix: the minutes, or the hour when they're 00.
 */
export function clockAt(t: string): string {
  const [h, m] = [Number(t.slice(0, 2)), Number(t.slice(3, 5))];
  const n = m || h;
  const units = ["da", "de", "de", "te", "te", "te", "da", "de", "de", "da"];
  const tens: Record<number, string> = { 0: "da", 10: "da", 20: "de", 30: "da", 40: "ta", 50: "de" };
  return `${t}'${n % 10 ? units[n % 10] : tens[n % 100 >= 60 ? 0 : n % 100] ?? "da"}`;
}

/** Minutes on, past midnight too (for "gece ~00:45"). */
const wrap = (t: string, by: number) => toClock((((toMin(t) + by) % 1440) + 1440) % 1440);
const clockOf = (iso: string | null | undefined) => iso?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;

const isCheck = (r: DayRow, word: "Check-in" | "Check-out") => r.kind === "info" && r.title === word && !!r.stayKey;
const hubWord = (r: DayRow) => (r.leg?.via === "flight" ? L("havalimanında", "at the airport") : L("istasyonda", "at the station"));

/**
 * The rows with their times worked out. Each changed row gets `estimated` (written "~"), `why` (the reason,
 * shown on hover) and, when the traveller's own time doesn't leave room, `warn`.
 */
export function applyDayTimes(rows: DayRow[], overrides: DayTimeOverrides = {}): DayRow[] {
  const out = rows.map((r) => ({ ...r }));
  // Each line's own time before the traveller's (a check-in set before landing goes back to it, below).
  const planned = new Map(out.map((r) => [r.key, r.time]));
  for (const r of out) {
    const own = overrides[r.key];
    if (isClock(own)) Object.assign(r, { time: own, estimated: false, user: true, why: L("Senin saatin", "Your time") });
  }
  const leaving = out.find((r) => r.kind === "leg" && r.leg?.kind === "departure");
  const landing = out.find((r) => r.kind === "leg" && r.leg?.kind === "arrival");
  const checkout = out.find((r) => isCheck(r, "Check-out"));
  const checkin = out.find((r) => isCheck(r, "Check-in"));

  // To the airport or station: an hour before being there.
  const by = leaving?.leg?.before;
  // A transfer with its own time (the chosen one's, "06:15 evden çıkış") keeps it, like one set by hand.
  const ownLeave = !!leaving && !leaving.user && isClock(leaving.leg?.at);
  // The ideal (`before`) sets the worked-out time; only past the latest (`latest`, a flight's hour less) is it too late.
  const latest = isClock(leaving?.leg?.latest) ? leaving!.leg!.latest! : by;
  if (leaving && isClock(by)) {
    if (!leaving.user && !ownLeave) {
      const go = shift(by, -TRANSFER_MINUTES);
      const ideal = latest && latest !== by;
      Object.assign(leaving, {
        time: go,
        estimated: go != null,
        why: go
          ? ideal
            ? L(`İdeali ${by}, en geç ${latest} ${hubWord(leaving)}; transfer ~1 sa`, `${hubWord(leaving)} ideally by ${by}, at the latest ${latest}; the transfer takes ~1 h`)
            : L(`En geç ${by} ${hubWord(leaving)} olmalısın; transfer ~1 sa`, `Be ${hubWord(leaving)} by ${by}; the transfer takes ~1 h`)
          : null,
      });
    } else if (isClock(leaving.time) && isClock(latest) && toMin(leaving.time) + TRANSFER_MINUTES > toMin(latest)) {
      leaving.warn = L(`${clockAt(latest)} ${hubWord(leaving)} olmalısın: bu saatle geç kalabilirsin.`, `You need to be ${hubWord(leaving)} by ${latest}: this may be too late.`);
    }
  }
  // Check out before leaving (and never after it).
  if (checkout && !checkout.user && leaving && isClock(leaving.time)) {
    const latest = shift(leaving.time, -CHECKOUT_LEAD_MINUTES);
    if (latest && (!isClock(checkout.time) || toMin(latest) < toMin(checkout.time))) {
      Object.assign(checkout, { time: latest, estimated: true, why: L(`Yola çıkış ${leaving.time}: ondan önce çıkış`, `Leaving at ${leaving.time}: check out before`) });
    }
  }
  // The trip in (the day's last flight or train with a time): what's after it can't come before it.
  const trips = out.filter((r) => r.kind === "travel" && isClock(r.time));
  const inbound = trips.length ? trips.reduce((a, b) => (toMin(b.time!) >= toMin(a.time!) ? b : a)) : null;
  // Its ticket: the one settled on, or the only option (whose time the line shows, journey.ts travelStep).
  const travel = inbound?.entry?.kind === "travel" ? inbound.entry.travel : null;
  const ticket = travel?.settled ?? (travel?.items.length === 1 ? travel.items[0] : null);
  // Off the plane: the transfer's "after" (the flight's local arrival), else the inbound ticket's own.
  const ticketLands = clockOf(ticket?.flight?.arrival);
  const overnight = !!ticket?.flight?.arrival && !!ticket.flight.departure && ticket.flight.arrival.slice(0, 10) > ticket.flight.departure.slice(0, 10);
  const landed = isClock(landing?.leg?.after) ? landing!.leg!.after! : ticketLands;
  const byAir = landing ? landing.leg?.via === "flight" : !!ticket?.flight;
  const exitMin = byAir ? LANDING_EXIT_MINUTES : 10;
  // Out of the airport 45 minutes after landing (the transfer then); past midnight, said in words.
  if (landing && !landing.user && !isClock(landing.leg?.at) && isClock(landed)) {
    const outAt = overnight ? null : shift(landed, exitMin);
    Object.assign(landing, {
      time: outAt,
      estimated: outAt != null,
      hint: outAt ? landing.hint : L(`gece ~${wrap(landed, exitMin)}`, `night ~${wrap(landed, exitMin)}`),
      why: L(`Varış ${landed}; çıkış ~${exitMin} dk`, `Arrives ${landed}; out in ~${exitMin} min`),
    });
  }
  // A check-in set by hand before the flight in lands can't be (0.36.30, Emre's 15:00 on a 22:15 landing): the
  // line goes by the landing again, at its place in the day, saying the time set by hand was put aside
  // (`ownTime`: "Elle girileni sil" takes it away for good).
  if (checkin?.user && isClock(checkin.time) && isClock(landed) && (overnight || toMin(checkin.time) < toMin(landed))) {
    const own = checkin.time;
    Object.assign(checkin, { time: planned.get(checkin.key) ?? null, user: false, estimated: false, why: null, ownTime: own });
    checkin.warn = L(
      `Elle girilen ${own} inişten (${landed}) önceydi; check-in inişe göre gösteriliyor.`,
      `The ${own} set by hand was before landing (${landed}); check-in goes by the landing.`,
    );
  } else if (checkin?.user && isClock(checkin.time) && !isClock(landed) && inbound && toMin(checkin.time) < toMin(inbound.time!)) {
    checkin.warn = L(`${inbound.time} yolculuğundan önce check-in olamaz.`, `Checking in before the ${inbound.time} trip can't be.`);
  }
  // Check in once there: out of the airport plus an hour, not before the room is ready.
  if (checkin && !checkin.user) {
    const outAt = landing && isClock(landing.time) ? landing.time : isClock(landed) && !overnight ? shift(landed, exitMin) : null;
    const there = outAt ? shift(outAt, TRANSFER_MINUTES) : null;
    if (there) {
      if (!isClock(checkin.time) || toMin(there) > toMin(checkin.time)) {
        const from = byAir ? L("Havalimanından", "Out of the airport") : L("İstasyondan", "Out of the station");
        Object.assign(checkin, { time: there, estimated: true, hint: null, why: L(`${from} çıkış ${outAt} + yol ~1 sa`, `${from} ${outAt} + ~1 h on the way`) });
      }
    } else if (isClock(landed)) {
      // Landing late: after midnight once there.
      const at = wrap(landed, exitMin + TRANSFER_MINUTES);
      Object.assign(checkin, {
        time: null,
        estimated: false,
        hint: L(`gece ~${at}`, `night ~${at}`),
        why: L(`Varış ${landed}; çıkış ~${exitMin} dk + yol ~1 sa: gece yarısından sonra. Geç girişi otelle ayarla.`, `Arriving ${landed}; ~${exitMin} min out + ~1 h on the way: after midnight. Arrange a late check-in.`),
      });
    } else if (inbound) {
      // The trip in has no arrival time: the hotel's hour would be a guess (15:00 while still in the air).
      Object.assign(checkin, {
        time: null,
        estimated: false,
        hint: L("varıştan sonra", "after arriving"),
        why: L(`${inbound.time} yolculuğunun varış saati yok; girince check-in hesaplanır.`, `The ${inbound.time} trip has no arrival time; add it and the check-in is worked out.`),
      });
    }
  }
  return out;
}
