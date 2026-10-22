// The hero's photos, light and kept (2026-10-22: "her seferinde yeniden yükleniyor"). We keep only their addresses on the
// trip (Unsplash, Pexels, Wikipedia: trip.cityImages); each is asked for at the size it is drawn (sizedPhoto: the cover
// ~1280 px, a tile ~480 px, compressed by its own server), then kept in the extension's Cache Storage the first time it
// comes, so the next opening draws it from the disk at once, with nothing fetched. Kept: the last PHOTO_MAX photos (the
// oldest go). A photo that can't be read (no CORS, offline) is simply drawn from its address, as before.

/** How many photos are kept on the disk (a trip's hero is a cover and up to six tiles). */
export const PHOTO_MAX = 80;
const CACHE = "trip-radar-photos-v1";

/** A photo's address at the width it's drawn (2x for a sharp screen is the caller's): its server resizes and compresses it. */
export function sizedPhoto(url: string, width: number): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.hostname === "images.unsplash.com") {
    u.searchParams.set("w", String(width));
    u.searchParams.set("q", "70");
    u.searchParams.set("auto", "format");
    if (!u.searchParams.has("fit")) u.searchParams.set("fit", "crop");
    return u.toString();
  }
  if (u.hostname === "images.pexels.com") {
    u.searchParams.set("auto", "compress");
    u.searchParams.set("cs", "tinysrgb");
    u.searchParams.set("w", String(width));
    u.searchParams.delete("h");
    return u.toString();
  }
  // Wikimedia's thumbnails come at the width in their name ("/thumb/…/1280px-x.jpg").
  if (u.hostname === "upload.wikimedia.org" && /\/thumb\//.test(u.pathname) && /\/\d+px-/.test(u.pathname)) {
    return url.replace(/\/\d+px-/, `/${width}px-`);
  }
  return url;
}

/** This visit's photos already read: drawn again at once (a re-mounted hero, a view switched back). */
const seen = new Map<string, string>();

const cacheOf = async (): Promise<Cache | null> => {
  try {
    return typeof caches === "undefined" ? null : await caches.open(CACHE);
  } catch {
    return null;
  }
};

/** The photo kept on the disk, or null (not kept yet, or no cache here). */
export async function keptPhoto(url: string): Promise<string | null> {
  const hit = seen.get(url);
  if (hit) return hit;
  const cache = await cacheOf();
  const res = await cache?.match(url).catch(() => undefined);
  if (!res) return null;
  const src = URL.createObjectURL(await res.blob());
  seen.set(url, src);
  return src;
}

const pending = new Set<string>();

/** Fetches a photo once and keeps it (the oldest beyond PHOTO_MAX go); quiet when it can't be read. */
export async function keepPhoto(url: string): Promise<void> {
  if (seen.has(url) || pending.has(url)) return;
  pending.add(url);
  try {
    const cache = await cacheOf();
    if (!cache) return;
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return;
    await cache.put(url, res.clone());
    seen.set(url, URL.createObjectURL(await res.blob()));
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - PHOTO_MAX))) await cache.delete(old);
  } catch {
    // (drawn from its address, as before)
  } finally {
    pending.delete(url);
  }
}

/** What's kept this visit, for a first draw with no wait. */
export const seenPhoto = (url: string): string | null => seen.get(url) ?? null;
