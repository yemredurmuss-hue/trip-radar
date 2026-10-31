// Since the last look (lib/sinceLastLook.ts): worked out once when a trip opens (its cards loaded), then the look is
// marked; leaving the tab or the trip marks it again, so what the traveller did themselves isn't news next time.
import { useEffect, useRef, useState } from "react";
import { markSeen, readSeen, sinceLastLook, type SinceLook } from "../../lib/sinceLastLook";
import type { Item } from "../../lib/types";

export function useSinceLastLook(tripId: string, items: Item[]): SinceLook | null {
  const [since, setSince] = useState<SinceLook | null>(null);
  const read = useRef<string | null>(null);
  const loaded = items.length > 0;
  useEffect(() => {
    if (!loaded || read.current === tripId) return;
    read.current = tripId;
    setSince(sinceLastLook(items, readSeen(tripId)));
    markSeen(tripId);
    // Read once per trip opened: later changes are the traveller's own, seen as they happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, loaded]);
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === "hidden") markSeen(tripId);
    };
    document.addEventListener("visibilitychange", away);
    return () => {
      document.removeEventListener("visibilitychange", away);
      markSeen(tripId);
    };
  }, [tripId]);
  return read.current === tripId ? since : null;
}
