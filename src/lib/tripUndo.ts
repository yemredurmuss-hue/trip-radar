// A trip setting the chat changed ("bütçeyi euro göster", "Sabine de geliyor") gets the board's one "Geri al",
// as a plan it took off does (removal.ts): the chat runs in the board's page, the board listens here and puts it
// in its undo slot. What it puts back is exactly the fields' values from before (tripSettings.restoreFields).
import type { TripFieldsBefore } from "./tripSettings";

export interface TripChange extends TripFieldsBefore {
  tripId: string;
  /** The toast's words: "Para birimi: EUR", "Gidenler: Emre & Sabine". */
  label: string;
}

const listeners = new Set<(change: TripChange) => void>();

export function onTripChange(listener: (change: TripChange) => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const announceTripChange = (change: TripChange) => listeners.forEach((l) => l(change));
