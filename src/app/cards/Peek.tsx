// The boxes over a flight's and a transfer's card while it is pointed at (docs/mockups/ux-katmanli-arayuz): what lib/cardPeek.ts
// found in the records, set out in the tip box. The card's face (price, hours, warnings) is untouched and nothing urgent is only here.
import type { LegPeek, PeekFact } from "../../lib/cardPeek";
import { L } from "../../lib/i18n";
import { CopyText } from "../CopyButton";

export function FlightPeekBox({ facts }: { facts: PeekFact[] }) {
  return (
    <>
      {facts.map((f) => (
        <span key={f.label} className="tipx-line">
          <span>{f.label}</span>
          <b>{f.copy ? <CopyText value={f.copy} label={f.label}>{f.value}</CopyText> : f.value}</b>
        </span>
      ))}
      <span className="tipx-note">{L("Belgeler, yolcular ve değişiklikler Ayrıntı'da.", "Documents, passengers and changes are under Details.")}</span>
    </>
  );
}

export function LegPeekBox({ peek }: { peek: LegPeek }) {
  return (
    <>
      {peek.day && <b className="tipx-h">{peek.day}</b>}
      {peek.weather && <span className="tipx-line"><span>{peek.weather}</span></span>}
      {peek.options.length > 0 && (
        <>
          <span className="tipx-note">{L("Kaydettiğin seçenekler", "Options you saved")}</span>
          {peek.options.map((o) => (
            <span key={o.name} className="tipx-line">
              <span className="tipx-nm">{o.name}</span>
              <b>{[o.duration, o.price].filter(Boolean).join(" · ")}</b>
            </span>
          ))}
        </>
      )}
    </>
  );
}
