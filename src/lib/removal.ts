// "Sil" on a card: the record and its files go at once (one transaction) into the trash (0.37, trash.ts), where
// they wait 30 days; "Geri al" puts both back exactly as they were, from the copy kept in memory until then,
// and takes the trash entry out again.
import { addEvent, db, notifyChanged } from "./db";
import { L } from "./i18n";
import { newTrashEntry } from "./trash";
import type { DocRecord, Item } from "./types";

export interface Removed {
  item: Item;
  docs: DocRecord[];
  /** Its entry in the trash (absent when it went without one: a one-tap add taken back). */
  trashId?: string;
}

/**
 * Deletes a card and its files. They go to the trash for 30 days unless `trash: false` (a card just added in
 * one tap and taken back: nothing of the traveller's is lost).
 */
export async function deleteItem(item: Item, event?: string, opts: { trash?: boolean } = {}): Promise<Removed> {
  const d = await db();
  const tx = d.transaction(["items", "docs", "trash", "trashData"], "readwrite");
  const stored = await tx.objectStore("items").get(item.id);
  const fresh = stored ?? item;
  const docs = await tx.objectStore("docs").index("itemId").getAll(item.id);
  let trashId: string | undefined;
  if (opts.trash !== false && (stored || docs.length)) {
    const { entry, data } = newTrashEntry(fresh.tripId, fresh.name, { kind: "item", item: fresh, docs });
    await tx.objectStore("trash").put(entry);
    await tx.objectStore("trashData").put(data);
    trashId = entry.id;
  }
  for (const doc of docs) await tx.objectStore("docs").delete(doc.id);
  await tx.objectStore("items").delete(item.id);
  await tx.done;
  await addEvent(item.tripId, event ?? L(`${fresh.name} silindi`, `${fresh.name} deleted`));
  notifyChanged();
  return trashId ? { item: fresh, docs, trashId } : { item: fresh, docs };
}

// A plan the chat took back ("taksiyi kaldır") gets the same "Geri al" as the card's Sil: the board
// listens here (the chat runs in the board's page) and puts it in its undo slot.
const removedListeners = new Set<(removed: Removed) => void>();
export function onRemoved(listener: (removed: Removed) => void): () => void {
  removedListeners.add(listener);
  return () => void removedListeners.delete(listener);
}
export const announceRemoved = (removed: Removed) => removedListeners.forEach((l) => l(removed));

/** A transfer the chat hid ("Gaula → Madeira'yı kaldır"): `key` is trip.hidden's `leg:<key>`, `label` the toast's name. */
export interface HiddenByChat {
  tripId: string;
  key: string;
  label: string;
}
// The same "Geri al" for it as the board's "Gerek yok" nights: the board puts it in its undo slot.
const hiddenListeners = new Set<(hidden: HiddenByChat) => void>();
export function onHidden(listener: (hidden: HiddenByChat) => void): () => void {
  hiddenListeners.add(listener);
  return () => void hiddenListeners.delete(listener);
}
export const announceHidden = (hidden: HiddenByChat) => hiddenListeners.forEach((l) => l(hidden));

export async function restoreItem(removed: Removed): Promise<void> {
  const tx = (await db()).transaction(["items", "docs", "trash", "trashData"], "readwrite");
  await tx.objectStore("items").put(removed.item);
  for (const doc of removed.docs) await tx.objectStore("docs").put(doc);
  if (removed.trashId) {
    await tx.objectStore("trash").delete(removed.trashId);
    await tx.objectStore("trashData").delete(removed.trashId);
  }
  await tx.done;
  await addEvent(removed.item.tripId, L(`${removed.item.name} geri getirildi`, `${removed.item.name} restored`));
  notifyChanged();
}
