// "★ öncelik" (Karar Panosu #2 and #4): a plus or a minus that touches what the traveller said matters to them carries a small star,
// with its words for a reader of the screen ("Senin için önemli"). Only what their own words stand behind (cardFacts.criterionMatters).
import { L } from "../../lib/i18n";

export function MineStar() {
  return (
    <span className="mine-star" role="img" aria-label={L("Senin için önemli", "Matters to you")} title={L("Söylediğin önceliğe dokunuyor", "It touches what you said matters")}>
      ★
    </span>
  );
}

/** What the star means, once under a list that has one. */
export function MineLegend() {
  return (
    <p className="mine-legend">
      <span className="mine-star" aria-hidden>★</span> {L("Söylediğin bir önceliğe dokunuyor", "Touches something you said matters")}
    </p>
  );
}
