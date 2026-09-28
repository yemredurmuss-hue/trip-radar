import type { GroupDecision } from "../lib/decision";
import type { ValueCard } from "../lib/value";
import { setItemStatus } from "./actions";

const lowerFirst = (s: string) => s.charAt(0).toLocaleLowerCase("tr") + s.slice(1);

/** The answer first: which option, why it's worth it for this traveller, and what would change it. */
export function DecisionCard({ card, decision, onCompare }: { card: ValueCard; decision: GroupDecision; onCompare: () => void }) {
  const pick = card.pick;
  const planned = pick.item.status === "chosen" || pick.item.status === "booked";
  const question = decision.analysis?.question;
  return (
    <div className={`decision-card${card.tie ? " tie" : ""}`}>
      <div className="dc-head">
        <span className="dc-kicker">{card.tie ? "Başa baş" : "Senin için"}</span>
        <b>{pick.item.name}</b>
        {pick.score != null && <span className="score-pill best">{pick.score}</span>}
      </div>
      <p className="dc-because">{card.because}</p>
      {card.unless && <p className="dc-unless">Ama {lowerFirst(card.unless)}</p>}
      {card.chosenOther && <p className="dc-chosen">{card.chosenOther}</p>}
      {card.budget && <p className="dc-budget">{card.budget}</p>}
      {pick.unsure.length > 0 && <p className="dc-check">Kontrol et: {pick.unsure.join(", ")} sayfada görünmüyor.</p>}
      {question && <p className="dc-question">❓ {question}</p>}
      <div className="dc-actions">
        {planned ? (
          <span className="tone-success">{pick.item.status === "booked" ? "Rezerve edildi ✓" : "Planında ✓"}</span>
        ) : (
          <button className="dc-choose" onClick={() => void setItemStatus(pick.item, "chosen")}>
            {pick.item.name} plana al
          </button>
        )}
        <button className="link-btn" onClick={onCompare}>
          Karşılaştır →
        </button>
      </div>
    </div>
  );
}
