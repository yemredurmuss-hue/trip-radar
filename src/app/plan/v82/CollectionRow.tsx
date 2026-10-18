// The collection family (plan v82: things to book and do, by city): two fixed rows of 224 px cards, Planında (empty slots
// "Henüz plana koymadın" while nothing is there) and Öneriler, four across, the rest "+n Pano'da"; "+ Plana koy" flies the
// card to its slot (E6). Phase 4 draws it (with KCard); until then no category sends a row of cards here (CategoryPlan's
// V82_SECTIONS holds stay and other only).
import type { ReactNode } from "react";
import type { IntentVM, OptionVM } from "../../../lib/intents";

export interface CollectionRowProps {
  vm: IntentVM;
  /** The kind's drawing, for a card with no photo. */
  art: string;
  /** "+ Plana koy" and the card's ×. */
  onPut: (o: OptionVM) => void;
  onTakeOff: (o: OptionVM) => void;
}

export function CollectionRow(_: CollectionRowProps): ReactNode {
  return null;
}
