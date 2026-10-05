// Çöp kutusu (paylaşım güvenliği, 0.37): nothing the traveller deletes is gone at once. A card goes with its
// files, a file on its own, a trip with everything that was only its own (cards, files, the pages saved for them,
// the chat and its history lines, analyses, its own notes), into one entry that waits here for 30 days and
// comes back in one tap with the same ids. Local only: the trash never leaves this computer.
//
// Two stores: `trash` holds the light rows the lists read (label, kind, when, size), `trashData` what each
// took, read only to restore it. "Kalıcı sil" and "Çöp kutusunu boşalt" remove both for good.
import { addEvent, db, newId, notifyChanged } from "./db";
import { L } from "./i18n";
import type { Capture, DocRecord, TrashData, TrashEntry, TrashKind, TrashPayload } from "./types";

export const TRASH_DAYS = 30;
const DAY_MS = 24 * 3600e3;
const KEEP_MS = TRASH_DAYS * DAY_MS;

/** Stores a trip's records live in, written in one transaction when a trip goes or comes back. */
const TRIP_STORES = ["trips", "items", "docs", "captures", "messages", "analyses", "preferences", "trash", "trashData"] as const;

const uniqueById = <T extends { id: string }>(rows: T[]): T[] => [...new Map(rows.map((r) => [r.id, r])).values()];

/** About how many bytes an entry holds: its files' sizes and its records as text. */
export function sizeOf(payload: TrashPayload): number {
  const docs = payload.kind === "doc" ? [payload.doc] : payload.docs;
  const files = docs.reduce((n, d) => n + (Number.isFinite(d.size) ? d.size : 0), 0);
  const text = JSON.stringify(payload, (key, value) => (key === "blob" ? undefined : value)) ?? "";
  return files + text.length;
}

const countOf = (payload: TrashPayload): number =>
  payload.kind === "doc"
    ? 1
    : payload.kind === "item"
      ? 1 + payload.docs.length
      : 1 + payload.items.length + payload.docs.length + payload.captures.length + payload.messages.length + payload.analyses.length + payload.preferences.length;

/** The two records of a new trash entry (written by the caller in its own transaction). */
export function newTrashEntry(tripId: string, label: string, payload: TrashPayload, now = Date.now()): { entry: TrashEntry; data: TrashData } {
  const id = newId();
  return { entry: { id, tripId, kind: payload.kind, deletedAt: now, label, size: sizeOf(payload), count: countOf(payload) }, data: { id, payload } };
}

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
  const { entry, data } = newTrashEntry(tripId, trip.title, { kind: "trip", trip, items, docs, captures, messages, analyses, preferences }, now);
  await tx.objectStore("trash").put(entry);
  await tx.objectStore("trashData").put(data);
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

/** A file deleted (Belgeler, a card's file list): to the trash, handed back with its entry for "Geri al". */
export async function trashDoc(id: string, now = Date.now()): Promise<{ doc: DocRecord; trashId: string } | null> {
  const tx = (await db()).transaction(["docs", "trash", "trashData"], "readwrite");
  const doc = await tx.objectStore("docs").get(id);
  if (!doc) {
    await tx.done;
    return null;
  }
  const payload = { kind: "doc" as const, doc };
  const { entry, data } = newTrashEntry(doc.tripId, doc.name, payload, now);
  await tx.objectStore("trash").put(entry);
  await tx.objectStore("trashData").put(data);
  await tx.objectStore("docs").delete(id);
  await tx.done;
  notifyChanged();
  return { doc, trashId: entry.id };
}

// A restore in progress: the purge waits (an entry about to come back is never removed under it).
let restoring = 0;

/** Entries older than 30 days go for good. Never while a restore runs. Returns how many went. */
export async function purgeTrash(now = Date.now()): Promise<number> {
  if (restoring > 0) return 0;
  const tx = (await db()).transaction(["trash", "trashData"], "readwrite");
  let gone = 0;
  let cursor = await tx.objectStore("trash").index("deletedAt").openCursor(IDBKeyRange.upperBound(now - KEEP_MS, true));
  while (cursor) {
    if (restoring > 0) break;
    await tx.objectStore("trashData").delete(cursor.primaryKey);
    await cursor.delete();
    gone++;
    cursor = await cursor.continue();
  }
  await tx.done;
  return gone;
}

/**
 * What is in the trash, newest first: one trip's cards and files, or the deleted trips. Light rows only (what
 * each holds is read on restore); older than 30 days is left out (purgeTrash removes it).
 */
export async function listTrash(filter: { tripId?: string; kinds?: TrashKind[] } = {}, now = Date.now()): Promise<TrashEntry[]> {
  const d = await db();
  const rows = filter.tripId ? await d.getAllFromIndex("trash", "tripId", filter.tripId) : await d.getAll("trash");
  return rows.filter((e) => (!filter.kinds || filter.kinds.includes(e.kind)) && e.deletedAt > now - KEEP_MS).sort((a, b) => b.deletedAt - a.deletedAt);
}

/** "Çöp kutusu'nda 29 gün daha": whole days left before it goes for good (at least 0). */
export const daysLeft = (entry: Pick<TrashEntry, "deletedAt">, now = Date.now()): number => Math.max(0, Math.ceil((entry.deletedAt + KEEP_MS - now) / DAY_MS));

export interface RestoreResult {
  entry: TrashEntry | null;
  /** Records put back. */
  restored: number;
  /** Records left out because one with the same id is there now (it stays as it is). */
  skipped: number;
  /** A shared trip came back as a copy apart from the sharing (the same share is on this computer again). */
  detached: boolean;
}

type AnyStore = { getKey(key: string): Promise<unknown>; put(value: unknown): Promise<unknown>; delete(key: string): Promise<void> };

/**
 * "Geri getir": everything in the entry goes back with its own id (one transaction). A record whose id is
 * there again now is left as it is and counted in `skipped`. A shared trip whose share was joined again in
 * the meantime comes back without it (two trips must never sync the same share). The entry leaves the trash.
 */
export async function restoreTrash(id: string): Promise<RestoreResult> {
  restoring++;
  try {
    const d = await db();
    const tx = d.transaction(TRIP_STORES, "readwrite");
    const entry = await tx.objectStore("trash").get(id);
    const data = await tx.objectStore("trashData").get(id);
    if (!entry || !data) {
      await tx.done;
      return { entry: null, restored: 0, skipped: 0, detached: false };
    }
    let restored = 0;
    let skipped = 0;
    let detached = false;
    const store = (name: (typeof TRIP_STORES)[number]) => tx.objectStore(name) as unknown as AnyStore;
    const putBack = async (name: (typeof TRIP_STORES)[number], key: string, value: unknown) => {
      if ((await store(name).getKey(key)) !== undefined) skipped++;
      else {
        await store(name).put(value);
        restored++;
      }
    };
    const p = data.payload;
    if (p.kind === "doc") await putBack("docs", p.doc.id, p.doc);
    else if (p.kind === "item") {
      await putBack("items", p.item.id, p.item);
      for (const doc of p.docs) await putBack("docs", doc.id, doc);
    } else {
      let trip = p.trip;
      if (trip.shareId && (await tx.objectStore("trips").getAll()).some((t) => t.id !== trip.id && t.shareId === trip.shareId)) {
        const { shareId: _apart, ...rest } = trip;
        trip = rest;
        detached = true;
      }
      await putBack("trips", trip.id, trip);
      for (const r of p.items) await putBack("items", r.id, r);
      for (const r of p.docs) await putBack("docs", r.id, r);
      for (const r of p.captures) await putBack("captures", r.id, r);
      for (const r of p.messages) await putBack("messages", r.id, r);
      for (const r of p.analyses) await putBack("analyses", r.key, r);
      for (const r of p.preferences) await putBack("preferences", r.id, r);
    }
    await store("trash").delete(id);
    await store("trashData").delete(id);
    await tx.done;
    await addEvent(
      entry.tripId,
      detached
        ? L(`${entry.label} çöp kutusundan geri getirildi (paylaşımdan ayrı bir kopya olarak)`, `${entry.label} restored from the trash (as a copy apart from the sharing)`)
        : L(`${entry.label} çöp kutusundan geri getirildi`, `${entry.label} restored from the trash`),
    );
    notifyChanged();
    return { entry, restored, skipped, detached };
  } finally {
    restoring--;
  }
}

/** An entry gone for good without restoring it: "Kalıcı sil", or the 8-second "Geri al" put it back itself. */
export async function dropTrash(id: string): Promise<void> {
  const tx = (await db()).transaction(["trash", "trashData"], "readwrite");
  await tx.objectStore("trash").delete(id);
  await tx.objectStore("trashData").delete(id);
  await tx.done;
  notifyChanged();
}

/** "Çöp kutusunu boşalt": every entry (of one trip, or the deleted trips) gone for good. Returns how many. */
export async function emptyTrash(filter: { tripId?: string; kinds?: TrashKind[] } = {}): Promise<number> {
  const ids = (await listTrash(filter, 0)).map((e) => e.id);
  const tx = (await db()).transaction(["trash", "trashData"], "readwrite");
  for (const id of ids) {
    await tx.objectStore("trash").delete(id);
    await tx.objectStore("trashData").delete(id);
  }
  await tx.done;
  notifyChanged();
  return ids.length;
}
