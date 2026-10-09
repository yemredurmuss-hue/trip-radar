// The trip's shape (v11, lib/tripShape.ts; docs/mockups/2026-10-08-japonya-web-v11.html journey): under the Plan's head,
// the stops in a row — İstanbul 1 Nis, Tokyo 5 gece … İstanbul 16 Nis — each the drawing's picture in a ring of its
// stage (dashed to find, amber chosen, green booked); between them a dotted line with the plane or the train
// travelling along it and how long the way is under it ("11 sa"). Pointing at a stop says what's chosen there; a tap
// opens its place on the Plan.
import { durationText } from "../../lib/cardFacts";
import { L } from "../../lib/i18n";
import type { JourneyHop, JourneyStop } from "../../lib/tripShape";
import { KindIcon } from "../cards/Silhouettes";

const STAGE_WORD = { open: () => L("aranıyor", "to find"), chosen: () => L("seçildi", "chosen"), booked: () => L("rezerve", "booked") };

export function TripShape({ stops, hops, onStop }: { stops: JourneyStop[]; hops: JourneyHop[]; onStop: (stop: JourneyStop) => void }) {
  return (
    <ol className="ts-strip" aria-label={L("Gezinin şekli", "The trip's shape")}>
      {stops.map((s, n) => (
        <li key={s.key} className="ts-item">
          <button type="button" className={`ts-stop ${s.stage}`} onClick={() => onStop(s)} aria-label={`${s.city} · ${s.sub} · ${STAGE_WORD[s.stage]()}`}>
            <span className="ts-ring" aria-hidden>
              <img src={`illus/${s.kind === "end" ? "ucus" : "otel"}.png`} alt="" />
            </span>
            <b>{s.city}</b>
            <small>{s.sub}</small>
            <span className="ts-tip" role="tooltip">
              <KindIcon kind={s.kind === "end" ? "flight" : "stay"} size={14} />
              <span>{s.name ? `${s.name} · ${STAGE_WORD[s.stage]()}` : L("Henüz seçilmedi", "Not chosen yet")}</span>
            </span>
          </button>
          {n < hops.length && (
            <span className={`ts-hop ${hops[n].mode}`} aria-hidden>
              {hops[n].mode !== "other" && (
                <span className="ts-mover">
                  <KindIcon kind={hops[n].mode === "car" ? "car" : hops[n].mode} size={14} />
                </span>
              )}
              {hops[n].minutes ? <span className="ts-lbl">{durationText(hops[n].minutes!)}</span> : null}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
