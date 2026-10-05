// One landscape photo per city for the hero. A sharing-server proxy (Pexels, key on the server) when
// it answers; otherwise Wikipedia, skipping flags, coats of arms, maps and drawings.
import { lang } from "./i18n";
import { getShareConfig } from "./share/store";

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

/** The city's photo URL; null when it has none. Throws NetworkError when a request got no answer and nothing was found, so a miss isn't confused with an outage. */
export async function pickCityImage(city: string, opts: { fetchJson?: FetchJson; proxy?: ImageProxy | null } = {}): Promise<string | null> {
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
    const p = await get(`${opts.proxy.url}?q=${encodeURIComponent(city)}`, { headers: opts.proxy.headers });
    if (p?.url) return p.url as string;
  }
  for (const wiki of lang() === "en" ? ["en", "tr"] : ["tr", "en"]) {
    const s = await get(`https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city)}`);
    const src = summaryImage(s);
    if (src && isPhoto(src)) return src;
    const m = await get(`https://${wiki}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(city)}`);
    const pick = (m?.items ?? []).find((i: any) => i.type === "image" && isPhoto(i.title ?? "") && i.srcset?.length);
    if (pick) {
      const url = sized(pick.srcset.at(-1).src);
      return url.startsWith("//") ? `https:${url}` : url;
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
