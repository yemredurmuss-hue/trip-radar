// The generating screen's map, v5 (spec 2026-10-06-niyet-planlayici §1, docs/mockups/2026-10-06-gezi-baslatma-v5.html):
// a light SVG card drawn from the bundled world (static/map/world.json, Natural Earth; no tiles, no network, no map
// library). The world closes in on the flight; home and the destination's label appear; a white plane with its
// shadow flies the curved route (bigger mid-flight, a gradient trail behind it); a ring where it lands; the view closes
// in on the stops, which drop with their labels (the event's stop pink); the ground route draws pink and dashed; the
// photos fan in at the card's bottom right. Without a flight (no home, home is there) the world closes in on the
// stops. With reduced motion: the last frame at once. The timeline is startMap.genTimeline (the steps follow it).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { L, withLang, type Lang } from "../../lib/i18n";
import {
  along, arcControl, arcPath, between, easeInOut, flightView, groundPath, MAP_W, nearSide, project, stopsView, worldView, type GenTimeline, type View, type XY,
} from "../../lib/startMap";
import type { WorldMap } from "./FlightMap";

export interface GenStop {
  name: string;
  lat: number;
  lng: number;
  nights: number | null;
  /** The event's own stop (pink). */
  fest: boolean;
}

export interface GenMapProps {
  world: WorldMap;
  /** Home (null: no flight). */
  from: { name: string; lat: number; lng: number } | null;
  /** Where the plane lands. */
  to: { name: string; lat: number; lng: number };
  /** The destination's label while flying ("AfrikaBurn · Tankwa Karoo"). */
  label: string;
  /** The markers, once each (a place come back to shows its nights added up). */
  stops: GenStop[];
  /** The ground route through the stops in travel order (repeats kept: Cape Town → Tankwa Karoo → Cape Town). */
  ground: { lat: number; lng: number }[];
  photos: { place: string; url: string | null }[];
  timeline: GenTimeline;
  /** When the timeline started (performance.now()): the steps beside it are paced by the same clock. */
  t0: number;
  lang: Lang;
  still: boolean;
}

/** The white plane, pointing north (rotated to the curve). */
const PLANE = "M12 1.6c.7 0 1.2.8 1.2 1.8v5.5l8.3 4.9v1.8l-8.3-2.5v5l2.4 1.8v1.4L12 20.4 8.4 21.3v-1.4l2.4-1.8v-5l-8.3 2.5v-1.8l8.3-4.9V3.4c0-1 .5-1.8 1.2-1.8z";
const part = (ms: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (ms - a) / (b - a)));

export function GenMap({ world, from, to, label, stops, ground, photos, timeline: t, t0, lang, still }: GenMapProps) {
  const [ms, setMs] = useState(still ? t.end : Math.max(0, performance.now() - t0));
  const card = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Home first; the rest the shorter way round from it (across the Pacific, a map's width over: the land is drawn
  // three times side by side).
  const geo = useMemo(() => {
    const a: XY | null = from ? project(from) : null;
    const b: XY = a ? nearSide(a, project(to)) : project(to);
    const near = (p: { lat: number; lng: number }) => nearSide(b, project(p));
    const flies = Boolean(a && Math.hypot(a.x - b.x, a.y - b.y) > 2);
    const c = flies ? arcControl(a!, b) : null;
    const marks = stops.map((s) => ({ ...s, at: near(s) }));
    const path = ground.map(near);
    const close = stopsView([...(path.length ? path : [b]), ...marks.map((m) => m.at)]);
    const wide = flies ? flightView(a!, b, c!) : null;
    return { a, b, c, flies, marks, path, close, wide };
  }, [from, to, stops, ground]);

  useEffect(() => {
    if (still) return;
    let raf = 0;
    const tick = (now: number) => {
      const m = now - t0;
      setMs(Math.min(m, t.end));
      if (m < t.end) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still, t0]);

  // The card's size: the overlay (home, plane, labels, stops) is placed in pixels over the SVG.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const { a, b, c, flies, marks, path, close, wide } = geo;
  const world0 = worldView();
  let view: View;
  if (ms < t.zoom[1]) view = between(world0, wide ?? close, easeInOut(part(ms, t.zoom)));
  else if (t.zoom2 && wide) view = between(wide, close, easeInOut(part(ms, t.zoom2)));
  else view = close;

  // Pixels per map unit now (the card fits the view: slice, at the same ratio).
  const scale = size ? Math.max(size.w / view.w, size.h / view.h) : 1;
  const toPx = (p: XY) => {
    if (!size) return { x: -999, y: -999 };
    const s = scale;
    return { x: (p.x - view.x) * s + (size.w - view.w * s) / 2, y: (p.y - view.y) * s + (size.h - view.h * s) / 2 };
  };

  const fly = t.flight ? easeInOut(part(ms, t.flight)) : 1;
  const flying = Boolean(flies && t.flight && ms >= t.flight[0] && ms < t.flight[1] && !still);
  const landed = ms >= t.land;
  const phase = ms < t.labels ? "zoom" : flying ? "flying" : ms >= t.end ? "done" : landed ? "landed" : "labels";
  let plane: { x: number; y: number; angle: number; alt: number } | null = null;
  if (flying) {
    const p = along(a!, c!, b, fly);
    const px = toPx(p);
    plane = { ...px, angle: p.angle + 90, alt: Math.sin(Math.PI * fly) };
  }
  const home = a ? toPx(a) : null;
  const dest = toPx(b);

  return withLang(lang, () => (
    <figure ref={card} className="gm" data-phase={phase} data-flies={flies ? "yes" : "no"}>
      <svg className="gm-svg" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid slice" role="img"
        aria-label={from ? L(`${from.name} → ${label}, haritada`, `${from.name} → ${label} on a map`) : L(`${label}, haritada`, `${label} on a map`)}>
        <defs>
          {flies && (
            <linearGradient id="gm-trail" gradientUnits="userSpaceOnUse" x1={a!.x} y1={a!.y} x2={b.x} y2={b.y}>
              <stop offset="0" stopColor="#5b45e0" stopOpacity=".15" />
              <stop offset="1" stopColor="#5b45e0" />
            </linearGradient>
          )}
        </defs>
        <rect x={-MAP_W} y={-MAP_W} width={MAP_W * 3} height={MAP_W * 3} className="gm-sea" />
        {/* Only the copies of the world in view (the side ones only near the date line): a third of the drawing per frame. */}
        {[-MAP_W, 0, MAP_W].filter((dx) => view.x < dx + MAP_W && view.x + view.w > dx).map((dx) => (
          <g key={dx} transform={dx ? `translate(${dx} 0)` : undefined}>
            <path d={world.land} className="gm-land" vectorEffect="non-scaling-stroke" />
            <path d={world.borders} className="gm-borders" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {flies && (
          <>
            <path d={arcPath(a!, c!, b)} className={`gm-ahead${landed || ms < t.labels ? " off" : ""}`} vectorEffect="non-scaling-stroke" />
            {/* Drawn behind the plane (its width in map units: a non-scaling stroke would break the dashes' reveal). */}
            <path d={arcPath(a!, c!, b)} className="gm-trail" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - (ms >= t.labels ? fly : 0)} strokeWidth={4 / scale} />
          </>
        )}
        {path.length > 1 && <path d={groundPath(path, t.ground, ms)} className="gm-ground" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="gm-ov" aria-hidden>
        {home && <div className={`gm-home${ms >= t.labels ? " in" : ""}`} style={{ left: home.x, top: home.y }}>⌂</div>}
        {flies && <div className={`gm-lbl${ms >= t.labels && !landed ? " in" : ""}`} style={{ left: dest.x, top: dest.y }}>{label}</div>}
        {flies && landed && !still && <div className="gm-ring go" style={{ left: dest.x, top: dest.y }} />}
        {plane && (
          <div className="gm-plane" style={{ left: plane.x, top: plane.y, transform: `rotate(${plane.angle}deg) scale(${0.85 + 0.4 * plane.alt})` }}>
            <svg className="gm-shadow" viewBox="0 0 24 24" style={{ transform: `translate(${6 + 12 * plane.alt}px, ${8 + 14 * plane.alt}px)` }}>
              <path d={PLANE} />
            </svg>
            <svg className="gm-body" viewBox="0 0 24 24">
              <path d={PLANE} />
            </svg>
          </div>
        )}
        {marks.map((m, i) => {
          const p = toPx(m.at);
          const left = size ? p.x > size.w * 0.62 : false;
          return (
            <div key={`${i}:${m.name}`} className={`gm-stop${m.fest ? " fest" : ""}${left ? " left" : ""}${ms >= (t.stops[i] ?? t.end) ? " in" : ""}`} style={{ left: p.x, top: p.y }} data-name={m.name}>
              <span className="gm-dot" />
              <span className="gm-nm">
                {m.name}
                {m.nights ? <span className="gm-n">{m.nights}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      <div className="gm-photos" aria-hidden>
        {photos.slice(0, 3).map((p, i) => (
          <div key={`${i}:${p.place}`} className={`gm-card gm-card-${i}${ms >= t.photos ? " in" : ""}`}>
            <span>{p.place}</span>
            {p.url && <img src={p.url} alt="" referrerPolicy="no-referrer" />}
          </div>
        ))}
      </div>
      <figcaption className="gm-credit">{L("Harita: Natural Earth", "Map: Natural Earth")}</figcaption>
    </figure>
  ));
}
