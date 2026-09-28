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
