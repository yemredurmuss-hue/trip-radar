// What a card says only when it's time to (plan v30): a booking code waits for the flight's day, a cancel date that is far
// off isn't a worry, a refusal of refunds isn't news once it's paid. Prices, times and real warnings are never hidden here:
// only reminders and numbers wait for their moment. Pure.
import { L } from "./i18n";
import { formatDateRange, isoDate, nightsBetween } from "./items";
import type { Item } from "./types";

/** A flight's PNR shows on the day it leaves (v30, "Zamana göre gösterme"); before that the stub says "Rezerve · toplam". Its window has it any day. */
export const PNR_DAYS = 0;

/** A stay's check-in time joins the card's foot this many days before the stay; before that the card says "✓ Rezerve". */
export const CHECKIN_DAYS = 2;

/** A cancel date this close turns amber (decision cards, v30); closer than the second one, orange-red; its last day, red. */
export const CANCEL_SOON_DAYS = 14;
export const CANCEL_NEAR_DAYS = 7;

/** The day the thing starts (a flight leaves, a stay's check-in, a ticket's day); null when no day is known. */
export function startDay(item: Pick<Item, "dates" | "flight">): string | null {
  return isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
}

/** Days from `today` to the start (negative once it has begun); null without a day. */
export function daysToStart(item: Pick<Item, "dates" | "flight">, today: string): number | null {
  const day = startDay(item);
  return day ? nightsBetween(today, day) : null;
}

/** The booking code on a flight's stub: on the flight's day and after, else not (a trip without a date shows it: nothing to wait for). */
export function showBookingRef(item: Pick<Item, "dates" | "flight">, today: string): boolean {
  const d = daysToStart(item, today);
  return d == null || d <= PNR_DAYS;
}

export interface CancelLine {
  /** ok: green, far; soon: amber, within 14 days; near: orange-red, within 7; red: its last day; no: refused. */
  tone: "ok" | "soon" | "near" | "red" | "no";
  text: string;
}

// [iİ]: the dotted capital İ doesn't case-fold to i in a regex ("İade yok").
const NO_REFUND = /[iİ]ade\s*(yok|edilmez)|[iİ]ptal\s*edilemez|non[-\s]?refundable|no refund|not refundable/i;

/**
 * The cancel line of a card that's still a decision (an option or a plan not bought), always there while the date
 * stands: free until a date (green; amber within 14 days, orange-red within 7 with the days left, red on the last
 * day), or no refund (red). A booking has none here: its alert (progress.dateAlert) speaks in its last two weeks.
 */
export function cancelLineOf(item: Pick<Item, "status" | "cancellation" | "refundNote">, today: string): CancelLine | null {
  if (item.status === "booked") return null;
  const until = isoDate(item.cancellation.freeUntil);
  if (until && until >= today) {
    const days = nightsBetween(today, until);
    const date = formatDateRange(until, null);
    if (days === 0) return { tone: "red", text: L("İptal bugün biter", "Cancellation ends today") };
    if (days <= CANCEL_NEAR_DAYS) return { tone: "near", text: L(`İptale ${days} gün · son gün ${date}`, `${days} day${days === 1 ? "" : "s"} to cancel · last day ${date}`) };
    return { tone: days <= CANCEL_SOON_DAYS ? "soon" : "ok", text: L(`Ücretsiz iptal · ${date}'e kadar`, `Free cancellation until ${date}`) };
  }
  const said = [item.cancellation.summary, item.refundNote].filter(Boolean).join(" ");
  if (!until && NO_REFUND.test(said)) return { tone: "no", text: L("İade yok", "Non-refundable") };
  return null;
}

/** The time a stay's check-in opens, "15:00", when the record knows it (the page's rules, or a time on the first night); never guessed. */
export function checkInTimeOf(item: Pick<Item, "dates">, house?: { checkInFrom?: string | null } | null): string | null {
  const given = house?.checkInFrom?.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (given) return `${given[1].padStart(2, "0")}:${given[2]}`;
  const own = item.dates.start?.match(/T([01]\d|2[0-3]):([0-5]\d)/);
  return own ? `${own[1]}:${own[2]}` : null;
}

/**
 * A booked stay's foot, two days before it begins (and while it lasts): "Giriş saati 15:00". Before that, and
 * when the record has no check-in time, nothing: the card just says "✓ Rezerve".
 */
export function checkInNote(item: Pick<Item, "dates" | "flight" | "status">, today: string, house?: { checkInFrom?: string | null } | null): string | null {
  if (item.status !== "booked") return null;
  const d = daysToStart(item, today);
  if (d == null || d > CHECKIN_DAYS) return null;
  const end = isoDate(item.dates.end);
  if (end && end < today) return null;
  const at = checkInTimeOf(item, house);
  return at ? L(`Giriş saati ${at}`, `Check-in from ${at}`) : null;
}
