// What a decision card shows, from the saved record and the engine's result: where it's from, what it
// is, what it costs for these dates, where it stands, and the two things for and against it that
// matter most. Pure, and no model calls: everything on a card is read from a page or computed.
import { advantageOver, type DecisionContext, type GroupDecision } from "./decision";
import { formatDateRange, formatPrice, metricsOf, nightsBetween, type Tone } from "./items";
import { decisionLabel } from "./labels";
import { rangeOfGroupKey, stayRange } from "./plan";
import { cardLines, prosConsFor, shortText } from "./proscons";
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
  pros: string[];
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
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
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
      return (
        join([
          m.stayKind && m.stayKind !== "other" ? STAY_KIND_LABELS[m.stayKind] : null,
          m.bedrooms ? `${m.bedrooms} yatak odası` : null,
          item.location.area,
        ]) ??
        item.optionDetail ??
        (item.summary || null)
      );
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
      return join([day, clock(item.flight?.departure), m.durationMinutes ? durationText(m.durationMinutes) : null, item.location.area]) ?? (item.summary || null);
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
      perNight = item.price.scope === "per_night" ? item.price.amount : ownNights ? item.price.amount / ownNights : null;
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

export function cardFacts(
  item: Item,
  decision: GroupDecision | undefined,
  ctx: Pick<DecisionContext, "trip" | "today" | "currency" | "inferred" | "listings"> | undefined,
  listings: Map<string, Listing> | undefined = ctx?.listings,
): CardFacts {
  const currency = ctx?.currency ?? "EUR";
  const option = decision?.options.find((o) => o.item.id === item.id);
  const lines = cardLines(prosConsFor(item, decision, listings, ctx));
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
    pros: lines.pros.map(shortText),
    cons: lines.cons.map((l) => ({ text: shortText(l), strong: Boolean(l.decisive || l.serious) })),
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
