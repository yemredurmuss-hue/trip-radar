// The v82 Pano (plan v81–v83, docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md "Pano yeniden" and "Belgeler
// (C5)"; v82 geçişi spec §4 aşama 6): a window over the plan with a side menu (Tümü · Biriktirdiklerim · AI önerileri · İlham ·
// Belgeler, then "İhtiyaçlar": each category and its intents, with a dot for where each stands) and what it shows: the options of
// every intent as cards of one size, group by group; one intent's options side by side (stays, eSIMs, flights and trains), best
// fit first; the saved Reels, videos and blogs.
//
// The intents are the Plan's own (intents.collectionsOf): the same names, the same states, the same keys a box's "Pano n" opens
// with. Nothing is decided here: the scores and ranks are the decision engine's, the facts cardFacts.ts's, the drafts draft.ts's
// (through intents.ts). Search, the state filter and the sort of the v11 Pano (lib/pano.ts) are not drawn in this version (C32).
// Pure.
import { boardOptions } from "./board";
import { brandOf } from "./brands";
import { cardFacts, durationText, type CardFacts } from "./cardFacts";
import { cardKind, type CardKind } from "./cardKinds";
import { flightLeg, ticketPrices } from "./cardTicket";
import { planSectionOfItem, type SectionId } from "./categories";
import type { GroupDecision } from "./decision";
import { L } from "./i18n";
import { nNights, nReviews } from "./i18nText";
import { collectionsOf, type IntentInput, type IntentStatus, type IntentVM } from "./intents";
import { INSPO_LABEL, inspoPlatform, type InspoPlatform } from "./inspo";
import { cancellationText } from "./needs";
import { ratingText } from "./offerSource";
import { adderOf, likersOf, savedByMe } from "./pano";
import { groupKeyOf } from "./plan";
import type { Item } from "./types";

/** The side menu's top entries: everything, what people saved, what the AI found, the inspiration, the trip's documents. */
export type PanoView = "all" | "mine" | "ai" | "ilham" | "docs";
export const PANO_VIEWS: readonly PanoView[] = ["all", "mine", "ai", "ilham", "docs"];

/** Where the Pano opens, or stands: a top entry, one category of intents, one intent (its key, or the group key of one of its records). */
export interface PanoAt {
  view?: PanoView;
  section?: SectionId;
  need?: string;
}

/** Who an option is from, as its badge says it: our pick, the AI's find, the traveller's own link, a person who added it. */
export type PanoSource = { kind: "ours" } | { kind: "ai" } | { kind: "link" } | { kind: "person"; name: string };

/** An intent's dot in the side menu: bought (green), chosen (sand), our pick (purple), still open (dashed). */
export type PanoDot = "ok" | "sel" | "ai" | "open";

export interface PanoOption {
  id: string;
  item: Item;
  /** The group it is decided in (plan.groupKeyOf): "Seç" chooses it among the others of that group. */
  group: string;
  /** The site or company it's from ("Booking.com", "Turkish Airlines"). */
  brand: string | null;
  /** Its name without the brand it starts with ("TK52" under "Turkish Airlines"). */
  name: string;
  /** One grey line: a ticket's hours, length and stops; a stay's area and kind; a day. */
  sub: string | null;
  image: string | null;
  /** A ticket's carrier drawn as a big mark (its letters on its colour) instead of a picture. */
  mark: { letters: string; color: string | null } | null;
  /** The big figure (a night's, one person's), its unit, and the whole ("4 gece · €720", "2 kişi · €1.810"). */
  price: { big: string; unit: string | null; total: string | null } | null;
  /** The fit score (0–100) and its place among the intent's scored options (1 = best). */
  score: number | null;
  rank: number | null;
  /** "8,9" (a site's mark) or "★ 4,8", and how many reviews. */
  rating: { text: string; star: boolean; reviews: string | null } | null;
  cancel: { text: string; tone: "ok" | "warn" | "no" } | null;
  /** A flight's checked bag, when the page says. */
  bag: string | null;
  pros: string[];
  cons: string[];
  /** B5: what was asked for, only where the page answers it (✓ or ✕); what it doesn't say isn't drawn. */
  checks: { label: string; ok: boolean }[];
  source: PanoSource | null;
  /** Found by the AI (AI önerileri) rather than saved by someone (Biriktirdiklerim). */
  ai: boolean;
  likes: string[];
  /** On the plan: chosen ("Şu an seçili", "Planda") or bought ("Alındı"). Our pick is not on the plan until it is taken. */
  current: "chosen" | "booked" | null;
  url: string | null;
}

export interface PanoNeed {
  /** The intent's key (intents.ts), the one its box's "Pano n" opens with. */
  key: string;
  section: SectionId;
  name: string;
  /** In a group's header before its line: the kind in a mixed category ("Tren", "eSIM"), else the category's word. */
  word: string;
  /** Its one info line ("3 gece · 2–5 Nis", "OPO → LIS · 8 Eki"). */
  info: string;
  dot: PanoDot;
  /** Many picks at once (things to do, a city's activities): "+ Plana koy" and "Planda", no comparison. */
  multi: boolean;
  /** Its options side by side (stays, eSIMs, flights, trains) once there are two or more. */
  compare: boolean;
  options: PanoOption[];
  /** The groups its records are decided in: an old card's "Pano'da aç" opens the Pano by one of these. */
  groups: string[];
}

export interface PanoCategory {
  section: SectionId;
  needs: PanoNeed[];
  /** Every option of its intents. */
  count: number;
}

export interface PanoIdea {
  id: string;
  item: Item;
  title: string;
  platform: InspoPlatform | null;
  /** A video to play (Reels, TikTok, YouTube) rather than a page to read. */
  video: boolean;
  /** "Reels · Porto", "Blog · Lizbon". */
  meta: string;
  /** Who saved it: a name, "Sen", "AI buldu". */
  who: string;
  url: string | null;
}

export interface PanoBoard {
  cats: PanoCategory[];
  ideas: PanoIdea[];
  /** The side menu's numbers (Belgeler counts the trip's files, read on their own). */
  counts: Record<Exclude<PanoView, "docs">, number>;
}

export interface PanoInput extends IntentInput {
  /** The board's owner (their name, or null): "Senin linkin" and "Sen" are theirs. */
  me: string | null;
}

/** The categories as the side menu says them, in the Plan's words (a category with "ve" in its name keeps only its lead word). */
export function panoCatName(id: SectionId): string {
  switch (id) {
    case "flight":
      return L("Uçuş", "Flights");
    case "stay":
      return L("Konaklama", "Stays");
    case "transport":
      return L("Ulaşım", "Getting around");
    case "activity":
      return L("Etkinlik", "Activities");
    case "todo":
    case "food":
      return L("Yapılacaklar", "Things to do");
    // Not "Belgeler" alone: that is the side menu's own entry for the trip's files.
    case "other":
      return L("Belgeler ve internet", "Documents and internet");
    case "prep":
      return L("Hazırlık", "Prep");
    case "inspo":
      return L("İlham", "Inspiration");
  }
}

/** Side by side only where options are alternatives with the same rows: a stay, an eSIM, a flight, a train (v81). */
const COMPARED: readonly CardKind[] = ["stay", "esim", "flight", "train"];
const TICKETS: readonly CardKind[] = ["flight", "train", "bus", "minibus", "ferry"];

export function dotOf(status: IntentStatus): PanoDot {
  switch (status) {
    case "booked":
    case "arranged":
    case "included":
      return "ok";
    case "chosen":
      return "sel";
    case "suggested":
      return "ai";
    default:
      return "open";
  }
}

/**
 * The name without the brand it repeats ("Turkish Airlines TK52" → "TK52"); the whole name when that is all it is, or when what
 * follows only describes it ("Pegasus · direkt").
 */
export function nameWithout(name: string, brand: string | null): string {
  const n = name.trim();
  if (!brand) return n;
  const b = brand.trim();
  if (n.length <= b.length + 1 || !n.toLocaleLowerCase("tr").startsWith(`${b.toLocaleLowerCase("tr")} `)) return n;
  const rest = n.slice(b.length + 1).trim();
  return /^[·–-]/.test(rest) ? n : rest;
}

/** A flight's own name on its card is its number ("TP 1761", v81), the brand above it; anything else its name without the brand. */
export function optionName(item: Pick<Item, "name" | "category" | "flight">, brand: string | null): string {
  const no = item.category === "flight" ? item.flight?.flightNumber?.trim() : null;
  return no || nameWithout(item.name, brand);
}

/** A carrier's mark: the airline's code from its flight number ("TK52" → "TK"), else the brand's first letters. */
export function markLetters(item: Pick<Item, "flight">, brand: string | null): string {
  const code = item.flight?.flightNumber?.replace(/\s+/g, "").match(/^([A-Z0-9]{2})\d/)?.[1];
  if (code && /[A-Z]/.test(code)) return code;
  const words = (brand ?? "").split(/[\s.-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toLocaleUpperCase("tr");
  return (words[0] ?? "?").slice(0, 2).toLocaleUpperCase("tr");
}

/** "Ücretsiz iptal" green, a partial refund amber, "İade yok" red; nothing when the page doesn't say. */
export function cancelOf(item: Item, today: string): PanoOption["cancel"] {
  const c = cancellationText(item, today);
  if (c.state === "unknown") return null;
  if (c.state === "yes") return { text: c.text, tone: "ok" };
  return { text: c.text, tone: /kısmi|partial/i.test(c.text) ? "warn" : "no" };
}

function priceOf(item: Item, facts: CardFacts, kind: CardKind, people: number | null): PanoOption["price"] {
  const p = facts.price;
  if (TICKETS.includes(kind)) {
    const t = ticketPrices(item, p ?? undefined, people);
    if (!t) return p ? { big: p.text, unit: p.label, total: null } : null;
    const going = item.guests.adults ?? people;
    if (t.each) return { big: t.each, unit: L("kişi başı", "per person"), total: going && going > 1 ? L(`${going} kişi · ${t.total}`, `${going} people · ${t.total}`) : null };
    return { big: t.total, unit: p?.label ?? null, total: null };
  }
  if (!p) return null;
  // A stay: a night's price large (what compares fairly), its nights and the whole small (v81: "€180 / gece · 4 gece · €720").
  if (kind === "stay" && p.perNight) {
    const [night] = p.perNight.split(" / ");
    const nights = /^(\d+)/.exec(p.label ?? "")?.[1];
    return { big: night, unit: L("/ gece", "/ night"), total: nights ? `${nNights(Number(nights))} · ${p.text}` : p.text };
  }
  return { big: p.text, unit: p.label, total: null };
}

function subOf(item: Item, facts: CardFacts, kind: CardKind): string | null {
  if (kind === "flight") {
    const leg = flightLeg(item);
    const hours = leg.dep && leg.arr ? `${leg.dep} → ${leg.arr}${leg.plus ? ` +${leg.plus}` : ""}` : leg.dep;
    const parts = [hours, leg.duration, leg.stops ? leg.stops.text.toLocaleLowerCase(L("tr", "en")) : null].filter(Boolean);
    if (parts.length) return parts.join(" · ");
  }
  if (TICKETS.includes(kind)) {
    const minutes = item.metrics?.durationMinutes;
    const parts = [facts.subtitle, !facts.subtitle && minutes ? durationText(minutes) : null].filter(Boolean);
    return parts.join(" · ") || null;
  }
  if (kind === "stay") return [item.location.area ?? item.city, facts.subtitle].filter(Boolean).join(" · ") || null;
  return facts.subtitle ?? (item.summary.trim() || null);
}

function sourceOf(item: Item, ours: boolean): PanoSource | null {
  if (ours) return { kind: "ours" };
  const adder = adderOf(item);
  if (adder === "ai") return { kind: "ai" };
  if (adder) return { kind: "person", name: adder };
  return item.url ? { kind: "link" } : null;
}

/** On the plan as the intent counts it: a row of cards also has a thing to do with a day, or one done (intents.isPlanned). */
function currentOf(item: Item, multi: boolean, planned: ReadonlySet<string>): PanoOption["current"] {
  if (item.status === "booked") return "booked";
  if (item.status === "chosen" || (multi && planned.has(item.id))) return "chosen";
  return null;
}

interface Ctx {
  input: PanoInput;
  byItem: Map<string, GroupDecision>;
  people: number | null;
}

function optionOf(item: Item, need: IntentVM, ctx: Ctx, planned: ReadonlySet<string>): PanoOption {
  const decision = ctx.byItem.get(item.id);
  const facts = cardFacts(item, decision, ctx.input.ctx);
  const kind = cardKind(item);
  const brand = facts.source?.label ?? item.provider ?? null;
  const ticket = TICKETS.includes(kind);
  const ours = need.status === "suggested" && need.chosen?.id === item.id;
  const r = item.rating;
  const bag = item.metrics?.checkedBagIncluded;
  const multi = need.frame === "collection";
  const cancel = multi || kind === "esim" || facts.needs.some((n) => n.key === "c:cancellation") ? null : cancelOf(item, ctx.input.today);
  // Its cancellation is said once, on its own row (the pluses and minuses read it too).
  const apart = (text: string) => !cancel || text.toLocaleLowerCase("tr") !== cancel.text.toLocaleLowerCase("tr");
  return {
    id: item.id,
    item,
    group: groupKeyOf(item),
    brand,
    name: optionName(item, brand),
    sub: subOf(item, facts, kind),
    // A ticket shows its carrier's mark: a page's photo of a plane says less than "TK" on its colour (v81).
    image: ticket ? null : facts.image,
    mark: ticket ? { letters: markLetters(item, brand), color: brandOf(brand, facts.source?.host)?.color ?? null } : null,
    price: priceOf(item, facts, kind, ctx.people),
    score: facts.score != null ? Math.round(facts.score) : null,
    rank: null,
    rating: r.value != null ? { text: ratingText(r.value), star: r.value <= 5, reviews: r.count ? nReviews(r.count) : null } : null,
    cancel,
    bag: kind === "flight" && bag != null ? (bag ? L("Bavul dahil", "Checked bag included") : L("Yalnız kabin bagajı", "Cabin bag only")) : null,
    pros: facts.pros.map((p) => p.text).filter(apart),
    cons: facts.cons.map((c) => c.text).filter(apart),
    checks: facts.needs.filter((n) => n.state !== "unknown").map((n) => ({ label: n.label, ok: n.state === "yes" })),
    source: sourceOf(item, ours),
    ai: adderOf(item) === "ai",
    likes: likersOf(item),
    current: currentOf(item, multi, planned),
    url: item.url,
  };
}

/**
 * The intent's options in the order its comparison has them (best fit first; board.ts puts the ruled-out last), the unscored after
 * in the plan's order. Our pick leads the cards as it leads the box (v81). Each scored one gets its place ("2. sırada").
 */
function orderedOptions(options: PanoOption[], ctx: Ctx): PanoOption[] {
  const decisions = [...new Set(options.map((o) => ctx.byItem.get(o.id)).filter((d): d is GroupDecision => d != null))];
  const place = new Map<string, number>();
  for (const d of decisions) boardOptions(d, { withOut: true }).forEach((o, i) => place.set(o.item.id, i));
  const at = (o: PanoOption) => place.get(o.id) ?? Number.MAX_SAFE_INTEGER;
  const sorted = options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => (b.o.score ?? -1) - (a.o.score ?? -1) || at(a.o) - at(b.o) || a.i - b.i)
    .map((x) => x.o);
  let rank = 0;
  for (const o of sorted) if (o.score != null) o.rank = ++rank;
  const ours = sorted.findIndex((o) => o.source?.kind === "ours");
  return ours > 0 ? [sorted[ours], ...sorted.slice(0, ours), ...sorted.slice(ours + 1)] : sorted;
}

/** What an inspiration is, beside its platform's badge ("Reels", "video"); a blog post says only where (no reading time is known). */
function kindWord(platform: InspoPlatform): string | null {
  switch (platform) {
    case "reels":
      return INSPO_LABEL.reels;
    case "tiktok":
    case "youtube":
      return L("video", "video");
    case "instagram":
      return L("gönderi", "post");
    case "pinterest":
      return L("pin", "pin");
    case "blog":
      return null;
  }
}

/** The trip's saved inspiration (İlham), newest first. */
export function ideasOf(items: readonly Item[], me: string | null): PanoIdea[] {
  return items
    .filter((i) => i.status !== "dismissed" && planSectionOfItem(i) === "inspo")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((item) => {
      const platform = inspoPlatform(item.url);
      const adder = adderOf(item);
      return {
        id: item.id,
        item,
        title: item.name,
        platform,
        video: platform != null && platform !== "blog" && platform !== "pinterest",
        meta: [platform ? kindWord(platform) : null, item.city].filter(Boolean).join(" · "),
        who: adder === "ai" ? L("AI buldu", "Found by AI") : savedByMe(item, me) ? me || L("Sen", "You") : adder!,
        url: item.url,
      };
    });
}

/** The Pano's whole content: the categories with their intents and options (only intents that have options), the inspiration, the numbers. */
export function panoBoardOf(input: PanoInput): PanoBoard {
  const byItem = new Map<string, GroupDecision>();
  for (const d of input.decisions?.values() ?? []) for (const o of d.options) byItem.set(o.item.id, d);
  const ctx: Ctx = { input, byItem, people: input.people ?? null };
  const byId = new Map(input.items.map((i) => [i.id, i]));
  const live = (i: Item | undefined): i is Item => i != null && i.status !== "dismissed";
  const collections = collectionsOf(input).map(({ section, intents }) => ({
    section: section.id,
    intents: intents.map((need) => ({ need, records: need.itemIds.map((id) => byId.get(id)).filter(live) })),
  }));
  // A saved option a booking closed ("Lisboa Loft rezervasyonu bu geceleri kapsıyor"): out of the plan's way under Gizlenenler, still
  // one of its need's options here (what the trip gathered stays on the Pano).
  const placed = new Set(collections.flatMap((c) => c.intents.flatMap((x) => x.records.map((i) => i.id))));
  const singles = collections.flatMap((c) => c.intents).filter((x) => x.need.frame !== "collection" && x.records.length);
  for (const item of input.items) {
    if (!live(item) || placed.has(item.id) || item.status !== "saved") continue;
    const home = singles.find((x) => x.records.some((r) => groupKeyOf(r) === groupKeyOf(item)));
    if (home) home.records.push(item);
  }
  const cats: PanoCategory[] = collections.flatMap(({ section, intents }) => {
    const needs = intents.flatMap(({ need, records }): PanoNeed[] => {
      if (!records.length) return [];
      const multi = need.frame === "collection";
      const planned = new Set(need.planned.map((o) => o.id));
      const options = orderedOptions(
        records.map((item) => optionOf(item, need, ctx, planned)),
        ctx,
      );
      const kind = cardKind(records[0]);
      return [
        {
          key: need.key,
          section,
          name: need.head.name,
          word: need.head.kindWord ?? panoCatName(section),
          info: need.head.parts.join(" · "),
          dot: dotOf(need.status),
          multi,
          compare: !multi && COMPARED.includes(kind) && options.length > 1,
          options,
          groups: [...new Set(records.map(groupKeyOf))],
        },
      ];
    });
    return needs.length ? [{ section, needs, count: needs.reduce((n, x) => n + x.options.length, 0) }] : [];
  });
  const all = cats.flatMap((c) => c.needs.flatMap((n) => n.options));
  const ideas = ideasOf(input.items, input.me);
  return { cats, ideas, counts: { all: all.length, mine: all.filter((o) => !o.ai).length, ai: all.filter((o) => o.ai).length, ilham: ideas.length } };
}

/** The intent a key names: its own key, else a group one of its records is decided in (an old card's "Pano'da aç"). */
export function findNeed(board: Pick<PanoBoard, "cats">, key: string | null | undefined): PanoNeed | null {
  if (!key) return null;
  const needs = board.cats.flatMap((c) => c.needs);
  return needs.find((n) => n.key === key) ?? needs.find((n) => n.groups.includes(key)) ?? null;
}

/** A top entry's options: everything, what people saved, what the AI found. */
export function inView(view: "all" | "mine" | "ai", o: PanoOption): boolean {
  return view === "all" || (view === "ai" ? o.ai : !o.ai);
}

/** "4 kayıt": how many records a group holds (lib/pano's word). */
export { recordsText } from "./pano";
