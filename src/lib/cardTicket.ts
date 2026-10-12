// Small facts a plan card says from the record as it is (plan v30): a flight ticket's stub prices, a rental car's
// pick-up and return line, whether a way of travel needs a ticket at all, which drawing a stay gets. Nothing is
// guessed: a price comes only from what was saved, a line only from the dates and places on the record. Pure.
import type { CardFacts } from "./cardFacts";
import type { CardKind } from "./cardKinds";
import { L } from "./i18n";
import { formatDateRange, formatPrice, isoDate } from "./items";
import { clockOf } from "./legs";
import type { Item } from "./types";

/**
 * A ticket's stub for a flight chosen and not bought ("€74 kişi başı · €148 toplam"). Per person and total are read from
 * what was saved: a price said per person, or a total with the number of passengers. A price whose scope is unknown
 * says neither (null: the strip's own price stays); one passenger has a single figure. `facts` (the compared price in
 * the trip's currency) wins when the engine has one.
 */
export function ticketPrices(item: Item, facts?: CardFacts["price"]): { each: string | null; total: string } | null {
  if (facts?.each) return { each: facts.each, total: facts.text };
  const { amount, currency, scope } = item.price;
  if (amount == null || amount <= 0) return null;
  const adults = item.guests.adults ?? 0;
  if (scope === "per_person") {
    if (adults > 1) return { each: formatPrice(amount, currency), total: formatPrice(amount * adults, currency) };
    return { each: formatPrice(amount, currency), total: formatPrice(amount, currency) };
  }
  if (scope === "total") {
    if (adults > 1) return { each: formatPrice(amount / adults, currency), total: formatPrice(amount, currency) };
    return { each: null, total: formatPrice(amount, currency) };
  }
  return null;
}

/** The stub's second line: "kişi başı · €148 toplam", or "toplam" alone for one traveller. */
export const ticketPriceLine = (p: { each: string | null; total: string }): string =>
  p.each && p.each !== p.total ? L(`kişi başı · ${p.total} toplam`, `per person · ${p.total} total`) : p.each ? L("kişi başı", "per person") : L("toplam", "total");

const day = (iso: string | null | undefined): string | null => {
  const d = isoDate(iso?.slice(0, 10));
  return d ? formatDateRange(d, null) : null;
};

/**
 * A rented vehicle's line in the ride template: "Al 25 Temmuz 09:45 · Havalimanı → bırak 2 Ağustos". What the record says
 * of its own (`when`) wins; else the pick-up day and hour, the place, and the return day, each only where known. The
 * return place is written only when the record's own line gives it: there is no field for it.
 */
export function rentalLine(item: Item): string | null {
  if (item.when?.trim()) return item.when.trim();
  const start = day(item.dates.start);
  if (!start) return null;
  const time = clockOf(item.flight?.departure);
  const place = item.location.area ?? item.location.address;
  const back = day(item.dates.end);
  const pick = L(`Al ${start}${time ? ` ${time}` : ""}`, `Pick up ${start}${time ? ` ${time}` : ""}`);
  const out = [pick, place].filter(Boolean).join(" · ");
  return back ? `${out} → ${L(`bırak ${back}`, `drop off ${back}`)}` : out;
}

/**
 * A way of travel that needs no ticket ("Bilet gerekmez" by its price): a taxi, a transfer, or one the traveller set aside
 * (or the page said) needs none. A flight and a rental never read it so; neither does something already bought.
 */
export function needsNoTicket(item: Item, kind: CardKind, transport: boolean): boolean {
  if (!transport || kind === "flight" || item.status === "booked" || item.status === "dismissed") return false;
  if (["car", "moto", "rv", "bike"].includes(kind)) return false;
  return kind === "taxi" || item.noBooking != null || item.booking === "none";
}

/**
 * The drawing of a stay in place of a photo (static/illus): a flat or a house, a caravan, else the hotel's; a camp or a
 * boat has none of its own (null: the kind's icon). Where the record doesn't say what it is, an Airbnb is a home.
 */
export function stayArt(item: Item, airbnb: boolean): string | null {
  switch (item.metrics?.stayKind ?? null) {
    case "apartment":
    case "house":
      return "ev-daire";
    case "vehicle":
      return "karavan";
    case "camp":
    case "boat":
      return null;
    case "hotel_room":
    case "guesthouse":
    case "hostel":
      return "otel";
    default:
      return airbnb ? "ev-daire" : "otel";
  }
}

/** A contact link is used only when it is a web page or a mail address: nothing else is opened from a record. */
export const safeContactUrl = (url: string | undefined | null): string | null => (url && /^(https?:\/\/|mailto:)/i.test(url.trim()) ? url.trim() : null);
