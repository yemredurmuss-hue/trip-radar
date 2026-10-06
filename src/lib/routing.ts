// The traveller's side of the place check (placeCheck.ts): answering a held capture's question ("Bu geziye yine
// de ekle" / "Yeni gezi: Bali" / "Ekleme"), and taking back a capture sent to the trip of its place ("Geri al").
// Used by a trip's chat and by the popup.
import { addEvent, db, listTrips, newId, notifyChanged } from "./db";
import { moveDocsToTrip } from "./docs";
import { datesIn, isWayThere } from "./placeCheck";
import { announceRemoved, deleteItem } from "./removal";
import { L } from "./i18n";
import { destinationImage, savedLine } from "./process";
import { uniqueTitle } from "./trips";
import type { ChatMessage, HeldAnswer, Item, Trip } from "./types";

/** Thrown when the record moved or went since: nothing is written. */
export class RoutingChanged extends Error {}

const NO_DATES: Item["dates"] = { start: null, end: null, source: "none" };

/**
 * here: into the trip that asked, for good (placeOk: a later save never moves it); a place far from it goes on
 * none of its days unless booked (its dates were the other place's). there: the trip of its place, its dates
 * only if they fall in that trip's. new: a new trip named after its place, dates kept. skip: nothing is added; a
 * record already saved goes to the trash (Geri al, Çöp kutusu). Returns the trip it is in (null for skip, or
 * when it was answered already).
 */
export async function answerHeld(captureId: string, answer: HeldAnswer): Promise<string | null> {
  const d = await db();
  const capture = await d.get("captures", captureId);
  const held = capture?.held;
  if (!capture || !held || held.answer) return null;
  // A record already saved is answered as it is stored now (it stayed on the plan while asked).
  const stored = held.existing ? await d.get("items", held.item.id) : undefined;
  if (held.existing && !stored) throw new RoutingChanged(L("Bu kayıt sonra silindi.", "This record was deleted since."));
  const base = stored ?? held.item;
  let tripId: string | null = null;
  if (answer === "skip") {
    if (stored) announceRemoved(await deleteItem(stored, L(`${stored.name} plandan çıkarıldı (Çöp kutusunda)`, `${stored.name} taken off the plan (in the trash)`)));
  } else {
    const trips = await listTrips();
    const allItems = await d.getAll("items");
    let target: Trip | undefined =
      answer === "here" && held.tripId ? trips.find((t) => t.id === held.tripId) : answer === "there" && held.toTripId ? trips.find((t) => t.id === held.toTripId) : undefined;
    if (!target) {
      const now = Date.now();
      target = {
        id: newId(),
        title: uniqueTitle(held.newTitle, held.item.dates.start, trips),
        confirmedDates: null,
        budget: null,
        heroImage: (await destinationImage(held.item.city ?? held.item.country).catch(() => null)) ?? held.item.imageUrl,
        createdAt: now,
        updatedAt: now,
      };
      await d.put("trips", target);
    }
    // Off-place in this trip: on none of its days, unless booked or the way there (the airport hotel the night
    // before keeps its night when it falls in the trip's dates).
    const offDays = answer === "here" && held.reason === "place" && base.status !== "booked";
    const dates = offDays ? (isWayThere(base) ? datesIn(base, target, allItems) : NO_DATES) : answer === "there" ? datesIn(base, target, allItems) : base.dates;
    const item: Item = { ...base, tripId: target.id, dates, ...(answer === "here" ? { placeOk: true } : {}), updatedAt: Date.now() };
    await d.put("items", item);
    if (base.tripId !== target.id || !stored) {
      await moveDocsToTrip(item.id, target.id);
      await addEvent(target.id, savedLine(item, item.status === "booked", false, capture.sharedBy));
    }
    const current = (await d.get("trips", target.id)) ?? target;
    await d.put("trips", { ...current, heroImage: current.heroImage ?? item.imageUrl, updatedAt: Date.now() });
    tripId = target.id;
  }
  await d.put("captures", { ...capture, itemId: tripId ? held.item.id : null, held: { ...held, answer, answeredAt: Date.now() } });
  const lines = (await d.getAllFromIndex("messages", "tripId", held.tripId ?? "")) as ChatMessage[];
  for (const m of lines) {
    if (m.routing?.kind !== "ask" || m.routing.captureId !== captureId) continue;
    await d.put("messages", { ...m, routing: { ...m.routing, answer, ...(tripId ? { answeredTripId: tripId } : {}) } });
  }
  notifyChanged();
  return tripId;
}

/**
 * One record of a "Bunlar başka bir geziye ait görünüyor" line (strays.ts): move: to the trip of its place (its
 * dates go with it: they are that trip's); keep: it stays, never asked again; remove: off the plan, into the
 * trash (Çöp kutusu brings it back).
 */
export async function answerStray(messageId: string, itemId: string, answer: "move" | "keep" | "remove"): Promise<void> {
  const d = await db();
  const line = await d.get("messages", messageId);
  const routing = line?.routing;
  if (!line || routing?.kind !== "stray") return;
  const entry = routing.entries.find((e) => e.itemId === itemId);
  if (!entry || entry.answer) return;
  const item = await d.get("items", itemId);
  if (!item || item.tripId !== line.tripId) throw new RoutingChanged(L("Bu kayıt sonra değişti ya da silindi.", "This record changed or was deleted since."));
  if (answer === "move") {
    const to = entry.toTripId ? await d.get("trips", entry.toTripId) : undefined;
    if (!to) throw new RoutingChanged(L("O gezi artık yok.", "That trip is gone."));
    await d.put("items", { ...item, tripId: to.id, dates: datesIn(item, to, await d.getAll("items")), updatedAt: Date.now() });
    await moveDocsToTrip(item.id, to.id);
    await addEvent(to.id, L(`${item.name} bu geziye taşındı`, `${item.name} moved to this trip`));
    await addEvent(line.tripId, L(`${item.name} → ${to.title} gezisine taşındı`, `${item.name} moved to ${to.title}`));
  } else if (answer === "keep") {
    await d.put("items", { ...item, placeOk: true, updatedAt: Date.now() });
  } else {
    await deleteItem(item, L(`${item.name} plandan çıkarıldı (Çöp kutusunda)`, `${item.name} taken off the plan (in the trash)`));
  }
  const fresh = (await d.get("messages", messageId)) ?? line;
  if (fresh.routing?.kind === "stray") {
    await d.put("messages", { ...fresh, routing: { ...fresh.routing, entries: fresh.routing.entries.map((e) => (e.itemId === itemId ? { ...e, answer } : e)) } });
  }
  notifyChanged();
}

/**
 * "Geri al" on a capture that went to the trip of its place: it comes into the trip it was handed to after all,
 * for good (placeOk), with the dates its page gave (none when its place is far from this trip's and it isn't
 * booked: never on a day there). Only while it is still where it was sent.
 */
export async function undoMove(messageId: string): Promise<void> {
  const d = await db();
  const line = await d.get("messages", messageId);
  const routing = line?.routing;
  if (!line || routing?.kind !== "moved" || routing.undoneAt || routing.merged) return;
  const item = await d.get("items", routing.itemId);
  const home = await d.get("trips", routing.fromTripId);
  if (!item || item.tripId !== routing.toTripId || !home) {
    throw new RoutingChanged(L("Bu kayıt sonra değişti ya da silindi; geri alınmadı.", "This record changed or was deleted since; it wasn't taken back."));
  }
  // The page's dates come back when they fall in this trip's (review B); a far place that isn't the way there
  // (a Bali tour in the Porto trip) still goes on none of its days.
  const original = { ...item, dates: routing.dates ?? item.dates };
  const fits = datesIn(original, home, await d.getAll("items")).start != null;
  const dates = item.status === "booked" || (fits && (!routing.far || isWayThere(item))) ? original.dates : NO_DATES;
  const back: Item = { ...item, tripId: home.id, dates, placeOk: true, updatedAt: Date.now() };
  await d.put("items", back);
  await moveDocsToTrip(item.id, home.id);
  await addEvent(routing.toTripId, L(`${item.name} bu geziden çıkarıldı: ${home.title} gezisine geri alındı`, `${item.name} left this trip: taken back to ${home.title}`));
  await d.put("messages", { ...line, routing: { ...routing, undoneAt: Date.now() } });
  notifyChanged();
}
