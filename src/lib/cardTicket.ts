// Small facts a plan card says from the record as it is (plan v30): a flight ticket's stub prices, a rental car's
// pick-up and return line, whether a way of travel needs a ticket at all, which drawing a stay gets. Nothing is
// guessed: a price comes only from what was saved, a line only from the dates and places on the record. Pure.
import { soloTicket } from "./decision";
import type { CardFacts } from "./cardFacts";
import { daysToStart, showBookingRef } from "./cardTime";
import type { CardKind } from "./cardKinds";
import { rangeLabel, type EstRange } from "./estRange";
import { L } from "./i18n";
import { count, nStops } from "./i18nText";
import { formatDateRange, formatPrice, isoDate, metricsOf } from "./items";
import { durationText } from "./cardFacts";
import { transportFace } from "./cardView";
import { clockOf } from "./legs";
import { lookWord, type Look } from "./stageWords";
import type { Item, Trip } from "./types";

/**
 * A ticket's stub for a flight chosen and not bought ("€74 kişi başı · €148 toplam"). Per person and total are read from
 * what was saved: a price said per person, or a total with the number of passengers. A price whose scope is unknown
 * says neither (null: the strip's own price stays); one passenger has a single figure. `facts` (the compared price in
 * the trip's currency) wins when the engine has one. How many go is the record's own count, else `people` (the trip's, see
 * cardFacts.tripPeople); never a fixed two.
 */
export function ticketPrices(item: Item, facts?: CardFacts["price"], people?: number | null): { each: string | null; total: string } | null {
  if (facts?.each) return { each: facts.each, total: facts.text };
  const { amount, currency, scope } = item.price;
  if (amount == null || amount <= 0) return null;
  const adults = item.guests.adults ?? people ?? 0;
  if (scope === "per_person") {
    if (adults > 1) return { each: formatPrice(amount, currency), total: formatPrice(amount * adults, currency) };
    return { each: formatPrice(amount, currency), total: formatPrice(amount, currency) };
  }
  if (scope === "total") {
    // P3 (F36): the page priced one adult on a trip of several: that is one person's, not everyone's.
    if (soloTicket(item, people ?? 0)) return { each: formatPrice(amount, currency), total: formatPrice(amount * people!, currency) };
    if (adults > 1) return { each: formatPrice(amount / adults, currency), total: formatPrice(amount, currency) };
    return { each: null, total: formatPrice(amount, currency) };
  }
  return null;
}

/** What a flight ticket wears: the five looks, and "searching" while the AI looks for options (a card still empty). */
export type TicketLook = Look | "searching";

export interface TicketStub {
  word: string;
  /** The large figure of the stub: what one pays, the whole sum (one traveller), or the estimate; null when nothing real is known. */
  big: string | null;
  bigKind: "each" | "total" | "estimate" | "from" | null;
  /** The small lines under it ("kişi başı", "2 kişi · €1.960"). */
  lines: string[];
  /** The booking code: on the flight's day and after, never before (a trip with no day shows it). */
  code: string | null;
}

/**
 * The stub of a flight ticket (v46): the stage's word, then only what is real. An empty ticket shows the estimate, and
 * only from at least three real offers (estRange); a chosen or our-pick one what one person pays (large) and how many go
 * with the whole sum (small), from the record's own passenger count else the trip's; a booked one the same, plus its code
 * on the flight's day. A price whose scope is unknown falls back to the compared price as the page said it.
 */
export function ticketStub(a: {
  look: TicketLook;
  item?: Pick<Item, "bookingRef" | "dates" | "flight" | "guests"> | null;
  prices: ReturnType<typeof ticketPrices>;
  /** The compared price as written when the scope isn't known (`facts.price`). */
  fallback?: { text: string; label: string | null } | null;
  /** How many go when the record doesn't say. */
  people?: number | null;
  estimate?: EstRange | null;
  /** The lowest real price of the options saved, as written ("€118"): an empty ticket with fewer than three keeps it, as "€118'den". */
  from?: string | null;
  today: string;
}): TicketStub {
  const word = a.look === "searching" ? L("Aranıyor", "Searching now") : a.look === "booked" ? lookWord("booked", { as: "ticket" }) : lookWord(a.look);
  const none: TicketStub = { word, big: null, bigKind: null, lines: [], code: null };
  if (a.look === "search" || a.look === "searching") {
    if (a.estimate) return { ...none, big: rangeLabel(a.estimate), bigKind: "estimate", lines: [a.estimate.unit === "person" ? L("tahmini · kişi başı", "estimate · per person") : L("tahmini", "estimate")] };
    return a.from ? { ...none, big: L(`${a.from}'den`, `from ${a.from}`), bigKind: "from" } : none;
  }
  const code = a.look === "booked" && a.item?.bookingRef && showBookingRef(a.item, a.today) ? a.item.bookingRef : null;
  const going = a.item?.guests.adults ?? a.people ?? null;
  if (a.prices?.each) {
    const total = a.prices.total;
    return { ...none, code, big: a.prices.each, bigKind: "each", lines: [L("kişi başı", "per person"), going && going > 1 ? L(`${going} kişi · ${total}`, `${going} people · ${total}`) : L(`toplam ${total}`, `total ${total}`)] };
  }
  if (a.prices) return { ...none, code, big: a.prices.total, bigKind: "total", lines: [L("toplam", "total")] };
  if (a.fallback) return { ...none, code, big: a.fallback.text, bigKind: "total", lines: a.fallback.label ? [a.fallback.label] : [] };
  return { ...none, code };
}

/**
 * "Uçuşa 12 gün · bilet alınmadı": the warning under a chosen (or our-pick) flight that isn't bought, always while the day
 * is ahead; amber within 14 days, plain beyond (dateAlert's rule, the same orange-red it tints the foot with). Nothing once
 * it's bought, arranged, or the day has begun or isn't known.
 */
export function ticketWarn(item: Pick<Item, "dates" | "flight">, today: string, look: TicketLook): { tone: "amber" | "plain"; text: string } | null {
  if (look !== "chosen" && look !== "draft") return null;
  const days = daysToStart(item, today);
  if (days == null || days < 0) return null;
  return {
    tone: days <= 14 ? "amber" : "plain",
    text: days === 0 ? L("Uçuş bugün · bilet alınmadı", "Flight today · no ticket yet") : L(`Uçuşa ${days} gün · bilet alınmadı`, `${count(days, "gün", "day")} to the flight · no ticket yet`),
  };
}

/**
 * "Aradığımız: direkt": what the traveller asked of the flight, from what the trip holds (a firm "direkt uçuş", or a note
 * that says it). Nothing is guessed: no such word, no line.
 */
export function flightWants(trip: Pick<Trip, "requirements">, notes: readonly string[] = []): string[] {
  const direct = trip.requirements?.some((r) => r.kind === "direct_flight") || notes.some((n) => /direkt|aktarmasız|nonstop|non-stop|\bdirect\b/i.test(n));
  return direct ? [L("direkt", "direct")] : [];
}

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

/** One flight option's leg as a row says it (v46 FlightOption, the Pano's flight card): hours, codes, how long, how many stops. */
export interface FlightLeg {
  dep: string | null;
  arr: string | null;
  /** It lands this many days later ("+1"). */
  plus: number | null;
  from: string | null;
  to: string | null;
  duration: string | null;
  /** "Direkt" or "1 aktarma"; no word where the record doesn't say. The stop's place isn't on the record, so it isn't written. */
  stops: { text: string; direct: boolean } | null;
}

export function flightLeg(item: Pick<Item, "flight" | "metrics" | "dates" | "name">): FlightLeg {
  const f = item.flight;
  const minutes = metricsOf(item as Item).durationMinutes;
  const stops = f?.stops == null ? null : f.stops === 0 ? { text: L("Direkt", "Direct"), direct: true } : { text: nStops(f.stops), direct: false };
  return {
    dep: clockOf(f?.departure),
    arr: clockOf(f?.arrival),
    plus: transportFace(item as Item, "flight").to?.plus?.days ?? null,
    from: f?.from ?? null,
    to: f?.to ?? null,
    duration: minutes ? durationText(minutes) : null,
    stops,
  };
}
