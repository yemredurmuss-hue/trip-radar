// A place the AI review suggests to see or to eat at (Yapılacaklar ve restoranlar): its name read as a name, where Google
// Maps finds it, and its own photo. First Google Maps itself (0.39.1: the offers function's kind=place, SerpApi's
// google_maps search): the place's photo, its rating and reviews as Maps gives them and its own Maps page. A function
// without that answer (not deployed yet) or a place Maps doesn't find: the photo is the place's own Wikipedia page's,
// and only a page with coordinates: a place, not a song or a dish of the same name. The sharing server's photo search
// (Unsplash, Pexels) isn't asked: it finds a photo like the words, not of the place. No page: the family's drawing.
// The trip's kinds of place (offerSources placeSearches) are searched on Maps too, for the review to pick real places
// from (mapsIdeas). Pure but for the requests.
import { matchSight, type Sight } from "./citySights";
import { isPhoto } from "./cityImages";
import { lang } from "./i18n";
import { placeMapUrl } from "./items";
import { findPlaces, placeSearches, type MapsPlace } from "./offerSources";
import type { Suggestion, Trip } from "./types";

/** A case ending after an apostrophe ("'nın", "'da", "'dan", "'ya", "'yı", "'yla", "'daki"): a name said in a sentence. */
const CASE_ENDING = /['’](?:n?[ıiuü]n|n?[dt][ae]n?|[dt][ae]ki|[ny]?[ae]|[ny]?[ıiuü]|y?l[ae])$/iu;
/** Words a cut-off title is left hanging on ("Tanah Lot ve", "Warung with"). */
const HANGING = /\s+(?:ve|ile|için|veya|ya|de|da|ki|and|or|with|for|of|the|at|in|on|to)$/iu;
const ELLIPSIS = /\s*(?:…|\.{2,})$/u;

/**
 * A suggestion's title as a place's name: a stored one cut in a sentence ("Tanah Lot Tapınağı'nın", "Yerel warung'da
 * nas…") loses its case ending, the word cut by the "…", the word it hangs on and the trailing marks. What a name can't
 * be made of (nothing left) keeps the title as it was.
 */
export function cleanPlaceTitle(title: string): string {
  let t = title.trim();
  // A word running into the "…" was cut: it goes with it ("nas…"); a "…" after a space leaves the word before it whole.
  if (ELLIPSIS.test(t)) t = /\S(?:…|\.{2,})$/u.test(t) ? t.replace(/\s*\S*(?:…|\.{2,})$/u, "") : t.replace(ELLIPSIS, "");
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(/[\s,;:·/\-–—]+$/u, "").replace(HANGING, "").replace(CASE_ENDING, "");
  }
  return t.trim() || title.trim();
}

/** What to look for on Google Maps: the model's own "place" (the full name and its town), else the name and the city. */
export function placeQuery(s: Pick<Suggestion, "title" | "payload">): string {
  const place = s.payload?.place?.trim();
  if (place) return place;
  return [cleanPlaceTitle(s.title), s.payload?.city?.trim()].filter(Boolean).join(", ");
}

/** The place on Google Maps (a search: no key, no Places API). */
export const placeMapsUrl = (s: Pick<Suggestion, "title" | "payload">): string => placeMapUrl({ name: placeQuery(s), city: null, geo: null });

/** The Wikipedia pages a place's photo is looked for on: the place's own name (its "place" before the town), then the title. */
export function photoNames(s: Pick<Suggestion, "title" | "payload">): string[] {
  const place = s.payload?.place?.split(",")[0]?.trim();
  return [...new Set([place, cleanPlaceTitle(s.title)].filter((n): n is string => Boolean(n && n.length > 2)))];
}

export interface PlacePhoto {
  url: string;
  /** The Wikipedia page it is from (the credit's link). */
  page: string | null;
}

/** null: an answer without a usable body. Throws: no answer at all (offline), not stored as a miss. */
type FetchJson = (url: string) => Promise<any | null>;

const defaultFetch: FetchJson = async (url) => {
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json().catch(() => null);
};

/** A card's picture is ~230 px wide: Wikimedia's thumbnail asked for at 480 px (sharp, not the full file). */
const CARD_WIDTH = 480;
const cardSized = (url: string) => (url.includes("/thumb/") && /\/\d+px-/.test(url) ? url.replace(/\/\d+px-/, `/${CARD_WIDTH}px-`) : url);

/** A page summary's photo when the page is a place's (a standard page with coordinates) and its picture a photo. */
function placeImage(s: any): PlacePhoto | null {
  if (s?.type !== "standard" || !s.coordinates) return null;
  const src: string | undefined = s.thumbnail?.source ?? s.originalimage?.source;
  if (!src || !isPhoto(src)) return null;
  return { url: cardSized(src), page: typeof s.content_urls?.desktop?.page === "string" ? s.content_urls.desktop.page : null };
}

/** Asked this session, by the names asked: each card asks once, a second render reads the answer. */
const asked = new Map<string, Promise<PlacePhoto | null>>();
const known = new Map<string, PlacePhoto | null>();

/** The answer already in for these names (undefined: not asked yet or still out). */
export const knownPlacePhoto = (names: readonly string[]): PlacePhoto | null | undefined => known.get(names.join("|"));

/**
 * The place's photo from its Wikipedia page, the names tried in order on the board's language's Wikipedia then the other.
 * null when none of them is a place's page with a photo. A request that got no answer isn't remembered (asked again later).
 */
export function findPlacePhoto(names: readonly string[], fetchJson: FetchJson = defaultFetch): Promise<PlacePhoto | null> {
  const key = names.join("|");
  if (!key) return Promise.resolve(null);
  const was = asked.get(key);
  if (was) return was;
  const wikis = lang() === "en" ? ["en", "tr"] : ["tr", "en"];
  const run = (async () => {
    let failed = false;
    for (const name of names) {
      for (const wiki of wikis) {
        const s = await fetchJson(`https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}`).catch(() => {
          failed = true;
          return null;
        });
        const photo = placeImage(s);
        if (photo) return photo;
      }
    }
    if (failed) throw new Error("no answer");
    return null;
  })();
  asked.set(key, run);
  return run.then(
    (photo) => {
      known.set(key, photo);
      return photo;
    },
    () => {
      asked.delete(key);
      return null;
    },
  );
}

/**
 * The suggestion as put on the plan with the photo its card found and the place's own Maps page when Maps found it (the
 * record keeps both: suggestions.ts suggestedItem).
 */
export const withPlacePhoto = (s: Suggestion, photo: string | null, map: string | null = null): Suggestion =>
  photo || map ? { ...s, payload: { ...s.payload, ...(photo ? { photo } : {}), ...(map ? { map } : {}) } } : s;

// --- Google Maps first --------------------------------------------------------------------------------------

/** What a suggestion's card shows of its place: the photo and whose, the rating and reviews (Maps' only), its Maps page. */
export interface PlaceFound {
  photo: PlacePhoto | null;
  /** Whose photo: Google Maps', the city's Google sights' ("Google", spec 2026-10-19 SerpApi item 3) or Wikipedia's. */
  credit: "Google Maps" | "Google" | "Wikipedia" | null;
  rating: number | null;
  reviews: number | null;
  /** The place's own Maps page; null: the card's Maps search stays. */
  map: string | null;
  /** The rating is the city's Google sights' (no review count: the card draws it on the picture); unset: Maps' or none. */
  sight?: true;
  /** Who took Google's photo, when the Places API names them (the credit says it). */
  photoBy?: string;
}

export type FindPlaces = (search: string) => Promise<MapsPlace[]>;

const foldName = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en").replace(/ı/g, "i").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Words any place's name may have: two places sharing only these aren't the same one. */
const COMMON = new Set(["the", "and", "temple", "tapinagi", "pura", "beach", "pantai", "plaji", "warung", "restaurant", "restoran", "cafe", "bar", "kitchen", "club", "waterfall", "selalesi", "air", "terjun", "rice", "terrace", "park", "market", "pazari"]);
const nameWords = (s: string) => foldName(s).split(" ").filter((w) => w.length >= 3 && !COMMON.has(w));

/** Whether Maps' place is the suggestion's: one name holds the other, or they share a word of its own ("Tanah", "Lot"). */
export function samePlace(s: Pick<Suggestion, "title" | "payload">, name: string): boolean {
  const theirs = foldName(name);
  if (!theirs) return false;
  const ours = [s.payload?.place?.split(",")[0] ?? "", cleanPlaceTitle(s.title)].map(foldName).filter(Boolean);
  if (ours.some((o) => o === theirs || (o.length > 3 && theirs.includes(o)) || (theirs.length > 3 && o.includes(theirs)))) return true;
  const words = new Set(nameWords(name));
  return ours.some((o) => nameWords(o).some((w) => words.has(w)));
}

/** Places found by the trip's kinds of place (mapsIdeas), by name: a card for one of them needs no search of its own. */
const seenOnMaps = new Map<string, MapsPlace>();
export function rememberPlaces(list: readonly MapsPlace[]): void {
  for (const p of list) if (!seenOnMaps.has(foldName(p.name))) seenOnMaps.set(foldName(p.name), p);
}
const rememberedFor = (s: Pick<Suggestion, "title" | "payload">): MapsPlace | null =>
  [s.payload?.place?.split(",")[0] ?? "", cleanPlaceTitle(s.title)].map((n) => seenOnMaps.get(foldName(n))).find(Boolean) ?? null;

const placeAsked = new Map<string, Promise<PlaceFound | null>>();
const placeKnown = new Map<string, PlaceFound | null>();
/** What a card asks its place by (its Maps search and its Wikipedia names): one answer per key. */
export const placeLookupKey = (s: Pick<Suggestion, "title" | "payload">): string => `${placeQuery(s)}|${photoNames(s).join("|")}`;

/** The answer already in for this suggestion's place (undefined: not asked yet or still out). */
export const knownPlace = (s: Pick<Suggestion, "title" | "payload">): PlaceFound | null | undefined => placeKnown.get(placeLookupKey(s));

/**
 * The suggestion's place: Google Maps' (a place the trip's kinds of place found, else Maps searched by its name and
 * town, its first answer when the names agree) with its photo, rating, reviews and page. Given its city's Google sights
 * (citySights.ts, asked once per city), a place listed there with a photo needs no Maps search of its own: its photo and
 * rating are Google's (spec 2026-10-19 SerpApi item 3). Without a photo from either, its Wikipedia page's photo
 * (findPlacePhoto), with the sight's rating when it is listed. Asked once per place; null when none has anything, and a
 * request that got no answer isn't remembered.
 */
export function findPlace(
  s: Pick<Suggestion, "title" | "payload">,
  deps: { places?: FindPlaces; fetchJson?: FetchJson; sights?: () => Promise<readonly Sight[]> } = {},
): Promise<PlaceFound | null> {
  const key = placeLookupKey(s);
  const was = placeAsked.get(key);
  if (was) return was;
  const run = (async (): Promise<{ found: PlaceFound | null; sure: boolean }> => {
    const names = photoNames(s);
    let maps = rememberedFor(s);
    const sight = !maps && deps.sights ? matchSight(names, await deps.sights().catch(() => [] as Sight[])) : null;
    if (!maps && !sight?.photo) {
      const search = placeQuery(s);
      const list = search ? await (deps.places ?? findPlaces)(search).catch(() => [] as MapsPlace[]) : [];
      maps = list.find((p) => samePlace(s, p.name)) ?? null;
    }
    const google = maps?.photo ? { url: maps.photo, page: maps.url } : !maps && sight?.photo ? { url: sight.photo, page: null } : null;
    const wiki = google ? null : await findPlacePhoto(names, deps.fetchJson);
    // Wikipedia had no answer at all (offline): not remembered, asked again on the next card.
    const sure = !!google || wiki != null || !names.length || knownPlacePhoto(names) !== undefined;
    const photo = google ?? wiki;
    // Maps' place decides the rating; else the sight's, drawn as Google's.
    const rated = maps ? null : sight?.rating != null ? sight : null;
    if (!photo && !maps && !rated) return { found: null, sure };
    return {
      found: {
        photo,
        credit: maps?.photo ? "Google Maps" : google ? "Google" : wiki ? "Wikipedia" : null,
        rating: maps?.rating ?? rated?.rating ?? null,
        reviews: maps?.reviews ?? null,
        map: maps?.url ?? null,
        ...(rated ? { sight: true as const } : {}),
        ...(maps?.photo && typeof maps.photoBy === "string" && maps.photoBy.trim() ? { photoBy: maps.photoBy.trim() } : {}),
      },
      sure,
    };
  })();
  const out = run.then(({ found, sure }) => {
    if (sure) placeKnown.set(key, found);
    else placeAsked.delete(key);
    return found;
  });
  placeAsked.set(key, out);
  return out;
}

/** The town the trip's kinds of place are searched in: the one with the most nights booked or chosen, else the first place. */
export function stayTown(blocks: readonly { city: string | null; nights: number }[], fallback: string | null | undefined): string | null {
  const nights = new Map<string, number>();
  for (const b of blocks) if (b.city?.trim()) nights.set(b.city.trim(), (nights.get(b.city.trim()) ?? 0) + b.nights);
  let best: string | null = null;
  for (const [city, n] of nights) if (best == null || n > nights.get(best)!) best = city;
  return best ?? (fallback?.trim() || null);
}

/** Real places the review can pick from: up to six names per kind of place the trip is for (placeSearches), in a city. */
export async function mapsIdeas(trip: Pick<Trip, "intent" | "style" | "travellers">, city: string, find: FindPlaces = findPlaces): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  const searches = placeSearches(trip, city);
  const found = await Promise.all(searches.map((q) => find(q).catch(() => [] as MapsPlace[])));
  searches.forEach((q, i) => {
    rememberPlaces(found[i]);
    if (found[i].length) out[q] = found[i].slice(0, 6).map((p) => p.name);
  });
  return out;
}
