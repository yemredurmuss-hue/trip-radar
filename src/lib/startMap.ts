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
  if (to && where && stops.length < 2) to = { ...to, name: where.place };
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
