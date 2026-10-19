// C15 (a change of city nobody has planned, plan v30 "belirsiz şehir değişimi"): in the ticket's Aranıyor frame, where the
// route would be, the ways it can go drawn as tiles (Tren, Otobüs, Araba, Uçak) and "Ben hallettim". A tap says the way on
// the change of city (Trip.legs): the box becomes that way's search (its sites under "Kendin ara", "AI'dan öner"); "Ben
// hallettim" sets it aside as arranged.
import { L } from "../../../lib/i18n";
import { wayChoices } from "../../../lib/ticketFrame";
import type { LegMode } from "../../../lib/types";
import { Ic } from "./icons";

export function ModePicker({ modes, onPick, onOwn }: { modes: readonly LegMode[]; onPick: (mode: LegMode) => void; onOwn: () => void }) {
  return (
    <div className="z-ways" role="group" aria-label={L("Nasıl gideceksin?", "How will you go?")}>
      {wayChoices(modes).map((w) => (
        <button key={w.mode} type="button" className="z-way" data-mode={w.mode} onClick={() => onPick(w.mode)}>
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
