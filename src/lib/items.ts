// Pure logic: extraction -> Item, duplicate detection, merging, grouping and row labels.
import { classify, normalize } from "./evidence";
import type { Extraction } from "./extract";
import { L, locale } from "./i18n";
import type { Capture, Category, FactSource, Item, ItemMetrics } from "./types";
import { countryCodeOf } from "./trips";
import type { UrlFacts } from "./url";

const CATEGORY_NAMES: Record<Category, [tr: string, en: string]> = {
  flight: ["Uçuş", "Flights"],
  stay: ["Konaklama", "Stays"],
  transport: ["Ulaşım", "Transport"],
  activity: ["Etkinlikler", "Activities"],
  food: ["Yeme-içme", "Food & drink"],
  esim: ["eSIM", "eSIM"],
  other: ["Diğer", "Other"],
};

/** Category names in the current language (read at use time: each key is a getter). */
export const CATEGORY_LABELS = {} as Record<Category, string>;
for (const [key, [tr, en]] of Object.entries(CATEGORY_NAMES)) {
  Object.defineProperty(CATEGORY_LABELS, key, { get: () => L(tr, en), enumerable: true });
}

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
    stayKind: x.stay_kind ?? null,
    bedrooms: positive(x.bedrooms ?? null),
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

/** A confirmation the extraction can show: its reference number, or the words that say it. */
const confirmed = (x: Pick<Extraction, "booked" | "booking_reference" | "booking_quote">) =>
  Boolean(x.booked && (x.booking_reference?.trim() || x.booking_quote?.trim()));

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
    name: raw.name.trim() || capture.title?.trim() || L("Adsız kayıt", "Untitled"),
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
    // A web address only from a page (a screenshot alone has none to give; its photo is cut out, see process.ts).
    imageUrl: capture.url ? (httpUrl(x.image_url) ?? httpUrl(capture.meta["og:image"])) : null,
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
    // A booking confirmation (the page after paying, or its screenshot) is a booking, not an option; but
    // only with its reference or its own words for it: a checkout page that looks like one stays chosen.
    status: confirmed(x) ? "booked" : x.booked ? "chosen" : "saved",
    statusNote: confirmed(x)
      ? `${L("Onay ekranından", "From the confirmation")}${x.booking_reference?.trim() ? ` · ${x.booking_reference.trim()}` : ""}`
      : x.booked
        ? L(
            "Onay gibi görünüyor ama rezervasyon numarası okunamadı; rezerve ettiysen işaretle",
            "Looks like a confirmation, but no booking number could be read; mark it if you booked it",
          )
        : null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The place an item is an offer for (hotel, flat, tour...): what is read about it is shared by every
 * offer of it. Items without a canonical key are their own place.
 */
export const listingKeyOf = (item: Pick<Item, "key" | "id">): string => item.key ?? `item:${item.id}`;

/**
 * An offer is a place for particular dates (and room, when the page names one): saving the same
 * hotel for 7–10 and then for 10–14 gives two items, not one overwritten by the other.
 */
function sameOffer(a: Item, b: Item): boolean {
  if (a.dates.start && b.dates.start && (a.dates.start !== b.dates.start || a.dates.end !== b.dates.end)) return false;
  if (a.optionDetail && b.optionDetail && normalize(a.optionDetail) !== normalize(b.optionDetail)) return false;
  return true;
}

export interface Duplicate {
  item: Item;
  /**
   * The capture only refreshes what is known about the place: it had no dates while the offer has
   * some (a dateless page's "from" price must not replace the price for the chosen nights).
   */
  placeOnly: boolean;
}

export function findDuplicate(existing: Item[], candidate: Item): Duplicate | undefined {
  const samePlace = candidate.key
    ? existing.filter((i) => i.key === candidate.key)
    : existing.filter((i) => i.tripId === candidate.tripId && i.category === candidate.category && normalize(i.name) === normalize(candidate.name));
  if (!samePlace.length) return undefined;
  const newest = (list: Item[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (candidate.dates.start) {
    const exact = samePlace.filter((i) => i.dates.start === candidate.dates.start && i.dates.end === candidate.dates.end && sameOffer(i, candidate));
    if (exact.length) return { item: newest(exact), placeOnly: false };
    // A dateless save of this place gains its dates now.
    const dateless = samePlace.filter((i) => !i.dates.start && sameOffer(i, candidate));
    return dateless.length ? { item: newest(dateless), placeOnly: false } : undefined;
  }
  const dateless = samePlace.filter((i) => !i.dates.start && sameOffer(i, candidate));
  if (dateless.length) return { item: newest(dateless), placeOnly: false };
  return { item: newest(samePlace), placeOnly: true };
}

/** Newer capture wins for facts it actually has; the user's decisions (status, notes) are kept. */
export function mergeItem(existing: Item, incoming: Item, placeOnly = false): Item {
  if (placeOnly) {
    // Only what describes the place; dates, guests, price and conditions stay the offer's own.
    const merged = mergeItem(existing, incoming);
    return {
      ...merged,
      optionDetail: existing.optionDetail,
      dates: existing.dates,
      guests: existing.guests,
      price: existing.price,
      priceHistory: existing.priceHistory,
      cancellation: existing.cancellation,
      summary: existing.summary,
      missing: existing.missing,
    };
  }
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
    // The traveller's decision stands, except that a booking confirmation books it.
    status: incoming.status === "booked" ? "booked" : existing.status,
    statusNote: incoming.status === "booked" ? incoming.statusNote : existing.statusNote,
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
      items: RANKED.includes(category) ? rankItems(list, rank) : [...list].sort((a, b) => a.createdAt - b.createdAt),
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
export function rankItems(items: Item[], rank?: (item: Item) => number | null): Item[] {
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
  if (item.status === "booked") return { text: L("Rezerve edildi", "Booked"), tone: "success" };
  if (item.status === "chosen") return { text: L("Seçildi", "Chosen"), tone: "success" };

  const majority = mostCommon(group.map((i) => `${i.dates.start}|${i.dates.end}`));
  if (item.dates.start && majority && `${item.dates.start}|${item.dates.end}` !== majority) {
    return { text: L("Farklı tarih", "Different dates"), tone: "warning" };
  }
  if (item.price.amount == null) return { text: L("Fiyat yok", "No price"), tone: "warning" };
  if (item.price.source === "unverified") return { text: L("Fiyat doğrulanmadı", "Price not verified"), tone: "warning" };
  const age = now - item.price.observedAt;
  if (age > (STALE_MS[item.category] ?? DEFAULT_STALE_MS)) {
    const days = Math.floor(age / (24 * 3600e3));
    return { text: L(`Fiyat ${days} gün önce`, `Price from ${days} day${days === 1 ? "" : "s"} ago`), tone: "warning" };
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
    return { text: L("En ekonomik", "Cheapest"), tone: "muted" };
  }
  const rated = group.filter((i) => i.rating.value != null && i.rating.scale === item.rating.scale);
  if (rated.length >= 2 && Math.max(...rated.map((i) => i.rating.value!)) === item.rating.value) {
    return { text: L(`En yüksek puan (${item.rating.value})`, `Top rated (${item.rating.value})`), tone: "muted" };
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

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const month = (m: number) => L(MONTHS_TR[m - 1], MONTHS_EN[m - 1]);

export function formatDateRange(start: string, end: string | null): string {
  if (!isoDate(start)) return start;
  if (end && !isoDate(end)) end = null;
  const [, sm, sd] = start.split("-").map(Number);
  if (!end || end === start) return `${sd} ${month(sm)}`;
  const [, em, ed] = end.split("-").map(Number);
  return sm === em ? `${sd}–${ed} ${month(sm)}` : `${sd} ${month(sm)} – ${ed} ${month(em)}`;
}

export function formatPrice(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat(locale(), {
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
