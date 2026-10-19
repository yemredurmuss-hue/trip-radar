// The trip's dates moved in the chat ("10 Aralık'tan 10 Ocak'a kaydır", update_trip): the records whose days came
// from the trip's own dates move with it, so the board, the searches and the hero read one range. Pure.
//
// What moves: a record not booked, with a day, whose day nobody chose for it (the start's places to fill, a plan said
// in the chat): no date the traveller corrected (dates.source "user", userEdits), no saved page's own dates. Each day
// moves by as much as the start did; a day on the trip's last day stays on its last day (the flight home, the last
// stop's check-out, a rental's return), so the stops keep their nights and only the last stop's change with the
// length. A booked record never moves: the chat says so, the traveller checks the booking.
import { L } from "./i18n";
import { formatDateRange, isoDate, nightsBetween } from "./items";
import { addDays } from "./plan";
import { isPlaceholder, placeholderPrint } from "./startTrip";
import type { Item, Suggestion, Trip } from "./types";

type Range = { start: string; end: string };

export interface TripShift {
  dates: Range;
  /** How many days the start moved (negative: earlier). */
  days: number;
  /** The records that moved, as they are now. */
  moved: Item[];
  /** The start's places to fill among them, with what they say now (they stay places to fill). */
  prints: Record<string, string>;
  /** Booked records with a day: never moved. */
  booked: Item[];
  /** Records on their own dates (a saved page's, a day the traveller corrected): not moved. */
  own: Item[];
  /** The trip's suggestions with the open ones' days moved; null when none had a day. */
  suggestions: Suggestion[] | null;
}

const userDated = (i: Item) => i.dates.source === "user" || i.userEdits?.start != null || i.userEdits?.end != null;
/** Its days came from the trip: a place the start made, or a plan said or added by hand (no page behind it). */
const fromTrip = (trip: Pick<Trip, "startGuide">, i: Item) => isPlaceholder(trip, i) || i.origin === "chat" || !i.url;

/** The day a date moves to: as far as the start moved, the trip's last day kept its last day. */
function mover(from: Range, to: Range): (date: string) => string {
  const days = nightsBetween(from.start, to.start);
  return (date) => {
    if (date === from.end) return to.end;
    const next = addDays(date, days);
    return next < to.start ? to.start : next > to.end ? to.end : next;
  };
}

/** "2026-12-01T10:30" moved by `days`, its clock kept; an unreadable one as it was. */
function shiftStamp(stamp: string | null, days: number): string | null {
  const day = isoDate(stamp?.slice(0, 10));
  return stamp && day && days ? addDays(day, days) + stamp.slice(10) : stamp;
}

function moved(item: Item, move: (date: string) => string): Item {
  const start = item.dates.start!;
  const nextStart = move(start);
  let nextEnd = item.dates.end ? move(item.dates.end) : item.dates.end;
  // A stay squeezed past the new end keeps one night rather than none.
  if (nextEnd && nextEnd <= nextStart && item.dates.end! > start) nextEnd = addDays(nextStart, 1);
  const by = nightsBetween(start, nextStart);
  const flight = item.flight ? { ...item.flight, departure: shiftStamp(item.flight.departure, by), arrival: shiftStamp(item.flight.arrival, by) } : item.flight;
  return { ...item, dates: { ...item.dates, start: nextStart, end: nextEnd }, flight };
}

/**
 * The trip moved from its confirmed dates to `dates`: the records and open suggestions that follow it, moved, and the
 * ones that don't. Nothing moves for a trip that had no dates (startTrip.datePlaceholders dates those).
 */
export function shiftTrip(trip: Pick<Trip, "confirmedDates" | "startGuide" | "suggestions">, items: Item[], dates: Range): TripShift {
  const from = trip.confirmedDates;
  const out: TripShift = { dates, days: 0, moved: [], prints: {}, booked: [], own: [], suggestions: null };
  if (!from || (from.start === dates.start && from.end === dates.end)) return out;
  out.days = nightsBetween(from.start, dates.start);
  const move = mover(from, dates);
  for (const item of items) {
    if (item.status === "dismissed" || item.cancelledAt || !isoDate(item.dates.start)) continue;
    if (item.status === "booked") out.booked.push(item);
    else if (userDated(item) || !fromTrip(trip, item)) out.own.push(item);
    else {
      const next = moved(item, move);
      if (next.dates.start === item.dates.start && next.dates.end === item.dates.end) continue;
      out.moved.push(next);
      if (isPlaceholder(trip, item)) out.prints[item.id] = placeholderPrint(next);
    }
  }
  const dayOf = (d: string | null | undefined) => (d && isoDate(d) ? move(d) : d);
  const open = (trip.suggestions ?? []).filter((s) => s.state === "open" && (isoDate(s.payload?.start) || isoDate(s.payload?.end)));
  if (open.length) {
    out.suggestions = (trip.suggestions ?? []).map((s) =>
      open.includes(s) && s.payload ? { ...s, payload: { ...s.payload, start: dayOf(s.payload.start), end: dayOf(s.payload.end) } } : s,
    );
  }
  return out;
}

const kindWord = (list: Item[]) =>
  list.every((i) => i.category === "flight")
    ? L("uçuş", list.length === 1 ? "flight" : "flights")
    : list.every((i) => i.category === "stay")
      ? L("konaklama", list.length === 1 ? "stay" : "stays")
      : L("kayıt", list.length === 1 ? "record" : "records");

/**
 * What the shift really did, for the chat's reply: "Gezi 10 Aralık – 10 Ocak. 6 kayıt kaydı. 1 alınmış uçuş
 * değişmedi, tarihini kontrol et: Bodrum → Bali." Only what moved and what didn't, never more.
 */
export function shiftText(shift: TripShift): string {
  const parts = [L(`Gezi ${formatDateRange(shift.dates.start, shift.dates.end)}.`, `The trip is ${formatDateRange(shift.dates.start, shift.dates.end)}.`)];
  const n = shift.moved.length;
  if (n) parts.push(L(`${n} kayıt yeni tarihlere kaydı.`, `${n} record${n === 1 ? "" : "s"} moved to the new dates.`));
  else parts.push(L("Kaydırılacak kayıt yoktu.", "There was no record to move."));
  const names = (list: Item[]) => list.map((i) => i.name).join(", ");
  if (shift.booked.length) {
    const b = shift.booked.length;
    parts.push(L(`${b} alınmış ${kindWord(shift.booked)} değişmedi, tarihini kontrol et: ${names(shift.booked)}.`, `${b} booked ${kindWord(shift.booked)} didn't change; check ${b === 1 ? "its" : "their"} date: ${names(shift.booked)}.`));
  }
  if (shift.own.length) {
    const o = shift.own.length;
    parts.push(L(`${o} kayıt kendi tarihinde kaldı: ${names(shift.own)}.`, `${o} record${o === 1 ? "" : "s"} kept ${o === 1 ? "its" : "their"} own dates: ${names(shift.own)}.`));
  }
  return parts.join(" ");
}
