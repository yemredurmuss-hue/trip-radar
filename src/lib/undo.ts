// The one "Geri al" on screen: the last thing deleted, for 8 seconds. A newer deletion takes its place
// (the one before stays deleted). Framework-free so the timing can be tested.
export const UNDO_MS = 8000;

export interface UndoSlot<T> {
  show(value: T): void;
  /** The value, once: clears the slot. */
  take(): T | null;
  current(): T | null;
  subscribe(listener: (value: T | null) => void): () => void;
}

export function undoSlot<T>(ms = UNDO_MS): UndoSlot<T> {
  let value: T | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(value: T | null) => void>();
  const set = (next: T | null) => {
    value = next;
    listeners.forEach((l) => l(next));
  };
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    show(next) {
      stop();
      set(next);
      timer = setTimeout(() => {
        timer = null;
        set(null);
      }, ms);
    },
    take() {
      stop();
      const taken = value;
      if (taken !== null) set(null);
      return taken;
    },
    current: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
