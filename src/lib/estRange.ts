// A need's estimated price range (plan v30, "Kartlar": the empty card says what it will probably cost). Only ever from
// real prices: at least three of the need's options (saved by a traveller or found by a source) with a price the page
// gave. Fewer than three: nothing is estimated and the card keeps the real "from €X". Pure.
import { formatPrice, nightsBetween } from "./items";
import { stayRange } from "./plan";
import type { Item } from "./types";

/** Under this many priced options a range would be a guess dressed as data. */
export const MIN_PRICED_OFFERS = 3;

export interface EstRange {
  lo: number;
  hi: number;
  /** How many real offers it comes from. */
  n: number;
  currency: string;
  /** What the amounts are for: a night's stay, one person, or the whole thing. */
  unit: "night" | "person" | "total";
}

/** One option's price in the unit the range speaks in (a stay: per night); null when it can't be said. */
function amountOf(item: Item, unit: EstRange["unit"], needNights: number | null): number | null {
  const amount = item.price.amount;
  if (amount == null || !(amount > 0)) return null;
  if (unit === "night") {
    if (item.price.scope === "per_night") return amount;
    const own = stayRange(item);
    const nights = own ? nightsBetween(own.start, own.end) : needNights;
    if (!nights) return null;
    const whole = item.price.scope === "per_person" ? (item.guests.adults ? amount * item.guests.adults : null) : amount;
    return whole == null ? null : whole / nights;
  }
  return amount;
}

/** The range across the need's options, or null with fewer than three real priced ones. `needNights`: the nights the need is for (stays whose page gave a total). */
export function estimatedRange(items: Item[], needNights: number | null = null): EstRange | null {
  const live = items.filter((i) => i.status !== "dismissed");
  if (!live.length) return null;
  const stay = live[0].category === "stay";
  const perPerson = !stay && live.every((i) => i.price.scope === "per_person");
  const unit: EstRange["unit"] = stay ? "night" : perPerson ? "person" : "total";
  // One currency only (the commonest): amounts in different ones aren't a range.
  const priced = live
    .map((i) => ({ amount: amountOf(i, unit, needNights), currency: i.price.currency ?? "EUR" }))
    .filter((p): p is { amount: number; currency: string } => p.amount != null);
  const counts = new Map<string, number>();
  for (const p of priced) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
  const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!currency) return null;
  const same = priced.filter((p) => p.currency === currency).map((p) => p.amount);
  if (same.length < MIN_PRICED_OFFERS) return null;
  const step = Math.max(...same) >= 100 ? 10 : 1;
  return { lo: Math.floor(Math.min(...same) / step) * step, hi: Math.ceil(Math.max(...same) / step) * step, n: same.length, currency, unit };
}

/** "~€300–520": the range as the card writes it (one figure when both ends meet). */
export function rangeLabel(r: EstRange): string {
  const hi = formatPrice(r.hi, r.currency);
  return r.lo === r.hi ? `~${hi}` : `~${formatPrice(r.lo, r.currency)}–${hi.replace(/^[^\d]*/, "")}`;
}
