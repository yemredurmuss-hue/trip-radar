// "Dahil" (v82 geçişi spec §1.3–1.4; D2, D10): a box another booking covers. A package covers what it holds (a festival's
// ticket its camp, a retreat's programme the nights and the transfer, a liveaboard the transfer and the dives), a pass or a
// rented car the ways between the stays over its days (Hakone Free Pass the Ashi Gölü boat, a road trip's car the drives).
// The covered box asks for no decision of its own; it counts as its cover does (alındı when the cover is bought, planda
// when it's chosen, neither while the cover waits). Read from the records' parts (Item.part, gezi biçimi) and, for what was
// made before them, from what a record is (a festival's camp, a pass by its name, a rented car). Pure.
import { isRental } from "./travelKinds";
import { reasonItemOf } from "./reason";
import type { Leg } from "./legs";
import { sameCity } from "./plan";
import type { Item, Trip } from "./types";
import { isCampStay } from "./campStay";

/** A ticket for many rides over some days: a rail pass, an area's pass (Hakone Free Pass, JR Pass, Interrail). */
const PASS = /\b(pass|pası|pasi)\b|railpass|interrail|eurail/i;
/** A pass good for a whole country or more: it covers a way wherever it goes. */
const WIDE_PASS = /interrail|eurail|jr pass|japan rail|rail ?pass|swiss travel|german rail|bahncard/i;

/** A record that covers the ways between the stays over its days: its part says so, a pass by its name, a rented car. */
export function coversWays(item: Item): boolean {
  if (item.status === "dismissed") return false;
  if (item.part) return Boolean(item.part.covers?.includes("legs"));
  if (item.category !== "transport" && item.category !== "activity") return false;
  return isPass(item) || (item.category === "transport" && isRental(item));
}

/** A pass (not a car): a ticket for many rides. */
export const isPass = (item: Pick<Item, "name" | "category" | "plannedKind">): boolean => PASS.test(item.name) && item.plannedKind !== "car_rental";

/** The trip's first and last day, for a rented car that doesn't say its own. */
export type TripSpan = { start: string; end: string } | null | undefined;

/**
 * The days a covering record runs: its own dates, else its first day and its validity. A rented car put on the plan with
 * no last day (the AI's "Araç kiralama" from the trip's first day, or with no day at all) runs to the trip's end, as its
 * own box says (intents.suggestedIntent).
 */
function daysOf(item: Item, trip?: TripSpan): { start: string; end: string } | null {
  const own = item.dates.start?.slice(0, 10) ?? null;
  const end = item.dates.end?.slice(0, 10) ?? null;
  const car = !isPass(item) && isRental(item) && !end;
  if (car && trip && (!own || own === trip.start)) return { start: trip.start, end: trip.end };
  const start = own;
  if (!start) return null;
  const valid = item.metrics?.validityDays ?? null;
  if (end && end >= start) return { start, end };
  if (valid && valid > 1) {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + valid - 1);
    return { start, end: d.toISOString().slice(0, 10) };
  }
  return { start, end: start };
}

/** Whether a way on `day` touching these places is the covering record's: within its days, within its area (a pass for one place). */
function covers(item: Item, day: string | null, places: (string | null | undefined)[], trip?: TripSpan): boolean {
  const days = daysOf(item, trip);
  if (!days || !day || day < days.start || day > days.end) return false;
  // A pass for one place (Hakone Free Pass): a way touching that place; a car or a country's pass: any way.
  if (!isPass(item) || WIDE_PASS.test(item.name) || !item.city) return true;
  return places.some((p) => sameCity(p ?? null, item.city));
}

/** The ways a pass or a car can cover: a change of city by train, bus, boat or the car, never a flight. */
const PASS_MODES = new Set(["train", "bus", "ferry", "metro"]);
const CAR_MODES = new Set(["car"]);

/** A rental picked up (or left) at the airport: its words say so. */
const AT_AIRPORT = /havaliman|airport|aeroporto|aeropuerto|a[ée]roport|flughafen/i;

/**
 * Whether a car covers the transfer to the first stay or from the last one (0.38.8, Emre): picked up the day it lands (or
 * left the day it leaves) where that transfer is, at the airport (its words say so) or in the same city as the airport and
 * the stay. With the airport in another city than the stay (legs.farHub), only a car picked up there; anything vaguer is
 * left as it is.
 */
function carAtHub(item: Item, leg: Leg, far: string | null, trip?: TripSpan): boolean {
  if (isPass(item) || !isRental(item)) return false;
  const days = daysOf(item, trip);
  if (!days || leg.date !== (leg.kind === "arrival" ? days.start : days.end)) return false;
  const stay = leg.kind === "arrival" ? leg.to.city : leg.from.city;
  const airport = AT_AIRPORT.test([item.name, item.location.address, item.location.area].filter(Boolean).join(" "));
  if (far) return sameCity(item.city, far) || (airport && (!item.city || sameCity(item.city, far)));
  return Boolean(stay) && (sameCity(item.city, stay) || (airport && !item.city));
}

/**
 * What covers a change of city with nothing of its own (D10): a pass or a car over its day (the way picked, if any, its
 * own: a pass a train, a bus or a boat; a car the drive). A car also covers the transfer from the airport to the first
 * stay, or back, when it's picked up or left there (carAtHub; `far`: legs.farHub). Null when nothing does.
 */
export function wayCoverOf(leg: Leg, items: readonly Item[], trip?: TripSpan, far: string | null = null): Item | null {
  // (home ↔ the airport, a step the traveller added, is never the car's)
  const hub = (leg.kind === "arrival" || leg.kind === "departure") && !leg.key.endsWith(":home");
  if (leg.kind !== "move" && leg.kind !== "change" && !hub) return null;
  const mode = leg.choice?.mode ?? null;
  if (mode === "flight") return null;
  for (const item of items) {
    if (!coversWays(item)) continue;
    const pass = isPass(item);
    if (mode && !(pass ? PASS_MODES : CAR_MODES).has(mode)) continue;
    if (hub ? carAtHub(item, leg, far, trip) : covers(item, leg.date, [leg.from.city, leg.to.city], trip)) return item;
  }
  return null;
}

/**
 * A rented car (or scooter, campervan: not a pass) over `day` (0.39.4, Emre: a train suggested for a day the car is
 * driven): the record, else null. A car with no last day runs to the trip's end (daysOf), as on the board.
 */
export function carOnDay(items: readonly Item[], day: string | null, trip?: TripSpan): Item | null {
  if (!day) return null;
  return items.find((i) => coversWays(i) && !isPass(i) && covers(i, day, [], trip)) ?? null;
}

/**
 * What covers a way of travel planned with nothing to pay of its own (a boat on the lake said in the chat): a pass over its
 * day in its area. A car covers only the drives; a ticket bought or priced is its own.
 */
export function rideCoverOf(ride: Item, items: readonly Item[]): Item | null {
  if (ride.category !== "transport" || ride.status === "booked" || ride.status === "dismissed" || ride.price.amount != null || ride.url) return null;
  if (coversWays(ride) || isRental(ride)) return null;
  const day = ride.flight?.departure?.slice(0, 10) ?? ride.dates.start?.slice(0, 10) ?? null;
  return items.find((item) => item.id !== ride.id && isPass(item) && coversWays(item) && covers(item, day, [ride.city, ride.flight?.from, ride.flight?.to])) ?? null;
}

/**
 * What a part's record is covered by (its part's `by`): the records of that part (a festival's ticket made by the start,
 * else the one the trip is for), or the nights it sits in ("stay": the boat, the resort, the lodge there). Most advanced
 * first: a ticket bought before one only planned.
 */
export function partCoverOf(item: Item, trip: Pick<Trip, "intent">, items: readonly Item[]): Item[] {
  const by = item.part?.by;
  if (!by) return [];
  const live = items.filter((i) => i.id !== item.id && i.status !== "dismissed");
  if (by === "stay") {
    const nights = live.filter((i) => i.category === "stay" && i.part?.ref === "stay");
    const here = nights.filter((i) => sameCity(i.city, item.city) || sameCity(i.city, item.flight?.to ?? null));
    return rank(here.length ? here : nights);
  }
  const own = live.filter((i) => i.part?.ref === by);
  // The festival's ticket: the start's card, or the ticket the trip is for (a page saved for it, bought).
  const reason = by === "ticket" ? reasonItemOf(trip, [...live]) : null;
  return rank([...own, ...(reason && !own.includes(reason) ? [reason] : [])]);
}

/**
 * A festival's camp made before the trip's parts were kept (a camp set aside as nothing to book on a festival trip): the
 * ticket the trip is for covers it. Empty for any other stay.
 */
export function campCoverOf(item: Item, trip: Pick<Trip, "intent">, items: readonly Item[]): Item[] {
  if (item.part || trip.intent?.playbook !== "festival" || item.category !== "stay" || !isCampStay(item) || item.noBooking == null) return [];
  const reason = reasonItemOf(trip, items.filter((i) => i.id !== item.id && i.status !== "dismissed"));
  return reason ? [reason] : [];
}

const STEP: Record<Item["status"], number> = { booked: 3, chosen: 2, saved: 1, dismissed: 0 };
const rank = (list: Item[]): Item[] => [...list].sort((a, b) => STEP[b.status] - STEP[a.status]);
