// Trip Radar's AI gate, the owner's side (0.36): make a ticket for an invite, close one, see this month's use.
// Only with the owner's secret (Supabase secret TR_ADMIN_SECRET, the same text in the owner's extension under
// Ayarlar → AI kapısı). Deployed with verify_jwt off: the secret is the credential.
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const secret = (Deno.env.get("TR_ADMIN_SECRET") ?? "").trim();
  if (secret.length < 24) return reply(503, { error: "not-configured" });
  if (req.method !== "POST" || !same((req.headers.get("x-admin-secret") ?? "").trim(), secret)) return reply(401, { error: "unauthorized" });
  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: string; tail?: string };
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
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
    return error ? reply(500, { error: "usage" }) : reply(200, { tickets: data, capUsd: num("AI_MONTHLY_CAP_USD", 20), dailyRequests: num("AI_DAILY_REQUESTS", 300), aiReady: !!Deno.env.get("GEMINI_API_KEY") });
  }
  return reply(400, { error: "action" });
});
