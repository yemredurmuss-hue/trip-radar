// One landscape photo per city for the hero. A sharing-server proxy (Pexels, key on the server) when
// it answers; otherwise Wikipedia, skipping flags, coats of arms, maps and drawings.
import { lang } from "./i18n";
import { getShareConfig } from "./share/store";

type FetchJson = (url: string, init?: RequestInit) => Promise<any | null>;
/** The sharing server's city-image function address and the headers it needs. */
export interface ImageProxy {
  url: string;
  headers: Record<string, string>;
}
const NOT_PHOTO = /flag|coat_of_arms|wappen|locator|map|logo|seal|\.svg/i;
export const isPhoto = (url: string) => !NOT_PHOTO.test(decodeURIComponent(url));

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
  try {
    const r = await fetch(url, init);
    return r.ok ? await r.json() : null;
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

export async function pickCityImage(city: string, opts: { fetchJson?: FetchJson; proxy?: ImageProxy | null } = {}): Promise<string | null> {
  const get = opts.fetchJson ?? defaultFetch;
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
  return null;
}
