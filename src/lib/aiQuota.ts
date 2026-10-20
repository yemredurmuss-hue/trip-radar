// When the free Gemini requests come back (F33, 2026-10-20).
// Google: "Requests per day (RPD) quotas reset at midnight Pacific time" (ai.google.dev/gemini-api/docs/rate-limits, read
// 2026-10-20; limits are per project, per model). The traveller reads that moment on their own clock, plainly: "Kota yarın
// 10:00'da yenilenir", never "biraz bekle" when it is 20 hours away.
import { L, locale } from "./i18n";

/** Where Google's day turns: midnight here is when every model's daily free requests come back. */
export const QUOTA_ZONE = "America/Los_Angeles";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zoneParts(at: number, timeZone?: string): Parts {
  const p: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  for (const part of fmt.formatToParts(at)) p[part.type] = part.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second };
}

/** The zone's offset from UTC at that moment, in ms (its wall clock read as UTC, minus the moment). */
function offsetAt(at: number, timeZone: string): number {
  const p = zoneParts(at, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (at - (((at % 1000) + 1000) % 1000));
}

/**
 * The next midnight in Pacific time after `now` (epoch ms). DST-safe: the offset is asked of Intl for that very midnight, so
 * a 23- or 25-hour Pacific day (March, November) lands on the right hour. US clocks change at 02:00, never at midnight.
 */
export function nextQuotaReset(now: number = Date.now()): number {
  const p = zoneParts(now, QUOTA_ZONE);
  const midnight = Date.UTC(p.year, p.month - 1, p.day + 1); // tomorrow 00:00 on the Pacific wall clock, read as UTC
  const guess = midnight - offsetAt(now, QUOTA_ZONE);
  return midnight - offsetAt(guess, QUOTA_ZONE);
}

// Turkish says the time aloud and takes the locative from its last word: 10:00 "onda", 13:00 "on üçte", 11:00 "on birde",
// 10:30 "on otuzda", 12:45 "on iki kırk beşte". sıfır bir iki üç dört beş altı yedi sekiz dokuz; on yirmi otuz kırk elli.
const UNITS = ["da", "de", "de", "te", "te", "te", "da", "de", "de", "da"];
const TENS = ["da", "da", "de", "da", "ta", "de"];
const lastWord = (n: number) => (n % 10 ? UNITS[n % 10] : n === 0 ? UNITS[0] : TENS[n / 10]);
/** "10:00" → "10:00'da", "13:00" → "13:00'te", "11:30" → "11:30'da". */
export function trAt(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${time}'${lastWord(m ? m : h)}`;
}

const dayNumber = (p: Parts) => Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;

/**
 * When the free requests come back, on this device's clock (or `timeZone`'s, for the tests): "yarın 10:00'da" / "tomorrow at
 * 10:00", "bugün 10:00'da" / "today at 10:00". More than a day away (a 25-hour Pacific day seen from far east): its date.
 */
export function resetWhen(now: number = Date.now(), timeZone?: string): string {
  const reset = nextQuotaReset(now);
  const at = zoneParts(reset, timeZone);
  const time = `${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}`;
  const days = dayNumber(at) - dayNumber(zoneParts(now, timeZone));
  if (days <= 0) return L(`bugün ${trAt(time)}`, `today at ${time}`);
  if (days === 1) return L(`yarın ${trAt(time)}`, `tomorrow at ${time}`);
  const date = new Intl.DateTimeFormat(locale(), { timeZone, day: "numeric", month: "long" }).format(reset);
  return L(`${date} ${trAt(time)}`, `on ${date} at ${time}`);
}

/** "Kota yarın 10:00'da yenilenir" / "Quota resets tomorrow at 10:00": the T1 line's right side. */
export const quotaResetLine = (now: number = Date.now(), timeZone?: string): string => {
  const when = resetWhen(now, timeZone);
  return L(`Kota ${when} yenilenir`, `Quota resets ${when}`);
};
