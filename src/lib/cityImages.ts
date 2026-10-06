// One landscape photo per city for the hero. A sharing-server proxy (Unsplash or Pexels, keys on the server) when
// it answers; otherwise Wikipedia, skipping flags, coats of arms, maps and drawings. The proxy says who took the
// photo; the hero credits it ("Fotoğraf: <Ad> / Unsplash", both linked).
import { L, lang } from "./i18n";
import { getShareConfig } from "./share/store";
import type { PhotoCredit } from "./types";

/** null: the server answered without a usable body. Throws (NetworkError): no answer at all. */
type FetchJson = (url: string, init?: RequestInit) => Promise<any | null>;
/** The sharing server's city-image function address and the headers it needs. */
export interface ImageProxy {
  url: string;
  headers: Record<string, string>;
}
const NOT_PHOTO = /flag|coat_of_arms|wappen|locator|map|logo|seal|\.svg/i;
export const isPhoto = (url: string) => {
  let text = url;
  try {
    text = decodeURIComponent(url);
  } catch {
    // A stray "%" in a file name: judge the raw string.
  }
  return !NOT_PHOTO.test(text);
};

/** A request that never got an answer (offline, DNS, timeout): the city may well have a photo, so it must not be stored as "none". */
export class NetworkError extends Error {
  constructor(message = "network error") {
    super(message);
    this.name = "NetworkError";
  }
}

/** The hero is ~1000 px wide: Wikimedia thumbnails ("/thumb/…/330px-x.jpg") are asked for at 1280 px, neither a blur nor a 20 MB original. */
const WIDTH = 1280;
export const sized = (url: string) => (url.includes("/thumb/") && /\/\d+px-/.test(url) ? url.replace(/\/\d+px-/, `/${WIDTH}px-`) : url);

/** A summary's picture: its thumbnail resized when the original is the full file (not a thumbnail URL). */
function summaryImage(s: any): string | null {
  const original: string | undefined = s?.originalimage?.source;
  const thumb: string | undefined = s?.thumbnail?.source;
  const src = original && !original.includes("/thumb/") && thumb?.includes("/thumb/") ? thumb : (original ?? thumb);
  return src ? sized(src) : null;
}

const defaultFetch: FetchJson = async (url, init) => {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : undefined);
  }
  if (!r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
};

/** The sharing server's city-image function with the same auth as the rpc client (`apikey`; legacy JWT keys also as Bearer); null when no server or key is set up. */
export async function imageProxy(): Promise<ImageProxy | null> {
  try {
    const { url, anonKey } = await getShareConfig();
    if (!url || !anonKey) return null;
    const headers: Record<string, string> = { apikey: anonKey };
    if (anonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${anonKey}`;
    return { url: `${url.replace(/\/+$/, "")}/functions/v1/city-image`, headers };
  } catch {
    return null;
  }
}

/** A photo and who to credit for it (null: none said; the address may still tell, creditOf). */
export interface CityPhoto {
  url: string;
  credit: PhotoCredit | null;
}
/** `alt`: the proxy's searches after `query` when it finds nothing (an event's: "Ozora Festival", "music festival crowd stage"). */
type PhotoOpts = { fetchJson?: FetchJson; proxy?: ImageProxy | null; query?: string; titles?: string[]; alt?: string[] };

/** Credits the proxy gave this session, by photo URL: a photo found before its trip exists (the start) keeps its credit. */
const seenCredits = new Map<string, PhotoCredit>();
export const creditFor = (url: string | null | undefined): PhotoCredit | null => (url ? (seenCredits.get(url) ?? null) : null);

/** The proxy's address for a search and the ones after it. */
export const proxyQuery = (base: string, q: string, alt: string[] = []): string =>
  `${base}?q=${encodeURIComponent(q)}${alt.map((a) => `&alt=${encodeURIComponent(a)}`).join("")}`;

const SOURCES = ["unsplash", "pexels"] as const;
/** The proxy's { by, source, author_url, photo_page } as a credit; one without a source is Pexels' (before 2026-10-07). */
export function proxyCredit(p: any): PhotoCredit | null {
  const source = SOURCES.find((s) => s === p?.source) ?? (p?.by ? "pexels" : null);
  if (!source) return null;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { by: text(p?.by), source, authorUrl: text(p?.author_url), photoPage: text(p?.photo_page) };
}

/** The city's photo URL; null when it has none (findCityPhoto without the credit). */
export async function pickCityImage(city: string, opts: PhotoOpts = {}): Promise<string | null> {
  return (await findCityPhoto(city, opts))?.url ?? null;
}

/**
 * The city's photo and its credit; null when it has none. Throws NetworkError when a request got no answer and nothing
 * was found, so a miss isn't confused with an outage. `query`: what the proxy is asked instead of the bare name ("Ella
 * Sri Lanka", "Sri Lanka landscape"); `titles`: Wikipedia pages tried before the name ("Ella, Sri Lanka").
 */
export async function findCityPhoto(city: string, opts: PhotoOpts = {}): Promise<CityPhoto | null> {
  const fetchJson = opts.fetchJson ?? defaultFetch;
  let failed: unknown = null;
  const get = async (url: string, init?: RequestInit) => {
    try {
      return await fetchJson(url, init);
    } catch (e) {
      failed ??= e;
      return null;
    }
  };
  if (opts.proxy) {
    const p = await get(proxyQuery(opts.proxy.url, opts.query?.trim() || city, opts.alt), { headers: opts.proxy.headers });
    if (p?.url) {
      const credit = proxyCredit(p);
      if (credit) seenCredits.set(p.url, credit);
      return { url: p.url as string, credit };
    }
  }
  // The pages asked for first (an English title such as "Ella, Sri Lanka" on the English Wikipedia), then the name.
  const titles = [...new Set([...(opts.titles ?? []), city])];
  const wikis = lang() === "en" ? ["en", "tr"] : ["tr", "en"];
  for (const [title, wiki] of titles.flatMap((t, k) => (k < titles.length - 1 ? [[t, "en"]] : wikis.map((w) => [t, w])))) {
    const s = await get(`https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const src = summaryImage(s);
    if (src && isPhoto(src)) return { url: src, credit: creditOf(src) };
    const m = await get(`https://${wiki}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`);
    const pick = (m?.items ?? []).find((i: any) => i.type === "image" && isPhoto(i.title ?? "") && i.srcset?.length);
    if (pick) {
      const src = sized(pick.srcset.at(-1).src);
      const url = src.startsWith("//") ? `https:${src}` : src;
      return { url, credit: creditOf(url) };
    }
  }
  if (failed) throw failed instanceof NetworkError ? failed : new NetworkError(failed instanceof Error ? failed.message : undefined);
  return null;
}

/** A picture from Wikipedia / Wikimedia (what was stored before the proxy answered). */
export function isWikiImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return /(^|\.)(wikimedia|wikipedia)\.org$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Whether to ask for a city's photo: never asked yet; or, once the proxy is set up, a stored miss or a
 * Wikipedia picture (trips from before the proxy kept those and would never ask again).
 */
export const wantsCityImage = (cached: string | null | undefined, proxy: boolean): boolean =>
  cached === undefined || (proxy && (cached === null || isWikiImage(cached)));

/** What to store after asking: the new photo; a miss keeps the picture there was (a first miss is none). */
export const nextCityImage = (cached: string | null | undefined, found: string | null): string | null => found ?? cached ?? null;

/**
 * The trip card's picture after the first city's photo is asked for: the new photo when there was none, or
 * a proxy photo in place of a Wikipedia one; anything else (a page's photo, a proxy photo) stays.
 */
export function nextHeroImage(hero: string | null, found: string | null): string | null {
  if (!found) return hero;
  if (!hero) return found;
  return isWikiImage(hero) && !isWikiImage(found) ? found : hero;
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

/**
 * A photo's credit: the one stored with it (or given this session), else what its address tells (Wikipedia, a Pexels
 * photo's page, Unsplash); null for anything else (a booking page's own photo).
 */
export function creditOf(url: string | null | undefined, stored?: Record<string, PhotoCredit> | null): PhotoCredit | null {
  if (!url) return null;
  const own = stored?.[url] ?? seenCredits.get(url);
  if (own) return own;
  if (isWikiImage(url)) return { by: null, source: "wikipedia", authorUrl: null, photoPage: null };
  const host = hostOf(url);
  if (host === "images.pexels.com") {
    const id = /\/photos\/(\d+)\//.exec(url)?.[1];
    return { by: null, source: "pexels", authorUrl: null, photoPage: id ? `https://www.pexels.com/photo/${id}/` : null };
  }
  if (host === "images.unsplash.com") return { by: null, source: "unsplash", authorUrl: null, photoPage: null };
  return null;
}

/** Unsplash's links say where the visitor came from (their attribution rule); others are left as they are. */
export function withUtm(url: string): string {
  if (!/(^|\.)unsplash\.com$/.test(hostOf(url)) || url.includes("utm_source=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}utm_source=trip_radar&utm_medium=referral`;
}

/** A part of the credit line: its words and, when known, its link. */
export interface CreditPart {
  text: string;
  href: string | null;
}
const SOURCE_NAME = { unsplash: "Unsplash", pexels: "Pexels", wikipedia: "Wikipedia" } as const;
const SOURCE_HOME = { unsplash: "https://unsplash.com/", pexels: "https://www.pexels.com/", wikipedia: "https://www.wikipedia.org/" } as const;

/**
 * The hero's credit line: "Fotoğraf: <photographer> / Unsplash" (their page; Unsplash's home, Pexels' or
 * Wikipedia's photo page), every Unsplash link with its UTM.
 */
export function creditLine(c: PhotoCredit): { label: string; by: CreditPart | null; source: CreditPart } {
  const page = c.source === "unsplash" ? SOURCE_HOME.unsplash : (c.photoPage ?? SOURCE_HOME[c.source]);
  return {
    label: L("Fotoğraf:", "Photo:"),
    by: c.by ? { text: c.by, href: c.authorUrl ? withUtm(c.authorUrl) : null } : null,
    source: { text: SOURCE_NAME[c.source], href: withUtm(page) },
  };
}

/**
 * The trip's credits with new photos' added, keeping only those of the photos it still shows (its hero and city
 * photos), so the map doesn't grow with every photo replaced. Undefined when none is left.
 */
export function keptCredits(
  t: { heroImage: string | null; cityImages?: Record<string, string | null>; photoCredits?: Record<string, PhotoCredit> },
  add: (CityPhoto | null)[] = [],
): Record<string, PhotoCredit> | undefined {
  const all = { ...t.photoCredits, ...Object.fromEntries(add.flatMap((p) => (p?.credit ? [[p.url, p.credit]] : []))) };
  const shown = new Set([t.heroImage, ...Object.values(t.cityImages ?? {})].filter(Boolean));
  const kept = Object.fromEntries(Object.entries(all).filter(([url]) => shown.has(url)));
  return Object.keys(kept).length ? kept : undefined;
}
