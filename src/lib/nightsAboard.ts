// D14 (H6): a night spent on a plane (a flight leaving one evening and landing the next day) is no empty night to find a
// bed for: the Plan doesn't open a stay for it, Yolculuk sırasıyla says "uçakta" there (aşama 5). Only a flight chosen or
// booked counts, its own day and hours (an option's hours aren't the trip's). Pure.
import { cityOfAirport } from "./airports";
import { addDays, arrivalDay, departureDay, placeKeyOf } from "./plan";
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

const placeOf = (text: string | null | undefined) => (text ? placeKeyOf(cityOfAirport(text)) : null);

/**
 * Nights after the trip's way out (Emre's Sri Lanka trip: Ahangama, then "Sri Lanka → Bali"): the range starts on or after
 * the day the last flight chosen or booked lands, the trip stayed somewhere before it (so it isn't the way in), and nothing
 * says the trip goes on where it lands: no stay saved there, no journey leaving from there afterwards. Such nights are no
 * stay to find in that city; with a stay there or a way on from it ("Lizbon → Porto" and a stay in Porto), they are.
 */
export function afterExit(range: { start: string; end: string }, items: readonly Item[]): boolean {
  const when = (i: Item) => i.flight?.arrival ?? i.flight?.departure ?? i.dates.start ?? "";
  const last = items
    .filter((i) => i.category === "flight" && (i.status === "chosen" || i.status === "booked") && arrivalDay(i))
    .sort((a, b) => when(b).localeCompare(when(a)))[0];
  const lands = last ? arrivalDay(last) : null;
  const there = last ? placeOf(last.flight?.to ?? last.city) : null;
  if (!lands || !there || range.start < lands) return false;
  const live = items.filter((i) => i.status !== "dismissed");
  const stays = live.filter((i) => i.category === "stay");
  if (!stays.some((s) => s.dates.start && s.dates.start < lands)) return false;
  if (stays.some((s) => placeOf(s.city) === there)) return false;
  return !live.some((i) => i.id !== last!.id && placeOf(i.flight?.from) === there && (departureDay(i) ?? "") >= lands);
}
