import { useCallback, useEffect, useState } from "react";
import { listItems, listMessages, listOpenCaptures, listTrips, onChanged } from "../lib/db";
import type { Capture, ChatMessage, Item, Trip } from "../lib/types";

export interface BoardData {
  trips: Trip[];
  trip: Trip | null;
  items: Item[];
  messages: ChatMessage[];
  openCaptures: Capture[];
  loaded: boolean;
}

const STORAGE_KEY = "trip-radar:selected-trip";

function readSelected(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useBoard() {
  const [selectedId, setSelectedId] = useState<string | null>(readSelected);
  const [data, setData] = useState<BoardData>({
    trips: [],
    trip: null,
    items: [],
    messages: [],
    openCaptures: [],
    loaded: false,
  });

  const load = useCallback(async () => {
    const trips = await listTrips();
    const trip = trips.find((t) => t.id === selectedId) ?? trips[0] ?? null;
    const [items, messages, openCaptures] = await Promise.all([
      trip ? listItems(trip.id) : Promise.resolve([]),
      trip ? listMessages(trip.id) : Promise.resolve([]),
      listOpenCaptures(),
    ]);
    setData({ trips, trip, items, messages, openCaptures, loaded: true });
  }, [selectedId]);

  useEffect(() => {
    void load();
    return onChanged(() => void load());
  }, [load]);

  const selectTrip = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // storage unavailable: selection just won't persist
    }
    setSelectedId(id);
  }, []);

  return { ...data, selectTrip, reload: load };
}
