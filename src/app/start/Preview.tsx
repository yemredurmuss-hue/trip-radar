// The trip's photos on top of the checklist card (2026-10-09, drawing v3: one card, not a checklist and a preview):
// the place's photos and the trip's moments (prepared in the background), each fading in as it loads, the gradient
// showing meanwhile and where one fails. The preview's other lines (route, dates, who, flights, style) live in the
// checklist's own rows now; nothing here is a trip yet (it all lives in the draft).
import { useState } from "react";
import type { Preview } from "../../lib/startTrip";

/** A photo that fades in once it has loaded (the gradient shows meanwhile, and where it fails). */
function Photo({ url, place, i }: { url: string | null; place: string; i: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`st-pv-photo st-pv-photo-${i}`}>
      <span className="st-pv-photo-name">{place}</span>
      {url && !failed && (
        <img src={url} alt="" referrerPolicy="no-referrer" className={loaded ? "in" : ""} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

/** The strip's four: a place, a moment of the trip, a place, a moment (2026-10-09): the places first when there are no moments. */
function stripOf(photos: { place: string; url: string | null; moment?: boolean }[]) {
  const places = photos.filter((x) => !x.moment);
  const moments = photos.filter((x) => x.moment);
  const out: typeof photos = [];
  for (let i = 0; out.length < 4 && (i < places.length || i < moments.length); i++) {
    if (places[i]) out.push(places[i]);
    if (out.length < 4 && moments[i]) out.push(moments[i]);
  }
  return out;
}

export function PhotoStrip({ photos, place }: { photos: Preview["photos"]; place: string }) {
  const list: { place: string; url: string | null; moment?: boolean }[] = photos.length ? photos : [{ place, url: null }];
  return (
    <div className="st-pv-photos" aria-hidden>
      {stripOf(list).map((x, i) => (
        <Photo key={`${x.place}:${x.url ?? ""}`} url={x.url} place={x.place} i={i} />
      ))}
    </div>
  );
}
