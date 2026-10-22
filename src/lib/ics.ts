// "Takvime ekle" (onay paketi, Kaçırdıklarımız: iptal son günü hatırlatma): a booking as a calendar file the traveller's own
// calendar opens: the stay's nights (or the ticket's day and hour), and, when it can still be cancelled for free, that last
// day as its own event with an alarm three days before. Nothing leaves the computer; the calendar does the reminding.
// Pure: app/plan/v82/IntentBox.tsx downloads what it returns.
import { L } from "./i18n";
import { isoDate } from "./items";
import type { Item } from "./types";

const day = (d: string) => d.replace(/-/g, "");
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** RFC 5545 text: commas, semicolons and backslashes escaped, new lines as \n. */
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
const nextDay = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** A local time "2027-03-23T00:35" as a floating date-time ("20270323T003500"); null without its hour. */
const local = (iso: string | null | undefined): string | null => (iso && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) ? `${day(iso.slice(0, 10))}T${iso.slice(11, 13)}${iso.slice(14, 16)}00` : null);

/** The calendar file for a booking; null when it has no day to put in a calendar. */
export function bookingIcs(item: Item, now = Date.now()): string | null {
  const start = isoDate(item.dates?.start?.slice(0, 10)) ?? isoDate(item.flight?.departure?.slice(0, 10));
  if (!start) return null;
  const ref = item.bookingRef ? ` · ${item.bookingRef}` : "";
  const where = item.location?.address ?? item.city ?? null;
  const events: string[][] = [];
  const timed = item.category !== "stay" ? local(item.flight?.departure) : null;
  const end = isoDate(item.dates?.end?.slice(0, 10));
  events.push([
    `UID:${item.id}@trip-radar`,
    `DTSTAMP:${stamp(now)}`,
    ...(timed ? [`DTSTART:${timed}`, `DTEND:${local(item.flight?.arrival) ?? timed}`] : [`DTSTART;VALUE=DATE:${day(start)}`, `DTEND;VALUE=DATE:${day(end && end > start ? end : nextDay(start))}`]),
    `SUMMARY:${text(`${item.name}${ref}`)}`,
    ...(where ? [`LOCATION:${text(where)}`] : []),
    ...(item.url ? [`URL:${item.url}`] : []),
  ]);
  const free = isoDate(item.cancellation?.freeUntil?.slice(0, 10));
  if (free && free >= new Date(now).toISOString().slice(0, 10)) {
    events.push([
      `UID:${item.id}-cancel@trip-radar`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${day(free)}`,
      `DTEND;VALUE=DATE:${day(nextDay(free))}`,
      `SUMMARY:${text(L(`Ücretsiz iptalin son günü: ${item.name}`, `Last day to cancel for free: ${item.name}`))}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${text(L(`${item.name}: ücretsiz iptal 3 gün sonra bitiyor`, `${item.name}: free cancellation ends in 3 days`))}`,
      "TRIGGER:-P3D",
      "END:VALARM",
    ]);
  }
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trip Radar//TR", "CALSCALE:GREGORIAN", ...events.flatMap((e) => ["BEGIN:VEVENT", ...e, "END:VEVENT"]), "END:VCALENDAR", ""].join("\r\n");
}

/** The file's name: the booking's, safe for any disk ("Rimping Village.ics"). */
export const icsName = (item: Pick<Item, "name">): string => `${item.name.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "trip-radar"}.ics`;
