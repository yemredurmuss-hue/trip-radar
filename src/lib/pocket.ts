// Gezi cebi (0.44.0, tuval "Benle gezen eklenti" 12 · Plan 3, Emre onayladı): the same small pocket in the toolbar's popup
// and on the page's edge. On top the current trip, then what was added to it last with how each stands (destede,
// okunuyor, okunamadı · tekrar), a × for a wrong one, and the trip's board a press away. What it shows is worked out here
// from the database as it is (no second list kept); the rows are pure and tested.
import { companionName, originOf } from "./companion";
import { db, hasActiveKey, listTrips } from "./db";
import { today } from "./extract";
import { CATEGORY_LABELS, formatDateRange } from "./items";
import { L } from "./i18n";
import { sizedPhoto, THUMB_W } from "./photoCache";
import { retryCapture } from "./process";
import { deleteItem } from "./removal";
import { isDemoTrip, profileTrips } from "./trips";
import { loadCurrent } from "./tripRules";
import { undoSave } from "./saveUndo";
import type { Capture, Category, Item, Trip } from "./types";

export const POCKET_ROWS = 5;
/** A save not yet given a trip (the model picks it) shows in every pocket this long. */
const LOOSE_MS = 24 * 3600_000;

export interface PocketRow {
  /** "c:<capture id>" or "i:<item id>": what × and "tekrar" act on. */
  id: string;
  title: string;
  /** "Konaklama", or the site while it is still being read ("Booking.com"). */
  sub: string;
  photo: string | null;
  state: "in" | "reading" | "failed";
}

export interface Pocket {
  /** count: everything on the trip; decks: each category's own (the tab on a hotel site says the stays). */
  trip: { id: string; title: string; when: string | null; count: number; decks: Partial<Record<Category, number>>; photo: string | null } | null;
  rows: PocketRow[];
  /** Saves waiting for a key to be read (no key connected: they wait on this device). */
  waiting: number;
  key: boolean;
}

export const photoOk = (u: string | null | undefined): u is string => Boolean(u && (/^https:\/\//.test(u) || (/^data:image\//.test(u) && u.length < 60_000)));

/**
 * The pocket's rows for a trip, newest first: its saves still being read or failed (and those not given a trip yet, a
 * day), then its records. A record made by a save shows once, as the record; one waiting for an answer (which trip) is
 * asked on the board and by its notification, not here.
 */
export function pocketRows(tripId: string | null, captures: readonly Capture[], items: readonly Item[], now = Date.now(), max = POCKET_ROWS): PocketRow[] {
  const site = (url: string | null) => companionName(originOf(url ?? "") ?? "") || L("Sayfa", "Page");
  const open = captures
    .filter((c) => c.status !== "done")
    .filter((c) => (c.forTripId ? c.forTripId === tripId : now - c.capturedAt < LOOSE_MS))
    .map((c) => ({
      at: c.capturedAt,
      row: {
        id: `c:${c.id}`,
        title: (c.title ?? "").trim() || site(c.url),
        sub: site(c.url),
        photo: null,
        state: c.status === "error" ? "failed" : "reading",
      } satisfies PocketRow,
    }));
  const own = tripId
    ? items
        .filter((i) => i.tripId === tripId && i.status !== "dismissed")
        .map((i) => ({ at: i.createdAt, row: { id: `i:${i.id}`, title: i.name, sub: CATEGORY_LABELS[i.category] ?? "", photo: photoOk(i.imageUrl) ? i.imageUrl : null, state: "in" } satisfies PocketRow }))
    : [];
  return [...open, ...own].sort((a, b) => b.at - a.at).slice(0, max).map((x) => x.row);
}

/** The trip a pocket shows when the page says none: the current one, else the one saved into last; never a sample, never one over. */
export function pocketTrip(trips: readonly Trip[], items: readonly Item[], current: string | null, now: string): Trip | null {
  const profiles = profileTrips([...trips], [...items]);
  const live = trips.filter((t) => {
    if (isDemoTrip(t)) return false;
    const r = t.confirmedDates ?? profiles.find((p) => p.trip.id === t.id)?.range ?? null;
    return !r || r.end >= now;
  });
  const cur = live.find((t) => t.id === current);
  if (cur) return cur;
  const last = (t: Trip) => Math.max(t.updatedAt, ...items.filter((i) => i.tripId === t.id).map((i) => i.createdAt ?? 0));
  return [...live].sort((a, b) => last(b) - last(a))[0] ?? null;
}

/** How many in each category's deck (what the board's Pano counts). */
export function deckCounts(items: readonly Item[]): Partial<Record<Category, number>> {
  const out: Partial<Record<Category, number>> = {};
  for (const i of items) if (i.status !== "dismissed") out[i.category] = (out[i.category] ?? 0) + 1;
  return out;
}

/** The pocket for that trip (null: the current one, else the last saved into). */
export async function pocketFor(tripId: string | null): Promise<Pocket> {
  const d = await db();
  // (only the saves not read yet: the read ones, with their screenshots, are never loaded for this)
  const open = await Promise.all((["pending", "processing", "error"] as const).map((st) => d.getAllFromIndex("captures", "status", st)));
  const captures = open.flat();
  const [trips, items, key, current] = await Promise.all([listTrips(), d.getAll("items"), hasActiveKey(), loadCurrent()]);
  const trip = (tripId ? trips.find((t) => t.id === tripId && !isDemoTrip(t)) : undefined) ?? pocketTrip(trips, items, current?.tripId ?? null, today());
  const mine = trip ? items.filter((i) => i.tripId === trip.id && i.status !== "dismissed") : [];
  const range = trip ? (trip.confirmedDates ?? profileTrips([trip], items)[0]?.range ?? null) : null;
  const photo = trip ? ([trip.heroImage, ...mine.sort((a, b) => b.createdAt - a.createdAt).map((i) => i.imageUrl)].find(photoOk) ?? null) : null;
  return {
    // (its small pictures at the size they're drawn, 2x: never a hero's 2400 px photo for a 32 px square)
    trip: trip ? { id: trip.id, title: trip.title, when: range ? formatDateRange(range.start, range.end) : null, count: mine.length, decks: deckCounts(mine), photo: photo && sizedPhoto(photo, THUMB_W) } : null,
    rows: pocketRows(trip?.id ?? null, captures, items).map((r) => (r.photo ? { ...r, photo: sizedPhoto(r.photo, THUMB_W) } : r)),
    waiting: key ? 0 : captures.filter((c) => c.status === "pending" || c.status === "processing").length,
    key,
  };
}

/** ×: a save taken back (as "Geri al"), a record into the trash (the board's "Geri al" brings it back). */
export async function pocketRemove(id: string): Promise<boolean> {
  if (id.startsWith("c:")) return undoSave(id.slice(2, 82));
  if (!id.startsWith("i:")) return false;
  const item = await (await db()).get("items", id.slice(2, 82));
  if (!item) return false;
  await deleteItem(item, L(`${item.name} cepten kaldırıldı`, `${item.name} removed from the pocket`));
  return true;
}

/** "okunamadı · tekrar": that save read again. */
export async function pocketRetry(id: string, process: () => void): Promise<boolean> {
  if (!id.startsWith("c:")) return false;
  await retryCapture(id.slice(2, 82));
  process();
  return true;
}
