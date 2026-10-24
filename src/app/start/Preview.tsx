// The trip's photos on top of the checklist card (2026-10-09, drawing v3: one card, not a checklist and a preview):
// the place's photos and the trip's moments (prepared in the background), each fading in as it loads, the gradient
// showing meanwhile and where one fails. The preview's other lines (route, dates, who, flights, style) live in the
// checklist's own rows now; nothing here is a trip yet (it all lives in the draft).
// Two ways to lay them out (the photo strip of 2026-10-09, and the mosaic of the third drawing of the start flow, "B: mozaik + kutucuklar",
// 2026-10-13): one big photo with two smaller beside it. The mosaic is the default; the traveller can switch to the strip and back, and
// the choice is kept in this browser. Photos are the trip's own (the places' and moments'); a slot without one shows the soft gradient.
import { useState, type ReactNode } from "react";
import { COVER_W, sizedPhoto } from "../../lib/photoCache";
import type { Preview } from "../../lib/startTrip";

/** A photo that fades in once it has loaded (the gradient shows meanwhile, and where it fails); at the cover's width, as the trip will show it. */
function Photo({ url, place, i }: { url: string | null; place: string; i: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`st-pv-photo st-pv-photo-${i}`}>
      <span className="st-pv-photo-name">{place}</span>
      {url && !failed && (
        <img src={sizedPhoto(url, COVER_W)} alt="" referrerPolicy="no-referrer" className={loaded ? "in" : ""} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
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

/** The mosaic's three: a place, a moment of the trip, a place (the strip's first three); a slot with nothing to show is left to its gradient. */
function PhotoMosaic({ photos, place }: { photos: Preview["photos"]; place: string }) {
  const list = stripOf(photos.length ? photos : [{ place, url: null }]).slice(0, 3);
  return (
    <div className="st-pv-mosaic" aria-hidden>
      {[0, 1, 2].map((i) =>
        list[i] ? <Photo key={`${list[i].place}:${list[i].url ?? ""}`} url={list[i].url} place={list[i].place} i={i} /> : <div key={`empty-${i}`} className={`st-pv-photo st-pv-photo-${i}`} />,
      )}
    </div>
  );
}

function PhotoStrip({ photos, place }: { photos: Preview["photos"]; place: string }) {
  const list: { place: string; url: string | null; moment?: boolean }[] = photos.length ? photos : [{ place, url: null }];
  return (
    <div className="st-pv-photos" aria-hidden>
      {stripOf(list).map((x, i) => (
        <Photo key={`${x.place}:${x.url ?? ""}`} url={x.url} place={x.place} i={i} />
      ))}
    </div>
  );
}

const MOSAIC_ICON = <><rect x="4" y="4" width="10" height="16" rx="2" /><rect x="16" y="4" width="4" height="7" rx="1.5" /><rect x="16" y="13" width="4" height="7" rx="1.5" /></>;
const STRIP_ICON = <><rect x="3.5" y="7" width="3.8" height="10" rx="1.4" /><rect x="8.4" y="7" width="3.8" height="10" rx="1.4" /><rect x="13.3" y="7" width="3.8" height="10" rx="1.4" /><rect x="18.2" y="7" width="2.6" height="10" rx="1.2" /></>;
const Glyph = ({ children }: { children: ReactNode }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    {children}
  </svg>
);

export type PhotoLayout = "mosaic" | "strip";
export const LAYOUT_KEY = "trip-radar:photo-layout";

/** The layout kept in this browser: the mosaic unless the strip was picked. Pure given the store. */
export function layoutKept(store: Pick<Storage, "getItem"> | null): PhotoLayout {
  try {
    return store?.getItem(LAYOUT_KEY) === "strip" ? "strip" : "mosaic";
  } catch {
    return "mosaic";
  }
}
const kept = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The trip's photos on top of the card, as a mosaic or a strip; two small buttons at the corner switch between them. */
export function Photos({ photos, place, labels }: { photos: Preview["photos"]; place: string; labels: { group: string; mosaic: string; strip: string } }) {
  const [layout, setLayout] = useState<PhotoLayout>(() => layoutKept(kept()));
  const pick = (next: PhotoLayout) => {
    setLayout(next);
    try {
      kept()?.setItem(LAYOUT_KEY, next);
    } catch {
      /* not kept: it holds for this visit */
    }
  };
  return (
    <div className="st-pv-block">
      {layout === "mosaic" ? <PhotoMosaic photos={photos} place={place} /> : <PhotoStrip photos={photos} place={place} />}
      <div className="st-pv-layout" role="group" aria-label={labels.group}>
        <button type="button" aria-pressed={layout === "mosaic"} title={labels.mosaic} aria-label={labels.mosaic} onClick={() => pick("mosaic")}>
          <Glyph>{MOSAIC_ICON}</Glyph>
        </button>
        <button type="button" aria-pressed={layout === "strip"} title={labels.strip} aria-label={labels.strip} onClick={() => pick("strip")}>
          <Glyph>{STRIP_ICON}</Glyph>
        </button>
      </div>
    </div>
  );
}
