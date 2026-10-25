// One landscape photo per city for the hero. A sharing-server proxy (Unsplash or Pexels, keys on the server) when
// it answers; otherwise Wikipedia, skipping flags, coats of arms, maps and drawings. The proxy says who took the
// photo; the hero credits it ("Fotoğraf: <Ad> / Unsplash", both linked).
import { chooseCover, commonsCandidates, lookAtCovers, stockThumb, type CoverJudge } from "./coverPhoto";
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
/** A Wikipedia file narrower than this is no city photo for the hero. */
const MIN_WIDTH = 1000;
export const sized = (url: string) => (url.includes("/thumb/") && /\/\d+px-/.test(url) ? url.replace(/\/\d+px-/, `/${WIDTH}px-`) : url);

/** A summary's picture: its thumbnail resized when the original is the full file (not a thumbnail URL). */
function summaryImage(s: any): string | null {
  // (a file narrower than a cover is never taken: Uluwatu's is 283 px, stretched over the hero it was a blur, 2026-10-24)
  const wide = Math.max(Number(s?.originalimage?.width) || 0, Number(s?.thumbnail?.width) || 0);
  if (wide > 0 && wide < MIN_WIDTH) return null;
  const original: string | undefined = s?.originalimage?.source;
  const thumb: string | undefined = s?.thumbnail?.source;
  const src = original && !original.includes("/thumb/") && thumb?.includes("/thumb/") ? thumb : (original ?? thumb);
  return src ? sized(src) : null;
}

const defaultFetch: FetchJson = async (url, init) => {
  let r: Response;
  try {
    // (never waiting for ever: 15 s, then a failure like any other)
    r = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : undefined);
  }
  // (the server's own trouble, a quota or an outage, is no "nothing found": asked again later, 2026-10-25)
  if (r.status === 402 || r.status === 429 || r.status >= 500) throw new NetworkError(`server ${r.status}`);
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
type PhotoOpts = { fetchJson?: FetchJson; proxy?: ImageProxy | null; query?: string; titles?: string[]; alt?: string[]; judge?: CoverJudge | null; fetchImage?: typeof fetch };

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
  let stock: CityPhoto | null = null;
  if (opts.proxy) {
    const p = await get(proxyQuery(opts.proxy.url, opts.query?.trim() || city, opts.alt), { headers: opts.proxy.headers });
    if (p?.url) {
      const credit = proxyCredit(p);
      if (credit) seenCredits.set(p.url, credit);
      stock = { url: p.url as string, credit };
    }
  }
  // The cover's own look (coverPhoto.ts): the stock photo beside Commons' wide ones, the model keeps the best; when it
  // can't choose, the old way below, as it was.
  if (opts.judge) {
    const commons = await commonsCandidates(opts.query?.trim() || city, get).catch(() => []);
    const candidates = [...(stock ? [{ url: stock.url, thumb: stockThumb(stock.url), credit: stock.credit }] : []), ...commons];
    const pick = await chooseCover(opts.query?.trim() || city, candidates, opts.judge, opts.fetchImage);
    if (pick) {
      if (pick.credit) seenCredits.set(pick.url, pick.credit);
      return { url: pick.url, credit: pick.credit };
    }
  }
  if (stock) return stock;
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

/**
 * The plan's one look at a trip's cover (2026-10-25, Emre: "gezi üretilirken en hızlısı, plan hero'da farklı"): the photo
 * there now, the stock proxy's and Commons' wide ones, and the model's pick among them. `answered` false (no key, an error):
 * asked again another time; the photo there stays whatever happens.
 */
/**
 * The cover the plan opens with, before its look (2026-10-25, Emre: "harika fotoğraflar buluyor ama plan ekranına bunlar
 * gelmiyor"): the start's first photo (the destination's, Japonya's torii) when it is one the start found, never a page's.
 */
export function startCover(t: { heroImage: string | null; cityImages?: Record<string, string | null> }): string | null {
  return t.heroImage && Object.values(t.cityImages ?? {}).includes(t.heroImage) ? t.heroImage : null;
}

/** The most photos one look at a cover sends to the model (small copies, ~500 px each). */
const COVER_LOOK_MAX = 8;

export async function lookAgainAtCover(
  city: string,
  current: string | null,
  opts: {
    proxy: ImageProxy | null;
    judge: CoverJudge;
    query?: string;
    event?: boolean;
    /** The trip's other photos (its start photo, its places', its moments'): candidates too, the cover is the trip's. */
    more?: readonly string[];
    /** The trip in a line (coverPhoto.ts tripLine). */
    trip?: string | null;
    credits?: Record<string, PhotoCredit> | null;
    fetchJson?: FetchJson;
    fetchImage?: typeof fetch;
  },
): Promise<{ answered: boolean; pick: CityPhoto | null }> {
  let failed = false;
  const get = async (url: string, init?: RequestInit) => {
    try {
      return await (opts.fetchJson ?? defaultFetch)(url, init);
    } catch {
      failed = true;
      return null;
    }
  };
  const q = opts.query?.trim() || city;
  const stock = opts.proxy ? await get(proxyQuery(opts.proxy.url, q), { headers: opts.proxy.headers }) : null;
  // (the photo server not answering is no look at all: asked again another time, never "looked at" for good)
  if (failed) return { answered: false, pick: null };
  const commons = await commonsCandidates(q, get, 3).catch(() => []);
  const seen = new Set<string>();
  const own = (url: string) => ({ url, thumb: isWikiImage(url) ? url.replace(/\/\d+px-/, "/500px-") : stockThumb(url), credit: creditOf(url, opts.credits) });
  // (the one there now first, then the trip's own, then what was found; eight at most for one look)
  const candidates = [
    ...(current ? [own(current)] : []),
    ...(opts.more ?? []).filter(Boolean).map(own),
    ...(stock?.url ? [{ url: stock.url as string, thumb: stockThumb(stock.url), credit: proxyCredit(stock) }] : []),
    ...commons,
  ]
    .filter((c) => !seen.has(c.url) && (seen.add(c.url), true))
    .slice(0, COVER_LOOK_MAX);
  const { answered, pick } = await lookAtCovers(q, candidates, opts.judge, opts.fetchImage, { event: opts.event, current: !!current, trip: opts.trip });
  if (pick?.credit) seenCredits.set(pick.url, pick.credit);
  return { answered, pick: pick ? { url: pick.url, credit: pick.credit } : null };
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
export const wantsCityImage = (cached: string | null | undefined, proxy: boolean, credit: PhotoCredit | null = null): boolean =>
  cached === undefined || (proxy && (cached === null || (isWikiImage(cached) && credit?.source !== "commons")));

/** What to store after asking: the new photo; a miss keeps the picture there was (a first miss is none). */
export const nextCityImage = (cached: string | null | undefined, found: string | null): string | null => found ?? cached ?? null;

/**
 * The trip card's picture after the first city's photo is asked for: the new photo when there was none, or
 * a proxy photo in place of a Wikipedia one; anything else (a page's photo, a proxy photo) stays.
 */
export function nextHeroImage(hero: string | null, found: string | null, chosen = false): string | null {
  if (!found) return hero;
  // (a cover the model chose among Commons' and the stock photos, coverPhoto.ts: it takes the place of what was there)
  if (!hero || chosen) return found;
  return isWikiImage(hero) && !isWikiImage(found) ? found : hero;
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
};

/** One of the trip's main places with its photo, for the hero's mosaic and the PDF's cover. */
export interface HeroCity {
  name: string;
  image: string | null;
  /** Who took the photo (creditOf): shown small at its bottom right. */
  credit?: PhotoCredit | null;
}

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
const SOURCE_NAME = { unsplash: "Unsplash", pexels: "Pexels", wikipedia: "Wikipedia", commons: "Wikimedia Commons" } as const;
const SOURCE_HOME = { unsplash: "https://unsplash.com/", pexels: "https://www.pexels.com/", wikipedia: "https://www.wikipedia.org/", commons: "https://commons.wikimedia.org/" } as const;

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
