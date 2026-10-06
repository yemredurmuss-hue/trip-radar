// The city-image function's rules (Trip Radar), kept free of Deno and Supabase so they're tested with the
// extension's own tests (tests/cityImagePick.test.ts): the searches asked, which answer is taken, its address at
// hero size and who it's credited to.

export type PhotoSource = "unsplash" | "pexels";

/** What the function answers and the cache keeps (author_url / photo_page: links for the credit). */
export interface Picked {
  url: string;
  by: string | null;
  source: PhotoSource;
  author_url: string | null;
  photo_page: string | null;
  /** Unsplash: called once when the photo is chosen (their rule); never sent to the extension. */
  download_location?: string | null;
}

/** Bumped when the picking changes, so older picks are chosen again (v2: Unsplash, credits; v3: an event's name must be in the photo's words; 2026-10-07). */
export const CACHE_VERSION = "v3:";
/** The cache's key: the search and the ones tried after it when it finds nothing (an event's). */
export const cacheKey = (queries: string[]) => CACHE_VERSION + queries.map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).join("|");

export const unsplashSearchUrl = (q: string) =>
  `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&per_page=10&content_filter=high`;
export const pexelsSearchUrl = (q: string) => `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&per_page=10`;

/** Appends query parameters to an address that may already carry some (Unsplash's raw URL has ixid, kept). */
const appendQuery = (url: string, params: string) => `${url}${url.includes("?") ? "&" : "?"}${params}`;

/** Unsplash's links must say where the visitor came from (their attribution rule). */
export function withUtm(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.includes("utm_source=") ? url : appendQuery(url, "utm_source=trip_radar&utm_medium=referral");
}

/**
 * An event's own name searched ("Ozora Festival"): a photo counts only when its words name it (Unsplash's alt text,
 * description or page slug; Pexels' alt or page address), else a loose match (a drawing, a stranger's party) wins on
 * likes. The words that name it: the query's, 4 letters or more, "festival" and the like left out.
 */
const GENERIC = new Set(["festival", "fest", "festivali", "music", "event", "concert", "party"]);
export function namesIt(text: string, q: string): boolean {
  const words = q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !GENERIC.has(w));
  const t = text.toLowerCase();
  return words.length > 0 && words.some((w) => t.includes(w));
}
const unsplashText = (p: any) => [p?.alt_description, p?.description, p?.slug, p?.links?.html].filter(Boolean).join(" ");
const pexelsText = (p: any) => [p?.alt, p?.url].filter(Boolean).join(" ");

/** Unsplash: the most liked of its answers (the earlier on a tie), at 2400 px; credit links with the UTM. */
export function pickUnsplash(results: unknown, named?: string): Picked | null {
  const list = (Array.isArray(results) ? results : []).filter((p: any) => p?.urls?.raw && (!named || namesIt(unsplashText(p), named)));
  if (!list.length) return null;
  const p: any = list.reduce((best: any, cur: any) => ((Number(cur?.likes) || 0) > (Number(best?.likes) || 0) ? cur : best));
  return {
    url: appendQuery(p.urls.raw, "w=2400&q=80&auto=format"),
    by: (p?.user?.name as string | undefined) || null,
    source: "unsplash",
    author_url: withUtm(p?.user?.links?.html),
    photo_page: withUtm(p?.links?.html),
    download_location: (p?.links?.download_location as string | undefined) || null,
  };
}

/** How many of Pexels' first answers are looked at (its order is its relevance). */
export const PEXELS_FIRST = 5;

/** Pexels: the widest landscape of its first few answers (the earlier on a tie), the original at 2400 px, compressed. */
export function pickPexels(photos: unknown, named?: string): Picked | null {
  const list = (Array.isArray(photos) ? photos : []).slice(0, PEXELS_FIRST).filter((p: any) => p?.src?.original && (!named || namesIt(pexelsText(p), named)));
  if (!list.length) return null;
  const width = (p: any) => (Number(p?.width) > Number(p?.height) ? Number(p.width) : 0);
  const p: any = list.reduce((best: any, cur: any) => (width(cur) > width(best) ? cur : best));
  return {
    url: appendQuery(p.src.original, "auto=compress&cs=tinysrgb&w=2400"),
    by: (p?.photographer as string | undefined) || null,
    source: "pexels",
    author_url: (p?.photographer_url as string | undefined) || null,
    photo_page: (p?.url as string | undefined) || null,
  };
}

/** What goes to the extension (and the cache): the photo and its credit, nothing of the provider's internals. */
export function publicAnswer(p: Picked): Omit<Picked, "download_location"> {
  return { url: p.url, by: p.by, source: p.source, author_url: p.author_url, photo_page: p.photo_page };
}

/** A key pasted with quotes, its name or "NAME=" in front: the key-shaped token (Unsplash's has "-" and "_"). */
export const keyOf = (raw: string | undefined) => (raw ?? "").match(/[A-Za-z0-9_-]{40,}/)?.[0] ?? "";
