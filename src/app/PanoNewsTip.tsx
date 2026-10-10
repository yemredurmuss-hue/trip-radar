// The box over the Pano tab's dot: what the other traveller did since the Pano was last open here (usePanoDot).
import type { Action } from "../lib/share/activity";
import { agoText } from "../lib/share/activity";
import { L } from "../lib/i18n";

const SHOWN = 4;

export function PanoNewsTip({ news }: { news: Action[] }) {
  const now = Date.now();
  return (
    <>
      <b className="tipx-h">{L(`Son ziyaretten beri ${news.length} şey`, `${news.length} new since your last visit`)}</b>
      {news.slice(0, SHOWN).map((a, n) => (
        <span key={`${a.who}|${a.at}|${n}`} className="tipx-line">
          <span>{a.who} · {a.text}</span>
          <b>{agoText(a.at, now)}</b>
        </span>
      ))}
      {news.length > SHOWN && <span className="tipx-note">{L(`+ ${news.length - SHOWN} tane daha`, `+ ${news.length - SHOWN} more`)}</span>}
    </>
  );
}
