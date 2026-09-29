// Decision engine. Pure and deterministic: the same facts and priorities always give the same scores.
// The model only supplies facts (extraction) and one clearly labelled, low-weight "AI" criterion;
// everything else - normalisation, weights, ranking, reasons - is computed here and explainable.
import { convert, type Rates } from "./currency";
import { distanceKm, formatDistance, walkingMinutes } from "./geo";
import { formatPrice, listingKeyOf, metricsOf, nightsBetween, tripDateRange } from "./items";
import { acceptKey, evidenceOf, isDecisive, usefulListing } from "./listing";
import { buildPlan, groupKeyOf, liveGroups, rangeOfGroupKey, stayRange } from "./plan";
import type {
  Amenity,
  Analysis,
  Category,
  CriterionId,
  Finding,
  FindingTopic,
  Item,
  ItemMetrics,
  Listing,
  PriorityLevel,
  Requirement,
  Trip,
} from "./types";

export const CRITERION_LABELS: Record<CriterionId, string> = {
  price: "Fiyat",
  location: "Konum",
  rating: "Puan/yorumlar",
  comfort: "Konfor/temizlik",
  cancellation: "İptal esnekliği",
  amenities: "İstediğin olanaklar",
  duration: "Süre",
  stops: "Aktarma",
  schedule: "Saatler",
  baggage: "Bagaj",
  data: "Veri miktarı",
  validity: "Geçerlilik",
  details: "Yorum ve detaylar",
  ai: "AI değerlendirmesi",
};

export const LEVEL_LABELS = ["Önemsiz", "Az", "Normal", "Önemli", "Çok önemli"] as const;
const LEVEL_WEIGHT = [0, 0.5, 1, 2, 3];

/** Which criteria apply to a category, and how much they matter by default. */
export const DEFAULT_LEVELS: Record<Category, Partial<Record<CriterionId, PriorityLevel>>> = {
  stay: { price: 3, location: 3, rating: 2, comfort: 2, cancellation: 2, amenities: 2, details: 2, ai: 1 },
  flight: { price: 3, duration: 2, stops: 2, schedule: 2, baggage: 2, cancellation: 1, ai: 1 },
  activity: { price: 2, rating: 3, location: 2, cancellation: 1, details: 2, ai: 1 },
  food: { rating: 3, location: 2, price: 1, details: 2, ai: 1 },
  esim: { price: 3, data: 3, validity: 3, rating: 1, ai: 1 },
  transport: { price: 3, duration: 2, cancellation: 1, details: 1, ai: 1 },
  other: { price: 2, rating: 2, location: 1, details: 1, ai: 1 },
};

/** Without these an option's score is provisional (e.g. a stay without a price): ranked after complete ones. */
const REQUIRED: Partial<Record<Category, CriterionId[]>> = { stay: ["price"], flight: ["price"], esim: ["price"], transport: ["price"] };

/** Soft signals read from what the traveller saves and chooses: ±1 step on a default, with why. */
export type Inferred = Map<string, { delta: number; evidence: string }>;
export const inferredKey = (category: Category, criterion: CriterionId) => `${category}:${criterion}`;

/** Every amenity the traveller asked for: wanted ones and the ones they made a requirement. */
export function wantedAmenities(trip: Pick<Trip, "wantedAmenities" | "requirements">): Amenity[] {
  const required = (trip.requirements ?? []).flatMap((r) => (r.kind === "amenity" ? [r.amenity] : []));
  return [...new Set([...(trip.wantedAmenities ?? []), ...required])];
}

/** What the traveller's notes ask for ("sessiz bir yer istiyoruz", "merkezi olsun"), as finding topics. */
const SAID: [RegExp, string[]][] = [
  [/sessiz|gürültü|quiet|noise/i, ["noise"]],
  [/merkez|yürü|yakın|central|walk|konum/i, ["location", "nearby", "transport"]],
  [/temiz|hijyen|clean/i, ["cleanliness"]],
  [/iptal|iade|esnek|cancel/i, ["cancellation"]],
  [/kahvaltı|yemek|breakfast/i, ["food"]],
  [/geniş|ferah|alan|space/i, ["space"]],
  [/manzara|view/i, ["view"]],
  [/yatak|uyku|bed/i, ["bed"]],
  [/asansör|merdiven|bebek|engelli|tekerlekli|stairs|lift/i, ["access"]],
  [/güven|safe/i, ["safety"]],
];
export function saidTopics(preferences: string[]): Set<string> {
  const topics = new Set<string>();
  for (const text of preferences) for (const [re, list] of SAID) if (re.test(text)) list.forEach((t) => topics.add(t));
  return topics;
}
/** A finding on something the traveller asked for counts this much more. */
export const SAID_WEIGHT = 2.5;

function explicitLevel(trip: Trip, category: Category, criterion: CriterionId): PriorityLevel | undefined {
  return trip.categoryPriorities?.[category]?.[criterion] ?? trip.priorities?.[criterion];
}

/** What the traveller said (chat or comparison view) wins; else the default, nudged by signals. */
export function levelFor(trip: Trip, category: Category, criterion: CriterionId, inferred?: Inferred): PriorityLevel {
  const fallback = DEFAULT_LEVELS[category][criterion];
  if (fallback === undefined) return 0; // not applicable to this category
  if (criterion === "amenities" && !wantedAmenities(trip).length) return 0;
  const explicit = explicitLevel(trip, category, criterion);
  if (explicit !== undefined) return explicit;
  const delta = inferred?.get(inferredKey(category, criterion))?.delta ?? 0;
  return Math.min(4, Math.max(0, fallback + delta)) as PriorityLevel;
}

export function levelSource(trip: Trip, category: Category, criterion: CriterionId, inferred?: Inferred): "explicit" | "inferred" | "default" {
  if (explicitLevel(trip, category, criterion) !== undefined) return "explicit";
  return inferred?.has(inferredKey(category, criterion)) ? "inferred" : "default";
}

/** Applies priority changes to a trip: a category override, or (category null) every category. */
export function withPriorities(
  trip: Trip,
  changes: { criterion: CriterionId; level: PriorityLevel; category: Category | null }[],
  wantedAmenities?: Amenity[] | null,
): Trip {
  const priorities = { ...trip.priorities };
  const categoryPriorities = Object.fromEntries(
    Object.entries(trip.categoryPriorities ?? {}).map(([k, v]) => [k, { ...v }]),
  ) as NonNullable<Trip["categoryPriorities"]>;
  for (const c of changes) {
    if (c.category) {
      categoryPriorities[c.category] = { ...categoryPriorities[c.category], [c.criterion]: c.level };
    } else {
      priorities[c.criterion] = c.level;
      // A trip-wide statement replaces earlier per-category settings of the same criterion.
      for (const levels of Object.values(categoryPriorities)) if (levels) delete levels[c.criterion];
    }
  }
  return {
    ...trip,
    priorities,
    categoryPriorities,
    ...(wantedAmenities ? { wantedAmenities: [...new Set(wantedAmenities)] } : {}),
    updatedAt: Date.now(),
  };
}

/** Back to the default weights for one category (its overrides and the trip-wide ones it uses). */
export function resetPriorities(trip: Trip, category: Category): Trip {
  const priorities = { ...trip.priorities };
  for (const c of Object.keys(DEFAULT_LEVELS[category]) as CriterionId[]) delete priorities[c];
  const categoryPriorities = { ...trip.categoryPriorities };
  delete categoryPriorities[category];
  return { ...trip, priorities, categoryPriorities, updatedAt: Date.now() };
}

// --- context ------------------------------------------------------------------------------------

export interface DecisionContext {
  trip: Trip;
  tripItems: Item[];
  rates: Rates | null;
  currency: string;
  tripStart: string | null;
  tripNights: number;
  cityCenters: Record<string, { lat: number; lng: number }>;
  analyses: Map<string, Analysis>;
  /** Saved preferences ("sessiz olsun"); the AI analysis reads them, so they are part of its inputs. */
  preferences: string[];
  /** Priority nudges inferred from saves and choices (see intent.ts). */
  inferred: Inferred;
  /** What was read on each place's pages, by listing key (see listing.ts). */
  listings: Map<string, Listing>;
  today: string;
  /** Stays: the nights their group is compared over; prices count per night for these (set per group). */
  groupRange?: { start: string; end: string } | null;
}

export const cityKey = (city: string | null, country: string | null) =>
  [city, country].filter(Boolean).join(", ").toLowerCase();

export function makeContext(
  trip: Trip,
  tripItems: Item[],
  extra: {
    rates?: Rates | null;
    cityCenters?: Record<string, { lat: number; lng: number }>;
    analyses?: Analysis[];
    preferences?: string[];
    inferred?: Inferred;
    listings?: Map<string, Listing>;
    today?: string;
  } = {},
): DecisionContext {
  const range = trip.confirmedDates ?? tripDateRange(tripItems);
  const currencies = tripItems.map((i) => i.price.currency).filter(Boolean) as string[];
  const common = mostCommon(currencies);
  return {
    trip,
    tripItems,
    rates: extra.rates ?? null,
    currency: trip.budget?.currency ?? common ?? "EUR",
    tripStart: range?.start ?? null,
    tripNights: range ? Math.max(1, nightsBetween(range.start, range.end)) : 0,
    cityCenters: extra.cityCenters ?? {},
    analyses: new Map((extra.analyses ?? []).map((a) => [a.needKey, a])),
    preferences: extra.preferences ?? [],
    inferred: extra.inferred ?? new Map(),
    // Trivia read on a page (no smoke alarm, no hair dryer) never weighs on a decision.
    listings: new Map([...(extra.listings ?? new Map<string, Listing>())].map(([k, l]) => [k, usefulListing(l)])),
    today: extra.today ?? new Date().toISOString().slice(0, 10),
  };
}

// --- measuring one option -----------------------------------------------------------------------

/** How a raw value becomes a 0–1 sub-score: relative to the best option, or on an absolute scale. */
type Mode = "lower" | "higher" | "absolute";

interface Measure {
  value: number; // raw, in the criterion's natural unit (money, minutes, 0–1 quality...)
  display: string;
  mode: Mode;
  absolute?: number; // 0–1 when mode is "absolute"
  note?: string;
  /** Set when `value` is walking minutes (location measured from coordinates or a stated distance). */
  unit?: "minutes";
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const MINUTES_OK = 10; // walking minutes that count as "right there"
const MINUTES_FAR = 50; // ...and as "far"
const minutesScore = (m: number) => clamp01(1 - (m - MINUTES_OK) / (MINUTES_FAR - MINUTES_OK));
const qualityScore = (fraction: number) => clamp01((fraction - 0.6) / 0.4); // 6/10 → 0, 10/10 → 1
const decimal = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });

/**
 * A review score as a 0–1 fraction comparable across sites. Airbnb's 5-point scores cluster near the
 * top (4.8 is typical, not exceptional), so they are mapped onto Booking's 10-point range: 4.8 ≈ 8.5.
 */
function reviewFraction(score: number, scale: number, provider: string | null): { fraction: number; calibrated: boolean } {
  if (scale === 5 && /airbnb/i.test(provider ?? "")) {
    return { fraction: clamp01((8.5 + (score - 4.8) * 2.5) / 10), calibrated: true };
  }
  return { fraction: clamp01(score / scale), calibrated: false };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The price to compare, in the trip's currency. Stays compared over a group's nights count per night
 * for all of them, so a flat for 8–12 and a hotel for 7–12 compare fairly (`ownNights` says the stay
 * itself covers fewer).
 */
function comparablePrice(item: Item, ctx: DecisionContext): { amount: number; original: number; currency: string; ownNights: number | null } | null {
  const p = item.price;
  if (p.amount == null || !p.currency) return null;
  let total = p.amount;
  let ownNights: number | null = null;
  const groupNights = item.category === "stay" && ctx.groupRange ? nightsBetween(ctx.groupRange.start, ctx.groupRange.end) : 0;
  const own = stayRange(item);
  const ownCount = own ? nightsBetween(own.start, own.end) : 0;
  if (p.scope === "per_night") {
    const nights = groupNights || ownCount || ctx.tripNights;
    if (!nights) return null;
    total *= nights;
    if (groupNights && ownCount && ownCount !== groupNights) ownNights = ownCount;
  } else {
    // A price per person is for everyone first; a stay's price is then for its own nights.
    if (p.scope === "per_person") {
      if (!item.guests.adults) return null;
      total *= item.guests.adults;
    }
    if (groupNights && ownCount && ownCount !== groupNights) {
      ownNights = ownCount;
      total = (total / ownCount) * groupNights;
    }
  }
  const converted = convert(total, p.currency, ctx.currency, ctx.rates);
  return converted == null ? null : { amount: converted, original: total, currency: p.currency, ownNights };
}

export function cancellationType(item: Item, m: ItemMetrics = metricsOf(item)): ItemMetrics["cancellationType"] {
  if (m.cancellationType !== "unknown") return m.cancellationType;
  const text = item.cancellation.summary ?? "";
  if (/iade (yok|edilmez)|non.?refundable|iadesiz/i.test(text)) return "non_refundable";
  if (/ücretsiz iptal|free cancel/i.test(text)) return "free";
  if (/kısmi|partial|%\s?50/i.test(text)) return "partial";
  return "unknown";
}

const ASPECT_LABELS: Partial<Record<string, string>> = {
  cleanliness: "Temizlik",
  comfort: "Konfor",
  facilities: "Olanaklar",
  staff: "Personel",
  noise: "Sessizlik",
};
const SENTIMENT_VALUE = { positive: 0.9, mixed: 0.65, negative: 0.35 } as const;

function measure(criterion: CriterionId, item: Item, ctx: DecisionContext, analysis: Analysis | null): Measure | null {
  const m = metricsOf(item);
  switch (criterion) {
    case "price": {
      const price = comparablePrice(item, ctx);
      if (!price) return null;
      const original = price.currency !== ctx.currency ? ` (${formatPrice(price.original, price.currency)})` : "";
      if (price.ownNights && ctx.groupRange) {
        const nights = nightsBetween(ctx.groupRange.start, ctx.groupRange.end);
        const perNight = price.amount / nights;
        return {
          value: price.amount,
          display: `${formatPrice(perNight, ctx.currency)}/gece · ${nights} geceye göre ${formatPrice(price.amount, ctx.currency)}`,
          mode: "lower",
          note: `kendi ${price.ownNights} gecesi ${formatPrice(perNight * price.ownNights, ctx.currency)}`,
        };
      }
      return { value: price.amount, display: `${formatPrice(price.amount, ctx.currency)}${original}`, mode: "lower" };
    }
    case "location": {
      if (item.geo) {
        const anchors = locationAnchors(item, ctx);
        if (anchors.points.length) {
          // Median, so one far-off museum doesn't make a central hotel look remote.
          const km = median(anchors.points.map((p) => distanceKm(item.geo!, p)));
          const minutes = walkingMinutes(km);
          return {
            value: minutes,
            display: `${anchors.label} ${anchors.points.length > 2 ? "çoğunlukla " : ""}${formatDistance(km)}`,
            mode: "absolute",
            absolute: minutesScore(minutes),
            note: item.location.approximate ? "konum yaklaşık" : undefined,
            unit: "minutes",
          };
        }
      }
      if (m.distanceToCenterKm != null) {
        const minutes = walkingMinutes(m.distanceToCenterKm);
        return { value: minutes, display: `merkeze ${formatDistance(m.distanceToCenterKm)}`, mode: "absolute", absolute: minutesScore(minutes), unit: "minutes" };
      }
      const aspect = m.reviewAspects.find((a) => a.aspect === "location" && a.score && a.scale);
      if (aspect) {
        const { fraction } = reviewFraction(aspect.score!, aspect.scale!, item.provider);
        return { value: fraction, display: `konum puanı ${decimal(aspect.score!)}/${aspect.scale} (yorumlar)`, mode: "absolute", absolute: qualityScore(fraction) };
      }
      return null;
    }
    case "rating": {
      const r = item.rating;
      if (r.value == null) return null;
      const scale = r.scale ?? (r.value <= 5 ? 5 : 10);
      const n = r.count ?? 5; // unknown count = little evidence
      const { fraction, calibrated } = reviewFraction(r.value, scale, item.provider);
      const adjusted = (fraction * n + 0.8 * 20) / (n + 20); // Bayesian: few reviews pull towards 8/10
      const notes = [r.count != null && r.count < 20 ? "az yorum" : null, calibrated ? "Airbnb ölçeği Booking'e göre ayarlandı" : null];
      return {
        value: adjusted,
        display: `${decimal(r.value)}/${scale}${r.count ? ` · ${r.count.toLocaleString("tr-TR")} yorum` : ""}`,
        mode: "absolute",
        absolute: qualityScore(adjusted),
        note: notes.filter(Boolean).join(" · ") || undefined,
      };
    }
    case "comfort": {
      const parts = m.reviewAspects.filter((a) => a.aspect in ASPECT_LABELS);
      const values = parts
        .map((a) =>
          a.score && a.scale ? reviewFraction(a.score, a.scale, item.provider).fraction : a.sentiment ? SENTIMENT_VALUE[a.sentiment] : null,
        )
        .filter((v): v is number => v != null);
      if (!values.length) return null;
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const shown = parts
        .slice(0, 3)
        .map((a) => `${ASPECT_LABELS[a.aspect]} ${a.score ? a.score.toLocaleString("tr-TR") : a.sentiment === "negative" ? "şikâyet var" : a.sentiment === "positive" ? "övülüyor" : "karışık"}`);
      return { value: avg, display: shown.join(" · "), mode: "absolute", absolute: qualityScore(avg) };
    }
    case "cancellation": {
      const type = cancellationType(item, m);
      if (type === "unknown") return null;
      const expired = type === "free" && item.cancellation.freeUntil != null && item.cancellation.freeUntil < ctx.today;
      const value = expired ? 0.3 : type === "free" ? 1 : type === "partial" ? 0.5 : 0;
      const display =
        item.cancellation.summary ?? (type === "free" ? "Ücretsiz iptal" : type === "partial" ? "Kısmi iade" : "İade yok");
      return { value, display: expired ? `${display} (süresi geçmiş)` : display, mode: "absolute", absolute: value };
    }
    case "amenities": {
      const wanted = wantedAmenities(ctx.trip);
      if (!wanted.length) return null;
      const known = amenitiesOf(item, ctx);
      const has = wanted.filter((a) => known.includes(a));
      const lacking = wanted.filter((a) => !known.includes(a));
      return {
        value: has.length / wanted.length,
        display: `${has.length}/${wanted.length}${lacking.length ? ` · yok/bilinmiyor: ${lacking.join(", ")}` : ""}`,
        mode: "absolute",
        absolute: has.length / wanted.length,
      };
    }
    case "duration": {
      const minutes = m.durationMinutes;
      if (!minutes) return null;
      return { value: minutes, display: formatMinutes(minutes), mode: "lower" };
    }
    case "stops": {
      const stops = item.flight?.stops;
      if (stops == null) return null;
      const value = stops === 0 ? 1 : stops === 1 ? 0.55 : 0.15;
      return { value, display: stops === 0 ? "Direkt" : `${stops} aktarma`, mode: "absolute", absolute: value };
    }
    case "schedule": {
      const dep = hourOf(item.flight?.departure);
      const arr = hourOf(item.flight?.arrival);
      if (dep == null && arr == null) return null;
      let value = 1;
      if (dep != null && (dep < 6 || dep >= 22)) value -= 0.4;
      if (arr != null && (arr < 6 || arr >= 23)) value -= 0.3;
      const fmt = (t?: string | null) => (t ? t.slice(11, 16) : "?");
      return { value, display: `${fmt(item.flight?.departure)} → ${fmt(item.flight?.arrival)}`, mode: "absolute", absolute: clamp01(value) };
    }
    case "baggage": {
      if (m.checkedBagIncluded == null) return null;
      const value = m.checkedBagIncluded ? 1 : 0.4;
      return { value, display: m.checkedBagIncluded ? "Bagaj dahil" : "Yalnız kabin", mode: "absolute", absolute: value };
    }
    case "data": {
      // Enough for ~1 GB a day of maps, messaging and photos counts as full marks.
      const days = ctx.tripNights ? ctx.tripNights + 1 : 7;
      if (m.unlimitedData) return { value: 1, display: "Sınırsız", mode: "absolute", absolute: 1 };
      if (!m.dataGb) return null;
      const perDay = m.dataGb / days;
      return {
        value: clamp01(perDay),
        display: `${m.dataGb} GB (günde ~${perDay.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB)`,
        mode: "absolute",
        absolute: clamp01(perDay),
      };
    }
    case "validity": {
      if (!m.validityDays) return null;
      const need = ctx.tripNights ? ctx.tripNights + 1 : null;
      const value = need ? clamp01(m.validityDays / need) : 1;
      return {
        value,
        display: `${m.validityDays} gün${need ? ` (gezi ${need} gün)` : ""}`,
        mode: "absolute",
        absolute: value,
      };
    }
    case "details": {
      // What the Reader found on the place's pages, weighed by code: verified findings only, old
      // ones count little, and ones the traveller accepted ("sorun değil") don't count against it.
      const listing = ctx.listings.get(listingKeyOf(item));
      if (!listing?.readAt) return null;
      const counted = listing.findings.filter((f) => f.verified);
      if (!counted.length) return null;
      const accepted = new Set(ctx.trip.acceptedFindings ?? []);
      // What they asked for ("sessiz bir yer") weighs more: a quiet room, or a noisy street.
      const said = saidTopics(ctx.preferences);
      let plus = 0;
      let minus = 0;
      for (const f of counted) {
        if (f.polarity === "negative" && accepted.has(acceptKey(listing.key, f))) continue;
        const w = findingWeight(f, listing, ctx.today) * (said.has(f.topic) ? SAID_WEIGHT : 1);
        if (f.polarity === "positive") plus += w;
        else minus += w;
      }
      const value = clamp01(0.5 + (plus - minus) / (2 * Math.max(6, plus + minus)));
      const pros = counted.filter((f) => f.polarity === "positive").length;
      const cons = counted.length - pros;
      return { value, display: `${pros} artı · ${cons} eksi`, mode: "absolute", absolute: value };
    }
    case "ai": {
      if (!analysis || analysis.error) return null;
      const judged = analysis?.aiScores.find((s) => s.itemId === item.id);
      if (!judged) return null;
      const value = clamp01(judged.score / 10);
      return { value, display: `${judged.score}/10 · ${judged.note}`, mode: "absolute", absolute: value };
    }
  }
}

/**
 * Amenities the page lists, plus the ones a close reading shows: "sessiz" when guests praise the
 * quiet and nothing on the page says otherwise, "manzara" when the view is praised.
 */
export function amenitiesOf(item: Item, ctx: Pick<DecisionContext, "listings" | "today">): Amenity[] {
  const listed = metricsOf(item).amenities;
  const listing = ctx.listings.get(listingKeyOf(item));
  if (!listing?.readAt) return listed;
  const said = (topics: FindingTopic[], polarity: Finding["polarity"]) =>
    listing.findings.some((f) => topics.includes(f.topic) && f.polarity === polarity && isDecisive(f, listing, ctx.today));
  const extra: Amenity[] = [];
  if (said(["noise"], "positive") && !said(["noise", "condition"], "negative")) extra.push("sessiz");
  if (said(["view"], "positive")) extra.push("manzara");
  return [...new Set([...listed, ...extra])];
}

/** Points taken off per serious problem (a verified, recent, high-severity con the traveller didn't accept). */
export const SERIOUS_PENALTY = 8;
const MAX_SERIOUS = 2;

/** Serious problems read on the place's pages: each costs SERIOUS_PENALTY points, whatever the weights. */
export function seriousIssues(item: Item, ctx: Pick<DecisionContext, "listings" | "today" | "trip">): Finding[] {
  const listing = ctx.listings.get(listingKeyOf(item));
  if (!listing?.readAt) return [];
  const accepted = new Set(ctx.trip.acceptedFindings ?? []);
  return listing.findings
    .filter((f) => f.polarity === "negative" && f.severity === "high" && isDecisive(f, listing, ctx.today) && !accepted.has(acceptKey(listing.key, f)))
    .slice(0, MAX_SERIOUS);
}

const SEVERITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const;

/** How much a finding counts: severity, how many reviews say it (a little), and whether it's old. */
export function findingWeight(f: Finding, listing: Listing, today: string): number {
  const evidence = evidenceOf(f, listing, today);
  const backing = 1 + Math.min(evidence.count, 10) / 10;
  return SEVERITY_WEIGHT[f.severity] * backing * (evidence.stale ? 0.3 : 1);
}

/** The criterion a finding's topic speaks to, for how much it matters to this traveller. */
export const TOPIC_CRITERION: Record<FindingTopic, CriterionId> = {
  location: "location",
  nearby: "location",
  transport: "location",
  safety: "location",
  cleanliness: "comfort",
  comfort: "comfort",
  bed: "comfort",
  noise: "comfort",
  space: "comfort",
  view: "comfort",
  staff: "comfort",
  host: "comfort",
  food: "comfort",
  condition: "comfort",
  check_in: "comfort",
  accuracy: "comfort",
  amenities: "amenities",
  facilities: "amenities",
  access: "amenities",
  value: "price",
  other: "details",
};

/** Where "location" is measured from: the places saved on the trip, else the chosen stay, else the centre. */
function locationAnchors(item: Item, ctx: DecisionContext): { label: string; points: { lat: number; lng: number }[] } {
  const near = (i: Item) => i.geo && i.status !== "dismissed" && distanceKm(i.geo, item.geo!) < 40;
  if (item.category === "stay") {
    const places = ctx.tripItems.filter((i) => i.id !== item.id && ["activity", "food", "other"].includes(i.category) && near(i));
    if (places.length) return { label: `kaydettiğin ${places.length} yere`, points: places.map((i) => i.geo!) };
  } else {
    const stays = ctx.tripItems.filter((i) => i.category === "stay" && (i.status === "chosen" || i.status === "booked") && near(i));
    if (stays.length) return { label: "konaklamana", points: stays.map((i) => i.geo!) };
  }
  const center = ctx.cityCenters[cityKey(item.city, item.country)];
  return center ? { label: "merkeze", points: [center] } : { label: "", points: [] };
}

/** One criterion measured for one option, outside a comparison (e.g. to read patterns in saves). */
export const measureFor = (criterion: CriterionId, item: Item, ctx: DecisionContext) => measure(criterion, item, ctx, null);

/** The option's full price in the context currency (per-night and per-person prices multiplied out). */
export const totalPrice = (item: Item, ctx: DecisionContext) => comparablePrice(item, ctx)?.amount ?? null;

// --- hard requirements -----------------------------------------------------------------------------

const REQUIREMENT_APPLIES: Record<Requirement["kind"], Category[]> = {
  amenity: ["stay"],
  free_cancellation: ["stay", "flight", "transport", "activity"],
  direct_flight: ["flight"],
  max_walk: ["stay"],
};

export function requirementLabel(r: Requirement): string {
  switch (r.kind) {
    case "amenity":
      return r.amenity;
    case "free_cancellation":
      return "ücretsiz iptal";
    case "direct_flight":
      return "direkt uçuş";
    case "max_walk":
      return `en fazla ${r.minutes} dk yürüme`;
  }
}

/** Unknown when the page didn't say: an amenity missing from a listing is never taken as absent. */
export function checkRequirement(r: Requirement, item: Item, ctx: DecisionContext): "pass" | "fail" | "unknown" | "n/a" {
  if (!REQUIREMENT_APPLIES[r.kind].includes(item.category)) return "n/a";
  const m = metricsOf(item);
  switch (r.kind) {
    case "amenity":
      return amenitiesOf(item, ctx).includes(r.amenity) ? "pass" : "unknown";
    case "free_cancellation": {
      const type = cancellationType(item, m);
      if (type === "unknown") return "unknown";
      const expired = item.cancellation.freeUntil != null && item.cancellation.freeUntil < ctx.today;
      return type === "free" && !expired ? "pass" : "fail";
    }
    case "direct_flight": {
      const stops = item.flight?.stops;
      return stops == null ? "unknown" : stops === 0 ? "pass" : "fail";
    }
    case "max_walk": {
      const location = measure("location", item, ctx, null);
      if (!location || location.unit !== "minutes") return "unknown";
      return location.value <= r.minutes ? "pass" : "fail";
    }
  }
}

// --- deciding within one need ----------------------------------------------------------------------

export interface Part {
  criterion: CriterionId;
  label: string;
  level: PriorityLevel;
  weight: number;
  s: number | null; // 0–1 sub-score; null = unknown for this option
  value: number | null;
  display: string | null;
  note?: string;
}

export interface OptionResult {
  item: Item;
  score: number | null; // 0–100; null when the data isn't enough to score fairly
  confidence: number; // share of the weight backed by real data
  parts: Part[];
  missing: string[];
  /** A stay covering only some of its group's nights (compared per night; the rest needs another bed). */
  coverage?: { range: { start: string; end: string }; nights: number; of: number } | null;
  excluded: string | null;
  /** Another option is at least as good on everything that matters and better on something. */
  dominatedBy: string | null;
  /** Hard requirements it fails ("ücretsiz iptal"); such an option can't be recommended. */
  unmet: string[];
  /** Requirements the page didn't answer; worth checking before booking. */
  unsure: string[];
  /** Ruled out for this traveller by the assistant, citing findings still on record and not accepted. */
  eliminated: { reason: string; findings: Finding[] } | null;
  /** Scored without something it needs (e.g. no price yet): provisional, ranked after complete options. */
  limited: string[];
  /** Serious problems taken off the score (SERIOUS_PENALTY points each). */
  penalties: Finding[];
}

export interface Reason {
  criterion: CriterionId;
  /** Distinct key when the criterion alone isn't unique (serious problems). */
  key?: string;
  label: string;
  points: number; // contribution to the score gap, in score points
  text: string;
}

export interface GroupDecision {
  /** The group's key (see groupKeyOf): stays by exact nights, other needs by need key. */
  key: string;
  category: Category;
  status: "ok" | "tie" | "single" | "insufficient";
  options: OptionResult[]; // ranked; unscorable and excluded last
  winner: OptionResult | null;
  runnerUp: OptionResult | null;
  reasons: Reason[];
  tradeoffs: Reason[];
  flips: { criterion: CriterionId; label: string; winner: string }[];
  /** Criteria that, if they didn't matter to the traveller, would crown another option. */
  unless: { criterion: CriterionId; label: string; winner: string }[];
  summary: string;
  criteria: CriterionId[];
  /** Hash of everything the AI analysis sees (excluding its own scores) — decides if it is stale. */
  inputHash: string;
  /** The cached AI analysis for this group, when it matches the current inputs. */
  analysis: Analysis | null;
  /** The last AI analysis attempt for these exact inputs failed. */
  analysisFailure: { error: string; at: number } | null;
  /**
   * The last good analysis when it was made for earlier inputs: shown with its date while a new one
   * is pending, so a busy model doesn't make the advice disappear.
   */
  staleAnalysis: Analysis | null;
  /** Eliminations the assistant proposed that the evidence doesn't back: shown as "kontrol gerekiyor". */
  checks: { itemId: string; reason: string }[];
}

const MIN_CONFIDENCE = 0.6;
const TIE_POINTS = 2;

/**
 * Two passes: without AI scores first (that result's hash identifies the inputs); the cached AI
 * analysis is used only if it was made for exactly these inputs, so a stale AI note never counts.
 * Eliminations are different: they rest on findings about a place, so they hold while those findings
 * do, whatever else changed in the group.
 */
export function decideGroup(groupItems: Item[], ctx: DecisionContext, key = groupItems[0] ? groupKeyOf(groupItems[0]) : ""): GroupDecision {
  const record = ctx.analyses.get(key) ?? null;
  const plain = decideWith(groupItems, ctx, key, null, record);
  if (!record) return plain;
  // A record with only an error is a failure; anything else holds a usable analysis.
  const good = record.verdict || !record.error ? record : null;
  if (good && good.inputHash === plain.inputHash) {
    return { ...decideWith(groupItems, ctx, key, good, record), inputHash: plain.inputHash, analysis: good };
  }
  const failedFor = record.error ? (record.errorHash ?? record.inputHash) : null;
  return {
    ...plain,
    analysisFailure: failedFor === plain.inputHash ? { error: record.error!, at: record.errorAt ?? record.createdAt } : null,
    staleAnalysis: good,
  };
}

/** The assistant's eliminations that the evidence still backs, and the ones to show as "kontrol gerekiyor". */
function eliminationsOf(record: Analysis | null, eligible: Item[], ctx: DecisionContext) {
  const byItem = new Map<string, NonNullable<OptionResult["eliminated"]>>();
  const checks: GroupDecision["checks"] = [];
  const accepted = new Set(ctx.trip.acceptedFindings ?? []);
  for (const e of record?.eliminations ?? []) {
    const item = eligible.find((i) => i.id === e.itemId);
    if (!item) continue;
    const listing = ctx.listings.get(listingKeyOf(item));
    // By id; if the place was read again since (texts, so ids, may differ), by the same kind of finding.
    const cited = listing
      ? [
          ...new Set(
            e.findingIds.flatMap((id) => {
              const exact = listing.findings.find((f) => f.id === id);
              if (exact) return [exact];
              const kind = id.split(":").slice(0, 2).join(":");
              return listing.findings.filter((f) => `${f.topic}:${f.polarity}` === kind);
            }),
          ),
        ]
      : [];
    const open = cited.filter((f) => !accepted.has(acceptKey(listing!.key, f)));
    // The traveller said every cited finding is fine: nothing left to say.
    if (cited.length && !open.length) continue;
    const backing = open.filter((f) => isDecisive(f, listing!, ctx.today));
    if (backing.length) byItem.set(item.id, { reason: e.reason, findings: backing });
    else checks.push({ itemId: item.id, reason: e.reason });
  }
  return { byItem, checks };
}

function decideWith(groupItems: Item[], ctx: DecisionContext, key: string, analysis: Analysis | null, record: Analysis | null = analysis): GroupDecision {
  const category = groupItems[0]?.category ?? "other";
  // Stays are compared for their group's nights: a price per night (or a stay saved without dates)
  // counts for those nights, not the whole trip.
  const groupNights = category === "stay" ? rangeOfGroupKey(key) : null;
  if (groupNights) ctx = { ...ctx, tripNights: nightsBetween(groupNights.start, groupNights.end), groupRange: groupNights };
  const active = groupItems.filter((i) => i.status !== "dismissed");

  // Stays for other nights aren't alternatives for the same need: keep them out of the ranking. A
  // group's nights are the span of stays that overlap (see plan.ts); any of those is in.
  const excluded = new Map<string, string>();
  if (category === "stay" && groupNights) {
    for (const i of active) {
      const r = stayRange(i);
      if (r && !(r.start < groupNights.end && groupNights.start < r.end)) excluded.set(i.id, "Farklı tarih için fiyat");
    }
  } else if (category === "stay") {
    const majority = mostCommon(active.map((i) => `${i.dates.start}|${i.dates.end}`).filter((k) => k !== "null|null"));
    for (const i of active) {
      if (majority && i.dates.start && `${i.dates.start}|${i.dates.end}` !== majority) excluded.set(i.id, "Farklı tarih için fiyat");
    }
  }
  const eligible = active.filter((i) => !excluded.has(i.id));

  // Every applicable criterion is measured, even ones set to "önemsiz": they then weigh 0 but stay
  // visible in the comparison and can still show "raise this and the result flips".
  const allCriteria = (Object.keys(DEFAULT_LEVELS[category]) as CriterionId[]).filter(
    (c) => c !== "amenities" || Boolean(wantedAmenities(ctx.trip).length),
  );
  const measures = new Map(eligible.map((i) => [i.id, new Map(allCriteria.map((c) => [c, measure(c, i, ctx, analysis)]))]));
  const enough = eligible.length > 1 ? 2 : 1;
  const criteria = allCriteria.filter((c) => eligible.filter((i) => measures.get(i.id)!.get(c)).length >= enough);

  const subScore = (c: CriterionId, itemId: string): number | null => {
    const mine = measures.get(itemId)!.get(c);
    if (!mine) return null;
    if (mine.mode === "absolute") return mine.absolute ?? null;
    const values = eligible.map((i) => measures.get(i.id)!.get(c)?.value).filter((v): v is number => v != null && v > 0);
    if (!values.length || mine.value <= 0) return null;
    return mine.mode === "lower" ? Math.min(...values) / mine.value : mine.value / Math.max(...values);
  };

  // A serious problem (verified, recent, high severity) costs points directly: a weighted average
  // alone would let one construction site next door sink into ten other criteria.
  const serious = new Map(eligible.map((i) => [i.id, seriousIssues(i, ctx)]));
  const score = (itemId: string, levels: Partial<Record<CriterionId, PriorityLevel>> = {}) => {
    let total = 0;
    let weight = 0;
    let known = 0;
    const parts: Part[] = criteria.map((c) => {
      const level = levels[c] ?? levelFor(ctx.trip, category, c, ctx.inferred);
      const w = LEVEL_WEIGHT[level];
      const s = subScore(c, itemId);
      const m = measures.get(itemId)!.get(c);
      total += w * (s ?? 0.5); // unknown counts as neutral, and lowers confidence
      weight += w;
      if (s != null) known += w;
      return { criterion: c, label: CRITERION_LABELS[c], level, weight: w, s, value: m?.value ?? null, display: m?.display ?? null, note: m?.note };
    });
    const penalty = serious.get(itemId)!.length * SERIOUS_PENALTY;
    return { value: weight ? Math.max(0, (100 * total) / weight - penalty) : 0, confidence: weight ? known / weight : 0, parts };
  };

  const required = REQUIRED[category] ?? [];
  const { byItem: eliminated, checks } = eliminationsOf(record, eligible, ctx);
  let options: OptionResult[] = eligible.map((item) => {
    const s = score(item.id);
    const missing = s.parts.filter((p) => p.s == null).map((p) => p.label.toLocaleLowerCase("tr"));
    // Missing information limits the verdict instead of stopping it: the option is scored on what is
    // known and ranked after complete ones until the rest arrives.
    const lacking = required.filter((c) => !measures.get(item.id)!.get(c));
    for (const c of lacking) if (!missing.includes(CRITERION_LABELS[c].toLocaleLowerCase("tr"))) missing.unshift(CRITERION_LABELS[c].toLocaleLowerCase("tr"));
    // A price in another currency with no exchange rate is known, just not comparable yet.
    const limited = lacking.map((c) => (c === "price" && item.price.amount != null ? "kur bilgisi" : CRITERION_LABELS[c].toLocaleLowerCase("tr")));
    // Saved without dates: its price isn't this stay's price yet (no fees, maybe a "from" rate).
    if (groupNights && !stayRange(item) && !lacking.includes("price")) limited.push("bu gecelerin fiyatı");
    const scorable = s.confidence >= MIN_CONFIDENCE && criteria.length > 0;
    const unmet: string[] = [];
    const unsure: string[] = [];
    for (const r of ctx.trip.requirements ?? []) {
      const result = checkRequirement(r, item, ctx);
      if (result === "fail") unmet.push(requirementLabel(r));
      if (result === "unknown") unsure.push(requirementLabel(r));
    }
    const own = stayRange(item);
    const coverage =
      groupNights && own && (own.start !== groupNights.start || own.end !== groupNights.end)
        ? { range: own, nights: nightsBetween(own.start, own.end), of: nightsBetween(groupNights.start, groupNights.end) }
        : null;
    return {
      item,
      score: scorable ? Math.round(s.value) : null,
      confidence: s.confidence,
      parts: s.parts,
      missing,
      coverage,
      excluded: null,
      dominatedBy: null,
      unmet,
      unsure,
      eliminated: eliminated.get(item.id) ?? null,
      limited: scorable ? limited : [],
      penalties: serious.get(item.id)!,
    };
  });
  // Complete, compliant options first; then provisional ones; then ones that fail a requirement or
  // were ruled out for this traveller; unscorable last.
  const tier = (o: OptionResult) => (o.score == null ? 3 : o.unmet.length || o.eliminated ? 2 : o.limited.length ? 1 : 0);
  options.sort((a, b) => tier(a) - tier(b) || (b.score ?? -1) - (a.score ?? -1));
  markDominated(options.filter((o) => o.score != null));
  options = [
    ...options,
    ...active.filter((i) => excluded.has(i.id)).map(
      (item): OptionResult => ({
        item,
        score: null,
        confidence: 0,
        parts: [],
        missing: [],
        coverage: null,
        excluded: excluded.get(item.id)!,
        dominatedBy: null,
        unmet: [],
        unsure: [],
        eliminated: null,
        limited: [],
        penalties: [],
      }),
    ),
  ];

  const scored = options.filter((o) => o.score != null);
  const base = {
    key,
    category,
    options,
    criteria,
    inputHash: hashInputs(category, options, ctx),
    analysis: null,
    analysisFailure: null,
    staleAnalysis: null,
    checks,
    unless: [],
  };
  if (eligible.length === 1) {
    return { ...base, status: "single", winner: null, runnerUp: null, reasons: [], tradeoffs: [], flips: [], summary: "Karşılaştırmak için bu ihtiyaca bir seçenek daha kaydet." };
  }
  if (scored.length < 2) {
    const missing = [...new Set(options.flatMap((o) => o.missing))].slice(0, 3);
    return {
      ...base,
      status: "insufficient",
      winner: null,
      runnerUp: null,
      reasons: [],
      tradeoffs: [],
      flips: [],
      summary: `Adil bir karşılaştırma için bilgi eksik${missing.length ? `: ${missing.join(", ")}` : ""}.`,
    };
  }

  const [first, second] = scored;
  const { reasons, tradeoffs } = explain(first, second);
  // Options failing a requirement or ruled out can't be crowned by a change of weights either.
  const out = (o: OptionResult) => o.unmet.length > 0 || o.eliminated != null;
  const contenders = out(first) ? scored : scored.filter((o) => !out(o));
  const flips = sensitivity(first, contenders, criteria, score);
  const unless = whatIfNot(first, contenders, criteria, score);
  const failing = scored.filter((o) => o.unmet.length);
  const ruledOut = scored.filter((o) => o.eliminated && !o.unmet.length);
  const provisional = scored.filter((o) => o.limited.length && !out(o));
  const failNote = [
    failing.length ? `${failing.map((o) => o.item.name).join(", ")} şartına uymuyor (${[...new Set(failing.flatMap((o) => o.unmet))].join(", ")}).` : null,
    ...ruledOut.map((o) => `${o.item.name} elendi: ${o.eliminated!.reason}.`),
    provisional.length
      ? `${provisional.map((o) => o.item.name).join(", ")}: ${[...new Set(provisional.flatMap((o) => o.limited))].join(", ")} eksik, gelince yeniden tartılır.`
      : null,
  ]
    .filter(Boolean)
    .map((t) => ` ${t}`)
    .join("");
  // Only options on the same footing can tie: a complete option isn't "level" with a provisional or ruled-out one.
  if (tier(first) === tier(second) && first.score! - second.score! < TIE_POINTS) {
    return {
      ...base,
      status: "tie",
      winner: null,
      runnerUp: null,
      reasons,
      tradeoffs,
      flips,
      unless,
      summary: `${first.item.name} ile ${second.item.name} başa baş (${first.score} – ${second.score}). Karar önceliklerine kalmış.${failNote}`,
    };
  }
  const why = reasons.slice(0, 2).map((r) => r.label.toLocaleLowerCase("tr")).join(" ve ");
  const cost = tradeoffs[0] ? ` Karşılığında ${tradeoffs[0].label.toLocaleLowerCase("tr")} tarafında geride.` : "";
  return {
    ...base,
    status: "ok",
    winner: first,
    runnerUp: second,
    reasons,
    tradeoffs,
    flips,
    unless,
    summary: `${first.item.name} öne çıkıyor (${first.score} – ${second.score})${why ? `: ${why} farkı yaratıyor.` : "."}${cost}${failNote}`,
  };
}

const SAME = 0.02; // sub-scores this close count as equal

/**
 * Marks options another one beats or matches on every criterion that matters (price included) —
 * safe to drop whatever the weights. Checked against better-ranked options first.
 */
function markDominated(scored: OptionResult[]): void {
  for (const b of scored) {
    for (const a of scored) {
      // An option that breaks a requirement or was ruled out can't make another one redundant.
      const outA = a.unmet.length > 0 || a.eliminated != null;
      const outB = b.unmet.length > 0 || b.eliminated != null;
      if (a === b || (outA && !outB)) continue;
      let common = 0;
      let better = false;
      let worse = false;
      let price = false;
      for (const pa of a.parts) {
        const pb = b.parts.find((p) => p.criterion === pa.criterion);
        if (!pb || pa.s == null || pb.s == null || pa.weight === 0 || pa.criterion === "ai") continue;
        common++;
        if (pa.criterion === "price") price = true;
        if (pa.s > pb.s + SAME) better = true;
        if (pa.s < pb.s - SAME) worse = true;
      }
      // Three shared criteria at least: with sparse data "better on everything" means little.
      if (common >= 3 && price && better && !worse) {
        b.dominatedBy = a.item.name;
        break;
      }
    }
  }
}

/** Per-criterion contribution to the gap between two options, in score points. */
function explain(a: OptionResult, b: OptionResult): { reasons: Reason[]; tradeoffs: Reason[] } {
  const totalWeight = a.parts.reduce((s, p) => s + p.weight, 0) || 1;
  const rows = a.parts
    .map((pa) => {
      const pb = b.parts.find((p) => p.criterion === pa.criterion);
      if (!pb || pa.s == null || pb.s == null || pa.weight === 0) return null;
      const points = (100 * pa.weight * (pa.s - pb.s)) / totalWeight;
      return {
        criterion: pa.criterion,
        label: pa.label,
        points: Math.round(points * 10) / 10,
        text: `${pa.label}: ${pa.display} — ${b.item.name}: ${withoutSharedStart(pa.display ?? "", pb.display ?? "")}`,
      };
    })
    .filter((r): r is Reason => r != null && Math.abs(r.points) >= 0.5);
  // Serious problems taken off one side's score and not the other's.
  const gap = (b.penalties.length - a.penalties.length) * SERIOUS_PENALTY;
  if (gap) {
    const worse = gap > 0 ? b : a;
    rows.push({
      criterion: "details",
      key: "serious",
      label: "Ciddi sorun",
      points: gap,
      text: `Ciddi sorun: ${worse.item.name} — ${worse.penalties.map((f) => f.text.toLocaleLowerCase("tr")).join(", ")}`,
    });
  }
  return {
    reasons: rows.filter((r) => r.points > 0).sort((x, y) => y.points - x.points).slice(0, 4),
    tradeoffs: rows.filter((r) => r.points < 0).sort((x, y) => x.points - y.points).slice(0, 3),
  };
}

/** Which single priority change would crown a different option? ("Fiyatı çok önemli yaparsan…") */
function sensitivity(
  winner: OptionResult,
  scored: OptionResult[],
  criteria: CriterionId[],
  score: (id: string, levels?: Partial<Record<CriterionId, PriorityLevel>>) => { value: number; confidence: number },
): GroupDecision["flips"] {
  const flips: GroupDecision["flips"] = [];
  for (const c of criteria) {
    if (c === "ai") continue;
    const levels = { [c]: 4 as PriorityLevel };
    const top = scored
      .map((o) => ({ o, v: score(o.item.id, levels).value }))
      .sort((x, y) => y.v - x.v)[0];
    if (top && top.o.item.id !== winner.item.id) flips.push({ criterion: c, label: CRITERION_LABELS[c], winner: top.o.item.name });
  }
  return flips.slice(0, 3);
}

/** Which single criterion, if the traveller didn't care about it, would put another option first. */
function whatIfNot(
  winner: OptionResult,
  contenders: OptionResult[],
  criteria: CriterionId[],
  score: (id: string, levels?: Partial<Record<CriterionId, PriorityLevel>>) => { value: number; confidence: number },
): GroupDecision["unless"] {
  const result: GroupDecision["unless"] = [];
  for (const c of criteria) {
    const mine = winner.parts.find((p) => p.criterion === c);
    if (c === "ai" || !mine || mine.weight === 0) continue;
    const levels = { [c]: 0 as PriorityLevel };
    const top = contenders.map((o) => ({ o, v: score(o.item.id, levels).value })).sort((x, y) => y.v - x.v)[0];
    if (top && top.o.item.id !== winner.item.id) result.push({ criterion: c, label: CRITERION_LABELS[c], winner: top.o.item.name });
  }
  return result;
}

// --- short labels for the board -------------------------------------------------------------------

/** One-line reason to still consider an option that didn't win ("€45 daha ucuz", "12 dk daha yakın"). */
export function advantageOver(option: OptionResult, winner: OptionResult, currency: string): string | null {
  let best: { gain: number; text: string } | null = null;
  for (const p of option.parts) {
    const w = winner.parts.find((x) => x.criterion === p.criterion);
    if (!w || p.s == null || w.s == null || p.s <= w.s || p.weight === 0) continue;
    const gain = p.weight * (p.s - w.s);
    const text = advantageText(p, w, currency);
    if (text && (!best || gain > best.gain)) best = { gain, text };
  }
  return best?.text ?? null;
}

function advantageText(p: Part, w: Part, currency: string): string | null {
  const diff = p.value != null && w.value != null ? Math.abs(p.value - w.value) : null;
  switch (p.criterion) {
    case "price":
      return diff ? `${formatPrice(diff, currency)} daha ucuz` : "daha ucuz";
    case "location":
      return diff && diff >= 1 && (p.display ?? "").includes("dk") ? `${Math.round(diff)} dk daha yakın` : "konumu daha iyi";
    case "rating":
      return "yorumları daha iyi";
    case "comfort":
      return "daha konforlu";
    case "cancellation":
      return "iptal daha esnek";
    case "amenities":
      return "istediğin olanaklar daha çok";
    case "duration":
      return diff ? `${formatMinutes(diff)} daha kısa` : "daha kısa";
    case "stops":
      return "daha az aktarma";
    case "schedule":
      return "saatleri daha uygun";
    case "baggage":
      return "bagaj dahil";
    case "data":
      return "daha çok veri";
    case "validity":
      return "daha uzun geçerli";
    case "details":
      return "yorum ve detaylarda daha iyi";
    case "ai":
      return "AI değerlendirmesi daha olumlu";
  }
}

// --- whole trip ------------------------------------------------------------------------------------

/** Every need still being decided, keyed like the plan: settled (booked) needs aren't ranked. */
export function decideTrip(items: Item[], ctx: DecisionContext): Map<string, GroupDecision> {
  const groups = liveGroups(buildPlan(ctx.trip, items));
  return new Map(groups.map((g) => [g.key, decideGroup(g.items, ctx, g.key)]));
}

// --- helpers ---------------------------------------------------------------------------------------

/** "kaydettiğin 5 yere 43 dk" after "kaydettiğin 5 yere 6 dk" reads better as just "43 dk". */
function withoutSharedStart(first: string, second: string): string {
  const a = first.split(" ");
  const b = second.split(" ");
  let i = 0;
  while (i < a.length - 1 && i < b.length - 1 && a[i] === b[i]) i++;
  return b.slice(i).join(" ");
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} sa${m ? ` ${m} dk` : ""}` : `${m} dk`;
}

function hourOf(time: string | null | undefined): number | null {
  const match = time?.match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) + Number(match[2]) / 60 : null;
}

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
}

/** Bumped when the analysis prompt changes in a way old analyses can't carry (2: findings cited by ref). */
const ANALYSIS_VERSION = 2;

function hashInputs(category: Category, options: OptionResult[], ctx: DecisionContext): string {
  const input = JSON.stringify({
    v: ANALYSIS_VERSION,
    p: ctx.trip.priorities ?? {},
    cp: ctx.trip.categoryPriorities?.[category] ?? {},
    req: ctx.trip.requirements ?? [],
    inf: [...ctx.inferred].filter(([k]) => k.startsWith(`${category}:`)).map(([k, v]) => [k, v.delta]),
    a: ctx.trip.wantedAmenities ?? [],
    n: ctx.preferences,
    o: options.map((o) => ({
      id: o.item.id,
      s: o.item.status,
      x: o.excluded,
      // The original price, not the converted one: daily rate moves shouldn't re-run the analysis.
      price: [o.item.price.amount, o.item.price.currency, o.item.price.scope],
      parts: o.parts.filter((p) => p.criterion !== "ai" && p.criterion !== "price").map((p) => [p.criterion, p.display]),
      r: o.item.reviewSummary,
      c: o.item.concerns,
      h: o.item.highlights,
      // What was read about the place: new findings are new evidence for the analysis.
      f: ctx.listings.get(listingKeyOf(o.item))?.findings.map((f) => (f.verified ? f.id : `?${f.id}`)) ?? null,
    })),
    acc: (ctx.trip.acceptedFindings ?? []).filter((k) => options.some((o) => k.startsWith(`${listingKeyOf(o.item)}#`))),
  });
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
