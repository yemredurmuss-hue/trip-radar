// City photo for Trip Radar's hero: one landscape photo from Pexels for ?q=<city>.
// The Pexels key lives only here (Supabase secret PEXELS_API_KEY); the extension calls this with the
// sharing server's anon key. Without the secret it answers { url: null } and the extension falls back
// to Wikipedia. Answers are kept in trip_radar.city_image_cache (a photo for 30 days, "none found" for 7),
// so a place costs one Pexels call across every user and instance: Pexels allows 200 calls an hour. After a
// 429 no call goes out for 15 minutes (this instance); the cache still answers.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const memory = new Map<string, { url: string | null; by: string | null }>();
let blockedUntil = 0;
const PHOTO_DAYS = 30;
const MISS_DAYS = 7;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, extra: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, ...extra } });
const keep = { "Cache-Control": "public, max-age=86400" };
const answer = (hit: { url: string | null; by: string | null }) => (hit.url ? json(hit, keep) : json({ url: null, reason: "no-photo" }, keep));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return json({ url: null }, {}, 400);
  // Pasted secrets sometimes carry quotes, the name, a "NAME=" prefix or extra lines: keep the key-shaped token.
  const key = (Deno.env.get("PEXELS_API_KEY") ?? "").match(/[A-Za-z0-9]{40,}/)?.[0] ?? "";
  if (!key) return json({ url: null, reason: "no-key" });
  const k = q.toLowerCase().replace(/\s+/g, " ");
  const inMemory = memory.get(k);
  if (inMemory) return answer(inMemory);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const row = (await sb.rpc("city_image_cached", { p_q: k })).data as { url: string | null; by: string | null; fetched_at: string } | null;
  if (row) {
    const days = (Date.now() - Date.parse(row.fetched_at)) / 864e5;
    if (days < (row.url ? PHOTO_DAYS : MISS_DAYS)) {
      const hit = { url: row.url, by: row.by };
      memory.set(k, hit);
      return answer(hit);
    }
  }
  // Rate limited a moment ago: an older photo is better than none.
  if (Date.now() < blockedUntil) return row?.url ? answer({ url: row.url, by: row.by }) : json({ url: null, reason: "pexels-429" });
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&per_page=1`, {
      headers: { Authorization: key, "User-Agent": "TripRadar/1.0 (+https://github.com/yemredurmuss-hue/trip-radar)", Accept: "application/json" },
    });
    if (res.status === 429) blockedUntil = Date.now() + 15 * 6e4;
    if (!res.ok) return row?.url ? answer({ url: row.url, by: row.by }) : json({ url: null, reason: `pexels-${res.status}` });
    const p = (await res.json())?.photos?.[0];
    const url: string | null = p?.src?.large2x ?? p?.src?.large ?? null;
    const found = { url, by: url ? ((p?.photographer as string | undefined) ?? null) : null };
    memory.set(k, found);
    await sb.rpc("city_image_store", { p_q: k, p_url: found.url, p_by: found.by });
    return answer(found);
  } catch {
    return json({ url: null, reason: "network" });
  }
});
