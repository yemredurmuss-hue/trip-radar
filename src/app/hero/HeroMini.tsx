// The hero scrolled out of sight (v82 "yapışkan ince şerit", C24): one bar at the top of the panel keeps where you are
// and what's next: the cover small, the trip's name, its dates and who goes, the backbone's bar and "%61 planda · 7
// karar", what it will likely cost against the budget (a dot: fits or over), the Plan | Pano switch and "Sıradaki"
// (else "Her şey hazır"). The hero's own numbers, never a second set. Hidden while the hero is in view.
import { useEffect, useState, type RefObject } from "react";
import { formatPrice } from "../../lib/items";
import { shareWords, type BudgetView, type HeroCounts } from "../../lib/heroStrip";
import { L } from "../../lib/i18n";
import { XIcon } from "./icons";
import type { HeroNext } from "./HeroStrip";

export function HeroMini({ hero, active, title, cover, line, counts, budget, view, onView, next, nextShort }: {
  hero: RefObject<HTMLElement | null>;
  /** On the Plan's views (no hero over the Pano). */
  active: boolean;
  title: string;
  cover: string | null;
  /** "8–14 Eki · 2 kişi". */
  line: string;
  counts: HeroCounts;
  budget: BudgetView | null;
  view: "plan" | "board";
  onView: (v: "plan" | "board") => void;
  next: HeroNext;
  /** "Sıradaki Porto konaklaması". */
  nextShort: string;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = hero.current;
    if (!active || !el || typeof IntersectionObserver === "undefined") return setShow(false);
    // Out of view above (scrolled past, its last strip under the bar's own height counts as gone), not merely not yet drawn.
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.bottom < 64), { threshold: 0, rootMargin: "-64px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hero, active]);
  if (!active) return null;
  const words = shareWords(counts);
  const booked = counts.booked.pct ?? 0;
  const planned = Math.max(0, (counts.plan.pct ?? 0) - booked);
  const money = (n: number) => (budget ? formatPrice(n, budget.currency) : "");
  const fits = budget && budget.total != null ? !budget.over : null;
  const tab = show ? 0 : -1;
  return (
    <div className="h-mini-slot">
      <div className={`h-mini${show ? " on" : ""}`} aria-hidden={!show} role="region" aria-label={L("Gezi özeti", "Trip summary")}>
        <span className="h-thumb sm">{cover ? <img src={cover} alt="" loading="lazy" /> : <XIcon name="image" size={16} stroke={1.6} />}</span>
        <b className="h-mt" title={title}>
          {title}
        </b>
        {line && <small className="h-ml">{line}</small>}
        <span className="h-sp" />
        {counts.total > 0 && (
          <>
            <span className="h-bar" aria-hidden>
              {booked > 0 && <i className="bk" style={{ width: `${booked}%` }} />}
              {planned > 0 && <i className="ch" style={{ width: `${planned}%` }} />}
            </span>
            <small className="h-mp">
              <b>{words.plan}</b> · {L(`${counts.open} karar`, `${counts.open} to decide`)}
            </small>
          </>
        )}
        {budget && (
          <span className="h-mb" title={fits == null ? undefined : fits ? L("Bütçeye sığar", "Fits the budget") : L("Bütçeyi aşar", "Over the budget")}>
            {fits != null && <i className={fits ? "ok" : "over"} aria-hidden />}
            {budget.sign}
            {money(budget.likely)}
            {budget.total != null && <small> / {money(budget.total)}</small>}
            {fits != null && <span className="sr-only">{fits ? L("bütçeye sığar", "fits the budget") : L("bütçeyi aşar", "over the budget")}</span>}
          </span>
        )}
        <span className="h-tabs" role="group" aria-label={L("Görünüm", "View")}>
          <button type="button" tabIndex={tab} className={view === "plan" ? "on" : ""} aria-pressed={view === "plan"} onClick={() => onView("plan")}>
            {L("Plan", "Plan")}
          </button>
          <button type="button" tabIndex={tab} className={view === "board" ? "on" : ""} aria-pressed={view === "board"} onClick={() => onView("board")}>
            {L("Pano", "Board")}
          </button>
        </span>
        {next.run ? (
          <button type="button" className="h-next sm" tabIndex={tab} title={next.title} onClick={next.run}>
            <span className="x-nl">{nextShort}</span>
            <XIcon name="arrow" size={14} stroke={2.2} />
          </button>
        ) : (
          <span className="h-ok">
            <XIcon name="check" size={14} stroke={2.4} />
            {next.label}
          </span>
        )}
      </div>
    </div>
  );
}
