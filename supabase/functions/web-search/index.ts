// Trip Radar web search: POST { q, lang, kind?: "event_dates" | "fact" | "research", year? } → a short answer
// grounded in Google Search through Gemini, with its sources: { answer, sources: [{ title, url }], kind, cached, at }
// (and `event` { start, end, place, official_url, confidence } for event dates). The board chat calls it only when
// it needs a live fact (an event's dates, opening hours, a ferry timetable, entry rules) or the traveller asks it
// to look something up. Only the question comes in; nothing about the person or the trip.
//
// The key is a Supabase secret, GEMINI_SEARCH_KEY (a separate, billed Google project used only for search).
// Without it: { answer: null, reason: "not-configured" }. Answers are cached in trip_radar.search_cache by kind +
// question + year (event dates 30 days, a fact 7, research 3, "nothing found" 1). Calls out are capped: 150 a day
// for everyone (SEARCH_DAILY_CAP) → reason "capped", and 30 a day per caller → reason "limited". A caller is the
// extension's install id (x-install-id header), else its address; only a hash of either is stored. Never throws.
// Deployed with verify_jwt on, like city-image: the extension sends the publishable key as `apikey`.
//
// Gemini: the Interactions API with the google_search tool and the current Flash model, as documented at
// https://ai.google.dev/gemini-api/docs/google-search (REST: POST /v1beta/interactions
// { model, input, tools: [{ type: "google_search" }] }; citations come back as url_citation annotations on the
// model_output text). Model list: https://ai.google.dev/gemini-api/docs/models ("gemini-3.8-flash", stable).
// SEARCH_MODEL overrides the model. A 404 from the Interactions endpoint falls back to generateContent with
// tools: [{ google_search: {} }] (sources from groundingMetadata.groundingChunks).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  dailyCap,
  freshDays,
  installIdOf,
  kindOf,
  langOf,
  normalizeQuery,
  PER_CALLER_DAILY,
  searchPrompt,
  shapeAnswer,
  yearOf,
  type EventDates,
  type SearchKind,
  type Shaped,
  type Source,
} from "./shape.ts";

const MODEL = "gemini-3.8-flash";
const API = "https://generativelanguage.googleapis.com/v1beta";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-install-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const none = (reason: string, status = 200) => reply({ answer: null, reason }, status);

async function sha256(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Who's asking, as a hash: the install id when sent, else the first forwarded address. */
async function callerOf(req: Request): Promise<string> {
  const id = installIdOf(req.headers.get("x-install-id"));
  if (id) return `i:${await sha256(id)}`;
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim();
  return `a:${await sha256(ip || "unknown")}`;
}

async function askGemini(key: string, model: string, prompt: string): Promise<{ ok: true; shaped: Shaped } | { ok: false; status: number }> {
  const headers = { "Content-Type": "application/json", "x-goog-api-key": key };
  const signal = AbortSignal.timeout(40_000);
  let res = await fetch(`${API}/interactions`, { method: "POST", headers, signal, body: JSON.stringify({ model, input: prompt, tools: [{ type: "google_search" }] }) });
  if (res.status === 404) {
    res = await fetch(`${API}/models/${model}:generateContent`, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
    });
  }
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, shaped: shapeAnswer(await res.json()) };
}

interface CachedRow {
  answer: string | null;
  sources: Source[] | null;
  event: EventDates | null;
  fetched_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return none("method", 405);
  try {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return none("bad-request", 400);
    }
    const q = normalizeQuery(body.q);
    if (q.length < 2) return none("bad-request", 400);
    const kind: SearchKind = kindOf(body.kind);
    const lang = langOf(body.lang);
    const year = yearOf(body.year);
    // The answer is written in the asker's language, so the cache keeps one per language.
    const ck = `${lang}:${q}`;
    // Pasted secrets sometimes carry quotes, the name or a "NAME=" prefix: keep the key-shaped token.
    const key = (Deno.env.get("GEMINI_SEARCH_KEY") ?? "").match(/[A-Za-z0-9._-]{30,}/)?.[0] ?? "";
    if (!key) return none("not-configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const row = (await sb.rpc("search_cached", { p_kind: kind, p_q: ck, p_year: year })).data as CachedRow | null;
    if (row) {
      const days = (Date.now() - Date.parse(row.fetched_at)) / 864e5;
      if (days < freshDays(kind, row.answer != null)) {
        return row.answer
          ? reply({ answer: row.answer, sources: row.sources ?? [], kind, cached: true, at: row.fetched_at, ...(kind === "event_dates" ? { event: row.event } : {}) })
          : reply({ answer: null, reason: "no-result", kind, cached: true, at: row.fetched_at });
      }
    }

    const verdict = (await sb.rpc("search_take_call", { p_caller: await callerOf(req), p_cap: dailyCap(Deno.env.get("SEARCH_DAILY_CAP")), p_per_caller: PER_CALLER_DAILY }))
      .data as string | null;
    if (verdict !== "ok") return none(verdict === "limited" ? "limited" : "capped");

    const today = new Date().toISOString().slice(0, 10);
    const got = await askGemini(key, Deno.env.get("SEARCH_MODEL")?.trim() || MODEL, searchPrompt(q, kind, lang, year, today));
    if (!got.ok) return none(`upstream-${got.status}`);
    const { answer, sources, event } = got.shaped;
    await sb.rpc("search_store", { p_kind: kind, p_q: ck, p_year: year, p_answer: answer, p_sources: sources, p_event: event });
    const at = new Date().toISOString();
    if (!answer) return reply({ answer: null, reason: "no-result", kind, cached: false, at });
    return reply({ answer, sources, kind, cached: false, at, ...(kind === "event_dates" ? { event } : {}) });
  } catch (e) {
    return none(e instanceof DOMException && e.name === "TimeoutError" ? "timeout" : "error");
  }
});
