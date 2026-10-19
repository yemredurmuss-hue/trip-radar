// C15 (a change of city nobody has planned, plan v30 "belirsiz şehir değişimi"): in the ticket's Aranıyor frame, where the
// route would be, the ways it can go drawn as tiles (Tren, Otobüs, Araba, Uçak) and "Ben hallettim". A tap says the way on
// the change of city (Trip.legs): the box becomes that way's search (its sites under "Kendin ara", "AI'dan öner"); "Ben
// hallettim" sets it aside as arranged. On the road from an airport in another city (Kolombo → Ahangama) Önerimiz's two
// usual ways come first (WayPicks: Tren, then a taxi or a private transfer, each with its search and "Bunu seç"); "Başka
// yol" draws the tiles in their place.
import { useState } from "react";
import { L } from "../../../lib/i18n";
import { wayChoices, type WayPick } from "../../../lib/ticketFrame";
import type { LegMode } from "../../../lib/types";
import { Ic, Mark } from "./icons";

export function ModePicker({ modes, onPick, onOwn, current = null }: {
  modes: readonly LegMode[];
  onPick: (mode: LegMode) => void;
  onOwn: () => void;
  /** The way already said (Değiştir on an arranged transfer): marked, a tap on it keeps it. */
  current?: LegMode | null;
}) {
  return (
    <div className="z-ways" role="group" aria-label={L("Nasıl gideceksin?", "How will you go?")}>
      {wayChoices(modes).map((w) => (
        <button key={w.mode} type="button" className={`z-way${w.mode === current ? " on" : ""}`} data-mode={w.mode} aria-pressed={w.mode === current || undefined} onClick={() => onPick(w.mode)}>
          <img src={`illus/${w.art}.png`} alt="" />
          <span>{w.label}</span>
        </button>
      ))}
      <button type="button" className="z-way own" onClick={onOwn}>
        <i aria-hidden>
          <Ic name="check" size={20} stroke={2.6} />
        </i>
        <span>{L("Ben hallettim", "I've got it")}</span>
      </button>
    </div>
  );
}

/** Önerimiz's ways (IntentVM.wayPicks), one row each: its drawing and word, its search ↗ and "Bunu seç"; "Başka yol" opens the tiles. */
export function WayPicks({ picks, modes, onPick, onOwn }: { picks: readonly WayPick[]; modes: readonly LegMode[]; onPick: (mode: LegMode) => void; onOwn: () => void }) {
  const [more, setMore] = useState(false);
  if (more) return <ModePicker modes={modes} onPick={onPick} onOwn={onOwn} />;
  return (
    <div className="z-wpk" role="group" aria-label={L("Önerimiz", "Our pick")}>
      <span className="z-wph">
        <b>✨ {L("Önerimiz", "Our pick")}</b>
        <button type="button" className="z-wpm" aria-expanded={false} onClick={() => setMore(true)}>
          {L("Başka yol", "Another way")}
        </button>
      </span>
      {picks.map((w) => (
        <span key={w.mode} className="z-wp" data-mode={w.mode}>
          <img src={`illus/${w.art}.png`} alt="" />
          <b title={w.label}>{w.label}</b>
          {w.site && (
            <a className="z-wps" href={w.site.url} target="_blank" rel="noopener noreferrer" title={w.site.name}>
              <Mark color={w.site.color} letter={w.site.letter} small />
              <span className="z-wpn">{w.site.name}</span>
              <span className="q-ext">↗</span>
            </a>
          )}
          <button type="button" className="q-pick z-wpt" aria-label={L(`${w.label}: bunu seç`, `${w.label}: pick this`)} onClick={() => onPick(w.mode)}>
            {L("Bunu seç", "Pick this")}
          </button>
        </span>
      ))}
    </div>
  );
}
