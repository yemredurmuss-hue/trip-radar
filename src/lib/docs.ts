// Files attached to a card (ticket PDFs, QR screenshots): kept in this computer's IndexedDB only. They
// never go to the sharing server and exports carry only their names. A card's files go when the card goes.
import { db, newId, notifyChanged } from "./db";
import { L } from "./i18n";
import { num } from "./i18nText";
import { isIdea } from "./booking";
import { cardKind, isTransportKind } from "./cardKinds";
import type { DocKind, DocMeta, DocRecord, Item } from "./types";

/**
 * A booking that should have its ticket or confirmation with it (0.35.11, Emre: "book edildi dediklerimiz için
 * belge eksik"): booked, and not an idea or a table (a restaurant's booking rarely comes as a file).
 */
export const needsDoc = (item: Item): boolean => item.status === "booked" && item.category !== "food" && !isIdea(item);

export const DOC_MAX_BYTES = 15 * 1024 * 1024;
// No HEIC: Chrome can't show it, so a kept HEIC would be a file that never opens.
export const DOC_ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const BY_EXTENSION: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
const KEPT = new Set(Object.values(BY_EXTENSION));

/** The file's type: its MIME type, or (when it comes without one) its extension; null when it isn't one we keep. */
export function docType(file: { name: string; type: string }): string | null {
  if (KEPT.has(file.type)) return file.type;
  return BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

export function checkDoc(file: { name: string; type: string; size: number }): string | null {
  if (!docType(file)) return L(`${file.name}: yalnız PDF, PNG ya da JPG eklenebilir.`, `${file.name}: only PDF, PNG or JPG files can be added.`);
  if (file.size > DOC_MAX_BYTES) return L(`${file.name} 15 MB'tan büyük.`, `${file.name} is larger than 15 MB.`);
  if (file.size === 0) return L(`${file.name} boş.`, `${file.name} is empty.`);
  return null;
}

export async function addDoc(item: Pick<Item, "id" | "tripId">, file: Blob & { name: string }, now = Date.now()): Promise<DocRecord> {
  const problem = checkDoc(file);
  if (problem) throw new Error(problem);
  const type = docType(file)!;
  const doc: DocRecord = { id: newId(), itemId: item.id, tripId: item.tripId, name: file.name, type, size: file.size, blob: new Blob([file], { type }), addedAt: now };
  await (await db()).put("docs", doc);
  notifyChanged();
  return doc;
}

/**
 * A file dropped in the chat or on the board (spec 0.34.6 §1): kept with the trip, linked to no card yet
 * (the assistant reads it and links it, or Belgeler's "Bir karta bağla" does).
 */
export async function addTripDoc(tripId: string, file: Blob & { name: string }, now = Date.now()): Promise<DocRecord> {
  return addDoc({ id: "", tripId }, file, now);
}

/** Links a file to a card (or "" to none), saying what it is when known. */
export async function linkDoc(id: string, itemId: string, kind?: DocKind): Promise<DocRecord | null> {
  const d = await db();
  const doc = await d.get("docs", id);
  if (!doc) return null;
  const next: DocRecord = { ...doc, itemId, ...(kind ? { kind } : {}) };
  await d.put("docs", next);
  notifyChanged();
  return next;
}

/** A file deleted from Belgeler, handed back for the 8-second "Geri al". */
export async function takeDoc(id: string): Promise<DocRecord | null> {
  const doc = await getDoc(id);
  if (!doc) return null;
  await deleteDoc(id);
  return doc;
}

/** "Geri al": the file is back as it was (its card, its kind). */
export async function restoreDoc(doc: DocRecord): Promise<void> {
  await putDocs([doc]);
  notifyChanged();
}

/** Belgeler's groups, in their order: Uçuş · Konaklama · Ulaşım · Etkinlik · Sigorta · İnternet · Diğer. */
export const DOC_GROUPS = ["flight", "stay", "transport", "event", "insurance", "internet", "other"] as const;
export type DocGroup = (typeof DOC_GROUPS)[number];

const GROUP_OF_KIND: Record<DocKind, DocGroup> = {
  flight: "flight", stay: "stay", train: "transport", bus: "transport", ferry: "transport", car_rental: "transport",
  event: "event", insurance: "insurance", esim: "internet", visa: "other", other: "other",
};

/** A file's group: what its card is (a flight, a stay...), else what the assistant read it as, else Diğer. */
export function docGroupOf(doc: Pick<DocMeta, "kind">, item: Item | null | undefined): DocGroup {
  if (item) {
    const kind = cardKind(item);
    if (kind === "flight") return "flight";
    if (kind === "stay") return "stay";
    if (isTransportKind(kind)) return "transport";
    if (kind === "activity" || kind === "todo") return "event";
    if (kind === "insurance") return "insurance";
    if (kind === "esim") return "internet";
    return "other";
  }
  return doc.kind ? GROUP_OF_KIND[doc.kind] : "other";
}

const metaOf = ({ blob: _blob, ...meta }: DocRecord): DocMeta => meta;

/** A trip's files, oldest first, without their contents. */
export async function listDocMeta(tripId: string): Promise<DocMeta[]> {
  const rows = await (await db()).getAllFromIndex("docs", "tripId", tripId);
  return rows.sort((a, b) => a.addedAt - b.addedAt).map(metaOf);
}

export async function getDoc(id: string): Promise<DocRecord | undefined> {
  return (await db()).get("docs", id);
}

export async function deleteDoc(id: string): Promise<void> {
  await (await db()).delete("docs", id);
  notifyChanged();
}

/** Removes a card's files and hands them back (kept in memory for "Geri al"). */
export async function takeDocsOf(itemId: string): Promise<DocRecord[]> {
  const tx = (await db()).transaction("docs", "readwrite");
  const docs = await tx.store.index("itemId").getAll(itemId);
  for (const d of docs) await tx.store.delete(d.id);
  await tx.done;
  return docs;
}

export async function putDocs(docs: DocRecord[]): Promise<void> {
  if (!docs.length) return;
  const tx = (await db()).transaction("docs", "readwrite");
  for (const d of docs) await tx.store.put(d);
  await tx.done;
}

/** A plan merged into another one (the chat's "tek blok"): its files go with it. */
export async function moveDocs(fromItemId: string, toItemId: string): Promise<void> {
  const tx = (await db()).transaction("docs", "readwrite");
  for (const d of await tx.store.index("itemId").getAll(fromItemId)) await tx.store.put({ ...d, itemId: toItemId });
  await tx.done;
}

/** A card moved to another trip takes its files along (else deleting the old trip would delete them). */
export async function moveDocsToTrip(itemId: string, tripId: string): Promise<void> {
  const tx = (await db()).transaction("docs", "readwrite");
  for (const d of await tx.store.index("itemId").getAll(itemId)) if (d.tripId !== tripId) await tx.store.put({ ...d, tripId });
  await tx.done;
}

export async function deleteTripDocs(tripId: string): Promise<void> {
  const tx = (await db()).transaction("docs", "readwrite");
  for (const key of await tx.store.index("tripId").getAllKeys(tripId)) await tx.store.delete(key);
  await tx.done;
}

/** The white pill: the first file's name and how many more. */
export const docPill = (docs: DocMeta[]): { name: string; more: number } | null => (docs.length ? { name: docs[0].name, more: docs.length - 1 } : null);

export const sizeText = (bytes: number): string =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${num(bytes / (1024 * 1024))} MB`;

/** A plan said in the chat that a saved page replaced hands its files to that page's card: owner id → the plans' ids. */
export function inheritedDocs(closed: { item: Item; by?: string }[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of closed) if (c.by && c.item.origin === "chat") out.set(c.by, [...(out.get(c.by) ?? []), c.item.id]);
  return out;
}
