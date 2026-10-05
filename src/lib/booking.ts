// Whether something has to be booked (a ticket, a table, a room) or is only a thing to do. Getting there,
// sleeping, internet and insurance are bookings. A thing to do (an activity, or anything else that isn't one
// of those) is a booking only with positive evidence: a price, a ticket seller, words that say ticket /
// reservation / entry fee / tour / show, or a booking made on a real page. Its kind alone never makes it
// one: the chat (plan_item) and the add sheet guess "activity" for a market, a walk or a shopping trip, and
// older versions stored that guess as `booking: "needed"`; for a record said in the chat or added by hand it
// is read from its evidence instead (a migration on read: nothing stored is rewritten). A page keeps what it
// said. A restaurant is one only when its page asks for a reservation, or once it's booked. "needed" counts
// as "Rezerve et" (Etkinlikler, or its own section); "none" is an idea (Yapılacak şeyler, Restoranlar). Pure.
import { ESIM_WORDS, isInsurance, isPaperwork, itemText } from "./travelKinds";
import type { Item } from "./types";

export type Booking = "needed" | "none";

/** Sites that sell tickets for things to do (and an official ticket page says "ticket" in its address). */
const TICKET_SELLERS =
  /getyourguide|viator|tiqets|klook|musement|civitatis|headout|ticketmaster|eventbrite|feverup|fever\.|bandsintown|seetickets|ticketline|bol\.pt|blueticket|tickets?\.|\/tickets?\b|bilet/i;
/** Words that say a ticket or a booking is needed (or was made). */
const TICKET_WORDS =
  /bilet|rezervasyon|rezerve|giriş ücret|giriş bedel|(^|[\s(])tur(u|a|da|lar|ları)?([\s.,)]|$)|ticket|reservation|reserved|\bbooked\b|book(ing)? (ahead|required|in advance)|admission|entry fee|guided tour|\btours?\b|cruise|\bpnr\b/i;
/** A show or a match: a ticket, even when nobody said the word. */
const SHOW_WORDS =
  /konser|concert|gösteri|\bshow\b|\bopera\b|\bbale\b|ballet|tiyatro|theat(re|er)|müzikal|musical|\bfado\b|flamen(k|c)o|(^|\s)maç|\bmatch\b|stadyum turu|stadium tour/i;
/** A restaurant that wants a table booked. */
const TABLE_WORDS = /rezervasyon(la| gerek| şart| önerilir| zorunlu)|reservation(s)? (required|recommended|only|essential)|book a table|booking (required|essential)|masa ayırt/i;

const evidenceText = (item: Item): string => [itemText(item), item.statusNote].filter(Boolean).join(" ");

/** Positive evidence of a ticket: a price, a ticket seller, or words that say ticket / reservation / tour / show. */
export const ticketSays = (item: Item): boolean => {
  if (item.price.amount != null || TICKET_SELLERS.test(`${item.url ?? ""} ${item.provider ?? ""}`)) return true;
  const text = evidenceText(item);
  return TICKET_WORDS.test(text) || SHOW_WORDS.test(text);
};

/** A note, a to-do or a chore is never a booking, chosen or not. */
const neverBooked = (item: Item): boolean => item.plannedKind === "note" || item.plannedKind === "todo" || item.plannedKind === "prep";

/** Something to do: not a stay, a way of getting there, a meal, insurance or internet. */
const thingToDo = (item: Item): boolean =>
  (item.category === "activity" && !isPaperwork(item)) || (item.category === "other" && !isPaperwork(item) && !isInsurance(item) && !ESIM_WORDS.test(itemText(item)));

/** A tile pressed in Etkinlikler and not named yet ("Etkinlik"): it stays where it was added until it's named. */
const unnamedTile = (item: Item): boolean => item.plannedKind === "activity" && /^(Etkinlik|Activity)$/.test(item.name.trim());

/**
 * A thing to do. Said in the chat or added by hand (origin "chat"): its evidence, whatever kind or stored
 * "needed" it came with, and "booked" there means planned, not a reservation, unless its note says a ticket.
 * Set aside as none, it stays none. A page: booked on it, or what it said, else its evidence.
 */
function toDoBooking(item: Item): Booking {
  if (item.origin === "chat") {
    if (item.booking === "none") return "none";
    return ticketSays(item) || unnamedTile(item) ? "needed" : "none";
  }
  if (item.status === "booked") return "needed";
  return item.booking ?? (ticketSays(item) ? "needed" : "none");
}

/**
 * The heuristic for a record that doesn't say. A thing to do by its evidence; a stay, a flight, getting
 * around, an eSIM and insurance always; a restaurant when its page asks for a table or the traveller chose
 * or booked it (it was on the Plan before records said).
 */
export function bookingByKind(item: Item): Booking {
  // A policy, a visa, an eSIM is bought or got, whatever kind the chat or a quick line gave it (spec 0.34.6).
  if (isPaperwork(item)) return "needed";
  if (neverBooked(item)) return "none";
  if (thingToDo(item)) return ticketSays(item) ? "needed" : "none";
  if (item.status === "chosen" || item.status === "booked") return "needed";
  const text = itemText(item);
  switch (item.category) {
    case "stay":
    case "flight":
    case "transport":
    case "esim":
      return "needed";
    case "food":
      return TABLE_WORDS.test(text) ? "needed" : "none";
    default:
      return isInsurance(item) || ESIM_WORDS.test(text) || item.price.amount != null ? "needed" : "none";
  }
}

/** A thing to do by its evidence; the rest: a booking made is a booking, then the record's own answer, then its kind. */
export function bookingOf(item: Item): Booking {
  if (isPaperwork(item)) return "needed";
  if (neverBooked(item)) return "none";
  if (thingToDo(item)) return toDoBooking(item);
  if (item.status === "booked") return "needed";
  return item.booking ?? bookingByKind(item);
}
export const needsBooking = (item: Item): boolean => bookingOf(item) === "needed";

/** An idea (Yapılacak şeyler, Restoranlar): something to eat or do that needs no booking (a page, a quick note, a to-do). */
export const isIdea = (item: Item): boolean =>
  item.status !== "dismissed" && (item.category === "food" || item.category === "activity" || item.category === "other") && bookingOf(item) === "none";

/**
 * Set aside as needing nothing (a quick line, a page that said no), though its price or words say a
 * ticket ("Livraria Lello, giriş bileti var"): its row offers "Etkinliklere taşı".
 */
export const looksBookable = (item: Item): boolean => item.booking === "none" && ticketSays(item);
