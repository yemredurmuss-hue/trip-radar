// The date box of "Gün gün" (plan v30, v46): month, day, weekday and "Gün N" of the trip, the dates read from the ISO day
// itself (never through the machine's time zone). Pure.
import { locale } from "./i18n";
import { nightsBetween } from "./items";

export interface DateBox {
  /** "Nis", "Apr": the short month. */
  month: string;
  day: number;
  /** "Per", "Thu": the short weekday. */
  weekday: string;
  /** The trip's day number (1 on its first day); null when the trip has no first day. */
  dayNo: number | null;
  /** The ISO day, to tell a repeated one. */
  iso: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}/;

/** A UTC noon for the ISO day, so no time zone moves the day. */
const noon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);

export function dateBox(iso: string | null | undefined, tripStart: string | null | undefined): DateBox | null {
  if (!iso || !ISO.test(iso)) return null;
  const d = noon(iso);
  const fmt = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale(), { ...o, timeZone: "UTC" }).replace(/\.$/, "");
  const first = tripStart && ISO.test(tripStart) ? tripStart.slice(0, 10) : null;
  return {
    month: fmt({ month: "short" }),
    day: d.getUTCDate(),
    weekday: fmt({ weekday: "short" }),
    dayNo: first ? nightsBetween(first, iso.slice(0, 10)) + 1 : null,
    iso: iso.slice(0, 10),
  };
}
