// What the traveller wants, checked on every option: "Mutfak var", "İade yok", "Sessiz: 3 yorum övüyor".
// The needs are what "Seni böyle anladım" says (requirements, wanted amenities, criteria they made
// important, and the things their notes ask for), so a card answers first "is what I asked for here?".
// Pure; nothing is guessed: a thing the page doesn't say is "yazmıyor", never "yok".
import {
  amenitiesOf,
  cancellationType,
  CRITERION_LABELS,
  findingWeight,
  levelFor,
  levelSource,
  measureFor,
  saidTopics,
  touchesTopic,
  wantedAmenities,
  type DecisionContext,
  type OptionResult,
} from "./decision";
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

const capital = (t: string) => (t ? t.charAt(0).toLocaleUpperCase("tr") + t.slice(1) : t);

/** Finding topics their notes ask for, with the word a card uses for them. */
const TOPIC_NEEDS: Partial<Record<Finding["topic"], string>> = {
  noise: "Sessiz",
  cleanliness: "Temiz",
  food: "Kahvaltı / yemek",
  space: "Geniş",
  view: "Manzara",
  bed: "İyi yatak",
  access: "Kolay erişim",
  safety: "Güvenli",
};

/** Criteria a card checks when the traveller made them important (said, or read from their choices). */
const CRITERION_NEEDS: Partial<Record<CriterionId, string>> = {
  location: "Yakın konum",
  cancellation: "Ücretsiz iptal",
  price: "Uygun fiyat",
  rating: "Yüksek puan",
  comfort: "İyi yorumlar",
  stops: "Direkt",
  duration: "Kısa yolculuk",
  baggage: "Bagaj dahil",
  schedule: "Rahat saat",
};

const important = (ctx: Ctx, category: Category, c: CriterionId) =>
  levelSource(ctx.trip, category, c, ctx.inferred) !== "default" && levelFor(ctx.trip, category, c, ctx.inferred) >= 3;

/** Short: "Gezeceğin yerlere 6 dk", "Merkeze 1,2 km", "Konum puanı 9,2/10". */
export function locationText(display: string | null | undefined): string | null {
  if (!display) return null;
  const distance = display.match(/(\d+(?:,\d+)?\s*(?:dk|km|m)\b)/)?.[1];
  if (display.startsWith("merkeze")) return distance ? `Merkeze ${distance}` : capital(display);
  if (display.startsWith("konum puanı")) return capital(display.replace(/\s*\(yorumlar\)$/, ""));
  return distance ? `Gezeceğin yerlere ${distance}` : capital(display);
}

/** "Ücretsiz iptal · son gün 5 Eki", "İade yok", "Kısmi iade". */
export function cancellationText(item: Item, today: string): { state: NeedState; text: string } {
  const type = cancellationType(item);
  const until = item.cancellation.freeUntil;
  if (type === "free" && until && until < today) return { state: "no", text: "Ücretsiz iptal süresi geçti" };
  if (type === "free") return { state: "yes", text: until ? `Ücretsiz iptal · son gün ${formatDateRange(until, null)}` : "Ücretsiz iptal" };
  if (type === "partial") return { state: "no", text: "Kısmi iade" };
  if (type === "non_refundable") return { state: "no", text: "İade yok" };
  return { state: "unknown", text: "İptal koşulu yazmıyor" };
}

function criterionCheck(c: CriterionId, item: Item, option: OptionResult | undefined, peers: OptionResult[], ctx: Ctx, limit?: number): Omit<NeedCheck, "key" | "label"> | null {
  const part = option?.parts.find((p) => p.criterion === c);
  const covers = [`c:${c}`];
  switch (c) {
    case "cancellation":
      return { ...cancellationText(item, ctx.today), covers };
    case "location": {
      const m = measureFor("location", item, ctx as DecisionContext);
      if (!m) return { state: "unknown", text: "Konumu belli değil", covers };
      const text = locationText(m.display) ?? "Konum";
      if (limit != null && m.unit === "minutes") return { state: m.value <= limit ? "yes" : "no", text, covers };
      const s = part?.s ?? null;
      return { state: s == null ? "unknown" : s >= 0.6 ? "yes" : "no", text, covers };
    }
    case "price": {
      if (part?.value == null) return { state: "unknown", text: "Fiyat belli değil", covers };
      const values = peers.map((o) => o.parts.find((x) => x.criterion === "price")?.value).filter((v): v is number => v != null);
      if (!values.length) return null;
      const average = (part.value + values.reduce((a, b) => a + b, 0)) / (values.length + 1);
      const gap = formatPrice(Math.abs(part.value - average), ctx.currency);
      if (part.value < Math.min(...values) - 0.5) return { state: "yes", text: "En ucuz", covers };
      return part.value <= average
        ? { state: "yes", text: `Ortalamadan ${gap} ucuz`, covers }
        : { state: "no", text: `Ortalamadan ${gap} pahalı`, covers };
    }
    case "rating": {
      const r = item.rating;
      if (r.value == null || !r.scale) return { state: "unknown", text: "Puanı yok", covers };
      const ten = (r.value / r.scale) * 10;
      const text = `Puan ${r.value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}/${r.scale}`;
      return { state: ten >= 8.5 ? "yes" : "no", text, covers };
    }
    case "comfort": {
      if (part?.s == null) return { state: "unknown", text: "Yorum puanı yok", covers };
      return { state: part.s >= 0.6 ? "yes" : "no", text: part.s >= 0.6 ? "Yorum puanları yüksek" : "Yorum puanları düşük", covers };
    }
    case "stops": {
      const stops = item.flight?.stops;
      if (stops == null) return { state: "unknown", text: "Aktarma bilgisi yok", covers };
      return { state: stops === 0 ? "yes" : "no", text: stops === 0 ? "Direkt" : `${stops} aktarma`, covers };
    }
    case "baggage": {
      const bag = metricsOf(item).checkedBagIncluded;
      if (bag == null) return { state: "unknown", text: "Bagaj bilgisi yok", covers };
      return { state: bag ? "yes" : "no", text: bag ? "Bagaj dahil" : "Yalnız kabin bagajı", covers };
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
  if (!listing?.readAt) return { state: "unknown", text: `${label}: sayfa okunmadı`, covers: [] };
  const accepted = new Set(ctx.trip.acceptedFindings ?? []);
  const found = listing.findings.filter((f) => f.verified && touchesTopic(f, topic) && !evidenceOf(f, listing, ctx.today).stale);
  const against = found.filter((f) => f.polarity === "negative" && !accepted.has(acceptKey(listing.key, f)));
  const pick = (list: Finding[]) => {
    const f = [...list].sort((a, b) => evidenceOf(b, listing, ctx.today).count - evidenceOf(a, listing, ctx.today).count)[0];
    const n = evidenceOf(f, listing, ctx.today).count;
    return `${capital(f.text)}${n ? ` · ${n} yorum` : ""}`;
  };
  const covers = found.map((f) => `f:${f.id}`);
  const for_ = found.filter((f) => f.polarity === "positive");
  // Both said: the better backed side wins ("sessiz odalar" in five reviews, "bir gece gürültü" in one).
  const weigh = (list: Finding[]) => list.reduce((sum, f) => sum + findingWeight(f, listing, ctx.today), 0);
  if (against.length && weigh(against) >= weigh(for_)) return { state: "no", text: pick(against), covers };
  if (for_.length) return { state: "yes", text: pick(for_), covers };
  return { state: "unknown", text: `${label}: yorumlarda geçmiyor`, covers };
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
      const has = amenitiesOf(item, ctx as DecisionContext).includes(a);
      push(`a:${a}`, capital(a), { state: has ? "yes" : "unknown", text: has ? `${capital(a)} var` : `${capital(a)} yazmıyor`, covers: ["c:amenities"] });
    }
  }
  for (const r of ctx.trip.requirements ?? []) {
    if (r.kind === "free_cancellation" && category !== "esim") push("c:cancellation", "Ücretsiz iptal", criterionCheck("cancellation", item, option, peers, ctx));
    if (r.kind === "direct_flight" && category === "flight") push("c:stops", "Direkt", criterionCheck("stops", item, option, peers, ctx));
    if (r.kind === "max_walk" && category === "stay") push("c:location", `En fazla ${r.minutes} dk`, criterionCheck("location", item, option, peers, ctx, r.minutes));
  }
  if (category === "stay") {
    for (const [topic, label] of Object.entries(TOPIC_NEEDS) as [Finding["topic"], string][]) {
      if (said.has(topic)) push(`t:${topic}`, label, topicCheck(topic, label, page, ctx));
    }
    if (said.has("location")) push("c:location", "Yakın konum", criterionCheck("location", item, option, peers, ctx));
    if (said.has("cancellation")) push("c:cancellation", "Ücretsiz iptal", criterionCheck("cancellation", item, option, peers, ctx));
  }
  for (const [c, label] of Object.entries(CRITERION_NEEDS) as [CriterionId, string][]) {
    if (important(ctx, category, c)) push(`c:${c}`, label, criterionCheck(c, item, option, peers, ctx));
  }
  return out;
}

export const NEED_MARK: Record<NeedState, string> = { yes: "✓", no: "✕", unknown: "?" };
