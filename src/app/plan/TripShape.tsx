// The trip's shape (v11, lib/tripShape.ts; docs/mockups/2026-10-08-japonya-web-v11.html journey): under the Plan's head,
// the stops in a row — İstanbul 1 Nis, Tokyo 5 gece … İstanbul 16 Nis — each the drawing's picture in a ring of its
// stage (dashed to find, amber chosen, green booked); between them a dotted line with the plane or the train
// travelling along it and how long the way is under it ("11 sa"). Pointing at a stop says what's chosen there; a tap
// opens its place on the Plan.
import { durationText } from "../../lib/cardFacts";
import { cachedWeather } from "../../lib/climate";
import { L } from "../../lib/i18n";
import { formatDateRange } from "../../lib/items";
import { cityKeyOf, sameCity } from "../../lib/plan";
import type { JourneyHop, JourneyStop } from "../../lib/tripShape";
import { KindIcon } from "../cards/Silhouettes";
import { TipOn } from "../HoverTip";

const STAGE_WORD = { open: () => L("aranıyor", "to find"), chosen: () => L("seçildi", "chosen"), booked: () => L("rezerve", "booked") };

/** What the city tips add to a stop: the trip's photos by city, the hero's weather places and today (its cache key). */
export interface ShapeExtras {
  photos?: Record<string, string | null>;
  places?: { city: string; start: string; end: string }[];
  today?: string;
}

/** The box over a city: its days and nights, what is chosen there, the weather and the photo the hero already has. Read when it opens, so a weather that arrived meanwhile is in it. */
function CityTip({ stop, photos, places, today }: { stop: JourneyStop } & ShapeExtras) {
  const place = places?.find((p) => sameCity(p.city, stop.city));
  const weather = place && today ? cachedWeather(`${place.city}|${place.start}|${place.end}|${today}`) : null;
  const photo = photos?.[cityKeyOf(stop.city) ?? ""] ?? null;
  const days = stop.range ? `${formatDateRange(stop.range.start, stop.range.end)} · ${stop.sub}` : stop.sub;
  return (
    <>
      {photo && <img className="tipx-ph" src={photo} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
      <b className="tipx-h">{stop.city}</b>
      <span className="tipx-line">
        <span>{days}</span>
      </span>
      <span className="tipx-line">
        <span>{stop.name ? `${stop.name} · ${STAGE_WORD[stop.stage]()}` : L("Henüz seçilmedi", "Not chosen yet")}</span>
      </span>
      {weather && (
        <span className="tipx-line">
          <span>
            {weather.source === "forecast" ? L("Tahmin", "Forecast") : L("Ortalama", "Average")}: {L(`gündüz ${weather.high}°, gece ${weather.low}°`, `day ${weather.high}°, night ${weather.low}°`)} · {L(`yağışlı gün ${weather.rainy}/${weather.days}`, `rainy days ${weather.rainy}/${weather.days}`)}
          </span>
        </span>
      )}
    </>
  );
}

export function TripShape({ stops, hops, onStop, photos, places, today }: { stops: JourneyStop[]; hops: JourneyHop[]; onStop: (stop: JourneyStop) => void } & ShapeExtras) {
  return (
    <ol className="ts-strip" aria-label={L("Gezinin şekli", "The trip's shape")}>
      {stops.map((s, n) => (
        <li key={s.key} className="ts-item">
          {/* Hover or focus: the city's days, what is chosen there, its weather and photo; a click still opens its place. */}
          <TipOn tip={<CityTip stop={s} photos={photos} places={places} today={today} />} below align={n === stops.length - 1 && n > 0 ? "right" : "left"}>
            {(bind) => (
              <button {...bind} type="button" className={`ts-stop ${s.stage}`} onClick={() => onStop(s)} aria-label={`${s.city} · ${s.sub} · ${STAGE_WORD[s.stage]()}`}>
                <span className="ts-ring" aria-hidden>
                  <img src={`illus/${s.kind === "end" ? "ucus" : "otel"}.png`} alt="" />
                </span>
                <b>{s.city}</b>
                <small>{s.sub}</small>
              </button>
            )}
          </TipOn>
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
