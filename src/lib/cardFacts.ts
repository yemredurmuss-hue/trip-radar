// What a decision card shows, from the saved record and the engine's result: where it's from, what it
// is, what it costs for these dates, where it stands, and the two things for and against it that
// matter most. Pure, and no model calls: everything on a card is read from a page or computed.
import { advantageOver, amenityLabel, levelFor, levelSource, saidTopics, TOPIC_CRITERION, type DecisionContext, type GroupDecision } from "./decision";
import { L } from "./i18n";
import { capitalize, count, hoursMinutes, liveLabels, nDays, nNights, nReviews, nStops, num } from "./i18nText";
import { formatDateRange, formatPrice, listingKeyOf, metricsOf, nightsBetween, type Tone } from "./items";
import { decisionLabel } from "./labels";
import { rangeOfGroupKey, stayRange } from "./plan";
import { checkNeeds, type NeedCheck } from "./needs";
import { cardLines, prosConsFor, tagOf, type ProCon } from "./proscons";
import type { CriterionId, Item, Listing, StayKind } from "./types";

export interface CardFacts {
  /** The site or company it's from ("Booking.com", "TAP Air Portugal"), the site's host for its icon, and its page. */
  source: { label: string; host: string | null; url: string | null } | null;
  image: string | null;
  title: string;
  subtitle: string | null;
  /** The total (for a stay: its own nights) and, for stays, the price per night. */
  price: { text: string; label: string | null; perNight: string | null; provisional: boolean; note?: string } | null;
  score: number | null;
  best: boolean;
  /** Where it stands ("En uygun · konum", "Elendi", "Seçildi"); null when the pros and cons say it. */
  status: { text: string; tone: Tone } | null;
  /** Ruled out or failing a requirement: shown last and dimmed. */
  out: boolean;
  /** What the traveller asked for, checked on this one: "Mutfak var", "İade yok", "Sessiz odalar · 3 yorum". */
  needs: NeedCheck[];
  /** A few words each, the biggest first, beyond the needs: "Gezeceğin yerlere 6 dk"... `mine`: it touches a priority the traveller gave. */
  pros: { text: string; mine: boolean; unique?: boolean }[];
  /** Against it, the biggest (or the reason it's out) first: "İade yok", "Uzak"... */
  cons: { text: string; strong: boolean; mine: boolean; unique?: boolean }[];
}

const STAY_KIND_LABELS: Readonly<Record<StayKind, string>> = liveLabels({
  hotel_room: ["Otel odası", "Hotel room"],
  apartment: ["Daire", "Apartment"],
  house: ["Ev", "House"],
  guesthouse: ["Pansiyon", "Guesthouse"],
  hostel: ["Hostel", "Hostel"],
  other: ["Konaklama", "Stay"],
});

const bedrooms = (n: number) => count(n, "yatak odası", "bedroom");

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
  return label ? { label, host, url: item.url } : null;
}

const clock = (iso: string | null | undefined) => (iso && /T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : null);

export function durationText(minutes: number): string {
  return hoursMinutes(minutes);
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
      return join([m.stayKind && m.stayKind !== "other" ? STAY_KIND_LABELS[m.stayKind] : null, m.bedrooms ? bedrooms(m.bedrooms) : null]);
    case "flight":
    case "transport": {
      const stops = item.flight?.stops;
      return (
        join([
          timesText(item),
          item.category === "flight" && stops != null ? (stops === 0 ? L("Direkt", "Direct") : nStops(stops)) : null,
          m.durationMinutes ? durationText(m.durationMinutes) : null,
        ]) ?? (item.summary || null)
      );
    }
    case "esim":
      return join([m.unlimitedData ? L("Sınırsız", "Unlimited") : m.dataGb ? `${m.dataGb} GB` : null, m.validityDays ? nDays(m.validityDays) : null]) ?? (item.summary || null);
    default: {
      const day = item.dates.start ? formatDateRange(item.dates.start, null) : null;
      return join([day, clock(item.flight?.departure), m.durationMinutes ? durationText(m.durationMinutes) : null]);
    }
  }
}

const SCOPE_LABELS: Readonly<Record<Exclude<Item["price"]["scope"], "unknown">, string>> = liveLabels({
  total: ["toplam", "total"],
  per_night: ["/gece", "/night"],
  per_person: ["kişi başı", "per person"],
});
const scopeLabel = (scope: Item["price"]["scope"]) => (scope === "unknown" ? null : SCOPE_LABELS[scope]);

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
      if (whole == null) return { text: formatPrice(item.price.amount, money), label: SCOPE_LABELS.per_person, perNight: null, provisional };
      perNight = item.price.scope === "per_night" ? whole : ownNights ? whole / ownNights : null;
      if (perNight == null) return { text: formatPrice(item.price.amount, money), label: SCOPE_LABELS.total, perNight: null, provisional };
    }
    if (perNight == null) return null;
    const nights = ownNights || groupNights;
    return {
      text: formatPrice(perNight * (nights || 1), money),
      label: nights ? L(`${nights} gece toplam`, `${nNights(nights)} total`) : L("gecelik", "per night"),
      perNight: nights ? `${formatPrice(perNight, money)} / ${L("gece", "night")}` : null,
      provisional,
    };
  }
  if (compared != null) {
    let label: string | null = SCOPE_LABELS.total;
    if ((item.category === "flight" || item.category === "transport") && item.guests.adults) {
      const n = item.guests.adults;
      label = n === 1 ? SCOPE_LABELS.per_person : L(`${n} kişi toplam`, `${n} people total`);
    }
    return { text: formatPrice(compared, currency), label, perNight: null, provisional };
  }
  if (item.price.amount == null) return null;
  return { text: formatPrice(item.price.amount, item.price.currency), label: scopeLabel(item.price.scope), perNight: null, provisional };
}

/**
 * A line the traveller's own words stand behind: a requirement, or a criterion they (or what they
 * said) made important, the reason an option is out included. Defaults don't count.
 */
function touchesPriority(
  line: ProCon,
  item: Item,
  ctx: (Pick<DecisionContext, "trip" | "inferred"> & { preferences?: string[] }) | undefined,
): boolean {
  if (!ctx) return false;
  const said = saidTopics(ctx.preferences ?? []);
  if (line.kind === "requirement") return true;
  const topic = line.finding?.topic ?? null;
  if (topic && said.has(topic)) return true;
  // "Elendi: yan binada inşaat; sessiz bir yer istiyorsun": out because of what they said.
  if (line.kind === "elimination" && [...saidTopics([line.text])].some((t) => said.has(t))) return true;
  const criterion = line.key.startsWith("c:") ? (line.key.slice(2) as CriterionId) : topic ? TOPIC_CRITERION[topic] : null;
  if (!criterion) return false;
  if ((criterion === "cancellation" || criterion === "location") && said.has(criterion)) return true;
  return levelSource(ctx.trip, item.category, criterion, ctx.inferred) !== "default" && levelFor(ctx.trip, item.category, criterion, ctx.inferred) >= 3;
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

type CardCtx = Pick<DecisionContext, "trip" | "today" | "currency" | "inferred" | "listings"> & { preferences?: string[] };

/** The traveller's needs checked on an option, against the others it's compared with. */
export function needsFor(item: Item, decision: GroupDecision | undefined, ctx: CardCtx | undefined, listings: Map<string, Listing> | undefined = ctx?.listings): NeedCheck[] {
  const option = decision?.options.find((o) => o.item.id === item.id);
  const peers = decision?.options.filter((o) => o !== option && !o.excluded && o.parts.length) ?? [];
  return checkNeeds(item, option, peers, ctx, listings?.get(listingKeyOf(item)));
}

/**
 * A line as the card says it: what was read on the page in its own words, whole ("Temizlik standartları
 * misafirler tarafından yüksek bulunuyor"), never cut, the card's layout gives it the room; a comparison
 * in its card form ("€45 daha ucuz", "Gezeceğin yerlere 6 dk").
 */
const cardText = (l: ProCon, side: "pro" | "con") => {
  if (!l.finding) return tagOf(l, side);
  return capitalize(l.text.trim());
};

export function cardFacts(
  item: Item,
  decision: GroupDecision | undefined,
  ctx: CardCtx | undefined,
  listings: Map<string, Listing> | undefined = ctx?.listings,
): CardFacts {
  const currency = ctx?.currency ?? "EUR";
  const option = decision?.options.find((o) => o.item.id === item.id);
  const lines = cardLines(prosConsFor(item, decision, listings, ctx), 8);
  const needs = needsFor(item, decision, ctx, listings);
  // One tag per thing: "Uzak" from the comparison and "Konum zayıf" from the reviews say the same; and
  // what a need already says ("Mutfak var", "Ücretsiz iptal") isn't said again below it.
  const said = new Set<string>(needs.flatMap((n) => n.covers.flatMap((k) => [k, TAG_TOPICS[k] ?? k])));
  const once = (l: ProCon, text: string) => {
    const about = TAG_TOPICS[l.key] ?? (l.finding && TAG_TOPICS[`t:${l.finding.topic}`]) ?? text;
    if (said.has(about) || said.has(text) || said.has(l.key)) return false;
    said.add(about).add(text);
    return true;
  };
  const mine = (l: ProCon) => touchesPriority(l, item, ctx);
  // The reason an option is out already says what the finding behind it says.
  for (const l of lines.cons) if (l.kind === "elimination" && l.finding) said.add(`f:${l.finding.id}`);
  const pros = lines.pros
    .map((l) => ({ l, text: cardText(l, "pro") }))
    .filter((x) => once(x.l, x.text))
    .map((x) => ({ text: x.text, mine: mine(x.l), ...(x.l.unique ? { unique: true } : {}) }))
    .slice(0, 4);
  const cons: CardFacts["cons"] = lines.cons
    .map((l) => ({ l, text: cardText(l, "con") }))
    .filter((x) => once(x.l, x.text))
    .map((x) => ({ text: x.text, strong: Boolean(x.l.decisive || x.l.serious), mine: mine(x.l), ...(x.l.unique ? { unique: true } : {}) }));
  const label = item.status === "saved" ? decisionLabel(item, decision, currency) : null;
  const status: CardFacts["status"] =
    item.status === "booked"
      ? { text: L("Rezerve ✓", "Booked ✓"), tone: "success" }
      : item.status === "chosen"
        ? { text: L("Seçildi", "Chosen"), tone: "accent" }
        : label && label.tone !== "muted"
          ? { text: label.text, tone: label.tone }
          : null;
  return {
    source: sourceOf(item),
    image: item.category === "flight" ? null : item.imageUrl,
    title: item.name,
    subtitle: subtitleOf(item),
    price: (() => {
      // Only some of the nights: said with the price, as a fact, not as a minus.
      const p = priceOf(item, decision, currency);
      const c = option?.coverage;
      return p && c ? { ...p, note: L(`${c.of} gecelik konaklamanın yalnız ${c.nights} gecesi`, `only ${c.nights} of the ${c.of} nights`) } : p;
    })(),
    score: option && !option.excluded ? option.score : null,
    best: Boolean(label?.best),
    status,
    out: Boolean(option?.eliminated || option?.unmet.length),
    needs,
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
    lines.push(
      L(
        `${winner.item.name} ${gap > 0 ? `${gap} puan önde` : "başa baş"}${better ? `; bunun artısı: ${better}` : ""}.`,
        `${winner.item.name} ${gap > 0 ? `is ${gap} point${gap === 1 ? "" : "s"} ahead` : "is level"}${better ? `; this one's plus: ${better}` : ""}.`,
      ),
    );
  }
  const ai = (decision.analysis ?? decision.staleAnalysis)?.aiScores.find((s) => s.itemId === item.id);
  if (ai?.note) lines.push(`${L("AI incelemesi", "AI review")}: ${ai.note}`);
  return lines;
}

export interface CardDetails {
  /** The needs again, when opened (the front shows the first few). */
  needs: NeedCheck[];
  /** Where it stands in one sentence ("Ribeira Rooms 27 puan önde; bunun artısı: €45 daha ucuz."). */
  verdict: string | null;
  /** The facts that decide, filtered: dates, what it is, rating, cancellation, times... only what's known. */
  facts: { label: string; value: string }[];
  pros: { text: string; detail: string | null }[];
  cons: { text: string; detail: string | null; strong: boolean }[];
}

const CANCELLATION_WORDS = liveLabels({ free: ["Ücretsiz iptal", "Free cancellation"], partial: ["Kısmi iade", "Partial refund"], non_refundable: ["İade yok", "Non-refundable"] });
const cancellationWord = (type: keyof typeof CANCELLATION_WORDS | "unknown") => (type === "unknown" ? null : CANCELLATION_WORDS[type]);

const dayOf = (iso: string | null | undefined) => (iso ? formatDateRange(iso.slice(0, 10), null) : null);

/** "8,9 / 10 · 1.204 yorum". */
function ratingText(item: Item): string | null {
  const r = item.rating;
  if (r.value == null || !r.scale) return null;
  return [`${num(r.value)} / ${r.scale}`, r.count ? nReviews(r.count) : null].filter(Boolean).join(" · ");
}

/** The facts' labels. */
const F = liveLabels({
  date: ["Tarih", "Dates"],
  place: ["Yer", "Place"],
  guests: ["Kişi", "Guests"],
  rating: ["Puan", "Rating"],
  cancellation: ["İptal", "Cancellation"],
  checkInOut: ["Giriş / çıkış", "Check-in / out"],
  centre: ["Merkeze", "To the centre"],
  amenities: ["Olanaklar", "Amenities"],
  departure: ["Kalkış", "Departs"],
  arrival: ["Varış", "Arrives"],
  duration: ["Süre", "Duration"],
  stops: ["Aktarma", "Stops"],
  operator: ["İşletme", "Operator"],
  baggage: ["Bagaj", "Baggage"],
  fare: ["Tarife", "Fare"],
  data: ["Veri", "Data"],
  validity: ["Geçerlilik", "Validity"],
  price: ["Fiyat", "Price"],
});

const adults = (n: number) => count(n, "yetişkin", "adult");

function factsOf(item: Item, listing: Listing | null): CardDetails["facts"] {
  const m = metricsOf(item);
  const facts: CardDetails["facts"] = [];
  const add = (label: string, value: string | null | undefined | false) => {
    if (value) facts.push({ label, value });
  };
  const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ") || null;
  const cancellation = item.cancellation.summary ?? cancellationWord(m.cancellationType);
  switch (item.category) {
    case "stay": {
      const r = stayRange(item);
      add(F.date, r ? `${formatDateRange(r.start, r.end)} · ${nNights(nightsBetween(r.start, r.end))}` : L("Tarih seçilmeden kaydedildi", "Saved without dates"));
      add(F.place, join([m.stayKind && m.stayKind !== "other" ? STAY_KIND_LABELS[m.stayKind] : null, m.bedrooms ? bedrooms(m.bedrooms) : null, item.location.area ?? item.city]));
      const children = item.guests.children;
      add(F.guests, item.guests.adults ? `${adults(item.guests.adults)}${children ? `, ${count(children, "çocuk", "child", "children")}` : ""}` : null);
      add(F.rating, ratingText(item));
      add(F.cancellation, cancellation);
      const h = listing?.house;
      add(F.checkInOut, h && (h.checkInFrom || h.checkOutUntil) ? `${h.checkInFrom ?? "?"} / ${h.checkOutUntil ?? "?"}` : null);
      add(F.centre, m.distanceToCenterKm != null ? `${num(m.distanceToCenterKm)} km` : null);
      add(F.amenities, m.amenities.length ? m.amenities.slice(0, 6).map(amenityLabel).join(", ") : null);
      break;
    }
    case "flight":
    case "transport": {
      const f = item.flight;
      add(F.departure, join([clock(f?.departure), dayOf(f?.departure ?? item.dates.start), f?.from]));
      add(F.arrival, join([clock(f?.arrival), f?.arrival ? dayOf(f.arrival) : null, f?.to]));
      add(F.duration, m.durationMinutes ? durationText(m.durationMinutes) : null);
      add(F.stops, item.category === "flight" && f?.stops != null ? (f.stops === 0 ? L("Direkt", "Direct") : nStops(f.stops)) : null);
      add(F.operator, join([f?.carrier ?? item.provider, f?.flightNumber]));
      add(F.baggage, m.checkedBagIncluded == null ? null : m.checkedBagIncluded ? L("Bavul dahil", "Checked bag included") : L("Bavul dahil değil", "No checked bag"));
      add(F.fare, item.optionDetail);
      add(F.guests, item.guests.adults ? adults(item.guests.adults) : null);
      add(F.cancellation, cancellation);
      break;
    }
    case "esim":
      add(F.data, m.unlimitedData ? L("Sınırsız", "Unlimited") : m.dataGb ? `${m.dataGb} GB` : null);
      add(F.validity, m.validityDays ? nDays(m.validityDays) : null);
      break;
    default:
      add(F.date, join([dayOf(item.dates.start), clock(item.flight?.departure)]));
      add(F.duration, m.durationMinutes ? durationText(m.durationMinutes) : null);
      add(F.place, item.location.address ?? item.location.area ?? item.city);
      add(F.rating, ratingText(item));
      add(F.cancellation, cancellation);
  }
  if (item.price.taxesIncluded === "no") add(F.price, L("Vergiler dahil değil", "Taxes not included"));
  return facts;
}

/**
 * What a card says when opened, kept short: one line on where it stands, the facts that decide, and
 * the few things for and against it that matter. Everything read stays in "Tüm detaylar".
 */
export function cardDetails(
  item: Item,
  decision: GroupDecision | undefined,
  ctx: CardCtx | undefined,
  listings: Map<string, Listing> | undefined = ctx?.listings,
): CardDetails {
  const pc = prosConsFor(item, decision, listings, ctx);
  const needs = needsFor(item, decision, ctx, listings);
  const covered = new Set(needs.flatMap((n) => n.covers));
  const fresh = <T extends { stale?: boolean; accepted?: boolean; key: string }>(l: T) => !l.stale && !l.accepted && !covered.has(l.key);
  return {
    needs,
    verdict: whyLines(item, decision, ctx?.currency ?? "EUR")[0] ?? null,
    facts: factsOf(item, listings?.get(listingKeyOf(item)) ?? null),
    pros: (pc?.pros ?? []).filter(fresh).slice(0, 4).map((l) => ({ text: l.text, detail: l.detail })),
    cons: (pc?.cons ?? []).filter(fresh).slice(0, 4).map((l) => ({ text: l.text, detail: l.detail, strong: Boolean(l.decisive || l.serious) })),
  };
}
