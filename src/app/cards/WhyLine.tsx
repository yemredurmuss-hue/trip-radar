// The card's "neden" line (K6, lib/cardWhy.ts): one quiet line above the strip, why it's here in the traveller's own word.
// Nothing when nothing of theirs stands behind the card.
import { cardWhy, whyText } from "../../lib/cardWhy";
import type { NeedCheck } from "../../lib/needs";
import type { Item } from "../../lib/types";

export function WhyLine({ item, needs, notes }: { item: Item; needs: NeedCheck[]; notes?: string[] }) {
  const why = cardWhy(item, needs, notes);
  if (!why) return null;
  return (
    <p className="pk-why" title={why.title ?? whyText(why)} data-why={why.source}>
      {whyText(why)}
    </p>
  );
}
