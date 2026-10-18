import { useContext } from "react";
import { L } from "../../lib/i18n";
import { CardEnvContext } from "./PlanCard";

/**
 * v11's ✨ on a card still to find ("AI'dan öneri iste"): the line goes to the trip's chat, which looks; nothing
 * where there's no chat. With a `label` it is a pill with words (a flight ticket's "Seçenek ara"); `onAsk` tells the card
 * the search began (its "Aranıyor" look).
 */
export function AskButton({ text, label, onAsk }: { text: string; label?: string; onAsk?: () => void }) {
  const env = useContext(CardEnvContext);
  if (!env?.ask) return null;
  return (
    <button type="button" className={`pk-ask${label ? " lbl" : ""}`} aria-label={L("AI'dan öneri iste", "Ask the AI for options")} title={L("AI'dan öneri iste", "Ask the AI for options")}
      onClick={(e) => { e.stopPropagation(); env.ask!(text); onAsk?.(); }}>
      ✨{label ? <span> {label}</span> : null}
    </button>
  );
}
