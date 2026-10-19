// The Plan's three ways to read the same trip (plan v30; v82 the plan head's switch, "Kategoriye göre · Yolculuk sırasıyla ·
// Gün gün"): by category, in trip order (the stops and their dates), day by day. One tablist, drawn atop each of them; its
// highlight slides from one to the other (hareketDili m-sekme).
import { L } from "../../lib/i18n";

export type PlanOrderView = "plan" | "story" | "days";

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
    <span className="plan-order q-seg" role="tablist" aria-label={L("Plan görünümü", "Plan view")}>
      {tabs.map(([id, label]) => {
        const why = off?.[id];
        return (
          <button key={id} type="button" role="tab" data-view={id} aria-selected={view === id} aria-pressed={view === id} aria-disabled={why != null || undefined} title={why || undefined}
            className={`${view === id ? "on" : ""}${why != null ? " off" : ""}`.trim()} onClick={() => why == null && onView(id)}>
            {label}
            {why && <span className="sr-only"> · {why}</span>}
          </button>
        );
      })}
    </span>
  );
}
