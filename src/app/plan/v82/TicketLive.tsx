// Uçuş günü in the ticket (plan v83 "Uçuş günü", C4): on a booked flight's day its chip line turns into the live strip:
// "Canlı" with its pulse (green on time, amber late), the gate, the delay, the terminal it leaves from, and in the air or
// once landed what the data knows then (took off, expected landing, the belt). The stage the data names ("Biniş başladı")
// is a badge on the carrier's line; the new times and "Planı yeni saate kaydırdım." are the side column's (FrameTicket).
// The same source as the Bugün strip (flightData, AeroDataBox), named at the strip's end. Only what the data says (C19).
import { L } from "../../../lib/i18n";
import type { TicketLive as Live } from "../../../lib/ticketView";

export function TicketLive({ live }: { live: Live }) {
  // Before take-off its own parts; in the air, landed or off, the boxes the data gives then.
  const before = live.phase === "before";
  const tiles = before ? [] : live.tiles.filter((t) => t.label !== live.stage?.label);
  const [iata, term] = live.terminal ? live.terminal.split(" ") : [null, null];
  return (
    <span className="z-l3 z-live" aria-live="polite" title={live.source}>
      {live.dot && (
        <span className={`z-ldot ${live.dot}`}>
          {L("Canlı", "Live")}
        </span>
      )}
      {before && live.gate && (
        <span>
          {L("Kapı", "Gate")} <b>{live.gate}</b>
        </span>
      )}
      {before && live.delay != null && (
        <span className="bad">
          {L("Rötar", "Delay")} <b>{L(`+${live.delay} dk`, `+${live.delay} min`)}</b>
        </span>
      )}
      {before && live.terminal && (
        <span>
          {term ? (
            <>
              {iata} <b>{term}</b>
            </>
          ) : (
            <b>{live.terminal}</b>
          )}
        </span>
      )}
      {tiles.map((t) => (
        <span key={t.label} className={t.tone === "bad" ? "bad" : undefined}>
          {t.label} <b>{t.value}</b>
          {t.note && <i> {t.note}</i>}
        </span>
      ))}
      <small className="z-lsrc">{L(`Veri: ${live.source}`, `Data: ${live.source}`)}</small>
    </span>
  );
}

/** The stage the data names while it's fresh ("Biniş başladı", "Kapı kapandı"): a badge on the ticket's carrier line. */
export function LiveStage({ live }: { live: Live | null }) {
  if (!live?.stage) return null;
  return <span className={`z-lst${live.stage.tone === "bad" ? " bad" : ""}`}>{live.stage.value}</span>;
}
