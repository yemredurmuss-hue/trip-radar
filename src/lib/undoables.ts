// What the one "Geri al" on screen can take back (lib/undo.ts holds it for 8 seconds): a record deleted
// (a card's ×, a stay said apart), a record just added in one tap (it goes again), nights marked "Gerek
// yok" (they come back), a trip setting the chat changed (the money, who goes, the board's language). The
// toast's words are here; the undoing is app/actions.ts undo. Pure.
import { L, type Lang } from "./i18n";
import type { Removed } from "./removal";
import type { TripChange } from "./tripUndo";
import type { DocRecord, Item, Suggestion } from "./types";

export type Undoable =
  | { kind: "removed"; removed: Removed }
  /** `label`: the tile's name ("Otobüs"). */
  | { kind: "added"; item: Item; label: string }
  /** `key`: trip.hidden's key (`nights:<start>_<end>`, or `leg:<key>` for a transfer the chat hid); `label`: "Porto 14–15 Ekim". */
  | { kind: "hidden"; tripId: string; key: string; label: string }
  /** A file deleted from Belgeler: it comes back with its card and kind. */
  | { kind: "doc"; doc: DocRecord }
  /** A trip setting the chat changed (the money, who goes): its fields go back to what they were. */
  | { kind: "trip"; change: TripChange }
  /** The board's language the chat switched (the board reloaded since): `prev` comes back. */
  | { kind: "lang"; tripId: string; prev: Lang; label: string }
  /** A suggestion taken ("Plana ekle": `item` is the record it made, which goes again) or said not needed ("Gerek yok"): it opens again. */
  | { kind: "suggestion"; tripId: string; suggestion: Suggestion; state: "added" | "dismissed"; item: Item | null };

/** "Douro tekne turu silindi", "Otobüs eklendi", "Porto 14–15 Ekim gizlendi", "Para birimi: EUR". */
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
    case "trip":
      return u.change.label;
    case "lang":
      return u.label;
    case "suggestion":
      return u.state === "added"
        ? L(`${u.item?.name ?? u.suggestion.title} plana eklendi`, `${u.item?.name ?? u.suggestion.title} added to the plan`)
        : L(`${u.suggestion.title}: gerek yok`, `${u.suggestion.title}: not needed`);
  }
}

/** The trip it belongs to (another trip on screen: it stays as it is). */
export function undoTrip(u: Undoable): string {
  switch (u.kind) {
    case "removed":
      return u.removed.item.tripId;
    case "added":
      return u.item.tripId;
    case "doc":
      return u.doc.tripId;
    case "trip":
      return u.change.tripId;
    default:
      return u.tripId;
  }
}
