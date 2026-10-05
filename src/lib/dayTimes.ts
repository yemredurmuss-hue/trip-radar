// The day's times, worked out from what is fixed (spec docs/superpowers/specs/2026-10-05-akilli-saat-design.md).
// A ticket's time, a booking's, or one the traveller set stays as it is; from them: leave for the airport an
// hour before being there, check out before leaving, out of the airport 45 minutes after landing, check in an
// hour after. A time the traveller sets is fixed too and the rest follow it. Computed times are never stored
// (they're worked out again on every view, so a changed flight moves them); one that can't be worked out
// safely (it would cross midnight) is left empty rather than wrong. Pure.
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

const isCheck = (r: DayRow, word: "Check-in" | "Check-out") => r.kind === "info" && r.title === word && !!r.stayKey;
const hubWord = (r: DayRow) => (r.leg?.via === "flight" ? L("havalimanında", "at the airport") : L("istasyonda", "at the station"));

/**
 * The rows with their times worked out. Each changed row gets `estimated` (written "~"), `why` (the reason,
 * shown on hover) and, when the traveller's own time doesn't leave room, `warn`.
 */
export function applyDayTimes(rows: DayRow[], overrides: DayTimeOverrides = {}): DayRow[] {
  const out = rows.map((r) => ({ ...r }));
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
  if (leaving && isClock(by)) {
    if (!leaving.user) {
      const go = shift(by, -TRANSFER_MINUTES);
      Object.assign(leaving, {
        time: go,
        estimated: go != null,
        why: go
          ? L(`En geç ${by} ${hubWord(leaving)} olmalısın; transfer ~1 sa`, `Be ${hubWord(leaving)} by ${by}; the transfer takes ~1 h`)
          : null,
      });
    } else if (isClock(leaving.time) && toMin(leaving.time) + TRANSFER_MINUTES > toMin(by)) {
      leaving.warn = L(`${by}'da ${hubWord(leaving)} olmalısın: bu saatle geç kalabilirsin.`, `You need to be ${hubWord(leaving)} by ${by}: this may be too late.`);
    }
  }
  // Check out before leaving (and never after it).
  if (checkout && !checkout.user && leaving && isClock(leaving.time)) {
    const latest = shift(leaving.time, -CHECKOUT_LEAD_MINUTES);
    if (latest && (!isClock(checkout.time) || toMin(latest) < toMin(checkout.time))) {
      Object.assign(checkout, { time: latest, estimated: true, why: L(`Yola çıkış ${leaving.time}: ondan önce çıkış`, `Leaving at ${leaving.time}: check out before`) });
    }
  }
  // Off the plane: out of the airport 45 minutes after landing (the transfer then).
  const landed = landing?.leg?.after;
  if (landing && !landing.user && isClock(landed)) {
    const outAt = shift(landed, landing.leg?.via === "flight" ? LANDING_EXIT_MINUTES : 10);
    Object.assign(landing, {
      time: outAt,
      estimated: outAt != null,
      why: outAt ? L(`Varış ${landed}; çıkış ~${landing.leg?.via === "flight" ? 45 : 10} dk`, `Arrives ${landed}; out in ~${landing.leg?.via === "flight" ? 45 : 10} min`) : null,
    });
  }
  // Check in once there: the transfer's time plus an hour, not before the room is ready.
  if (checkin && !checkin.user && landing && isClock(landing.time)) {
    const there = shift(landing.time, TRANSFER_MINUTES);
    if (there && (!isClock(checkin.time) || toMin(there) > toMin(checkin.time))) {
      Object.assign(checkin, { time: there, estimated: true, why: L(`Transfer ${landing.time} + ~1 sa`, `Transfer ${landing.time} + ~1 h`) });
    }
  }
  return out;
}
