// Trip Radar öneri verisi: GET ?kind=flight&from=IST&to=DPS&day=2026-11-10&adults=2&lang=tr, or
// ?kind=stay&city=Ubud&country=Indonesia&start=2026-11-12&end=2026-11-16&adults=2 → { offers } for an empty card's
// "✨ Senin için N öneri" row (src/lib/offerSource.ts). The rules are in shape.ts; here the sources are asked, with
// the keys kept as Supabase secrets, and what they said is cached so many travellers asking the same cost one call:
//  - flights: Aviasales' cached prices (Travelpayouts Data API, TRAVELPAYOUTS_TOKEN), airlines' names and airports'
//    time zones from Travelpayouts' public data files;
//  - stays: the city's Tripadvisor id from RapidAPI's "Tripadvisor COM" typeahead (the RapidAPI key, kept as
//    AERODATABOX_KEY; asked once per city, kept for good), then Xotelo's hotel list and each platform's price;
//  - every page is turned into a Travelpayouts partner link (Links API, marker and project as secrets or the
//    defaults below) so a booking made there pays the project; a page it can't turn stays as it was.
// `prefer=cheap` (the chat's "daha ucuz") gives the three cheapest instead of the mixed three, and `max` a ceiling
// in euros (a stay's by the night, a flight's per person). A stay's `candidates=1` adds up to six hotels from the
// same list, each priced for the dates (one Xotelo call each, cached a day; one it can't price keeps its usual range).
// Live prices (SerpApi: Google Flights, Google Hotels; SERPAPI_KEY, a small free quota) only when those have
// nothing, or on `live=1` (the chat's live look); the page opened stays a partner's.
// Activities (?kind=activity&city=Ubud&start=…&end=…&adults=2[&q=cooking class]) from Viator's Partner API (VIATOR_KEY):
// its pages carry the project's Viator partner code already, so they aren't turned; kept an hour, as Viator asks.
// Each source is its own part: one failing leaves that kind with no offers and the card with its search buttons.
// Calls out are capped per source and day. Deployed with verify_jwt off like `flight`: nothing personal comes in,
// only places, days and a head-count.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adultsOf, airportCodeOk, askableDay, bookingSearch, cheapest, flightOffer, geoFromTypeahead, langOf, maxOf, nightsBetween,
  candidateOffer, pickCandidates, pickCheapFlights, pickCheapStays, pickFlights, pickLiveStays, pickStays, placeOk, preferOf,
  pickActivities, serpFlights, serpStays, stayCandidate, stayOffer, viatorDestination, type AviaFlight, type OfferOut, type StayCandidate,
  type ViProduct, type XoHotel, type XoRate,
} from "./shape.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const HOURS = { flight: 12, stay: 24, activity: 1 };
const CAPS: Record<string, number> = { aviasales: 400, xotelo: 400, tripadvisor: 5, links: 300, serpapi: 8, viator: 300 };
const cap = (source: string) => Number(Deno.env.get(`OFFERS_CAP_${source.toUpperCase()}`)) || CAPS[source];

type Sb = ReturnType<typeof createClient>;

async function cached<T>(sb: Sb, key: string, hours: number | null): Promise<T | undefined> {
  const row = (await sb.rpc("offers_cached", { p_key: key })).data as { data: T; fetched_at: string } | null;
  if (!row) return undefined;
  if (hours != null && Date.now() - Date.parse(row.fetched_at) > hours * 36e5) return undefined;
  return row.data;
}
const store = (sb: Sb, key: string, data: unknown) => sb.rpc("offers_store", { p_key: key, p_data: data });
const take = async (sb: Sb, source: string) => (await sb.rpc("offers_take_call", { p_source: source, p_cap: cap(source) })).data === true;

// Public data files, read once per instance.
let airlines: Map<string, string> | null = null;
let zones: Map<string, string> | null = null;
async function loadNames() {
  if (!airlines) {
    try {
      const list = (await (await fetch("https://api.travelpayouts.com/data/en/airlines.json")).json()) as { code?: string; name?: string }[];
      airlines = new Map(list.filter((a) => a.code && a.name).map((a) => [a.code!, a.name!]));
    } catch {
      airlines = new Map();
    }
  }
  if (!zones) {
    try {
      const list = (await (await fetch("https://api.travelpayouts.com/data/en/airports.json")).json()) as { code?: string; time_zone?: string }[];
      zones = new Map(list.filter((a) => a.code && a.time_zone).map((a) => [a.code!, a.time_zone!]));
    } catch {
      zones = new Map();
    }
  }
}

type Ask = { adults: number; lang: "tr" | "en"; prefer: "cheap" | null; max: number | null; live: boolean };

/** One SerpApi search, cached (its answers don't change in hours), under its own small daily cap. */
async function serp(sb: Sb, params: Record<string, string>, hours: number): Promise<unknown | null> {
  const key = (Deno.env.get("SERPAPI_KEY") ?? "").trim();
  if (!key) return null;
  const q = new URLSearchParams(params);
  const cacheKey = `serp|${q}`;
  const had = await cached<unknown>(sb, cacheKey, hours);
  if (had) return had;
  if (!(await take(sb, "serpapi"))) return (await cached<unknown>(sb, cacheKey, null)) ?? null;
  q.set("api_key", key);
  const res = await fetch(`https://serpapi.com/search.json?${q}`);
  if (!res.ok) return null;
  const body = await res.json();
  if ((body as { error?: unknown }).error) return null;
  await store(sb, cacheKey, body);
  return body;
}

async function flights(sb: Sb, token: string, from: string, to: string, day: string, { adults, lang, prefer, max, live }: Ask): Promise<OfferOut[]> {
  const ask = async (direct: boolean): Promise<AviaFlight[]> => {
    const key = `avia|${from}|${to}|${day}|${direct ? "d" : "a"}`;
    const had = await cached<AviaFlight[]>(sb, key, HOURS.flight);
    if (had) return had;
    if (!(await take(sb, "aviasales"))) return (await cached<AviaFlight[]>(sb, key, null)) ?? [];
    const q = new URLSearchParams({ origin: from, destination: to, departure_at: day, one_way: "true", direct: String(direct), sorting: "price", currency: "eur", limit: direct ? "5" : "30" });
    const res = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${q}`, { headers: { "X-Access-Token": token } });
    if (!res.ok) return (await cached<AviaFlight[]>(sb, key, null)) ?? [];
    const data = ((await res.json()) as { data?: AviaFlight[] }).data ?? [];
    await store(sb, key, data);
    return data;
  };
  const pick = (all: AviaFlight[], direct: AviaFlight[]) =>
    prefer === "cheap" || max != null ? pickCheapFlights([...all, ...direct], lang, adults, max) : pickFlights(all, direct, lang, adults);
  let picked = live ? [] : pick(...(await Promise.all([ask(false), ask(true)])));
  // Live from Google Flights: asked for (the chat), or the cache has nothing for this day.
  if (!picked.length) {
    const body = await serp(sb, { engine: "google_flights", departure_id: from, arrival_id: to, outbound_date: day, type: "2", currency: "EUR", hl: "en", adults: String(adults) }, 6);
    picked = pick(serpFlights(body, adults, from, to, day), []);
  }
  if (!picked.length) return [];
  await loadNames();
  const now = Date.now();
  return picked.map((p) => flightOffer(p, { adults, now, airline: (c) => airlines?.get(c) ?? null, zone: (a) => zones?.get(a) ?? null }));
}

async function geoOf(sb: Sb, rapidKey: string, city: string, country: string | null): Promise<string | null> {
  const query = country ? `${city} ${country}` : city;
  const key = `geo|${query.toLocaleLowerCase("en")}`;
  const had = await cached<{ geo: string | null }>(sb, key, null);
  if (had) return had.geo;
  if (!rapidKey || !(await take(sb, "tripadvisor"))) return null;
  const host = "tripadvisor-com1.p.rapidapi.com";
  const res = await fetch(`https://${host}/auto-complete?query=${encodeURIComponent(query)}`, { headers: { "x-rapidapi-key": rapidKey, "x-rapidapi-host": host } });
  if (!res.ok) return null;
  const geo = geoFromTypeahead(await res.json());
  await store(sb, key, { geo });
  return geo;
}

async function xotelo<T>(sb: Sb, path: string, hours: number): Promise<T | null> {
  const key = `xo|${path}`;
  const had = await cached<T>(sb, key, hours);
  if (had) return had;
  if (!(await take(sb, "xotelo"))) return (await cached<T>(sb, key, null)) ?? null;
  const res = await fetch(`https://data.xotelo.com/api/${path}`);
  if (!res.ok) return (await cached<T>(sb, key, null)) ?? null;
  const body = (await res.json()) as { error?: unknown; result?: T };
  if (body.error || !body.result) return null;
  await store(sb, key, body.result);
  return body.result;
}

type Stays = { offers: OfferOut[]; candidates: StayCandidate[] };

/** Google Hotels for these nights (live): its hotels with their prices; the row's three from them. */
async function liveStays(sb: Sb, city: string, country: string | null, start: string, end: string, { adults, lang, prefer, max }: Ask): Promise<Stays> {
  const nights = nightsBetween(start, end);
  const body = await serp(sb, { engine: "google_hotels", q: `${city}${country ? `, ${country}` : ""} hotels`, check_in_date: start, check_out_date: end, adults: String(adults), currency: "EUR", hl: lang === "en" ? "en" : "tr" }, 12);
  const all = serpStays(body, { lang, nights, now: Date.now(), search: (name) => bookingSearch(name, city, start, end, adults) });
  const within = max != null ? all.filter((c) => (c.nightly ?? Infinity) <= max) : all;
  const offers = prefer === "cheap" || max != null ? cheapest(within.map((c) => candidateOffer(c, "", lang)), lang, max) : pickLiveStays(within, lang);
  return { offers, candidates: within.slice(0, 6) };
}

async function stays(sb: Sb, rapidKey: string, city: string, country: string | null, start: string, end: string, ask: Ask): Promise<Stays> {
  const { adults, lang, prefer, max } = ask;
  const nights = nightsBetween(start, end);
  if (nights < 1 || nights > 60) return { offers: [], candidates: [] };
  if (ask.live) return liveStays(sb, city, country, start, end, ask);
  const geo = await geoOf(sb, rapidKey, city, country);
  if (!geo) return liveStays(sb, city, country, start, end, ask);
  const cheap = prefer === "cheap" || max != null;
  // Asked for cheaper ones, a longer list: the cheap ones are seldom in the best value's first thirty.
  const list = await xotelo<{ list?: XoHotel[] }>(sb, `list?location_key=g${geo}&limit=${cheap ? 100 : 30}&sort=best_value`, 24 * 7);
  const picked = cheap ? pickCheapStays(list?.list ?? [], max).map((h) => ({ h, why: "" })) : pickStays(list?.list ?? [], lang);
  const now = Date.now();
  const price = async (p: { h: XoHotel; why: string }) => {
    const rates = await xotelo<{ rates?: XoRate[] }>(sb, `rates?hotel_key=${encodeURIComponent(p.h.key!)}&chk_in=${start}&chk_out=${end}&currency=EUR`, HOURS.stay);
    return stayOffer(p, rates?.rates ?? [], { lang, nights, now, search: (h, platform) => (platform === "BookingCom" ? bookingSearch(h.name!, city, start, end, adults) : null) });
  };
  // The candidates are the offers' hotels and up to three more from the same list, each priced for the dates too.
  const chosen = pickCandidates(list?.list ?? [], picked.map((p) => p.h.key!));
  const more = chosen.filter((h) => !picked.some((p) => p.h.key === h.key)).map((h) => ({ h, why: "" }));
  const [out, extra] = await Promise.all([Promise.all(picked.map(price)), Promise.all(more.map(price))]);
  const priced = out.filter((o): o is OfferOut => !!o);
  const offers = cheap ? cheapest(priced, lang, max) : priced;
  const offerOf = new Map([...priced, ...extra.filter((o): o is OfferOut => !!o)].map((o) => [o.id, o]));
  const candidates = chosen.map((h) => stayCandidate(h, offerOf.get(`xo:${h.key}`) ?? null, { lang, nights, now, url: bookingSearch(h.name!, city, start, end, adults) }));
  // Too few priced for these nights: Google Hotels' live list instead (when it has any).
  if (offers.length < 2 || candidates.filter((c) => c.total != null).length < 3) {
    const live = await liveStays(sb, city, country, start, end, ask);
    if (live.offers.length >= offers.length && live.candidates.length) return live;
  }
  return { offers, candidates };
}

/** Viator's Partner API: a POST with the key, under its own daily cap; null when it can't answer. */
async function viator(sb: Sb, path: string, body: unknown): Promise<unknown | null> {
  const key = (Deno.env.get("VIATOR_KEY") ?? "").trim();
  if (!key || !(await take(sb, "viator"))) return null;
  const res = await fetch(`https://api.viator.com/partner${path}`, {
    method: "POST",
    headers: { "exp-api-key": key, Accept: "application/json;version=2.0", "Accept-Language": "en-US", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok ? await res.json() : null;
}

/** A city's activities on Viator for these days: by its words when the card names one ("tekne turu"), else the city's own. */
async function activities(sb: Sb, city: string, country: string | null, start: string | null, end: string | null, q: string | null, { adults, lang, prefer }: Ask): Promise<OfferOut[]> {
  const where = country ? `${city}, ${country}` : city;
  const geoKey = `vi-dest|${where.toLocaleLowerCase("en")}`;
  let dest = (await cached<{ id: string | null }>(sb, geoKey, 24 * 7))?.id ?? null;
  if (!dest) {
    dest = viatorDestination(await viator(sb, "/search/freetext", { searchTerm: where, searchTypes: [{ searchType: "DESTINATIONS", pagination: { start: 1, count: 1 } }], currency: "EUR" }));
    if (dest) await store(sb, geoKey, { id: dest });
  }
  if (!dest) return [];
  const dates = start && end ? { startDate: start, endDate: end } : {};
  const found = q
    ? ((await viator(sb, "/search/freetext", {
        searchTerm: q,
        productFiltering: { destination: dest, ...(start && end ? { dateRange: { from: start, to: end } } : {}), rating: { from: 4, to: 5 } },
        searchTypes: [{ searchType: "PRODUCTS", pagination: { start: 1, count: 20 } }],
        currency: "EUR",
      })) as { products?: { results?: ViProduct[] } } | null)?.products?.results
    : ((await viator(sb, "/products/search", {
        filtering: { destination: dest, ...dates, rating: { from: 4, to: 5 } },
        sorting: { sort: "DEFAULT" },
        pagination: { start: 1, count: 20 },
        currency: "EUR",
      })) as { products?: ViProduct[] } | null)?.products;
  return pickActivities(found ?? [], lang, adults, Date.now(), prefer === "cheap");
}

/** Every page as a Travelpayouts partner link, ten at a time; a page it can't turn is kept as it was. */
async function partnerLinks(sb: Sb, token: string, offers: OfferOut[]): Promise<OfferOut[]> {
  const turned = await turnLinks(sb, token, offers.map((o) => o.url));
  return offers.map((o) => ({ ...o, url: turned.get(o.url) ?? o.url }));
}

async function turnLinks(sb: Sb, token: string, pages: string[]): Promise<Map<string, string>> {
  const marker = Number(Deno.env.get("TRAVELPAYOUTS_MARKER")) || 281838;
  const trs = Number(Deno.env.get("TRAVELPAYOUTS_TRS")) || 34810;
  const urls = [...new Set(pages)];
  const turned = new Map<string, string>();
  for (let i = 0; i < urls.length; i += 10) {
    if (!(await take(sb, "links"))) break;
    try {
      const res = await fetch("https://api.travelpayouts.com/links/v1/create", {
        method: "POST",
        headers: { "X-Access-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ trs, marker, shorten: false, links: urls.slice(i, i + 10).map((url) => ({ url, sub_id: "tripradar" })) }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { result?: { links?: { url: string; code: string; partner_url?: string }[] } };
      for (const l of body.result?.links ?? []) if (l.code === "success" && l.partner_url?.startsWith("https://")) turned.set(l.url, l.partner_url);
    } catch {
      // kept as they were
    }
  }
  return turned;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return reply(405, { error: "method" });
  const url = new URL(req.url);
  const p = (k: string) => url.searchParams.get(k);
  const token = (Deno.env.get("TRAVELPAYOUTS_TOKEN") ?? "").trim();
  if (!token) return reply(503, { error: "not-configured" });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const now = new Date();
  const ask: Ask = { adults: adultsOf(p("adults")), lang: langOf(p("lang")), prefer: preferOf(p("prefer")), max: maxOf(p("max")), live: p("live") === "1" };
  const how = `${ask.prefer ?? ""}|${ask.max ?? ""}${ask.live ? "|live" : ""}`;
  let offers: OfferOut[] = [];
  try {
    if (p("kind") === "flight") {
      const from = airportCodeOk(p("from")), to = airportCodeOk(p("to")), day = askableDay(p("day"), now);
      if (!from || !to || !day || from === to) return reply(400, { error: "ask" });
      const key = `out|f|${from}|${to}|${day}|${ask.adults}|${ask.lang}|${how}`;
      const had = await cached<OfferOut[]>(sb, key, HOURS.flight);
      offers = had ?? (await partnerLinks(sb, token, await flights(sb, token, from, to, day, ask)));
      if (!had) await store(sb, key, offers);
    } else if (p("kind") === "stay") {
      const city = placeOk(p("city")), country = placeOk(p("country")), start = askableDay(p("start"), now), end = askableDay(p("end"), now);
      if (!city || !start || !end || end <= start) return reply(400, { error: "ask" });
      const key = `out2|s|${city.toLocaleLowerCase("en")}|${country ?? ""}|${start}|${end}|${ask.adults}|${ask.lang}|${how}`;
      let found = await cached<Stays>(sb, key, HOURS.stay);
      if (!found) {
        const fresh = await stays(sb, (Deno.env.get("AERODATABOX_KEY") ?? "").trim(), city, country, start, end, ask);
        const turned = await turnLinks(sb, token, [...fresh.offers.map((o) => o.url), ...fresh.candidates.map((c) => c.url)]);
        found = {
          offers: fresh.offers.map((o) => ({ ...o, url: turned.get(o.url) ?? o.url })),
          candidates: fresh.candidates.map((c) => ({ ...c, url: turned.get(c.url) ?? c.url })),
        };
        await store(sb, key, found);
      }
      if (p("candidates") === "1") return reply(200, { offers: found.offers, candidates: found.candidates });
      offers = found.offers;
    } else if (p("kind") === "activity") {
      const city = placeOk(p("city")), country = placeOk(p("country"));
      const start = askableDay(p("start"), now), end = askableDay(p("end"), now);
      const raw = p("q")?.normalize("NFC").replace(/\s+/g, " ").trim() ?? "";
      const q = raw && raw.length <= 80 && /^[\p{L}\p{M}\p{N} .,'’&()-]+$/u.test(raw) ? raw : null;
      if (!city) return reply(400, { error: "ask" });
      const key = `out|a|${city.toLocaleLowerCase("en")}|${country ?? ""}|${start ?? ""}|${end ?? ""}|${q ?? ""}|${ask.adults}|${ask.lang}|${how}`;
      const had = await cached<OfferOut[]>(sb, key, HOURS.activity);
      offers = had ?? (await activities(sb, city, country, start, end, q, ask));
      if (!had) await store(sb, key, offers);
    } else {
      return reply(400, { error: "ask" });
    }
  } catch {
    return reply(200, { offers: [] });
  }
  return reply(200, { offers });
});
