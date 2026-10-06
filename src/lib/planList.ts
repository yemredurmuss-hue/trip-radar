// The hero's list of what's left, from the same entries as its "Planlama %75" (categories.planStages), so the box
// and the list it opens never disagree: "Karar bekliyor" is exactly the needs waiting for a decision, "Rezerve
// edilecek" exactly the ones planned and not booked, one row per need (two people's tickets on one flight card
// are one row, as they're one need). A need with no to-do of its own (an activity or an eSIM with options, say)
// gets a row from its card. Apart from the stages: the ways between places that aren't on the Plan yet ("Varış
// transferi · nasıl?") and the free cancellations running out. Pure.
import { findInSections, stagedEntries, type CatEntry, type CatSection, type PlanStages } from "./categories";
import { locale } from "./i18n";
import { nightsBetween } from "./items";
import type { Todo } from "./progress";
import type { Item } from "./types";

export interface PlanList {
  stages: PlanStages;
  /** Waiting for a decision: options, or nothing yet (Karar bekliyor). */
  open: Todo[];
  /** Decided, not booked yet (Rezerve edilecek). */
  book: Todo[];
  /** A transfer or a way between two places not on the Plan yet: a question, not one of the stages. */
  ways: Todo[];
  /** Free cancellations running out. */
  deadlines: Todo[];
}

const SOON_DAYS = 14;
const byDate = (a: Todo, b: Todo) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.title.localeCompare(b.title, locale());

/** A row for a need that has no to-do of its own: its card's name, where and when, and its state. */
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

export function planList(sections: CatSection[], todos: Todo[], today: string, isPlaceholder: (item: Item) => boolean = () => false): PlanList {
  const staged = stagedEntries(sections, isPlaceholder);
  const stage = new Map<string, "open" | "planned">([...staged.open.map((e) => [e.key, "open"] as const), ...staged.planned.map((e) => [e.key, "planned"] as const)]);
  const rows = new Map<string, Todo>();
  const ways: Todo[] = [];
  const deadlines: Todo[] = [];
  for (const t of todos) {
    if (t.kind === "deadline") {
      deadlines.push(t);
      continue;
    }
    const hit = findInSections(sections, t.target);
    if (hit) {
      const s = stage.get(hit.key);
      // The to-do says what its need's stage says (a decision, or a booking), else the card's own row stands in.
      const fits = s === "open" ? t.kind === "decide" || t.kind === "plan" : s === "planned" ? t.kind === "book" : false;
      if (fits && !rows.has(hit.key)) rows.set(hit.key, t);
      continue;
    }
    // Not on the Plan: a transfer nobody has said anything about yet.
    if (t.target.leg) ways.push(t);
  }
  const open = staged.open.map((e) => rows.get(e.key) ?? rowOf(e, e.state === "empty" ? "plan" : "decide", today));
  const book = staged.planned.map((e) => rows.get(e.key) ?? rowOf(e, "book", today));
  return {
    stages: { booked: staged.booked.length, planned: book.length, open: open.length, total: staged.booked.length + book.length + open.length },
    open: open.sort(byDate),
    book: book.sort(byDate),
    ways: ways.sort(byDate),
    deadlines: deadlines.sort(byDate),
  };
}

/** Everything in the list, soonest first: the hero's "Planı tamamla" goes to the first. */
export const listTodos = (list: PlanList): Todo[] => [...list.open, ...list.book, ...list.ways, ...list.deadlines].sort(byDate);
