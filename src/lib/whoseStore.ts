// Kişiye özel rezervasyon, the writing side (whose.ts is the pure one): who "me" is on this computer, and a plan's
// owners written with a line in Geçmiş and the board's "Geri al" (the line's undo puts the owners back, only while
// they're still as this change left them: eventUndo.ts).
import { addEvent, db, notifyChanged } from "./db";
import { getShareConfig, getSyncState } from "./share/store";
import { uniqueNames } from "./tripSettings";
import { announceTripChange } from "./tripUndo";
import type { WhoCtx } from "./whose";
import type { EventUndo, Item, OwnerChange, Trip } from "./types";

/** Me on this computer: the profile's (sharing) name, and the shared trip's people. Never throws (no storage: no name). */
export async function loadWho(trip: Pick<Trip, "id" | "shareId">): Promise<Exclude<WhoCtx, string | null | undefined>> {
  let me: string | null = null;
  let members: string[] = [];
  try {
    me = (await getShareConfig()).name?.trim() || null;
  } catch {
    // no storage here (a test, a page without the extension): no name
  }
  if (trip.shareId) {
    try {
      members = (await getSyncState(trip.id))?.members ?? [];
    } catch {
      members = [];
    }
  }
  return { me, members, shared: Boolean(trip.shareId) };
}

/** Owners as stored: the names once each, none for everyone (never an empty list). */
export const cleanOwners = (names: readonly unknown[] | null | undefined): string[] | null => {
  const list = uniqueNames((names ?? []).map((n) => (typeof n === "string" ? n : null)));
  return list.length ? list : null;
};

/** A record with these owners (null: everyone's, the field goes). */
export function withOwners(item: Item, owners: string[] | null, now = Date.now()): Item {
  const { forWho: _was, ...rest } = item;
  return owners?.length ? { ...item, forWho: owners, updatedAt: now } : { ...rest, updatedAt: now };
}

const sameOwners = (a: string[] | null | undefined, b: string[] | null | undefined) => JSON.stringify(a?.length ? a : null) === JSON.stringify(b?.length ? b : null);

/**
 * Writes the records' new owners (as stored right now) and returns what changed, before → after, for the line's
 * undo. A record gone or already so is left out.
 */
export async function writeOwners(changes: { id: string; owners: string[] | null }[]): Promise<OwnerChange[]> {
  if (!changes.length) return [];
  const tx = (await db()).transaction("items", "readwrite");
  const done: OwnerChange[] = [];
  for (const c of changes) {
    const record = await tx.store.get(c.id);
    if (!record || sameOwners(record.forWho, c.owners)) continue;
    await tx.store.put(withOwners(record, c.owners));
    done.push({ id: c.id, before: record.forWho?.length ? record.forWho : null, after: c.owners?.length ? c.owners : null });
  }
  await tx.done;
  if (done.length) notifyChanged();
  return done;
}

/**
 * Plans' owners set with one line in Geçmiş ("Ryanair: Sabine'in bileti") that "Geri al" can take back, and the
 * board's toast for it. Nothing changed: no line, null.
 */
export async function saveOwners(
  tripId: string,
  changes: { id: string; owners: string[] | null }[],
  words: { event: string; label: string },
  /** Records the same change made (a person's flight home): the same "Geri al" takes them away. */
  made: string[] = [],
): Promise<{ changed: OwnerChange[]; eventId: string } | null> {
  const changed = await writeOwners(changes);
  if (!changed.length && !made.length) return null;
  const undo: EventUndo = { kind: "fields", fields: [], before: {}, after: {}, ...(changed.length ? { owners: changed } : {}), ...(made.length ? { made } : {}) };
  const eventId = await addEvent(tripId, words.event, { undo });
  announceTripChange({ tripId, fields: [], before: {}, eventId, label: words.label });
  notifyChanged();
  return { changed, eventId };
}
