// A small box beside its trigger on hover, keyboard focus or (on a touch screen) a tap (docs/mockups/ux-katmanli-arayuz).
// It only ever adds: the fact it explains is already on screen, and nothing urgent lives only in a tip. The box is drawn
// on the page (a portal, fixed) so a card's or a strip's own clipping never cuts it, and it never moves anything.
//   HoverTip wraps its text in a small span that carries the tip (and opens on a tap on a touch screen).
//   TipOn puts the tip on an element that already is the thing (a button, a card): no wrapper, so a grid or a
//   `nth-of-type` rule around it keeps working; there a tap does what the element does, and the tip comes on hover and focus.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const WIDTH = 260;

type At = { left?: number; right?: number; top?: number; bottom?: number; under: boolean };

/** About how tall a box gets (a headline and a handful of lines; the photo of a city tip is more): where there is less room than this on its side it goes to the other. */
const ROOM = 190;

function useTip({ align, below }: { align: "left" | "right"; below: boolean }) {
  const id = useId();
  const [at, setAt] = useState<At | null>(null);
  const [tapped, setTapped] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const open = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const edge = align === "right" ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)) };
    // Over the trigger (under it for `below`), unless that side has no room and the other has.
    const roomAbove = r.top;
    const roomBelow = window.innerHeight - r.bottom;
    const under = below ? !(roomBelow < ROOM && roomAbove > roomBelow) : roomAbove < ROOM && roomBelow > roomAbove;
    setAt({ ...edge, under, ...(under ? { top: r.bottom + 10 } : { bottom: window.innerHeight - r.top + 10 }) });
  };
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const close = () => {
    clearTimeout(timer.current);
    setAt(null);
    setTapped(false);
  };
  /** Opens after `ms` of staying (a card is a big thing to cross: no flash on the way past). */
  const openSoon = (ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(open, ms);
  };
  /** Closes a moment later, so the pointer can cross to a box it may click in. */
  const closeSoon = (ms = 140) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(close, ms);
  };
  const keep = () => clearTimeout(timer.current);
  // Open, the box goes with a scroll, a click elsewhere or Escape.
  useEffect(() => {
    if (!at) return;
    const away = (e: Event) => {
      if (e.type === "click" && trigger.current?.contains(e.target as Node)) return;
      close();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", away, true);
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("scroll", away, true);
      document.removeEventListener("click", away);
      document.removeEventListener("keydown", esc);
    };
  }, [at]);
  const touch = () => matchMedia("(hover: none)").matches;
  const box = (tip: ReactNode, extra = "", interactive = false) =>
    at &&
    createPortal(
      <span role="tooltip" id={id} onMouseEnter={interactive ? keep : undefined} onMouseLeave={interactive ? () => closeSoon() : undefined} className={`tipx-box${align === "right" ? " right" : ""}${at.under ? " below" : ""}${extra}`} style={{ left: at.left, right: at.right, top: at.top, bottom: at.bottom, maxWidth: `min(${WIDTH}px, calc(100vw - 16px))` }}>
        {tip}
      </span>,
      document.body,
    );
  return { id, at, tapped, setTapped, trigger, open, close, openSoon, closeSoon, touch, box };
}

export function HoverTip({ tip, children, align = "left", below = false, className = "" }: {
  tip: ReactNode;
  children: ReactNode;
  /** The box's edge that lines up with the trigger: the right one for triggers near the right edge. */
  align?: "left" | "right";
  /** Under the trigger instead of over it. */
  below?: boolean;
  className?: string;
}) {
  const t = useTip({ align, below });
  return (
    <>
      <span
        ref={t.trigger}
        className={`tipx${className ? ` ${className}` : ""}`}
        tabIndex={0}
        aria-describedby={t.at ? t.id : undefined}
        onMouseEnter={() => !t.touch() && t.open()}
        onMouseLeave={() => !t.tapped && t.close()}
        onFocus={t.open}
        onBlur={t.close}
        onClick={(e) => {
          if (!t.touch()) return;
          // A tap opens it (the tap doesn't also reach what's under: a section's header toggles on a click).
          e.stopPropagation();
          if (t.at) t.close();
          else {
            t.setTapped(true);
            t.open();
          }
        }}
      >
        {children}
      </span>
      {t.box(tip)}
    </>
  );
}

/** What TipOn hands to the element that carries the tip. */
export interface TipBind {
  ref: (el: HTMLElement | null) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: (e: React.FocusEvent) => void;
  onBlur: () => void;
  "aria-describedby"?: string;
}

export function TipOn({ tip, children, align = "left", below = false, boxClass = "", delay = 0, interactive = false }: {
  /** Null: no tip (the element is drawn as it is). */
  tip: ReactNode | null;
  children: (bind: TipBind) => ReactNode;
  align?: "left" | "right";
  below?: boolean;
  boxClass?: string;
  /** Wait this long (ms) over the element before the box opens. */
  delay?: number;
  /** The box can be pointed at and clicked in (a copy button): it stays while the pointer is on it. */
  interactive?: boolean;
}) {
  const t = useTip({ align, below });
  const bind: TipBind = {
    ref: (el) => {
      t.trigger.current = el;
    },
    onMouseEnter: () => tip && !t.touch() && (delay ? t.openSoon(delay) : t.open()),
    onMouseLeave: () => (interactive ? t.closeSoon() : t.close()),
    // (with a delay, the element is a big one: only a key's focus opens it, not the focus a click leaves)
    onFocus: (e) => tip && (!delay || (e.target as Element).matches?.(":focus-visible")) && t.open(),
    onBlur: () => t.close(),
    "aria-describedby": t.at ? t.id : undefined,
  };
  return (
    <>
      {children(bind)}
      {tip ? t.box(tip, boxClass ? ` ${boxClass}` : "", interactive) : null}
    </>
  );
}
