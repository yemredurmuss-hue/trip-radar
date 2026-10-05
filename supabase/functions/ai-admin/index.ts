// Trip Radar's AI gate, the owner's side (0.36): make a ticket for an invite, close one, see this month's use, hand
// over the Gemini key. Only the owner: the computer whose claim was approved (its secret's SHA-256 in ai_config),
// or the TR_ADMIN_SECRET function secret. Deployed with verify_jwt off: the secret is the credential.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// A fresh ticket ("trk_" + 192 random bits) and the limits the gate applies (the same defaults as ai/policy.ts;
// kept here so the function deploys on its own).
const newTicket = () => `trk_${[...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
const num = (key: string, fallback: number) => {
  const v = Number(Deno.env.get(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-admin-secret, content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/** Same length and same time for a wrong secret of any kind. */
function same(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method" });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: string; tail?: string; key?: string };
  const given = (req.headers.get("x-admin-secret") ?? "").trim();
  const config = ((await sb.rpc("ai_gate_config")).data ?? {}) as { owner_hash?: string | null; owner_approved?: boolean; has_key?: boolean };
  const hash = given.length >= 24 ? await sha256(given) : "";
  const envSecret = (Deno.env.get("TR_ADMIN_SECRET") ?? "").trim();
  const owner = (envSecret.length >= 24 && same(given, envSecret)) || (!!config.owner_approved && !!hash && same(hash, config.owner_hash ?? ""));

  // The owner's computer claims the gate (approved once by hand); anyone may ask where a claim stands.
  if (body.action === "claim") {
    if (config.owner_approved) return reply(409, { error: "owned" });
    if (!hash) return reply(400, { error: "secret" });
    await sb.rpc("ai_gate_claim", { p_hash: hash });
    return reply(200, { pending: true });
  }
  if (body.action === "status") {
    return reply(200, { owned: !!config.owner_approved, mine: owner, pending: !config.owner_approved && !!hash && hash === config.owner_hash, hasKey: !!config.has_key || !!Deno.env.get("GEMINI_API_KEY") });
  }
  if (!owner) return reply(401, { error: "unauthorized" });
  if (body.action === "set-key") {
    const key = String(body.key ?? "").trim();
    if (!/^[A-Za-z0-9_-]{30,}$/.test(key)) return reply(400, { error: "key" });
    const { error } = await sb.rpc("ai_gate_set_key", { p_key: key });
    return error ? reply(500, { error: "set-key" }) : reply(200, { ok: true });
  }
  if (body.action === "mint") {
    const token = newTicket();
    const { error } = await sb.rpc("ai_gate_add", { p_token: token, p_name: String(body.name ?? "").slice(0, 60) });
    return error ? reply(500, { error: "mint" }) : reply(200, { token });
  }
  if (body.action === "revoke") {
    const { data, error } = await sb.rpc("ai_gate_revoke", { p_token_tail: String(body.tail ?? "") });
    return error ? reply(500, { error: "revoke" }) : reply(200, { closed: data });
  }
  if (body.action === "usage") {
    const { data, error } = await sb.rpc("ai_gate_usage");
    return error ? reply(500, { error: "usage" }) : reply(200, { tickets: data, capUsd: num("AI_MONTHLY_CAP_USD", 20), dailyRequests: num("AI_DAILY_REQUESTS", 300), aiReady: !!Deno.env.get("GEMINI_API_KEY") || !!config.has_key });
  }
  return reply(400, { error: "action" });
});
