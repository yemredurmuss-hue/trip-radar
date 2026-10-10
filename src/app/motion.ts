// The small motion dictionary (docs/mockups/ux-katmanli-arayuz, "Altı hareketlik sözlük"): each movement has one meaning and none
// moves the layout (opacity, box-shadow, transform and a number's own text only). All are off for "azaltılmış hareket".
//   mühür (a card turns booked) · parlama (an answer changed a card) · düşüş (the chat added a card) · nabız (an empty card waits,
//   CSS only) · yükselme (a card lifts on hover, CSS only) · sayaç (a budget number counts to its new value).
import { useEffect, useRef, useState } from "react";

export const MOTION_MS = 600;

export const reducedMotion = (): boolean => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
};

/** True for `ms` after `value` changed to something new; never at mount (a board that opens doesn't glow), never with reduced motion. */
export function useJustChanged(value: unknown, ms = MOTION_MS): boolean {
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
