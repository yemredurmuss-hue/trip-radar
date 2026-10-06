// Records saved before the place check (placeCheck.ts) may sit in the wrong trip (a Bali tour in the Portugal
// trip). Once per trip, on this computer, the board looks and asks in the trip's chat: "Bunlar başka bir geziye
// ait görünüyor: Nusa Penida… (Endonezya)", each with [Bali gezisine taşı] [Burada kalsın] [Plandan çıkar].
// Nothing already saved is ever moved by itself. A document read into a far place is asked about the same way.
import { nearCountries } from "./countryCenters";
import { ownCountries } from "./tripCountries";
import { addEvent, db, listTrips, notifyChanged } from "./db";
import { L } from "./i18n";
import { countriesText, placeCodes, titleCodes, tripForPlace, tripStartCodes } from "./placeCheck";
import { loadHome } from "./passport";
import { countryCodeOf, isDemoTrip } from "./trips";
import type { Item, StrayEntry, Trip } from "./types";

/** Booked, corrected, or made by hand: asked about only when its own country code says so, not a guess from its city. */
const byHand = (item: Item) => item.status === "booked" || Boolean(item.userEdits && Object.keys(item.userEdits).length) || item.origin === "chat" || Boolean(item.plannedKind);

/** The trip's own countries from its places (tripCountries.ts): one Bali tour among Portugal's places isn't one. */
const placeCountries = (own: Item[]): Set<string> =>
  ownCountries(own.filter((i) => i.category !== "flight").map((i) => ({ codes: placeCodes(i), stay: i.category === "stay", start: i.dates.start, kept: i.placeOk })));

/**
 * Whether a country is the trip's own: one of its countries or near one (Portugal → Spain, the pairs travelled
 * together), one its title names, where its flights leave from, or home. A distance that can't be measured
 * counts as its own (nothing is asked on a guess). Null: no place known yet.
 */
function homeOf(trip: Trip, own: Item[], homeCountry: string | null): ((code: string) => boolean) | null {
  const places = placeCountries(own);
  const named = titleCodes(trip.title);
  if (!places.size && !named.size) return null;
  const starts = tripStartCodes(trip.id, own);
  return (c: string) =>
    named.has(c) || starts.has(c) || c === homeCountry || [...places].some((p) => nearCountries(c, p) !== false);
}

/**
 * The trip's records whose place is far from the trip's own: its main country (and countries near it, Portugal →
 * Spain), and what its title names. Two Bali records among ten Portugal ones are both strays. Skipped: what was
 * ruled out, what the traveller said stays ("Burada kalsın"), a flight (it starts at home), a record whose place
 * isn't known; a booked or hand-made one only on its own country code.
 */
export function strayItems(trip: Trip, items: Item[], homeCountry: string | null = null): { item: Item; codes: string[] }[] {
  if (isDemoTrip(trip)) return [];
  const own = items.filter((i) => i.tripId === trip.id && i.status !== "dismissed");
  const home = homeOf(trip, own, homeCountry);
  if (!home) return [];
  return own.flatMap((item) => {
    if (item.placeOk || item.category === "flight") return [];
    const codes = byHand(item) ? [countryCodeOf(item.countryCode)].filter((c): c is string => Boolean(c)) : placeCodes(item);
    if (!codes.length || codes.some(home)) return [];
    return [{ item, codes }];
  });
}

/** The chat line's entries: each record, its country in words, and the trip of its place when there is one. */
export function strayEntries(strays: { item: Item; codes: string[] }[], trips: Trip[], items: Item[], tripId: string): StrayEntry[] {
  return strays.map(({ item, codes }) => ({
    itemId: item.id,
    name: item.name,
    country: countriesText(codes.slice(0, 1)),
    toTripId: tripForPlace(codes, trips, items.filter((i) => i.id !== item.id), tripId, item.dates.start, item.dates.end)?.id ?? null,
  }));
}

/** "Bunlar başka bir geziye ait görünüyor: Nusa Penida… (Endonezya), …" */
export function strayText(entries: StrayEntry[]): string {
  const list = entries.map((e) => `${e.name} (${e.country})`).join(", ");
  return entries.length === 1
    ? L(`Bu başka bir geziye ait görünüyor: ${list}`, `This looks like it belongs to another trip: ${list}`)
    : L(`Bunlar başka bir geziye ait görünüyor: ${list}`, `These look like they belong to another trip: ${list}`);
}

/** Posts the line in the trip's chat (when there is anything to ask). */
export async function askAboutStrays(tripId: string, entries: StrayEntry[]): Promise<void> {
  if (entries.length) await addEvent(tripId, strayText(entries), { routing: { kind: "stray", entries } });
}

/**
 * A document read into a new record whose place is far from its trip's (a Bali voucher dropped in the Portugal
 * chat): it stays where it was put, and the chat asks the same question. True when it asked.
 */
export async function askIfFar(tripId: string, item: Item, items: Item[]): Promise<boolean> {
  const trips = await listTrips();
  const trip = trips.find((t) => t.id === tripId);
  const codes = placeCodes(item);
  const home = trip ? homeOf(trip, items.filter((i) => i.tripId === tripId && i.id !== item.id && i.status !== "dismissed"), await loadHome()) : null;
  if (!trip || isDemoTrip(trip) || !home || !codes.length || codes.some(home)) return false;
  await askAboutStrays(tripId, strayEntries([{ item, codes }], trips, items, tripId));
  return true;
}

let running: Promise<number> | null = null;

/** Sets the trip's flag in one transaction, only if no one (another tab) set it first: true when this one did. */
async function claimTrip(tripId: string): Promise<boolean> {
  const d = await db();
  const tx = d.transaction("trips", "readwrite");
  const trip = await tx.store.get(tripId);
  const mine = Boolean(trip && !trip.strayCheckedAt);
  if (trip && mine) await tx.store.put({ ...trip, strayCheckedAt: Date.now() });
  await tx.done;
  return mine;
}

/**
 * Once per trip on this computer (Trip.strayCheckedAt, claimed in IndexedDB before the line is posted, so two
 * open boards never both ask): looks for strays and asks. A sample trip is skipped. Returns how many trips were asked in.
 */
export function checkStraysOnce(): Promise<number> {
  running ??= (async () => {
    try {
      const d = await db();
      const trips = await listTrips();
      const items = await d.getAll("items");
      const homeCountry = await loadHome();
      let asked = 0;
      for (const trip of trips) {
        if (trip.strayCheckedAt || isDemoTrip(trip)) continue;
        if (!(await claimTrip(trip.id))) continue;
        const entries = strayEntries(strayItems(trip, items, homeCountry), trips, items, trip.id);
        await askAboutStrays(trip.id, entries);
        if (entries.length) asked++;
      }
      if (asked) notifyChanged();
      return asked;
    } finally {
      running = null;
    }
  })();
  return running;
}
