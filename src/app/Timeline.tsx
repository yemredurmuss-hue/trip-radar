import type { ReactNode } from "react";
import type { Ranked } from "../lib/choice";
import type { GroupDecision } from "../lib/decision";
import type { Leg } from "../lib/legs";
import type { OptionGroup } from "../lib/plan";
import type { InsertAt } from "../lib/templates";
import type { RentalEntry, Timeline } from "../lib/timeline";
import type { Item, Listing } from "../lib/types";
import type { MainPlace } from "../lib/destinations";
import { DayCards } from "./days/DayViews";
import type { DayCardsProps, DayPlanCards } from "./days/DayCards";

export type RenderGroup = (group: OptionGroup, heading: string | null, subtitle: string | null, nested?: boolean) => ReactNode;
export type CardFor = (item: Item, group: Item[], decision?: GroupDecision, ranked?: Ranked, onCompare?: () => void) => ReactNode;
export type SettledFor = (item: Item, decision?: GroupDecision, onChange?: () => void, changing?: boolean) => ReactNode;
/** A transfer: its own row; `embedded`, only its body (under a line that is its head); `timed`, its time is beside it already. */
export type LegFor = (l: Leg, opts?: { embedded?: boolean; timed?: boolean }) => ReactNode;
/** A transfer or a change of city as a card on the plan (cards/LegCard.tsx). */
export type LegCardFor = (l: Leg) => ReactNode;

/** The Plan (plan/CategoryPlan.tsx, sections) or the day-by-day itinerary (this view). */
export type TimelineMode = "plan" | "days";

/** Gün gün: the days, as one compact row each (days/DayCards.tsx), a card with the city's photo (Liste) or on a rail (Kartlar, days/DayViews.tsx); a line shows its card on the Plan. */
export function TimelineView({
  timeline,
  tripId,
  onAdd,
  listings,
  today,
  onShow,
  dayTimes,
  dayOrder,
  dayLoose,
  mainPlaces,
  cards,
  cityImage,
  undated,
}: {
  timeline: Timeline;
  tripId: string;
  /** Opens the add sheet at a day of the itinerary. */
  onAdd: (at: InsertAt | null) => void;
  listings?: Map<string, Listing>;
  today: string;
  /** Shows a block of the plan (from the itinerary): an entry's key, or "item:ID". */
  onShow: (key: string) => void;
  /** The traveller's own times (trip.dayTimes). */
  dayTimes?: Record<string, string> | null;
  /** The order the traveller gave each day's lines (trip.dayOrder). */
  dayOrder?: Record<string, string[]> | null;
  /** Lines with a time moved by hand (trip.dayLoose). */
  dayLoose?: string[] | null;
  /** The hero's main places, so a route reads "Porto → Madeira" (destinations.ts). */
  mainPlaces?: MainPlace[];
  /** The Plan's own cards, for a journey day and the day's reservations. */
  cards: DayPlanCards;
  /** The city's photo for a day's picture (Liste, Kartlar). */
  cityImage?: (city: string | null) => string | null;
  /** The trip's records and plan, for each stop's "Tarihsiz" under its days. */
  undated?: DayCardsProps["undated"];
}) {
  const rentals = timeline.entries.filter((e): e is RentalEntry => e.kind === "rental");
  return (
    <div className="section trip-plan">
      <DayCards sections={timeline.sections} onAdd={onAdd} listings={listings} today={today} rentals={rentals} onShow={onShow} tripId={tripId} times={dayTimes ?? undefined} order={dayOrder ?? undefined} loose={dayLoose ?? undefined} mainPlaces={mainPlaces} cards={cards} cityImage={cityImage} undated={undated} />
    </div>
  );
}
