// Records saved before the place check (placeCheck.ts) may sit in the wrong trip (a Bali tour in the Portugal
// trip). Once per trip, on this computer, the board looks and asks in the trip's chat: "Bunlar başka bir geziye
// ait görünüyor: Nusa Penida… (Endonezya)", each with [Bali gezisine taşı] [Burada kalsın] [Plandan çıkar].
// Nothing already saved is ever moved by itself. A document read into a far place is asked about the same way.
import { nearCountries } from "./countryCenters";
import { addEvent, db, listTrips, notifyChanged } from "./db";
import { L } from "./i18n";
import { countriesText, placeCodes, titleCodes, tripForPlace } from "./placeCheck";
import { countryCodeOf, isDemoTrip } from "./trips";
import type { Item, StrayEntry, Trip } from "./types";

/** Booked, corrected, or made by hand: asked about only when its own country code says so, not a guess from its city. */
const byHand = (item: Item) => item.status === "booked" || Boolean(item.userEdits && Object.keys(item.userEdits).length) || item.origin === "chat" || Boolean(item.plannedKind);

/** The country most of the trip's places are in (by count, the earliest first on a tie); null when none is known. */
function mainCountry(own: Item[]): string | null {
  const counts = new Map<string, { n: number; first: string }>();
  for (const i of own) {
    if (i.category === "flight") continue;
    for (const c of placeCodes(i)) {
      const at = counts.get(c) ?? { n: 0, first: "9" };
      counts.set(c, { n: at.n + 1, first: [at.first, i.dates.start ?? "9"].sort()[0] });
    }
  }
  return [...counts].sort((a, b) => b[1].n - a[1].n || a[1].first.localeCompare(b[1].first))[0]?.[0] ?? null;
}

/** Whether a country is the trip's own: its main one, one near it, or one its title names. Null: no place known yet. */
function homeOf(trip: Trip, own: Item[]): ((code: string) => boolean) | null {
  const main = mainCountry(own);
  const named = titleCodes(trip.title);
  if (!main && !named.size) return null;
  return (c: string) => named.has(c) || (main != null && nearCountries(c, main));
}

/**
 * The trip's records whose place is far from the trip's own: its main country (and countries near it, Portugal →
 * Spain), and what its title names. Two Bali records among ten Portugal ones are both strays. Skipped: what was
 * ruled out, what the traveller said stays ("Burada kalsın"), a flight (it starts at home), a record whose place
 * isn't known; a booked or hand-made one only on its own country code.
 */
export function strayItems(trip: Trip, items: Item[]): { item: Item; codes: string[] }[] {
  if (isDemoTrip(trip)) return [];
  const own = items.filter((i) => i.tripId === trip.id && i.status !== "dismissed");
  const home = homeOf(trip, own);
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
  const home = trip ? homeOf(trip, items.filter((i) => i.tripId === tripId && i.id !== item.id && i.status !== "dismissed")) : null;
  if (!trip || isDemoTrip(trip) || !home || !codes.length || codes.some(home)) return false;
  await askAboutStrays(tripId, strayEntries([{ item, codes }], trips, items, tripId));
  return true;
}

let running: Promise<number> | null = null;

/**
 * Once per trip on this computer (Trip.strayCheckedAt): looks for strays and asks. A sample trip is skipped.
 * Returns how many trips were asked in.
 */
export function checkStraysOnce(): Promise<number> {
  running ??= (async () => {
    try {
      const d = await db();
      const trips = await listTrips();
      const items = await d.getAll("items");
      let asked = 0;
      for (const trip of trips) {
        if (trip.strayCheckedAt || isDemoTrip(trip)) continue;
        const entries = strayEntries(strayItems(trip, items), trips, items, trip.id);
        await askAboutStrays(trip.id, entries);
        if (entries.length) asked++;
        // As stored now (the line above didn't touch it, but the board may have).
        const fresh = (await d.get("trips", trip.id)) ?? trip;
        await d.put("trips", { ...fresh, strayCheckedAt: Date.now() });
      }
      if (asked) notifyChanged();
      return asked;
    } finally {
      running = null;
    }
  })();
  return running;
}
