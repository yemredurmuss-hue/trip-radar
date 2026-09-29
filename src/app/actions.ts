// Small write actions shared by the board's views.
import { addEvent, db, notifyChanged } from "../lib/db";
import type { Item, ItemStatus, Trip } from "../lib/types";

const EVENT: Record<ItemStatus, string> = {
  chosen: "plana alındı",
  booked: "rezerve edildi olarak işaretlendi",
  dismissed: "elendi",
  saved: "seçeneklere geri alındı",
};

export async function setItemStatus(item: Item, status: ItemStatus): Promise<void> {
  const d = await db();
  const fresh = (await d.get("items", item.id)) ?? item;
  await d.put("items", { ...fresh, status, updatedAt: Date.now() });
  await addEvent(item.tripId, `${item.name} ${EVENT[status]}`);
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

/** "Seç": this option goes into the plan; one chosen before it for the same need goes back to the options. */
export async function chooseItem(item: Item, alternatives: Item[]): Promise<void> {
  const d = await db();
  for (const other of alternatives) {
    if (other.id === item.id || other.status !== "chosen") continue;
    const fresh = (await d.get("items", other.id)) ?? other;
    await d.put("items", { ...fresh, status: "saved", updatedAt: Date.now() });
  }
  await setItemStatus(item, "chosen");
}
