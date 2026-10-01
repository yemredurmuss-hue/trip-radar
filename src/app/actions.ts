// Small write actions shared by the board's views.
import { addEvent, db, notifyChanged } from "../lib/db";
import { L } from "../lib/i18n";
import type { Category, Item, ItemStatus, Trip } from "../lib/types";

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
  const fresh = (await d.get("items", item.id)) ?? item;
  await d.put("items", { ...fresh, status, statusAt: Date.now(), updatedAt: Date.now() });
  await addEvent(item.tripId, statusEvent(item.name, status));
  notifyChanged();
}

/** Applies a change to the trip as stored right now (not a possibly stale copy from the last render). */
export async function updateTrip(tripId: string, change: (trip: Trip) => Trip): Promise<void> {
  const d = await db();
  const current = await d.get("trips", tripId);
  if (!current) return;
  await d.put("trips", { ...change(current), updatedAt: Date.now() });
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

/** "Planı kaldır": a plan said in the chat has no page behind it, so it simply goes. */
export async function removeItem(item: Item): Promise<void> {
  await (await db()).delete("items", item.id);
  await addEvent(item.tripId, L(`${item.name} plandan kaldırıldı`, `${item.name} removed from the plan`));
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
