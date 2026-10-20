// The chat and the Plan are side by side (App.tsx): what the chat's cards need of the Plan is handed up by the Plan
// (TripPanel's onPlanLink) and down to the chat. The boxes as they stand, for the cards (lib/chatCards.ts), and the two
// things a card does there: "Planda göster" (the box, its category or the Pano at it) and "Bunu seç" / "Plana koy".
import type { PlanTarget } from "../../lib/chatCards";
import type { Collection } from "../../lib/intents";

export interface PlanLink {
  tripId: string;
  collections: readonly Collection[];
  /** "Planda göster": the box comes into view and flashes; the Pano opens at it when the box doesn't show it. */
  show: (target: PlanTarget) => void;
  /** "Bunu seç" / "Plana koy": the record taken in its box (which comes into view to show it). */
  pick: (itemId: string, target: PlanTarget) => void;
  /** The hero's "Sıradaki" in words ("Sıradaki: Porto konaklaması"): the chat's "ready" line says the same (P10, F11). */
  next?: string | null;
}
