// Which countries a trip is in, from its records, without letting one misplaced record speak for it: a Bali tour
// saved into the Portugal trip before the place check doesn't make it a Bali trip, nor draw new Bali pages into it
// (review, probe C). Shared by chooseTrip (trips.ts), the place check (placeCheck.ts) and the one-time check (strays.ts).
import { nearCountries } from "./countryCenters";

export interface PlacedRecord {
  /** Its countries (a flight's both ends are left out by the callers: it starts at home). */
  codes: string[];
  /** A stay counts most: where the nights are is where the trip is. */
  stay: boolean;
  start: string | null;
  /** The traveller said it stays here ("Burada kalsın", "Bu geziye yine de ekle", Geri al). */
  kept?: boolean;
}

/**
 * The trip's own countries: the one with the most weight (a stay 3, anything else 1; the earliest first on a
 * tie), every other with at least two records and a fifth of them (Japan and Thailand, a cruise's ports), what
 * the traveller kept, and any country near one of those (Portugal → Spain; a distance that can't be measured
 * counts as near). One Bali tour among Portugal's places, or two among ten, isn't the trip's.
 */
export function ownCountries(records: PlacedRecord[]): Set<string> {
  const at = new Map<string, { n: number; w: number; first: string }>();
  let total = 0;
  for (const r of records) {
    if (!r.codes.length) continue;
    total++;
    for (const c of r.codes) {
      const x = at.get(c) ?? { n: 0, w: 0, first: "9" };
      at.set(c, { n: x.n + 1, w: x.w + (r.stay ? 3 : 1), first: [x.first, r.start ?? "9"].sort()[0] });
    }
  }
  const sorted = [...at].sort((a, b) => b[1].w - a[1].w || a[1].first.localeCompare(b[1].first));
  const core = new Set(sorted.filter(([, v], i) => i === 0 || (v.n >= 2 && v.n >= total / 5)).map(([c]) => c));
  for (const r of records) if (r.kept) for (const c of r.codes) core.add(c);
  const own = new Set(core);
  for (const c of at.keys()) if ([...core].some((k) => nearCountries(c, k) !== false)) own.add(c);
  return own;
}
