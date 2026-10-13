// "Sırayla karar ver" (Karar Panosu #10, docs/mockups/artifact-arsivi/karar-panosu-taslagi-Hajs4s): the trip's open
// decisions one per screen ("1 / 3"), the one being looked at first, and at the end what was decided. Pure.
import type { GroupDecision } from "./decision";
import { CATEGORY_LABELS } from "./items";
import { L } from "./i18n";
import type { ValueCard } from "./value";

/** One decision of the trip with the title the Plan gives its need ("Porto · Konaklama"). */
export interface DecideStep {
  key: string;
  title: string;
  decision: GroupDecision | undefined;
  /** Its value card (the engine's pick and why), when there is one. */
  card?: ValueCard;
}

/** Real alternatives that nothing is chosen from yet: there is something to decide. */
export function isOpenDecision(d: GroupDecision | undefined): d is GroupDecision {
  if (!d || (d.status !== "ok" && d.status !== "tie")) return false;
  const live = d.options.filter((o) => !o.excluded);
  return live.length >= 2 && !live.some((o) => o.item.status === "chosen" || o.item.status === "booked");
}

/** The keys to go through: the decision on screen first (even if it is settled), then the other open ones in the Plan's order. */
export function stepKeys(steps: DecideStep[], firstKey: string): string[] {
  const rest = steps.filter((s) => s.key !== firstKey && isOpenDecision(s.decision)).map((s) => s.key);
  return steps.some((s) => s.key === firstKey) ? [firstKey, ...rest] : rest;
}

/** "1 / 3 · Porto · Konaklama". */
export const stepTitle = (at: number, of: number, title: string): string => `${at + 1} / ${of} · ${title}`;

export interface StepsOutcome {
  /** Need title -> the name picked. */
  decided: { key: string; title: string; name: string }[];
  /** Need titles passed with "Sonra". */
  later: { key: string; title: string }[];
}

/** What the end screen says: "2 karar verildi", "1 karar sonraya kaldı". Nothing is said about what wasn't done in a way that scolds. */
export function outcomeText({ decided, later }: StepsOutcome): string {
  const n = decided.length;
  const parts = [
    n ? L(`${n} karar verildi.`, `${n} decision${n === 1 ? "" : "s"} made.`) : L("Bu turda karar verilmedi.", "No decision made this round."),
    later.length ? L(`${later.length} karar sonraya kaldı.`, `${later.length} left for later.`) : null,
  ];
  return parts.filter(Boolean).join(" ");
}

/** The trip's needs as steps: the title is the window's own ("Konaklama · Porto · 3 gece"). */
export function buildSteps(
  groups: { key: string; title: string | null }[],
  decisions: Map<string, GroupDecision>,
  cards: Map<string, ValueCard>,
): DecideStep[] {
  return groups.map((g) => {
    const decision = decisions.get(g.key);
    return { key: g.key, title: [decision && CATEGORY_LABELS[decision.category], g.title].filter(Boolean).join(" · "), decision, card: cards.get(g.key) };
  });
}
