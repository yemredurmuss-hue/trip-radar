// Small write actions shared by the board's views.
import { addEvent, db, newId, notifyChanged } from "../lib/db";
import { restoreDoc } from "../lib/docs";
import { L, saveLang } from "../lib/i18n";
import { announceRemoved, deleteItem, restoreItem, type Removed } from "../lib/removal";
import { restoreFields, withTravellers, type TravellersChange } from "../lib/tripSettings";
import { latestLangLine, undoEvent } from "../lib/eventUndo";
import { stableJson } from "../lib/share/settings";
import { suggestedAdd, withState } from "../lib/suggestions";
import type { InsertAt, TemplateId } from "../lib/templates";
import { withEdits } from "../lib/userEdits";
import { checkVehicle, overlaps, periodOf, vehicleOf } from "../lib/vehicles";
import { nightsKey } from "../lib/timeline";
import type { DateRange } from "../lib/plan";
import type { Category, Item, ItemStatus, Suggestion, SuggestionState, Trip } from "../lib/types";
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

// --- Öneriler (lib/suggestions.ts): "Plana ekle", "Gerek yok", and their way back ---------------------------

/** A suggestion's state on the trip as stored right now (a rule's put back to open leaves the list again). */
async function setSuggestion(tripId: string, s: Suggestion, state: SuggestionState): Promise<void> {
  await updateTrip(tripId, (t) => ({ ...t, suggestions: withState(t.suggestions, t.suggestions?.find((x) => x.key === s.key) ?? s, state, Date.now()) }));
}

/** What "Plana ekle" did. */
export type SuggestedOutcome =
  /** The record is on the plan; the toast's "Geri al" takes it and the mark back. */
  | { kind: "added"; undo: Undoable }
  /** Not whole from the suggestion alone (a flight needs both ends): the template's add sheet, opened where it belongs. */
  | { kind: "sheet"; template: TemplateId; at: InsertAt }
  /** Refused, said on the card (a vehicle already covers those days). */
  | { kind: "refused"; text: string }
  /** Added already (a second tap, another tab): nothing more. */
  | { kind: "already" }
  /** A warning: nothing to add. */
  | null;

/**
 * "Plana ekle": the real record through the template the suggestion names (planned, like a tile from "+ Ekle"). The
 * suggestion is marked added and the record put in the same transaction, after checking it isn't added already, so
 * a double tap or a second tab never adds it twice. A vehicle for days one already covers is refused (vehicles.ts,
 * the chat's guard), and a record the payload can't make whole opens the add sheet instead.
 */
export async function addSuggested(tripId: string, s: Suggestion, id: string = newId()): Promise<SuggestedOutcome> {
  const now = Date.now();
  const made = suggestedAdd(s, tripId, id, now);
  if (!made) return null;
  if (made.kind === "sheet") return made;
  const item = made.item;
  const d = await db();
  // One transaction: is it added already (by a double tap, another tab), does a vehicle cover those days, then the
  // mark and the record together. Nothing else can slip in between.
  const tx = d.transaction(["trips", "items"], "readwrite");
  const trip = await tx.objectStore("trips").get(tripId);
  if (!trip || trip.suggestions?.some((x) => x.key === s.key && x.state === "added")) {
    await tx.done;
    return { kind: "already" };
  }
  if (vehicleOf(item)) {
    const items = (await tx.objectStore("items").index("tripId").getAll(tripId)).map(withEdits);
    const check = checkVehicle({ added: item, items, same: null, replaces: [], userText: "", previousReply: null });
    if (check.refusal) {
      await tx.done;
      const there = items.filter((i) => i.status !== "dismissed" && vehicleOf(i) && overlaps(periodOf(i), periodOf(item))).map((i) => i.name);
      return {
        kind: "refused",
        text: L(`Bu günler için zaten bir araç var (${there.join(", ")}); ikincisi eklenmedi.`, `A vehicle already covers these days (${there.join(", ")}); a second one wasn't added.`),
      };
    }
  }
  const was = trip.suggestions?.find((x) => x.key === s.key) ?? s;
  await tx.objectStore("trips").put({ ...trip, suggestions: withState(trip.suggestions, was, "added", now), updatedAt: now });
  await tx.objectStore("items").put(item);
  await tx.done;
  await addEvent(tripId, L(`${item.name} plana eklendi`, `${item.name} added to the plan`));
  notifyChanged();
  return { kind: "added", undo: { kind: "suggestion", tripId, suggestion: s, state: "added", item } };
}

/** The add sheet opened for a suggestion got its record (a tile picked): the suggestion is done. */
export async function markSuggestionAdded(tripId: string, s: Suggestion): Promise<void> {
  await setSuggestion(tripId, s, "added");
}

/** "Gerek yok": the suggestion is gone for good (Geçmiş's "Geri getir" brings it back), with the 8-second "Geri al". */
export async function dismissSuggestion(tripId: string, s: Suggestion): Promise<Undoable> {
  await setSuggestion(tripId, s, "dismissed");
  await addEvent(tripId, L(`${s.title}: gerek yok denildi, gizlendi`, `${s.title}: marked not needed, hidden`));
  return { kind: "suggestion", tripId, suggestion: s, state: "dismissed", item: null };
}

/** Geçmiş's "Geri getir" on a suggestion said not needed: it's open again (a rule's shows while the rule holds). */
export async function restoreSuggestion(tripId: string, key: string, label: string): Promise<void> {
  const d = await db();
  const s = (await d.get("trips", tripId))?.suggestions?.find((x) => x.key === key);
  if (!s) return;
  await setSuggestion(tripId, s, "open");
  await addEvent(tripId, L(`${label} geri getirildi`, `${label} brought back`));
}

/** "Geri al": a deletion restored, a one-tap add taken away again, hidden nights brought back. */
export async function undo(u: Undoable): Promise<void> {
  if (u.kind === "removed") return restoreItem(u.removed);
  if (u.kind === "doc") return restoreDoc(u.doc);
  if (u.kind === "suggestion") {
    // The record "Plana ekle" made goes again (nothing of the traveller's: no trash entry), and the card is back.
    if (u.item) await deleteItem(u.item, L(`${u.item.name} eklenmedi (geri alındı)`, `${u.item.name} not added (undone)`), { trash: false });
    await setSuggestion(u.tripId, u.suggestion, "open");
    // Its "gerek yok" line in Geçmiş is closed by this one (history.ts marks it "geri alındı").
    if (u.state === "dismissed") await addEvent(u.tripId, L(`${u.suggestion.title} geri getirildi`, `${u.suggestion.title} brought back`));
    return;
  }
  if (u.kind === "added") {
    // Taking back a one-tap add loses nothing of the traveller's: no trash entry for it.
    await deleteItem(u.item, L(`${u.item.name} eklenmedi (geri alındı)`, `${u.item.name} not added (undone)`), { trash: false });
    return;
  }
  if (u.kind === "trip") {
    // Through its Geçmiş line when it has one, so the line says "geri alındı" too.
    // Changed again within the toast's seconds: ChangedSince ("Bu ayar sonra yine değişti") goes to the toast.
    if (u.change.eventId) {
      await undoEvent(u.change.eventId);
      return;
    }
    await updateTrip(u.change.tripId, (t) => restoreFields(t, u.change));
    await addEvent(u.change.tripId, L(`Geri alındı: ${u.change.label}`, `Undone: ${u.change.label}`));
    notifyChanged();
    return;
  }
  if (u.kind === "lang") {
    const line = await latestLangLine(u.tripId);
    if (line) await undoEvent(line);
    else await saveLang(u.prev);
    // The board's words are read once per load (main.tsx): the other language needs the page again.
    if (typeof location !== "undefined") location.reload();
    return;
  }
  return setHidden(u.tripId, u.key, false, u.label);
}

/**
 * Who goes, changed in the hero's popover ("İsim ekle", ×, the count): written at once with a line in Geçmiş that
 * can take it back. A change that changes nothing (a name already there) writes nothing, not even the time.
 */
export async function changeTravellers(tripId: string, change: TravellersChange, event: string): Promise<boolean> {
  const tx = (await db()).transaction("trips", "readwrite");
  const trip = await tx.store.get(tripId);
  const next = trip ? withTravellers(trip.travellers, change) : null;
  if (!trip || !next || typeof next === "string" || stableJson(next.travellers) === stableJson(trip.travellers ?? { names: [] })) {
    await tx.done;
    return false;
  }
  await tx.store.put({ ...trip, travellers: next.travellers, updatedAt: Date.now() });
  await tx.done;
  await addEvent(tripId, event, { undo: { kind: "fields", fields: ["travellers"], before: { travellers: trip.travellers ?? { names: [] } }, after: { travellers: next.travellers } } });
  notifyChanged();
  return true;
}
