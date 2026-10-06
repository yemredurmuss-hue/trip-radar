// The trip on a real map (MapLibre GL, OpenFreeMap tiles, the globe): the stops as photos with their nights, home,
// the journeys as great circles (booked solid, the rest dashed) with how long each takes, and a plane that flies
// them. Two uses: "generate" (the start's generating screen: the globe zoomed out, the plane flies from home to the
// destination while the camera frames it, a pulse where it lands, then the stops) and "board" (the Harita tab: every
// journey, ▶ plays the trip, a stop shows its dates). The library loads only when a map opens (maplibre.ts). When it
// can't draw (no WebGL, offline; on the generating screen also no tiles within ~4 s) it says so through onUnavailable
// and draws nothing.
//
// What leaves the device: the map's region to OpenFreeMap (the tiles, fonts and icons for what's in view), and a stop's
// name when its photo isn't known yet, to the city-image proxy and Wikipedia (cityImages.ts). Nothing about the trip's
// dates, bookings or who goes.
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker } from "maplibre-gl";
import { pickCityImage, imageProxy } from "../../lib/cityImages";
import { formatDateRange } from "../../lib/items";
import { L, withLang, type Lang } from "../../lib/i18n";
import { nNights } from "../../lib/i18nText";
import { alongLine, boundsOf, easeInOutCubic, formatMinutes, greatCircle, km, lineUpTo, type LngLat } from "../../lib/mapArc";
import type { MapMode, MapPlace } from "../../lib/mapLegs";
import { PLANE } from "../start/FlightMap";
import { canDrawMap, loadMapLibre, MAP_STYLE, offline, type MapLibreGL } from "./maplibre";

export interface TripMapStop extends MapPlace {
  key: string;
  nights?: number | null;
  /** The first night and the check-out day, for the stop's popover. */
  start?: string | null;
  end?: string | null;
  /** The photo when it's known; else it's asked for by `photoQuery` (the city-image proxy, cityImages.ts). */
  photo?: string | null;
  photoQuery?: string | null;
}
export interface TripMapLeg {
  key: string;
  from: MapPlace;
  to: MapPlace;
  mode: MapMode | null;
  minutes: number | null;
  /** The time is worked out from the distance ("~"). */
  estimated?: boolean;
  booked: boolean;
}
export type TripMapFailure = "webgl" | "offline" | "timeout" | "error";
export interface TripMapProps {
  stops: TripMapStop[];
  legs: TripMapLeg[];
  home: MapPlace | null;
  /** The labels' language (the map's own place names too: Turkish first, else English). */
  lang: Lang;
  mode: "generate" | "board";
  /** Else the system's setting. The final frame at once, nothing moving. */
  reducedMotion?: boolean;
  /** Generate: the plane has landed (the photos fan in then). */
  onLanded?: () => void;
  /** The map can't be drawn: the caller shows what stands in for it. */
  onUnavailable?: (why: TripMapFailure) => void;
}

/** How long the tiles have to come before the map gives up (the bundled map stands in). */
export const MAP_LOAD_MS = 4000;
/** Generate: never further out than this at the end of the flight (the land seen, the globe filling the card). */
const GEN_MIN_ZOOM = 2.5;
/** Generate: the flight from home to the destination. */
export const FLY_MS = 2300;
const LAND_MS = 500;

const systemReduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Lucide's outlines (ISC licence, static/licenses/lucide.txt, shipped in dist/licenses/), one per way of going.
const ICONS: Record<MapMode | "any", string> = {
  flight:
    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  train:
    '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
  bus:
    '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  ferry:
    '<path d="M12 10.189V14"/><path d="M12 2v3"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76"/><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  car:
    '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  any: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
};
const modeName = (m: MapMode | null): string =>
  m === "flight" ? L("Uçak", "Flight") : m === "train" ? L("Tren", "Train") : m === "bus" ? L("Otobüs", "Bus") : m === "ferry" ? L("Feribot", "Ferry") : m === "car" ? L("Araba", "Car") : L("Yol", "Journey");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text != null) e.textContent = text;
  return e;
}
/** A constant icon (never a name or anything typed). */
function icon(paths: string, className = "tm-icon"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths;
  return svg;
}

/** Photos asked for by query, once per session. */
const photoCache = new Map<string, Promise<string | null>>();
function photoFor(query: string): Promise<string | null> {
  let p = photoCache.get(query);
  if (!p) {
    p = imageProxy()
      .then((proxy) => pickCityImage(query, { proxy, query }))
      .catch(() => null);
    photoCache.set(query, p);
  }
  return p;
}

/** The map's own place names in the board's language: Turkish first (else English, else the local name); English first on an English board. */
function nameLabels(map: MlMap, lang: Lang) {
  const field = lang === "en" ? ["coalesce", ["get", "name_en"], ["get", "name:en"], ["get", "name"]] : ["coalesce", ["get", "name:tr"], ["get", "name_en"], ["get", "name"]];
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== "symbol") continue;
    const text = (layer.layout as Record<string, unknown> | undefined)?.["text-field"];
    // Only labels that are names (a road's number stays its number).
    if (!text || !JSON.stringify(text).includes("name")) continue;
    try {
      map.setLayoutProperty(layer.id, "text-field", field);
    } catch {
      // A layer that won't take it keeps its own.
    }
  }
}

interface Drawn {
  markers: Marker[];
  lines: Map<string, LngLat[]>;
  /** The stops' markers (most nights first) and the pills with their journey's ends, for decluttering. */
  stops: { node: HTMLElement; at: LngLat; nights: number; key: string; img: HTMLImageElement }[];
  pills: { node: HTMLElement; from: LngLat; to: LngLat }[];
}

/** Closer than this on screen, a stop shows as a small pin beside the one with more nights; a journey this short hides its pill. */
const NEAR_PX = 76;

export function TripMap(props: TripMapProps) {
  const { stops, legs, home, lang, mode } = props;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<MapLibreGL | null>(null);
  const drawn = useRef<Drawn>({ markers: [], lines: new Map(), stops: [], pills: [] });
  const fitted = useRef(false);
  const handMoved = useRef(false);
  const anim = useRef(0);
  const flying = useRef<Marker | null>(null);
  const still = useMemo(() => props.reducedMotion ?? systemReduced(), [props.reducedMotion]);
  const [phase, setPhase] = useState<"loading" | "zoom" | "flying" | "landed" | "ready" | "failed">("loading");
  const [playing, setPlaying] = useState(false);
  const latest = useRef(props);
  latest.current = props;

  // The map, once: the library, the style, the globe; given up on when it can't come.
  useEffect(() => {
    let live = true;
    let loaded = false;
    let failed = false;
    const fail = (why: TripMapFailure) => {
      if (!live || failed || loaded) return;
      failed = true;
      setPhase("failed");
      mapRef.current?.remove();
      mapRef.current = null;
      latest.current.onUnavailable?.(why);
    };
    if (offline()) {
      queueMicrotask(() => fail("offline"));
      return () => void (live = false);
    }
    if (!canDrawMap()) {
      queueMicrotask(() => fail("webgl"));
      return () => void (live = false);
    }
    // The generating screen can't wait (the bundled map stands in); the board waits for a slow line.
    const timer = mode === "generate" ? setTimeout(() => fail("timeout"), MAP_LOAD_MS) : undefined;
    void loadMapLibre()
      .then((lib) => {
        if (!live || failed || !box.current) return;
        libRef.current = lib;
        const start = startCamera(latest.current);
        let map: MlMap;
        try {
          map = new lib.Map({
            container: box.current,
            style: MAP_STYLE,
            center: start.center,
            zoom: start.zoom,
            attributionControl: { compact: true },
            interactive: mode === "board",
            fadeDuration: still ? 0 : 300,
          });
        } catch {
          return fail("webgl");
        }
        mapRef.current = map;
        // Alive once the style is in and a first tile has come (the first full frame can take longer on a slow
        // line or a software GPU); until then the timer runs.
        let styled = false;
        const alive = () => {
          if (!live || failed || loaded || !styled) return;
          loaded = true;
          clearTimeout(timer);
          if (mode === "generate") generate(map);
          else setPhase("ready");
        };
        map.on("style.load", () => {
          try {
            map.setProjection({ type: "globe" });
          } catch {
            // Mercator then.
          }
          nameLabels(map, latest.current.lang);
          // A light sky round the globe (the card's own colour), never a black box.
          try {
            map.setSky({ "sky-color": "#c9bdff", "horizon-color": "#f4f0ff", "sky-horizon-blend": 0.7, "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0] });
          } catch {
            // No sky in this build: the card's colour shows.
          }
          addOverlays(map);
          styled = true;
          if (map.loaded()) alive();
        });
        map.on("data", (e: { dataType?: string; tile?: unknown }) => {
          if (e.dataType === "source" && e.tile) alive();
        });
        map.once("load", alive);
        map.on("moveend", () => declutter(map));
        // Moved by hand: the camera isn't fitted again over them (a programmatic move has no originalEvent).
        for (const ev of ["dragstart", "zoomstart", "rotatestart", "pitchstart"] as const) map.on(ev, (e: { originalEvent?: unknown }) => void (e.originalEvent && (handMoved.current = true)));
        map.on("error", (e: { sourceId?: string; tile?: unknown }) => {
          // Before the first frame, the style or the library failing is the map failing (a tile is waited for).
          if (!loaded && !e.sourceId && !e.tile) fail("error");
        });
      })
      .catch(() => fail("error"));
    return () => {
      live = false;
      clearTimeout(timer);
      cancelAnimationFrame(anim.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // What's drawn, as a key: a re-render with the same journeys and stops changes nothing (an open popover stays).
  const content = useMemo(() => JSON.stringify([stops, legs, home]), [stops, legs, home]);
  // The board's journeys and stops change as places are looked up: drawn again, the camera fitting them until the
  // map is moved by hand. The generating screen only takes photos that came after the landing.
  useEffect(() => {
    if (!mapRef.current) return;
    if (mode === "board" && phase === "ready") draw(mapRef.current);
    if (mode === "generate" && phase === "landed") refreshPhotos();
  }, [content, phase]);

  /** The journeys' lines (booked solid, the rest dashed) and the generating screen's flight, under the markers. */
  function addOverlays(map: MlMap) {
    if (map.getSource("tm-legs")) return;
    map.addSource("tm-legs", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "tm-legs-planned", type: "line", source: "tm-legs", filter: ["!", ["get", "booked"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#2a1f4d", "line-width": 3.5, "line-dasharray": [2, 1.4] } });
    map.addLayer({ id: "tm-legs-booked", type: "line", source: "tm-legs", filter: ["get", "booked"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#2a1f4d", "line-width": 3.5 } });
    map.addSource("tm-fly", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "tm-fly", type: "line", source: "tm-fly", layout: { "line-cap": "round" }, paint: { "line-color": "#5b45e0", "line-width": 4 } });
  }

  /** Where the camera starts: the generating screen far out on the globe, the board on its points. */
  function startCamera(p: TripMapProps): { center: LngLat; zoom: number } {
    const pts = pointsOf(p);
    const b = boundsOf(pts);
    if (!b) return { center: [20, 30], zoom: 1 };
    return { center: [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2], zoom: p.mode === "generate" ? 0.9 : 2 };
  }

  function lineOf(l: TripMapLeg): LngLat[] {
    const n = Math.max(16, Math.min(128, Math.round(km(l.from, l.to) / 40)));
    return greatCircle(l.from, l.to, n);
  }

  function clear() {
    for (const m of drawn.current.markers) m.remove();
    drawn.current = { markers: [], lines: new Map(), stops: [], pills: [] };
  }

  function setLegs(map: MlMap, list: TripMapLeg[]) {
    const features = list.map((l) => {
      const line = drawn.current.lines.get(l.key) ?? lineOf(l);
      drawn.current.lines.set(l.key, line);
      return { type: "Feature" as const, properties: { booked: l.booked, key: l.key }, geometry: { type: "LineString" as const, coordinates: line } };
    });
    (map.getSource("tm-legs") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  }

  function addMarker(map: MlMap, node: HTMLElement, at: LngLat, anchor: "center" | "bottom" = "center") {
    const lib = libRef.current!;
    const m = new lib.Marker({ element: node, anchor }).setLngLat(at).addTo(map);
    drawn.current.markers.push(m);
    return m;
  }

  function homeMarker(map: MlMap, h: MapPlace) {
    const node = el("div", "tm-home", "⌂");
    node.title = withLang(lang, () => L(`Ev: ${h.name}`, `Home: ${h.name}`));
    node.dataset.name = h.name;
    addMarker(map, node, [h.lng, h.lat]);
  }

  function stopMarker(map: MlMap, s: TripMapStop, fade: boolean, count = 1) {
    const node = el("div", `tm-stop${fade ? " tm-in" : ""}${count > 1 ? " tm-all" : ""}`);
    node.dataset.name = s.name;
    node.dataset.stops = String(count);
    const name = el("span", "tm-name", s.name);
    const ph = el("span", "tm-ph");
    ph.append(el("span", "tm-initial", s.name.slice(0, 1)));
    const img = el("img", "");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => img.remove();
    img.onload = () => img.classList.add("in");
    if (s.photo) img.src = s.photo;
    else if (s.photoQuery) void photoFor(s.photoQuery).then((url) => url && img.isConnected && (img.src = url));
    ph.append(img);
    if (s.nights) ph.append(el("span", "tm-n", String(s.nights)));
    node.append(name, ph);
    if (mode === "board") {
      node.tabIndex = 0;
      node.setAttribute("role", "button");
      const open = () => {
        const was = node.querySelector(".tm-pop");
        for (const p of box.current?.querySelectorAll(".tm-pop") ?? []) p.remove();
        if (was) return;
        const pop = el("div", "tm-pop");
        withLang(lang, () => {
          pop.append(el("strong", "", s.name));
          if (s.start) pop.append(el("span", "tm-pop-when", formatDateRange(s.start, s.end ?? null)));
          if (s.nights) pop.append(el("span", "tm-pop-nights", nNights(s.nights)));
        });
        node.append(pop);
      };
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        open();
      });
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
      node.setAttribute("aria-label", withLang(lang, () => [s.name, s.start ? formatDateRange(s.start, s.end ?? null) : "", s.nights ? nNights(s.nights) : ""].filter(Boolean).join(", ")));
    }
    addMarker(map, node, [s.lng, s.lat], "bottom");
    drawn.current.stops.push({ node, at: [s.lng, s.lat], nights: s.nights ?? 0, key: s.key, img });
  }

  function pill(map: MlMap, l: TripMapLeg) {
    const line = drawn.current.lines.get(l.key) ?? lineOf(l);
    const node = el("div", `tm-dur${l.booked ? " booked" : ""}`);
    node.dataset.mode = l.mode ?? "any";
    node.dataset.from = l.from.name;
    node.dataset.to = l.to.name;
    node.dataset.booked = String(l.booked);
    node.append(icon(ICONS[l.mode ?? "any"]));
    withLang(lang, () => {
      const time = l.minutes != null ? formatMinutes(l.minutes, l.estimated) : null;
      if (time) node.append(el("span", "", time));
      node.title = `${l.from.name} → ${l.to.name} · ${modeName(l.mode)}${time ? ` · ${time}` : ""} · ${l.booked ? L("rezerve", "booked") : L("planlanıyor", "planned")}`;
    });
    addMarker(map, node, alongLine(line, 0.5).at);
    drawn.current.pills.push({ node, from: [l.from.lng, l.from.lat], to: [l.to.lng, l.to.lat] });
  }

  /**
   * Stops a few pixels apart (Amsterdam and Rotterdam seen from Istanbul): the one with more nights keeps its photo,
   * the other is a small pin with its name; a journey too short to see hides its pill. Again after every move.
   */
  function declutter(map: MlMap) {
    const placed: { x: number; y: number }[] = [];
    const order = [...drawn.current.stops].sort((a, b) => b.nights - a.nights);
    for (const s of order) {
      const pt = map.project(s.at);
      const near = placed.some((q) => Math.hypot(q.x - pt.x, q.y - pt.y) < NEAR_PX);
      s.node.classList.toggle("tm-near", near);
      if (!near) placed.push(pt);
    }
    for (const p of drawn.current.pills) {
      const [a, b] = [map.project(p.from), map.project(p.to)];
      p.node.classList.toggle("tm-short", Math.hypot(a.x - b.x, a.y - b.y) < NEAR_PX * 1.4);
    }
  }

  /** The board: every journey, the stops and home; the camera fits them the first time there are any. */
  function draw(map: MlMap) {
    const p = latest.current;
    clear();
    setLegs(map, p.legs);
    for (const l of p.legs) pill(map, l);
    if (p.home) homeMarker(map, p.home);
    for (const s of p.stops) stopMarker(map, s, false);
    declutter(map);
    const b = boundsOf(pointsOf(p, drawn.current.lines));
    if (b && !handMoved.current) {
      map.fitBounds(b, { padding: { top: 110, bottom: 50, left: 70, right: 70 }, maxZoom: 6, duration: fitted.current && !still ? 500 : 0 });
      fitted.current = true;
    }
  }

  /** A stop's photo that came after its marker (the generating screen finds them while the plane flies). */
  function refreshPhotos() {
    const p = latest.current;
    for (const d of drawn.current.stops) {
      const photo = d.key === "all" ? p.stops[0]?.photo : p.stops.find((s) => s.key === d.key)?.photo;
      if (photo && !d.img.getAttribute("src") && d.img.isConnected) d.img.src = photo;
    }
  }

  /** The generating screen: home, the flight drawn as the plane flies it, a pulse where it lands, then the stops. */
  function generate(map: MlMap) {
    const p = latest.current;
    // The flight is the way out from home; without a home there's no flight, only the stops.
    const fly = p.legs.find((l) => l.key === "out") ?? null;
    const line = fly ? lineOf(fly) : [];
    if (fly) drawn.current.lines.set(fly.key, line);
    const rest = p.legs.filter((l) => l !== fly);
    const all = pointsOf(p, drawn.current.lines);
    const b = boundsOf(all);
    // The flight framed (room above for the stop's photo and name): the globe fills the card, its curve only at the
    // edges. A long haul still close enough to see the land (never further out than GEN_MIN_ZOOM).
    const fit = b ? map.cameraForBounds(b, { padding: { top: 104, bottom: 64, left: 56, right: 56 }, maxZoom: 5 }) : undefined;
    const cam = fit ? { ...fit, zoom: Math.max(fit.zoom ?? GEN_MIN_ZOOM, GEN_MIN_ZOOM) } : undefined;
    if (p.home) homeMarker(map, p.home);
    const flySource = map.getSource("tm-fly") as GeoJSONSource | undefined;
    const setFly = (coords: LngLat[]) => flySource?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
    const landed = () => {
      // Gone meanwhile (the board opened): nothing to land on.
      if (mapRef.current !== map) return;
      // As they are now (photos found while it flew).
      const p = latest.current;
      setPhase("landed");
      if (fly) {
        const pulse = el("div", `tm-pulse${still ? "" : " go"}`);
        addMarker(map, pulse, [fly.to.lng, fly.to.lat]);
      }
      setLegs(map, rest);
      // Stops too close to tell apart at this distance (Sri Lanka's four): one marker for them all, named by the
      // destination ("Sri Lanka · 4 durak · 14 gece"), not by whichever stop would cover the others.
      const pts = p.stops.map((s) => map.project([s.lng, s.lat]));
      const crowded = pts.some((a, i) => pts.some((b, k) => k > i && Math.hypot(a.x - b.x, a.y - b.y) < NEAR_PX));
      if (crowded && p.stops.length > 1) {
        const nights = p.stops.every((s) => s.nights) ? p.stops.reduce((n, s) => n + (s.nights ?? 0), 0) : null;
        const place = fly?.to.name ?? p.stops[0].name;
        const name = withLang(lang, () => [place, L(`${p.stops.length} durak`, `${p.stops.length} stops`), nights ? nNights(nights) : ""].filter(Boolean).join(" · "));
        const mid = { lat: p.stops.reduce((n, s) => n + s.lat, 0) / p.stops.length, lng: p.stops.reduce((n, s) => n + s.lng, 0) / p.stops.length };
        const first = p.stops[0];
        stopMarker(map, { key: "all", name, ...mid, nights: null, photo: first.photo, photoQuery: first.photoQuery }, !still, p.stops.length);
      } else {
        for (const s of p.stops) stopMarker(map, s, !still);
        declutter(map);
      }
      p.onLanded?.();
    };
    if (still || !fly) {
      if (cam) map.jumpTo(cam);
      if (fly) setFly(line);
      return landed();
    }
    setPhase("zoom");
    const planeNode = el("div", "tm-plane");
    planeNode.append(icon(`<g transform="translate(12 12) rotate(-90) scale(.78)"><path d="${PLANE}"/></g>`, "tm-plane-svg"));
    const lib = libRef.current!;
    const plane = new lib.Marker({ element: planeNode, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat(line[0]).addTo(map);
    drawn.current.markers.push(plane);
    if (cam) map.easeTo({ ...cam, duration: FLY_MS, easing: easeInOutCubic });
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / FLY_MS);
      const e = easeInOutCubic(t);
      if (t > 0.05) setPhase("flying");
      const at = alongLine(line, e);
      plane.setLngLat(at.at).setRotation(at.heading);
      setFly(lineUpTo(line, e));
      if (t < 1) anim.current = requestAnimationFrame(tick);
      else {
        plane.remove();
        setTimeout(landed, LAND_MS / 2);
      }
    };
    anim.current = requestAnimationFrame(tick);
  }

  /** ▶: the plane flies the journeys in order, the camera following it; the whole trip again at the end. */
  function play() {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    if (playing) {
      cancelAnimationFrame(anim.current);
      flying.current?.remove();
      setPlaying(false);
      return;
    }
    const legsNow = latest.current.legs;
    if (!legsNow.length) return;
    setPlaying(true);
    const planeNode = el("div", "tm-plane");
    planeNode.append(icon(`<g transform="translate(12 12) rotate(-90) scale(.78)"><path d="${PLANE}"/></g>`, "tm-plane-svg"));
    const plane = new lib.Marker({ element: planeNode, rotationAlignment: "map", pitchAlignment: "map" }).setLngLat([legsNow[0].from.lng, legsNow[0].from.lat]).addTo(map);
    flying.current = plane;
    const parts = legsNow.map((l) => {
      const line = drawn.current.lines.get(l.key) ?? lineOf(l);
      const b = boundsOf(line)!;
      const zoom = Math.min(6, map.cameraForBounds(b, { padding: 80 })?.zoom ?? 4);
      return { line, zoom, ms: Math.min(3200, Math.max(1300, 900 + km(l.from, l.to) * 0.9)) };
    });
    let i = 0;
    let t0 = performance.now();
    let z0 = map.getZoom();
    const tick = (now: number) => {
      const part = parts[i];
      const t = Math.min(1, (now - t0) / part.ms);
      const e = easeInOutCubic(t);
      const at = alongLine(part.line, e);
      plane.setLngLat(at.at).setRotation(at.heading);
      map.jumpTo({ center: at.at, zoom: z0 + (part.zoom - z0) * easeInOutCubic(Math.min(1, t * 2)) });
      if (t < 1) {
        anim.current = requestAnimationFrame(tick);
        return;
      }
      i++;
      if (i < parts.length) {
        t0 = now;
        z0 = map.getZoom();
        anim.current = requestAnimationFrame(tick);
        return;
      }
      plane.remove();
      setPlaying(false);
      const b = boundsOf(pointsOf(latest.current, drawn.current.lines));
      if (b) map.fitBounds(b, { padding: { top: 110, bottom: 50, left: 70, right: 70 }, maxZoom: 6, duration: 1200 });
    };
    anim.current = requestAnimationFrame(tick);
  }

  const out = legs.find((l) => l.key === "out");
  const label = withLang(lang, () =>
    mode === "generate" && out ? L(`${out.from.name} → ${out.to.name} uçuşu, haritada`, `The flight ${out.from.name} → ${out.to.name} on a map`) : L("Gezinin haritası", "The trip's map"),
  );
  if (phase === "failed") return null;
  return (
    <figure className={mode === "generate" ? "st-map tm tm-generate" : "tm tm-board"} data-phase={phase} data-playing={playing || undefined} aria-label={label} role="group"
      onClick={() => box.current?.querySelectorAll(".tm-pop").forEach((n) => n.remove())}>
      <div className="tm-canvas" ref={box} />
      {mode === "board" && !still && legs.length > 0 && (
        <button type="button" className="tm-play" onClick={(e) => (e.stopPropagation(), play())} aria-pressed={playing}
          title={withLang(lang, () => (playing ? L("Durdur", "Stop") : L("Geziyi oynat", "Play the trip")))}
          aria-label={withLang(lang, () => (playing ? L("Durdur", "Stop") : L("Geziyi oynat", "Play the trip")))}>
          {playing ? "■" : "▶"}
        </button>
      )}
    </figure>
  );
}

/** Every point to frame: home, the stops, and the journeys' lines (a great circle bends north of its ends). */
function pointsOf(p: Pick<TripMapProps, "stops" | "legs" | "home">, lines?: Map<string, LngLat[]>): LngLat[] {
  const pts: LngLat[] = [];
  if (p.home) pts.push([p.home.lng, p.home.lat]);
  for (const s of p.stops) pts.push([s.lng, s.lat]);
  for (const l of p.legs) {
    const line = lines?.get(l.key);
    if (line) pts.push(...line.filter((_, i) => i % 4 === 0), line[line.length - 1]);
    else pts.push([l.from.lng, l.from.lat], [l.to.lng, l.to.lat]);
  }
  return pts;
}
