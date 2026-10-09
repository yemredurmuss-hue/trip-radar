// "Gezi önizlemesi" (revision 2, item 4): under the checklist, the trip as it is so far, filling in as the answers
// come: the place's photos (prepared in the background, each fading in as it loads), the stops and their nights,
// the dates, who goes, the style, the flights, the country's facts and the rules' suggestions. Each part appears
// with a soft fade the moment it's known; nothing here is a trip yet (it all lives in the draft).
import { useEffect, useState, type ReactNode } from "react";
import { countryInfo } from "../../lib/countries";
import { flagEmoji } from "../../lib/heroInfo";
import { L, withLang, type Lang } from "../../lib/i18n";
import type { Preview } from "../../lib/startTrip";
import { STYLE_META, STYLES } from "../../lib/tripStyle";
import { HeroIcon } from "../Icons";

/** One slide of the stage: the gradient and the name first, the photo fading in over it once loaded. */
function Photo({ url, place, i, on }: { url: string | null; place: string; i: number; on: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`st-pv-photo st-pv-photo-${i}${on ? " on" : ""}`} aria-hidden={!on}>
      <span className="st-pv-photo-name">{place}</span>
      {url && !failed && (
        <img src={url} alt="" referrerPolicy="no-referrer" className={loaded ? "in" : ""} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

/** How long each photo stays before the next one (a slow, readable pace). */
const SLIDE_MS = 4200;
const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The trip's photos big (2026-10-09, Emre: "daha büyük, daha güzel"): the places and the trip's moments one after
 * another, each slowly drifting in, its name on it; the dots under it pick one, the pointer on it holds it.
 */
function Stage({ photos }: { photos: { place: string; url: string | null }[] }) {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const n = photos.length;
  useEffect(() => {
    if (n < 2 || held || still()) return;
    const t = setInterval(() => setAt((a) => (a + 1) % n), SLIDE_MS);
    return () => clearInterval(t);
  }, [n, held]);
  const now = Math.min(at, n - 1);
  return (
    <div className="st-pv-stage" onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}>
      {photos.map((x, i) => (
        <Photo key={`${x.place}:${x.url ?? ""}`} url={x.url} place={x.place} i={i} on={i === now} />
      ))}
      <span className="st-pv-caption" key={now}>
        {photos[now]?.place}
      </span>
      {n > 1 && (
        <span className="st-pv-dots">
          {photos.map((x, i) => (
            <button key={`${x.place}:${i}`} type="button" className={i === now ? "on" : ""} aria-label={x.place} onClick={() => setAt(i)} />
          ))}
        </span>
      )}
    </div>
  );
}

/** One line of the preview, faded in when it first shows. */
function Row({ icon, label, children, id }: { icon: Parameters<typeof HeroIcon>[0]["name"]; label: string; children: ReactNode; id: string }) {
  return (
    <div className="st-pv-row" data-row={id}>
      <span className="st-pv-icon" aria-hidden>
        <HeroIcon name={icon} size={16} />
      </span>
      <span className="st-pv-text">
        <span className="st-pv-label">{label}</span>
        <span className="st-pv-value">{children}</span>
      </span>
    </div>
  );
}

export function TripPreview({ preview: p, place, lang }: { preview: Preview; place: string; lang: Lang }) {
  return withLang(lang, () => {
    const info = p.country ? countryInfo(p.country.code) : null;
    const photos = p.photos.length ? p.photos : [{ place, url: null as string | null }];
    const nights = p.stops.reduce((a, b) => a + b.nights, 0);
    return (
      <section className="st-pv" aria-label={L("Gezi önizlemesi", "Trip preview")}>
        <Stage photos={photos.slice(0, 7)} />
        <h3 className="st-pv-title">
          {p.country ? <span aria-hidden>{flagEmoji(p.country.code)} </span> : null}
          {place}
          {p.country && p.country.name !== place ? <span className="st-pv-country"> · {p.country.name}</span> : null}
        </h3>
        <div className="st-pv-rows">
          <Row id="route" icon="pin" label={p.routeAgreed ? L("Rota", "Route") : p.routeProposed ? L("Rota önerisi", "Suggested route") : L("Durak", "Stop")}>
            {p.stops.map((x) => (x.nights ? `${x.city} ${L(`${x.nights} gece`, `${x.nights} night${x.nights === 1 ? "" : "s"}`)}` : x.city)).join(" → ")}
          </Row>
          {p.when && (
            <Row id="when" icon="cal" label={L("Tarih", "Dates")}>
              {p.when}
            </Row>
          )}
          {p.people && (
            <Row id="people" icon="users" label={L("Kimle", "Who")}>
              {p.people}
            </Row>
          )}
          {(p.styles.length > 0 || p.budget) && (
            <Row id="style" icon="sparkle" label={L("Tarz", "Style")}>
              <span className="st-pv-chips">
                {p.styles.map((id) => (
                  <span key={id} className="st-pv-chip" style={{ background: STYLE_META[id].bg, color: STYLE_META[id].fg }}>
                    {STYLES[id]()}
                  </span>
                ))}
                {p.budget && <span className="st-pv-chip">{p.budget}</span>}
              </span>
            </Row>
          )}
          {p.flights && (
            <Row id="flights" icon="plane" label={L("Uçuşlar", "Flights")}>
              {p.flights}
            </Row>
          )}
          {p.country && (
            <Row id="country" icon="globe" label={L("Ülke", "Country")}>
              {flagEmoji(p.country.code)} {p.country.name}
              {info ? ` · ${info.currency} · ${L(info.language.tr, info.language.en)} · ${L("Priz", "Plugs")} ${info.plugs.join("/")}` : ""}
            </Row>
          )}
          {p.rules.length > 0 && (
            <Row id="rules" icon="star" label={L("Önerilerde", "Suggestions")}>
              {p.rules.join(" · ")}
            </Row>
          )}
        </div>
        {nights > 0 && p.when == null && <p className="st-pv-note">{L("Başlangıcı söyleyince geceler tarihe yerleşir.", "Say the start and the nights get their dates.")}</p>}
      </section>
    );
  });
}
