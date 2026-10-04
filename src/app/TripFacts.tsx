// The facts column beside the hero: dates, origin, travellers, visa, local money and time, budget;
// at the bottom the next step (the first to-do) and a quiet line of the rest. Unknown rows are left out.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDateRange, formatPrice, nightsBetween } from "../lib/items";
import { L, locale } from "../lib/i18n";
import { nDays } from "../lib/i18nText";
import { BUDGET_SLICES, type BudgetBar, type BudgetSlice, type DecisionProgress, type Todo, type TodoKind } from "../lib/progress";
import type { TripFacts as Facts } from "../lib/tripFacts";
import { VISA_CHECKED } from "../lib/visa";
import { HeroIcon, type HeroIconName } from "./Icons";
import { kinds } from "./Progress";
import { ShareLine, useShare } from "./Share";

export function TripFacts(props: {
  range: { start: string; end: string } | null;
  estimated: boolean;
  facts: Facts;
  passport: string;
  bar: BudgetBar | null;
  progress: DecisionProgress;
  onGo: (t: Todo["target"]) => void;
  /** Opens the share dialog when every to-do is done; absent where the trip can't be shared (the sample). */
  onShare?: () => void;
  /** Which kind's list is open under the hero. */
  todoOpen: TodoKind | null;
  onTodo: (kind: TodoKind | null) => void;
}) {
  const { range, facts, bar, progress } = props;
  const shared = !!useShare();
  const days = range ? nightsBetween(range.start, range.end) + 1 : 0;
  const next = progress.todos[0];
  const local = facts.local && (facts.local.rateText || facts.local.hours) ? facts.local : null;
  return (
    <aside className="hx-side">
      <div className="hx-rows">
        {range && (
          <Row
            icon="cal"
            label={L("Tarihler", "Dates")}
            value={
              <>
                {formatDateRange(range.start, range.end)} <span className="of">· {nDays(days)}</span>
              </>
            }
            sub={props.estimated ? L("~tahmini · kayıtlardan", "~estimated · from saves") : null}
          />
        )}
        {facts.origin && <Row icon="pin" label={L("Kalkış", "From")} value={facts.origin} />}
        {facts.adults ? (
          <Row icon="users" label={L("Yolcu", "Travellers")} value={L(`${facts.adults} yetişkin`, `${facts.adults} adult${facts.adults === 1 ? "" : "s"}`)} sub={shared ? <ShareLine /> : null} />
        ) : (
          // Shared but the saves don't say how many: the sharing still has its line.
          shared && <Row icon="users" label={L("Paylaşım", "Sharing")} value={<ShareLine />} />
        )}
        {facts.visa && (
          <Row
            icon="passport"
            label={/^[A-Z]{2}$/.test(props.passport) && props.passport !== "XX" ? L(`Vize · ${props.passport} pasaportu`, `Visa · ${props.passport} passport`) : L("Vize", "Visa")}
            value={
              <a href={facts.visa.link} target="_blank" rel="noreferrer" title={L(`${hostOf(facts.visa.link)} · kontrol: ${checked()}`, `${hostOf(facts.visa.link)} · checked: ${checked()}`)}>
                {facts.visa.label} ↗
              </a>
            }
          />
        )}
        {local && (
          <Row
            icon="globe"
            label={L("Yerel", "Local")}
            title={`${L(local.info.language.tr, local.info.language.en)} · ${L(`${local.info.plugs.join("/")} tipi priz`, `plug type ${local.info.plugs.join("/")}`)}`}
            value={
              <>
                {local.rateText}
                {local.hours ? (
                  <span className="of">
                    {local.rateText ? " · " : ""}
                    {local.hours > 0 ? "+" : "−"}
                    {Math.abs(local.hours).toLocaleString(locale())} {L("saat", "h")}
                  </span>
                ) : null}
              </>
            }
          />
        )}
        {bar && <BudgetRow bar={bar} />}
      </div>
      {next ? (
        <button className="hx-next" onClick={() => props.onGo(next.target)}>
          <small>{L("Sıradaki adım", "Next step")}</small>
          <span title={`${kinds().find((k) => k.kind === next.kind)?.label}: ${next.title}`}>
            <em>
              {kinds().find((k) => k.kind === next.kind)?.label}: {next.title}
            </em>
            <HeroIcon name="arrow" size={18} />
          </span>
        </button>
      ) : props.onShare ? (
        <button className="hx-next" onClick={props.onShare}>
          <small>{L("Her şey hazır", "All set")}</small>
          <span>
            {L("Bu geziyi paylaş", "Share this trip")} <HeroIcon name="arrow" size={18} />
          </span>
        </button>
      ) : (
        <div className="hx-next">
          <small>{L("Her şey hazır", "All set")}</small>
          <span>{L("Her şey karara bağlandı", "Everything's decided")}</span>
        </div>
      )}
      {progress.todos.length > 0 && (
        <div className="hx-todo" aria-label={L("Yapılacaklar", "To do")}>
          {kinds()
            .filter((k) => progress.count[k.kind] > 0)
            .map((k) => (
              <button
                key={k.kind}
                className={props.todoOpen === k.kind ? "on" : ""}
                aria-expanded={props.todoOpen === k.kind}
                title={k.kind === "deadline" ? L(`Ücretsiz iptal süresi yaklaşan ${progress.count.deadline} rezervasyon`, `${progress.count.deadline} free cancellation(s) running out`) : undefined}
                onClick={() => props.onTodo(props.todoOpen === k.kind ? null : k.kind)}
              >
                {k.kind === "deadline" ? "⏳" : k.label} <b>{progress.count[k.kind]}</b>
              </button>
            ))}
        </div>
      )}
    </aside>
  );
}

/**
 * Booked + chosen against the budget, as a thin bar in the categories' colours (the rest a grey track);
 * a tap opens the split, what's left, and what the open decisions will likely add.
 */
function BudgetRow({ bar }: { bar: BudgetBar }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const known = bar.booked + bar.chosen;
  if (known <= 0 && bar.total == null) return null;
  const scale = Math.max(bar.total ?? 0, known) || 1;
  const money = (n: number) => formatPrice(n, bar.currency);
  const over = bar.total != null && known > bar.total ? known - bar.total : 0;
  const slices = BUDGET_SLICES.filter((s) => bar.byCategory[s] > 0);
  return (
    <div className="hx-row click" ref={box} title={L("Ayrıntı için tıkla", "Click for details")} onClick={() => setOpen(!open)}>
      <HeroIcon name="wallet" />
      <div>
        <small>{bar.total != null ? L("Bütçe", "Budget") : L("Bilinen toplam", "Known total")}</small>
        <strong>
          {money(known)}
          {bar.total != null && <span className="of"> / {money(bar.total)}</span>}
          {over > 0 && <span className="hx-over"> · {L(`${money(over)} aşıyor`, `${money(over)} over`)}</span>}
        </strong>
        <div className="hx-meter" aria-label={L("Kategoriye göre harcama", "Spending by category")}>
          {slices.map((s) => (
            <i key={s} className={`c-${s}`} style={{ width: `${(bar.byCategory[s] / scale) * 100}%` }} title={`${sliceLabel(s)} ${money(bar.byCategory[s])}`} />
          ))}
        </div>
      </div>
      {open && (
        <div className="hx-pop" onClick={(e) => e.stopPropagation()}>
          {slices.map((s) => (
            <div key={s} className="line">
              <span>
                <i className={`c-${s}`} />
                {sliceLabel(s)}
              </span>
              <b>{money(bar.byCategory[s])}</b>
            </div>
          ))}
          {bar.total != null && known <= bar.total && (
            <>
              {slices.length > 0 && <div className="sep" />}
              <div className="line">
                <span>{L("Kalan", "Left")}</span>
                <b>{money(bar.total - known)}</b>
              </div>
            </>
          )}
          {bar.open > 0 && (
            <div className="left">{L(`Karar bekleyenler seçilince yaklaşık ${money(bar.open)} daha eklenir.`, `About ${money(bar.open)} more once the open decisions are made.`)}</div>
          )}
          {bar.uncounted > 0 && <div className="left">{L(`${bar.uncounted} fiyat sayılamadı.`, bar.uncounted === 1 ? "1 price couldn't be counted." : `${bar.uncounted} prices couldn't be counted.`)}</div>}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value, sub, title }: { icon: HeroIconName; label: string; value: ReactNode; sub?: ReactNode; title?: string }) {
  return (
    <div className="hx-row">
      <HeroIcon name={icon} />
      <div>
        <small>{label}</small>
        <strong title={title}>{value}</strong>
        {sub ? <span className="sub">{sub}</span> : null}
      </div>
    </div>
  );
}

const sliceLabel = (s: BudgetSlice) =>
  ({ flight: L("Uçuş", "Flights"), stay: L("Konaklama", "Stays"), transport: L("Ulaşım", "Transport"), activity: L("Etkinlik", "Activities"), other: L("Diğer", "Other") })[s];

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** "Ekim 2026": when the visa table was last checked. */
const checked = () => new Date(`${VISA_CHECKED}-01T12:00:00Z`).toLocaleDateString(locale(), { month: "long", year: "numeric" });
