// Gün gün's strip of the things to do and restaurants put on the plan with no day yet (v11 phase 4).
import { isIdea } from "../../lib/booking";
import { planSectionOfItem } from "../../lib/categories";
import { L } from "../../lib/i18n";
import { dayChip } from "../../lib/ideas";
import type { Item } from "../../lib/types";
import { DayButton } from "./DayPicker";

/**
 * Gün gün's "Planda, günü yok" (v11 phase 4): the things to do and restaurants put on the plan without a day yet,
 * each with its day button; one given a day leaves the strip for its day.
 */
export function UndatedIdeas({ items, plan }: { items: Item[]; plan: Parameters<typeof DayButton>[0]["plan"] }) {
  const waiting = items.filter((i) => isIdea(i) && !i.doneAt && i.status !== "dismissed" && (i.status === "chosen" || i.status === "booked") && !dayChip(i) && (i.category === "food" || planSectionOfItem(i) === "todo"));
  if (!waiting.length) return null;
  return (
    <section className="ud-strip" aria-label={L("Planda, günü yok", "On the plan, no day yet")}>
      <p className="ud-h">
        <b>{L("Planda, günü yok", "On the plan, no day yet")}</b> <i>{waiting.length}</i>
        <span>{L("bir gün seç, o günün akışına girsin", "pick a day and it joins that day")}</span>
      </p>
      <div className="ud-list">
        {waiting.map((i) => (
          <span key={i.id} className="ud-item" data-item-id={i.id}>
            <span className="ud-name">{i.name}</span>
            {i.city && <span className="ud-city">{i.city}</span>}
            <DayButton item={i} plan={plan} />
          </span>
        ))}
      </div>
    </section>
  );
}
