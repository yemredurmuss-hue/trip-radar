// The board's "Harita" tab: the trip on a map (TripMap, board mode). Every journey of the plan in date order
// (mapLegs.ts), the stops with their photos and nights. Places the tables don't know are looked up (Nominatim,
// cached, one a second) while the map shows what it can; a journey still without a place is listed under it.
import { useEffect, useMemo, useRef, useState } from "react";
import { geocode } from "../../lib/geo";
import { L, lang } from "../../lib/i18n";
import type { Leg } from "../../lib/legs";
import { geocodeQuery, mapRoute, placeRoute, unplaced, type LatLng } from "../../lib/mapLegs";
import type { Plan } from "../../lib/plan";
import type { Trip } from "../../lib/types";
import { TripMap, type TripMapStop } from "./TripMap";

interface Props {
  trip: Pick<Trip, "id" | "cityImages">;
  plan: Plan;
  legs: Leg[];
}

export function BoardMap({ trip, plan, legs }: Props) {
  const route = useMemo(() => mapRoute(plan, legs), [plan, legs]);
  const [found, setFound] = useState<ReadonlyMap<string, LatLng | null>>(new Map());
  const [failed, setFailed] = useState(false);
  // "Tekrar dene": a new map from scratch.
  const [attempt, setAttempt] = useState(0);
  const wanted = useMemo(() => unplaced(route).map(geocodeQuery), [route]);
  const wantedKey = wanted.join("|");
  const looking = wanted.filter((q) => !found.has(q));
  const foundRef = useRef(found);
  foundRef.current = found;

  // The places to look up, one after the other (geocode() keeps to one request a second): started again only when
  // what's wanted changes, never because an answer came; what's found already isn't asked again.
  useEffect(() => {
    let live = true;
    void (async () => {
      for (const q of wanted) {
        if (!live) return;
        if (foundRef.current.has(q)) continue;
        const at = await geocode(q).catch(() => null);
        if (!live) return;
        setFound((m) => new Map(m).set(q, at ? { lat: at.lat, lng: at.lng } : null));
      }
    })();
    return () => {
      live = false;
    };
  }, [wantedKey]);

  const data = useMemo(() => placeRoute(route, (r) => found.get(geocodeQuery(r)) ?? null), [route, found]);
  const stops = useMemo<TripMapStop[]>(
    () => data.stops.map((s) => ({ key: s.key, name: s.name, lat: s.lat, lng: s.lng, nights: s.nights, start: s.start, end: s.end, photo: trip.cityImages?.[s.key] ?? null, photoQuery: s.name })),
    [data.stops, trip.cityImages],
  );
  // Only once the lookups are done: a place still being looked up isn't "unknown".
  const missing = looking.length ? 0 : data.missing.length;
  const empty = !data.stops.length && !data.legs.length;

  return (
    <section className="tm-tab" aria-label={L("Harita", "Map")}>
      {empty ? (
        <p className="tm-note">{looking.length ? L("Yerler haritada aranıyor…", "Finding the places on the map…") : L("Haritada gösterecek yer yok henüz: konaklama ya da yolculuk ekledikçe çizilir.", "Nothing to show on the map yet: it's drawn as stays and journeys are added.")}</p>
      ) : failed ? (
        <div className="tm-note">
          <p>{L("Harita şu an açılamıyor (çevrimdışı ya da tarayıcı haritayı çizemiyor).", "The map can't open right now (offline, or the browser can't draw it).")}</p>
          <button type="button" className="tm-retry" onClick={() => (setFailed(false), setAttempt((n) => n + 1))}>
            {L("Tekrar dene", "Try again")}
          </button>
        </div>
      ) : (
        <TripMap key={`${trip.id}:${attempt}`} mode="board" stops={stops} legs={data.legs} home={data.home} lang={lang()} onUnavailable={() => setFailed(true)} />
      )}
      {missing > 0 && (
        <p className="tm-missing" role="note">
          {missing === 1 ? L("1 yolculuk haritada yok: yeri bilinmiyor", "1 journey isn't on the map: its place is unknown") : L(`${missing} yolculuk haritada yok: yerleri bilinmiyor`, `${missing} journeys aren't on the map: their places are unknown`)}
          <span className="tm-missing-list">{data.missing.map((l) => `${l.from.name} → ${l.to.name}`).join(" · ")}</span>
        </p>
      )}
    </section>
  );
}
