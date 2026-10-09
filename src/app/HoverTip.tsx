// A small box over its trigger on hover, keyboard focus or (on a touch screen) a tap (docs/mockups/ux-katmanli-arayuz).
// It only ever adds: the fact it explains is already on screen, and nothing urgent lives only in a tip.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

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
  const [on, setOn] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!on) return;
    const close = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) setOn(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [on]);
  const touch = () => matchMedia("(hover: none)").matches;
  return (
    <span
      ref={wrap}
      className={`tipx${align === "right" ? " right" : ""}${below ? " below" : ""}${on ? " on" : ""}${className ? ` ${className}` : ""}`}
      tabIndex={0}
      aria-describedby={id}
      onClick={(e) => {
        if (!touch()) return;
        e.stopPropagation();
        setOn(!on);
      }}
      onKeyDown={(e) => e.key === "Escape" && setOn(false)}
    >
      {children}
      <span role="tooltip" id={id} className="tipx-box">
        {tip}
      </span>
    </span>
  );
}
