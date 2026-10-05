// What's left to do, as a list under the hero: "3/6 onaylandı" in the hero's progress box lists them all,
// its "⏳ 2" only the free cancellations running out; a tap on an entry takes you to it.
import { L } from "../lib/i18n";
import { entryDomId, nextStepText, type DecisionProgress, type Todo, type TodoKind } from "../lib/progress";

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

/** Every to-do ("all"), or the ones of one kind (the hero's "⏳": the cancellations running out). */
export function TodoList({ progress, open, onGo }: { progress: DecisionProgress; open: TodoKind | "all"; onGo: (target: Todo["target"]) => void }) {
  const list = open === "all" ? progress.todos : progress.todos.filter((t) => t.kind === open);
  if (!list.length) return null;
  const label = open === "all" ? L("Yapılacaklar", "To do") : kinds().find((k) => k.kind === open)?.label;
  return (
    <ul className="todo-list" aria-label={label}>
      {list.map((t) => (
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
  );
}
