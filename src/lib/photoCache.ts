// The hero's photos, light and kept (2026-10-22: "her seferinde yeniden yükleniyor", "bir kere gelince tekrar download
// etmesin"). We keep only their addresses on the trip (Unsplash, Pexels, Wikipedia: trip.cityImages); each is asked for at
// the size it is drawn (sizedPhoto: the cover ~1280 px, also the trip card's so opening a trip finds it there, a tile ~480
// px, compressed by its own server). Those servers send them to be kept for a year, so the browser's own cache holds them:
// the next opening (a reload too) reads them from the disk, nothing fetched. Within a visit the photos drawn are held here
// decoded (heldPhoto), so a hero drawn again (a trip left and opened again, a view switched back) paints them at once,
// with no blank frame. (Kept in our own Cache Storage as blobs, 090352e, the cover waited for the disk on every opening.)

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

/** The cover's width: the hero's and the trip card's (one address, so the card's photo is the hero's, already loaded). */
export const COVER_W = 1280;

/** How many decoded photos a visit holds (a trip's hero is a cover and up to six tiles; a few trips' worth). */
export const PHOTO_MAX = 40;

const held = new Map<string, HTMLImageElement>();

/** Holds a photo decoded for this visit (the oldest beyond PHOTO_MAX let go); one that won't load is not held. */
export function holdPhoto(url: string): void {
  if (typeof Image === "undefined") return;
  const hit = held.get(url);
  if (hit) return void (held.delete(url), held.set(url, hit));
  const img = new Image();
  img.src = url;
  img.decode().catch(() => held.get(url) === img && held.delete(url));
  held.set(url, img);
  for (const old of [...held.keys()].slice(0, Math.max(0, held.size - PHOTO_MAX))) held.delete(old);
}

/** Whether a photo is loaded and decoded this visit: drawn again at once, with no wait. */
export const heldPhoto = (url: string): boolean => {
  const img = held.get(url);
  return Boolean(img?.complete && img.naturalWidth);
};

// (090352e kept them in Cache Storage too: that copy is let go, once per visit)
if (typeof caches !== "undefined") void caches.delete("trip-radar-photos-v1").catch(() => undefined);
