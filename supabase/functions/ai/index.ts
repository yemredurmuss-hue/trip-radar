// Trip Radar's AI gate (0.36): the invited travellers' extension calls Gemini through here, with the ticket from
// their invite as its "API key". The gate checks the ticket, the day's and the month's limits (policy.ts),
// forwards the call with the real key (Supabase secret GEMINI_API_KEY), and counts what it cost. Page contents
// pass through and are never stored. Deployed with verify_jwt off: the ticket is the caller's credential.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { costOf, googleError, limitsFrom, targetOf, verdict, type GateStatus } from "./policy.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-goog-api-key, x-goog-api-client, content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, googleError(405, "Trip Radar AI: yalnız POST.", "method"));
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // The key: the function secret, else the one the owner's extension handed over (ai_config).
  const stored = Deno.env.get("GEMINI_API_KEY") || ((await sb.rpc("ai_gate_key")).data as string | null) || "";
  const key = stored.match(/[A-Za-z0-9._-]{30,}/)?.[0] ?? "";
  if (!key) return reply(503, googleError(503, "Trip Radar AI henüz kurulmadı (sunucuda anahtar yok).", "not-configured"));
  const limits = limitsFrom((k) => Deno.env.get(k));
  const token = (req.headers.get("x-goog-api-key") ?? "").trim();
  const target = targetOf(new URL(req.url).pathname);

  let status: GateStatus | null = null;
  if (/^trk_[0-9a-f]{48}$/.test(token)) {
    const { data, error } = await sb.rpc("ai_gate_status", { p_token: token });
    if (error) return reply(503, googleError(503, "Trip Radar AI şu an yanıt vermiyor.", "status"));
    status = data as GateStatus;
  }
  const ok = verdict(token, target, limits, status);
  if (!ok.ok) return reply(ok.status, googleError(ok.status, ok.message, ok.reason));

  const upstream = await fetch(`https://generativelanguage.googleapis.com/${target!.version}/models/${target!.model}:${target!.method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: await req.text(),
  });
  const text = await upstream.text();
  let usage: unknown = null;
  try {
    usage = (JSON.parse(text) as { usageMetadata?: unknown }).usageMetadata ?? null;
  } catch {
    // not JSON: counted as a request with no tokens
  }
  const cost = costOf(usage, limits);
  await sb.rpc("ai_gate_record", { p_token: token, p_in: cost.input, p_out: cost.output, p_cost: cost.usd });
  return reply(upstream.status, text);
});
