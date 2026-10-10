// A small box beside its trigger on hover, keyboard focus or (on a touch screen) a tap (docs/mockups/ux-katmanli-arayuz).
// It only ever adds: the fact it explains is already on screen, and nothing urgent lives only in a tip. The box is drawn
// on the page (a portal, fixed) so a card's or a strip's own clipping never cuts it, and it never moves anything.
//   HoverTip wraps its text in a small span that carries the tip (and opens on a tap on a touch screen).
//   TipOn puts the tip on an element that already is the thing (a button, a card): no wrapper, so a grid or a
//   `nth-of-type` rule around it keeps working; there a tap does what the element does, and the tip comes on hover and focus.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const WIDTH = 260;

type At = { left?: number; right?: number; top?: number; bottom?: number };

function useTip({ align, below, anchor }: { align: "left" | "right"; below: boolean; anchor?: "edge" | "card" }) {
  const id = useId();
  const [at, setAt] = useState<At | null>(null);
  const [tapped, setTapped] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const open = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    // "card": the box lines up with the trigger's edge, wide enough for a card's facts and kept on screen.
    const edge = align === "right" ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)) };
    // Over the trigger unless there is no room above it (or `below`): then under it.
    const roomAbove = r.top > 120;
    const under = below || (anchor === "card" && !roomAbove);
    setAt({ ...edge, ...(under ? { top: r.bottom + 10 } : { bottom: window.innerHeight - r.top + 10 }) });
  };
  const close = () => {
    setAt(null);
    setTapped(false);
  };
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
  const box = (tip: ReactNode, extra = "") =>
    at &&
    createPortal(
      <span role="tooltip" id={id} className={`tipx-box${align === "right" ? " right" : ""}${below ? " below" : ""}${extra}`} style={{ ...at, maxWidth: `min(${WIDTH}px, calc(100vw - 16px))` }}>
        {tip}
      </span>,
      document.body,
    );
  return { id, at, tapped, setTapped, trigger, open, close, touch, box };
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
  onFocus: () => void;
  onBlur: () => void;
  "aria-describedby"?: string;
}

export function TipOn({ tip, children, align = "left", below = false, anchor = "edge", boxClass = "" }: {
  /** Null: no tip (the element is drawn as it is). */
  tip: ReactNode | null;
  children: (bind: TipBind) => ReactNode;
  align?: "left" | "right";
  below?: boolean;
  /** "card": for a whole card as the trigger; the box goes under it when there is no room above. */
  anchor?: "edge" | "card";
  boxClass?: string;
}) {
  const t = useTip({ align, below, anchor });
  const bind: TipBind = {
    ref: (el) => {
      t.trigger.current = el;
    },
    onMouseEnter: () => tip && !t.touch() && t.open(),
    onMouseLeave: () => t.close(),
    onFocus: () => tip && t.open(),
    onBlur: () => t.close(),
    "aria-describedby": t.at ? t.id : undefined,
  };
  return (
    <>
      {children(bind)}
      {tip ? t.box(tip, boxClass ? ` ${boxClass}` : "") : null}
    </>
  );
}
