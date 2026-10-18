// The weather a city will likely have on the trip's days, for the hero: within ten days of the start the
// forecast, before that the average of the same days over the last five years (Open-Meteo, no key). One
// icon and the daytime high; the tooltip says which it is. Nothing is guessed: no data, no row.
import { L } from "./i18n";

export type Sky = "sun" | "partly" | "cloud" | "rain";

export interface CityWeather {
  city: string;
  /** Mean daily high, rounded. */
  high: number;
  low: number;
  sky: Sky;
  /** Days with at least 1 mm of rain, out of `days`. */
  rainy: number;
  days: number;
  source: "forecast" | "average";
}

export interface Daily {
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  cloud_cover_mean?: (number | null)[];
}

/** The forecast reaches 16 days; it is trusted from 10 days before the start. */
const FORECAST_FROM = 10;
const FORECAST_REACH = 15;
const YEARS = 5;
/** A long stay is read from its first two weeks. */
const MAX_DAYS = 14;

const DAY = 86_400_000;
const toDate = (d: string) => new Date(`${d}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => iso(new Date(toDate(d).getTime() + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const nums = (xs: (number | null)[] | undefined) => (xs ?? []).filter((x): x is number => typeof x === "number");

/** Rain when 40% of the days have it; else by the mean cloud cover. */
export function skyOf(rainy: number, days: number, cloud: number | null): Sky {
  if (days > 0 && rainy / days >= 0.4) return "rain";
  if (cloud == null) return "partly";
  return cloud >= 65 ? "cloud" : cloud >= 35 ? "partly" : "sun";
}

/** Many days (several years' worth, or a forecast) into one line; null when there's nothing to read. */
export function summarize(city: string, dailies: Daily[], source: CityWeather["source"]): CityWeather | null {
  const highs = dailies.flatMap((d) => nums(d.temperature_2m_max));
  const lows = dailies.flatMap((d) => nums(d.temperature_2m_min));
  const rain = dailies.flatMap((d) => nums(d.precipitation_sum));
  const cloud = dailies.flatMap((d) => nums(d.cloud_cover_mean));
  if (!highs.length || !lows.length) return null;
  const rainy = rain.filter((p) => p >= 1).length;
  return {
    city,
    high: Math.round(mean(highs)),
    low: Math.round(mean(lows)),
    sky: skyOf(rainy, rain.length, cloud.length ? mean(cloud) : null),
    rainy,
    days: rain.length,
    source,
  };
}

export type WeatherQuery = { kind: "forecast"; start: string; end: string } | { kind: "average"; windows: { start: string; end: string }[] };

/**
 * Which days to ask for: the forecast when the start is at most ten days away (only the days it reaches,
 * from today on), else the same days in each of the last five years. Null once the trip is over.
 */
export function weatherQuery(range: { start: string; end: string }, today: string): WeatherQuery | null {
  const last = addDays(range.start, Math.min(daysBetween(range.start, range.end), MAX_DAYS - 1));
  if (last < today) return null;
  if (daysBetween(today, range.start) <= FORECAST_FROM) {
    const start = range.start > today ? range.start : today;
    const reach = addDays(today, FORECAST_REACH);
    return { kind: "forecast", start, end: last < reach ? last : reach };
  }
  const startYear = Number(range.start.slice(0, 4));
  const windows: { start: string; end: string }[] = [];
  // Back from this year: the archive lags a few days, so a window not yet a week over is skipped; 29 Feb too.
  for (let year = Number(today.slice(0, 4)); windows.length < YEARS && year > startYear - 20; year--) {
    const shift = (d: string) => `${Number(d.slice(0, 4)) - (startYear - year)}${d.slice(4)}`;
    const w = { start: shift(range.start), end: shift(last) };
    if (w.end < addDays(today, -7) && !w.start.endsWith("02-29") && !w.end.endsWith("02-29")) windows.push(w);
  }
  return windows.length ? { kind: "average", windows } : null;
}

const VARS = "temperature_2m_max,temperature_2m_min,precipitation_sum,cloud_cover_mean";
const url = (host: string, at: { lat: number; lng: number }, start: string, end: string) =>
  `https://${host}/v1/${host.startsWith("archive") ? "archive" : "forecast"}?latitude=${at.lat.toFixed(3)}&longitude=${at.lng.toFixed(3)}&start_date=${start}&end_date=${end}&daily=${VARS}&timezone=auto`;

export type FetchDaily = (url: string) => Promise<Daily | null>;

const fetchDaily: FetchDaily = async (u) => {
  const res = await fetch(u);
  if (!res.ok) return null;
  const body = (await res.json()) as { daily?: Daily };
  return body.daily ?? null;
};

export async function cityWeather(
  city: string,
  at: { lat: number; lng: number },
  range: { start: string; end: string },
  today: string,
  get: FetchDaily = fetchDaily,
): Promise<CityWeather | null> {
  const q = weatherQuery(range, today);
  if (!q) return null;
  if (q.kind === "forecast") {
    const d = await get(url("api.open-meteo.com", at, q.start, q.end));
    return d ? summarize(city, [d], "forecast") : null;
  }
  const all = await Promise.all(q.windows.map((w) => get(url("archive-api.open-meteo.com", at, w.start, w.end)).catch(() => null)));
  const dailies = all.filter((d): d is Daily => !!d);
  return dailies.length ? summarize(city, dailies, "average") : null;
}

/** "Porto · Ekim ortalaması, son 5 yıl: gündüz 23°, gece 16° · yağışlı gün 7/35", or the forecast's line. */
export function weatherTitle(w: CityWeather, month: string): string {
  const head = w.source === "forecast" ? L(`${w.city} · tahmin`, `${w.city} · forecast`) : L(`${w.city} · ${month} ortalaması, son ${YEARS} yıl`, `${w.city} · ${month} average, last ${YEARS} years`);
  return `${head}: ${L(`gündüz ${w.high}°, gece ${w.low}°`, `day ${w.high}°, night ${w.low}°`)} · ${L(`yağışlı gün ${w.rainy}/${w.days}`, `rainy days ${w.rainy}/${w.days}`)}`;
}

/** A day's cache in this browser: averages and forecasts don't change within hours. */
const CACHE = "trip-radar:weather:";
export function cachedWeather(key: string): CityWeather | null | undefined {
  try {
    const raw = localStorage.getItem(CACHE + key);
    if (!raw) return undefined;
    const { at, value } = JSON.parse(raw) as { at: number; value: CityWeather | null };
    return Date.now() - at < (value?.source === "average" ? 30 : 0.5) * DAY ? value : undefined;
  } catch {
    return undefined;
  }
}
export function cacheWeather(key: string, value: CityWeather | null): void {
  try {
    localStorage.setItem(CACHE + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // no storage (private window, quota): the next view asks again
  }
}
