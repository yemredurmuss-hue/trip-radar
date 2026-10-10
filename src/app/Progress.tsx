// What's left to do, as a list under the hero: the progress box's words list it all, in groups (Karar bekliyor,
// Rezerve edilecek, Belge eksik: the needs the hero counts; then the transfers not said yet and the cancellations
// running out), its "⏳ 2" only the cancellations; a tap on an entry takes you to it.
import { L } from "../lib/i18n";
import type { PlanList } from "../lib/planList";
import { entryDomId, nextStepText, type Todo, type TodoKind } from "../lib/progress";

/** Scrolls to an element and makes it glow for a moment. */
export function show(el: Element | null) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash");
  void (el as HTMLElement).offsetWidth; // restart the animation
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1700);
}

/** The card itself when it's on screen, else its transfer, else its place on the plan or in the itinerary. */
export function findTarget(target: Todo["target"]): Element | null {
  const card = target.item
    ? (document.querySelector(`[data-item-id="${CSS.escape(target.item)}"]`) ??
      // An option behind a card's ‹ 1/2 ›: its group's card.
      document.querySelector(`[data-option-ids~="${CSS.escape(target.item)}"]`))
    : null;
  const leg = target.leg ? document.getElementById(`leg-${target.leg}`) : null;
  const entry = target.entry ? document.getElementById(entryDomId(target.entry)) : null;
  const inDays = target.leg
    ? document.querySelector(`[data-it-key="${CSS.escape(`leg:${target.leg}`)}"]`)
    : target.entry
      ? document.querySelector(`[data-it-key="${CSS.escape(target.entry)}"]`)
      : null;
  return card ?? leg ?? entry ?? inDays;
}

export const kinds = (): { kind: TodoKind; label: string }[] => [
  { kind: "decide", label: L("Karar ver", "Decide") },
  { kind: "book", label: L("Rezerve et", "Book") },
  { kind: "plan", label: L("Planla", "Plan") },
  { kind: "deadline", label: L("İptal süresi", "Cancel by") },
];

export const when = (t: Todo) =>
  t.days == null ? null : t.days < 0 ? null : t.days === 0 ? L("bugün", "today") : L(`${t.days} gün`, `${t.days} day${t.days === 1 ? "" : "s"}`);

/**
 * Every to-do ("all", in groups: exactly the hero's "karar bekliyor" and "planlandı", then the transfers not said
 * yet and the cancellations running out), or only the cancellations (the hero's "⏳").
 */
export function TodoList({ list, open, onGo }: { list: PlanList; open: "all" | "deadline"; onGo: (target: Todo["target"]) => void }) {
  // A heading's number is the needs (the hero's); its rows can be more, one per person.
  const parts: { key: string; label: string | null; count: number; todos: Todo[] }[] = (
    open === "all"
      ? [
          { key: "open", label: L("Karar bekliyor", "To decide"), count: list.needs.open, todos: list.open },
          { key: "book", label: L("Rezerve edilecek", "To book"), count: list.needs.book, todos: list.book },
          { key: "docs", label: L("Belge eksik", "File missing"), count: list.needs.docs, todos: list.docs },
          { key: "ways", label: L("Ulaşım · nasıl gidilecek", "Getting there · how"), count: list.ways.length, todos: list.ways },
          { key: "deadline", label: L("İptal süresi", "Cancel by"), count: list.deadlines.length, todos: list.deadlines },
        ]
      : [{ key: "deadline", label: null, count: list.deadlines.length, todos: list.deadlines }]
  ).filter((g) => g.todos.length);
  if (!parts.length) return null;
  const label = open === "all" ? L("Yapılacaklar", "To do") : kinds().find((k) => k.kind === "deadline")?.label;
  return (
    <div className="todo-list" role="group" aria-label={label}>
      {parts.map((g) => (
        <div key={g.key} className="todo-group">
          {g.label && (
            <h3 className="todo-head">
              {g.label} <span>{g.count}</span>
            </h3>
          )}
          <ul aria-label={g.label ?? label}>
            {g.todos.map((t) => (
              <li key={t.key}>
                <button onClick={() => onGo(t.target)}>
                  <span className="todo-text">
                    <b>{open === "all" ? nextStepText(t) : t.title}</b>
                    <span className="muted">{t.note}</span>
                  </span>
                  {when(t) && <span className={`todo-when${t.soon ? " soon" : ""}`}>{when(t)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
