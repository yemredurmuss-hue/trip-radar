// The Pano (v11, docs/superpowers/specs/2026-10-08-plan-pano-v11-design.md, phase 5): every link the trip
// gathered, in one place to choose from and put on the plan. Its entries, categories, the state filter (Hepsi ·
// Karar bekleyen · Planda), the sort, the likes and the groups by need. Pure: the board draws what this says.
import { cityOfAirport } from "./airports";
import { isIdea } from "./booking";
import { cardKind, cardKindLabel } from "./cardKinds";
import { planSectionOfItem, type SectionId } from "./categories";
import type { GroupDecision } from "./decision";
import { L } from "./i18n";
import { formatDateRange, isoDate } from "./items";
import { groupKeyOf } from "./plan";
import type { Item } from "./types";

/** The Pano's tabs: everything, a section of the Plan (its records as the Plan draws them), and what someone liked. */
export type PanoCat = "all" | Exclude<SectionId, "food" | "prep"> | "liked";
export const PANO_CATS: readonly PanoCat[] = ["all", "flight", "stay", "transport", "activity", "todo", "other", "inspo", "liked"];
export type PanoState = "all" | "open" | "plan";
export type PanoSort = "fit" | "cheap" | "liked" | "new";

export interface PanoEntry {
  item: Item;
  section: Exclude<SectionId, "food" | "prep">;
  /** Its need (plan.groupKeyOf): the options of one stay's nights, one flight, one eSIM. */
  group: string;
  /** Its score in its need's comparison (0–100), when there is one. */
  score: number | null;
  /** On the plan: chosen (Seçildi / planned) or booked; null while it's only an option or an idea. */
  inPlan: "chosen" | "booked" | null;
  /** Its need is still open: nothing among its options is chosen or booked. */
  open: boolean;
}

/** A link on the board: anything live but a chore before the trip (Hazırlık is a list, not a link). */
const onPano = (item: Item) => item.status !== "dismissed" && planSectionOfItem(item) !== "prep";

export function panoEntries(items: Item[], decisions?: Map<string, GroupDecision> | null): PanoEntry[] {
  const live = items.filter(onPano);
  const decided = new Set(live.filter((i) => i.status === "chosen" || i.status === "booked").map(groupKeyOf));
  return live.map((item) => {
    const group = groupKeyOf(item);
    const score = decisions?.get(group)?.options.find((o) => o.item.id === item.id)?.score ?? null;
    const inPlan = item.status === "booked" ? "booked" : item.status === "chosen" ? "chosen" : null;
    // An idea (a thing to do, a meal, a Reel) is its own need: open until it's put on the plan.
    const open = isIdea(item) ? !inPlan : !decided.has(group);
    return { item, section: planSectionOfItem(item) as PanoEntry["section"], group, score, inPlan, open };
  });
}

/**
 * An option a data source found ("Seçeneklere ekle"): addedBy "ai". Nothing is guessed for a record from before that
 * field (a sample's saved stay has no capture either): it counts as the traveller's own.
 */
export const isAiOption = (item: Item): boolean => item.addedBy === "ai";

/** Who liked it (the board's owner as their name, or "me" when they have none yet). */
export const likersOf = (item: Item): string[] => item.likedBy ?? [];

export function inCat(e: PanoEntry, cat: PanoCat): boolean {
  if (cat === "all") return true;
  if (cat === "liked") return likersOf(e.item).length > 0;
  return e.section === cat;
}

export function inState(e: PanoEntry, state: PanoState): boolean {
  if (state === "all") return true;
  return state === "plan" ? e.inPlan != null : e.open && e.inPlan == null;
}

const priceOf = (i: Item): number => (i.price.amount != null && i.price.amount > 0 ? i.price.amount : Number.POSITIVE_INFINITY);
const addedAt = (i: Item): number => i.createdAt ?? 0;

/**
 * The order: "Bize en uygun" (the comparison's score, the unscored after, the newest first among equals), "En ucuz"
 * (no price last), "En çok beğenilen", "En yeni eklenen".
 */
export function sortEntries(list: PanoEntry[], sort: PanoSort): PanoEntry[] {
  const by = (f: (e: PanoEntry) => number) => [...list].sort((a, b) => f(a) - f(b) || addedAt(b.item) - addedAt(a.item));
  switch (sort) {
    case "cheap":
      return by((e) => priceOf(e.item));
    case "liked":
      return by((e) => -likersOf(e.item).length - (e.score ?? 0) / 1000);
    case "new":
      return [...list].sort((a, b) => addedAt(b.item) - addedAt(a.item));
    case "fit":
      return by((e) => (e.score == null ? 1000 : -e.score));
  }
}

/** The tabs' and the state switch's numbers, for what's on the board now. */
export function panoCounts(entries: PanoEntry[]): { cats: Record<PanoCat, number>; states: Record<PanoState, number> } {
  const cats = Object.fromEntries(PANO_CATS.map((c) => [c, entries.filter((e) => inCat(e, c)).length])) as Record<PanoCat, number>;
  const states = { all: entries.length, open: entries.filter((e) => inState(e, "open")).length, plan: entries.filter((e) => inState(e, "plan")).length };
  return { cats, states };
}

export interface PanoGroup {
  group: string;
  entries: PanoEntry[];
  /** The one on the plan, if any: the header says "Seçildi: X · Plan'da gör →". */
  chosen: PanoEntry | null;
}

/** A section's records by need, the needs with two or more options first (those are the ones to compare). */
export function panoGroups(list: PanoEntry[]): PanoGroup[] {
  const byGroup = new Map<string, PanoEntry[]>();
  for (const e of list) byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e]);
  const groups = [...byGroup.entries()].map(([group, entries]) => ({ group, entries, chosen: entries.find((e) => e.inPlan) ?? null }));
  return groups.sort((a, b) => Number(b.entries.length > 1) - Number(a.entries.length > 1));
}

export function panoCatLabel(cat: PanoCat): string {
  switch (cat) {
    case "all":
      return L("Tümü", "All");
    case "flight":
      return L("Uçuşlar", "Flights");
    case "stay":
      return L("Konaklama", "Stays");
    case "transport":
      return L("Ulaşım", "Getting around");
    case "activity":
      return L("Etkinlik", "Activities");
    case "todo":
      return L("Yapılacak", "To do");
    case "other":
      return L("Belgeler ve internet", "Documents and internet");
    case "inspo":
      return L("İlham", "Inspiration");
    case "liked":
      return L("Beğenilenler", "Liked");
  }
}

/** A need's name, as the Plan says it: "Porto → Lizbon", "Porto · 8–11 Eki", "eSIM · Portekiz". */
export function needTitleOf(item: Item): string {
  if (item.category === "flight" && item.flight?.from && item.flight?.to) return `${cityOfAirport(item.flight.from)} → ${cityOfAirport(item.flight.to)}`;
  const start = isoDate(item.dates.start);
  const when = start ? formatDateRange(start, isoDate(item.dates.end)) : null;
  if (item.category === "stay") return [item.city ?? L("Konaklama", "Stay"), when].filter(Boolean).join(" · ");
  return [cardKindLabel(cardKind(item)), item.city ?? item.country, when].filter(Boolean).join(" · ");
}

