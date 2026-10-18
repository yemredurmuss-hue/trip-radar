// Pano > Belgeler (C5, plan v83: docs/superpowers/specs/2026-10-18-plan-v77-katmanli-tasarim-notu.md "Belgeler (C5)"): the
// trip's files and the ones still to come, by kind (Uçuş · Konaklama · Ulaşım · Etkinlik · Sigorta · İnternet · Diğer), then
// "Bağlanmamış". A file on a card says so and shows the card ("Kartı göster"); a booking with no file yet is "Belge eklenmedi"
// with "+ Ekle"; a plan chosen and not bought waits for its file ("Bekleniyor"); a file that belongs to no card offers "Karta
// bağla". The files stay on this computer (lib/docs.ts). Pure: the Belgeler of 0.34.6 (docs/DocsTab) in the v83 rows.
import { isIdea } from "./booking";
import { cardKind, isTransportKind, type CardKind } from "./cardKinds";
import { DOC_GROUPS, docGroupOf, needsDoc, sizeText, type DocGroup } from "./docs";
import { formatDateRange } from "./items";
import { L } from "./i18n";
import { needTitleOf } from "./pano";
import type { DocMeta, Item } from "./types";

export type DocRowState = "ok" | "wait" | "add" | "link";

export interface DocRow {
  key: string;
  state: DocRowState;
  /** The file (a linked one, one linked to no card). */
  doc: DocMeta | null;
  /** The card it belongs to (or the one it's still to come for). */
  item: Item | null;
  /** The file's own name; for one still to come, what it will be and for what ("E-bilet · Porto → Lizbon"). */
  name: string;
  /** "PDF · Jardim Stay kartına bağlı · 3 Eki · 120 KB", "alınınca gelir", "belge eklenmedi · ABC123". */
  sub: string;
}

export interface DocRowGroup {
  id: DocGroup | "unlinked";
  rows: DocRow[];
}

/** "Seyahat sağlık sigortası · Allianz": the card's name, and who it's from when the name doesn't say. */
export const cardLabel = (item: Item): string =>
  item.provider && !item.name.toLocaleLowerCase("tr").includes(item.provider.toLocaleLowerCase("tr")) ? `${item.name} · ${item.provider}` : item.name;

export function docGroupLabel(id: DocRowGroup["id"]): string {
  switch (id) {
    case "flight":
      return L("Uçuş", "Flights");
    case "stay":
      return L("Konaklama", "Stays");
    case "transport":
      return L("Ulaşım", "Getting around");
    case "event":
      return L("Etkinlik", "Events");
    case "insurance":
      return L("Sigorta", "Insurance");
    case "internet":
      return L("İnternet", "Internet");
    case "other":
      return L("Diğer", "Other");
    case "unlinked":
      return L("Bağlanmamış", "Not linked");
  }
}

/** What the file of a kind of card is called: an e-ticket, a confirmation, a policy. */
export function docWord(kind: CardKind): string {
  if (kind === "flight") return L("E-bilet", "E-ticket");
  if (kind === "stay") return L("Onay", "Confirmation");
  if (kind === "insurance") return L("Poliçe", "Policy");
  if (kind === "esim") return L("eSIM QR", "eSIM QR code");
  if (kind === "activity" || isTransportKind(kind)) return L("Bilet", "Ticket");
  return L("Belge", "Document");
}

const typeWord = (doc: Pick<DocMeta, "type">) => (doc.type === "application/pdf" ? "PDF" : L("görsel", "image"));
/** The day a file was added ("3 Eki"), on this computer's calendar. */
const addedText = (at: number) => {
  const d = new Date(at);
  const two = (n: number) => String(n).padStart(2, "0");
  return formatDateRange(`${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`, null);
};

/** A card that takes a file once bought (a ticket, a confirmation): not an idea, not a table. */
const takesDoc = (item: Item) => item.category !== "food" && !isIdea(item);

/**
 * The rows of Belgeler by group in their order, "Bağlanmamış" last; empty groups are left out. `inherited`: the plans a saved page
 * replaced hand it their files (docs.inheritedDocs), so a booking with one of those is not "Belge eklenmedi".
 */
export function docRowsOf(docs: readonly DocMeta[], items: readonly Item[], inherited: ReadonlyMap<string, readonly string[]> = new Map()): DocRowGroup[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const filed = new Set(docs.map((d) => d.itemId));
  const hasDoc = (item: Item) => filed.has(item.id) || (inherited.get(item.id) ?? []).some((id) => filed.has(id));
  const rows: { group: DocRowGroup["id"]; row: DocRow; order: number }[] = [];
  for (const d of [...docs].sort((a, b) => b.addedAt - a.addedAt)) {
    const item = d.itemId ? (byId.get(d.itemId) ?? null) : null;
    if (item) {
      const sub = [typeWord(d), L(`${cardLabel(item)} kartına bağlı`, `on the ${cardLabel(item)} card`), addedText(d.addedAt), sizeText(d.size)].join(" · ");
      rows.push({ group: docGroupOf(d, item), row: { key: `doc:${d.id}`, state: "ok", doc: d, item, name: d.name, sub }, order: 0 });
    } else {
      const sub = [typeWord(d), addedText(d.addedAt), sizeText(d.size), L("bir karta bağla", "link it to a card")].join(" · ");
      rows.push({ group: "unlinked", row: { key: `doc:${d.id}`, state: "link", doc: d, item: null, name: d.name, sub }, order: 0 });
    }
  }
  for (const item of items) {
    if (item.status === "dismissed" || !takesDoc(item) || hasDoc(item)) continue;
    // A flight by its way ("E-bilet · Porto → Lizbon"), anything else by its own name ("Onay · Lisboa Loft", v83).
    const name = `${docWord(cardKind(item))} · ${item.category === "flight" ? needTitleOf(item) : item.name}`;
    if (needsDoc(item)) {
      const sub = [L("belge eklenmedi", "no file yet"), item.bookingRef].filter(Boolean).join(" · ");
      rows.push({ group: docGroupOf({}, item), row: { key: `add:${item.id}`, state: "add", doc: null, item, name, sub }, order: 1 });
    } else if (item.status === "chosen") {
      rows.push({ group: docGroupOf({}, item), row: { key: `wait:${item.id}`, state: "wait", doc: null, item, name, sub: L("alınınca gelir", "comes once it's bought") }, order: 2 });
    }
  }
  const order: DocRowGroup["id"][] = [...DOC_GROUPS, "unlinked"];
  return order
    .map((id) => ({
      id,
      rows: rows
        .filter((r) => r.group === id)
        .map((r, i) => ({ ...r, i }))
        .sort((a, b) => a.order - b.order || a.i - b.i)
        .map((r) => r.row),
    }))
    .filter((g) => g.rows.length > 0);
}
