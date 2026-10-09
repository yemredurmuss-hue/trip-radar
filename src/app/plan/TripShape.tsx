// The trip's shape (v11, lib/tripShape.ts): under the Plan's head, the stops in a row — İstanbul 1 Nis, Tokyo 5 gece,
// Hakone 2 gece … İstanbul 16 Nis — each a ring in its stage (dashed to find, amber chosen, green booked), the way
// between them drawn small on a dotted line (the plane, the train). A stop opens its place on the Plan.
import { L } from "../../lib/i18n";
import type { JourneyHop, JourneyStop } from "../../lib/tripShape";
import { KindIcon } from "../cards/Silhouettes";

const STAGE_WORD = { open: () => L("aranıyor", "to find"), chosen: () => L("seçildi", "chosen"), booked: () => L("rezerve", "booked") };

export function TripShape({ stops, hops, onStop }: { stops: JourneyStop[]; hops: JourneyHop[]; onStop: (stop: JourneyStop) => void }) {
  return (
    <ol className="ts-strip" aria-label={L("Gezinin şekli", "The trip's shape")}>
      {stops.map((s, n) => (
        <li key={s.key} className="ts-item">
          <button type="button" className={`ts-stop ${s.stage}`} onClick={() => onStop(s)} title={`${s.city} · ${s.sub} · ${STAGE_WORD[s.stage]()}`}>
            <span className="ts-ring" aria-hidden>
              <KindIcon kind={s.kind === "end" ? "flight" : "stay"} size={18} />
            </span>
            <b>{s.city}</b>
            <small>{s.sub}</small>
          </button>
          {n < hops.length && (
            <span className={`ts-hop ${hops[n].mode}`} aria-hidden>
              {hops[n].mode !== "other" && <KindIcon kind={hops[n].mode === "car" ? "car" : hops[n].mode} size={14} />}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
