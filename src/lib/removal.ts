// "Sil" on a card: the record and its files go at once (one transaction); "Geri al" puts both back
// exactly as they were, from the copy kept in memory until then.
import { addEvent, db, notifyChanged } from "./db";
import { putDocs } from "./docs";
import { L } from "./i18n";
import type { DocRecord, Item } from "./types";

export interface Removed {
  item: Item;
  docs: DocRecord[];
}

export async function deleteItem(item: Item, event?: string): Promise<Removed> {
  const d = await db();
  const tx = d.transaction(["items", "docs"], "readwrite");
  const fresh = (await tx.objectStore("items").get(item.id)) ?? item;
  const docs = await tx.objectStore("docs").index("itemId").getAll(item.id);
  for (const doc of docs) await tx.objectStore("docs").delete(doc.id);
  await tx.objectStore("items").delete(item.id);
  await tx.done;
  await addEvent(item.tripId, event ?? L(`${fresh.name} silindi`, `${fresh.name} deleted`));
  notifyChanged();
  return { item: fresh, docs };
}

export async function restoreItem(removed: Removed): Promise<void> {
  await (await db()).put("items", removed.item);
  await putDocs(removed.docs);
  await addEvent(removed.item.tripId, L(`${removed.item.name} geri getirildi`, `${removed.item.name} restored`));
  notifyChanged();
}
