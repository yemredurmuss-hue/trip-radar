// A category's "Gizlenenler · n" (F3, C17; plan v83 "Gerek yok"): what was said not needed folds down here as its intent's
// head, one "Geri al" from coming back where it stood; what was ruled out among options that are still there, what a booking
// closed and a booking said cancelled stay one line each, as they always were (HiddenList). Grouped here from what the
// plan already keeps out of the way (categories.hiddenThings) and the suggestions said not needed; nothing is written.
// Pure; the list (app/plan/HiddenList) does the "Geri al".
import { cardKind, cardKindLabel, type CardKind } from "./cardKinds";
import type { HiddenThing, SectionId } from "./categories";
import { L } from "./i18n";
import { nNights } from "./i18nText";
import { shortDay } from "./ideas";
import { formatDateRange, isoDate, nightsBetween } from "./items";
import { legShortTitle } from "./legs";
import { groupKeyOf, type DateRange } from "./plan";
import type { Item, Suggestion } from "./types";

interface Head {
  /** Unique within the list. */
  key: string;
  name: string;
  /** The one info line's parts ("3 gece", "8–11 Eki"). */
  parts: string[];
  kind: CardKind;
}

export type HiddenEntry =
  /** Nights said not needed, with the options of those nights said not needed with them (they come back together). */
  | (Head & { type: "nights"; hiddenKey: string; range: DateRange; items: Item[] })
  /** A transfer or a change of city said not needed. */
  | (Head & { type: "leg"; hiddenKey: string })
  /** A need said not needed as a whole: every option it had (an eSIM, a policy). */
  | (Head & { type: "need"; items: Item[] })
  /** A suggestion said not needed (the rule's eSIM, its insurance). */
  | (Head & { type: "suggestion"; suggestion: Suggestion })
  /** One line as it always was: an option ruled out beside others, one a booking closed, a booking cancelled. */
  | { type: "row"; key: string; thing: HiddenThing };

/** Ruled out by "İptal ettim": a booking kept as cancelled, not a need said not needed. */
const cancelled = (item: Item) => item.cancelledAt != null || item.dismissedFrom === "booked";

const stayKey = (range: DateRange) => `stay@${range.start}_${range.end}`;

/**
 * The section's Gizlenenler in order: what was said not needed first (as their heads), then the one-line rows.
 * `live`: the section's records still on the plan (a need with one of them left is a ruled-out option, not a need gone);
 * `suggestions`: the trip's suggestions (those said not needed in this section count).
 */
export function hiddenEntries(section: { id: SectionId; hidden: readonly HiddenThing[] }, live: readonly Item[], suggestions: readonly Suggestion[] = []): HiddenEntry[] {
  const heads: HiddenEntry[] = [];
  const rows: HiddenEntry[] = [];
  const nights = section.hidden.filter((h): h is Extract<HiddenThing, { kind: "nights" }> => h.kind === "nights");
  const takenBy = new Set<string>();
  for (const h of nights) {
    const items = section.hidden.flatMap((x) => (x.kind === "dismissed" && !cancelled(x.item) && groupKeyOf(x.item) === stayKey(h.range) ? [x.item] : []));
    for (const i of items) takenBy.add(i.id);
    const n = nightsBetween(h.range.start, h.range.end);
    heads.push({ type: "nights", key: h.key, hiddenKey: h.key, range: h.range, items, name: h.city ?? L("Konaklama", "Stay"), parts: [nNights(n), formatDateRange(h.range.start, h.range.end)], kind: "stay" });
  }
  for (const h of section.hidden) {
    if (h.kind === "leg") heads.push({ type: "leg", key: h.key, hiddenKey: h.key, name: legShortTitle(h.leg), parts: [shortDay(h.leg.date)], kind: "transport" });
  }
  // A need with every option ruled out (and none of it on the plan any more) is the need said not needed.
  const groups = new Map<string, Item[]>();
  for (const h of section.hidden) {
    if (h.kind === "closed" || (h.kind === "dismissed" && (cancelled(h.item) || takenBy.has(h.item.id)))) {
      if (h.kind === "closed" || !takenBy.has(h.item.id)) rows.push({ type: "row", key: h.key, thing: h });
      continue;
    }
    if (h.kind !== "dismissed") continue;
    const key = groupKeyOf(h.item);
    groups.set(key, [...(groups.get(key) ?? []), h.item]);
  }
  for (const [key, items] of groups) {
    const gone = section.id !== "stay" && !live.some((i) => groupKeyOf(i) === key);
    if (!gone) {
      for (const i of items) rows.push({ type: "row", key: `item:${i.id}`, thing: section.hidden.find((h) => h.key === `item:${i.id}`)! });
      continue;
    }
    const lead = items[0];
    const start = isoDate(lead.dates.start);
    // Named as its box was (intents.ts: the kind and its country or city).
    const kind = cardKind(lead);
    const place = lead.country ?? lead.city;
    heads.push({ type: "need", key: `need:${key}`, items, name: place ? `${cardKindLabel(kind)} · ${place}` : cardKindLabel(kind), parts: start ? [formatDateRange(start, isoDate(lead.dates.end))] : [], kind });
  }
  // The rule an eSIM or a policy said not needed was put to rest with (notNeededRule) isn't a second head.
  const covered = new Set<CardKind>([...heads.flatMap((h) => (h.type === "need" ? [h.kind] : [])), ...live.map((i) => cardKind(i))]);
  for (const s of suggestions) {
    if (s.state !== "dismissed" || s.kind !== "add" || s.section !== section.id) continue;
    const kind: CardKind = s.template === "esim" ? "esim" : s.template === "insurance" ? "insurance" : "other";
    if (covered.has(kind)) continue;
    const start = isoDate(s.payload?.start ?? null);
    heads.push({ type: "suggestion", key: `suggestion:${s.key}`, suggestion: s, name: s.title, parts: start ? [formatDateRange(start, isoDate(s.payload?.end ?? null))] : [], kind });
  }
  return [...heads, ...rows];
}

/**
 * An eSIM or a policy said not needed puts the rule that asks for one to rest too (suggestions.ts "rule:esim",
 * "rule:insurance"; a dismissed rule's topic stays quiet), or its options gone, the rule would ask for it again at once.
 */
export function notNeededRule(kind: CardKind, title: string): Suggestion | null {
  if (kind !== "esim" && kind !== "insurance") return null;
  return { key: `rule:${kind}`, section: "other", kind: "add", title, why: "", source: "rule", template: kind, createdAt: 0, state: "open" };
}
