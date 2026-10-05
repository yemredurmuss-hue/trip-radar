// Hazırlık (spec 0.34.6 §3): the chores before the trip — buy, apply, book, print, pack, change money,
// insurance/visa/eSIM tasks — a quiet tick list at the end of Diğer, apart from Yapılacak şeyler (what's
// seen, eaten, visited and done at the destination). Read from the record as it is, no migration: the chat's
// kind `prep`, else a thing to do whose name is a chore. Pure.
import { choreText, isPaperwork } from "./travelKinds";
import type { Item } from "./types";

export { choreText, isPaperwork } from "./travelKinds";

/** A chore before the trip: said as one in the chat (`prep`), or a thing to do whose name is one. */
export function isPrep(item: Item): boolean {
  if (item.plannedKind === "prep") return true;
  if (item.plannedKind === "note" || item.plannedKind === "insurance") return false;
  if (item.category !== "other" && item.category !== "activity") return false;
  return !isPaperwork(item) && choreText(item.name);
}
