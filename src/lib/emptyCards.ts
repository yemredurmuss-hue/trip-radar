// Boş kartlar (spec 2026-10-06-bos-kartlar-design.md): which needs are drawn as the approved card made plain,
// because nothing is booked or saved for them yet. As soon as an option or a booking exists the board draws
// today's full card again; everything here only says "this one is still empty". Pure.
import { sectionOfItem } from "./categories";
import { formatDateRange } from "./items";
import { legItem, type Leg } from "./legs";
import { sameCity, type DateRange, type Plan } from "./plan";
import { isPlaceholder } from "./startTrip";
import type { Item, Trip } from "./types";

/**
 * A flight said in the chat with nothing of a real flight on it ("11 Ekim'e uçak bileti", "Lizbon'a uçarız"):
 * no hour, no flight number, no price, no page. Once any of those is said it's a flight chosen, the full card.
 */
export function bareChatFlight(item: Item): boolean {
  if (item.category !== "flight" || item.origin !== "chat" || item.status !== "chosen") return false;
  const f = item.flight;
  const timed = Boolean(f?.departure && f.departure.length > 10) || Boolean(f?.arrival && f.arrival.length > 10);
  return !timed && !f?.flightNumber && !f?.carrier && item.price.amount == null && !item.url;
}

/**
 * A record drawn as an empty card on the Plan: a flight or a stay the start only made room for (startTrip
 * isPlaceholder), or a flight said in the chat with nothing chosen. Never one with a file on it (a ticket's PDF
 * says it's bought), never one booked.
 */
export function isEmptyRecord(trip: Pick<Trip, "startGuide">, item: Item, files = 0): boolean {
  if (item.status !== "chosen" || files > 0) return false;
  if (item.category === "flight") return isPlaceholder(trip, item) || bareChatFlight(item);
  if (item.category === "stay") return isPlaceholder(trip, item);
  return false;
}

/**
 * A transfer or change of city with nothing said for it (LegCard's "Planlanmadı"): no way chosen, not
 * arranged or booked, no saved options, no record of its own.
 */
export function isEmptyLeg(leg: Leg): boolean {
  const mode = leg.choice?.mode ?? leg.mode;
  const booked = leg.status === "booked" || Boolean(leg.choice?.booked);
  const planned = mode != null || leg.status === "chosen" || leg.status === "planned";
  return !booked && !planned && leg.status !== "options" && !legItem(leg);
}

export interface ActivityGap {
  city: string;
  /** The nights the trip spends there (first to last), for the card's date and the searches. */
  range: DateRange;
}

/**
 * Etkinlikler's empty card per city: each city slept in (the trip's order, once) with no activity there yet
 * (anything Etkinlikler holds, a ticket for a tour, a museum, a show). Gone by itself once one is saved.
 */
export function activityGaps(plan: Pick<Plan, "stayBlocks">, items: Item[]): ActivityGap[] {
  const out: ActivityGap[] = [];
  for (const b of plan.stayBlocks) {
    if (!b.city) continue;
    const seen = out.find((g) => sameCity(g.city, b.city));
    if (seen) {
      seen.range = { start: seen.range.start < b.range.start ? seen.range.start : b.range.start, end: seen.range.end > b.range.end ? seen.range.end : b.range.end };
      continue;
    }
    out.push({ city: b.city, range: { ...b.range } });
  }
  const has = (city: string) => items.some((i) => i.status !== "dismissed" && sectionOfItem(i) === "activity" && sameCity(i.city, city));
  return out.filter((g) => !has(g.city));
}

/** "10–17 Aralık". */
export const rangeText = (r: DateRange | null): string | null => (r ? formatDateRange(r.start, r.end) : null);

/** A need's stable key for the offers row (and its tests). */
export const needKey = (kind: string, ...parts: (string | null | undefined)[]): string =>
  [kind, ...parts.map((p) => (p ?? "").trim().toLocaleLowerCase("tr"))].join(":");
