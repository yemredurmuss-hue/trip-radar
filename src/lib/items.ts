// Pure logic: extraction -> Item, duplicate detection, merging, grouping and row labels.
import { classify, normalize } from "./evidence";
import type { Extraction } from "./extract";
import type { Capture, Category, FactSource, Item, ItemMetrics } from "./types";
import { countryCodeOf } from "./trips";
import type { UrlFacts } from "./url";

export const CATEGORY_LABELS: Record<Category, string> = {
  flight: "Uçuş",
  stay: "Konaklama",
  transport: "Ulaşım",
  activity: "Etkinlikler",
  food: "Yeme-içme",
  esim: "eSIM",
  other: "Diğer",
};

export const CATEGORY_ORDER: Category[] = ["flight", "stay", "transport", "activity", "food", "esim", "other"];

/** Categories where saved items are competing alternatives for one need. */
const RANKED: Category[] = ["flight", "stay", "transport", "esim"];

export function corpusOf(capture: Capture): string {
  return [
    capture.pageText,
    capture.viewportText,
    capture.selection,
    capture.title ?? "",
    capture.jsonLd.join("\n"),
    Object.values(capture.meta).join("\n"),
  ].join("\n");
}

const CURRENCY_SYMBOLS: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP", "₺": "TRY", TL: "TRY", YTL: "TRY" };

/** Model output is schema-shaped but not format-checked; keep only values the UI can rely on. */
export function isoDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

export function currencyCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toUpperCase();
  const code = CURRENCY_SYMBOLS[v] ?? CURRENCY_SYMBOLS[value.trim()] ?? v;
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export const EMPTY_METRICS: ItemMetrics = {
  reviewAspects: [],
  amenities: [],
  cancellationType: "unknown",
  distanceToCenterKm: null,
  durationMinutes: null,
  checkedBagIncluded: null,
  dataGb: null,
  unlimitedData: null,
  validityDays: null,
};

/** Items saved before the decision engine have no metrics. */
export const metricsOf = (item: Item): ItemMetrics => item.metrics ?? EMPTY_METRICS;

function metricsFrom(x: Extraction["metrics"]): ItemMetrics {
  if (!x) return EMPTY_METRICS;
  const positive = (n: number | null) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null);
  return {
    reviewAspects: x.review_aspects
      .filter((a) => a.score != null || a.sentiment != null)
      .map((a) => ({ aspect: a.aspect, score: positive(a.score), scale: positive(a.scale), sentiment: a.sentiment })),
    amenities: [...new Set(x.amenities)],
    cancellationType: x.cancellation_type,
    distanceToCenterKm: positive(x.distance_to_center_km),
    durationMinutes: positive(x.duration_minutes),
    checkedBagIncluded: x.checked_bag_included,
    dataGb: positive(x.data_gb),
    unlimitedData: x.unlimited_data,
    validityDays: positive(x.validity_days),
  };
}

/** First sane coordinate the page itself carried (map link, data attribute, JSON-LD geo). */
export function pageGeo(capture: Capture): Item["geo"] {
  const fromJsonLd = capture.jsonLd
    .map((raw) => raw.match(/"latitude"\s*:\s*"?(-?\d+\.\d+)"?[\s\S]{0,80}?"longitude"\s*:\s*"?(-?\d+\.\d+)"?/))
    .find(Boolean);
  const candidate = fromJsonLd
    ? { lat: Number(fromJsonLd[1]), lng: Number(fromJsonLd[2]) }
    : capture.coords?.[0];
  if (!candidate || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) return null;
  return { lat: candidate.lat, lng: candidate.lng, source: "page" };
}

const finite = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : null);
const httpUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

export function buildItem(
  extraction: Extraction,
  capture: Capture,
  facts: UrlFacts,
  tripId: string,
  now = Date.now(),
): Item {
  const corpus = corpusOf(capture);
  const raw = extraction;
  const x: Extraction = {
    ...raw,
    name: raw.name.trim() || capture.title?.trim() || "Adsız kayıt",
    dates: { ...raw.dates, start: isoDate(raw.dates.start), end: isoDate(raw.dates.end) },
    price: { ...raw.price, amount: finite(raw.price.amount), currency: currencyCode(raw.price.currency) },
    cancellation: { ...raw.cancellation, free_until: isoDate(raw.cancellation.free_until) },
    rating: { ...raw.rating, value: finite(raw.rating.value), scale: finite(raw.rating.scale), count: finite(raw.rating.count) },
    image_url: httpUrl(raw.image_url),
  };
  const urlDates = facts.checkIn || facts.checkOut;
  const flightKey =
    x.flight?.flight_number && x.flight.departure
      ? `flight:${x.flight.flight_number.replace(/\s+/g, "").toUpperCase()}:${x.flight.departure.slice(0, 10)}`
      : null;
  // A flight search URL can yield several different flights, so flights are keyed by flight number only.
  const key = x.category === "flight" ? flightKey : facts.key;
  const priceSource: FactSource =
    x.price.amount == null ? "none" : classify(x.price.source, x.price.evidence, corpus, x.price.amount);

  return {
    id: crypto.randomUUID(),
    tripId,
    captureIds: [capture.id],
    key,
    category: x.category,
    needKey: x.need_key.trim().toLowerCase() || `${x.category}:${(x.city ?? "").toLowerCase()}`,
    name: x.name.trim(),
    provider: x.provider ?? facts.provider,
    summary: x.summary,
    optionDetail: x.option_detail,
    url: capture.url,
    imageUrl: x.image_url ?? httpUrl(capture.meta["og:image"]),
    city: x.city,
    country: x.country,
    countryCode: countryCodeOf(x.country_code),
    location: { ...x.location },
    dates: urlDates
      ? { start: facts.checkIn, end: facts.checkOut, source: "url" }
      : { start: x.dates.start, end: x.dates.end, source: x.dates.start ? x.dates.source : "none" },
    guests: {
      adults: facts.adults ?? x.guests.adults,
      children: facts.children ?? x.guests.children,
      rooms: facts.rooms ?? x.guests.rooms,
    },
    price: {
      amount: x.price.amount,
      currency: x.price.currency ?? currencyCode(facts.currency),
      scope: x.price.scope,
      taxesIncluded: x.price.taxes_included,
      source: priceSource,
      observedAt: now,
    },
    priceHistory:
      x.price.amount != null && x.price.currency
        ? [{ amount: x.price.amount, currency: x.price.currency, observedAt: now }]
        : [],
    cancellation: {
      summary: x.cancellation.summary,
      freeUntil: x.cancellation.free_until,
      source: x.cancellation.summary
        ? classify(x.cancellation.source, x.cancellation.evidence, corpus)
        : "none",
    },
    rating: {
      value: x.rating.value,
      scale: x.rating.scale,
      count: x.rating.count,
      source: x.rating.value == null ? "none" : classify(x.rating.source, x.rating.evidence, corpus, x.rating.value, "rating"),
    },
    flight: x.flight
      ? {
          from: x.flight.from,
          to: x.flight.to,
          departure: x.flight.departure,
          arrival: x.flight.arrival,
          carrier: x.flight.carrier,
          flightNumber: x.flight.flight_number,
          stops: x.flight.stops,
        }
      : null,
    metrics: metricsFrom(x.metrics),
    geo: pageGeo(capture),
    highlights: x.highlights.slice(0, 4),
    concerns: x.concerns.slice(0, 3),
    reviewSummary: x.review_summary,
    missing: x.missing,
    status: "saved",
    statusNote: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function findDuplicate(existing: Item[], candidate: Item): Item | undefined {
  if (candidate.key) return existing.find((i) => i.key === candidate.key);
  const name = normalize(candidate.name);
  return existing.find(
    (i) => i.tripId === candidate.tripId && i.category === candidate.category && normalize(i.name) === name,
  );
}

/** Newer capture wins for facts it actually has; the user's decisions (status, notes) are kept. */
export function mergeItem(existing: Item, incoming: Item): Item {
  const pick = <T>(next: T | null | undefined, prev: T): T => (next == null || next === "" ? prev : next);
  const priceChanged =
    incoming.price.amount != null &&
    (incoming.price.amount !== existing.price.amount || incoming.price.currency !== existing.price.currency);

  return {
    ...existing,
    captureIds: [...new Set([...existing.captureIds, ...incoming.captureIds])],
    key: existing.key ?? incoming.key,
    name: pick(incoming.name, existing.name),
    provider: pick(incoming.provider, existing.provider),
    summary: pick(incoming.summary, existing.summary),
    optionDetail: pick(incoming.optionDetail, existing.optionDetail),
    url: pick(incoming.url, existing.url),
    imageUrl: pick(incoming.imageUrl, existing.imageUrl),
    city: pick(incoming.city, existing.city),
    country: pick(incoming.country, existing.country),
    countryCode: pick(incoming.countryCode, existing.countryCode),
    location: incoming.location.address || incoming.location.area ? incoming.location : existing.location,
    dates: incoming.dates.start ? incoming.dates : existing.dates,
    guests: incoming.guests.adults != null ? incoming.guests : existing.guests,
    price: incoming.price.amount != null ? incoming.price : existing.price,
    priceHistory: priceChanged ? [...existing.priceHistory, ...incoming.priceHistory] : existing.priceHistory,
    cancellation: incoming.cancellation.summary ? incoming.cancellation : existing.cancellation,
    rating: incoming.rating.value != null ? incoming.rating : existing.rating,
    flight: incoming.flight ?? existing.flight,
    metrics: incoming.metrics && incoming.metrics !== EMPTY_METRICS ? incoming.metrics : existing.metrics,
    geo: incoming.geo ?? existing.geo,
    highlights: incoming.highlights.length ? incoming.highlights : existing.highlights,
    concerns: incoming.concerns.length ? incoming.concerns : existing.concerns,
    reviewSummary: pick(incoming.reviewSummary, existing.reviewSummary),
    missing: incoming.missing,
    updatedAt: incoming.updatedAt,
  };
}

// --- grouping & labels ------------------------------------------------------------------------

export interface NeedGroup {
  key: string;
  category: Category;
  title: string | null;
  items: Item[];
}

/** `rank` is the decision engine's order within a group (0 = best); unranked options go after. */
export function groupItems(items: Item[], rank?: (item: Item) => number | null): { category: Category; groups: NeedGroup[] }[] {
  const active = items.filter((i) => i.status !== "dismissed");
  return CATEGORY_ORDER.map((category) => {
    const byNeed = new Map<string, Item[]>();
    for (const item of active.filter((i) => i.category === category)) {
      const list = byNeed.get(item.needKey) ?? [];
      list.push(item);
      byNeed.set(item.needKey, list);
    }
    const groups = [...byNeed.entries()].map(([key, list]) => ({
      key,
      category,
      title: groupTitle(category, list),
      // Alternatives for one need are ranked; lists of places keep the order the user saved them.
      items: RANKED.includes(category) ? sortForDecision(list, rank) : [...list].sort((a, b) => a.createdAt - b.createdAt),
    }));
    return { category, groups };
  }).filter((section) => section.groups.length > 0);
}

export function groupTitle(category: Category, items: Item[]): string | null {
  const city = mostCommon(items.map((i) => i.city).filter(Boolean) as string[]);
  if (category === "stay") {
    const nights = mostCommon(items.map((i) => nightsBetween(i.dates.start, i.dates.end)).filter((n) => n > 0));
    return [city, nights ? `${nights} gece` : null].filter(Boolean).join(" · ") || null;
  }
  return category === "flight" ? null : city;
}

/** Booked/chosen first, then the decision engine's ranking, then by price. */
function sortForDecision(items: Item[], rank?: (item: Item) => number | null): Item[] {
  const status = (i: Item) => (i.status === "booked" ? 0 : i.status === "chosen" ? 1 : 2);
  const ranked = (i: Item) => rank?.(i) ?? Infinity;
  return [...items].sort(
    (a, b) =>
      status(a) - status(b) || ranked(a) - ranked(b) || (a.price.amount ?? Infinity) - (b.price.amount ?? Infinity),
  );
}

export type Tone = "accent" | "success" | "warning" | "muted";

export interface RowLabel {
  text: string;
  tone: Tone;
}

const STALE_MS: Partial<Record<Category, number>> = { flight: 24 * 3600e3 };
const DEFAULT_STALE_MS = 3 * 24 * 3600e3;

export function rowLabel(item: Item, group: Item[], now = Date.now()): RowLabel {
  if (item.status === "booked") return { text: "Rezerve edildi", tone: "success" };
  if (item.status === "chosen") return { text: "Seçildi", tone: "success" };

  const majority = mostCommon(group.map((i) => `${i.dates.start}|${i.dates.end}`));
  if (item.dates.start && majority && `${item.dates.start}|${item.dates.end}` !== majority) {
    return { text: "Farklı tarih", tone: "warning" };
  }
  if (item.price.amount == null) return { text: "Fiyat yok", tone: "warning" };
  if (item.price.source === "unverified") return { text: "Fiyat doğrulanmadı", tone: "warning" };
  const age = now - item.price.observedAt;
  if (age > (STALE_MS[item.category] ?? DEFAULT_STALE_MS)) {
    return { text: `Fiyat ${Math.floor(age / (24 * 3600e3))} gün önce`, tone: "warning" };
  }

  const comparable = group.filter(
    (i) =>
      i.price.amount != null &&
      i.price.currency === item.price.currency &&
      i.price.scope === item.price.scope &&
      i.dates.start === item.dates.start &&
      i.dates.end === item.dates.end,
  );
  if (comparable.length >= 2 && Math.min(...comparable.map((i) => i.price.amount!)) === item.price.amount) {
    return { text: "En ekonomik", tone: "muted" };
  }
  const rated = group.filter((i) => i.rating.value != null && i.rating.scale === item.rating.scale);
  if (rated.length >= 2 && Math.max(...rated.map((i) => i.rating.value!)) === item.rating.value) {
    return { text: `En yüksek puan (${item.rating.value})`, tone: "muted" };
  }
  return { text: item.summary, tone: "muted" };
}

// --- dates, prices, routes ----------------------------------------------------------------------

export function tripDateRange(items: Item[]): { start: string; end: string } | null {
  const active = items.filter((i) => i.status !== "dismissed");
  const starts = active.map((i) => i.dates.start).filter(Boolean) as string[];
  const ends = active.map((i) => i.dates.end ?? i.dates.start).filter(Boolean) as string[];
  if (!starts.length) return null;
  return { start: starts.sort()[0], end: ends.sort().at(-1) ?? starts.sort()[0] };
}

export function nightsBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  return Math.round((Date.parse(end) - Date.parse(start)) / (24 * 3600e3));
}

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function formatDateRange(start: string, end: string | null): string {
  if (!isoDate(start)) return start;
  if (end && !isoDate(end)) end = null;
  const [, sm, sd] = start.split("-").map(Number);
  if (!end || end === start) return `${sd} ${MONTHS[sm - 1]}`;
  const [, em, ed] = end.split("-").map(Number);
  return sm === em ? `${sd}–${ed} ${MONTHS[sm - 1]}` : `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]}`;
}

export function formatPrice(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency ?? "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency ?? ""}`.trim();
  }
}

/** Google Maps directions through the places the user chose (no API key needed; max 9 waypoints). */
export function routeUrl(items: Item[]): string | null {
  const chosen = items.filter((i) => i.status === "chosen" || i.status === "booked");
  const pool = (chosen.length ? chosen : items.filter((i) => i.status !== "dismissed")).filter((i) =>
    ["stay", "activity", "food"].includes(i.category),
  );
  const places = pool.map((i) => i.location.address || [i.name, i.city].filter(Boolean).join(", ")).slice(0, 11);
  if (!places.length) return null;
  if (places.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(places[0])}`;
  }
  const params = new URLSearchParams({ api: "1", origin: places[0], destination: places.at(-1)! });
  if (places.length > 2) params.set("waypoints", places.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount) [best, bestCount] = [v, c];
  return best;
}
