// SearchApi.io as SerpApi's backup (supabase/functions/offers/searchapi.ts): its answers, turned into SerpApi's shape,
// must come out of the existing parsers (shape.ts) as the same fields. The answers below are real ones, asked on
// 19 Oct 2026 and trimmed (tests/fixtures/searchapi/); the SerpApi ones asked the same day are in tests/fixtures/serp/.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fromSearchapi, searchapiFetch, searchapiQuery } from "../supabase/functions/offers/searchapi";
import { airbnbCandidate, airbnbOffer, candidateOffer, cityEvents, nearbyOf, priceInsightOf, serpFlights, serpStays, topSights, topicsOf } from "../supabase/functions/offers/shape";
import serpHotels from "./fixtures/serp/google-hotels-2026-10-19.json";
import serpFlight from "./fixtures/serp/google-flights-ist-opo-2026-10-19.json";
import serpAirbnb from "./fixtures/serp/airbnb-lisbon-2026-10-19.json";
import serpEvents from "./fixtures/serp/google-events-porto-2026-10-19.json";
import hotelsPorto from "./fixtures/searchapi/google-hotels-porto-2026-10-19.json";
import hotelsUbud from "./fixtures/searchapi/google-hotels-ubud-2026-10-19.json";
import flightsOne from "./fixtures/searchapi/google-flights-ist-opo-1-adult-2026-10-19.json";
import flightsTwo from "./fixtures/searchapi/google-flights-ist-opo-2-adults-2026-10-19.json";
import events from "./fixtures/searchapi/google-events-porto-2026-10-19.json";
import airbnb from "./fixtures/searchapi/airbnb-lisbon-2026-10-19.json";
import thingsToDo from "./fixtures/searchapi/google-things-to-do-porto-2026-10-19.json";

const search = (name: string) => `https://booking.example/${encodeURIComponent(name)}`;
const stays = (body: unknown, nights = 4) => serpStays(fromSearchapi("google_hotels", body), { lang: "tr", nights, now: 7, search });

afterEach(() => vi.unstubAllGlobals());

describe("SerpApi's params as SearchApi's", () => {
  it("keeps what carries over by name and drops the key", () => {
    const hotels = searchapiQuery({ engine: "google_hotels", q: "Porto, Portugal hotels", check_in_date: "2026-11-12", check_out_date: "2026-11-16", adults: "2", currency: "EUR", hl: "tr", api_key: "x" })!;
    expect(Object.fromEntries(hotels)).toEqual({ engine: "google_hotels", q: "Porto, Portugal hotels", check_in_date: "2026-11-12", check_out_date: "2026-11-16", adults: "2", currency: "EUR", hl: "tr" });
    expect(Object.fromEntries(searchapiQuery({ engine: "airbnb", q: "Lisbon", check_in_date: "a", check_out_date: "b", adults: "2", currency: "EUR" })!)).toMatchObject({ engine: "airbnb", q: "Lisbon" });
    expect(Object.fromEntries(searchapiQuery({ engine: "google", q: "Porto gezilecek yerler", hl: "tr", gl: "tr" })!)).toEqual({ engine: "google", q: "Porto gezilecek yerler", hl: "tr", gl: "tr" });
  });
  it("turns a one-way flight's type=2 into flight_type=one_way", () => {
    const flight = { engine: "google_flights", departure_id: "IST", arrival_id: "OPO", outbound_date: "2026-11-12", type: "2", currency: "EUR", hl: "en", adults: "1" };
    const q = Object.fromEntries(searchapiQuery(flight)!);
    expect(q).toMatchObject({ flight_type: "one_way", departure_id: "IST", arrival_id: "OPO", outbound_date: "2026-11-12", adults: "1" });
    expect(q).not.toHaveProperty("type");
    expect(Object.fromEntries(searchapiQuery({ ...flight, type: "1" })!).flight_type).toBe("round_trip");
    expect(searchapiQuery({ ...flight, type: "3" })).toBeNull();
  });
  it("asks Google Events for q alone (its hl must be en) and no other engine", () => {
    expect(Object.fromEntries(searchapiQuery({ engine: "google_events", q: "Events in Porto", hl: "tr" })!)).toEqual({ engine: "google_events", q: "Events in Porto" });
    expect(searchapiQuery({ engine: "bing", q: "x" })).toBeNull();
  });
});

describe("Google Hotels from SearchApi (Porto and Ubud, 12–16 Nov 2026, two people)", () => {
  it("gives the same fields SerpApi's answer does: name, rating, reviews, photo, place, price for the nights", () => {
    const list = stays(hotelsPorto);
    expect(list).toHaveLength(5);
    for (const c of list) {
      expect(c).toMatchObject({ rating: expect.any(Number), reviews: expect.any(Number), photo: expect.stringMatching(/^https:\/\//), geo: { lat: expect.any(Number), lng: expect.any(Number) }, source: "Google Hotels", currency: "EUR", nights: 4, area: "Otel" });
      expect(c.nightly).toBe(Math.round(c.total! / 4));
    }
    expect(list[0]).toMatchObject({ name: "Porto Palácio Hotel by The Editory", rating: 4.4, reviews: 3944, nightly: 86, total: 345 });
    // the key set a card is built from is the one SerpApi's hotels give
    const serp = serpStays(serpHotels["otel-porto"], { lang: "tr", nights: 4, now: 7, search });
    expect(Object.keys(list[0]).sort()).toEqual(Object.keys(serp[0]).sort());
  });
  it("reads the nearest place and the airport, and the praised and faulted topics, as SerpApi's did for the same hotel", () => {
    const [palacio] = stays(hotelsPorto);
    const [serpPalacio] = serpHotels["otel-porto"].properties;
    // Same hotel, same day, both providers: identical.
    expect(palacio.nearby).toEqual(nearbyOf(serpPalacio.nearby_places));
    expect(palacio.nearby).toEqual([
      { name: "San Remo Restaurante", mode: "walk", minutes: 5, airport: false },
      { name: "Francisco de Sá Carneiro Havaalanı", mode: "transit", minutes: 32, airport: true },
    ]);
    expect(palacio.topics).toEqual(topicsOf(serpPalacio.reviews_breakdown));
    expect(palacio.topics).toEqual([{ topic: "Hizmet", up: true }, { topic: "Bar", up: true }]);
    expect(stays(hotelsPorto).every((c) => c.nearby?.some((n) => n.airport))).toBe(true);
  });
  it("carries them onto the offer, and does the same for Ubud (an hour or two to the airport)", () => {
    const offer = candidateOffer(stays(hotelsPorto)[1], "", "tr");
    expect(offer).toMatchObject({ title: "Hotel Vila Galé Porto Ribeira", price: 530, currency: "EUR", nights: 4, meta: expect.stringMatching(/yorum$/) });
    expect(offer.nearby).toHaveLength(2);
    expect(offer.topics?.length).toBeGreaterThan(0);
    const ubud = stays(hotelsUbud);
    expect(ubud[0]).toMatchObject({ name: "Alaya Resort Ubud", nightly: 113, total: 453 });
    expect(ubud[0].nearby?.find((n) => n.airport)).toMatchObject({ mode: "transit", minutes: 131 });
  });
  it("tells a vacation rental from a hotel, and keeps nothing without a price or rating", () => {
    const rental = { properties: [{ type: "vacation_rental", name: "Casa", rating: 4.8, reviews: 10, price_per_night: { extracted_price: 100 }, total_price: { extracted_price: 400 } }, { type: "hotel", name: "No price", rating: 4 }, { type: "hotel", name: "No rating", price_per_night: { extracted_price: 50 } }] };
    const list = stays(rental);
    expect(list.map((c) => [c.name, c.area, c.total])).toEqual([["Casa", "Ev", 400]]);
    expect(stays(null)).toEqual([]);
  });
});

describe("Google Flights from SearchApi (IST→OPO, 12 Nov 2026, one way)", () => {
  const trips = (body: unknown, adults: number) => serpFlights(fromSearchapi("google_flights", body), adults, "IST", "OPO", "2026-11-12");
  it("reads each trip's carrier, clocks, stops and price per person as SerpApi's flights", () => {
    const list = trips(flightsOne, 1);
    expect(list).toHaveLength(5);
    expect(list[0]).toMatchObject({ airline: "TK", flight_number: "1451", departure_at: "2026-11-12T13:25", arrive_local: "15:25", transfers: 0, duration_to: 300, price: 221, source: "Google Flights", link: "/search/IST1211OPO1" });
    const vy = list.find((f) => f.airline === "VY")!;
    expect(vy).toMatchObject({ transfers: 1, price: 201, arrive_local: "08:10" });
    expect(vy.stopovers).toEqual([{ at: "BCN", land: "2026-11-12 21:00", leave: "2026-11-13 07:10" }]);
  });
  it("divides the price by the people asked for (Google's is for all of them)", () => {
    const two = trips(flightsTwo, 2);
    expect(two.map((f) => [f.airline, f.price])).toEqual([["TK", 221], ["VY", 201], ["UX", 211], ["TK", 252]]);
    expect(two[0].link).toBe("/search/IST1211OPO2");
  });
  it("judges the fare: Google's range, today's lowest, its level and a daily history, the same as SerpApi's for the day", () => {
    const i = priceInsightOf(fromSearchapi("google_flights", flightsOne))!;
    const serp = priceInsightOf(serpFlight)!;
    expect(i).toMatchObject({ low: 110, high: 200, lowest: 201, level: "high", source: "google", currency: "EUR" });
    expect([i.low, i.high, i.level]).toEqual([serp.low, serp.high, serp.level]);
    expect(i.history).toHaveLength(61);
    expect(i.history[0]).toEqual([Date.parse("2026-08-19T21:00:00Z"), 147]);
    expect(i.history.at(-1)).toEqual([1792357200000, 201]);
  });
  it("keeps the range though a two-person answer brings no history", () => {
    expect(priceInsightOf(fromSearchapi("google_flights", flightsTwo))).toMatchObject({ low: 220, high: 395, lowest: 402, level: "high", history: [] });
  });
  it("gives nothing for an answer without trips or insights", () => {
    expect(trips({}, 1)).toEqual([]);
    expect(trips(null, 1)).toEqual([]);
    expect(priceInsightOf(fromSearchapi("google_flights", {}))).toBeNull();
  });
});

describe("a city's sights from SearchApi (Google's things_to_do, Porto, hl=tr)", () => {
  it("keeps the name and rating of each sight, eight at most", () => {
    const list = topSights(fromSearchapi("google", thingsToDo));
    expect(list).toHaveLength(8);
    expect(list.map((s) => s.title).slice(0, 3)).toEqual(["Luís I Bridge", "Porto Cathedral", "Palácio da Bolsa"]);
    expect(list[0].rating).toBe(4.8);
    expect(list.map((s) => s.title)).toContain("Clérigos Kilisesi");
  });
  it("has a photo only where Google sent an https one: the first four come inline (data:) and are dropped", () => {
    const list = topSights(fromSearchapi("google", thingsToDo));
    expect(list.slice(0, 4).map((s) => s.photo)).toEqual([null, null, null, null]);
    expect(list.slice(4).every((s) => /^https:\/\/lh3\.googleusercontent\.com\//.test(s.photo ?? ""))).toBe(true);
  });
});

describe("a city's events from SearchApi ('Events in Porto', Google's page of Aug 2026)", () => {
  const at = { start: "2026-10-20", end: "2026-11-30", today: "2026-10-19", lang: "tr" as const, now: 1 };
  it("reads the day and hour, the venue, the tickets' page and seller; nights out are left out", () => {
    const list = cityEvents(fromSearchapi("google_events", events), at);
    expect(list.map((o) => o.title)).toEqual(["NOITE DE POESIA / POETRY NIGHT", "Porto: Fado na Baixa", "Porto: Espetáculo de Fado"]);
    expect(list[0]).toMatchObject({ kind: "activity", price: null, why: "23 Eki · 19:30", meta: "Casa da Horta - Associação Cultural", source: "eventbrite.com", url: expect.stringMatching(/^https:\/\/www\.eventbrite\.com\//), photo: expect.stringMatching(/^https:\/\//) });
    // the same fields and the same event as SerpApi's answer gave
    const serp = cityEvents(serpEvents, { ...at, end: "2026-10-31" });
    expect(Object.keys(list[0]).sort()).toEqual(Object.keys(serp[0]).sort());
    expect(serp[0]).toMatchObject({ title: list[0].title, why: list[0].why, meta: list[0].meta, source: list[0].source });
  });
  it("keeps only the stay's days", () => {
    expect(cityEvents(fromSearchapi("google_events", events), { ...at, start: "2026-11-01", end: "2026-11-05" })).toEqual([]);
    expect(cityEvents(fromSearchapi("google_events", events), { ...at, start: "2026-11-06", end: "2026-11-06" }).map((o) => o.why)).toEqual(["6 Kas · 18:30"]);
  });
  it("skips an event without a page", () => {
    expect(cityEvents(fromSearchapi("google_events", { events: [{ title: "X", date: "Fri, Oct 23", start_time: "Oct 23, 7:30 PM" }] }), at)).toEqual([]);
  });
});

describe("a home on Airbnb from SearchApi (Lisbon, 12–16 Nov 2026, two people)", () => {
  it("takes the best liked listing, a guest favourite first, its total for the nights, its place and Airbnb's own page", () => {
    const o = airbnbOffer(fromSearchapi("airbnb", airbnb), { lang: "tr", nights: 4, now: 7 })!;
    expect(o).toMatchObject({ kind: "stay", source: "Airbnb", currency: "EUR", nights: 4, rating: 4.96, reviews: 492, price: 635, area: "Santa Maria Maior", why: "Airbnb'de misafir favorisi", meta: "Misafir favorisi · 492 yorum" });
    expect(o.id).toBe("ab:15144002");
    expect(o.title).toBe("18th-century charm with contemporary design, a balcony, and A/C");
    expect(o.url).toMatch(/^https:\/\/www\.airbnb\.com\/rooms\//);
    expect(o.photo).toMatch(/^https:\/\//);
    expect(airbnbCandidate(o)).toMatchObject({ id: o.id, source: "Airbnb", total: 635, nightly: Math.round(635 / 4) });
    // the same fields as SerpApi's listing gave
    const serp = airbnbOffer(serpAirbnb, { lang: "tr", nights: 4, now: 7 })!;
    expect(Object.keys(o).sort()).toEqual(Object.keys(serp).sort());
  });
  it("gives nothing when no listing is liked enough or priced", () => {
    expect(airbnbOffer(fromSearchapi("airbnb", { properties: [{ id: "1", title: "A", link: "https://www.airbnb.com/rooms/1", rating: 4.5, reviews: 300, price: { extracted_total_price: 200 } }] }), { lang: "tr", nights: 3, now: 1 })).toBeNull();
    expect(airbnbOffer(fromSearchapi("airbnb", { properties: [{ id: "1", title: "A", link: "https://www.airbnb.com/rooms/1", rating: 4.9, reviews: 300 }] }), { lang: "tr", nights: 3, now: 1 })).toBeNull();
    expect(airbnbOffer(fromSearchapi("airbnb", null), { lang: "tr", nights: 3, now: 1 })).toBeNull();
  });
});

describe("asking SearchApi", () => {
  const params = { engine: "google_flights", departure_id: "IST", arrival_id: "OPO", outbound_date: "2026-11-12", type: "2", currency: "EUR", hl: "en", adults: "1" };
  const stub = (res: Partial<Response> & { json?: () => Promise<unknown> }) => {
    const f = vi.fn(async () => res as Response);
    vi.stubGlobal("fetch", f);
    return f;
  };

  it("sends the key as a Bearer header, never in the URL, and returns the answer in SerpApi's shape", async () => {
    const f = stub({ ok: true, json: async () => flightsOne });
    const body = await searchapiFetch(params, "sekret-key");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/www\.searchapi\.io\/api\/v1\/search\?/);
    expect(url).toContain("flight_type=one_way");
    expect(url).not.toContain("sekret-key");
    expect(url).not.toContain("api_key");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sekret-key");
    expect(priceInsightOf(body)).toMatchObject({ low: 110, high: 200 });
    expect(serpFlights(body, 1, "IST", "OPO", "2026-11-12")).toHaveLength(5);
  });
  it("gives null on an HTTP error, an error body, a failed call or an engine it isn't asked for", async () => {
    stub({ ok: false, json: async () => ({}) });
    expect(await searchapiFetch(params, "k")).toBeNull();
    stub({ ok: true, json: async () => ({ error: "You have exceeded your monthly quota." }) });
    expect(await searchapiFetch(params, "k")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await searchapiFetch(params, "k")).toBeNull();
    const f = stub({ ok: true, json: async () => ({}) });
    expect(await searchapiFetch({ engine: "bing", q: "x" }, "k")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
