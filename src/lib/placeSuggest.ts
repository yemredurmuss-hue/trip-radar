// A place the AI review suggests to see or to eat at (Yapılacaklar ve restoranlar): its name read as a name, where Google
// Maps finds it, and its own photo. Google Maps' photos need the Places API, which this version has no endpoint for
// (the backend is unchanged), so the photo is the place's own Wikipedia page's, and only a page with coordinates: a place,
// not a song or a dish of the same name. The sharing server's photo search (Unsplash, Pexels) isn't asked: it finds a
// photo like the words, not of the place. No page: the family's drawing. Pure but for findPlacePhoto's requests.
import { isPhoto } from "./cityImages";
import { lang } from "./i18n";
import { placeMapUrl } from "./items";
import type { Suggestion } from "./types";

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

/** The suggestion as put on the plan with the photo its card found (the record keeps it: suggestions.ts suggestedItem). */
export const withPlacePhoto = (s: Suggestion, photo: string | null): Suggestion => (photo ? { ...s, payload: { ...s.payload, photo } } : s);
