// The hero scrolled out of sight: a thin bar keeps the trip's name, its dates, how much of the plan is booked and the
// hero's main button at the top of the panel (docs/mockups/ux-katmanli-arayuz). The hero itself is not touched.
import { useEffect, useState, type RefObject } from "react";
import { L } from "../lib/i18n";
import type { HeroAction } from "./TripHero";

export function StickyBar({ hero, active, title, dates, pct, action }: {
  hero: RefObject<HTMLElement | null>;
  /** Only on the Plan: the Pano has no hero, and Gün gün has a sticky bar of its own. */
  active: boolean;
  title: string;
  dates: string | null;
  /** How much of what's planned is booked, 0 to 100 (the hero's own number). */
  pct: number | null;
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
  return (
    <div className="sbar-slot">
      <div className={`sbar${show ? " show" : ""}`} aria-hidden={!show}>
        <b className="sbar-t">{title}</b>
        {dates && <span className="sbar-d">{dates}</span>}
        {pct != null && (
          <span className="sbar-p" title={L(`Planlananların %${pct}'i rezerve`, `${pct}% of what's planned is booked`)}>
            <span className="sbar-track" aria-hidden>
              <i style={{ width: `${pct}%` }} />
            </span>
            {L(`%${pct} rezerve`, `${pct}% booked`)}
          </span>
        )}
        {action && (
          <button type="button" className="sbar-go" tabIndex={show ? 0 : -1} onClick={action.run} title={action.title}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
