// The v82 Plan's view model (plan v77–v82, docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md; v82
// geçişi, docs/superpowers/specs/2026-10-18-v82-gecis/02-spec.md and C raporu §1): what each category's closed row says
// (K0, `collectionSummary`), its intents in order (`intentsOf`), and each intent's box (K1, `IntentVM`): its frame family,
// its state in the eight words of the design, its head, its options, the one chosen and, once bought, how to get to it.
//
// Nothing is decided here: the stages are lifecycle.ts's (through categories.ts), the drafts draft.ts's, the order and the
// badges the decision engine's and board.ts's, the facts cardFacts.ts's, the codes bookingRows.ts's, the estimate
// estRange.ts's. This file only puts them in the shape the new boxes draw. The decisions it follows (01-kararlar.md):
//   B1  a booking's code and check-in time are always there (no PNR_DAYS / CHECKIN_DAYS wait in the box);
//   B2  "Önerimiz" on a flight, a stay, a train and an eSIM;
//   B4  an estimate only from at least three real prices, never for insurance;
//   B5  the wants checked only as ✓ or ✕ (what the page doesn't say stays in the data, not in the box);
//   B9  the hero's two shares (planShare, bookedShare);
//   B10 a booking's price as "€900 ödendi".
// Phase 0 (temel): nothing draws it yet (CategoryPlan's V82_SECTIONS is empty). Pure.
import { cityOfAirport } from "./airports";
import { boardBadges, boardOptions } from "./board";
import { brandOf, type Brand } from "./brands";
import { isCampStay } from "./campStay";
import { cardFacts, type CardFacts } from "./cardFacts";
import { cardKind, cardKindLabel, legTransportMode, transportMode, type CardKind } from "./cardKinds";
import { checkInTimeOf, daysToStart, startDay } from "./cardTime";
import { flightLeg, flightWants, safeContactUrl, ticketPrices, type FlightLeg } from "./cardTicket";
import { footOf, legCardView } from "./cardView";
import { bookingCopies, refFromNote } from "./bookingRows";
import { catDomKey, citiesOfPlan, EVENT_RANK, eventsByCity, needsOf, recordOf, type CatEntry, type CatSection, type SectionId } from "./categories";
import type { GroupDecision } from "./decision";
import { needsDoc } from "./docs";
import { draftOf } from "./draft";
import { estimatedRange, rangeLabel, type EstRange } from "./estRange";
import { L } from "./i18n";
import { count, joinAnd, lowerFirst, nNights, nReviews } from "./i18nText";
import { shortDay } from "./ideas";
import { formatDateRange, formatPrice, isoDate, listingKeyOf, nightsBetween, placeMapUrl, rankItems } from "./items";
import { clockOf, legShortTitle, type Leg } from "./legs";
import type { Stage } from "./lifecycle";
import { cancellationText } from "./needs";
import { ratingText } from "./offerSource";
import { adderOf } from "./pano";
import { stayRange, type Plan } from "./plan";
import type { BudgetSlice } from "./progress";
import { lookWord } from "./stageWords";
import { whoGoes } from "./tripSettings";
import type { DocMeta, Item, Suggestion, Trip } from "./types";

/**
 * The eight states of an intent box: Aranıyor (nothing to pick yet), Karar bekliyor (options to pick from), Önerimiz (our
 * pick, waiting for the traveller to take it), Seçildi, Alındı, Ayarlandı (sorted out by the traveller, or nothing to book),
 * Gerek yok, Dahil (covered by another booking: a festival's camp by its ticket).
 */
export type IntentStatus = "searching" | "deciding" | "suggested" | "chosen" | "booked" | "arranged" | "skipped" | "included";
export const INTENT_STATUSES: readonly IntentStatus[] = ["searching", "deciding", "suggested", "chosen", "booked", "arranged", "skipped", "included"];

/**
 * The three fixed frames (v82 "niyet kutusu standardı"): a stay, an eSIM, insurance as picture | four lines | side column;
 * a flight, a train, a transfer or any other way of travel as a ticket; things to do and book as rows of cards.
 */
export type FrameFamily = "stay" | "ticket" | "collection";

/** The v82 Plan's categories in order: İlham moves to the Pano (phase 6), restaurants are under Yapılacaklar. */
export const V82_ORDER: readonly SectionId[] = ["flight", "stay", "transport", "activity", "todo", "other", "prep"];

const FRAME: Readonly<Record<SectionId, FrameFamily>> = {
  flight: "ticket",
  transport: "ticket",
  stay: "stay",
  other: "stay",
  activity: "collection",
  todo: "collection",
  food: "collection",
  inspo: "collection",
  prep: "collection",
};
export const frameOf = (section: SectionId): FrameFamily => FRAME[section];

/** A category holding several kinds: the kind's word leads an intent's line ("Tren", "Transfer", "eSIM"). */
const MIXED: readonly SectionId[] = ["transport", "other"];
/** Many picks at once (Planında + Öneriler), not one choice. */
const isCollection = (section: SectionId) => frameOf(section) === "collection";

/** The categories' names as the v82 drawing writes them (the same words as the Plan's sectionMeta). */
export function sectionName(id: SectionId): string {
  switch (id) {
    case "flight":
      return L("Uçuş", "Flights");
    case "stay":
      return L("Konaklama", "Stays");
    case "transport":
      return L("Ulaşım", "Getting around");
    case "activity":
      return L("Etkinlik ve turlar", "Activities and tours");
    case "todo":
    case "food":
      return L("Yapılacaklar ve restoranlar", "Things to do and restaurants");
    case "other":
      return L("Belgeler ve internet", "Documents and internet");
    case "prep":
      return L("Hazırlık", "Prep");
    case "inspo":
      return L("İlham", "Inspiration");
  }
}

/** The word of a state on the box's chip; a booking says what was done (a stay "Rezerve", anything else "Alındı"). */
export function statusWord(status: IntentStatus, kind: CardKind | null = null): string {
  switch (status) {
    case "searching":
      return L("Aranıyor", "Searching");
    case "deciding":
      return L("Karar bekliyor", "To decide");
    case "suggested":
      return lookWord("draft");
    case "chosen":
      return lookWord("chosen");
    case "booked":
      return kind === "stay" ? lookWord("booked") : lookWord("booked", { as: "bought" });
    case "arranged":
      return lookWord("arranged");
    case "skipped":
      return L("Gerek yok", "Not needed");
    case "included":
      return L("Dahil", "Included");
  }
}

/** B2: "Önerimiz" is drawn on a flight, a stay, a train and an eSIM (draft.ts keeps flights and stays for the old cards). */
export const suggestsFor = (item: Item): boolean =>
  item.category === "flight" || item.category === "stay" || item.category === "esim" || (item.category === "transport" && transportMode(item) === "train");

/** F2 / B15: a booking with no file shows "belge yok" from this many days before it starts. */
export const DOC_SOON_DAYS = 14;

type CardCtx = NonNullable<Parameters<typeof cardFacts>[2]>;

export interface IntentInput {
  trip: Trip;
  plan: Plan;
  /** categories.categorize's sections, as the Plan builds them (its stageCtx and drafts). */
  sections: CatSection[];
  items: Item[];
  today: string;
  /** The decisions by group (useDecisions.byGroup): the options' order, scores and badges. Without them: the records' order. */
  decisions?: ReadonlyMap<string, GroupDecision> | null;
  /** The decision engine's context (the cards' prices and the wants checked); without it nothing is checked. */
  ctx?: CardCtx;
  /** A record's files (DocAccess.useTripDocs): whether a booking has its document. */
  docsFor?: (itemId: string) => readonly DocMeta[];
  /** How many go on the trip, as the hero says it: an intent writes its own count only when it differs. */
  people?: number | null;
  /** The budget shared out by category (progress.sectionAllotments) and its currency. */
  allot?: { by: Record<BudgetSlice, number>; currency: string } | null;
  /** The suggestions shown, by section (useSuggestions.bySection): a missing need is an intent still to find (C16). */
  suggestions?: Partial<Record<SectionId, readonly Suggestion[]>>;
}

/** Who put an option on the board: a source the AI found it in, a link the traveller sent, a fellow traveller. */
export type OptionSource = { kind: "ai" } | { kind: "link" } | { kind: "person"; name: string };
export type OptionBadge = "cheapest" | "fastest";

export interface OptionVM {
  id: string;
  item: Item;
  title: string;
  /** The site's label in its colour (brands.ts). */
  brand: Brand | null;
  source: OptionSource | null;
  image: string | null;
  /** cardFacts' price: the total (a stay: its nights), per night, one person's share. */
  price: CardFacts["price"];
  /** A ticket's price per person and in all (cardTicket.ticketPrices). */
  ticket: { each: string | null; total: string } | null;
  /** The fit score (0–100, "Uyum puanı") and its place among the need's options (1 = first). */
  score: number | null;
  place: number;
  /** "8,9 · 1.204 yorum", "★ 4,8 · 96 yorum". */
  rating: string | null;
  /** Where a stay is (its area, else its page's line). */
  where: string | null;
  /** "Ücretsiz iptal", "İade yok": null when a want already checks it, on an eSIM and on a row's card (v82). */
  cancel: string | null;
  /** The wants, only those the page answers (B5): at most two. */
  checks: { label: string; ok: boolean; text: string }[];
  badges: OptionBadge[];
  /** Our pick (draft.ts): its "Önerimiz" ribbon. */
  ours: boolean;
  /** A ticket's hours, ends, length and stops (cardTicket.flightLeg). */
  leg: FlightLeg | null;
  /** Chosen or booked: "Seçili" when the options open again (Değiştir). */
  current: boolean;
}

export interface AccessVM {
  /** The booking's reference (PNR, booking no., ticket no.): always shown once bought (B1). */
  code: { label: string; value: string } | null;
  /** A stay's check-in and check-out times as the page or the booking say them (B1: always). */
  checkIn: string | null;
  checkOut: string | null;
  /** "2–5 Nis", "8 Eki 07:10". */
  when: string | null;
  /** The address, else the area or the airport it leaves from. */
  where: string | null;
  doc: { count: number; name: string | null };
  /** No file yet and it starts within DOC_SOON_DAYS: the amber "belge yok" (B15). */
  docMissing: boolean;
  links: { map: string | null; host: string | null; page: string | null };
}

export interface IntentHead {
  name: string;
  /** A ticket's two ends, as its big text says them ("İstanbul" → "Tokyo"). */
  route: { from: string; to: string } | null;
  /** The one info line's parts: "IST → HND", "1 Nis"; "3 gece", "2–5 Nis". The trip's own head count is never one. */
  parts: string[];
  /** In a mixed category, the kind leads the line ("Tren", "eSIM"). */
  kindWord: string | null;
  /** What the traveller asked for (`must`: a requirement, else a wish). */
  wants: { label: string; must: boolean }[];
  image: string | null;
  city: string | null;
  date: string | null;
  nights: number;
}

export interface IntentVM {
  /** Unique within the plan: the need's key (a hidden thing's, a suggestion's). */
  key: string;
  section: SectionId;
  frame: FrameFamily;
  kind: CardKind;
  status: IntentStatus;
  /** The state's word on the chip ("Seçildi", "2 planda · 1 alındı"). */
  word: string;
  head: IntentHead;
  /** The options to pick from, best fit first: three for one choice, four for a row of cards; the rest are on the Pano. */
  options: OptionVM[];
  /** Every option the need holds ("Pano n"). */
  optionCount: number;
  /** The one chosen, booked or suggested. */
  chosen: OptionVM | null;
  /** A row of cards' "Planında". */
  planned: OptionVM[];
  /** Once bought: how to get to it. */
  access: AccessVM | null;
  /** B10: "€900 ödendi". */
  paid: string | null;
  /** B4: "~€90–160" from at least three real prices (never for insurance), while nothing is chosen. */
  estimate: { label: string; unit: EstRange["unit"]; n: number } | null;
  /** A line of its own: how it was arranged ("sen hallettin"), why it's suggested. */
  note: string | null;
  /** The suggestions a row of cards waits on (not records yet). */
  suggestions: Suggestion[];
  itemIds: string[];
  /** Its entries' DOM keys (categories.catDomKey): the Plan scrolls to these. */
  domKeys: string[];
}

interface Env {
  input: IntentInput;
  byId: Map<string, Item>;
  people: number | null;
  festival: boolean;
  decisionOf: (item: Item) => GroupDecision | undefined;
  /** Its place in its comparison, best fit first (board.ts's order, the ruled-out last); null with no comparison. */
  placeOf: (item: Item) => number | null;
  facts: (item: Item) => CardFacts;
  docs: (itemId: string) => readonly DocMeta[];
}

function envOf(input: IntentInput): Env {
  const byItem = new Map<string, GroupDecision>();
  for (const d of input.decisions?.values() ?? []) for (const o of d.options) byItem.set(o.item.id, d);
  const facts = new Map<string, CardFacts>();
  const places = new Map<GroupDecision, string[]>();
  return {
    input,
    byId: new Map(input.items.map((i) => [i.id, i])),
    people: input.people ?? (whoGoes({ travellers: input.trip.travellers }).count || null),
    festival: input.trip.intent?.playbook === "festival",
    decisionOf: (item) => byItem.get(item.id),
    placeOf: (item) => {
      const d = byItem.get(item.id);
      if (!d) return null;
      if (!places.has(d)) places.set(d, boardOptions(d, { withOut: true }).map((o) => o.item.id));
      const n = places.get(d)!.indexOf(item.id);
      return n >= 0 ? n + 1 : null;
    },
    facts: (item) => {
      const known = facts.get(item.id);
      if (known) return known;
      const made = cardFacts(item, byItem.get(item.id), input.ctx);
      facts.set(item.id, made);
      return made;
    },
    docs: (id) => input.docsFor?.(id) ?? [],
  };
}

const uniq = <T>(list: T[]): T[] => [...new Set(list)];
const nonNull = <T>(x: T | null | undefined): x is T => x != null;

// --- one choice: a flight, a stay, a way of travel, an eSIM, insurance ----------------------------------------

interface Bucket {
  key: string;
  entries: CatEntry[];
  /** The need's stage (categories.needsOf), or null when it takes no booking (a taxi planned, something sorted out). */
  stage: Stage | null;
}

/** A section's entries by the need they are part of, in the section's order (each person's group joins its need). */
function bucketsOf(section: CatSection): Bucket[] {
  const needs = new Map(needsOf([section]).map((n) => [n.key, n] as const));
  const out = new Map<string, Bucket>();
  for (const e of section.entries) {
    const known = out.get(e.need);
    if (known) known.entries.push(e);
    else out.set(e.need, { key: e.need, entries: [e], stage: needs.get(e.need)?.stage ?? null });
  }
  return [...out.values()];
}

const legOfEntry = (e: CatEntry): Leg | null =>
  e.piece.kind === "entry" ? (e.piece.entry.kind === "leg" ? e.piece.entry.leg : e.piece.entry.kind === "travel" ? e.piece.entry.leg : null) : null;

const DEFAULT_KIND: Partial<Record<SectionId, CardKind>> = { flight: "flight", stay: "stay", transport: "transport", other: "other" };

/** The need's options in the order its comparison shows them: the engine's (board.ts) when one decision holds them, else by fit. */
function ordered(options: Item[], env: Env): Item[] {
  const decisions = uniq(options.map(env.decisionOf).filter(nonNull));
  if (decisions.length === 1) {
    const ids = new Set(options.map((i) => i.id));
    const ranked = boardOptions(decisions[0], { withOut: true })
      .map((o) => o.item.id)
      .filter((id) => ids.has(id))
      .map((id) => options.find((i) => i.id === id)!);
    return [...ranked, ...rankItems(options.filter((i) => !ranked.includes(i)))];
  }
  const score = (i: Item) => env.decisionOf(i)?.options.find((o) => o.item.id === i.id)?.score ?? -1;
  return [...rankItems(options)].sort((a, b) => score(b) - score(a));
}

/** "En ucuz" (board.ts's own, with no winner taking its place) and "En hızlı" (a ticket's shortest, no tie). */
function badgesOf(options: Item[], frame: FrameFamily, env: Env): Map<string, OptionBadge[]> {
  const out = new Map<string, OptionBadge[]>();
  const add = (id: string, b: OptionBadge) => out.set(id, [...(out.get(id) ?? []), b]);
  for (const d of uniq(options.map(env.decisionOf).filter(nonNull))) {
    for (const [id, badge] of boardBadges({ ...d, winner: null })) if (badge === "cheap" && options.some((i) => i.id === id)) add(id, "cheapest");
  }
  if (frame === "ticket") {
    const timed = options.map((i) => ({ i, m: i.metrics?.durationMinutes ?? null })).filter((x): x is { i: Item; m: number } => x.m != null && x.m > 0);
    const sorted = [...timed].sort((a, b) => a.m - b.m);
    if (sorted.length >= 2 && sorted[0].m !== sorted[1].m) add(sorted[0].i.id, "fastest");
  }
  return out;
}

function sourceOf(item: Item): OptionSource | null {
  const adder = adderOf(item);
  if (adder === "ai") return { kind: "ai" };
  if (adder) return { kind: "person", name: adder };
  return item.url ? { kind: "link" } : null;
}

function ratingOf(item: Item): string | null {
  const r = item.rating;
  if (r.value == null) return null;
  return [ratingText(r.value), r.count ? nReviews(r.count) : null].filter(Boolean).join(" · ");
}

function optionVM(item: Item, env: Env, at: { place: number; frame: FrameFamily; kind: CardKind; draft: Item | null; badges?: OptionBadge[] }): OptionVM {
  const facts = env.facts(item);
  const wantsCancel = facts.needs.some((n) => n.key === "c:cancellation");
  // v82: no cancel chip on an eSIM or on a row's card (an activity's card says its day and price), nor twice beside a want.
  const cancel = at.kind === "esim" || at.frame === "collection" || wantsCancel ? null : cancellationText(item, env.input.today);
  return {
    id: item.id,
    item,
    title: item.name,
    brand: brandOf(facts.source?.label, facts.source?.host),
    source: sourceOf(item),
    image: facts.image,
    price: facts.price,
    ticket: at.frame === "ticket" ? ticketPrices(item, facts.price, env.people) : null,
    score: facts.score,
    place: env.placeOf(item) ?? at.place,
    rating: ratingOf(item),
    where: at.frame === "stay" ? (item.location.area ?? (item.summary.trim() || null)) : null,
    cancel: cancel && cancel.state !== "unknown" ? cancel.text.split(" · ")[0] : null,
    checks: facts.needs.filter((n) => n.state !== "unknown").slice(0, 2).map((n) => ({ label: n.label, ok: n.state === "yes", text: n.text })),
    badges: at.badges ?? [],
    ours: at.draft?.id === item.id,
    leg: at.frame === "ticket" ? flightLeg(item) : null,
    current: item.status === "chosen" || item.status === "booked",
  };
}

/** A stay need's nights and days: its blocks' (the nights of one city back to back), else the lead record's own dates. */
function nightsOf(b: Bucket, lead: Item | null): { start: string | null; end: string | null; nights: number; city: string | null } {
  const blocks = b.entries.flatMap((e) => (e.piece.kind === "entry" && e.piece.entry.kind === "stay" ? [e.piece.entry.block] : []));
  if (blocks.length) {
    const start = blocks.map((x) => x.range.start).sort()[0];
    const end = blocks.map((x) => x.range.end).sort().at(-1)!;
    return { start, end, nights: blocks.reduce((n, x) => n + x.nights, 0), city: blocks.find((x) => x.city)?.city ?? null };
  }
  const own = lead ? stayRange(lead) : null;
  return { start: own?.start ?? null, end: own?.end ?? null, nights: own ? nightsBetween(own.start, own.end) : 0, city: lead?.city ?? null };
}

/** A ticket's two ends: the move's cities, a transfer's ends (cardView), a flight's airports' cities, an empty way in or home. */
function routeOf(b: Bucket, lead: Item | null, leg: Leg | null): IntentHead["route"] {
  if (leg) {
    if (leg.kind === "move") return { from: leg.from.city ?? leg.from.label, to: leg.to.city ?? leg.to.label };
    const view = legCardView(leg);
    return { from: view.from.city, to: view.to.city };
  }
  const f = lead?.flight;
  // An airport the table can't name stays its code (a city is never guessed for it).
  if (f?.from && f.to) return { from: cityOfAirport(f.from), to: cityOfAirport(f.to) };
  const e = b.entries[0];
  const t = e.piece.kind === "entry" && e.piece.entry.kind === "travel" ? e.piece.entry : null;
  if (t && !t.travel) {
    const home = t.home ? cityOfAirport(t.home) : null;
    if (t.city && home) return t.role === "departure" ? { from: t.city, to: home } : { from: home, to: t.city };
  }
  return null;
}

/** The record's own head count, only when it isn't the trip's ("2 kişi" on every intent says nothing). */
function peoplePart(lead: Item | null, env: Env): string | null {
  const n = lead?.guests.adults ?? null;
  return n != null && env.people != null && n !== env.people ? count(n, "kişi", "person", "people") : null;
}

function headOf(section: SectionId, b: Bucket, lead: Item | null, leg: Leg | null, kind: CardKind, env: Env): IntentHead {
  const first = b.entries[0];
  const frame = frameOf(section);
  const facts = lead ? env.facts(lead) : null;
  const wants = facts
    ? facts.needs.map((n) => ({ label: n.label, must: n.source?.kind === "requirement" }))
    : section === "flight"
      ? flightWants(env.input.trip, env.input.ctx?.preferences ?? []).map((label) => ({ label, must: Boolean(env.input.trip.requirements?.some((r) => r.kind === "direct_flight")) }))
      : [];
  // The way its options go ("Tren"); with none yet, the transfer's own word ("Transfer", "Şehir değişimi").
  const kindWord = MIXED.includes(section) ? (kind === "transport" && leg ? legCardView(leg).label : cardKindLabel(kind)) : null;
  const image = lead?.imageUrl ?? null;
  if (section === "stay") {
    const n = nightsOf(b, lead);
    const parts = [n.nights ? nNights(n.nights) : null, n.start ? formatDateRange(n.start, n.end) : null, peoplePart(lead, env)].filter(nonNull);
    return { name: n.city ?? first.row.name, route: null, parts, kindWord, wants, image, city: n.city, date: n.start, nights: n.nights };
  }
  if (frame === "ticket") {
    const route = routeOf(b, lead, leg);
    const f = lead?.flight;
    const codes = f?.from && f.to && /^[A-Z]{3}$/.test(f.from) && /^[A-Z]{3}$/.test(f.to) ? `${f.from} → ${f.to}` : null;
    const date = first.date;
    const parts = [section === "flight" ? codes : null, date ? shortDay(date) : null, peoplePart(lead, env)].filter(nonNull);
    return { name: route && leg?.kind !== "arrival" && leg?.kind !== "departure" ? `${route.from} → ${route.to}` : first.row.name, route, parts, kindWord, wants, image, city: first.city, date, nights: 0 };
  }
  // Belgeler ve internet: an eSIM or a policy for the whole trip (its own dates, else the trip's).
  const place = lead?.country ?? lead?.city ?? null;
  const label = cardKindLabel(kind);
  const own = lead ? isoDate(lead.dates.start) : null;
  const range = own ? { start: own, end: isoDate(lead!.dates.end) } : env.input.plan.range;
  const parts = [range ? formatDateRange(range.start, range.end) : null, peoplePart(lead, env)].filter(nonNull);
  return { name: place ? `${label} · ${place}` : label, route: null, parts, kindWord: null, wants, image, city: first.city, date: range?.start ?? null, nights: 0 };
}

function accessOf(item: Item, kind: CardKind, env: Env): AccessVM {
  const ref = item.bookingRef ?? refFromNote(item.statusNote);
  const label = ref ? (Object.entries(bookingCopies(item, kind)).find(([, v]) => v.value === ref)?.[0] ?? null) : null;
  const house = env.input.ctx?.listings.get(listingKeyOf(item))?.house ?? null;
  const day = startDay(item);
  const stay = kind === "stay";
  const when = stay
    ? (() => {
        const own = stayRange(item);
        return own ? formatDateRange(own.start, own.end) : day ? shortDay(day) : null;
      })()
    : day
      ? [shortDay(day), clockOf(item.flight?.departure)].filter(Boolean).join(" ")
      : null;
  const f = item.flight;
  const from = !stay && f?.from ? (/^[A-Z]{3}$/.test(f.from) ? `${cityOfAirport(f.from)} ${f.from}` : f.from) : null;
  const docs = env.docs(item.id);
  const days = daysToStart(item, env.input.today);
  const mapped = stay || kind === "activity" || kind === "food";
  return {
    code: ref ? { label: label ?? L("Kod", "Code"), value: ref } : null,
    // The page's (or the booking's) own hours, never guessed; the same reading checkInTimeOf does for the way out.
    checkIn: stay ? checkInTimeOf(item, house) : null,
    checkOut: stay && house?.checkOutUntil ? checkInTimeOf({ dates: { start: null, end: null, source: "none" } }, { checkInFrom: house.checkOutUntil }) : null,
    when,
    where: item.location.address ?? item.location.area ?? from ?? item.city,
    doc: { count: docs.length, name: docs[0]?.name ?? null },
    docMissing: needsDoc(item) && docs.length === 0 && days != null && days >= 0 && days <= DOC_SOON_DAYS,
    links: { map: mapped && (item.geo || item.location.address || item.name) ? placeMapUrl(item) : null, host: safeContactUrl(item.host?.url), page: item.url },
  };
}

/** A foot's words in one line ("Rezervasyon gerekmez · bilete dahil", "sen hallettin"). */
const footText = (left: ReturnType<typeof footOf>["left"]): string | null =>
  left.kind === "state" ? [left.text, left.sub].filter(Boolean).join(" · ") || null : null;

function singleIntent(section: SectionId, b: Bucket, env: Env): IntentVM {
  const frame = frameOf(section);
  const records = uniq(b.entries.flatMap((e) => e.itemIds))
    .map((id) => env.byId.get(id))
    .filter(nonNull);
  const live = records.filter((i) => i.status !== "dismissed");
  const settled = live.find((i) => i.status === "booked") ?? live.find((i) => i.status === "chosen") ?? null;
  const options = ordered(
    live.filter((i) => i.status === "saved"),
    env,
  );
  const leg = b.entries.map(legOfEntry).find(nonNull) ?? null;
  const lead = settled ?? options[0] ?? live[0] ?? null;
  const legMode = leg ? (leg.choice?.mode ?? leg.mode) : null;
  const kind: CardKind = lead ? cardKind(lead, legMode) : (legTransportMode(legMode) ?? DEFAULT_KIND[section] ?? "other");
  const draft = b.stage === "options" && options.length ? draftOf(options, env.decisionOf(options[0]), suggestsFor) : null;
  // A festival's camp is covered by the ticket (cardView.footOf's "bilete dahil"); a camp elsewhere is nothing to book.
  const camp = settled && settled.status === "chosen" && kind === "stay" && isCampStay(settled);
  const view = leg ? legCardView(leg) : null;
  const legArranged = Boolean(view && (view.arranged || view.badge === "arranged") && !live.some((i) => i.status === "booked"));
  const status: IntentStatus = camp
    ? env.festival
      ? "included"
      : "arranged"
    : b.stage == null
      ? "arranged"
      : b.stage === "search" || b.stage === "cancelled"
        ? "searching"
        : b.stage === "options"
          ? draft
            ? "suggested"
            : "deciding"
          : b.stage === "planned"
            ? "chosen"
            : b.stage === "notNeeded"
              ? "skipped"
              : legArranged
                ? "arranged"
                : "booked";
  const badges = badgesOf(options, frame, env);
  const top = options.slice(0, 3).map((item, n) => optionVM(item, env, { place: n + 1, frame, kind, draft, badges: badges.get(item.id) }));
  const shown = status === "suggested" ? draft : status === "chosen" || status === "booked" || status === "arranged" || status === "included" ? settled : null;
  const chosen = shown ? (top.find((o) => o.id === shown.id) ?? optionVM(shown, env, { place: options.indexOf(shown) + 1 || 1, frame, kind, draft, badges: badges.get(shown.id) })) : null;
  const booked = status === "booked" && settled?.status === "booked" ? settled : null;
  const paidText = booked ? ((frame === "ticket" ? ticketPrices(booked, env.facts(booked).price, env.people)?.total : null) ?? env.facts(booked).price?.text ?? null) : null;
  const open = status === "searching" || status === "deciding";
  const est = open && kind !== "insurance" ? estimatedRange(live, section === "stay" ? nightsOf(b, lead).nights || null : null) : null;
  const note =
    status === "arranged" || status === "included"
      ? settled
        ? // "Ben hallettim" says it whatever the kind (cardView's words; a taxi's foot would say "rezervasyon gerekmez").
          settled.arranged && settled.noBooking != null
          ? L("sen hallettin", "you sorted it")
          : footText(footOf(settled, kind, { included: env.festival }).left)
        : view
          ? footText(view.foot.left)
          : null
      : null;
  return {
    key: b.key,
    section,
    frame,
    kind,
    status,
    word: statusWord(status, kind),
    head: headOf(section, b, lead, leg, kind, env),
    options: top,
    optionCount: options.length + (shown && shown !== draft ? 1 : 0),
    chosen,
    planned: [],
    access: booked ? accessOf(booked, kind, env) : null,
    paid: paidText ? L(`${paidText} ödendi`, `${paidText} paid`) : null,
    estimate: est ? { label: rangeLabel(est), unit: est.unit, n: est.n } : null,
    note,
    suggestions: [],
    itemIds: records.map((i) => i.id),
    domKeys: b.entries.map(catDomKey),
  };
}

/** What a category is told is missing (C16: a return ticket, an eSIM, insurance): an intent still to find, never booked. */
function suggestedIntent(section: SectionId, s: Suggestion, env: Env): IntentVM {
  const kind: CardKind = s.template === "esim" ? "esim" : s.template === "insurance" ? "insurance" : (DEFAULT_KIND[section] ?? "other");
  const start = isoDate(s.payload?.start ?? null);
  const range = start ? { start, end: isoDate(s.payload?.end ?? null) } : env.input.plan.range;
  return {
    key: `suggestion:${s.key}`,
    section,
    frame: frameOf(section),
    kind,
    status: "searching",
    word: statusWord("searching", kind),
    head: { name: s.title, route: null, parts: range ? [formatDateRange(range.start, range.end)] : [], kindWord: MIXED.includes(section) ? cardKindLabel(kind) : null, wants: [], image: null, city: s.payload?.city ?? null, date: range?.start ?? null, nights: 0 },
    options: [],
    optionCount: 0,
    chosen: null,
    planned: [],
    access: null,
    paid: null,
    estimate: null,
    note: s.why || null,
    suggestions: [s],
    itemIds: [],
    domKeys: [],
  };
}

/** Gerek yok (F3): a transfer or nights said not needed fold into the category's "Gizlenenler · n", one tap from coming back. */
function skippedIntents(section: CatSection): IntentVM[] {
  return section.hidden.flatMap((h): IntentVM[] => {
    if (h.kind !== "leg" && h.kind !== "nights") return [];
    const base = { section: section.id, frame: frameOf(section.id), status: "skipped" as const, options: [], optionCount: 0, chosen: null, planned: [], access: null, paid: null, estimate: null, note: null, suggestions: [], itemIds: [], domKeys: [] };
    if (h.kind === "leg") {
      const view = legCardView(h.leg);
      return [{ ...base, key: h.key, kind: view.kind, word: statusWord("skipped"), head: { name: legShortTitle(h.leg), route: null, parts: [shortDay(h.leg.date)], kindWord: MIXED.includes(section.id) ? view.label : null, wants: [], image: null, city: h.leg.to.city, date: h.leg.date, nights: 0 } }];
    }
    const nights = nightsBetween(h.range.start, h.range.end);
    return [{ ...base, key: h.key, kind: "stay", word: statusWord("skipped"), head: { name: h.city ?? L("Konaklama", "Stay"), route: null, parts: [nNights(nights), formatDateRange(h.range.start, h.range.end)], kindWord: null, wants: [], image: null, city: h.city, date: h.range.start, nights } }];
  });
}

// --- many picks: things to do and book, by city ----------------------------------------------------------------

/** On the plan: an activity chosen or booked; a thing to do or a meal also once it has a day, or was done. */
const isPlanned = (section: SectionId, item: Item): boolean =>
  item.status === "chosen" || item.status === "booked" || (section !== "activity" && (Boolean(isoDate(item.dates.start)) || item.doneAt != null));

type Card = { city: string | null; rank: number; at: string | null; item?: Item; suggestion?: Suggestion };

function collectionIntents(section: CatSection, env: Env): IntentVM[] {
  const id = section.id;
  const records = uniq(section.entries.map(recordOf).filter(nonNull)).filter((i) => i.status !== "dismissed");
  const open = [...(env.input.suggestions?.[id] ?? []), ...(id === "todo" ? (env.input.suggestions?.food ?? []) : [])].filter((s) => s.kind === "add");
  const cards: Card[] = [
    ...records.map((item) => ({ city: item.city, rank: item.status === "booked" ? EVENT_RANK.booked : isPlanned(id, item) ? EVENT_RANK.plan : EVENT_RANK.idea, at: isoDate(item.dates.start), item })),
    ...open.map((s) => ({ city: s.payload?.city ?? null, rank: EVENT_RANK.idea, at: isoDate(s.payload?.start ?? null), suggestion: s })),
  ];
  const kind: CardKind = id === "activity" ? "activity" : "todo";
  return eventsByCity(citiesOfPlan(env.input.plan), cards)
    .filter((g) => g.cards.length)
    .map((g) => {
      const items = g.cards.map((c) => c.item).filter(nonNull);
      const planned = items.filter((i) => isPlanned(id, i));
      const ideas = items.filter((i) => !planned.includes(i));
      const suggestions = g.cards.map((c) => c.suggestion).filter(nonNull);
      const bought = planned.filter((i) => i.status === "booked").length;
      const status: IntentStatus = planned.length ? (bought === planned.length ? "booked" : "chosen") : ideas.length || suggestions.length ? "deciding" : "searching";
      const word = planned.length
        ? [L(`${planned.length} planda`, `${planned.length} on the plan`), bought && bought < planned.length ? L(`${bought} alındı`, `${bought} booked`) : null].filter(Boolean).join(" · ")
        : statusWord(status, kind);
      const range = g.start ? formatDateRange(g.start, g.end ?? null) : null;
      const vm = (item: Item, n: number) => optionVM(item, env, { place: n + 1, frame: "collection", kind: cardKind(item), draft: null });
      const entries = section.entries.filter((e) => e.itemIds.some((x) => items.some((i) => i.id === x)));
      return {
        key: `${id}:${g.city ?? "-"}`,
        section: id,
        frame: "collection" as const,
        kind,
        status,
        word,
        head: { name: g.city ?? L("Şehri belli değil", "No city yet"), route: null, parts: range ? [range] : [], kindWord: null, wants: [], image: null, city: g.city, date: g.start ?? null, nights: 0 },
        options: ideas.slice(0, 4).map(vm),
        optionCount: items.length + suggestions.length,
        chosen: null,
        planned: planned.map(vm),
        access: null,
        paid: null,
        estimate: null,
        note: null,
        suggestions,
        itemIds: items.map((i) => i.id),
        domKeys: entries.map(catDomKey),
      };
    });
}

/**
 * A category's intents in its order: one choice per need (the way in and home, each stay's nights, each transfer, an eSIM),
 * then what the category is told is missing, then what was said not needed; things to do and book one row per city.
 * Hazırlık is a checklist, not intents (its row counts it).
 */
export const intentsOf = (section: CatSection, input: IntentInput): IntentVM[] => intentsWith(section, envOf(input));

function intentsWith(section: CatSection, env: Env): IntentVM[] {
  if (section.id === "prep" || section.id === "inspo") return [];
  if (isCollection(section.id)) return collectionIntents(section, env);
  const own = bucketsOf(section).map((b) => singleIntent(section.id, b, env));
  const told = (env.input.suggestions?.[section.id] ?? []).filter((s) => s.kind === "add").map((s) => suggestedIntent(section.id, s, env));
  return [...own, ...told, ...skippedIntents(section)];
}

// --- the closed row (K0) -------------------------------------------------------------------------------------

export interface CollectionSummary {
  id: SectionId;
  name: string;
  /** The one line under the name: "4 şehir · 14 gece · 10 fikir", "2 uçuş · gidiş ve dönüş · 5 fikir", "2/6 hazır". */
  line: string;
  /** At most three small pictures (the chosen ones first), and how many more there are. */
  thumbs: string[];
  more: number;
  /** "1 alındı · 1 seçildi · 2 karar" (a row of cards: "planda"); "boş" when nothing is there yet. */
  countsText: string;
  counts: { booked: number; chosen: number; decide: number; arranged: number; skipped: number };
  /** The bar's two tones, in percent of the intents: bought (and arranged), chosen. */
  bar: { booked: number; chosen: number };
  /** Every option gathered in it ("10 fikir"). */
  ideas: number;
  /** What's chosen and booked, in its main currency; the share of the budget set aside for it. */
  spent: { amount: number; currency: string } | null;
  allotted: { amount: number; currency: string } | null;
  /** Hazırlık: "2/6 hazır". */
  ready: { done: number; total: number } | null;
}

const SLICE: Partial<Record<SectionId, BudgetSlice>> = { flight: "flight", stay: "stay", transport: "transport", activity: "activity", other: "other" };

/** What's chosen and booked in a section in its main currency (the Plan's section header adds it up the same way). */
function spentOf(section: CatSection): { amount: number; currency: string } | null {
  const by = new Map<string, number>();
  for (const e of section.entries) {
    if (e.state !== "done" && e.state !== "book") continue;
    const p = e.row.price;
    if (!p || !p.currency || !(p.amount > 0)) continue;
    by.set(p.currency, (by.get(p.currency) ?? 0) + p.amount);
  }
  const top = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? { amount: Math.round(top[1]), currency: top[0] } : null;
}

/** A way of travel in a word, for Ulaşım's line ("tren ve transfer"). */
function travelWord(kind: CardKind): string {
  return kind === "taxi" ? L("transfer", "transfer") : lowerFirst(cardKindLabel(kind));
}

function lineOf(section: CatSection, intents: IntentVM[], ideas: number): string {
  const counted = intents.filter((i) => i.status !== "skipped");
  const n = counted.length;
  const parts: (string | null)[] = [];
  switch (section.id) {
    case "flight": {
      const roles = new Set(section.entries.flatMap((e) => (e.piece.kind === "entry" && e.piece.entry.kind === "travel" ? [e.piece.entry.role] : [])));
      parts.push(count(n, "uçuş", "flight"), roles.has("arrival") && roles.has("departure") ? L("gidiş ve dönüş", "out and back") : null);
      break;
    }
    case "stay": {
      const cities = uniq(counted.map((i) => i.head.city?.toLocaleLowerCase("tr")).filter(nonNull)).length;
      const nights = counted.reduce((s, i) => s + i.head.nights, 0);
      parts.push(cities ? count(cities, "şehir", "city", "cities") : null, nights ? nNights(nights) : null);
      break;
    }
    case "transport":
      parts.push(count(n, "yolculuk", "journey"), counted.length ? joinAnd(uniq(counted.map((i) => travelWord(i.kind)))) : null);
      break;
    case "activity":
      parts.push(n ? L(`${n} şehir için`, `for ${n} ${n === 1 ? "city" : "cities"}`) : null);
      break;
    case "todo":
      parts.push(L("Gezilecek yerler ve restoranlar", "Places to see and restaurants"));
      break;
    case "other":
      parts.push(counted.length ? joinAnd(uniq(counted.map((i) => lowerFirst(cardKindLabel(i.kind))))) : null);
      break;
    default:
      break;
  }
  if (ideas) parts.push(count(ideas, "fikir", "idea"));
  return parts.filter(nonNull).join(" · ");
}

/** A category's closed row (K0): its name, its line, three pictures, where its intents stand, its money. */
export function collectionSummary(section: CatSection, intents: IntentVM[], input: IntentInput): CollectionSummary {
  const allot = SLICE[section.id] && input.allot && input.allot.by[SLICE[section.id]!] > 0 ? { amount: input.allot.by[SLICE[section.id]!], currency: input.allot.currency } : null;
  if (section.id === "prep") {
    const done = section.entries.filter((e) => e.state === "done").length;
    const total = section.entries.length;
    const ready = { done, total };
    return {
      id: section.id,
      name: sectionName(section.id),
      line: L(`${done}/${total} hazır`, `${done}/${total} ready`),
      thumbs: [],
      more: 0,
      countsText: "",
      counts: { booked: 0, chosen: 0, decide: 0, arranged: 0, skipped: 0 },
      bar: { booked: total ? Math.round((done / total) * 100) : 0, chosen: 0 },
      ideas: 0,
      spent: null,
      allotted: null,
      ready,
    };
  }
  const counted = intents.filter((i) => i.status !== "skipped");
  const multi = isCollection(section.id);
  const is = (...s: IntentStatus[]) => counted.filter((i) => s.includes(i.status)).length;
  // A row of cards counts its cards (prototype: "1 alındı · 1 planda"), a single choice its intents.
  const booked = multi ? counted.reduce((n, i) => n + i.planned.filter((o) => o.item.status === "booked").length, 0) : is("booked");
  const chosen = multi ? counted.reduce((n, i) => n + i.planned.filter((o) => o.item.status !== "booked").length, 0) : is("chosen");
  const decide = is("searching", "deciding", "suggested");
  const arranged = is("arranged", "included");
  const text = [
    booked ? L(`${booked} alındı`, `${booked} booked`) : null,
    chosen ? (multi ? L(`${chosen} planda`, `${chosen} on the plan`) : L(`${chosen} seçildi`, `${chosen} chosen`)) : null,
    decide ? L(`${decide} karar`, `${decide} to decide`) : null,
  ].filter(nonNull);
  const total = counted.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const pictures = uniq(
    counted.flatMap((i) => {
      const own = [i.chosen?.image, ...i.planned.map((o) => o.image)].filter(nonNull);
      return own.length ? own : [i.options[0]?.image].filter(nonNull);
    }),
  );
  const ideas = counted.reduce((n, i) => n + i.optionCount, 0);
  return {
    id: section.id,
    name: sectionName(section.id),
    line: lineOf(section, intents, ideas),
    thumbs: pictures.slice(0, 3),
    more: Math.max(0, pictures.length - 3),
    countsText: text.length ? text.join(" · ") : L("boş", "empty"),
    counts: { booked, chosen, decide, arranged, skipped: intents.length - counted.length },
    bar: { booked: pct(is("booked", "arranged", "included")), chosen: pct(is("chosen")) },
    ideas,
    spent: spentOf(section),
    allotted: allot,
    ready: null,
  };
}

export interface Collection {
  section: CatSection;
  summary: CollectionSummary;
  intents: IntentVM[];
}

/** The v82 Plan's categories in order, each with its closed row and its intents; one with nothing in it isn't drawn. */
export function collectionsOf(input: IntentInput): Collection[] {
  const env = envOf(input);
  return V82_ORDER.flatMap((id) => {
    const section = input.sections.find((s) => s.id === id);
    if (!section) return [];
    const intents = intentsWith(section, env);
    if (!section.entries.length && !section.hidden.length && !intents.length) return [];
    return [{ section, summary: collectionSummary(section, intents, input), intents }];
  });
}

// --- the hero's two shares (B9) ---------------------------------------------------------------------------------

export interface Share {
  count: number;
  /** Every intent but those said not needed. */
  total: number;
  /** Whole percent; null with nothing to count. */
  pct: number | null;
}

const share = (intents: readonly Pick<IntentVM, "status">[], counts: readonly IntentStatus[]): Share => {
  const live = intents.filter((i) => i.status !== "skipped");
  const n = live.filter((i) => counts.includes(i.status)).length;
  return { count: n, total: live.length, pct: live.length ? Math.round((n / live.length) * 100) : null };
};

/**
 * B9 "Omurganın %X'i planda": bought, arranged, chosen (a row of cards with at least one on the plan is chosen), and what
 * another booking covers, of every intent but those said not needed. Our pick isn't on the plan until it's taken.
 */
export const planShare = (intents: readonly Pick<IntentVM, "status">[]): Share => share(intents, ["booked", "arranged", "chosen", "included"]);

/** B9 "%Y'si alındı": bought or arranged, of the same intents. */
export const bookedShare = (intents: readonly Pick<IntentVM, "status">[]): Share => share(intents, ["booked", "arranged"]);
