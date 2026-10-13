// "Önerimiz" (plan v46, F7): a flight or a stay still to choose, with a real option to show, has a draft on its card: the
// best option, drawn as the card, waiting for the traveller to take it. A draft is only a way of looking: nothing is
// written, no field is added, and it is no choice, so it counts as a need still waiting for a decision (not in the
// budget, not in the hero's percentage). It goes the moment anything is chosen or booked there, or the need is set aside.
// Pure.
import type { GroupDecision } from "./decision";
import type { Item } from "./types";

/** Only these needs have a draft: the others (a train, an eSIM, insurance) stay as they are. */
const DRAFTED = ["flight", "stay"] as const;

/** The part of a need's decision a draft reads: who leads and the options in the order the card shows them. */
export type DraftDecision = Pick<GroupDecision, "winner" | "options">;

/**
 * The option a need's card shows as "Önerimiz", or null when it has none. Only a real, priced option saved for the need
 * can stand (no price, no draft: nothing is made up); an option the comparison rules out (other dates, a must it fails,
 * the assistant's ruling) can't. The pick is the decision's winner, else the first the card shows (the decision's order,
 * then the lowest price); one option is enough. Nothing when something there is already chosen or booked.
 */
export function draftOf(items: readonly Item[], decision?: DraftDecision | null): Item | null {
  if (items.some((i) => i.status === "chosen" || i.status === "booked")) return null;
  const options = items.filter((i) => i.status === "saved");
  if (!options.length || !(DRAFTED as readonly string[]).includes(options[0].category)) return null;
  const ruledOut = new Set((decision?.options ?? []).filter((o) => o.excluded || o.eliminated || o.unmet.length > 0).map((o) => o.item.id));
  const place = new Map((decision?.options ?? []).map((o, n) => [o.item.id, n] as const));
  const real = options.filter((i) => i.price.amount != null && i.price.amount > 0 && !ruledOut.has(i.id));
  const winner = decision?.winner ? real.find((i) => i.id === decision.winner!.item.id) : undefined;
  return winner ?? [...real].sort((a, b) => (place.get(a.id) ?? Infinity) - (place.get(b.id) ?? Infinity) || a.price.amount! - b.price.amount!)[0] ?? null;
}
