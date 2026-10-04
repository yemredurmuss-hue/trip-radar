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

const money = (n: number, cur: string, d: number) =>
  new Intl.NumberFormat(locale(), { style: "currency", currency: cur, currencyDisplay: "narrowSymbol", minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

export function tripFacts(
  items: Item[],
  opts: { passport: string; homeCurrency: string; rates: Rates | null; homeZone: string; start: string | null },
): TripFacts {
  const live = items.filter((i) => i.status !== "dismissed");
  // The earliest flight is the way out; a booked or chosen one only wins a tie on the same date.
  const flights = live.filter((i) => i.category === "flight" && i.flight?.from).sort((a, b) => {
    const byDate = (a.dates.start ?? "9").localeCompare(b.dates.start ?? "9");
    if (byDate) return byDate;
    const settled = (i: Item) => (i.status === "booked" || i.status === "chosen" ? 0 : 1);
    return settled(a) - settled(b);
  });
  const origin = flights[0]?.flight?.from ?? null;
  const adults = mostCommon(live.map((i) => i.guests.adults).filter((n): n is number => typeof n === "number" && n > 0));
  const country = mostCommon(live.filter((i) => i.category !== "flight").map((i) => i.countryCode?.toUpperCase() ?? null).filter((c): c is string => !!c));
  const info = countryInfo(country);
  let local: TripFacts["local"] = null;
  if (info) {
    const one = convert(1, info.currency, opts.homeCurrency, opts.rates);
    let rateText: string | null = null;
    if (info.currency !== opts.homeCurrency && one != null && one > 0) {
      let unit = 1;
      while (one * unit < 1 && unit < 1e6) unit *= 10;
      rateText = `${money(unit, info.currency, 0)} = ${money(one * unit, opts.homeCurrency, 2)}`;
    }
    const date = opts.start ?? new Date().toISOString().slice(0, 10);
    let hours: number | null = null;
    try {
      hours = utcOffsetHours(info.timeZone, date) - utcOffsetHours(opts.homeZone, date);
    } catch {
      hours = null; // an unknown zone name: leave the row out rather than guess
    }
    local = { currency: info.currency, rateText, hours, info };
  }
  return { origin, adults, country, visa: country ? visaFor(opts.passport, country) : null, local };
}
