// "Son ziyaretten beri" (docs/mockups/ux-katmanli-arayuz): on a shared trip, a dot on the Pano tab while the other traveller did
// something since the Pano was last open here (what they saved, voted, changed: lib/share/activity.ts). The time it was last
// open is kept per trip in chrome.storage.local, next to the share's own state; the first time a trip is seen it only starts
// the clock, so a trip's whole past isn't "new". Opening the Pano clears it.
import { useEffect, useRef, useState } from "react";
import { othersSince, type Action } from "../lib/share/activity";
import { chromeKV } from "../lib/share/store";
import type { Item } from "../lib/types";
import { useShare } from "./Share";

export const seenKey = (tripId: string) => `panoSeen:${tripId}`;

export function usePanoDot(tripId: string, items: Item[], open: boolean): Action[] {
  const share = useShare();
  const shared = Boolean(share);
  const [seen, setSeen] = useState<number | null>(null);
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!shared || loaded.current === tripId) return;
    loaded.current = tripId;
    let alive = true;
    void (async () => {
      try {
        const at = await chromeKV.get<number>(seenKey(tripId));
        if (!alive) return;
        if (typeof at === "number") setSeen(at);
        else {
          const now = Date.now();
          setSeen(now);
          await chromeKV.set(seenKey(tripId), now);
        }
      } catch {
        // no storage (a test page): no dot
      }
    })();
    return () => {
      alive = false;
      loaded.current = null;
    };
  }, [tripId, shared]);
  const news = shared && share && seen != null ? othersSince(seen, { me: share.me, votes: share.votes, notices: share.notices, items }) : [];
  // Looking at the Pano: what is there now is seen.
  const newest = news[0]?.at ?? 0;
  useEffect(() => {
    if (!open || !shared || seen == null) return;
    const now = Math.max(Date.now(), newest);
    setSeen(now);
    void chromeKV.set(seenKey(tripId), now).catch(() => undefined);
  }, [open, shared, tripId, newest]);
  return open ? [] : news;
}
