// What a card says only when it's time to (plan v30): a booking code waits for the flight's day, a cancel date that is far
// off isn't a worry, a refusal of refunds isn't news once it's paid. Prices, times and real warnings are never hidden here:
// only reminders and numbers wait for their moment. Pure.
import { L } from "./i18n";
import { formatDateRange, isoDate, nightsBetween } from "./items";
import type { Item } from "./types";

/** A flight's PNR shows from the day before it leaves; a card that isn't a flight shows its reference when asked for (its window). */
export const PNR_DAYS = 1;

/** The day the thing starts (a flight leaves, a stay's check-in, a ticket's day); null when no day is known. */
export function startDay(item: Pick<Item, "dates" | "flight">): string | null {
  return isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
}

/** Days from `today` to the start (negative once it has begun); null without a day. */
export function daysToStart(item: Pick<Item, "dates" | "flight">, today: string): number | null {
  const day = startDay(item);
  return day ? nightsBetween(today, day) : null;
}

/** The booking code on a flight's stub: from the day before the flight, else not (a trip without a date shows it: nothing to wait for). */
export function showBookingRef(item: Pick<Item, "dates" | "flight">, today: string): boolean {
  const d = daysToStart(item, today);
  return d == null || d <= PNR_DAYS;
}

export interface CancelLine {
  tone: "ok" | "no";
  text: string;
}

// [iİ]: the dotted capital İ doesn't case-fold to i in a regex ("İade yok").
const NO_REFUND = /[iİ]ade\s*(yok|edilmez)|[iİ]ptal\s*edilemez|non[-\s]?refundable|no refund|not refundable/i;

/**
 * The cancel line of a card that's still a decision (an option or a plan not bought): free until a date (green), or no
 * refund (red). A booking has none here: its alert (progress.dateAlert) speaks in its last two weeks.
 */
export function cancelLineOf(item: Pick<Item, "status" | "cancellation" | "refundNote">, today: string): CancelLine | null {
  if (item.status === "booked") return null;
  const until = isoDate(item.cancellation.freeUntil);
  if (until && until >= today) return { tone: "ok", text: L(`Ücretsiz iptal · ${formatDateRange(until, null)}'e kadar`, `Free cancellation until ${formatDateRange(until, null)}`) };
  const said = [item.cancellation.summary, item.refundNote].filter(Boolean).join(" ");
  if (!until && NO_REFUND.test(said)) return { tone: "no", text: L("İade yok", "Non-refundable") };
  return null;
}
