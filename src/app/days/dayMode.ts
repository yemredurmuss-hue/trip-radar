// Gün gün's view (Kompakt · Liste · Kartlar) is the traveller's own, per device: kept in localStorage (never in the
// trip's records), read once and shared by the switch atop the Plan and the days below it.
import { useSyncExternalStore } from "react";
import { parseDayMode, type DayMode } from "../../lib/dayView";

const KEY = "trip-radar:days-view";
const subs = new Set<() => void>();
let mode: DayMode | null = null;

function read(): DayMode {
  try {
    return parseDayMode(localStorage.getItem(KEY));
  } catch {
    // no storage (a private window): it starts on the compact row each time
    return "compact";
  }
}

export const getDayMode = (): DayMode => (mode ??= read());

export function setDayMode(next: DayMode): void {
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // a per-viewer convenience: without storage it lasts until the page closes
  }
  subs.forEach((f) => f());
}

export const useDayMode = (): DayMode =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    getDayMode,
    getDayMode,
  );
