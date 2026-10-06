import { useCallback, useEffect, useRef, useState } from "react";
import { listAllItems, listArrivals, listMessages, listOpenCaptures, listTrips, onChanged } from "../lib/db";
import type { Capture, ChatMessage, Item, Trip } from "../lib/types";
import { getLiveFlights, refreshFlights, withLive } from "../lib/flightData";
import { withEdits } from "../lib/userEdits";

export interface BoardData {
  trips: Trip[];
  trip: Trip | null;
  /** Items of the selected trip. */
  items: Item[];
  /** Items of every trip (for the trips overview). */
  allItems: Item[];
  messages: ChatMessage[];
  openCaptures: Capture[];
  /** Captures saved since this page opened, newest first. */
  arrivals: ChatMessage[];
  loaded: boolean;
}

const STORAGE_KEY = "trip-radar:selected-trip";
const openedAt = Date.now();

export function readSelectedTrip(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useBoard(initialTripId: string | null) {
  const [selectedId, setSelectedId] = useState<string | null>(initialTripId);
  const [data, setData] = useState<BoardData>({
    trips: [],
    trip: null,
    items: [],
    allItems: [],
    messages: [],
    openCaptures: [],
    arrivals: [],
    loaded: false,
  });

  const load = useCallback(async () => {
    const [trips, allItems, openCaptures, arrivals] = await Promise.all([
      listTrips(),
      // A saved page's corrections stand in for what it said, everywhere the board reads it (userEdits.ts); a
      // flight's real data beside it (flightData.ts, 0.36.15).
      Promise.all([listAllItems(), getLiveFlights().catch(() => ({}))]).then(([items, live]) => items.map((i) => withLive(withEdits(i), live))),
      listOpenCaptures(),
      listArrivals(openedAt),
    ]);
    const trip = trips.find((t) => t.id === selectedId) ?? null;
    const messages = trip ? await listMessages(trip.id) : [];
    const items = trip ? allItems.filter((i) => i.tripId === trip.id) : [];
    setData({ trips, trip, items, allItems, messages, openCaptures, arrivals, loaded: true });
    // The flights' real data, asked for when it may have changed; the board reads again when something new came.
    // Not the sample trip's (its flights are made up).
    const sample = new Set(trips.filter((t) => t.demo).map((t) => t.id));
    void refreshFlights(allItems.filter((i) => !sample.has(i.tripId))).then((changed) => changed && setTimeout(() => void loadRef.current(), 0)).catch(() => undefined);
  }, [selectedId]);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    void load();
    return onChanged(() => void load());
  }, [load]);

  const selectTrip = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable: selection just won't persist
    }
    setSelectedId(id);
  }, []);

  return { ...data, selectTrip, reload: load };
}
