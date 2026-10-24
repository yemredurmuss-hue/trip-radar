// Fiyat izleme (0.40.6, Emre: "fiyat düşünce haber versin"). What is on the plan but not bought yet (a flight, a stay) is
// looked for again once a day, through the same source its options came from (the offers function: Aviasales, the shared
// flight search with its Google Flights check, Google Hotels, Xotelo), and when the traveller opens one of the allowed flight
// sites ("Sitede benle gel", lib/companion.ts) its result for the same flight is read there and then. The same flight (its
// hour and its airline) or the same hotel only: a price is never guessed from another. A drop worth saying (€5 and 3%) is
// written on the record (its history: "Dün €364 idi") and said once (a Chrome notification). Pure, tested.
import { needKey } from "./emptyCards";
import { offerItem, type Need, type Offer } from "./offerSource";
import type { Item, Price } from "./types";

/** A drop worth saying: at least this much and this share of the price. */
export const WATCH_DROP = { amount: 5, share: 0.03 };
/** At most this many records asked a day (the source's caps are small; the nearest trips first). */
export const WATCH_MAX = 12;

const day = (iso: string | null | undefined): string | null => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);
const iata = (s: string | null | undefined): string | null => (s && /^[A-Z]{3}$/.test(s.trim()) ? s.trim() : null);
const fold = (s: string) => s.toLocaleLowerCase("en").normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** On the plan, not bought, priced, still ahead: a flight with its airports and day, a stay with its city and nights. */
export function watchable(item: Item, today: string): boolean {
  if (item.status !== "chosen" || item.price.amount == null || !item.price.currency) return false;
  if (item.category === "flight") {
    const d = day(item.flight?.departure) ?? day(item.dates.start);
    return d != null && d >= today && iata(item.flight?.from) != null && iata(item.flight?.to) != null;
  }
  if (item.category === "stay") return Boolean(item.city && day(item.dates.start) && day(item.dates.end) && day(item.dates.start)! >= today);
  return false;
}

/** What the source is asked for it: the flight's route and day, the stay's city and nights. */
export function watchNeed(item: Item, adults: number | null): Need | null {
  if (item.category === "flight") {
    const from = iata(item.flight?.from), to = iata(item.flight?.to);
    const start = day(item.flight?.departure) ?? day(item.dates.start);
    if (!from || !to || !start) return null;
    return { key: needKey("flight", from, to, start), section: "flight", kind: "flight", from, to, start, adults, fromCode: from, toCode: to };
  }
  if (item.category === "stay" && item.city) {
    const start = day(item.dates.start), end = day(item.dates.end);
    if (!start || !end) return null;
    return { key: needKey("stay", item.city, start, end), section: "stay", kind: "stay", city: item.city, start, end, adults, country: item.countryCode ?? null };
  }
  return null;
}

/** The same flight (its hour, its airline when both say one) or the same hotel (its name or its page): never another. */
export function sameOffer(item: Item, o: Offer): boolean {
  if (item.category === "flight") {
    const dep = item.flight?.departure?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;
    if (!dep || o.depart !== dep) return false;
    const code = item.flight?.flightNumber?.match(/^([A-Z0-9]{2})\s?\d/)?.[1] ?? null;
    if (code && o.carrierCode) return code === o.carrierCode;
    if (item.flight?.carrier && o.carrier) return fold(item.flight.carrier).split(" ")[0] === fold(o.carrier).split(" ")[0];
    return true;
  }
  if (item.category === "stay") {
    const page = (u: string | null | undefined) => {
      try {
        const x = new URL(u ?? "");
        return `${x.hostname.replace(/^www\./, "")}${x.pathname}`.replace(/\/+$/, "");
      } catch {
        return null;
      }
    };
    return (page(item.url) != null && page(item.url) === page(o.url)) || fold(item.name) === fold(o.title);
  }
  return false;
}

/** The price the offer means for this record, as its own was written (offerItem's: the total for the trip's people). */
export function offerPrice(o: Offer, need: Need, item: Item, now: number): Price {
  return offerItem(o, need, item.tripId, item.id, now).price;
}

/** A drop worth saying between the record's price and a new one of the same kind; null when there's none. */
export function priceDrop(was: Price, now: Pick<Price, "amount" | "currency" | "scope">): { was: number; now: number; save: number; currency: string } | null {
  if (was.amount == null || now.amount == null || !was.currency || was.currency !== now.currency || was.scope !== now.scope) return null;
  const save = Math.round(was.amount - now.amount);
  if (save < WATCH_DROP.amount || save < was.amount * WATCH_DROP.share) return null;
  return { was: was.amount, now: now.amount, save, currency: was.currency };
}

/** The record with its new price: the old one kept in its history (the drawer's "Dün €364 idi"). */
export function withPrice(item: Item, price: Price): Item {
  const old = item.price;
  const history = [...item.priceHistory];
  if (old.amount != null && old.currency && !history.some((h) => h.observedAt === old.observedAt && h.amount === old.amount)) history.push({ amount: old.amount, currency: old.currency, observedAt: old.observedAt });
  if (price.amount != null && price.currency) history.push({ amount: price.amount, currency: price.currency, observedAt: price.observedAt });
  return { ...item, price: { ...price, source: price.source }, priceHistory: history.slice(-30), updatedAt: price.observedAt };
}
