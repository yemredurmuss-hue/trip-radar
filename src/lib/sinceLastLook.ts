// Since the last look (omurga B3, 2026-10-31): opening a trip says in one line what happened while the traveller was
// away, so nothing the chat, a fellow traveller or a saved page did goes by unseen. Only what matters counts: cards
// added and decisions made (chosen, booked); a price or a photo refreshed in the background does not. The last look is
// kept on this device only. Pure, except the two storage helpers.
import { L } from "./i18n";
import type { Item } from "./types";

export interface SinceLook {
  added: number;
  decided: number;
}

export function sinceLastLook(items: Item[], seenAt: number | null): SinceLook | null {
  if (seenAt == null) return null;
  const added = items.filter((i) => i.createdAt > seenAt && i.status !== "dismissed").length;
  const decided = items.filter((i) => i.createdAt <= seenAt && (i.statusAt ?? 0) > seenAt && (i.status === "chosen" || i.status === "booked")).length;
  return added || decided ? { added, decided } : null;
}

export function sinceLine({ added, decided }: SinceLook): string {
  const tr = [added ? `${added} kart eklendi` : "", decided ? `${decided} karar verildi` : ""].filter(Boolean).join(", ");
  const en = [added ? `${added} card${added === 1 ? "" : "s"} added` : "", decided ? `${decided} decision${decided === 1 ? "" : "s"} made` : ""].filter(Boolean).join(", ");
  return L(`Son baktığından beri: ${tr}.`, `Since you last looked: ${en}.`);
}

const key = (tripId: string) => `tripSeen:${tripId}`;

export function readSeen(tripId: string): number | null {
  try {
    const raw = localStorage.getItem(key(tripId));
    return raw ? Number(raw) || null : null;
  } catch {
    return null;
  }
}

export function markSeen(tripId: string, at = Date.now()): void {
  try {
    localStorage.setItem(key(tripId), String(at));
  } catch {
    // storage unavailable: the line just won't show next time
  }
}
