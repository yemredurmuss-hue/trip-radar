// City photo for Trip Radar's hero: one landscape photo from Pexels for ?q=<city>.
// The Pexels key lives only here (Supabase secret PEXELS_API_KEY); the extension calls this with the
// sharing server's anon key. Without the secret it answers { url: null } and the extension falls back
// to Wikipedia. Results are cached per instance so a city costs one Pexels call.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cache = new Map<string, { url: string | null; by: string | null }>();
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return new Response(JSON.stringify({ url: null }), { status: 400, headers: cors });
  const key = Deno.env.get("PEXELS_API_KEY");
  if (!key) return new Response(JSON.stringify({ url: null }), { headers: cors });
  const k = q.toLowerCase();
  if (!cache.has(k)) {
    try {
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&per_page=1`, { headers: { Authorization: key } });
      const body = res.ok ? await res.json() : null;
      const p = body?.photos?.[0];
      cache.set(k, { url: p?.src?.large2x ?? p?.src?.large ?? null, by: p?.photographer ?? null });
    } catch {
      return new Response(JSON.stringify({ url: null }), { headers: cors });
    }
  }
  return new Response(JSON.stringify(cache.get(k)), { headers: { ...cors, "Cache-Control": "public, max-age=86400" } });
});
