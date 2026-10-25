// The cover's photo, chosen (2026-10-24, Emre: "hero'ya en kaliteli manyak görselleri koyamıyor muyuz?"): the stock
// proxy's photo (Unsplash, Pexels) beside Wikimedia Commons' own wide photos of the place or the event (free, licensed,
// credited), and a look at them all by the traveller's model, which keeps the one that is truly this place or event and
// would make a cover: never a poster, a logo, a map, words over a picture or one person's close-up. Whenever it can't
// choose (no key, an error, none fit), the old way holds as it was: the stock photo, else Wikipedia's (Emre: "fallbackler
// yine eski sistem olsun").
import { z } from "zod";
import type { PhotoCredit, PlaybookKind } from "./types";

/** A photo that could be the cover: its address as stored, a small copy to be looked at, who to credit. */
export interface CoverCandidate {
  url: string;
  thumb: string;
  credit: PhotoCredit | null;
}

/** The narrowest Commons photo taken: a cover is drawn ~1400 px wide, twice that on a sharp screen. */
const COMMONS_MIN_W = 2000;
/** What a file's name says it isn't a photo of the place: a logo, a poster, a map, a flag. */
const NOT_A_SCENE = /(logo|poster|plakat|affiche|afiş|flyer|map\b|karte|harita|flag|bayrak|coat[_ ]of[_ ]arms|wappen|seal\b|diagram|chart|banner|ticket|screenshot)/i;

type FetchJson = (url: string, init?: RequestInit) => Promise<any>;

const plain = (html: unknown): string | null => {
  if (typeof html !== "string") return null;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 80) : null;
};

/**
 * Commons' wide photos for a search ("Ozora festival", "Uluwatu"), in its own order of relevance: JPEG, landscape (a
 * cover's shape), at least 2000 px wide, nothing whose name says logo, poster or map; at most `n`.
 */
export async function commonsCandidates(query: string, fetchJson: FetchJson, n = 4): Promise<CoverCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrsearch: `filetype:bitmap ${q}`, gsrnamespace: "6", gsrlimit: "20",
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1920", iiextmetadatafilter: "Artist|LicenseShortName",
  });
  const body = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  const pages: any[] = Object.values(body?.query?.pages ?? {});
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const ii = p?.imageinfo?.[0];
      const w = Number(ii?.width) || 0;
      const h = Number(ii?.height) || 0;
      if (ii?.mime !== "image/jpeg" || w < COMMONS_MIN_W || !h || w / h < 1.3 || w / h > 2.6 || NOT_A_SCENE.test(String(p.title ?? ""))) return [];
      const url = typeof ii.thumburl === "string" ? ii.thumburl.replace(/\?.*$/, "") : null;
      if (!url) return [];
      const credit: PhotoCredit = { by: plain(ii.extmetadata?.Artist?.value), source: "commons", authorUrl: null, photoPage: typeof ii.descriptionurl === "string" ? ii.descriptionurl : null };
      return [{ url, thumb: url.replace(/\/\d+px-/, "/500px-"), credit }];
    })
    .slice(0, n);
}

/** The small copy of a stock photo the model looks at (a JPEG, ~500 px). */
export function stockThumb(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.delete("auto");
      u.searchParams.set("fm", "jpg");
      u.searchParams.set("w", "500");
      u.searchParams.set("q", "70");
      return u.toString();
    }
    if (u.hostname === "images.pexels.com") {
      u.searchParams.set("w", "500");
      return u.toString();
    }
  } catch {
    // (not an address: looked at as it is)
  }
  return url;
}

/**
 * What the look is for: an event (seen happening, never its empty grounds), whether photo 1 is the cover there now, and
 * the trip in a line (tripLine) so the photo is chosen for this trip, not for the place alone.
 */
export interface CoverLook {
  event?: boolean;
  current?: boolean;
  trip?: string | null;
}

/** What a kind of trip wants on its cover, in a few words for the model (classic: the place's own most striking view). */
const KIND_COVER: Partial<Record<PlaybookKind, string>> = {
  ski: "a ski trip: snow, slopes, mountains",
  honeymoon: "a honeymoon: romantic, the sea or the view at its most beautiful",
  wellness: "a wellness trip: calm, water, nature, a spa's quiet",
  cruise: "a cruise: the ship and the sea",
  road: "a road trip: the open road through the landscape",
  festival: "a festival: the stage and the crowd in full swing",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The trip in one line for the cover's look: its name, its kind, the month it starts (so a winter trip isn't summer). */
export function tripLine(
  title: string,
  kind: { playbook: PlaybookKind; label?: string | null } | null | undefined,
  start: string | null | undefined,
  wishes: readonly string[] = [],
): string | null {
  const said = [...new Set(wishes.map((w) => w.trim()).filter(Boolean))].slice(0, 4);
  const parts = [
    title.trim() ? `"${title.trim()}"` : null,
    kind ? (KIND_COVER[kind.playbook] ?? (kind.playbook === "custom" && kind.label?.trim() ? kind.label.trim() : null)) : null,
    start && /^\d{4}-\d{2}/.test(start) ? `in ${MONTHS[Number(start.slice(5, 7)) - 1] ?? ""}`.trim() : null,
    // (what the traveller said they want to see, in their words: "Kızıl yapraklar")
    said.length ? `wanting ${said.map((w) => `"${w}"`).join(", ")}` : null,
  ].filter((p): p is string => !!p && p !== "in");
  return parts.length ? parts.join(", ") : null;
}

/** The model's look: which photo makes the cover (1 = the first), or none. */
export type CoverJudge = (subject: string, photos: { data: string; mimeType: "image/jpeg" | "image/png" }[], how?: CoverLook) => Promise<number | null>;

export const coverPickSchema = z.object({ best: z.number().int().nullable() });

export const COVER_JUDGE_SYSTEM =
  "You choose the cover photo of a trip's page. You see numbered photos found for one place or event. Choose the one that " +
  "is most clearly that very place or event and most striking as a wide cover: real scenery, the stage, the crowd, the " +
  "landmark. Never choose a poster, a flyer, a logo, a map, a photo with large words or dates over it, a screenshot, or a " +
  "close-up of one person, nor a plate of food. Quality counts as much as the subject: choose the photo a travel magazine would print, sharp, " +
  "well lit and vivid; a dull, hazy, flat or snapshot-like photo loses to a vivid one even when it shows more of the place. " +
  "When none is fit, answer null. Answer with the photo's number, counting from 1.";

/** The question for one look (coverJudge.ts): the photo there now is kept unless another is clearly better (2026-10-25, Emre: the
 * Boom Festival's colourful crowd gave way to a hazy lake, "ikinci gelen çok dandik oldu"); an event is seen happening. */
export function coverQuestion(subject: string, count: number, how: CoverLook = {}): string {
  return [
    `Photos 1 to ${count}, found for "${subject}". Which one is its cover?`,
    how.trip ? `The trip: ${how.trip}. Choose the photo that says this trip best at a glance.` : null,
    how.event ? `"${subject}" is an event: choose it happening (the stage, the crowd, the lights, the colour), never its empty grounds or the landscape around it.` : null,
    how.current ? "Photo 1 is the cover now: answer 1 unless another is clearly a better cover, both truer to it and more striking." : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** The photos' bytes for the model (each fetched small; one that won't load or isn't a JPEG/PNG is left out). */
export async function photoBytes(c: CoverCandidate, get: typeof fetch = fetch): Promise<{ data: string; mimeType: "image/jpeg" | "image/png" } | null> {
  try {
    const r = await get(c.thumb);
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (type !== "image/jpeg" && type !== "image/png") return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { data: btoa(bin), mimeType: type };
  } catch {
    return null;
  }
}

/**
 * The model's look at the candidates: `answered` once it has truly looked (or there was nothing to choose between),
 * `pick` what it chose (null: none fit, or nothing to choose). An error, no key or a photo that won't load: not answered,
 * so it is asked again another time.
 */
export async function lookAtCovers(
  subject: string,
  candidates: CoverCandidate[],
  judge: CoverJudge | null,
  get: typeof fetch = fetch,
  how: CoverLook = {},
): Promise<{ answered: boolean; pick: CoverCandidate | null }> {
  if (!judge) return { answered: false, pick: null };
  if (candidates.length < 2) return { answered: true, pick: null };
  const looked = (await Promise.all(candidates.map(async (c) => ({ c, bytes: await photoBytes(c, get) })))).filter((x) => x.bytes != null);
  if (looked.length < 2) return { answered: false, pick: null };
  try {
    // (photo 1 is the one there now only when it loaded)
    const best = await judge(subject, looked.map((x) => x.bytes!), { ...how, current: !!how.current && looked[0].c === candidates[0] });
    return { answered: true, pick: best != null && best >= 1 && best <= looked.length ? looked[best - 1].c : null };
  } catch {
    return { answered: false, pick: null };
  }
}

/** The cover the model picks among the candidates; null whenever it can't or none fit: the caller goes the old way. */
export async function chooseCover(subject: string, candidates: CoverCandidate[], judge: CoverJudge | null, get: typeof fetch = fetch): Promise<CoverCandidate | null> {
  return (await lookAtCovers(subject, candidates, judge, get)).pick;
}
