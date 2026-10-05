// What the one "Geri al" on screen can take back (lib/undo.ts holds it for 8 seconds): a record deleted
// (a card's ×, a stay said apart), a record just added in one tap (it goes again), nights marked "Gerek
// yok" (they come back). The toast's words are here; the undoing is app/actions.ts undo. Pure.
import { L } from "./i18n";
import type { Removed } from "./removal";
import type { DocRecord, Item } from "./types";

export type Undoable =
  | { kind: "removed"; removed: Removed }
  /** `label`: the tile's name ("Otobüs"). */
  | { kind: "added"; item: Item; label: string }
  /** `key`: trip.hidden's key (`nights:<start>_<end>`); `label`: "Porto 14–15 Ekim". */
  | { kind: "hidden"; tripId: string; key: string; label: string }
  /** A file deleted from Belgeler: it comes back with its card and kind. */
  | { kind: "doc"; doc: DocRecord };

/** "Douro tekne turu silindi", "Otobüs eklendi", "Porto 14–15 Ekim gizlendi". */
export function undoText(u: Undoable): string {
  switch (u.kind) {
    case "removed":
      return L(`${u.removed.item.name} silindi`, `${u.removed.item.name} deleted`);
    case "added":
      return L(`${u.label} eklendi`, `${u.label} added`);
    case "hidden":
      return L(`${u.label} gizlendi`, `${u.label} hidden`);
    case "doc":
      return L(`${u.doc.name} silindi`, `${u.doc.name} deleted`);
  }
}

/** The trip it belongs to (another trip on screen: it stays as it is). */
export const undoTrip = (u: Undoable): string =>
  u.kind === "removed" ? u.removed.item.tripId : u.kind === "added" ? u.item.tripId : u.kind === "doc" ? u.doc.tripId : u.tripId;
