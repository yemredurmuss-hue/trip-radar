// The Plan's three ways to read the same trip (plan v30): by category, in trip order (the stops and their dates), day by day.
// One tablist, drawn atop each of them.
import { L } from "../../lib/i18n";

export type PlanOrderView = "plan" | "story" | "days";

export function PlanOrder({ view, onView }: { view: PlanOrderView; onView: (v: PlanOrderView) => void }) {
  const tabs: [PlanOrderView, string][] = [
    ["plan", L("Kategoriye göre", "By category")],
    ["story", L("Yolculuk sırasıyla", "In trip order")],
    ["days", L("Gün gün", "Day by day")],
  ];
  return (
    <span className="plan-order" role="tablist" aria-label={L("Sıra", "Order")}>
      {tabs.map(([id, label]) => (
        <button key={id} type="button" role="tab" aria-selected={view === id} aria-pressed={view === id} className={view === id ? "on" : ""} onClick={() => onView(id)}>
          {label}
        </button>
      ))}
    </span>
  );
}
