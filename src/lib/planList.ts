// The hero's list of what's left, from the same needs as its numbers (categories.needsOf, lifecycle.ts), so the
// box and the list it opens never disagree. Its groups count needs: "Karar bekliyor" (Aranacak + Seçenekler),
// "Rezerve edilecek" (Planlandı), "Belge eksik" (Rezerve edildi, no file yet). A group's rows are the parts that
// hold its needs there: one per need, or one per person when each person's options are a group of their own
// (Emre's ticket and Sabine's). A part with no to-do of its own (an activity or an eSIM with options, say) gets a
// row from its card. Apart from the needs: the transfers not on the Plan yet ("Varış transferi · nasıl?") and the
// free cancellations running out. Pure.
import { findInSections, needsOf, type CatEntry, type CatSection } from "./categories";
import { countStages, type Stage, type StageCounts } from "./lifecycle";
import { locale } from "./i18n";
import { nightsBetween } from "./items";
import type { Todo } from "./progress";

export interface PlanList {
  /** The needs at each stage: the hero's numbers (lifecycle.heroNumbers). */
  counts: StageCounts;
  /** How many needs each group stands for (its heading's number; its rows can be more: one per person). */
  needs: { open: number; book: number; docs: number };
  /** Waiting for a decision: Aranacak and Seçenekler (Karar bekliyor). */
  open: Todo[];
  /** Planned, not booked yet (Rezerve edilecek). */
  book: Todo[];
  /** Booked, no file on it yet (Belge eksik). */
  docs: Todo[];
  /** A transfer not on the Plan yet: a question, not a need. */
  ways: Todo[];
  /** Free cancellations running out. */
  deadlines: Todo[];
}

const SOON_DAYS = 14;
const byDate = (a: Todo, b: Todo) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.title.localeCompare(b.title, locale());

/** A row for a part that has no to-do of its own: its card's name, where and when, and its state. */
function rowOf(e: CatEntry, kind: Todo["kind"], today: string): Todo {
  const days = e.date ? nightsBetween(today, e.date) : null;
  return {
    key: `cat:${e.key}`,
    kind,
    target: { item: e.itemIds[0], leg: e.legKeys[0], entry: e.domKey ?? e.entryKeys[0] },
    title: e.row.name,
    note: [e.row.meta, e.row.status].filter(Boolean).join(" · "),
    date: e.date,
    days,
    soon: days != null && days >= 0 && days <= SOON_DAYS,
  };
}

const OPEN: readonly Stage[] = ["search", "options"];
/** Which to-dos stand for a part at a stage: a decision for one waiting, a booking for one planned. */
const fits = (stage: Stage, kind: Todo["kind"]) => (OPEN.includes(stage) ? kind === "decide" || kind === "plan" : stage === "planned" ? kind === "book" : false);

export function planList(sections: CatSection[], todos: Todo[], today: string): PlanList {
  const needs = needsOf(sections);
  const rows = new Map<string, Todo>();
  const ways: Todo[] = [];
  const deadlines: Todo[] = [];
  const entries = new Map(needs.flatMap((n) => n.entries.map((e) => [e.key, e] as const)));
  for (const t of todos) {
    if (t.kind === "deadline") {
      deadlines.push(t);
      continue;
    }
    const hit = findInSections(sections, t.target);
    if (hit) {
      const e = entries.get(hit.key);
      if (e?.stage && fits(e.stage, t.kind) && !rows.has(e.key)) rows.set(e.key, t);
      continue;
    }
    // Not on the Plan: a transfer nobody has said anything about yet.
    if (t.target.leg) ways.push(t);
  }
  // A need's rows: its parts at the need's own stage (the ones holding it there).
  const group = (stages: readonly Stage[], kind: (e: CatEntry) => Todo["kind"]) => {
    const at = needs.filter((n) => stages.includes(n.stage));
    const list = at.flatMap((n) => n.entries.filter((e) => e.stage === n.stage).map((e) => rows.get(e.key) ?? rowOf(e, kind(e), today)));
    return { count: at.length, list: list.sort(byDate) };
  };
  const open = group(OPEN, (e) => (e.stage === "search" ? "plan" : "decide"));
  const book = group(["planned"], () => "book");
  const docs = group(["booked"], () => "doc");
  return {
    counts: countStages(needs.map((n) => n.stage)),
    needs: { open: open.count, book: book.count, docs: docs.count },
    open: open.list,
    book: book.list,
    docs: docs.list,
    ways: ways.sort(byDate),
    deadlines: deadlines.sort(byDate),
  };
}

/** What's left to act on, soonest first: the hero's "Planı tamamla" goes to the first. A missing file isn't a step. */
export const listTodos = (list: PlanList): Todo[] => [...list.open, ...list.book, ...list.ways, ...list.deadlines].sort(byDate);
