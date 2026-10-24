// The hero's small windows (Kimler gidiyor, Bütçe, Seni böyle anladım, the trip's ⋯ menu): one open at a time per
// trigger; a click outside or Escape closes it and Escape gives the focus back to its button. E12: it comes in in 180 ms
// and leaves in 120 ms (still for a moment while it fades); at once under reduced motion or "Hareketi duraklat".
import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "../motion";

/** E12: how long a window takes to leave (ms); its entrance is CSS (hero.css, 180 ms). */
export const POP_OUT_MS = 120;

export interface Pop {
  open: boolean;
  /** Still drawn: open, or fading out. */
  shown: boolean;
  /** Fading out (the `x-out` class). */
  leaving: boolean;
  toggle: () => void;
  /** Opened (the mouse over it): never closes it. */
  show: () => void;
  close: (focusBack?: boolean) => void;
  /** Holds the trigger and the window: a click inside doesn't close it. */
  box: React.RefObject<HTMLDivElement | null>;
  trigger: React.RefObject<HTMLButtonElement | null>;
}

export function usePop(): Pop {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const close = (focusBack = false) => {
    if (!open) return;
    setOpen(false);
    if (focusBack) trigger.current?.focus();
    if (reducedMotion()) return;
    setLeaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLeaving(false), POP_OUT_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(true);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  });
  return {
    open,
    shown: open || leaving,
    leaving: leaving && !open,
    toggle: () => {
      if (open) close();
      else {
        clearTimeout(timer.current);
        setLeaving(false);
        setOpen(true);
      }
    },
    show: () => {
      if (open) return;
      clearTimeout(timer.current);
      setLeaving(false);
      setOpen(true);
    },
    close,
    box,
    trigger,
  };
}
