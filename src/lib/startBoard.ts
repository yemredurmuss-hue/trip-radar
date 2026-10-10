// The board's view of a trip the start just made, worked out the same way the board does it (TripPanel): its
// cities in night order, the hero's main places, and the key the hero's style words are kept under. With these the
// start writes trip.style for exactly what the hero will ask for, so the words picked in the chat show at once and
// the model isn't asked again. Pure.
import { mainPlaces, placesKey, resolveParents, type MainPlace } from "./destinations";
import { buildPlan, cityKeyOf, type Plan } from "./plan";
import { styleKey } from "./tripStyle";
import type { Item, Preference, Trip } from "./types";

/** The trip's cities in the order the nights go, each once; else the saved stays' (TripPanel citiesOf). */
export function cityNamesOf(plan: Plan, items: Item[]): string[] {
  const seen = new Map<string, string>();
  const add = (city: string | null | undefined) => {
    const key = cityKeyOf(city);
    if (key && !seen.has(key)) seen.set(key, city!);
  };
  for (const b of plan.stayBlocks) add(b.city);
  if (!seen.size) for (const i of items) if (i.status !== "dismissed" && i.category === "stay") add(i.city);
  return [...seen.values()];
}

/** The hero's main places for the trip as stored (its parents answer, else the guess from the addresses). */
export function boardMains(trip: Trip, items: Item[]): { plan: Plan; cityNames: string[]; mains: MainPlace[] } {
  const plan = buildPlan(trip, items);
  const cityNames = cityNamesOf(plan, items);
  const known = trip.placeParents?.key === placesKey(cityNames) ? trip.placeParents.parents : null;
  const mains = mainPlaces(cityNames, resolveParents(cityNames, items, known));
  return { plan, cityNames, mains };
}

/** The notes the hero reads as "what the traveller wrote about the trip" (IntentCard: the two finding answers left out). */
export const understoodNotes = (prefs: Preference[]): string[] =>
  prefs.filter((p) => !/^".+" (benim için sorun değil|is fine with me|benim için önemli|matters to me)$/.test(p.text)).map((p) => p.text);

/** The key the hero keeps the style words under for this trip now (TripPanel styleFor). */
export function styleKeyFor(trip: Trip, items: Item[], prefs: Preference[]): string {
  return styleKey(boardMains(trip, items).mains.map((m) => m.name), understoodNotes(prefs));
}
