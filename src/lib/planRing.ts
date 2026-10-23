// Bitti ve yaklaştı (2026-10-23, Emre onayladı: tuval "Kategori satırı", 7. tur D2). A closed category says how far it is
// with one ring at the row's end: each plan (a need: the flight out, the flight home, a city's nights) is one part of it,
// dark green once bought, light green once chosen and not bought (half way), empty while it only has options. Options are
// never counted: a ninth option fills nothing, buying one plan does. All bought: a full green disc with a tick. Pure, tested.

/** What a category's ring is made of: its plans bought (or arranged), chosen and not bought, and all of them. */
export interface PlanRing {
  done: number;
  near: number;
  total: number;
}

export type RingPart = "done" | "near" | "open";

/** The parts in order around the ring (from the top, clockwise): the bought first, then the chosen, then the rest. */
export function ringParts(ring: PlanRing): RingPart[] {
  const total = Math.max(0, Math.round(ring.total));
  const done = Math.min(total, Math.max(0, Math.round(ring.done)));
  const near = Math.min(total - done, Math.max(0, Math.round(ring.near)));
  return [...Array<RingPart>(done).fill("done"), ...Array<RingPart>(near).fill("near"), ...Array<RingPart>(total - done - near).fill("open")];
}

/** Every plan bought: the disc and its tick. */
export const ringDone = (ring: PlanRing): boolean => ring.total > 0 && ring.done >= ring.total;

/** Past this many plans the parts touch (no gaps): a dozen gaps would be all a 44 px ring shows. */
export const RING_GAPS_MAX = 12;

/**
 * The arcs to draw on a ring of radius `r` around (50, 50): one per part, a small gap between them (none for one plan, or
 * for more than RING_GAPS_MAX), as SVG path data from the top, clockwise.
 */
export function ringArcs(parts: readonly RingPart[], r = 38, gap = 0.06): { part: RingPart; d: string }[] {
  const n = parts.length;
  if (!n) return [];
  const g = n > 1 && n <= RING_GAPS_MAX ? gap : 0;
  const at = (f: number) => {
    const a = 2 * Math.PI * f - Math.PI / 2;
    return `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
  };
  return parts.map((part, i) => {
    const f0 = n === 1 ? 0 : i / n + g / 2;
    const f1 = n === 1 ? 0.9999 : (i + 1) / n - g / 2;
    return { part, d: `M${at(f0)} A${r} ${r} 0 ${f1 - f0 > 0.5 ? 1 : 0} 1 ${at(f1)}` };
  });
}
