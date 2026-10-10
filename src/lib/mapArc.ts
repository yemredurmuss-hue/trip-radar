// The trip map's geometry (TripMap, MapLibre), pure: the great circle between two places as a line the map can
// draw (its longitudes kept continuous across the date line), a point and heading along a line, the distance, and
// a leg's time as the pill on it says it ("4 sa 55 dk").
import { L } from "./i18n";

export interface LatLng {
  lat: number;
  lng: number;
}
/** [lng, lat], as GeoJSON and MapLibre take it. */
export type LngLat = [number, number];

const RAD = Math.PI / 180;

/** Kilometres along the earth between two places. */
export function km(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The great circle from a to b in `n` steps, as [lng, lat]. Longitudes stay continuous (Tokyo → Los Angeles goes
 * past 180 instead of jumping back to -180), so the line crosses the Pacific, not the whole map.
 */
export function greatCircle(a: LatLng, b: LatLng, n = 64): LngLat[] {
  const [l1, p1, l2, p2] = [a.lng * RAD, a.lat * RAD, b.lng * RAD, b.lat * RAD];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  if (!(d > 1e-9)) return [[a.lng, a.lat], [b.lng, b.lat]];
  const out: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    let lng = Math.atan2(y, x) / RAD;
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD;
    const prev = out[out.length - 1];
    if (prev) while (lng - prev[0] > 180) lng -= 360;
    if (prev) while (lng - prev[0] < -180) lng += 360;
    out.push([lng, lat]);
  }
  return out;
}

/** The compass heading from one point to the next (0 = north, clockwise), for the plane. */
export function heading(from: LngLat, to: LngLat): number {
  const [l1, p1, l2, p2] = [from[0] * RAD, from[1] * RAD, to[0] * RAD, to[1] * RAD];
  const y = Math.sin(l2 - l1) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1);
  return ((Math.atan2(y, x) / RAD) + 360) % 360;
}

/** The point at share t (0–1) along a line of points (by index, the points being evenly spaced), and its heading. */
export function alongLine(line: LngLat[], t: number): { at: LngLat; heading: number } {
  if (line.length < 2) return { at: line[0] ?? [0, 0], heading: 0 };
  const x = Math.min(1, Math.max(0, t)) * (line.length - 1);
  const i = Math.min(line.length - 2, Math.floor(x));
  const f = x - i;
  const [a, b] = [line[i], line[i + 1]];
  return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: heading(a, b) };
}

/** The first share t (0–1) of a line, its last point where the plane is. */
export function lineUpTo(line: LngLat[], t: number): LngLat[] {
  if (line.length < 2 || t >= 1) return line;
  const x = Math.max(0, t) * (line.length - 1);
  const i = Math.floor(x);
  return [...line.slice(0, i + 1), alongLine(line, t).at];
}

/** The box [[west, south], [east, north]] around the points (longitudes as given: a line past 180 stays one box). */
export function boundsOf(points: LngLat[]): [LngLat, LngLat] | null {
  if (!points.length) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]];
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Roughly how long a flight of this distance takes (cruise ~800 km/h, half an hour of take-off and landing). */
export const flightMinutes = (distanceKm: number): number => Math.round(((distanceKm / 800) * 60 + 30) / 5) * 5;

/** "4 sa 55 dk", "50 dk", "3 sa" ("4 h 55 min" in English); "~" before an estimate. */
export function formatMinutes(minutes: number, estimated = false): string {
  const m = Math.max(0, Math.round(minutes));
  const [h, r] = [Math.floor(m / 60), m % 60];
  const text = h && r ? L(`${h} sa ${r} dk`, `${h} h ${r} min`) : h ? L(`${h} sa`, `${h} h`) : L(`${r} dk`, `${r} min`);
  return estimated ? `~${text}` : text;
}
