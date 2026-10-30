// Açılır kart v1.1 (0.47.2, docs/mockups/acilir-kart-v1, Emre onayladı): what the toolbar's popup shows where nothing can
// be added (a new tab, the board): the trips ahead, the selected one big (its photo, how long until it, how ready, Pano's
// count), the others a row each; a press on a row selects that trip. No decision is asked here: decisions are the Plan's
// (Emre: "karar ver o planlamanın işi, pano işleri ile karışmaması gerek"). The words and the order are pure and tested.
import { db, listTrips } from "./db";
import { today as todayIso } from "./extract";
import { L } from "./i18n";
import { formatDateRange, nightsBetween } from "./items";
import { shapeOf } from "./playbooks/shape";
import { photoOk } from "./pocket";
import { tripGlance } from "./tripGlance";
import { currentFor, loadCurrent, type CurrentTrip } from "./tripRules";
import { isDemoTrip, profileTrips } from "./trips";
import type { Item, Trip } from "./types";

/** At most this many trips on the card (the selected one and two more); the rest are "Tüm geziler (N)". */
export const SHELF_MAX = 3;

export interface Countdown {
  text: string;
  /** soon: two weeks or less (purple); on: during the trip (green); far: later. */
  tone: "soon" | "on" | "far";
}

/** The hero's own two shares ("%72 hazır"): planned and booked; fresh, nothing picked yet (the hero says no "%0"). */
export interface Ready {
  plan: number;
  booked: number;
  fresh: boolean;
}

export interface ShelfTrip {
  id: string;
  title: string;
  photo: string | null;
  /** Without a photo, the drawing of how the trip sleeps (a festival's tent, a road trip's van), else the plane. */
  art: string;
  /** "26 Eki – 9 Kas"; null without dates. */
  when: string | null;
  countdown: Countdown | null;
  ready: Ready | null;
  /** Pano's "Biriktirdiklerim". */
  mine: number;
}

export interface Shelf {
  /** The big one first, then the others by their dates. */
  trips: ShelfTrip[];
  /** The first is the selected trip (the chip's, what the next save goes to), not only the nearest. */
  selected: boolean;
  /** Every trip not over, for "Tüm geziler (N)". */
  total: number;
}

/** "2 gün kaldı", "7 hafta kaldı", "9 ay kaldı"; on the trip "Gezidesin · 4. gün / 15". */
export function countdown(range: { start: string; end: string } | null, today: string): Countdown | null {
  if (!range) return null;
  if (today > range.end) return null;
  if (today === range.start) return { text: L("Bugün yola çıkıyorsun", "You leave today"), tone: "on" };
  if (today > range.start) {
    const day = nightsBetween(range.start, today) + 1;
    const of = nightsBetween(range.start, range.end) + 1;
    return { text: L(`Gezidesin · ${day}. gün / ${of}`, `On the trip · day ${day} of ${of}`), tone: "on" };
  }
  const d = nightsBetween(today, range.start);
  const tone = d <= 14 ? "soon" : "far";
  if (d === 1) return { text: L("Yarın yola çıkıyorsun", "You leave tomorrow"), tone };
  if (d <= 30) return { text: L(`${d} gün kaldı`, `${d} days to go`), tone };
  if (d < 60) return { text: L(`${Math.floor(d / 7)} hafta kaldı`, `${Math.floor(d / 7)} weeks to go`), tone };
  return { text: L(`${Math.floor(d / 30)} ay kaldı`, `${Math.floor(d / 30)} months to go`), tone };
}

/**
 * Which trips and in what order: never a sample, never one over. The selected trip first while it holds (picked within a
 * day); else the nearest (one going on now first). The others by their start, those without dates last.
 */
export function shelfOrder(trips: readonly Trip[], items: readonly Item[], cur: CurrentTrip | null, today: string, now = Date.now(), max = SHELF_MAX): { trips: { trip: Trip; range: { start: string; end: string } | null }[]; selected: boolean; total: number } {
  const profiles = profileTrips([...trips], [...items]);
  const live = trips
    .filter((t) => !isDemoTrip(t))
    .map((trip) => ({ trip, range: trip.confirmedDates ?? profiles.find((p) => p.trip.id === trip.id)?.range ?? null }))
    .filter((x) => !x.range || x.range.end >= today)
    .sort((a, b) => Number(!a.range) - Number(!b.range) || (a.range && b.range ? (a.range.start < b.range.start ? -1 : a.range.start > b.range.start ? 1 : 0) : 0) || b.trip.updatedAt - a.trip.updatedAt);
  const picked = currentFor(cur, null, [...trips], [...items], today, now);
  const first = live.find((x) => x.trip.id === picked?.id) ?? null;
  const ordered = first ? [first, ...live.filter((x) => x !== first)] : live;
  return { trips: ordered.slice(0, max), selected: Boolean(first), total: live.length };
}

/** A trip's drawing by where it sleeps (the plan's own: a camp is a tent, never a hotel). */
export function artOf(trip: Pick<Trip, "intent" | "startGuide">): string {
  const sleep = shapeOf(trip).sleep;
  return sleep === "camp" ? "illus/cadir.svg" : sleep === "vehicle" ? "illus/karavan.png" : sleep === "boat" ? "illus/vapur.png" : "illus/ucus.png";
}

const READY_KEY = "heroReady";

/** The hero writes its shares as it draws them, so the popup says the same number the trip's page does. */
export async function saveReady(tripId: string, ready: Ready): Promise<void> {
  try {
    if (!globalThis.chrome?.storage?.local) return;
    const all = ((await chrome.storage.local.get(READY_KEY))[READY_KEY] ?? {}) as Record<string, Ready>;
    const was = all[tripId];
    if (was && was.plan === ready.plan && was.booked === ready.booked && was.fresh === ready.fresh) return;
    await chrome.storage.local.set({ [READY_KEY]: { ...all, [tripId]: ready } });
  } catch {
    // (nothing kept: the popup works it out itself)
  }
}

async function loadReady(): Promise<Record<string, Ready>> {
  try {
    return ((await chrome.storage.local.get(READY_KEY))[READY_KEY] ?? {}) as Record<string, Ready>;
  } catch {
    return {};
  }
}

/** The popup's shelf, from the database as it is. */
/** `all`: every trip not over (the popup's "Tümü (N)" opens in place, tek Kaydet v2), else the first three. */
export async function tripShelf(all = false): Promise<Shelf> {
  const d = await db();
  const today = todayIso();
  const [trips, items, cur, kept] = await Promise.all([listTrips(), d.getAll("items"), loadCurrent(), loadReady()]);
  const order = shelfOrder(trips, items, cur, today, Date.now(), all ? Infinity : SHELF_MAX);
  return {
    selected: order.selected,
    total: order.total,
    trips: order.trips.map(({ trip, range }) => {
      const own = items.filter((i) => i.tripId === trip.id);
      const glance = tripGlance(trip, own, today);
      const photo = [trip.heroImage, ...own.filter((i) => i.status !== "dismissed").sort((a, b) => b.createdAt - a.createdAt).map((i) => i.imageUrl)].find(photoOk) ?? null;
      return { id: trip.id, title: trip.title, photo, art: artOf(trip), when: range ? formatDateRange(range.start, range.end) : null, countdown: countdown(range, today), ready: kept[trip.id] ?? glance.ready, mine: glance.mine };
    }),
  };
}
