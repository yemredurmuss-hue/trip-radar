// What the traveller wants, checked on every option: "Mutfak var", "İade yok", "Sessiz: 3 yorum övüyor".
// The needs are what "Seni böyle anladım" says (requirements, wanted amenities, criteria they made
// important, and the things their notes ask for), so a card answers first "is what I asked for here?".
// Pure; nothing is guessed: a thing the page doesn't say is "yazmıyor", never "yok".
import {
  amenityLabel,
  amenityState,
  cancellationType,
  CRITERION_LABELS,
  findingWeight,
  levelFor,
  levelSource,
  locationBasis,
  measureFor,
  ratingOutOf10,
  saidTopics,
  touchesTopic,
  wantedAmenities,
  type DecisionContext,
  type OptionResult,
} from "./decision";
import { L } from "./i18n";
import { capitalize, liveLabels, nReviews, nStops, num } from "./i18nText";
import { formatDateRange, formatPrice, listingKeyOf, metricsOf } from "./items";
import { acceptKey, evidenceOf } from "./listing";
import type { Category, CriterionId, Finding, Item, Listing } from "./types";

export type NeedState = "yes" | "no" | "unknown";

export interface NeedCheck {
  /** "a:mutfak", "c:cancellation", "t:noise". */
  key: string;
  /** The need, in a word or two: "Mutfak", "Ücretsiz iptal", "Sessiz". */
  label: string;
  state: NeedState;
  /** What this option has for it, short: "Mutfak var", "İade yok", "Sessiz odalar · 3 yorum". */
  text: string;
  /** The pros/cons lines it stands for (they aren't repeated under it on the card). */
  covers: string[];
}

type Ctx = Pick<DecisionContext, "trip" | "today" | "currency" | "inferred" | "listings"> & { preferences?: string[] };

const capital = capitalize;

/** Finding topics their notes ask for, with the word a card uses for them. */
const TOPIC_NEEDS: Readonly<Partial<Record<Finding["topic"], string>>> = liveLabels({
  noise: ["Sessiz", "Quiet"],
  cleanliness: ["Temiz", "Clean"],
  food: ["Kahvaltı / yemek", "Breakfast / food"],
  space: ["Geniş", "Spacious"],
  view: ["Manzara", "View"],
  bed: ["İyi yatak", "Good bed"],
  access: ["Kolay erişim", "Easy access"],
  safety: ["Güvenli", "Safe"],
});

/** Criteria a card checks when the traveller made them important (said, or read from their choices). */
const CRITERION_NEEDS: Readonly<Partial<Record<CriterionId, string>>> = liveLabels({
  location: ["Yakın konum", "Close by"],
  cancellation: ["Ücretsiz iptal", "Free cancellation"],
  price: ["Uygun fiyat", "Good price"],
  rating: ["Yüksek puan", "High rating"],
  comfort: ["İyi yorumlar", "Good reviews"],
  stops: ["Direkt", "Direct"],
  duration: ["Kısa yolculuk", "Short journey"],
  baggage: ["Bagaj dahil", "Bag included"],
  schedule: ["Rahat saat", "Easy times"],
});

const important = (ctx: Ctx, category: Category, c: CriterionId) =>
  levelSource(ctx.trip, category, c, ctx.inferred) !== "default" && levelFor(ctx.trip, category, c, ctx.inferred) >= 3;

/** Short: "Gezeceğin yerlere 6 dk", "Merkeze 1,2 km", "Konum puanı 9,2/10" (or "Centre 1.2 km", "6 min to your places"). */
export function locationText(display: string | null | undefined): string | null {
  if (!display) return null;
  const distance = display.match(/(\d+(?:[,.]\d+)?\s*(?:dk|min|km|m)\b)/)?.[1];
  const basis = locationBasis(display);
  if (basis === "centre") return distance ? L(`Merkeze ${distance}`, `${distance} to the centre`) : capital(display);
  if (basis === "score") return capital(display.replace(/\s*\((yorumlar|reviews)\)$/, ""));
  return distance ? L(`Gezeceğin yerlere ${distance}`, `${distance} to your places`) : capital(display);
}

/** "Ücretsiz iptal · son gün 5 Eki", "İade yok", "Kısmi iade". */
export function cancellationText(item: Item, today: string): { state: NeedState; text: string } {
  const type = cancellationType(item);
  const until = item.cancellation.freeUntil;
  const free = L("Ücretsiz iptal", "Free cancellation");
  if (type === "free" && until && until < today) return { state: "no", text: L("Ücretsiz iptal süresi geçti", "Free cancellation has expired") };
  if (type === "free") return { state: "yes", text: until ? `${free} · ${L("son gün", "until")} ${formatDateRange(until, null)}` : free };
  if (type === "partial") return { state: "no", text: L("Kısmi iade", "Partial refund") };
  if (type === "non_refundable") return { state: "no", text: L("İade yok", "Non-refundable") };
  return { state: "unknown", text: L("İptal koşulu yazmıyor", "Cancellation terms not stated") };
}

function criterionCheck(c: CriterionId, item: Item, option: OptionResult | undefined, peers: OptionResult[], ctx: Ctx, limit?: number): Omit<NeedCheck, "key" | "label"> | null {
  const part = option?.parts.find((p) => p.criterion === c);
  const covers = [`c:${c}`];
  switch (c) {
    case "cancellation":
      return { ...cancellationText(item, ctx.today), covers };
    case "location": {
      const m = measureFor("location", item, ctx as DecisionContext);
      if (!m) return { state: "unknown", text: L("Konumu belli değil", "Location not known"), covers };
      const text = locationText(m.display) ?? L("Konum", "Location");
      if (limit != null && m.unit === "minutes") return { state: m.value <= limit ? "yes" : "no", text, covers };
      const s = part?.s ?? null;
      return { state: s == null ? "unknown" : s >= 0.6 ? "yes" : "no", text, covers };
    }
    case "price": {
      if (part?.value == null) return { state: "unknown", text: L("Fiyat belli değil", "Price not known"), covers };
      const values = peers.map((o) => o.parts.find((x) => x.criterion === "price")?.value).filter((v): v is number => v != null);
      if (!values.length) return null;
      const average = (part.value + values.reduce((a, b) => a + b, 0)) / (values.length + 1);
      const gap = formatPrice(Math.abs(part.value - average), ctx.currency);
      if (part.value < Math.min(...values) - 0.5) return { state: "yes", text: L("En ucuz", "Cheapest"), covers };
      return part.value <= average
        ? { state: "yes", text: L(`Ortalamadan ${gap} ucuz`, `${gap} below average`), covers }
        : { state: "no", text: L(`Ortalamadan ${gap} pahalı`, `${gap} above average`), covers };
    }
    case "rating": {
      const r = item.rating;
      const ten = ratingOutOf10(item);
      if (r.value == null || !ten) return { state: "unknown", text: L("Puanı yok", "No rating"), covers };
      const raw = `${L("Puan", "Rating")} ${num(r.value)}/${r.scale ?? (r.value <= 5 ? 5 : 10)}`;
      // The site's own number, and what it is on the common scale when that differs (Airbnb's 4,3 ≈ 7,3/10).
      const text = ten.calibrated ? `${raw} (≈${num(ten.value)}/10)` : raw;
      return { state: ten.value >= 8.5 ? "yes" : "no", text, covers };
    }
    case "comfort": {
      if (part?.s == null) return { state: "unknown", text: L("Yorum puanı yok", "No review scores"), covers };
      return {
        state: part.s >= 0.6 ? "yes" : "no",
        text: part.s >= 0.6 ? L("Yorum puanları yüksek", "High review scores") : L("Yorum puanları düşük", "Low review scores"),
        covers,
      };
    }
    case "stops": {
      const stops = item.flight?.stops;
      if (stops == null) return { state: "unknown", text: L("Aktarma bilgisi yok", "No info on stops"), covers };
      return { state: stops === 0 ? "yes" : "no", text: stops === 0 ? L("Direkt", "Direct") : nStops(stops), covers };
    }
    case "baggage": {
      const bag = metricsOf(item).checkedBagIncluded;
      if (bag == null) return { state: "unknown", text: L("Bagaj bilgisi yok", "No baggage info"), covers };
      return { state: bag ? "yes" : "no", text: bag ? L("Bagaj dahil", "Bag included") : L("Yalnız kabin bagajı", "Cabin bag only"), covers };
    }
    case "duration":
    case "schedule": {
      if (part?.s == null) return null;
      return { state: part.s >= 0.6 ? "yes" : "no", text: `${CRITERION_LABELS[c]}: ${part.display}`, covers };
    }
    default:
      return null;
  }
}

/** What the page's reviews say on a topic: the problem first (a noisy street outweighs a quiet room). */
function topicCheck(topic: Finding["topic"], label: string, listing: Listing | undefined, ctx: Ctx): Omit<NeedCheck, "key" | "label"> {
  if (!listing?.readAt) return { state: "unknown", text: `${label}: ${L("sayfa okunmadı", "page not read")}`, covers: [] };
  const accepted = new Set(ctx.trip.acceptedFindings ?? []);
  const found = listing.findings.filter((f) => f.verified && touchesTopic(f, topic) && !evidenceOf(f, listing, ctx.today).faded);
  const against = found.filter((f) => f.polarity === "negative" && !accepted.has(acceptKey(listing.key, f)));
  const pick = (list: Finding[]) => {
    const f = [...list].sort((a, b) => evidenceOf(b, listing, ctx.today).count - evidenceOf(a, listing, ctx.today).count)[0];
    const n = evidenceOf(f, listing, ctx.today).count;
    return `${capital(f.text)}${n ? ` · ${nReviews(n)}` : ""}`;
  };
  const covers = found.map((f) => `f:${f.id}`);
  const for_ = found.filter((f) => f.polarity === "positive");
  // Both said: the better backed side wins ("sessiz odalar" in five reviews, "bir gece gürültü" in one).
  const weigh = (list: Finding[]) => list.reduce((sum, f) => sum + findingWeight(f, listing, ctx.today), 0);
  if (against.length && weigh(against) >= weigh(for_)) return { state: "no", text: pick(against), covers };
  if (for_.length) return { state: "yes", text: pick(for_), covers };
  return { state: "unknown", text: `${label}: ${L("yorumlarda geçmiyor", "not mentioned in reviews")}`, covers };
}

/**
 * The traveller's needs, checked on one option, in the order they matter: requirements and amenities
 * they asked for, then what their notes ask for, then criteria they (or their choices) made important.
 */
export function checkNeeds(item: Item, option: OptionResult | undefined, peers: OptionResult[], ctx: Ctx | undefined, listing?: Listing): NeedCheck[] {
  if (!ctx) return [];
  const category = item.category;
  const out: NeedCheck[] = [];
  const seen = new Set<string>();
  const push = (key: string, label: string, check: Omit<NeedCheck, "key" | "label"> | null) => {
    if (!check || seen.has(key)) return;
    seen.add(key);
    out.push({ key, label, ...check });
  };
  const said = saidTopics(ctx.preferences ?? []);
  const page = listing ?? ctx.listings.get(listingKeyOf(item));

  if (category === "stay") {
    for (const a of wantedAmenities(ctx.trip)) {
      const state = amenityState(item, a, ctx as DecisionContext);
      const name = amenityLabel(a);
      const text =
        state === "yes"
          ? L(`${capital(name)} var`, `Has ${name}`)
          : state === "no"
            ? L(`${capital(name)} yok`, `No ${name}`)
            : L(`${capital(name)} yazmıyor`, `${capital(name)} not stated`);
      push(`a:${a}`, capital(name), { state, text, covers: ["c:amenities"] });
    }
  }
  for (const r of ctx.trip.requirements ?? []) {
    if (r.kind === "free_cancellation" && category !== "esim") push("c:cancellation", CRITERION_NEEDS.cancellation!, criterionCheck("cancellation", item, option, peers, ctx));
    if (r.kind === "direct_flight" && category === "flight") push("c:stops", CRITERION_NEEDS.stops!, criterionCheck("stops", item, option, peers, ctx));
    if (r.kind === "max_walk" && category === "stay")
      push("c:location", L(`En fazla ${r.minutes} dk`, `At most ${r.minutes} min`), criterionCheck("location", item, option, peers, ctx, r.minutes));
  }
  if (category === "stay") {
    for (const [topic, label] of Object.entries(TOPIC_NEEDS) as [Finding["topic"], string][]) {
      if (said.has(topic)) push(`t:${topic}`, label, topicCheck(topic, label, page, ctx));
    }
    if (said.has("location")) push("c:location", CRITERION_NEEDS.location!, criterionCheck("location", item, option, peers, ctx));
    if (said.has("cancellation")) push("c:cancellation", CRITERION_NEEDS.cancellation!, criterionCheck("cancellation", item, option, peers, ctx));
  }
  for (const [c, label] of Object.entries(CRITERION_NEEDS) as [CriterionId, string][]) {
    if (important(ctx, category, c)) push(`c:${c}`, label, criterionCheck(c, item, option, peers, ctx));
  }
  return out;
}

export const NEED_MARK: Record<NeedState, string> = { yes: "✓", no: "✕", unknown: "?" };
