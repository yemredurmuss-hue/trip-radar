// What's left to do, as a list under the hero: the progress box's "3 rezerve · 3 planlandı · 2 karar bekliyor"
// lists them all, in groups (Karar bekliyor, Rezerve edilecek, then the cancellations running out), its "⏳ 2"
// only the free cancellations running out; a tap on an entry takes you to it.
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

/** The "all" list's groups: waiting for a decision (options, or nothing yet), decided and still to book, then the cancellations. */
const groups = (): { kinds: TodoKind[]; label: string }[] => [
  { kinds: ["decide", "plan"], label: L("Karar bekliyor", "To decide") },
  { kinds: ["book"], label: L("Rezerve edilecek", "To book") },
  { kinds: ["deadline"], label: L("İptal süresi", "Cancel by") },
];

/** Every to-do ("all", in groups), or the ones of one kind (the hero's "⏳": the cancellations running out). */
export function TodoList({ progress, open, onGo }: { progress: DecisionProgress; open: TodoKind | "all"; onGo: (target: Todo["target"]) => void }) {
  const list = open === "all" ? progress.todos : progress.todos.filter((t) => t.kind === open);
  if (!list.length) return null;
  const label = open === "all" ? L("Yapılacaklar", "To do") : kinds().find((k) => k.kind === open)?.label;
  const parts: { key: string; label: string | null; todos: Todo[] }[] =
    open === "all"
      ? groups()
          .map((g) => ({ key: g.kinds.join(), label: g.label, todos: list.filter((t) => g.kinds.includes(t.kind)) }))
          .filter((g) => g.todos.length)
      : [{ key: open, label: null, todos: list }];
  return (
    <div className="todo-list" role="group" aria-label={label}>
      {parts.map((g) => (
        <div key={g.key} className="todo-group">
          {g.label && (
            <h3 className="todo-head">
              {g.label} <span>{g.todos.length}</span>
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
