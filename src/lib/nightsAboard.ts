// D14 (H6): a night spent on a plane (a flight leaving one evening and landing the next day) is no empty night to find a
// bed for: the Plan doesn't open a stay for it, Yolculuk sırasıyla says "uçakta" there (aşama 5). Only a flight chosen or
// booked counts, its own day and hours (an option's hours aren't the trip's). Pure.
import { addDays } from "./plan";
import type { Item } from "./types";

/** The nights (each by its evening's date, "2027-03-31") spent in the air, by the flights chosen or booked. */
export function nightsAboard(items: readonly Item[]): Set<string> {
  const out = new Set<string>();
  for (const i of items) {
    if (i.category !== "flight" || (i.status !== "chosen" && i.status !== "booked")) continue;
    const leaves = i.flight?.departure?.slice(0, 10) ?? null;
    const lands = i.flight?.arrival?.slice(0, 10) ?? null;
    if (!leaves || !lands || lands <= leaves) continue;
    for (let night = leaves; night < lands; night = addDays(night, 1)) out.add(night);
  }
  return out;
}

/** Every night of a range spent in the air. */
export function allAboard(range: { start: string; end: string }, aboard: ReadonlySet<string>): boolean {
  if (range.end <= range.start) return false;
  for (let night = range.start; night < range.end; night = addDays(night, 1)) if (!aboard.has(night)) return false;
  return true;
}
