// Small write actions shared by the board's views.
import { addEvent, db, notifyChanged } from "../lib/db";
import { restoreDoc } from "../lib/docs";
import { L } from "../lib/i18n";
import { announceRemoved, deleteItem, restoreItem, type Removed } from "../lib/removal";
import { nightsKey } from "../lib/timeline";
import type { DateRange } from "../lib/plan";
import type { Category, Item, ItemStatus, Trip } from "../lib/types";
import type { Undoable } from "../lib/undoables";

/** The trip history line for a status change, written in the current language. */
const statusEvent = (name: string, status: ItemStatus): string =>
  ({
    chosen: L(`${name} plana alındı`, `${name} added to the plan`),
    booked: L(`${name} rezerve edildi olarak işaretlendi`, `${name} marked as booked`),
    dismissed: L(`${name} elendi`, `${name} ruled out`),
    saved: L(`${name} seçeneklere geri alındı`, `${name} moved back to options`),
  })[status];

export async function setItemStatus(item: Item, status: ItemStatus): Promise<void> {
  const d = await db();
  const found = (await d.get("items", item.id)) ?? item;
  // Taken off by the chat ("kaldır"): "Geri al" puts back what it was (a plan said in the chat is planned again,
  // a booking booked), not "an option".
  const back = status === "saved" && found.status === "dismissed" && found.dismissedFrom ? found.dismissedFrom : status;
  const { dismissedFrom: _from, ...fresh } = found;
  await d.put("items", { ...fresh, status: back, statusAt: Date.now(), updatedAt: Date.now() });
  await addEvent(item.tripId, statusEvent(item.name, back));
  notifyChanged();
}

/**
 * Applies a change to the trip as stored right now (not a possibly stale copy from the last render).
 * `touch: false` keeps `updatedAt` as it was: for cache writes (hero photos, mood sentence) that aren't an edit
 * by the traveller and mustn't win a settings-sync conflict.
 */
export async function updateTrip(tripId: string, change: (trip: Trip) => Trip, opts: { touch?: boolean } = {}): Promise<void> {
  const d = await db();
  // Read and write in one transaction: a write from elsewhere (a share-sync pull) can't slip in between and be lost.
  const tx = d.transaction("trips", "readwrite");
  const current = await tx.store.get(tripId);
  if (!current) {
    await tx.done;
    return;
  }
  const next = change(current);
  await tx.store.put({ ...next, updatedAt: opts.touch === false ? current.updatedAt : Date.now() });
  await tx.done;
  notifyChanged();
}

/** Needs that take one option (a stay, a flight...); activities and places can be chosen side by side. */
const ONE_PER_NEED: Category[] = ["stay", "flight", "transport", "esim"];

/**
 * "Seç": this option goes into the plan and one chosen before it for the same need goes back to the
 * options. A plan only said in the chat stays as it is: the plan sets it aside ("Yerine X geldi")
 * while a saved page is chosen for it, and it comes back if that choice is undone.
 */
export async function chooseItem(item: Item, alternatives: Item[]): Promise<void> {
  const d = await db();
  if (ONE_PER_NEED.includes(item.category)) {
    for (const other of alternatives) {
      if (other.id === item.id || other.origin === "chat") continue;
      const fresh = (await d.get("items", other.id)) ?? other;
      if (fresh.status !== "chosen") continue;
      await d.put("items", { ...fresh, status: "saved", statusAt: Date.now(), updatedAt: Date.now() });
    }
  }
  await setItemStatus(item, "chosen");
}

/**
 * Deletes a record and its files from anywhere outside a plan card (the drawer, "Ayrı olmasın"), with the
 * same 8-second "Geri al" as a card's Sil: the board picks it up from announceRemoved. No confirm dialog.
 */
export async function removeItem(item: Item, event?: string): Promise<Removed> {
  const removed = await deleteItem(item, event);
  announceRemoved(removed);
  return removed;
}

/** eSIM "Kurdum" (and "Kurulmadı" to take it back). */
export async function setInstalled(item: Item, installed: boolean): Promise<void> {
  const d = await db();
  const fresh = (await d.get("items", item.id)) ?? item;
  const { installedAt: _was, ...rest } = fresh;
  await d.put("items", installed ? { ...fresh, installedAt: Date.now(), updatedAt: Date.now() } : { ...rest, updatedAt: Date.now() });
  await addEvent(item.tripId, installed ? L(`${item.name} kuruldu`, `${item.name} installed`) : L(`${item.name} kurulmadı olarak geri alındı`, `${item.name} marked as not installed`));
  notifyChanged();
}

/** "Gerek yok": a transfer or nights the traveller doesn't need leave the board (and the to-dos); "Geri getir" undoes it. */
export async function setHidden(tripId: string, key: string, hide: boolean, label: string): Promise<void> {
  await updateTrip(tripId, (t) => {
    const rest = (t.hidden ?? []).filter((k) => k !== key);
    return { ...t, hidden: hide ? [...rest, key] : rest };
  });
  await addEvent(
    tripId,
    hide ? L(`${label}: gerek yok denildi, gizlendi`, `${label}: marked not needed, hidden`) : L(`${label} geri getirildi`, `${label} brought back`),
  );
  notifyChanged();
}

/** A block of empty nights' ×: "Gerek yok" for those nights, handed back for the 8-second "Geri al". */
export async function hideNights(tripId: string, range: DateRange, label: string): Promise<Undoable> {
  const key = nightsKey(range);
  await setHidden(tripId, key, true, label);
  return { kind: "hidden", tripId, key, label };
}

/** "Geri al": a deletion restored, a one-tap add taken away again, hidden nights brought back. */
export async function undo(u: Undoable): Promise<void> {
  if (u.kind === "removed") return restoreItem(u.removed);
  if (u.kind === "doc") return restoreDoc(u.doc);
  if (u.kind === "added") {
    await deleteItem(u.item, L(`${u.item.name} eklenmedi (geri alındı)`, `${u.item.name} not added (undone)`));
    return;
  }
  return setHidden(u.tripId, u.key, false, u.label);
}
