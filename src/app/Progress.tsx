// What's left to do, in one slim line under the trip's summary: a chip per kind (decide, book, plan,
// cancellations running out) with its count; a tap lists them, a tap on one takes you to it. And the
// money: booked, chosen, and a guess for what's still open, against the budget.
import { useState } from "react";
import { formatPrice } from "../lib/items";
import { L } from "../lib/i18n";
import { entryDomId, type BudgetBar, type DecisionProgress, type Todo, type TodoKind } from "../lib/progress";

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
  const card = target.item ? document.querySelector(`[data-item-id="${CSS.escape(target.item)}"]`) : null;
  const leg = target.leg ? document.getElementById(`leg-${target.leg}`) : null;
  const entry = target.entry ? document.getElementById(entryDomId(target.entry)) : null;
  const inDays = target.leg
    ? document.querySelector(`[data-it-key="${CSS.escape(`leg:${target.leg}`)}"]`)
    : target.entry
      ? document.querySelector(`[data-it-key="${CSS.escape(target.entry)}"]`)
      : null;
  return card ?? leg ?? entry ?? inDays;
}

const kinds = (): { kind: TodoKind; label: string }[] => [
  { kind: "decide", label: L("Karar ver", "Decide") },
  { kind: "book", label: L("Rezerve et", "Book") },
  { kind: "plan", label: L("Planla", "Plan") },
  { kind: "deadline", label: L("İptal süresi", "Cancel by") },
];

const when = (t: Todo) =>
  t.days == null ? null : t.days < 0 ? null : t.days === 0 ? L("bugün", "today") : L(`${t.days} gün`, `${t.days} day${t.days === 1 ? "" : "s"}`);

export function TodoStrip({ progress, onGo }: { progress: DecisionProgress; onGo: (target: Todo["target"]) => void }) {
  const [open, setOpen] = useState<TodoKind | null>(null);
  const { todos, count } = progress;
  const shown = kinds().filter((k) => count[k.kind] > 0);
  if (!todos.length) {
    return (
      <div className="todo-strip done" aria-label={L("Yapılacaklar", "To do")}>
        <span className="todo-done">{L("✓ Her şey karara bağlandı", "✓ Everything's decided")}</span>
      </div>
    );
  }
  const list = open ? todos.filter((t) => t.kind === open) : [];
  return (
    <section className="todo-wrap" aria-label={L("Yapılacaklar", "To do")}>
      <div className="todo-strip" role="tablist">
        {shown.map(({ kind, label }) => {
          const soon = todos.some((t) => t.kind === kind && t.soon);
          return (
            <button
              key={kind}
              role="tab"
              aria-selected={open === kind}
              className={`todo-chip k-${kind}${open === kind ? " on" : ""}`}
              onClick={() => setOpen(open === kind ? null : kind)}
            >
              {kind === "deadline" && <span aria-hidden>⏳</span>}
              {label}
              <b>{count[kind]}</b>
              {soon && kind !== "deadline" && <i className="todo-soon" title={L("İki hafta içinde olanı var", "Some are within two weeks")} />}
            </button>
          );
        })}
      </div>
      {open && list.length > 0 && (
        <ul className="todo-list">
          {list.map((t) => (
            <li key={t.key}>
              <button onClick={() => onGo(t.target)}>
                <span className="todo-text">
                  <b>{t.title}</b>
                  <span className="muted">{t.note}</span>
                </span>
                {when(t) && <span className={`todo-when${t.soon ? " soon" : ""}`}>{when(t)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * What the trip costs, as one bar: the whole of it is the total (said at the bar's end, or the budget
 * when there is one), filled green by what's booked and amber by what's chosen and still to book.
 */
export function BudgetBarView({ bar }: { bar: BudgetBar }) {
  const planned = bar.booked + bar.chosen;
  const sum = planned + bar.open;
  if (!sum) return null;
  const scale = Math.max(bar.total ?? 0, sum);
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const money = (n: number) => formatPrice(n, bar.currency);
  const left = bar.total != null ? bar.total - sum : null;
  const share = (n: number) => (sum ? L(` · %${Math.round((n / sum) * 100)}`, ` · ${Math.round((n / sum) * 100)}%`) : "");
  return (
    <section className="budget" aria-label={L("Gezinin maliyeti", "Trip cost")}>
      <div className="budget-top">
        <span className="budget-label">{bar.total != null ? L("Bütçe", "Budget") : L("Tahmini toplam", "Estimated total")}</span>
        <span className="budget-sum">
          {bar.total != null ? (
            <>
              <b>{money(sum)}</b>
              <span className="muted"> / {money(bar.total)}</span>
              <span className={left! < 0 ? "tone-danger" : "muted"}> · {left! >= 0 ? L(`${money(left!)} kalıyor`, `${money(left!)} left`) : L(`${money(-left!)} aşıyor`, `${money(-left!)} over`)}</span>
            </>
          ) : (
            <b>{money(sum)}</b>
          )}
        </span>
      </div>
      <div className="budget-bar" role="img" aria-label={L(
          `Toplam ${money(sum)}: rezerve ${money(bar.booked)}, seçilen ${money(bar.chosen)}, açık ihtiyaçlar için tahmini ${money(bar.open)}`,
          `Total ${money(sum)}: booked ${money(bar.booked)}, chosen ${money(bar.chosen)}, estimated ${money(bar.open)} for what's still open`,
        )}
      >
        <span className="b-booked" style={{ width: pct(bar.booked) }} />
        <span className="b-chosen" style={{ width: pct(bar.chosen) }} />
        <span className="b-open" style={{ width: pct(bar.open) }} />
      </div>
      <div className="budget-legend">
        <span>
          <i className="b-booked" />
          {L("Rezerve edildi", "Booked")} <b>{money(bar.booked)}</b>
          <small>{share(bar.booked)}</small>
        </span>
        <span>
          <i className="b-chosen" />
          {L("Seçildi, rezerve bekliyor", "Chosen, not booked yet")} <b>{money(bar.chosen)}</b>
        </span>
        {bar.open > 0 && (
          <span>
            <i className="b-open" />
            {L("Karar bekleyen, tahmini", "Still to decide, estimated")} <b>{money(bar.open)}</b>
          </span>
        )}
        {bar.uncounted > 0 && (
          <span className="budget-missing">
            {L(
              `${bar.uncounted} kalemin fiyatı yok, toplama girmedi`,
              bar.uncounted === 1 ? "1 item has no price, not in the total" : `${bar.uncounted} items have no price, not in the total`,
            )}
          </span>
        )}
      </div>
    </section>
  );
}
