// The facts column beside the hero: where from, how many, entry rules, local money and time.
// Only what the saved pages or fixed tables say; anything unknown is null and its row is hidden.
import { countryInfo, type CountryInfo } from "./countries";
import { convert, type Rates } from "./currency";
import { locale } from "./i18n";
import { visaFor, type Visa } from "./visa";
import type { Item } from "./types";

export interface TripFacts {
  origin: string | null;
  adults: number | null;
  country: string | null;
  visa: Visa | null;
  local: { currency: string; rateText: string | null; hours: number | null; info: CountryInfo } | null;
}

const mostCommon = <T,>(xs: T[]): T | null => {
  const n = new Map<T, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/** Hours a zone is ahead of UTC on a date (noon UTC, so DST switches don't matter). */
export function utcOffsetHours(zone: string, date: string): number {
  const at = new Date(`${date}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = part.match(/GMT([+-]\d+)(?::(\d+))?/);
  return m ? Number(m[1]) + (m[2] ? Math.sign(Number(m[1])) * Number(m[2]) / 60 : 0) : 0;
}

const symbol = (cur: string) => new Intl.NumberFormat(locale(), { style: "currency", currency: cur, maximumFractionDigits: 0 }).formatToParts(0).find((p) => p.type === "currency")?.value ?? cur;

export function tripFacts(
  items: Item[],
  opts: { passport: string; homeCurrency: string; rates: Rates | null; homeZone: string; start: string | null },
): TripFacts {
  const live = items.filter((i) => i.status !== "dismissed");
  const flights = live.filter((i) => i.category === "flight" && i.flight?.from).sort((a, b) => (a.dates.start ?? "9").localeCompare(b.dates.start ?? "9"));
  const settled = flights.filter((i) => i.status === "booked" || i.status === "chosen");
  const origin = (settled[0] ?? flights[0])?.flight?.from ?? null;
  const adults = mostCommon(live.map((i) => i.guests.adults).filter((n): n is number => typeof n === "number" && n > 0));
  const country = mostCommon(live.filter((i) => i.category !== "flight").map((i) => i.countryCode).filter((c): c is string => !!c));
  const info = countryInfo(country);
  let local: TripFacts["local"] = null;
  if (info) {
    const one = convert(1, info.currency, opts.homeCurrency, opts.rates);
    const rateText = info.currency !== opts.homeCurrency && one != null
      ? `${symbol(info.currency)}1 = ${symbol(opts.homeCurrency)}${one.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : null;
    const date = opts.start ?? new Date().toISOString().slice(0, 10);
    const hours = utcOffsetHours(info.timeZone, date) - utcOffsetHours(opts.homeZone, date);
    local = { currency: info.currency, rateText, hours, info };
  }
  return { origin, adults, country, visa: country ? visaFor(opts.passport, country) : null, local };
}
