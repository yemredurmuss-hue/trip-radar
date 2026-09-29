// What a decision card shows, from the saved record and the engine's result: where it's from, what it
// is, what it costs for these dates, where it stands, and the two things for and against it that
// matter most. Pure, and no model calls: everything on a card is read from a page or computed.
import { advantageOver, type DecisionContext, type GroupDecision } from "./decision";
import { formatDateRange, formatPrice, listingKeyOf, metricsOf, nightsBetween, type Tone } from "./items";
import { decisionLabel } from "./labels";
import { rangeOfGroupKey, stayRange } from "./plan";
import { cardLines, prosConsFor, tagOf, type ProCon } from "./proscons";
import type { Item, Listing, StayKind } from "./types";

export interface CardFacts {
  /** The site or company it's from ("Booking.com", "TAP Air Portugal"), with the site's host for its icon. */
  source: { label: string; host: string | null } | null;
  image: string | null;
  title: string;
  subtitle: string | null;
  /** The total (for a stay: its own nights) and, for stays, the price per night. */
  price: { text: string; label: string | null; perNight: string | null; provisional: boolean } | null;
  score: number | null;
  best: boolean;
  /** Where it stands ("En uygun · konum", "Elendi", "Seçildi"); null when the pros and cons say it. */
  status: { text: string; tone: Tone } | null;
  /** Ruled out or failing a requirement: shown last and dimmed. */
  out: boolean;
  /** Short tags, the biggest first (shown on top): "Yakın", "Ücretsiz iptal"... */
  pros: string[];
  /** Short tags against it, the biggest (or the reason it's out) first: "İade yok", "Uzak"... */
  cons: { text: string; strong: boolean }[];
}

const STAY_KIND_LABELS: Record<StayKind, string> = {
  hotel_room: "Otel odası",
  apartment: "Daire",
  house: "Ev",
  guesthouse: "Pansiyon",
  hostel: "Hostel",
  other: "Konaklama",
};

const SITE_NAMES: [RegExp, string][] = [
  [/(^|\.)booking\.com$/, "Booking.com"],
  [/(^|\.)airbnb\./, "Airbnb"],
  [/(^|\.)expedia\./, "Expedia"],
  [/(^|\.)hotels\.com$/, "Hotels.com"],
  [/(^|\.)agoda\./, "Agoda"],
  [/(^|\.)vrbo\./, "Vrbo"],
  [/(^|\.)getyourguide\./, "GetYourGuide"],
  [/(^|\.)tripadvisor\./, "Tripadvisor"],
  [/(^|\.)skyscanner\./, "Skyscanner"],
  [/(^|\.)google\./, "Google"],
];

export function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function sourceOf(item: Item): CardFacts["source"] {
  const host = hostOf(item.url);
  const site = host ? SITE_NAMES.find(([re]) => re.test(host))?.[1] : undefined;
  const label = item.provider?.trim() || site || host;
  return label ? { label, host } : null;
}

const clock = (iso: string | null | undefined) => (iso && /T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : null);

export function durationText(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} sa${m ? ` ${m} dk` : ""}` : `${m} dk`;
}

/** "09:00–11:10", with "+1" when it lands the next day. */
function timesText(item: Item): string | null {
  const [dep, arr] = [clock(item.flight?.departure), clock(item.flight?.arrival)];
  if (!dep) return null;
  if (!arr) return dep;
  const days = nightsBetween(item.flight!.departure!.slice(0, 10), item.flight!.arrival!.slice(0, 10));
  return `${dep}–${arr}${days > 0 ? `+${days}` : ""}`;
}

function subtitleOf(item: Item): string | null {
  const m = metricsOf(item);
  const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || null;
  switch (item.category) {
    case "stay":
      // What it is, not the district's official name ("União de Freguesias do Centro"): that's in the details.
      return join([m.stayKind && m.stayKind !== "other" ? STAY_KIND_LABELS[m.stayKind] : null, m.bedrooms ? `${m.bedrooms} yatak odası` : null]);
    case "flight":
    case "transport": {
      const stops = item.flight?.stops;
      return (
        join([
          timesText(item),
          item.category === "flight" && stops != null ? (stops === 0 ? "Direkt" : `${stops} aktarma`) : null,
          m.durationMinutes ? durationText(m.durationMinutes) : null,
        ]) ?? (item.summary || null)
      );
    }
    case "esim":
      return join([m.unlimitedData ? "Sınırsız" : m.dataGb ? `${m.dataGb} GB` : null, m.validityDays ? `${m.validityDays} gün` : null]) ?? (item.summary || null);
    default: {
      const day = item.dates.start ? formatDateRange(item.dates.start, null) : null;
      return join([day, clock(item.flight?.departure), m.durationMinutes ? durationText(m.durationMinutes) : null]);
    }
  }
}

const SCOPE_LABELS: Record<Item["price"]["scope"], string | null> = { total: "toplam", per_night: "/gece", per_person: "kişi başı", unknown: null };

/**
 * The price for these dates in the trip's currency when the engine compared it, else as the page gave
 * it. Stays show the total for their own nights and the price per night (what compares fairly when
 * stays cover different nights).
 */
function priceOf(item: Item, decision: GroupDecision | undefined, currency: string): CardFacts["price"] {
  const option = decision?.options.find((o) => o.item.id === item.id);
  const provisional = Boolean(option?.limited.length);
  const compared = option?.parts.find((p) => p.criterion === "price")?.value;
  if (item.category === "stay") {
    const own = stayRange(item);
    const group = decision ? rangeOfGroupKey(decision.key) : null;
    const ownNights = own ? nightsBetween(own.start, own.end) : 0;
    const groupNights = group ? nightsBetween(group.start, group.end) : ownNights;
    let perNight: number | null = null;
    let money = currency;
    if (compared != null && groupNights) perNight = compared / groupNights;
    else if (item.price.amount != null) {
      money = item.price.currency ?? currency;
      // A price per person is for everyone first (unknown how many: shown as the page gives it).
      const whole = item.price.scope === "per_person" ? (item.guests.adults ? item.price.amount * item.guests.adults : null) : item.price.amount;
      if (whole == null) return { text: formatPrice(item.price.amount, money), label: "kişi başı", perNight: null, provisional };
      perNight = item.price.scope === "per_night" ? whole : ownNights ? whole / ownNights : null;
      if (perNight == null) return { text: formatPrice(item.price.amount, money), label: "toplam", perNight: null, provisional };
    }
    if (perNight == null) return null;
    const nights = ownNights || groupNights;
    return {
      text: formatPrice(perNight * (nights || 1), money),
      label: nights ? `${nights} gece toplam` : "gecelik",
      perNight: nights ? `${formatPrice(perNight, money)} / gece` : null,
      provisional,
    };
  }
  if (compared != null) {
    let label: string | null = "toplam";
    if ((item.category === "flight" || item.category === "transport") && item.guests.adults) {
      label = item.guests.adults === 1 ? "kişi başı" : `${item.guests.adults} kişi toplam`;
    }
    return { text: formatPrice(compared, currency), label, perNight: null, provisional };
  }
  if (item.price.amount == null) return null;
  return { text: formatPrice(item.price.amount, item.price.currency), label: SCOPE_LABELS[item.price.scope], perNight: null, provisional };
}

/** Lines about the same thing share a tag slot (by comparison key or finding topic). */
const TAG_TOPICS: Record<string, string> = {
  "c:location": "location",
  "t:location": "location",
  "c:cancellation": "cancellation",
  "c:price": "price",
  "t:value": "price",
  "c:rating": "reviews",
  "c:comfort": "reviews",
};

export function cardFacts(
  item: Item,
  decision: GroupDecision | undefined,
  ctx: Pick<DecisionContext, "trip" | "today" | "currency" | "inferred" | "listings"> | undefined,
  listings: Map<string, Listing> | undefined = ctx?.listings,
): CardFacts {
  const currency = ctx?.currency ?? "EUR";
  const option = decision?.options.find((o) => o.item.id === item.id);
  const lines = cardLines(prosConsFor(item, decision, listings, ctx), 8);
  // One tag per thing: "Uzak" from the comparison and "Konum zayıf" from the reviews say the same.
  const said = new Set<string>();
  const once = (l: ProCon, text: string) => {
    const about = TAG_TOPICS[l.key] ?? (l.finding && TAG_TOPICS[`t:${l.finding.topic}`]) ?? text;
    if (said.has(about) || said.has(text)) return false;
    said.add(about).add(text);
    return true;
  };
  const pros = lines.pros.map((l) => ({ l, text: tagOf(l, "pro") })).filter((x) => once(x.l, x.text)).map((x) => x.text).slice(0, 4);
  const cons: CardFacts["cons"] = lines.cons
    .map((l) => ({ l, text: tagOf(l, "con") }))
    .filter((x) => once(x.l, x.text))
    .map((x) => ({ text: x.text, strong: Boolean(x.l.decisive || x.l.serious) }));
  const label = item.status === "saved" ? decisionLabel(item, decision, currency) : null;
  const status: CardFacts["status"] =
    item.status === "booked"
      ? { text: "Rezerve ✓", tone: "success" }
      : item.status === "chosen"
        ? { text: "Seçildi", tone: "accent" }
        : label && label.tone !== "muted"
          ? { text: label.text, tone: label.tone }
          : null;
  return {
    source: sourceOf(item),
    image: item.category === "flight" ? null : item.imageUrl,
    title: item.name,
    subtitle: subtitleOf(item),
    price: priceOf(item, decision, currency),
    score: option && !option.excluded ? option.score : null,
    best: Boolean(label?.best),
    status,
    out: Boolean(option?.eliminated || option?.unmet.length),
    pros,
    cons: cons.slice(0, 4),
  };
}

/**
 * Why it stands where it does, for the card's details: the best option's reasons, how far behind
 * another one is (and what it does better), and the AI review's note on it.
 */
export function whyLines(item: Item, decision: GroupDecision | undefined, currency: string): string[] {
  const option = decision?.options.find((o) => o.item.id === item.id);
  if (!decision || !option || decision.status === "single") return [];
  const lines: string[] = [];
  const winner = decision.winner;
  if (winner?.item.id === item.id) {
    lines.push(...decision.reasons.slice(0, 3).map((r) => r.text));
  } else if (winner && option.score != null && winner.score != null) {
    const gap = Math.round(winner.score - option.score);
    const better = advantageOver(option, winner, currency);
    lines.push(`${winner.item.name} ${gap > 0 ? `${gap} puan önde` : "başa baş"}${better ? `; bunun artısı: ${better}` : ""}.`);
  }
  const ai = (decision.analysis ?? decision.staleAnalysis)?.aiScores.find((s) => s.itemId === item.id);
  if (ai?.note) lines.push(`AI incelemesi: ${ai.note}`);
  return lines;
}

export interface CardDetails {
  /** Where it stands in one sentence ("Ribeira Rooms 27 puan önde; bunun artısı: €45 daha ucuz."). */
  verdict: string | null;
  /** The facts that decide, filtered: dates, what it is, rating, cancellation, times... only what's known. */
  facts: { label: string; value: string }[];
  pros: { text: string; detail: string | null }[];
  cons: { text: string; detail: string | null; strong: boolean }[];
}

const CANCELLATION_WORDS = { free: "Ücretsiz iptal", partial: "Kısmi iade", non_refundable: "İade yok", unknown: null } as const;

const dayOf = (iso: string | null | undefined) => (iso ? formatDateRange(iso.slice(0, 10), null) : null);

/** "8,9 / 10 · 1.204 yorum". */
function ratingText(item: Item): string | null {
  const r = item.rating;
  if (r.value == null || !r.scale) return null;
  const value = r.value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  return [`${value} / ${r.scale}`, r.count ? `${r.count.toLocaleString("tr-TR")} yorum` : null].filter(Boolean).join(" · ");
}

function factsOf(item: Item, listing: Listing | null): CardDetails["facts"] {
  const m = metricsOf(item);
  const facts: CardDetails["facts"] = [];
  const add = (label: string, value: string | null | undefined | false) => {
    if (value) facts.push({ label, value });
  };
  const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || null;
  const cancellation = item.cancellation.summary ?? CANCELLATION_WORDS[m.cancellationType];
  switch (item.category) {
    case "stay": {
      const r = stayRange(item);
      add("Tarih", r ? `${formatDateRange(r.start, r.end)} · ${nightsBetween(r.start, r.end)} gece` : "Tarih seçilmeden kaydedildi");
      add("Yer", join([m.stayKind && m.stayKind !== "other" ? STAY_KIND_LABELS[m.stayKind] : null, m.bedrooms ? `${m.bedrooms} yatak odası` : null, item.location.area ?? item.city]));
      add("Kişi", item.guests.adults ? `${item.guests.adults} yetişkin${item.guests.children ? `, ${item.guests.children} çocuk` : ""}` : null);
      add("Puan", ratingText(item));
      add("İptal", cancellation);
      const h = listing?.house;
      add("Giriş / çıkış", h && (h.checkInFrom || h.checkOutUntil) ? `${h.checkInFrom ?? "?"} / ${h.checkOutUntil ?? "?"}` : null);
      add("Merkeze", m.distanceToCenterKm != null ? `${m.distanceToCenterKm.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} km` : null);
      add("Olanaklar", m.amenities.length ? m.amenities.slice(0, 6).join(", ") : null);
      break;
    }
    case "flight":
    case "transport": {
      const f = item.flight;
      add("Kalkış", join([clock(f?.departure), dayOf(f?.departure ?? item.dates.start), f?.from]));
      add("Varış", join([clock(f?.arrival), f?.arrival ? dayOf(f.arrival) : null, f?.to]));
      add("Süre", m.durationMinutes ? durationText(m.durationMinutes) : null);
      add("Aktarma", item.category === "flight" && f?.stops != null ? (f.stops === 0 ? "Direkt" : `${f.stops} aktarma`) : null);
      add("Bagaj", m.checkedBagIncluded == null ? null : m.checkedBagIncluded ? "Bavul dahil" : "Bavul dahil değil");
      add("Tarife", item.optionDetail);
      add("Kişi", item.guests.adults ? `${item.guests.adults} yetişkin` : null);
      add("İptal", cancellation);
      break;
    }
    case "esim":
      add("Veri", m.unlimitedData ? "Sınırsız" : m.dataGb ? `${m.dataGb} GB` : null);
      add("Geçerlilik", m.validityDays ? `${m.validityDays} gün` : null);
      break;
    default:
      add("Tarih", join([dayOf(item.dates.start), clock(item.flight?.departure)]));
      add("Süre", m.durationMinutes ? durationText(m.durationMinutes) : null);
      add("Yer", item.location.address ?? item.location.area ?? item.city);
      add("Puan", ratingText(item));
      add("İptal", cancellation);
  }
  if (item.price.taxesIncluded === "no") add("Fiyat", "Vergiler dahil değil");
  return facts;
}

/**
 * What a card says when opened, kept short: one line on where it stands, the facts that decide, and
 * the few things for and against it that matter. Everything read stays in "Tüm detaylar".
 */
export function cardDetails(
  item: Item,
  decision: GroupDecision | undefined,
  ctx: Pick<DecisionContext, "trip" | "today" | "currency" | "inferred" | "listings"> | undefined,
  listings: Map<string, Listing> | undefined = ctx?.listings,
): CardDetails {
  const pc = prosConsFor(item, decision, listings, ctx);
  const fresh = <T extends { stale?: boolean; accepted?: boolean }>(l: T) => !l.stale && !l.accepted;
  return {
    verdict: whyLines(item, decision, ctx?.currency ?? "EUR")[0] ?? null,
    facts: factsOf(item, listings?.get(listingKeyOf(item)) ?? null),
    pros: (pc?.pros ?? []).filter(fresh).slice(0, 4).map((l) => ({ text: l.text, detail: l.detail })),
    cons: (pc?.cons ?? []).filter(fresh).slice(0, 4).map((l) => ({ text: l.text, detail: l.detail, strong: Boolean(l.decisive || l.serious) })),
  };
}
