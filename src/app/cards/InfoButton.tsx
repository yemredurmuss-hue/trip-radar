// The ⓘ on a card (mockup v46 infoBtn): a 20 px round button that opens a 250 px balloon of "label · value" rows by hover, key
// focus or a tap. The balloon only adds: the card's face keeps its price, hours and warnings (lib/cardPeek.ts says what the
// record holds). Its box is the HoverTip's (a portal, so no card clips it); a booking code in it can be copied.
import type { LegPeek, PeekFact } from "../../lib/cardPeek";
import { L } from "../../lib/i18n";
import { CopyText } from "../CopyButton";
import { HoverTip } from "../HoverTip";

export function InfoButton({ children }: { children: React.ReactNode }) {
  return (
    <HoverTip tip={children} align="right" label={L("Ayrıntı", "Details")} className="inf" boxClass="inf-pop" interactive>
      <i aria-hidden>i</i>
    </HoverTip>
  );
}

/** A card's facts as rows; `note` is the line under them. */
export function FactsBox({ facts }: { facts: PeekFact[] }) {
  return (
    <>
      {facts.map((f) => (
        <span key={f.label} className="inf-row">
          <i>{f.label}</i>
          <b>{f.copy ? <CopyText value={f.copy} label={f.label}>{f.value}</CopyText> : f.value}</b>
        </span>
      ))}
      <span className="inf-note">{L("Belgeler, yolcular ve değişiklikler Ayrıntı'da.", "Documents, passengers and changes are under Details.")}</span>
    </>
  );
}

export function LegFactsBox({ peek }: { peek: LegPeek }) {
  return (
    <>
      {peek.day && <b className="inf-h">{peek.day}</b>}
      {peek.weather && <span className="inf-note">{peek.weather}</span>}
      {peek.options.length > 0 && (
        <>
          <span className="inf-note">{L("Kaydettiğin seçenekler", "Options you saved")}</span>
          {peek.options.map((o) => (
            <span key={o.name} className="inf-row">
              <i>{o.name}</i>
              <b>{[o.duration, o.price].filter(Boolean).join(" · ")}</b>
            </span>
          ))}
        </>
      )}
    </>
  );
}
