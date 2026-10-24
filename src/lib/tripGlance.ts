// Tek bakış (0.45.0, tuval 15–16): what the toolbar's popup says of the trip without opening the board. "Biriktirdiklerim":
// the Pano's own count, worked out the Pano's way (panoBoardOf) from the trip's records alone; and the trip's next thing
// to do, the hero's "Sıradaki" (rowView.planSteps). Neither has the board's decisions or files here: an option's order
// and a booking's document aren't known, so "Onayı ekle" is never the next step said from here. Pure; tested.
import { categorize } from "./categories";
import { bookedShare, collectionsOf, planShare } from "./intents";
import { buildLegs } from "./legs";
import { panoBoardOf } from "./panoBoard";
import { buildPlan } from "./plan";
import { planSteps, type NextStep } from "./rowView";
import { buildTimeline } from "./timeline";
import { countedIntents, tripModeOf } from "./tripPhase";
import { profileTrips } from "./trips";
import type { Item, Trip } from "./types";

export interface TripGlance {
  /** Pano's "Biriktirdiklerim": what the travellers brought (the AI's picks and İlham apart). */
  mine: number;
  /** The first thing to do on the plan ("Dönüş uçuşu · Seç"), when there is one to say from here. */
  next: Pick<NextStep, "key" | "section" | "act" | "text" | "sub"> | null;
  /**
   * The hero's two shares worked out the hero's way, from the records alone (0.47.2): the popup's ring until the trip's page
   * has drawn its own (tripShelf.saveReady). fresh: nothing picked yet; null: no need to count.
   */
  ready: { plan: number; booked: number; fresh: boolean } | null;
}

export function tripGlance(trip: Trip, all: readonly Item[], today: string): TripGlance {
  const items = all.filter((i) => i.tripId === trip.id);
  try {
    const plan = buildPlan(trip, items);
    const legs = buildLegs(plan, trip);
    const hidden = new Set(trip.hidden ?? []);
    const timeline = buildTimeline(plan, legs, items, hidden);
    const sections = categorize({ plan, timeline, items, legs, hidden, today });
    const input = { trip, plan, sections, items, today };
    const mine = panoBoardOf({ ...input, me: null }).counts.mine;
    // (a document isn't known here: a booking's "Onayı ekle" is the board's to say)
    const intents = collectionsOf(input).flatMap((c) => c.intents);
    const step = planSteps(intents, 6).next.find((s) => s.stage !== "ticket") ?? null;
    const range = trip.confirmedDates ?? profileTrips([trip], items)[0]?.range ?? null;
    const counted = countedIntents(intents, { today, mode: tripModeOf(range, today), plan, items });
    const planned = planShare(counted);
    const ready = planned.pct == null ? null : { plan: planned.pct, booked: bookedShare(counted).pct ?? 0, fresh: !counted.some((i) => i.status === "chosen" || i.status === "booked") };
    return { mine, next: step ? { key: step.key, section: step.section, act: step.act, text: step.text, sub: step.sub } : null, ready };
  } catch {
    return { mine: items.filter((i) => i.status !== "dismissed" && i.addedBy !== "ai").length, next: null, ready: null };
  }
}
