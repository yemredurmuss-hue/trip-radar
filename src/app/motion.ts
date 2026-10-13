// The small motion dictionary (docs/mockups/ux-katmanli-arayuz, "Altı hareketlik sözlük"): each movement has one meaning and none
// moves the layout (opacity, box-shadow, transform and a number's own text only). All are off for "azaltılmış hareket".
//   mühür (a card turns booked) · parlama (an answer changed a card) · düşüş (the chat added a card) · nabız (an empty card waits,
//   CSS only) · yükselme (a card lifts on hover, CSS only) · sayaç (a budget number counts to its new value).
import { useEffect, useRef, useState } from "react";

export const MOTION_MS = 600;
/** Parlama (an answer changed a card): 1.1 s, the ring grows to 10 px (app.css `pk-glow`). */
export const GLOW_MS = 1100;

/** Aşama geçişi (K29): the card's ring and the ticket's take-off play for 1.6 s (app.css `pk-stage`). */
export const STAGE_MS = 1600;

/** "Hareketi duraklat": the person's own switch (Settings), kept in this browser; body.still stops the CSS, reducedMotion() the rest. */
export const STILL_KEY = "trip-radar:still";

export const stillChosen = (): boolean => {
  try {
    return localStorage.getItem(STILL_KEY) === "1";
  } catch {
    return false;
  }
};

/** Puts the saved choice on the page (call once at start, and after a change). */
export const applyStill = (on = stillChosen()): void => {
  if (typeof document !== "undefined") document.body?.classList.toggle("still", on);
};

export const setStill = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(STILL_KEY, "1");
    else localStorage.removeItem(STILL_KEY);
  } catch {
    /* the switch still works for this page */
  }
  applyStill(on);
};

export const reducedMotion = (): boolean => {
  if (stillChosen()) return true;
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

/** True for `ms` after `value` changed to something new; never at mount (a board that opens doesn't glow), never with reduced motion. */
export function useJustChanged(value: unknown, ms = GLOW_MS): boolean {
  const first = useRef(true);
  const previous = useRef(value);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      previous.current = value;
      return;
    }
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    if (reducedMotion()) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return on;
}

/** True for `ms` after `flag` turned from false to true (a card that became booked), never at mount. */
export function useJustBecame(flag: boolean, ms = MOTION_MS): boolean {
  const first = useRef(true);
  const was = useRef(flag);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const before = was.current;
    was.current = flag;
    if (first.current) {
      first.current = false;
      return;
    }
    if (!flag || before || reducedMotion()) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), ms);
    return () => clearTimeout(t);
  }, [flag, ms]);
  return on;
}

/** True for `ms` after a plan's stage turned to chosen or booked (K29), never at mount, never with reduced motion. */
export function useStageChange(status: string, ms = STAGE_MS): boolean {
  const changed = useJustChanged(status, ms);
  return changed && (status === "chosen" || status === "booked");
}

/** Ease-out: where a number is `t` (0 to 1) of the way from `from` to `to`. */
export const countAt = (from: number, to: number, t: number): number => {
  const k = Math.min(1, Math.max(0, t));
  return from + (to - from) * (1 - (1 - k) ** 3);
};

const dropped = new Set<string>();
/** A card the chat just added drops in once, the first time it is drawn within a few seconds of being made. */
export function dropsIn(id: string, createdAt: number, fromChat: boolean, now = Date.now(), reduced = reducedMotion()): boolean {
  if (!fromChat || dropped.has(id) || now - createdAt > 4000 || reduced) return false;
  dropped.add(id);
  return true;
}

const flown = new Set<string>();
/** A ticket's plane glides to its card (rt-fly) the first time that card is drawn in this session, once. */
export function flysIn(id: string | undefined, reduced = reducedMotion()): boolean {
  if (!id || flown.has(id) || reduced) return false;
  flown.add(id);
  return true;
}

/** A number that counts to its new value over 0.6 s when it changes (not when it first appears, not with reduced motion). */
export function useCountUp(target: number, ms = MOTION_MS): { value: number; counting: boolean } {
  const [value, setValue] = useState(target);
  const shown = useRef(target);
  const first = useRef(true);
  const [counting, setCounting] = useState(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reducedMotion() || shown.current === target) {
      shown.current = target;
      setValue(target);
      return;
    }
    const from = shown.current;
    const start = performance.now();
    let frame = 0;
    setCounting(true);
    const step = (now: number) => {
      const t = (now - start) / ms;
      const next = t >= 1 ? target : countAt(from, target, t);
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
      else setCounting(false);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      setCounting(false);
    };
  }, [target, ms]);
  return { value, counting };
}

/** Hareket Dili, "hızlı biten iş titremez": a wait shorter than this shows no skeleton and no turning mark at all. */
export const LATE_MS = 400;

/** True only once `on` has held for `ms` without a break (a wait that ends sooner never shows its skeleton or spinner). A timing rule, not
 *  a movement: it applies with reduced motion too. */
export function useLate(on: boolean, ms = LATE_MS): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) {
      setLate(false);
      return;
    }
    const t = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return on && late;
}

/** A section's body folds open and shut over this long (app.css `.cat-fold`, --t-base). */
export const FOLD_MS = 260;

/**
 * A section's body kept mounted while it folds shut, and drawn folded for one frame when it opens, so the grid's rows (0fr and 1fr) can move.
 * `mounted`: draw the body; `expanded`: rows at 1fr; `settled`: unfolded and at rest (the clip comes off, a card's flip may leave the box).
 * A body that is open when the Plan appears is just there; with reduced motion nothing waits.
 */
export function useFold(open: boolean): { mounted: boolean; expanded: boolean; settled: boolean } {
  const [s, setS] = useState({ mounted: open, expanded: open, settled: open });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reducedMotion()) {
      setS({ mounted: open, expanded: open, settled: open });
      return;
    }
    if (open) {
      setS({ mounted: true, expanded: false, settled: false });
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setS({ mounted: true, expanded: true, settled: false }));
      });
      const done = setTimeout(() => setS({ mounted: true, expanded: true, settled: true }), FOLD_MS + 40);
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
        clearTimeout(done);
      };
    }
    setS({ mounted: true, expanded: false, settled: false });
    const gone = setTimeout(() => setS({ mounted: false, expanded: false, settled: false }), FOLD_MS + 20);
    return () => clearTimeout(gone);
  }, [open]);
  return { mounted: open || s.mounted, expanded: open && s.expanded, settled: open && s.settled };
}
