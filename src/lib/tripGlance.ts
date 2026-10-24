// Tek bakış (0.45.0, tuval 15–16): what the toolbar's popup says of the trip without opening the board. "Biriktirdiklerim":
// the Pano's own count, worked out the Pano's way (panoBoardOf) from the trip's records alone; and the trip's next thing
// to do, the hero's "Sıradaki" (rowView.planSteps). Neither has the board's decisions or files here: an option's order
// and a booking's document aren't known, so "Onayı ekle" is never the next step said from here. Pure; tested.
import { categorize } from "./categories";
import { collectionsOf } from "./intents";
import { buildLegs } from "./legs";
import { panoBoardOf } from "./panoBoard";
import { buildPlan } from "./plan";
import { planSteps, type NextStep } from "./rowView";
import { buildTimeline } from "./timeline";
import type { Item, Trip } from "./types";

export interface TripGlance {
  /** Pano's "Biriktirdiklerim": what the travellers brought (the AI's picks and İlham apart). */
  mine: number;
  /** The first thing to do on the plan ("Dönüş uçuşu · Seç"), when there is one to say from here. */
  next: Pick<NextStep, "key" | "section" | "act" | "text" | "sub"> | null;
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
    const step = planSteps(collectionsOf(input).flatMap((c) => c.intents), 6).next.find((s) => s.stage !== "ticket") ?? null;
    return { mine, next: step ? { key: step.key, section: step.section, act: step.act, text: step.text, sub: step.sub } : null };
  } catch {
    return { mine: items.filter((i) => i.status !== "dismissed" && i.addedBy !== "ai").length, next: null };
  }
}
