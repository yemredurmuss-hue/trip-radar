// Distances and free geocoding (OpenStreetMap Nominatim, cached; at most ~1 request per second).
import { db } from "./db";
import { L, locale } from "./i18n";
import type { Geo } from "./types";

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Street distance is ~1.25× the straight line; 4.8 km/h walking pace. */
export const walkingMinutes = (km: number) => Math.round(((km * 1.25) / 4.8) * 60);

export function formatDistance(km: number): string {
  const minutes = walkingMinutes(km);
  return minutes <= 45
    ? L(`${minutes} dk yürüme`, `${minutes} min walk`)
    : `${km.toLocaleString(locale(), { maximumFractionDigits: 1 })} km`;
}

let lastRequest = 0;

/** Coordinates for a free-text place ("Rua do Almada 10, Porto"); null when not found or offline. */
export async function geocode(query: string): Promise<Geo | null> {
  const key = query.trim().toLowerCase();
  if (key.length < 3) return null;
  const d = await db();
  const cached = await d.get("geocache", key);
  if (cached) return cached.lat != null && cached.lng != null ? { lat: cached.lat, lng: cached.lng, source: "geocoded" } : null;

  const wait = lastRequest + 1100 - Date.now(); // Nominatim usage policy: max 1 request/second
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=tr&q=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return null; // don't cache failures: they may be temporary
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    const lat = hit ? Number(hit.lat) : null;
    const lng = hit ? Number(hit.lon) : null;
    await d.put("geocache", { query: key, lat, lng, at: Date.now() });
    return lat != null && lng != null ? { lat, lng, source: "geocoded" } : null;
  } catch {
    return null;
  }
}
