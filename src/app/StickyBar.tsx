// The hero scrolled out of sight: one bar at the very top of the panel keeps where you are and what's next (plan v30):
// the trip's cover, name and dates, how much of the plan is booked (the hero's own number, never a second one), what
// it will likely cost against the budget, the Plan | Pano switch and the hero's main button. Opaque, edge to edge:
// nothing shows through it. The hero itself is not touched.
import { useEffect, useState, type RefObject } from "react";
import { L } from "../lib/i18n";
import type { HeroAction } from "./TripHero";

export interface StickyBudget {
  /** What it will likely cost (booked + chosen + each open decision's leading option), in `currency`. */
  expected: number;
  /** The trip's budget; null when it has none. */
  total: number | null;
  currency: string;
  /** "~€7.347": the expected sum as text, and the budget's. */
  expectedText: string;
  totalText: string | null;
}

export function StickyBar({ hero, active, title, dates, daysLeft, cover, pct, budget, view, onView, action }: {
  hero: RefObject<HTMLElement | null>;
  /** On the Plan's views (not the Pano or Belgeler: no hero there). */
  active: boolean;
  title: string;
  dates: string | null;
  /** "175 gün kaldı", while the trip is ahead. */
  daysLeft: string | null;
  /** The hero's photo, small. */
  cover: string | null;
  /** How much of what's planned is booked, 0 to 100 (the hero's own number). */
  pct: number | null;
  budget: StickyBudget | null;
  view: "plan" | "board";
  onView: (v: "plan" | "board") => void;
  action: HeroAction | null;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = hero.current;
    if (!active || !el || typeof IntersectionObserver === "undefined") return setShow(false);
    // Out of view above (scrolled past), not merely not yet drawn.
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.bottom < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [hero, active]);
  if (!active) return null;
  const fits = budget && budget.total != null ? budget.expected <= budget.total : null;
  return (
    <div className="sbar-slot">
      <div className={`sbar sbar2${show ? " show" : ""}`} aria-hidden={!show} role="region" aria-label={L("Gezi özeti", "Trip summary")}>
        <div className="sbar-in">
          {cover && <img className="sbar-cover" src={cover} alt="" loading="lazy" />}
          <span className="sbar-name">
            <b className="sbar-t" title={title}>{title}</b>
            <small>{[dates, daysLeft].filter(Boolean).join(" · ")}</small>
          </span>
          {pct != null && (
            <span className="sbar-p" title={L(`Planlananların %${pct}'i rezerve`, `${pct}% of what's planned is booked`)}>
              <span className="sbar-ring" style={{ ["--p" as string]: `${pct}%` }} aria-hidden>
                <span>%{pct}</span>
              </span>
              <span className="sbar-pl">{L("rezerve", "booked")}</span>
            </span>
          )}
          {budget && (
            <span className="sbar-bud" title={fits == null ? undefined : fits ? L("Bütçeye sığar", "Fits the budget") : L("Bütçeyi aşar", "Over the budget")}>
              {fits != null && <i className={fits ? "ok" : "over"} aria-hidden />}
              <b>~{budget.expectedText}</b>
              {budget.totalText && <small> / {budget.totalText}</small>}
              {fits != null && <span className="sr-only">{fits ? L("bütçeye sığar", "fits the budget") : L("bütçeyi aşar", "over the budget")}</span>}
            </span>
          )}
          <span className="sbar-sp" />
          <span className="sbar-tabs" role="group" aria-label={L("Görünüm", "View")}>
            <button type="button" tabIndex={show ? 0 : -1} className={view === "plan" ? "on" : ""} aria-pressed={view === "plan"} onClick={() => onView("plan")}>
              {L("Plan", "Plan")}
            </button>
            <button type="button" tabIndex={show ? 0 : -1} className={view === "board" ? "on" : ""} aria-pressed={view === "board"} onClick={() => onView("board")}>
              {L("Pano", "Board")}
            </button>
          </span>
          {action && (
            <button type="button" className="sbar-go" tabIndex={show ? 0 : -1} onClick={action.run} title={action.title}>
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
