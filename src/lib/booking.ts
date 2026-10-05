// Whether something has to be booked (a ticket, a table, a room) or is only an idea to do. A record that
// says so (`booking`) is taken at its word; older records and pages that don't say are read by kind:
// getting there and sleeping are bookings; an activity is one when it has a price, comes from a ticket
// seller or its words say ticket / reservation / tour; a restaurant only when its page asks for a
// reservation; a note or a to-do never. "needed" stays on the Plan and counts as "Rezerve et"; "none"
// lives in Fikirler. Pure.
import { itemText, isInsurance } from "./travelKinds";
import type { Item } from "./types";

export type Booking = "needed" | "none";

/** Sites that sell tickets for things to do (and an official ticket page says "ticket" in its address). */
const TICKET_SELLERS = /getyourguide|viator|tiqets|klook|musement|civitatis|headout|ticketmaster|eventbrite|feverup|tickets?\.|\/tickets?\b|bilet/i;
/** Words that say a ticket or a booking is needed. */
const TICKET_WORDS = /bilet|rezervasyon|giriş ücret|giriş bedel|(^|[\s(])tur(u|a|da|lar|ları)?([\s.,)]|$)|ticket|reservation|book(ing)? (ahead|required|in advance)|admission|entry fee|guided tour|\btour\b|cruise/i;
/** A restaurant that wants a table booked. */
const TABLE_WORDS = /rezervasyon(la| gerek| şart| önerilir| zorunlu)|reservation(s)? (required|recommended|only|essential)|book a table|booking (required|essential)|masa ayırt/i;

/** A price, a ticket seller, or words that say ticket / reservation / tour. */
const ticketSays = (item: Item): boolean =>
  item.price.amount != null || TICKET_SELLERS.test(`${item.url ?? ""} ${item.provider ?? ""}`) || TICKET_WORDS.test(itemText(item));

/** The heuristic for a record that doesn't say (also what "Rezerve edileceklere taşı" checks against). */
export function bookingByKind(item: Item): Booking {
  if (item.plannedKind === "note" || item.plannedKind === "todo") return "none";
  const text = itemText(item);
  switch (item.category) {
    case "stay":
    case "flight":
    case "transport":
    case "esim":
      return "needed";
    case "activity":
      return ticketSays(item) ? "needed" : "none";
    case "food":
      return TABLE_WORDS.test(text) ? "needed" : "none";
    default:
      return isInsurance(item) || /\besim\b|e-sim/i.test(text) || item.price.amount != null ? "needed" : "none";
  }
}

/** The record's own answer first, then its kind. */
export const bookingOf = (item: Item): Booking => item.booking ?? bookingByKind(item);
export const needsBooking = (item: Item): boolean => bookingOf(item) === "needed";

/** An idea for Fikirler: something to eat or do that needs no booking (a page, a quick note, a to-do). */
export const isIdea = (item: Item): boolean =>
  item.status !== "dismissed" && (item.category === "food" || item.category === "activity" || item.category === "other") && bookingOf(item) === "none";

/**
 * Set aside as needing nothing (a quick line, a page that said no), though its price or words say a
 * ticket ("Livraria Lello, giriş bileti var"): Fikirler offers "Rezerve edileceklere taşı".
 */
export const looksBookable = (item: Item): boolean => item.booking === "none" && ticketSays(item);
