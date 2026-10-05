// Çöp kutusu (paylaşım güvenliği, 0.37): nothing the traveller deletes is gone at once. A card goes with its
// files, a trip with everything that was only its own (cards, files, the pages saved for them, the chat and its
// history lines, analyses, its own notes), into one record that waits here for 30 days and comes back in one
// tap with the same ids. Local only: the trash never leaves this computer.
import { addEvent, db, newId, notifyChanged } from "./db";
import { L } from "./i18n";
import type { Capture, TrashEntry, TrashedTrip } from "./types";

export const TRASH_DAYS = 30;
const DAY_MS = 24 * 3600e3;
const KEEP_MS = TRASH_DAYS * DAY_MS;

/** Stores a trip's records live in, written in one transaction when a trip goes or comes back. */
const TRIP_STORES = ["trips", "items", "docs", "captures", "messages", "analyses", "preferences", "trash"] as const;

const uniqueById = <T extends { id: string }>(rows: T[]): T[] => [...new Map(rows.map((r) => [r.id, r])).values()];

/**
 * Moves a whole trip to the trash (one transaction): the trip, its cards, their files, the pages saved for
 * them (not one another trip's card still uses), the chat and history lines, analyses and the trip's own
 * notes. Null when the trip isn't there.
 */
export async function trashTrip(tripId: string, now = Date.now()): Promise<TrashEntry | null> {
  const d = await db();
  const tx = d.transaction(TRIP_STORES, "readwrite");
  const trip = await tx.objectStore("trips").get(tripId);
  if (!trip) {
    await tx.done;
    return null;
  }
  const allItems = await tx.objectStore("items").getAll();
  const items = allItems.filter((i) => i.tripId === tripId);
  const elsewhere = new Set(allItems.filter((i) => i.tripId !== tripId).flatMap((i) => i.captureIds ?? []));
  const docs = uniqueById([
    ...(await tx.objectStore("docs").index("tripId").getAll(tripId)),
    ...(await Promise.all(items.map((i) => tx.objectStore("docs").index("itemId").getAll(i.id)))).flat(),
  ]);
  const captureIds = [...new Set(items.flatMap((i) => i.captureIds ?? []))].filter((id) => !elsewhere.has(id));
  const captures = (await Promise.all(captureIds.map((id) => tx.objectStore("captures").get(id)))).filter((c): c is Capture => Boolean(c));
  const messages = await tx.objectStore("messages").index("tripId").getAll(tripId);
  const analyses = await tx.objectStore("analyses").index("tripId").getAll(tripId);
  const preferences = (await tx.objectStore("preferences").getAll()).filter((p) => p.tripId === tripId);
  const payload: TrashedTrip = { trip, items, docs, captures, messages, analyses, preferences };
  const entry: TrashEntry = { id: newId(), tripId, kind: "trip", deletedAt: now, label: trip.title, payload };
  await tx.objectStore("trash").put(entry);
  for (const r of docs) await tx.objectStore("docs").delete(r.id);
  for (const r of items) await tx.objectStore("items").delete(r.id);
  for (const r of captures) await tx.objectStore("captures").delete(r.id);
  for (const r of messages) await tx.objectStore("messages").delete(r.id);
  for (const r of analyses) await tx.objectStore("analyses").delete(r.key);
  for (const r of preferences) await tx.objectStore("preferences").delete(r.id);
  await tx.objectStore("trips").delete(tripId);
  await tx.done;
  notifyChanged();
  return entry;
}

// A restore in progress: the purge waits (an entry about to come back is never removed under it).
let restoring = 0;

/** Entries older than 30 days go for good. Never while a restore runs. Returns how many went. */
export async function purgeTrash(now = Date.now()): Promise<number> {
  if (restoring > 0) return 0;
  const tx = (await db()).transaction("trash", "readwrite");
  let gone = 0;
  let cursor = await tx.store.index("deletedAt").openCursor(IDBKeyRange.upperBound(now - KEEP_MS, true));
  while (cursor) {
    if (restoring > 0) break;
    await cursor.delete();
    gone++;
    cursor = await cursor.continue();
  }
  await tx.done;
  return gone;
}

/** What is in the trash, newest first (old entries are purged first): one trip's cards, or the deleted trips. */
export async function listTrash(filter: { tripId?: string; kind?: TrashEntry["kind"] } = {}, now = Date.now()): Promise<TrashEntry[]> {
  await purgeTrash(now);
  const d = await db();
  const rows = filter.tripId ? await d.getAllFromIndex("trash", "tripId", filter.tripId) : await d.getAll("trash");
  return rows.filter((e) => (!filter.kind || e.kind === filter.kind) && e.deletedAt > now - KEEP_MS).sort((a, b) => b.deletedAt - a.deletedAt);
}

/** "Çöp kutusu'nda 29 gün daha": whole days left before it goes for good (at least 0). */
export const daysLeft = (entry: Pick<TrashEntry, "deletedAt">, now = Date.now()): number => Math.max(0, Math.ceil((entry.deletedAt + KEEP_MS - now) / DAY_MS));

export interface RestoreResult {
  entry: TrashEntry | null;
  /** Records put back. */
  restored: number;
  /** Records left out because one with the same id is there now (it stays as it is). */
  skipped: number;
}

type AnyStore = { getKey(key: string): Promise<unknown>; put(value: unknown): Promise<unknown>; delete(key: string): Promise<void> };

/**
 * "Geri getir": everything in the entry goes back with its own id (one transaction). A record whose id is
 * there again now is left as it is and counted in `skipped`. The entry leaves the trash.
 */
export async function restoreTrash(id: string): Promise<RestoreResult> {
  restoring++;
  try {
    const d = await db();
    const tx = d.transaction(TRIP_STORES, "readwrite");
    const entry = await tx.objectStore("trash").get(id);
    if (!entry) {
      await tx.done;
      return { entry: null, restored: 0, skipped: 0 };
    }
    let restored = 0;
    let skipped = 0;
    const store = (name: (typeof TRIP_STORES)[number]) => tx.objectStore(name) as unknown as AnyStore;
    const putBack = async (name: (typeof TRIP_STORES)[number], key: string, value: unknown) => {
      if ((await store(name).getKey(key)) !== undefined) skipped++;
      else {
        await store(name).put(value);
        restored++;
      }
    };
    if (entry.kind === "item") {
      await putBack("items", entry.payload.item.id, entry.payload.item);
      for (const doc of entry.payload.docs) await putBack("docs", doc.id, doc);
    } else {
      const p = entry.payload;
      await putBack("trips", p.trip.id, p.trip);
      for (const r of p.items) await putBack("items", r.id, r);
      for (const r of p.docs) await putBack("docs", r.id, r);
      for (const r of p.captures) await putBack("captures", r.id, r);
      for (const r of p.messages) await putBack("messages", r.id, r);
      for (const r of p.analyses) await putBack("analyses", r.key, r);
      for (const r of p.preferences) await putBack("preferences", r.id, r);
    }
    await store("trash").delete(id);
    await tx.done;
    await addEvent(entry.tripId, L(`${entry.label} çöp kutusundan geri getirildi`, `${entry.label} restored from the trash`));
    notifyChanged();
    return { entry, restored, skipped };
  } finally {
    restoring--;
  }
}

/** A trash entry taken out without restoring it (the card's 8-second "Geri al" put it back itself). */
export async function dropTrash(id: string): Promise<void> {
  await (await db()).delete("trash", id);
}
