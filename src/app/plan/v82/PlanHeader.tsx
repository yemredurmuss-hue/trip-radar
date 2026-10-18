// The Plan's head (plan v82 "Hero ile plan ayrı"; v81 "Kategoriler üstü sadeleşti"): "Plan" in the page's size, under it
// "Gezinin omurgası · n karar bekliyor" (a tap goes to the first decision, F5), on the right the three ways to read the plan.
// No "+ Ekle", no key of the colours, no trip shape (B6): adding is at each category's end and the plan's.
import type { ReactNode } from "react";
import { L } from "../../../lib/i18n";

export function PlanHeader({ decide, onDecide, order, title }: {
  /** Everything still to decide (lib/intentFrame.decideCount). */
  decide: number;
  onDecide: () => void;
  /** The view switch (PlanOrder). */
  order: ReactNode;
  /** The nights in words, on hover (lifecycle.nightsSummary). */
  title?: string;
}) {
  return (
    <div className="q-planbar" title={title}>
      <div className="q-pbt">
        <h2>{L("Plan", "Plan")}</h2>
        <small>
          {L("Gezinin omurgası", "The trip's backbone")} ·{" "}
          {decide > 0 ? (
            <button type="button" className="q-pbn" onClick={onDecide} title={L("İlk karara git", "Go to the first decision")}>
              {L(`${decide} karar bekliyor`, `${decide} to decide`)}
            </button>
          ) : (
            L("karar bekleyen yok", "nothing to decide")
          )}
        </small>
      </div>
      {order}
    </div>
  );
}
