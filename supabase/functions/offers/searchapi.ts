// SearchApi.io as SerpApi's stand-in (backup while SerpApi's free quota is spent or its key is missing, and the
// provider to move to when a plan is bought). `serp()` in index.ts keeps speaking SerpApi's words: params in, a body
// in SerpApi's shape out, so shape.ts' parsers, the cache keys and the caps stay as they are. Here only the two
// translations live: SerpApi's params → SearchApi's, and SearchApi's answer → SerpApi's shape. What differs, found by
// asking it for real on 19 Oct 2026 (fixtures in tests/fixtures/searchapi/), is listed in
// docs/arastirma/2026-10-19-searchapi-alan-farklari.md.
//
// TODO(terms, 2026-10-19): SearchApi's terms on caching/storing answers and commercial use were not read (the /terms
// paths 404ed); Emre said "later". Read them before the plan is bought or the cache outlives a day.

const ENDPOINT = "https://www.searchapi.io/api/v1/search";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** The engines both providers have; anything else isn't asked of SearchApi. */
const ENGINES = new Set(["google_hotels", "google_flights", "google_events", "airbnb", "google"]);

/**
 * SerpApi's params as SearchApi's query. Most carry over by name (q, dates, adults, currency, hl, gl,
 * departure_id/arrival_id/outbound_date); a flight's `type` (2 = one way) is `flight_type=one_way`; Google Events takes
 * only `q` (its `hl` must be `en`). null for an engine or a trip kind SearchApi isn't asked for.
 */
export function searchapiQuery(params: Record<string, string>): URLSearchParams | null {
  const engine = params.engine;
  if (!ENGINES.has(engine)) return null;
  const out: Record<string, string> = { ...params };
  delete out.api_key;
  if (engine === "google_flights") {
    const { type, ...rest } = out;
    if (type && type !== "1" && type !== "2") return null;
    return new URLSearchParams({ ...rest, flight_type: type === "1" ? "round_trip" : "one_way" });
  }
  if (engine === "google_events") return new URLSearchParams({ engine, q: out.q ?? "" });
  return new URLSearchParams(out);
}

/** One SearchApi search (the key as a Bearer header, never in the URL); the answer in SerpApi's shape, null when it fails. */
export async function searchapiFetch(params: Record<string, string>, key: string): Promise<unknown | null> {
  const q = searchapiQuery(params);
  if (!q) return null;
  try {
    const res = await fetch(`${ENDPOINT}?${q}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return null;
    const body = await res.json();
    if (obj(body).error) return null;
    return fromSearchapi(params.engine, body);
  } catch {
    return null;
  }
}

/** A SearchApi answer in the shape SerpApi's would have had for the same engine. */
export function fromSearchapi(engine: string, body: unknown): unknown {
  switch (engine) {
    case "google_hotels": return hotels(body);
    case "google_flights": return flights(body);
    case "google_events": return events(body);
    case "airbnb": return airbnb(body);
    case "google": return sights(body);
    default: return body;
  }
}

// --- Google Hotels: `rating` for `overall_rating`, `price_per_night`/`total_price` (`extracted_price`) for
// `rate_per_night`/`total_rate` (`extracted_lowest`), images' `original` for `original_image`, a review topic's `total`
// for `total_mentioned`, `vacation_rental` for `vacation rental`. nearby_places, hotel_class, gps_coordinates agree.
function hotels(body: unknown): unknown {
  const properties = arr(obj(body).properties).map((p) => {
    const night = obj(p.price_per_night).extracted_price, total = obj(p.total_price).extracted_price;
    return {
      ...p,
      type: p.type === "vacation_rental" ? "vacation rental" : p.type,
      overall_rating: p.rating,
      ...(typeof night === "number" ? { rate_per_night: { extracted_lowest: night } } : {}),
      ...(typeof total === "number" ? { total_rate: { extracted_lowest: total } } : {}),
      images: arr(p.images).map((i) => ({ thumbnail: i.thumbnail, original_image: i.original })),
      reviews_breakdown: arr(p.reviews_breakdown).map((r) => ({ name: r.name, description: r.description, total_mentioned: r.total, positive: r.positive, negative: r.negative })),
    };
  });
  return { ...obj(body), properties };
}

// --- Google Flights: an airport's `date` and `time` come apart ("2026-11-12" + "19:20") where SerpApi has
// "2026-11-12 19:20"; `price_insights.typical_price_range` is {low_price, high_price} not [low, high], and its
// `price_history` is [{price, iso_date}] not [[time, price]]. Prices are for everyone asked for, as SerpApi's.
function when(a: Obj): Obj {
  const date = str(a.date), time = str(a.time);
  return { ...a, time: date && time ? `${date} ${time}` : time };
}
function flights(body: unknown): unknown {
  const b = obj(body);
  const trip = (t: Obj) => ({ ...t, flights: arr(t.flights).map((l) => ({ ...l, departure_airport: when(obj(l.departure_airport)), arrival_airport: when(obj(l.arrival_airport)) })) });
  const pi = obj(b.price_insights);
  const range = obj(pi.typical_price_range);
  const history = arr(pi.price_history).flatMap((r) => {
    const t = Date.parse(String(r.iso_date));
    return Number.isFinite(t) && typeof r.price === "number" ? [[t, r.price]] : [];
  });
  return {
    ...b,
    best_flights: arr(b.best_flights).map(trip),
    other_flights: arr(b.other_flights).map(trip),
    ...(b.price_insights
      ? { price_insights: { ...pi, typical_price_range: typeof range.low_price === "number" && typeof range.high_price === "number" ? [range.low_price, range.high_price] : undefined, price_history: history } }
      : {}),
  };
}

// --- Google Events (Google's page changed in Aug 2026): the list is `events`, not `events_results`; `date` is
// "Fri, Oct 23" (SerpApi: date.start_date "Oct 23"), `start_time` "Oct 23, 7:30 PM" (date.when); `venue` and `address`
// are strings; `link` is the ticket seller's page and `seller` its name (SerpApi: ticket_info[]).
function events(body: unknown): unknown {
  const events_results = arr(obj(body).events).map((e) => ({
    title: e.title,
    date: { start_date: str(e.date)?.replace(/^[A-Za-z]+,\s*/, ""), when: e.start_time },
    address: str(e.address) ? [e.address] : [],
    link: null,
    ticket_info: str(e.link) ? [{ source: e.seller, link: e.link, link_type: "tickets" }] : [],
    venue: str(e.venue) ? { name: e.venue } : null,
    thumbnail: e.thumbnail,
    image: null,
  }));
  return { ...obj(body), events_results };
}

// --- Airbnb: `properties` for `organic_results`; its `title` is the listing's name and `description` the kind and
// place ("Apartment in Santa Maria Maior") where SerpApi's `name` and `title` are; the stay's total is
// `price.extracted_total_price` (`extracted_price`); `images` are plain URLs, the first stands for `thumbnail`.
function airbnb(body: unknown): unknown {
  const organic_results = arr(obj(body).properties).map((p) => ({
    listing_id: p.id,
    name: p.title,
    title: p.description,
    link: p.link,
    rating: p.rating,
    reviews: p.reviews,
    badges: p.badges,
    extracted_price: obj(p.price).extracted_total_price,
    thumbnail: Array.isArray(p.images) ? p.images[0] : undefined,
  }));
  return { ...obj(body), organic_results };
}

// --- Google Search: the sights list is `things_to_do` (title, rating, reviews as a number, thumbnail), not
// `top_sights.sights`. The first few thumbnails are inline `data:` images, which `topSights` drops (https only).
function sights(body: unknown): unknown {
  return { ...obj(body), top_sights: { sights: arr(obj(body).things_to_do) } };
}
