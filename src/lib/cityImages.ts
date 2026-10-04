// One landscape photo per city for the hero. A sharing-server proxy (Pexels, key on the server) when
// it answers; otherwise Wikipedia, skipping flags, coats of arms, maps and drawings.
import { lang } from "./i18n";
import { getShareConfig } from "./share/store";

type FetchJson = (url: string) => Promise<any | null>;
const NOT_PHOTO = /flag|coat_of_arms|wappen|locator|map|logo|seal|\.svg/i;
export const isPhoto = (url: string) => !NOT_PHOTO.test(decodeURIComponent(url));

const defaultFetch: FetchJson = async (url) => {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

/** The sharing server's city-image function (deployed without JWT verification, so no auth header); null when no server is set up. */
export async function imageProxy(): Promise<string | null> {
  try {
    const { url } = await getShareConfig();
    return url ? `${url.replace(/\/+$/, "")}/functions/v1/city-image` : null;
  } catch {
    return null;
  }
}

export async function pickCityImage(city: string, opts: { fetchJson?: FetchJson; proxy?: string | null } = {}): Promise<string | null> {
  const get = opts.fetchJson ?? defaultFetch;
  if (opts.proxy) {
    const p = await get(`${opts.proxy}?q=${encodeURIComponent(city)}`);
    if (p?.url) return p.url as string;
  }
  for (const wiki of lang() === "en" ? ["en", "tr"] : ["tr", "en"]) {
    const s = await get(`https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(city)}`);
    const src = s?.originalimage?.source ?? s?.thumbnail?.source;
    if (src && isPhoto(src)) return src;
    const m = await get(`https://${wiki}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(city)}`);
    const pick = (m?.items ?? []).find((i: any) => i.type === "image" && isPhoto(i.title ?? "") && i.srcset?.length);
    if (pick) {
      const url: string = pick.srcset.at(-1).src;
      return url.startsWith("//") ? `https:${url}` : url;
    }
  }
  return null;
}
