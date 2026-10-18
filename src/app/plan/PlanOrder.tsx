// The Plan's three ways to read the same trip (plan v30; v82 the plan head's switch, "Kategoriye göre · Yolculuk sırasıyla ·
// Gün gün"): by category, in trip order (the stops and their dates), day by day. One tablist, drawn atop each of them; its
// highlight slides from one to the other (hareketDili m-sekme).
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

export function PlanOrder({ view, onView }: { view: PlanOrderView; onView: (v: PlanOrderView) => void }) {
  const tabs: [PlanOrderView, string][] = [
    ["plan", L("Kategoriye göre", "By category")],
    ["story", L("Yolculuk sırasıyla", "In trip order")],
    ["days", L("Gün gün", "Day by day")],
  ];
  return (
    <span className="plan-order q-seg" role="tablist" aria-label={L("Plan görünümü", "Plan view")}>
      {tabs.map(([id, label]) => (
        <button key={id} type="button" role="tab" data-view={id} aria-selected={view === id} aria-pressed={view === id} className={view === id ? "on" : ""} onClick={() => onView(id)}>
          {label}
        </button>
      ))}
    </span>
  );
}
