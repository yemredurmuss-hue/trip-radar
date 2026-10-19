// The Plan's three ways to read the same trip (plan v30): by category, in trip order (the stops and their dates), day by day.
// One tablist, drawn atop each of them.
import { L } from "../../lib/i18n";
import { LOOKS, lookWord } from "../../lib/stageWords";
import { UiIcon } from "../cards/Silhouettes";

export type PlanOrderView = "plan" | "story" | "days";

/** The key, shared by all three ways to read the plan: a sample box for each of the five looks, in the words of stageWords. */
export function PlanKey() {
  return (
    <span className="plan-key" aria-label={L("Renklerin anlamı", "What the colours say")}>
      {LOOKS.map((look) => (
        <span key={look}>
          <i className={`pk-sw ${look}`}>{look === "booked" && <UiIcon name="check" size={11} />}</i>
          {lookWord(look)}
        </span>
      ))}
    </span>
  );
}

export function PlanOrder({ view, onView, off }: {
  view: PlanOrderView;
  onView: (v: PlanOrderView) => void;
  /** A way to read it that's shut, with why (D15: "Yolculuk sırasıyla" on a trip with no dates): faded, not pressed. */
  off?: Partial<Record<PlanOrderView, string>>;
}) {
  const tabs: [PlanOrderView, string][] = [
    ["plan", L("Kategoriye göre", "By category")],
    ["story", L("Yolculuk sırasıyla", "In trip order")],
    ["days", L("Gün gün", "Day by day")],
  ];
  return (
    <span className="plan-order" role="tablist" aria-label={L("Sıra", "Order")}>
      {tabs.map(([id, label]) => {
        const why = off?.[id];
        return (
          <button key={id} type="button" role="tab" aria-selected={view === id} aria-pressed={view === id} aria-disabled={why != null || undefined} title={why || undefined}
            className={`${view === id ? "on" : ""}${why != null ? " off" : ""}`.trim()} onClick={() => why == null && onView(id)}>
            {label}
            {why && <span className="sr-only"> · {why}</span>}
          </button>
        );
      })}
    </span>
  );
}
