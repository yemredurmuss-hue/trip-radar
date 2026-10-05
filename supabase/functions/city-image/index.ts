// City photo for Trip Radar's hero: one landscape photo from Pexels for ?q=<city>.
// The Pexels key lives only here (Supabase secret PEXELS_API_KEY); the extension calls this with the
// sharing server's anon key. Without the secret it answers { url: null } and the extension falls back
// to Wikipedia. Found photos are cached per instance so a city costs one Pexels call; misses are not.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cache = new Map<string, { url: string; by: string | null }>();
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, extra: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, ...extra } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return json({ url: null }, {}, 400);
  // Pasted secrets sometimes carry quotes, the name, a "NAME=" prefix or extra lines: keep the key-shaped token.
  const key = (Deno.env.get("PEXELS_API_KEY") ?? "").match(/[A-Za-z0-9]{40,}/)?.[0] ?? "";
  if (!key) return json({ url: null, reason: "no-key" });
  const k = q.toLowerCase();
  const hit = cache.get(k);
  if (hit) return json(hit, { "Cache-Control": "public, max-age=86400" });
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&per_page=1`, {
      headers: { Authorization: key, "User-Agent": "TripRadar/1.0 (+https://github.com/yemredurmuss-hue/trip-radar)", Accept: "application/json" },
    });
    if (!res.ok) return json({ url: null, reason: `pexels-${res.status}` });
    const p = (await res.json())?.photos?.[0];
    const url: string | null = p?.src?.large2x ?? p?.src?.large ?? null;
    if (!url) return json({ url: null, reason: "no-photo" });
    const found = { url, by: (p?.photographer as string | undefined) ?? null };
    cache.set(k, found);
    return json(found, { "Cache-Control": "public, max-age=86400" });
  } catch {
    return json({ url: null, reason: "network" });
  }
});
