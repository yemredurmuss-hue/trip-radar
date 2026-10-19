// Under 860 px the plan comes first and the chat is a drawer from the bottom (v83 "860 px altı", A7): shut, its handle
// ("Asistan" and the last thing said) and the box to write in; open, the conversation and the quick replies. The handle
// says whether it is open (aria-expanded), Escape shuts it and the focus goes back to the handle; opening takes the
// focus into the conversation. Its height changes over 260 ms (E: m-cekmece), never under reduced motion or "Hareketi
// duraklat". Wider than that, the chat is the board's column and there is nothing to open.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { reducedMotion } from "../motion";

/** Where the board stops being two columns (app.css .board; v82/chat.css). */
export const NARROW_BOARD = "(max-width: 860px)";
const DRAWER_MS = 260;
const DRAWER_EASE = "cubic-bezier(.2, .8, .2, 1)";

const narrowNow = () => typeof matchMedia === "function" && matchMedia(NARROW_BOARD).matches;

export function useChatDrawer() {
  const [narrow, setNarrow] = useState(narrowNow);
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // Measured before a change, played after it; where the focus goes once it's drawn.
  const before = useRef<number | null>(null);
  const focusTo = useRef<"body" | "handle" | null>(null);

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(NARROW_BOARD);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // A wide window again: the chat is a column, not a drawer.
  useEffect(() => {
    if (!narrow) setOpen(false);
  }, [narrow]);

  const set = useCallback((on: boolean, focus = true) => {
    before.current = sheet.current?.getBoundingClientRect().height ?? null;
    focusTo.current = focus ? (on ? "body" : "handle") : null;
    setOpen(on);
  }, []);

  useLayoutEffect(() => {
    const was = before.current;
    before.current = null;
    const el = sheet.current;
    const target = focusTo.current;
    focusTo.current = null;
    if (target === "body") body.current?.focus({ preventScroll: true });
    else if (target === "handle") handle.current?.focus({ preventScroll: true });
    if (was == null || !el || !narrow || reducedMotion() || typeof el.animate !== "function") return;
    const now = el.getBoundingClientRect().height;
    if (Math.abs(now - was) < 2) return;
    const run = el.animate([{ height: `${was}px` }, { height: `${now}px` }], { duration: DRAWER_MS, easing: DRAWER_EASE });
    return () => run.cancel();
  }, [open, narrow]);

  const shown = open && narrow;
  return {
    narrow,
    open: shown,
    sheet,
    handle,
    body,
    toggle: () => set(!shown),
    /** Opened for what was just sent (the reply comes in view), the focus left where it is. */
    reveal: () => narrow && !shown && set(true, false),
    /** Shut for the plan ("Planda göster"): the focus goes with the page, not back to the handle. */
    shut: () => shown && set(false, false),
    /** Escape inside the drawer shuts it, the focus back on the handle. */
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !shown || e.defaultPrevented) return;
      e.preventDefault();
      set(false);
    },
  };
}
