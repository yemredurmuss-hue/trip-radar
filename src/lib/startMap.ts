// The generating screen's map (rev 3), pure: the projection the bundled world map (static/map/world.json, made by
// scripts/build-world-map.mjs from Natural Earth) is drawn in, the points of a trip (where they leave from, where
// they land, the stops), the view that frames them, and the curved flight between them. No network, no map API.
import { cityCoord, SMALL_COUNTRIES } from "./startCircuits";
import { countryCodeOfName, stopsOf, type StartState } from "./startTrip";

/** Equirectangular, cropped to the inhabited latitudes: the same numbers as scripts/build-world-map.mjs. */
export const MAP_W = 1000;
export const LAT_TOP = 84;
export const LAT_BOTTOM = -57;
export const MAP_H = Math.round((MAP_W * (LAT_TOP - LAT_BOTTOM)) / 360);

export interface LatLng {
  lat: number;
  lng: number;
}
export interface MapPoint extends LatLng {
  name: string;
}
export interface XY {
  x: number;
  y: number;
}
export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A place on the map (x right, y down, in map units). */
export function project(p: LatLng): XY {
  return { x: ((p.lng + 180) / 360) * MAP_W, y: ((LAT_TOP - p.lat) / (LAT_TOP - LAT_BOTTOM)) * MAP_H };
}

/** The map data's own centroids, by ISO code ([lng, lat]); small countries it has no outline for from the table. */
export function centroidOf(code: string | null | undefined, centroids: Record<string, [number, number]> | null): LatLng | null {
  if (!code) return null;
  const c = centroids?.[code];
  if (c) return { lng: c[0], lat: c[1] };
  const small = SMALL_COUNTRIES[code];
  return small ? { lat: small[0], lng: small[1] } : null;
}

/** Where the trip leaves from, where it lands, and its stops (only the ones the table places), for the map. */
export interface TripPoints {
  from: MapPoint | null;
  to: MapPoint | null;
  stops: MapPoint[];
}

/**
 * The trip on the map: the origin city; the destination as its first stop, else the place itself, else its
 * country's centre; the stops when at least two of them are known.
 */
export function tripPoints(s: Pick<StartState, "from" | "where" | "route" | "duration" | "start">, centroids: Record<string, [number, number]> | null): TripPoints {
  const at = (name: string | null | undefined): MapPoint | null => {
    const c = cityCoord(name);
    return c && name ? { ...c, name } : null;
  };
  const from = at(s.from);
  const where = s.where;
  const stops = (s.route?.stops ?? stopsOf(s as StartState)).flatMap((x) => at(x.city) ?? []);
  // The first stop that isn't home (a trip at home may start where it leaves from).
  const away = stops.find((x) => !from || Math.hypot(x.lat - from.lat, x.lng - from.lng) > 0.3);
  let to: MapPoint | null = away ?? at(where?.place);
  if (!to && where) {
    const code = where.code ?? countryCodeOfName(where.country) ?? countryCodeOfName(where.place);
    const c = centroidOf(code, centroids);
    if (c) to = { ...c, name: where.place };
  }
  // Labelled with the destination ("Sri Lanka", not its first stop).
  if (to && where) to = { ...to, name: where.place };
  return { from, to, stops: stops.length >= 2 ? stops : [] };
}

/**
 * The view that frames the points with room around them, at the given width/height ratio: never narrower than
 * `minW` map units (a single island isn't zoomed into a blur), never wider than the map. The lowest `bottom` share
 * is kept free (the photos fan in over it), the points framed in the rest.
 */
export function frame(points: XY[], aspect: number, pad = 0.28, minW = 150, bottom = 0.24): View {
  if (!points.length) return { x: 0, y: (MAP_H - MAP_W / aspect) / 2, w: MAP_W, h: MAP_W / aspect };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let w = Math.max(minW, (x1 - x0) * (1 + 2 * pad), ((y1 - y0) * (1 + 2 * pad) * aspect) / (1 - bottom));
  w = Math.min(w, MAP_W);
  const h = w / aspect;
  const usable = h * (1 - bottom);
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - usable / 2, w, h };
}

/** A view eased towards another (t from 0 to 1). */
export function between(a: View, b: View, t: number): View {
  const k = Math.min(1, Math.max(0, t));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k };
}

/** The same view zoomed out around its centre (the map's first frame, before it closes in). */
export function widen(v: View, by: number): View {
  const w = Math.min(MAP_W * 1.1, v.w * by);
  const h = (w * v.h) / v.w;
  return { x: v.x + v.w / 2 - w / 2, y: v.y + v.h / 2 - h / 2, w, h };
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The point as seen from another across the shorter way round (rev 3): New York → Japan crosses the Pacific, the
 * destination drawn a map's width to the left (the map is drawn three times side by side).
 */
export function nearSide(from: XY, to: XY): XY {
  const dx = to.x - from.x;
  return dx > MAP_W / 2 ? { ...to, x: to.x - MAP_W } : dx < -MAP_W / 2 ? { ...to, x: to.x + MAP_W } : to;
}

/** The flight's bend: a control point off the middle of the line, on its upper side (great-circle-like). */
export function arcControl(a: XY, b: XY): XY {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // The normal pointing up the map (smaller y).
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) [nx, ny] = [-nx, -ny];
  const bend = Math.min(len * 0.28, 120);
  return { x: mx + nx * bend, y: my + ny * bend };
}

/** The point at t along the quadratic curve a → b (control c), and its heading in degrees (0 = east, clockwise). */
export function along(a: XY, c: XY, b: XY, t: number): XY & { angle: number } {
  const u = 1 - t;
  const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
  const y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
  const dx = 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x);
  const dy = 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The curve as an SVG path. */
export const arcPath = (a: XY, c: XY, b: XY): string => `M${r1(a.x)} ${r1(a.y)}Q${r1(c.x)} ${r1(c.y)} ${r1(b.x)} ${r1(b.y)}`;

/** The stops joined in order (a dashed line after landing). */
export const stopsPath = (points: XY[]): string => points.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join("");

// --- the generating screen's map, v5 (2026-10-06 mockup): its timeline and its frames ----------------------------

/** The map card's width over its height (v5). */
export const GEN_ASPECT = 2.5;

/** The whole world at the card's ratio (the first frame). */
export const worldView = (aspect = GEN_ASPECT): View => ({ x: 0, y: (MAP_H - MAP_W / aspect) / 2, w: MAP_W, h: MAP_W / aspect });

/**
 * The v5 sequence, in ms from the map's first frame: the world closes in on the flight's frame; home and the
 * destination's label appear; the plane flies the arc; a ring where it lands; the view closes in on the stops; they
 * drop one by one; the ground route draws leg by leg; the photos fan in. Without a flight (no home, or home is
 * there): the world closes in on the stops directly.
 */
export interface GenTimeline {
  zoom: [number, number];
  labels: number;
  flight: [number, number] | null;
  land: number;
  zoom2: [number, number] | null;
  /** When each stop drops. */
  stops: number[];
  /** When each leg of the ground route starts and ends. */
  ground: [number, number][];
  photos: number;
  end: number;
}

export function genTimeline(flies: boolean, stops: number, legs: number): GenTimeline {
  const zoom: [number, number] = [0, flies ? 1200 : 1400];
  const labels = zoom[1];
  const flight: [number, number] | null = flies ? [labels + 550, labels + 550 + 2500] : null;
  const land = flight ? flight[1] : labels;
  const zoom2: [number, number] | null = flies ? [land, land + 1400] : null;
  const first = (zoom2 ? zoom2[1] : land) + 100;
  const drops = Array.from({ length: stops }, (_, i) => first + i * 300);
  const ground: [number, number][] = Array.from({ length: legs }, (_, i) => [first + i * 350, first + (i + 1) * 350]);
  const photos = Math.max(drops.at(-1) ?? first, ground.at(-1)?.[1] ?? first) + 250;
  return { zoom, labels, flight, land, zoom2, stops: drops, ground, photos, end: photos + 900 };
}

/** The board opens this long after the map started at the latest, landed or not (a slow device never holds it). */
export const OPEN_CAP_MS = 6000;

/**
 * How long the made trip waits before its board opens (the trip is made at its own pace, never waiting on the map):
 * until the plane has landed, at most until OPEN_CAP_MS after the map started; a short breath once that has passed.
 */
export const openDelay = (land: number, elapsed: number): number => Math.max(300, Math.min(land, OPEN_CAP_MS) - elapsed);

/** Whether there is a flight to draw: home known and not where the trip lands (the shorter way round). */
export function fliesBetween(from: LatLng | null, to: LatLng): boolean {
  if (!from) return false;
  const a = project(from);
  const b = nearSide(a, project(to));
  return Math.hypot(a.x - b.x, a.y - b.y) > 2;
}

/** The flight's frame: home, the destination and the arc's bend, with room around them. */
export const flightView = (a: XY, b: XY, c: XY, aspect = GEN_ASPECT): View =>
  frame([a, b, { x: (a.x + 2 * c.x + b.x) / 4, y: (a.y + 2 * c.y + b.y) / 4 }], aspect, 0.18, 120, 0);

/** The stops' frame, close (a single place isn't zoomed into a blur: 36 map units at least, ~13° of longitude). */
export const stopsView = (points: XY[], aspect = GEN_ASPECT): View => frame(points, aspect, 0.4, 36, 0.12);

/** The ground route drawn up to `ms`, leg by leg (the leg on its way partly). */
export function groundPath(points: XY[], ground: [number, number][], ms: number): string {
  if (points.length < 2) return "";
  const out: XY[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [s, e] = ground[i - 1] ?? [0, 0];
    if (ms <= s) break;
    const k = Math.min(1, (ms - s) / Math.max(1, e - s));
    const a = points[i - 1];
    const b = points[i];
    out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    if (k < 1) break;
  }
  return out.length > 1 ? stopsPath(out) : "";
}
