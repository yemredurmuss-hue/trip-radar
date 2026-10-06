// The hero photo for Trip Radar: ?q=<place> (or an event's name), with who took it and where it's from. An event
// adds ?alt=… once or twice: searches tried in turn when the one before finds nothing ("Ozora Festival", then
// "music festival crowd stage"). Each search goes to Unsplash first when its key is set (Supabase secret
// UNSPLASH_ACCESS_KEY: the most liked of 10), then to Pexels (PEXELS_API_KEY: the widest of its first answers).
// The keys live only here; the extension calls this with the sharing server's anon key. With nothing found it
// answers { url: null } and the extension falls back to Wikipedia.
// Answers are kept in trip_radar.city_image_cache (a photo for 30 days, "none found" for 7) under a versioned key
// (pick.ts CACHE_VERSION), so a place costs one search across every user and instance: Pexels allows 200 calls an
// hour, Unsplash 50 (1000 once approved). After a 429 a provider gets no call for 15 minutes (this instance); the
// cache still answers. Unsplash's rule: when a photo is chosen, its download_location is called once.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { cacheKey, keyOf, pexelsSearchUrl, pickPexels, pickUnsplash, publicAnswer, unsplashSearchUrl, type Picked, type PhotoSource } from "./pick.ts";

type Answer = Omit<Picked, "download_location">;
type Hit = Answer | { url: null };
const memory = new Map<string, Hit>();
const blockedUntil: Record<PhotoSource, number> = { unsplash: 0, pexels: 0 };
const PHOTO_DAYS = 30;
const MISS_DAYS = 7;
const UA = "TripRadar/1.0 (+https://github.com/yemredurmuss-hue/trip-radar)";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, extra: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, ...extra } });
const keep = { "Cache-Control": "public, max-age=86400" };
const answer = (hit: Hit) => (hit.url ? json(hit, keep) : json({ url: null, reason: "no-photo" }, keep));

interface Row {
  url: string | null;
  by: string | null;
  source?: PhotoSource | null;
  author_url?: string | null;
  photo_page?: string | null;
  fetched_at: string;
}
const fromRow = (r: Row): Hit =>
  r.url ? { url: r.url, by: r.by, source: r.source ?? "pexels", author_url: r.author_url ?? null, photo_page: r.photo_page ?? null } : { url: null };

/** One search at a provider: the photo taken, null when it has none, or the failure ("unsplash-403"). */
async function search(source: PhotoSource, q: string, key: string): Promise<Picked | null | string> {
  if (Date.now() < blockedUntil[source]) return `${source}-429`;
  const unsplash = source === "unsplash";
  const res = await fetch(unsplash ? unsplashSearchUrl(q) : pexelsSearchUrl(q), {
    headers: { Authorization: unsplash ? `Client-ID ${key}` : key, "User-Agent": UA, Accept: "application/json", ...(unsplash ? { "Accept-Version": "v1" } : {}) },
  });
  // Unsplash says it's over its hour with a 403 and no requests left.
  if (res.status === 429 || (unsplash && res.status === 403 && res.headers.get("X-Ratelimit-Remaining") === "0")) blockedUntil[source] = Date.now() + 15 * 6e4;
  if (!res.ok) return `${source}-${res.status}`;
  const body = await res.json();
  return unsplash ? pickUnsplash(body?.results) : pickPexels(body?.photos);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 80);
  if (!q) return json({ url: null }, {}, 400);
  const queries = [q, ...params.getAll("alt").map((a) => a.trim().slice(0, 80)).filter(Boolean)].slice(0, 3);
  // Pasted secrets sometimes carry quotes, the name, a "NAME=" prefix or extra lines: keep the key-shaped token.
  const pexels = (Deno.env.get("PEXELS_API_KEY") ?? "").match(/[A-Za-z0-9]{40,}/)?.[0] ?? "";
  const unsplash = keyOf(Deno.env.get("UNSPLASH_ACCESS_KEY"));
  if (!pexels && !unsplash) return json({ url: null, reason: "no-key" });
  const k = cacheKey(queries);
  const inMemory = memory.get(k);
  if (inMemory) return answer(inMemory);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const row = (await sb.rpc("city_image_cached", { p_q: k })).data as Row | null;
  if (row) {
    const days = (Date.now() - Date.parse(row.fetched_at)) / 864e5;
    if (days < (row.url ? PHOTO_DAYS : MISS_DAYS)) {
      const hit = fromRow(row);
      memory.set(k, hit);
      return answer(hit);
    }
  }
  const providers = [...(unsplash ? [["unsplash", unsplash] as const] : []), ...(pexels ? [["pexels", pexels] as const] : [])];
  let picked: Picked | null = null;
  let failed: string | null = null;
  chain: for (const query of queries) {
    for (const [source, key] of providers) {
      try {
        const got = await search(source, query, key);
        if (typeof got === "string") failed = got;
        else if (got) {
          picked = got;
          break chain;
        }
      } catch {
        failed = "network";
      }
    }
  }
  // A failure with no photo is not "none found": not cached, asked again next time; an older photo beats none.
  if (!picked && failed) return row?.url ? answer(fromRow(row)) : json({ url: null, reason: failed });
  const found: Hit = picked ? publicAnswer(picked) : { url: null };
  memory.set(k, found);
  const stored = await sb.rpc("city_image_store", {
    p_q: k,
    p_url: found.url,
    p_by: picked?.by ?? null,
    p_source: picked?.source ?? null,
    p_author_url: picked?.author_url ?? null,
    p_photo_page: picked?.photo_page ?? null,
  });
  if (stored.error) console.warn("city_image_store", stored.error.message);
  // Unsplash's rule: a photo chosen is reported once (here, when it's stored for every user), with the key.
  if (picked?.source === "unsplash" && picked.download_location) {
    const report = fetch(picked.download_location, { headers: { Authorization: `Client-ID ${unsplash}`, "User-Agent": UA } })
      .then((r) => r.body?.cancel())
      .catch(() => undefined);
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(report);
    else await report;
  }
  return answer(found);
});
