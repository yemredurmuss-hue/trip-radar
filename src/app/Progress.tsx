// The trip's decisions at a glance, under its summary: what's still open (the near ones first in line),
// how many are made, the bookings still to make and the free cancellations running out. A tap takes
// you to it. And the money: booked, chosen, and a guess for what's still open, against the budget.
import { formatPrice } from "../lib/items";
import { entryDomId, type BudgetBar, type DecisionProgress } from "../lib/progress";

/** Scrolls to an element and makes it glow for a moment. */
function show(el: Element | null) {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("flash");
  void (el as HTMLElement).offsetWidth; // restart the animation
  el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 1700);
}

export function DecisionQueue({ progress }: { progress: DecisionProgress }) {
  const { made, total, open, reminders } = progress;
  if (!total) return null;
  const extra = reminders.length - 4;
  return (
    <section className="queue" aria-label="Karar sırası">
      <div className="queue-top">
        <b>{open.length ? `${open.length} karar kaldı` : "Tüm kararlar verildi ✓"}</b>
        <span className="queue-progress">
          <span className="queue-bar" aria-hidden>
            <span style={{ width: `${(made / total) * 100}%` }} />
          </span>
          {made} / {total} karar verildi
        </span>
      </div>
      {open.length > 0 && (
        <div className="queue-chips">
          {open.map((o) => (
            <button key={o.key} className={`qchip${o.soon ? " soon" : ""}`} onClick={() => show(document.getElementById(entryDomId(o.target)))}>
              <span>{o.title}</span>
              <small>
                {o.soon && <b className="due">{o.days === 0 ? "bugün" : `${o.days} gün kaldı`}</b>}
                {o.soon && " · "}
                {o.note}
              </small>
            </button>
          ))}
        </div>
      )}
      {reminders.length > 0 && (
        <div className="queue-reminders">
          {reminders.slice(0, 4).map((r) => (
            <button key={r.key} className={`qrem ${r.tone}`} onClick={() => show(document.querySelector(`[data-item-id="${r.itemId}"]`))}>
              {r.tone === "red" ? "⏳" : "◷"} {r.text}
            </button>
          ))}
          {extra > 0 && <span className="qrem more">+{extra}</span>}
        </div>
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
