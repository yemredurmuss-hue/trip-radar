// Trip Radar uçuş verisi (0.36.15): GET ?number=KL1577&day=2026-10-07 → the flight as the extension reads it
// (shape.ts), from the cache while it's fresh, else from AeroDataBox with the key kept as a Supabase secret
// (AERODATABOX_KEY). Calls out are capped per day (AERO_DAILY_CAP, 20 by default) so the subscription's quota
// can't run out; then the last answer known is given. Deployed with verify_jwt off, like the AI gate: nothing
// personal goes in or out, only a flight number and its day.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { askableDay, flightNumber, freshFor, shapeFlight, type FlightLive } from "./shape.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return reply(405, { error: "method" });
  const url = new URL(req.url);
  const now = new Date();
  const number = flightNumber(url.searchParams.get("number"));
  const day = askableDay(url.searchParams.get("day"), now);
  if (!number || !day) return reply(400, { error: "ask" });
  const key = (Deno.env.get("AERODATABOX_KEY") ?? "").trim();
  if (!key) return reply(503, { error: "not-configured" });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const cached = (await sb.rpc("flight_cached", { p_number: number, p_day: day })).data as { data: FlightLive | null; fetched_at: string } | null;
  if (cached) {
    const age = (now.getTime() - Date.parse(cached.fetched_at)) / 6e4;
    if (age < freshFor(cached.data, day, now)) return reply(200, { flight: cached.data, cached: true });
  }
  const cap = Number(Deno.env.get("AERO_DAILY_CAP")) || 20;
  const allowed = (await sb.rpc("flight_take_call", { p_cap: cap })).data === true;
  if (!allowed) return reply(200, { flight: cached?.data ?? null, cached: true, capped: true });

  const upstream = await fetch(
    `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}/${day}?withAircraftImage=false&withLocation=false&dateLocalRole=Departure`,
    { headers: { "x-rapidapi-key": key, "x-rapidapi-host": "aerodatabox.p.rapidapi.com" } },
  );
  if (upstream.status === 204 || upstream.status === 404) {
    await sb.rpc("flight_store", { p_number: number, p_day: day, p_data: null });
    return reply(200, { flight: null });
  }
  if (!upstream.ok) return reply(200, { flight: cached?.data ?? null, cached: true, upstream: upstream.status });
  const flight = shapeFlight(await upstream.json(), number, now.toISOString());
  await sb.rpc("flight_store", { p_number: number, p_day: day, p_data: flight });
  return reply(200, { flight });
});
