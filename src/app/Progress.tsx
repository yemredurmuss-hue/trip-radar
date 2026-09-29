// What's left to do, in one slim line under the trip's summary: a chip per kind (decide, book, plan,
// cancellations running out) with its count; a tap lists them, a tap on one takes you to it. And the
// money: booked, chosen, and a guess for what's still open, against the budget.
import { useState } from "react";
import { formatPrice } from "../lib/items";
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

/** The card itself when it's on screen, else its transfer, else its place on the line. */
function go(target: Todo["target"]) {
  const card = target.item ? document.querySelector(`[data-item-id="${CSS.escape(target.item)}"]`) : null;
  const leg = target.leg ? document.getElementById(`leg-${target.leg}`) : null;
  const entry = target.entry ? document.getElementById(entryDomId(target.entry)) : null;
  show(card ?? leg ?? entry);
}

const KINDS: { kind: TodoKind; label: string }[] = [
  { kind: "decide", label: "Karar ver" },
  { kind: "book", label: "Rezerve et" },
  { kind: "plan", label: "Planla" },
  { kind: "deadline", label: "İptal süresi" },
];

const when = (t: Todo) => (t.days == null ? null : t.days < 0 ? null : t.days === 0 ? "bugün" : `${t.days} gün`);

export function TodoStrip({ progress }: { progress: DecisionProgress }) {
  const [open, setOpen] = useState<TodoKind | null>(null);
  const { todos, count } = progress;
  const shown = KINDS.filter((k) => count[k.kind] > 0);
  if (!todos.length) {
    return (
      <div className="todo-strip done" aria-label="Yapılacaklar">
        <span className="todo-done">✓ Her şey karara bağlandı</span>
      </div>
    );
  }
  const list = open ? todos.filter((t) => t.kind === open) : [];
  return (
    <section className="todo-wrap" aria-label="Yapılacaklar">
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
              {soon && kind !== "deadline" && <i className="todo-soon" title="İki hafta içinde olanı var" />}
            </button>
          );
        })}
      </div>
      {open && list.length > 0 && (
        <ul className="todo-list">
          {list.map((t) => (
            <li key={t.key}>
              <button onClick={() => go(t.target)}>
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

export function BudgetBarView({ bar }: { bar: BudgetBar }) {
  const planned = bar.booked + bar.chosen;
  const sum = planned + bar.open;
  if (!sum) return null;
  const scale = Math.max(bar.total ?? 0, sum);
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const money = (n: number) => formatPrice(n, bar.currency);
  const left = bar.total != null ? bar.total - sum : null;
  return (
    <div className="budget" aria-label="Bütçe">
      <div className="budget-top">
        <span>
          <b>{money(sum)}</b>
          {bar.total != null ? <span className="muted"> / {money(bar.total)} bütçe</span> : <span className="muted"> tahmini toplam</span>}
        </span>
        {left != null && <span className={left < 0 ? "tone-danger" : "muted"}>{left >= 0 ? `${money(left)} kalıyor` : `${money(-left)} aşıyor`}</span>}
      </div>
      <div className="budget-bar" role="img" aria-label={`Rezerve ${money(bar.booked)}, seçilen ${money(bar.chosen)}, açık ihtiyaçlar için tahmini ${money(bar.open)}`}>
        <span className="b-booked" style={{ width: pct(bar.booked) }} />
        <span className="b-chosen" style={{ width: pct(bar.chosen) }} />
        <span className="b-open" style={{ width: pct(bar.open) }} />
      </div>
      <div className="budget-legend">
        <span>
          <i className="b-booked" />
          Rezerve {money(bar.booked)}
        </span>
        <span>
          <i className="b-chosen" />
          Seçilen {money(bar.chosen)}
        </span>
        {bar.open > 0 && (
          <span>
            <i className="b-open" />
            Açık, tahmini {money(bar.open)}
          </span>
        )}
        {bar.uncounted > 0 && <span>{bar.uncounted} fiyat hesaba katılamadı</span>}
      </div>
    </div>
  );
}
