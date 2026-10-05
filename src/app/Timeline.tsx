import type { ReactNode } from "react";
import type { Ranked } from "../lib/choice";
import type { GroupDecision } from "../lib/decision";
import type { Leg } from "../lib/legs";
import type { OptionGroup } from "../lib/plan";
import type { InsertAt } from "../lib/templates";
import type { RentalEntry, Timeline } from "../lib/timeline";
import type { Item, Listing } from "../lib/types";
import type { MainPlace } from "../lib/destinations";
import { DayCards, type DayPlanCards } from "./days/DayCards";

export type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => ReactNode;
export type CardFor = (item: Item, group: Item[], decision?: GroupDecision, ranked?: Ranked, onCompare?: () => void) => ReactNode;
export type SettledFor = (item: Item, decision?: GroupDecision, onChange?: () => void, changing?: boolean) => ReactNode;
/** A transfer: its own row; `embedded`, only its body (under a line that is its head); `timed`, its time is beside it already. */
export type LegFor = (l: Leg, opts?: { embedded?: boolean; timed?: boolean }) => ReactNode;
/** A transfer or a change of city as a card on the plan (cards/LegCard.tsx). */
export type LegCardFor = (l: Leg) => ReactNode;

/** The Plan (plan/CategoryPlan.tsx, sections) or the day-by-day itinerary (this view). */
export type TimelineMode = "plan" | "days";

/** Günlük akış: the days as cards (days/DayCards.tsx), each opening in place to the Plan's own cards. */
export function TimelineView({
  timeline,
  tripId,
  leg,
  onAdd,
  listings,
  today,
  onShow,
  cityImage,
  cards,
  dayTimes,
  dayOrder,
  dayLoose,
  mainPlaces,
}: {
  timeline: Timeline;
  tripId: string;
  leg: LegFor;
  /** Opens the add sheet at a day of the itinerary. */
  onAdd: (at: InsertAt | null) => void;
  listings?: Map<string, Listing>;
  today: string;
  /** Shows a block of the plan (from the itinerary). */
  onShow: (entryKey: string) => void;
  /** The city's photo for its day cards. */
  cityImage?: (city: string | null) => string | null;
  /** The Plan's own cards: an open day shows each of its things as it is on the Plan. */
  cards: DayPlanCards;
  /** The traveller's own times (trip.dayTimes). */
  dayTimes?: Record<string, string> | null;
  /** The order the traveller gave each day's lines (trip.dayOrder). */
  dayOrder?: Record<string, string[]> | null;
  /** Lines with a time moved by hand (trip.dayLoose). */
  dayLoose?: string[] | null;
  /** The hero's main places, so a route reads "Porto → Madeira" (destinations.ts). */
  mainPlaces?: MainPlace[];
}) {
  const rentals = timeline.entries.filter((e): e is RentalEntry => e.kind === "rental");
  return (
    <div className="section trip-plan">
      <DayCards sections={timeline.sections} leg={leg} onAdd={onAdd} listings={listings} today={today} rentals={rentals} onShow={onShow} cityImage={cityImage} cards={cards} tripId={tripId} times={dayTimes ?? undefined} order={dayOrder ?? undefined} loose={dayLoose ?? undefined} mainPlaces={mainPlaces} />
    </div>
  );
}
