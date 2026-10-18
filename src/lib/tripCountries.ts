// Which countries a trip is in, from its records, without letting one misplaced record speak for it: a Bali tour
// saved into the Portugal trip before the place check doesn't make it a Bali trip, nor draw new Bali pages into it
// (review, probe C). Shared by chooseTrip (trips.ts), the place check (placeCheck.ts) and the one-time check (strays.ts).
import { nearCountries } from "./countryCenters";

export interface PlacedRecord {
  /** Its countries. */
  codes: string[];
  /** A stay counts most: where the nights are is where the trip is. */
  stay: boolean;
  /** Where the trip's first flight lands: counts like a stay, always the trip's, and settles a tie (review A). */
  arrival?: boolean;
  start: string | null;
  end?: string | null;
  /** The traveller said it stays here ("Burada kalsın", "Bu geziye yine de ekle", Geri al). */
  kept?: boolean;
}

const DAY = 24 * 3600e3;
/** Two stays one after the other (Cairo until the 5th, Nairobi from the 5th): one journey, both its own (review C). */
const chained = (a: PlacedRecord, b: PlacedRecord): boolean =>
  a !== b && a.stay && b.stay && Boolean(a.end && b.start) && Math.abs(Date.parse(b.start!) - Date.parse(a.end!)) <= DAY;

/**
 * The trip's own countries:
 * - where its first flight lands, and what the traveller kept;
 * - stays that follow one another (a two-country journey of one stay each);
 * - the heaviest country (a stay or the arrival counts 3, anything else 1). On a tie: the one near the flight's
 *   arrival; with no flight, all of them (nothing is decided on a guess);
 * - any other with at least two records and a fifth of them (Japan and Thailand, a cruise's ports);
 * - and any country near those (Portugal → Spain; a distance that can't be measured counts as near).
 * One Bali tour among Portugal's places, or two among ten, or one against the flight to Porto, isn't the trip's.
 */
export function ownCountries(records: PlacedRecord[]): Set<string> {
  const at = new Map<string, { n: number; w: number }>();
  let total = 0;
  for (const r of records) {
    if (!r.codes.length) continue;
    total++;
    for (const c of r.codes) {
      const x = at.get(c) ?? { n: 0, w: 0 };
      at.set(c, { n: x.n + 1, w: x.w + (r.stay || r.arrival ? 3 : 1) });
    }
  }
  const arrivals = new Set(records.filter((r) => r.arrival).flatMap((r) => r.codes));
  const core = new Set(arrivals);
  for (const r of records) if (r.kept || records.some((o) => chained(r, o) || chained(o, r))) for (const c of r.codes) core.add(c);
  const top = Math.max(0, ...[...at.values()].map((v) => v.w));
  const tied = [...at].filter(([, v]) => v.w === top).map(([c]) => c);
  const nearArrival = tied.filter((c) => [...arrivals].some((a) => nearCountries(c, a) === true));
  for (const c of arrivals.size ? nearArrival : tied) core.add(c);
  for (const [c, v] of at) if (v.n >= 2 && v.n >= total / 5) core.add(c);
  const own = new Set(core);
  for (const c of at.keys()) if ([...core].some((k) => nearCountries(c, k) !== false)) own.add(c);
  return own;
}
