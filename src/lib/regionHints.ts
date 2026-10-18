// The empty stay's area chips (plan v82, Aranıyor: "Namba €110 · Umeda €140 · Shin-Osaka €90"; C raporu §1.6): the
// neighbourhoods the offers source's candidates are in (offerSources StayCandidate.area), each with the middle of its
// priced nights, the areas with the most candidates first. Only what the source said: an area with no priced candidate
// is named without a price, and with no area named there is no chip at all (no "why" sentence is made up, C19). Pure.
import type { StayCandidate } from "./offerSources";

export interface RegionHint {
  area: string;
  /** The median of the area's priced nights, in the candidates' currency; null when none was priced. */
  nightly: number | null;
  currency: StayCandidate["currency"];
  /** How many candidates are there. */
  n: number;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
};

/** An area's name as one key ("Shin-Osaka" and "shin-osaka " are one). */
const keyOf = (area: string) => area.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");

/** At most `max` areas, most candidates first (ties: cheaper first, then by name). */
export function regionHints(candidates: readonly StayCandidate[], max = 3): RegionHint[] {
  const by = new Map<string, { area: string; prices: number[]; n: number; currency: StayCandidate["currency"] }>();
  for (const c of candidates) {
    const area = c.area?.trim();
    if (!area) continue;
    const key = keyOf(area);
    const known = by.get(key) ?? { area, prices: [], n: 0, currency: c.currency };
    known.n += 1;
    if (c.nightly != null && Number.isFinite(c.nightly) && c.nightly > 0) known.prices.push(c.nightly);
    by.set(key, known);
  }
  return [...by.values()]
    .map((x) => ({ area: x.area, nightly: median(x.prices), currency: x.currency, n: x.n }))
    .sort((a, b) => b.n - a.n || (a.nightly ?? Infinity) - (b.nightly ?? Infinity) || a.area.localeCompare(b.area, "tr"))
    .slice(0, max);
}
