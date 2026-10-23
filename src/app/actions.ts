// Small write actions shared by the board's views.
import { addEvent, db, listItems, newId, notifyChanged } from "../lib/db";
import { restoreDoc } from "../lib/docs";
import { L, saveLang } from "../lib/i18n";
import { announceRemoved, deleteItem, restoreItem, type Removed } from "../lib/removal";
import { namesChanged, ownersAfter, restoreFields, withTravellers, type TravellersChange } from "../lib/tripSettings";
import { ownerWords } from "../lib/whose";
import { cleanOwners, saveOwners, writeOwners } from "../lib/whoseStore";
import { latestLangLine, undoEvent } from "../lib/eventUndo";
import { formatPrice } from "../lib/items";
import { stableJson } from "../lib/share/settings";
import { suggestedAdd, withState } from "../lib/suggestions";
import type { InsertAt, TemplateId } from "../lib/templates";
import { withEdits } from "../lib/userEdits";
import { checkVehicle, overlaps, periodOf, vehicleOf } from "../lib/vehicles";
import { nightsKey } from "../lib/timeline";
import { withVisaDone } from "../lib/visa";
import { saveSchengenVisa } from "../lib/passport";
import { offerItem, type Need, type Offer } from "../lib/offerSource";
import type { DateRange } from "../lib/plan";
import { plannedItem, type PlannedInput } from "../lib/planned";
import { narrowStart } from "../lib/startCreate";
import { stayPlaceholdersTaken } from "../lib/intents";
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
  // A cancelled booking brought back is a booking again, not a cancelled one (lifecycle.ts reads cancelledAt), and
  // what was said about its refund goes with the cancellation.
  const { dismissedFrom: _from, cancelledAt: _cancelled, cancelPending: _pending, refundNote: _refund, ...fresh } = found;
  await d.put("items", { ...fresh, status: back, statusAt: Date.now(), updatedAt: Date.now() });
  await addEvent(item.tripId, statusEvent(item.name, back));
  // A chosen stay given up (back to the options, ruled out): the start's place set aside for it comes back.
  if (found.status === "chosen" && back !== "chosen" && back !== "booked") await restoreReplaced(item);
  notifyChanged();
}

/**
 * "Aldım" (onay paketi 2026-10-22): bought, with the code typed in its box if one was (a PNR, a booking number); its file,
 * when one is dropped, is added and read after (DocAccess), onto the booking.
 */
export async function markBooked(item: Item, ref: string | null = null): Promise<void> {
  const code = ref?.replace(/\s+/g, " ").trim() || null;
  if (code) {
    const d = await db();
    const found = (await d.get("items", item.id)) ?? item;
    await d.put("items", { ...found, bookingRef: /^[a-z0-9]+$/i.test(code) ? code.toUpperCase() : code, updatedAt: Date.now() });
  }
  await setItemStatus(item, "booked");
}

/** The places set aside for `item` (chooseItem: "Yerine X geldi"), brought back as they were. */
async function restoreReplaced(item: Item): Promise<void> {
  const d = await db();
  for (const ph of await listItems(item.tripId)) {
    if (ph.replacedBy !== item.id || ph.status !== "dismissed") continue;
    const { replacedBy: _by, dismissedFrom, ...rest } = ph;
    await d.put("items", { ...rest, status: dismissedFrom ?? "chosen", statusAt: Date.now(), updatedAt: Date.now() });
    await addEvent(item.tripId, L(`${ph.name} geri geldi`, `${ph.name} is back`));
  }
}

/**
 * "İptal ettim" (lifecycle.ts İptal edildi): the booking is kept, ruled out with the day it was cancelled and what was
 * said about the refund, as the chat's cancel does (assistant.ts): it leaves the plan, its need is to find again,
 * and it waits under Gizlenenler. Returns what "Geri al" takes back.
 */
export async function cancelBooking(item: Item, refundNote: string | null = null): Promise<Undoable> {
  const d = await db();
  const found = (await d.get("items", item.id)) ?? item;
  const now = Date.now();
  const cancelled: Item = { ...found, status: "dismissed", dismissedFrom: "booked", cancelledAt: now, refundNote: refundNote?.trim() || null, statusAt: now, updatedAt: now };
  await d.put("items", cancelled);
  await addEvent(item.tripId, L(`${item.name} iptal edildi`, `${item.name} cancelled`));
  notifyChanged();
  return { kind: "cancelled", item: cancelled };
}

/** P3 (F30): the switched booking cancelled on its site too ("İptal ettim"), or taken back to "still to cancel". */
export async function setCancelDone(item: Item, done: boolean): Promise<void> {
  const d = await db();
  const found = (await d.get("items", item.id)) ?? item;
  const { cancelPending: _was, ...rest } = found;
  await d.put("items", done ? { ...rest, updatedAt: Date.now() } : { ...rest, cancelPending: true, updatedAt: Date.now() });
  if (done) await addEvent(item.tripId, L(`${item.name} rezervasyonu sitesinde de iptal edildi`, `${item.name} booking cancelled on its site too`));
  notifyChanged();
}

/** The Pano's heart (v11): who liked it, by name ("me" for the board's owner without one); no Geçmiş line, likes are light. */
export async function toggleLike(item: Item, who: string): Promise<void> {
  const d = await db();
  const found = (await d.get("items", item.id)) ?? item;
  const set = new Set(found.likedBy ?? []);
  if (set.has(who)) set.delete(who);
  else set.add(who);
  const { likedBy: _old, ...rest } = found;
  await d.put("items", set.size ? { ...rest, likedBy: [...set], updatedAt: Date.now() } : { ...rest, updatedAt: Date.now() });
  notifyChanged();
}

/** A need's card said not needed (v11 phase 2b): every option of it, one "Geri al" for all. */
export async function setNeedNotNeeded(items: Item[]): Promise<Undoable> {
  const [first, ...rest] = items;
  for (const other of rest) await setNotNeeded(other);
  const u = await setNotNeeded(first);
  return u.kind === "notNeeded" ? { ...u, others: rest } : u;
}

/**
 * Belgeler ve internet's visa line (v11): the visa sorted ("Var") or not yet ("Yok"); Hazırlık's visa chore (`key`) is the
 * same mark. A Schengen visa's answer (`schengen`) is kept for every trip too (P7: asked once).
 */
export async function setVisaDone(tripId: string, done: boolean, key?: string, schengen = false): Promise<void> {
  if (schengen) await saveSchengenVisa(done).catch(() => undefined);
  await updateTrip(tripId, (t) => withVisaDone(t, done, key));
  await addEvent(tripId, done ? L("Vize tamam olarak işaretlendi", "Visa marked as sorted") : L("Vize henüz yok olarak geri alındı", "Visa marked as not yet sorted"));
  notifyChanged();
}

/**
 * D16: a budget set in the hero's budget window (a trip that had none): the amount in the money the board shows the trip
 * in. A line in Geçmiş, and its "Geri al" takes it off again (the fields' undo, as the chat's update_trip has).
 */
export async function setBudget(tripId: string, amount: number, currency: string): Promise<void> {
  let before: Trip["budget"] | undefined;
  const budget = { amount, currency };
  await updateTrip(tripId, (t) => {
    before = t.budget;
    return { ...t, budget };
  });
  if (before === undefined) return;
  await addEvent(tripId, L(`Bütçe: ${formatPrice(amount, currency)}`, `Budget: ${formatPrice(amount, currency)}`), {
    undo: { kind: "fields", fields: ["budget"], before: { budget: before }, after: { budget } },
  });
  notifyChanged();
}

/**
 * A card's × (v11): "Gerek yok". Not deleted: ruled out with what it was (an option, a plan), so it waits under its
 * section's Gizlenenler and "Geri al" / "Geri getir" puts it back as it stood (setItemStatus reads dismissedFrom).
 * A booking never comes here: its × asks "İptal ettin mi?" first (cards/stageMenu.tsx).
 */
export async function setNotNeeded(item: Item): Promise<Undoable> {
  const d = await db();
  const found = (await d.get("items", item.id)) ?? item;
  const now = Date.now();
  const from = found.status === "dismissed" ? (found.dismissedFrom ?? "saved") : found.status;
  await d.put("items", { ...found, status: "dismissed", dismissedFrom: from, statusAt: now, updatedAt: now });
  await addEvent(item.tripId, L(`${item.name}: gerek yok denildi, gizlendi`, `${item.name}: not needed, hidden`));
  notifyChanged();
  return { kind: "notNeeded", item: found };
}

/**
 * A card's × then "Ben hallettim" (v30): not needed here because the traveller arranged it themselves (a friend picks them up,
 * a ticket bought elsewhere). It stays on the plan, set aside like an idea (noBooking: nothing left to do, out of the booked
 * percentage) with its own words ("Ayarlandı · sen hallettin"). A plan not chosen yet is chosen first: a plan you arranged is in it.
 * `made`: the record was made for it (arrangeSuggested). Taken back, a record made so goes again (takeBackMade).
 */
export async function setArranged(item: Item, arranged: boolean, made?: Item["arrangedMade"]): Promise<void> {
  const d = await db();
  const found = (await d.get("items", item.id)) ?? item;
  const now = Date.now();
  if (arranged) {
    const mark = made ? { arrangedMade: made } : {};
    await d.put("items", { ...found, status: found.status === "booked" ? "booked" : "chosen", noBooking: now, arranged: true, ...mark, statusAt: now, updatedAt: now });
    await addEvent(item.tripId, L(`${item.name}: sen hallettin, plana ayarlandı olarak girdi`, `${item.name}: you arranged it, in the plan as arranged`));
  } else if (found.arrangedMade) {
    await takeBackMade(found);
    return;
  } else {
    const { noBooking: _n, arranged: _a, ...rest } = found;
    await d.put("items", { ...rest, updatedAt: now });
    await addEvent(item.tripId, L(`${item.name}: ayarlandı işareti geri alındı`, `${item.name}: arranged mark taken back`));
  }
  notifyChanged();
}

/**
 * "Ayarlandı: geri al" on a record "Ben hallettim" made: it goes again, so the box is what it was (our pick, still to find)
 * and nothing the traveller never chose stays "Seçildi"; a suggestion it came from is open again. Its files, if any were
 * added since, wait in the trash with it.
 */
async function takeBackMade(made: Item): Promise<void> {
  const d = await db();
  const files = await d.getAllFromIndex("docs", "itemId", made.id);
  await deleteItem(made, L(`${made.name}: ayarlandı işareti geri alındı`, `${made.name}: arranged mark taken back`), { trash: files.length > 0 });
  const key = made.arrangedMade?.suggestion;
  const s = key ? (await d.get("trips", made.tripId))?.suggestions?.find((x) => x.key === key) : null;
  if (s) await setSuggestion(made.tripId, s, "open");
}

/**
 * "Ben hallettim" on a need that has no record of its own (a need with saved options, empty nights): a record of the
 * need's kind is made and set aside as arranged ("Ayarlandı · sen hallettin"); the saved options stay under it.
 * `like` gives the kind, the need and the nights; none of its page, price or photo is copied.
 */
export async function addArrangedLike(like: Item, name: string): Promise<void> {
  const now = Date.now();
  const made: Item = {
    ...like,
    id: newId(),
    captureIds: [],
    key: null,
    name,
    provider: null,
    summary: "",
    optionDetail: null,
    url: null,
    imageUrl: null,
    price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now },
    priceHistory: [],
    cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" },
    flight: like.flight ? { from: like.flight.from, to: like.flight.to, departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } : null,
    highlights: [],
    concerns: [],
    reviewSummary: null,
    missing: [],
    status: "chosen",
    statusNote: null,
    statusAt: now,
    addedBy: undefined,
    likedBy: undefined,
    origin: undefined,
    noBooking: now,
    arranged: true,
    arrangedMade: { suggestion: null },
    createdAt: now,
    updatedAt: now,
  };
  await (await db()).put("items", made);
  await addEvent(like.tripId, L(`${name}: sen hallettin, plana ayarlandı olarak girdi`, `${name}: you arranged it, in the plan as arranged`));
  notifyChanged();
}

/** "Ben hallettim" on an empty card with no record (empty nights, a missing flight): the plan it stands for is made and set aside as arranged. */
export async function addArrangedPlanned(tripId: string, input: PlannedInput, name?: string): Promise<void> {
  const now = Date.now();
  const made = plannedItem(input, tripId, newId(), now);
  const named = name ? { ...made, name } : made;
  await (await db()).put("items", { ...named, noBooking: now, arranged: true, arrangedMade: { suggestion: null }, statusAt: now });
  await addEvent(tripId, L(`${named.name}: sen hallettin, plana ayarlandı olarak girdi`, `${named.name}: you arranged it, in the plan as arranged`));
  notifyChanged();
}

/**
 * "Ben hallettim" on an eSIM or insurance suggestion: the record is added (as "Plana koy" does), then set aside as arranged,
 * marked as made here (its "Ayarlandı: geri al" takes it away and opens the suggestion again).
 */
export async function arrangeSuggested(tripId: string, s: Suggestion): Promise<void> {
  const out = await addSuggested(tripId, s);
  if (out?.kind === "added" && out.undo.kind === "suggestion" && out.undo.item) await setArranged(out.undo.item, true, { suggestion: s.key });
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
      // What was set aside for the one given up is set aside for this one now.
      for (const ph of await listItems(item.tripId)) if (ph.replacedBy === other.id && ph.status === "dismissed") await d.put("items", { ...ph, replacedBy: item.id });
    }
  }
  await setItemStatus(item, "chosen");
  // The start's place for most of these nights is taken (intents.stayPlaceholdersTaken): set aside under Gizlenenler,
  // "Geri getir" brings it back; no second card beside the choice.
  const trip = item.category === "stay" ? await d.get("trips", item.tripId) : undefined;
  if (!trip) return;
  for (const ph of stayPlaceholdersTaken(item, await listItems(item.tripId), trip)) {
    const now = Date.now();
    await d.put("items", { ...ph, status: "dismissed", dismissedFrom: ph.status, replacedBy: item.id, statusAt: now, updatedAt: now });
    await addEvent(item.tripId, L(`${ph.name}: yerine ${item.name} geldi`, `${ph.name}: replaced by ${item.name}`));
  }
  notifyChanged();
}

/**
 * "Bununla değiştir" said yes to (replaceBooking.ts): the booking counts as cancelled, kept the way "İptal ettim" keeps it
 * (ruled out with the day, under Gizlenenler, "Geri getir" books it again), and `next` is chosen in its place. One history
 * line says both.
 */
export async function replaceBooking(next: Item, booked: Item, alternatives: Item[]): Promise<void> {
  const d = await db();
  const found = (await d.get("items", booked.id)) ?? booked;
  if (found.status === "booked") {
    const now = Date.now();
    // P3 (F30): the booking on its site is still open; Hazırlık asks to cancel it there until "İptal ettim".
    await d.put("items", { ...found, status: "dismissed", dismissedFrom: "booked", cancelledAt: now, cancelPending: true, refundNote: null, statusAt: now, updatedAt: now });
    await addEvent(booked.tripId, L(`${next.name} seçildi; ${booked.name} rezervasyonunu sitesinde iptal etmen gerek`, `${next.name} chosen; cancel the ${booked.name} booking on its site`));
  }
  await chooseItem(next, alternatives.filter((i) => i.id !== booked.id));
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

/**
 * A record's photo found later (a tour the chat put on the plan, the source's offer of the same tour): kept on the
 * record so the Plan, the Pano and its details show it. Never over a photo it has; no event (nothing the traveller did).
 */
export async function setItemPhoto(itemId: string, url: string): Promise<void> {
  const d = await db();
  const fresh = await d.get("items", itemId);
  if (!fresh || fresh.imageUrl) return;
  await d.put("items", { ...fresh, imageUrl: url, updatedAt: Date.now() });
  notifyChanged();
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

/** An offer from a connected data source under an empty card: "Seçeneklere ekle" saves it as one of the need's options. */
export async function addOffer(tripId: string, offer: Offer, need: Need): Promise<Item> {
  const item: Item = { ...offerItem(offer, need, tripId, newId(), Date.now()), forNeed: need.key };
  await (await db()).put("items", item);
  // An offer for one city of the country the start was made for (SSH for "Mısır"): the start's places take that city.
  await narrowStart(tripId);
  await addEvent(tripId, L(`${item.name} seçeneklere eklendi`, `${item.name} added to the options`));
  notifyChanged();
  return item;
}

/** A record written back whole (0.40.3: the van's night a hotel took the place of), said in the trip's history. */
export async function putItem(item: Item, said: string): Promise<void> {
  await (await db()).put("items", { ...item, updatedAt: Date.now() });
  await addEvent(item.tripId, said);
  notifyChanged();
}

/**
 * "Seç" on a pick for a box the start only made room for (its placeholder, intentFrame.placeholderOf): the placeholder
 * becomes the offer in place, a saved option to choose next (0.38.5: the box changes, no second card beside it).
 */
export async function fillOffer(placeholder: Item, offer: Offer, need: Need): Promise<Item> {
  const item: Item = { ...offerItem(offer, need, placeholder.tripId, placeholder.id, Date.now()), createdAt: placeholder.createdAt, forNeed: need.key };
  await (await db()).put("items", item);
  await addEvent(item.tripId, L(`${item.name} seçeneklere eklendi`, `${item.name} added to the options`));
  notifyChanged();
  return item;
}

/**
 * "Ekle" on an offer the chat found (find_offers): the same option the row's "Ekle" saves, and the reply remembers
 * it ("Eklendi"), so a second tap or the chat opened again never adds it twice. Null when it was added already.
 */
export async function addChatOffer(messageId: string, offer: Offer, need: Need): Promise<Item | null> {
  const d = await db();
  const tx = d.transaction("messages", "readwrite");
  const m = await tx.store.get(messageId);
  if (!m?.offers || m.offers.added?.includes(offer.id)) {
    await tx.done;
    return null;
  }
  await tx.store.put({ ...m, offers: { ...m.offers, added: [...(m.offers.added ?? []), offer.id] } });
  await tx.done;
  return addOffer(m.tripId, offer, need);
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
  // Back from "İptal ettim": a booking again (setItemStatus reads dismissedFrom and drops the cancellation).
  if (u.kind === "cancelled") return setItemStatus(u.item, "saved");
  // Back from a card's "Gerek yok": as it stood (setItemStatus reads dismissedFrom: a plan is planned again).
  if (u.kind === "notNeeded") {
    if (u.nights) await setHidden(u.nights.tripId, u.nights.key, false, u.nights.label);
    for (const other of u.others ?? []) await setItemStatus(other, "saved");
    return setItemStatus(u.item, "saved");
  }
  // Back from "Seç" beside the plan: the one chosen is an option again, the one before it chosen again.
  // (chooseItem undoes it whole: the one picked back to the options, the start's places it set aside handed back to the one
  // before; with none before, setItemStatus brings those places back.)
  if (u.kind === "picked") {
    if (u.prev) return chooseItem(u.prev, [u.item]);
    return setItemStatus(u.item, "saved");
  }
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
 * A name taken off leaves the plans that were theirs (kişiye özel rezervasyon); one left with nobody is everyone's
 * again, said in its own line. The same "Geri al" puts those back too.
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
  const touched = ownersAfter(await listItems(tripId), namesChanged(trip.travellers, change));
  const owners = await writeOwners(touched.map((t) => ({ id: t.item.id, owners: t.after })));
  await addEvent(tripId, event, {
    undo: { kind: "fields", fields: ["travellers"], before: { travellers: trip.travellers ?? { names: [] } }, after: { travellers: next.travellers }, ...(owners.length ? { owners } : {}) },
  });
  const everyones = touched.filter((t) => !t.after && owners.some((o) => o.id === t.item.id)).map((t) => t.item.name);
  if (everyones.length) await addEvent(tripId, L(`${everyones.join(", ")}: artık herkesin`, `${everyones.join(", ")}: everyone's now`));
  notifyChanged();
  return true;
}

/**
 * "Kimin için?" (a card's •••) and the chat's set_owner: whose a plan is, by the trip's names (null or none:
 * everyone's), with a line in Geçmiş and the board's "Geri al" (whoseStore.saveOwners). False when nothing changed.
 */
export async function setOwner(itemId: string, names: string[] | null): Promise<boolean> {
  const item = await (await db()).get("items", itemId);
  if (!item) return false;
  const owners = cleanOwners(names);
  const words = ownerWords(item, owners);
  return Boolean(await saveOwners(item.tripId, [{ id: itemId, owners }], { event: words, label: words }));
}
