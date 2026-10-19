// A link handed in the chat that couldn't be read (C35, v83 "durumlar"; z83_jp.py's dashed card): under the traveller's
// own bubble, a quiet dashed card with "Okunamadı", the address short, what went wrong, "Tekrar dene" (it is read again,
// as the Plan's own card does) and "Kaldır" (it never became a record, so it simply goes). lib/chatCards.ts linkCard.
import type { LinkCardVM } from "../../lib/chatCards";
import { L } from "../../lib/i18n";
import { SiteIcon } from "../arrive/ArriveViews";

export function LinkCard({ card, host, onRetry, onRemove }: { card: LinkCardVM; host: string | null; onRetry: () => void; onRemove: () => void }) {
  return (
    <div className={`c-link ${card.state}`} data-capture={card.captureId} role="group" aria-label={card.tag ?? card.label}>
      <span className="c-lk-ic" aria-hidden>
        <SiteIcon host={host} kind="link" size={18} />
      </span>
      <span className="c-lk-m">
        {card.tag && <span className="c-lk-tag">{card.tag}</span>}
        <b title={card.label}>{card.label}</b>
        <small>{card.line}</small>
      </span>
      {card.actions.length > 0 && (
        <span className="c-lk-a">
          {card.actions.includes("retry") && (
            <button type="button" className="c-lk-b" onClick={onRetry}>
              {L("Tekrar dene", "Try again")}
            </button>
          )}
          {card.actions.includes("remove") && (
            <button type="button" className="c-lk-b quiet" onClick={onRemove}>
              {L("Kaldır", "Remove")}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
