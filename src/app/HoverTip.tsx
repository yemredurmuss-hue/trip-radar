// A small box beside its trigger on hover, keyboard focus or (on a touch screen) a tap (docs/mockups/ux-katmanli-arayuz).
// It only ever adds: the fact it explains is already on screen, and nothing urgent lives only in a tip. The box is drawn
// on the page (a portal, fixed) so a card's or a strip's own clipping never cuts it, and it never moves anything.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const WIDTH = 260;

export function HoverTip({ tip, children, align = "left", below = false, className = "" }: {
  tip: ReactNode;
  children: ReactNode;
  /** The box's edge that lines up with the trigger: the right one for triggers near the right edge. */
  align?: "left" | "right";
  /** Under the trigger instead of over it. */
  below?: boolean;
  className?: string;
}) {
  const id = useId();
  const [at, setAt] = useState<{ left?: number; right?: number; top?: number; bottom?: number } | null>(null);
  const [tapped, setTapped] = useState(false);
  const trigger = useRef<HTMLSpanElement>(null);
  const open = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const edge = align === "right" ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)) };
    setAt({ ...edge, ...(below ? { top: r.bottom + 10 } : { bottom: window.innerHeight - r.top + 10 }) });
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
  return (
    <>
      <span
        ref={trigger}
        className={`tipx${className ? ` ${className}` : ""}`}
        tabIndex={0}
        aria-describedby={at ? id : undefined}
        onMouseEnter={() => !touch() && open()}
        onMouseLeave={() => !tapped && close()}
        onFocus={open}
        onBlur={close}
        onClick={(e) => {
          if (!touch()) return;
          // A tap opens it (the tap doesn't also reach what's under: a section's header toggles on a click).
          e.stopPropagation();
          if (at) close();
          else {
            setTapped(true);
            open();
          }
        }}
      >
        {children}
      </span>
      {at &&
        createPortal(
          <span role="tooltip" id={id} className={`tipx-box${align === "right" ? " right" : ""}${below ? " below" : ""}`} style={{ ...at, maxWidth: `min(${WIDTH}px, calc(100vw - 16px))` }}>
            {tip}
          </span>,
          document.body,
        )}
    </>
  );
}
