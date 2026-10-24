// The note after a save (0.43.0): "Geri al" takes it back, "Değiştir" sends it to another trip, whether it is still being
// read (the capture waits with its trip) or already on the plan (the record moves, with its files: routing.moveToTrip).
import { db, notifyChanged } from "./db";
import { L } from "./i18n";
import { deleteItem } from "./removal";
import { moveToTrip } from "./routing";

/** "Geri al": the save taken back, and the record it made (into the trash, as any delete). */
export async function undoSave(captureId: string): Promise<boolean> {
  const d = await db();
  const capture = await d.get("captures", captureId);
  if (!capture) return false;
  const item = capture.itemId ? await d.get("items", capture.itemId) : undefined;
  if (item) await deleteItem(item, L(`${item.name} geri alındı`, `${item.name} taken back`));
  await d.delete("captures", captureId);
  notifyChanged();
  return true;
}

/** "Değiştir": the save goes to that trip (its reading, when it's still being read, lands there). */
export async function moveSave(captureId: string, tripId: string): Promise<boolean> {
  const d = await db();
  const capture = await d.get("captures", captureId);
  if (!capture || !(await d.get("trips", tripId))) return false;
  if (capture.itemId) {
    await moveToTrip(capture.itemId, tripId);
    return true;
  }
  await d.put("captures", { ...capture, forTripId: tripId });
  notifyChanged();
  return true;
}

/** How many saves are still being read (the note's "3 okunuyor"). */
export async function readingCount(): Promise<number> {
  const d = await db();
  return (await d.getAll("captures")).filter((c) => c.status === "pending" || c.status === "processing").length;
}
