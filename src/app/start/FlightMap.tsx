// The generating screen's map (rev 3): the world (bundled, static/map/world.json: Natural Earth, no network) fades
// in, closes in on where the trip leaves from and where it goes, a curved line draws between them while a small plane
// flies along it, a soft pulse where it lands, then the stops joined by a dashed line. With reduced motion: the same
// picture at once, nothing moving.
import { useEffect, useMemo, useRef, useState } from "react";
import { L, withLang, type Lang } from "../../lib/i18n";
import { along, arcControl, arcPath, between, easeInOut, frame, MAP_W, nearSide, project, stopsPath, widen, type MapPoint, type View, type XY } from "../../lib/startMap";

/** The map data as bundled (made by scripts/build-world-map.mjs). */
export interface WorldMap {
  w: number;
  h: number;
  land: string;
  borders: string;
  centroids: Record<string, [number, number]>;
}

let loaded: Promise<WorldMap | null> | null = null;
/** The bundled map, read once (null when it can't be: the screen shows the photos only). */
export function loadWorld(): Promise<WorldMap | null> {
  loaded ??= fetch("map/world.json")
    .then((r) => (r.ok ? (r.json() as Promise<WorldMap>) : null))
    .catch(() => null);
  return loaded;
}

/** The timeline, in ms from the map's first frame. */
export const MAP_TIMES = { zoom: [150, 1250], flight: [1250, 3250], land: 3250, stops: [3400, 4200], end: 4300 } as const;
/** The SVG's width over its height. */
const ASPECT = 16 / 9;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const part = (ms: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (ms - a) / (b - a)));

/** A small plane pointing east (rotated to the curve). */
const PLANE = "M-10 -1.6 L3 -1.6 L-2 -9 L1.6 -9 L9 -1.6 L12 -1.6 Q15 0 12 1.6 L9 1.6 L1.6 9 L-2 9 L3 1.6 L-10 1.6 L-12.5 5 L-14.5 5 L-12.8 0 L-14.5 -5 L-12.5 -5 Z";

/**
 * What the map is given (kept small: a map library can take its place with the same props): where the flight leaves
 * from and lands, the stops, the chat's language (its label and credit, whatever the board's), reduced motion (else
 * the system's setting), and a call once it has landed (the photos fan in then).
 */
export interface FlightMapProps {
  from: MapPoint | null;
  to: MapPoint;
  stops: MapPoint[];
  lang: Lang;
  reducedMotion?: boolean;
  onLanded?: () => void;
}

/** The map once its data is read (the bundled world, read once); nothing when it can't be (landed at once). */
export function FlightMap(props: FlightMapProps) {
  const [world, setWorld] = useState<WorldMap | null | "loading">("loading");
  useEffect(() => {
    let live = true;
    void loadWorld().then((w) => {
      if (!live) return;
      setWorld(w);
      if (!w) props.onLanded?.();
    });
    return () => {
      live = false;
    };
  }, []);
  if (world === "loading") return <div className="st-map st-map-wait" aria-hidden />;
  return world ? <WorldFlight world={world} {...props} /> : null;
}

/** The map drawn from its data (exported for the tests). */
export function WorldFlight({ world, from, to, stops: stopPoints, lang, reducedMotion: reduced, onLanded }: FlightMapProps & { world: WorldMap }) {
  const points = { from, to, stops: stopPoints };
  const still = useMemo(() => reduced ?? reducedMotion(), [reduced]);
  const [ms, setMs] = useState(still ? MAP_TIMES.end : 0);
  const landedSaid = useRef(false);

  const a: XY | null = points.from ? project(points.from) : null;
  // The shorter way round: across the Pacific a map's width over (the land is drawn three times side by side).
  const b: XY | null = points.to ? (a ? nearSide(a, project(points.to)) : project(points.to)) : null;
  const flies = Boolean(a && b && Math.hypot(a.x - b.x, a.y - b.y) > 2);
  const c = flies ? arcControl(a!, b!) : null;
  const stops = points.stops.map((p) => (b ? nearSide(b, project(p)) : project(p)));
  const end: View = useMemo(() => frame([...(a ? [a] : []), ...(b ? [b] : []), ...(c ? [c] : []), ...stops], ASPECT), [from, to, stopPoints]);
  const start = useMemo(() => widen(end, 2.6), [end]);

  useEffect(() => {
    if (still) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      setMs(Math.min(t, MAP_TIMES.end));
      if (t < MAP_TIMES.end) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  const landed = !flies || ms >= MAP_TIMES.land;
  useEffect(() => {
    if (landed && !landedSaid.current) {
      landedSaid.current = true;
      onLanded?.();
    }
  }, [landed]);

  const view = between(start, end, easeInOut(part(ms, MAP_TIMES.zoom)));
  const fly = easeInOut(part(ms, MAP_TIMES.flight));
  const plane = flies ? along(a!, c!, b!, still ? 0.97 : fly) : null;
  // Sizes in map units that look the same whatever the zoom.
  const u = view.w / 100;
  const dash = part(ms, MAP_TIMES.stops);

  return withLang(lang, () => (
    <figure className="st-map" data-phase={!flies ? "here" : landed ? "landed" : ms < MAP_TIMES.flight[0] ? "zoom" : "flying"}>
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid slice" role="img"
        aria-label={points.from && points.to ? L(`${points.from.name} → ${points.to.name} uçuşu, haritada`, `The flight ${points.from.name} → ${points.to.name} on a map`) : L("Harita", "Map")}>
        <rect x={-MAP_WIDE} y={-MAP_WIDE} width={MAP_WIDE * 3} height={MAP_WIDE * 3} className="st-map-sea" />
        {[-MAP_W, 0, MAP_W].map((dx) => (
          <g key={dx} transform={dx ? `translate(${dx} 0)` : undefined}>
            <path d={world.land} className="st-map-land" />
            <path d={world.borders} className="st-map-borders" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {flies && (
          <path d={arcPath(a!, c!, b!)} className="st-map-arc" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - (still ? 1 : fly)} strokeWidth={0.5 * u} />
        )}
        {stops.length > 1 && landed && (
          <path d={stopsPath(stops)} className="st-map-stops" strokeWidth={0.35 * u} strokeDasharray={`${u} ${0.8 * u}`} style={{ opacity: still ? 1 : dash }} />
        )}
        {landed && stops.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={0.9 * u} className="st-map-stop" style={{ opacity: still ? 1 : dash }} />)}
        {a && <circle cx={a.x} cy={a.y} r={1.1 * u} className="st-map-from" />}
        {b && landed && (
          <g className="st-map-pulse">
            <circle cx={b.x} cy={b.y} r={1.3 * u} className="st-map-to" />
            {!still && <circle cx={b.x} cy={b.y} r={1.3 * u} className="st-map-ring" />}
          </g>
        )}
        {points.from && a && <MapLabel at={a} text={points.from.name} u={u} />}
        {points.to && b && landed && <MapLabel at={b} text={points.to.name} u={u} />}
        {plane && (
          <g className="st-map-plane" transform={`translate(${plane.x} ${plane.y}) rotate(${plane.angle}) scale(${(u * 2.1) / 24})`}>
            <path d={PLANE} />
          </g>
        )}
      </svg>
      <figcaption className="st-map-credit">{L("Harita: Natural Earth", "Map: Natural Earth")}</figcaption>
    </figure>
  ));
}

/** Room around the map for the sea while the view moves. */
const MAP_WIDE = 1200;

function MapLabel({ at, text, u }: { at: XY; text: string; u: number }) {
  return (
    <text x={at.x} y={at.y - 2.4 * u} className="st-map-label" fontSize={3.4 * u} textAnchor="middle" strokeWidth={0.9 * u}>
      {text}
    </text>
  );
}
