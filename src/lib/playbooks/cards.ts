// The small pieces the playbooks' skeletons are made of: a card said the way the chat's plan_item says it, and the
// transfer from where the flight lands. Pure.
import { cityKeyOf } from "../plan";
import type { PlannedInput } from "../planned";
import type { PlaybookCtx } from "./index";

/** A plan said with only what is given (the rest empty), like the start's own flights and stays. */
export const card = (p: Partial<PlannedInput> & Pick<PlannedInput, "kind">): PlannedInput => ({
  date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...p,
});

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && cityKeyOf(a) === cityKeyOf(b);

/** The first stay the start makes (the resort, the retreat). */
export const firstStay = (ctx: PlaybookCtx): PlannedInput | null => ctx.stays[0] ?? null;

/** The stay at a place (the festival's own nights), else none. */
export const stayAt = (ctx: PlaybookCtx, place: string | null | undefined): PlannedInput | null => ctx.stays.find((x) => same(x.city, place)) ?? null;

/**
 * The transfer from where the flight lands to a place, on the day it's reached: from the airport city when it is
 * another place ("Transfer · Budapeşte → Ozora"), else within the place. None on a road trip (the car goes there).
 */
export function transferTo(ctx: PlaybookCtx, place: string | null | undefined, date: string | null, title: string | null = null): PlannedInput[] {
  if (ctx.road || !place) return [];
  return [card({ kind: "transfer", date, from: ctx.arrive && !same(ctx.arrive, place) ? ctx.arrive : null, to: place, title })];
}

/** The days a thing runs over the stay it belongs to (a ski pass for the stay, the ticket for the festival). */
export const daysOf = (stay: PlannedInput | null, fallback: { start: string; end: string } | null): { date: string | null; end_date: string | null } => ({
  date: stay?.date ?? fallback?.start ?? null,
  end_date: stay?.date ? stay.end_date : (fallback?.end ?? null),
});
