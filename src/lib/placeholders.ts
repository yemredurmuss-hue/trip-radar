// What the start made, not what the traveller chose (startTrip.ts re-exports these): kept apart from the start's own
// code so the capture's processing (process.ts, in the background) can tell a made place from a choice without it.
import type { Item, Trip } from "./types";

/** What a made record says that the traveller would change: its status, days, where from and to, its city, its name. */
export const placeholderPrint = (i: Item): string =>
  [i.status, i.dates.start, i.dates.end, i.flight?.from, i.flight?.to, i.flight?.departure, i.city, i.name].map((v) => v ?? "").join("|");

/**
 * The flights and stays the start made are places to fill, not choices: until the traveller changes one (a choice,
 * a booking, the chat saying it again with a time or another day), it isn't "chosen" for the hero. Kept on the trip
 * by id with what the record said when made (a place's coordinates arriving later change nothing).
 */
export function isPlaceholder(trip: Pick<Trip, "startGuide">, item: Item): boolean {
  const print = trip.startGuide?.placeholders?.[item.id];
  return print != null && print === placeholderPrint(item) && item.status === "chosen" && item.origin === "chat";
}
