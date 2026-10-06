// Trip Radar öneri verisi: the rules of the `offers` function, pure so the tests can read them. What may be asked
// (a flight's two airport codes and its day; a stay's place, nights and head-count), the sources' answers picked
// and turned into the offers the empty cards draw (src/lib/offerSource.ts `Offer`): at most three, prices and
// ratings only as the source gave them, the one line why worked out from those numbers, never written by a model.
//
// Sources: flights from Aviasales' cached prices (Travelpayouts Data API: what people searched in the last days,
// so an offer carries when it was seen), stays from Xotelo (Tripadvisor's hotel list and each platform's price).

export type Lang = "tr" | "en";
const T = (lang: Lang, tr: string, en: string) => (lang === "en" ? en : tr);

export interface OfferOut {
  id: string;
  kind: "flight" | "stay" | "activity";
  title: string;
  photo?: string | null;
  rating?: number | null;
  reviews?: number | null;
  price: number | null;
  currency: string;
  nights?: number | null;
  url: string;
  why: string;
  source: string;
  fetchedAt: number;
  carrier?: string | null;
  carrierCode?: string | null;
  depart?: string | null;
  arrive?: string | null;
  fromCode?: string | null;
  toCode?: string | null;
  durationMinutes?: number | null;
  stops?: number | null;
  area?: string | null;
  meta?: string | null;
}

// --- what may be asked -------------------------------------------------------------------------------------

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** A day from today to a year ahead: the sources know nothing of the past nor much past a year. */
export function askableDay(raw: string | null, now: Date): string | null {
  if (!raw || !DAY.test(raw) || Number.isNaN(dayMs(raw))) return null;
  const today = dayMs(now.toISOString().slice(0, 10));
  const t = dayMs(raw);
  return t >= today && t <= today + 366 * 864e5 ? raw : null;
}

export const airportCodeOk = (raw: string | null): string | null => (raw && /^[A-Za-z]{3}$/.test(raw.trim()) ? raw.trim().toUpperCase() : null);

/** Head-count as asked, 1 to 9; one when not said. */
export const adultsOf = (raw: string | null): number => {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= 9 ? n : 1;
};

export const langOf = (raw: string | null): Lang => (raw === "en" ? "en" : "tr");

/** "cheap" when the traveller asked for cheaper ones (the chat's "daha ucuz"); else the mixed three. */
export const preferOf = (raw: string | null): "cheap" | null => (raw === "cheap" ? "cheap" : null);

/** A ceiling in euros (a stay's by the night, a flight's per person), 1 to 100 000; none when not said. */
export const maxOf = (raw: string | null): number | null => {
  const n = Math.round(Number(raw));
  return raw != null && raw !== "" && Number.isFinite(n) && n >= 1 && n <= 100_000 ? n : null;
};

/** A place to look a city up by: letters, spaces and a few marks, up to 80. */
export function placeOk(raw: string | null): string | null {
  const s = raw?.normalize("NFC").replace(/\s+/g, " ").trim();
  return s && s.length <= 80 && /^[\p{L}\p{M} .,'’()-]+$/u.test(s) ? s : null;
}

export const nightsBetween = (start: string, end: string): number => Math.round((dayMs(end) - dayMs(start)) / 864e5);

// --- flights (Aviasales prices_for_dates, one way) --------------------------------------------------------

export interface AviaFlight {
  origin_airport?: string;
  destination_airport?: string;
  origin?: string;
  destination?: string;
  price?: number;
  airline?: string;
  flight_number?: string | number;
  departure_at?: string;
  transfers?: number;
  duration_to?: number;
  duration?: number;
  link?: string;
  /** Read elsewhere than Aviasales' cache (Google Flights, live): its name, and the landing as the airport shows it. */
  source?: string;
  arrive_local?: string;
}

/** "02:25" from "2026-11-19T02:25:00+03:00": the clock the airport shows. */
export const localClock = (iso: string | undefined): string | null => (iso && /T(\d{2}:\d{2})/.test(iso) ? iso.match(/T(\d{2}:\d{2})/)![1] : null);

/** The landing clock in the destination's own time: leaving plus the time in the air, read in its zone. */
export function arrivalClock(departIso: string | undefined, minutes: number | undefined, zone: string | null | undefined): string | null {
  if (!departIso || !minutes || !zone) return null;
  const t = Date.parse(departIso);
  if (Number.isNaN(t)) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t + minutes * 6e4));
  } catch {
    return null;
  }
}

/** When the price was seen: the link's `search_date=06102026` (a day), else now. */
export function seenAt(link: string | undefined, now: number): number {
  const m = link?.match(/search_date=(\d{2})(\d{2})(\d{4})/);
  if (!m) return now;
  const t = Date.parse(`${m[3]}-${m[2]}-${m[1]}T12:00:00Z`);
  return Number.isNaN(t) ? now : Math.min(t, now);
}

const minutesOf = (f: AviaFlight) => f.duration_to ?? f.duration ?? null;
const hm = (min: number, lang: Lang) => {
  const h = Math.floor(min / 60), m = min % 60;
  return lang === "en" ? `${h}h${m ? ` ${m}m` : ""}` : `${h} sa${m ? ` ${m} dk` : ""}`;
};
const euros = (n: number) => `€${Math.round(n)}`;
const valid = (f: AviaFlight) => typeof f.price === "number" && f.price > 0 && !!f.airline && !!f.departure_at && !!f.link;

/**
 * Three at most, each for its own reason: the cheapest; a direct one when the cheapest isn't; the quickest when
 * it saves an hour or more. `direct` is a second ask for direct flights only (a dear direct one is past the
 * cheapest thirty). The same flight is never offered twice; a price said is for everyone going, like the card's.
 */
export function pickFlights(cheapest: AviaFlight[], direct: AviaFlight[], lang: Lang, adults = 1): { f: AviaFlight; why: string }[] {
  const all = [...cheapest, ...direct].filter(valid).sort((a, b) => a.price! - b.price!);
  if (!all.length) return [];
  const id = (f: AviaFlight) => `${f.airline}${f.flight_number}|${f.departure_at}`;
  const out: { f: AviaFlight; why: string }[] = [];
  const first = all[0];
  out.push({ f: first, why: first.transfers === 0 ? T(lang, "En ucuzu, üstelik direkt", "The cheapest, and direct") : T(lang, "En ucuz seçenek", "The cheapest") });
  const taken = new Set([id(first)]);
  if (first.transfers !== 0) {
    const d = all.find((f) => f.transfers === 0 && !taken.has(id(f)));
    if (d) {
      const more = (d.price! - first.price!) * adults;
      out.push({ f: d, why: more > 0 ? T(lang, `Direkt · en ucuzdan ${euros(more)} fazla`, `Direct · ${euros(more)} more than the cheapest`) : T(lang, "Direkt", "Direct") });
      taken.add(id(d));
    }
  }
  const quick = all.filter((f) => !taken.has(id(f)) && minutesOf(f)).sort((a, b) => minutesOf(a)! - minutesOf(b)!)[0];
  const base = Math.min(...out.map((o) => minutesOf(o.f) ?? Infinity));
  if (quick && Number.isFinite(base) && base - minutesOf(quick)! >= 60) {
    out.push({ f: quick, why: T(lang, `En kısa yolculuk · ${hm(base - minutesOf(quick)!, lang)} daha kısa`, `The quickest · ${hm(base - minutesOf(quick)!, lang)} shorter`) });
  }
  return out.slice(0, 3);
}

/** Asked for cheaper ones: the three cheapest (under the ceiling per person, when one's said), each said against the first. */
export function pickCheapFlights(list: AviaFlight[], lang: Lang, adults = 1, max: number | null = null): { f: AviaFlight; why: string }[] {
  const id = (f: AviaFlight) => `${f.airline}${f.flight_number}|${f.departure_at}`;
  const seen = new Set<string>();
  const cheap = list
    .filter(valid)
    .filter((f) => max == null || f.price! <= max)
    .sort((a, b) => a.price! - b.price!)
    .filter((f) => !seen.has(id(f)) && !!seen.add(id(f)))
    .slice(0, 3);
  return cheap.map((f, i) => {
    const direct = f.transfers === 0 ? T(lang, " · direkt", " · direct") : "";
    if (i === 0) return { f, why: T(lang, "Bulunanların en ucuzu", "The cheapest found") + direct };
    const more = (f.price! - cheap[0].price!) * adults;
    return { f, why: (more > 0 ? T(lang, `En ucuzdan ${euros(more)} fazla`, `${euros(more)} more than the cheapest`) : T(lang, "En ucuzla aynı fiyat", "Same as the cheapest")) + direct };
  });
}

export interface FlightCtx {
  adults: number;
  now: number;
  airline: (code: string) => string | null;
  zone: (airport: string) => string | null;
}

export function flightOffer({ f, why }: { f: AviaFlight; why: string }, ctx: FlightCtx): OfferOut {
  const code = f.airline!;
  const name = ctx.airline(code);
  const minutes = minutesOf(f);
  const to = f.destination_airport ?? f.destination ?? null;
  return {
    id: `av:${code}${f.flight_number ?? ""}:${f.departure_at}`,
    kind: "flight",
    title: name ?? code,
    carrier: name ?? code,
    carrierCode: /^[A-Z0-9]{2}$/.test(code) ? code : null,
    depart: localClock(f.departure_at),
    arrive: f.arrive_local ?? arrivalClock(f.departure_at, minutes ?? undefined, to ? ctx.zone(to) : null),
    fromCode: f.origin_airport ?? f.origin ?? null,
    toCode: to,
    durationMinutes: minutes,
    stops: f.transfers ?? null,
    price: Math.round(f.price! * ctx.adults),
    currency: "EUR",
    url: `https://www.aviasales.com${f.link}`,
    why,
    source: f.source ?? "Aviasales",
    fetchedAt: seenAt(f.link, ctx.now),
  };
}

// --- stays (Xotelo) --------------------------------------------------------------------------------------

export interface XoHotel {
  name?: string;
  key?: string;
  accommodation_type?: string;
  url?: string;
  review_summary?: { rating?: number; count?: number };
  price_ranges?: { minimum?: number; maximum?: number };
  image?: string;
  merchandising_labels?: string[];
  geo?: { latitude?: number; longitude?: number };
}
export interface XoRate {
  code?: string;
  name?: string;
  rate?: number;
}

const rating = (h: XoHotel) => h.review_summary?.rating ?? 0;
const reviews = (h: XoHotel) => h.review_summary?.count ?? 0;
const okHotel = (h: XoHotel) => !!h.name && !!h.key && rating(h) > 0;
const count = (n: number, lang: Lang) => n.toLocaleString(lang === "en" ? "en-GB" : "tr-TR");

/**
 * Three hotels, each for its own reason: Tripadvisor's best value (the list comes in that order), the best liked
 * with enough reviews to mean it, the least dear that's still well liked.
 */
export function pickStays(list: XoHotel[], lang: Lang): { h: XoHotel; why: string }[] {
  const ok = list.filter(okHotel);
  if (!ok.length) return [];
  const out: { h: XoHotel; why: string }[] = [{ h: ok[0], why: T(lang, "Tripadvisor'da fiyatına göre en iyisi", "Tripadvisor's best value") }];
  const taken = new Set([ok[0].key]);
  const liked = ok.filter((h) => !taken.has(h.key) && reviews(h) >= 200).sort((a, b) => rating(b) - rating(a) || reviews(b) - reviews(a))[0];
  if (liked) {
    out.push({ h: liked, why: T(lang, `${count(reviews(liked), lang)} yorumla en beğenilenlerden`, `Among the best liked, ${count(reviews(liked), lang)} reviews`) });
    taken.add(liked.key);
  }
  const cheap = ok
    .filter((h) => !taken.has(h.key) && rating(h) >= 4.3 && reviews(h) >= 100 && (h.price_ranges?.minimum ?? 0) > 0)
    .sort((a, b) => a.price_ranges!.minimum! - b.price_ranges!.minimum!)[0];
  if (cheap) out.push({ h: cheap, why: T(lang, "İyi puanlılar içinde en uygunu", "The least dear of the well liked") });
  return out;
}

/**
 * Asked for cheaper ones: up to five well-liked hotels (4 and up, 50 reviews or more) by the least their nights go
 * for on Tripadvisor, under the ceiling when one's said; their real prices are asked next and the three cheapest kept
 * (`cheapest`).
 */
export function pickCheapStays(list: XoHotel[], max: number | null = null): XoHotel[] {
  return list
    .filter((h) => okHotel(h) && rating(h) >= 4 && reviews(h) >= 50 && (h.price_ranges?.minimum ?? 0) > 0)
    .filter((h) => max == null || h.price_ranges!.minimum! <= max)
    .sort((a, b) => a.price_ranges!.minimum! - b.price_ranges!.minimum!)
    .slice(0, 5);
}

/** The offers priced, by the night under the ceiling (when said), the cheapest three, each said against the first. */
export function cheapest(offers: OfferOut[], lang: Lang, max: number | null = null): OfferOut[] {
  const night = (o: OfferOut) => (o.price ?? Infinity) / Math.max(1, o.nights ?? 1);
  const kept = offers.filter((o) => o.price != null && (max == null || night(o) <= max)).sort((a, b) => a.price! - b.price!).slice(0, 3);
  return kept.map((o, i) => {
    const more = night(o) - night(kept[0]);
    const why = i === 0 ? T(lang, "Bulduklarımın en ucuzu", "The cheapest I found") : more >= 1 ? T(lang, `Gecelik ${euros(more)} daha fazla`, `${euros(more)} more a night`) : T(lang, "En ucuzla aynı fiyat", "Same as the cheapest");
    // what the platforms said stays ("· Trip.com'da gecelik €84"): the card's lines already carry the rest
    const tail = o.why ? (o.why.startsWith(" · ") ? o.why : ` · ${o.why}`) : "";
    return { ...o, why: why + tail };
  });
}

const KINDS: Record<string, [string, string]> = {
  Hotel: ["Otel", "Hotel"], Resort: ["Resort", "Resort"], Villa: ["Villa", "Villa"], Hostel: ["Hostel", "Hostel"],
  "Bed and Breakfast": ["Pansiyon", "B&B"], Guesthouse: ["Pansiyon", "Guesthouse"], Inn: ["Han", "Inn"],
  Motel: ["Motel", "Motel"], Lodge: ["Lodge", "Lodge"], "Specialty lodging": ["Özel konaklama", "Specialty lodging"],
};
const LABELS: Record<string, [string, string]> = {
  "Breakfast included": ["Kahvaltı dahil", "Breakfast included"], "Free cancellation": ["Ücretsiz iptal", "Free cancellation"],
};

/** "Trip.com'da gecelik €140"; the hotel's own site said as such. */
function elsewhere(r: XoRate, lang: Lang): string {
  const own = /official/i.test(r.name ?? "") || r.code === "Official";
  if (own) return T(lang, `otelin kendi sitesinde gecelik ${euros(r.rate!)}`, `${euros(r.rate!)} a night on the hotel's own site`);
  return T(lang, `${r.name}'da gecelik ${euros(r.rate!)}`, `${euros(r.rate!)} a night on ${r.name}`);
}

export interface StayCtx {
  lang: Lang;
  nights: number;
  now: number;
  /** The platform's own search for this hotel on these nights (Booking), null when it has none. */
  search: (h: XoHotel, platform: string) => string | null;
}

/** Booking's price when it has one (its page is the one we can open on the hotel); else the cheapest, on Tripadvisor. */
export function stayOffer({ h, why }: { h: XoHotel; why: string }, rates: XoRate[], ctx: StayCtx): OfferOut | null {
  const priced = rates.filter((r) => typeof r.rate === "number" && r.rate > 0 && r.name).sort((a, b) => a.rate! - b.rate!);
  if (!priced.length || ctx.nights < 1) return null;
  const booking = priced.find((r) => r.code === "BookingCom");
  const bookingUrl = booking ? ctx.search(h, "BookingCom") : null;
  const use = booking && bookingUrl ? booking : priced[0];
  const url = use === booking && bookingUrl ? bookingUrl : h.url;
  if (!url || !/^https:\/\//.test(url)) return null;
  const cheaper = priced[0] !== use && use.rate! - priced[0].rate! >= 3 ? priced[0] : null;
  const lang = ctx.lang;
  const kind = h.accommodation_type ? (KINDS[h.accommodation_type]?.[lang === "en" ? 1 : 0] ?? h.accommodation_type) : null;
  const labels = (h.merchandising_labels ?? []).map((l) => LABELS[l]?.[lang === "en" ? 1 : 0]).filter(Boolean);
  return {
    id: `xo:${h.key}`,
    kind: "stay",
    title: h.name!,
    photo: h.image && /^https:\/\//.test(h.image) ? h.image : null,
    rating: rating(h),
    price: Math.round(use.rate! * ctx.nights),
    currency: "EUR",
    nights: ctx.nights,
    url,
    why: cheaper ? `${why} · ${elsewhere(cheaper, lang)}` : why,
    source: use === booking && bookingUrl ? "Booking" : (use.name ?? "Tripadvisor"),
    fetchedAt: ctx.now,
    area: kind,
    meta: [T(lang, `${count(reviews(h), lang)} yorum`, `${count(reviews(h), lang)} reviews`), ...labels].join(" · "),
  };
}

/** Booking's search for one hotel on these nights: it lands on the hotel when the name is unique in the city. */
export function bookingSearch(name: string, city: string, start: string, end: string, adults: number): string {
  const q = new URLSearchParams({ ss: `${name}, ${city}`, checkin: start, checkout: end, group_adults: String(adults), no_rooms: "1" });
  return `https://www.booking.com/searchresults.html?${q}`;
}

/** Tripadvisor's geo id ("297701") for a city, from the typeahead's first municipality-like answer. */
export function geoFromTypeahead(body: unknown): string | null {
  const rows = (body as { data?: { trackingItems?: { placeType?: string; locationId?: number; dataType?: string } }[] })?.data ?? [];
  const PLACES = new Set(["MUNICIPALITY", "CITY", "TOWN", "VILLAGE", "ISLAND", "REGION", "PROVINCE", "NEIGHBORHOOD", "STATE"]);
  for (const r of rows) {
    const t = r?.trackingItems;
    if (t?.dataType === "LOCATION" && t.placeType && PLACES.has(t.placeType) && typeof t.locationId === "number") return String(t.locationId);
  }
  return null;
}

// --- candidates (the chat's and the card's own choice of three: "Sana en uygun", "Daha ekonomik", "Daha konforlu") --

/** A hotel the client may choose from: only what the sources said; an unknown is null, never guessed. */
export interface StayCandidate {
  id: string;
  name: string;
  /** Out of 5 (Tripadvisor). */
  rating: number | null;
  reviews: number | null;
  photo: string | null;
  geo: { lat: number; lng: number } | null;
  /** The kind ("Resort", "Pansiyon"). */
  area: string | null;
  labels: string[];
  url: string;
  /** A price for these nights, from a platform (null when no platform gave one). */
  nightly: number | null;
  total: number | null;
  nights: number;
  /** Tripadvisor's usual nightly range: not for these dates. */
  priceRange: { min: number; max: number } | null;
  /** Where the price for these nights is from ("Booking"); null without one. */
  source: string | null;
  currency: "EUR";
  fetchedAt: number;
}

/**
 * Up to `max` hotels from the one list already asked: the offers' hotels first, then the list's cheapest by its
 * usual range and its best liked, for a choice to be had; no hotel twice (each is then priced for the dates).
 */
export function pickCandidates(list: XoHotel[], priced: string[], max = 6): XoHotel[] {
  const ok = list.filter(okHotel);
  const out: XoHotel[] = [];
  const add = (h: XoHotel | undefined) => {
    if (h && out.length < max && !out.some((x) => x.key === h.key)) out.push(h);
  };
  for (const key of priced) add(ok.find((h) => h.key === key));
  const cheap = ok.filter((h) => (h.price_ranges?.minimum ?? 0) > 0 && rating(h) >= 4).sort((a, b) => a.price_ranges!.minimum! - b.price_ranges!.minimum!);
  const liked = ok.filter((h) => reviews(h) >= 100).sort((a, b) => rating(b) - rating(a) || reviews(b) - reviews(a));
  for (let i = 0; out.length < max && (i < cheap.length || i < liked.length); i++) {
    add(cheap[i]);
    add(liked[i]);
  }
  for (const h of ok) add(h);
  return out;
}

/** A candidate: its own offer's price when it has one, else only the usual range; the page as for its offer. */
export function stayCandidate(h: XoHotel, offer: OfferOut | null, ctx: { lang: Lang; nights: number; now: number; url: string }): StayCandidate {
  const lang = ctx.lang;
  const lat = h.geo?.latitude, lng = h.geo?.longitude;
  const min = h.price_ranges?.minimum, max = h.price_ranges?.maximum;
  return {
    id: `xo:${h.key}`,
    name: h.name!,
    rating: rating(h) || null,
    reviews: reviews(h) || null,
    photo: h.image && /^https:\/\//.test(h.image) ? h.image : null,
    geo: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null,
    area: h.accommodation_type ? (KINDS[h.accommodation_type]?.[lang === "en" ? 1 : 0] ?? h.accommodation_type) : null,
    labels: (h.merchandising_labels ?? []).map((l) => LABELS[l]?.[lang === "en" ? 1 : 0]).filter((l): l is string => !!l),
    url: offer?.url ?? ctx.url,
    nightly: offer?.price != null ? Math.round(offer.price / Math.max(1, ctx.nights)) : null,
    total: offer?.price ?? null,
    nights: ctx.nights,
    priceRange: typeof min === "number" && min > 0 ? { min, max: typeof max === "number" && max >= min ? max : min } : null,
    source: offer ? offer.source : null,
    currency: "EUR",
    fetchedAt: offer?.fetchedAt ?? ctx.now,
  };
}

// --- live (SerpApi: Google Flights, Google Hotels) --------------------------------------------------------
// Asked only when the cached sources have nothing, or when the traveller asks for a live look (the chat): its
// free quota is small. The price is Google's, read now; the page opened stays a partner's (Aviasales' search for the
// same flight day, Booking's for the hotel), so a booking still pays the project.

interface SerpLeg {
  departure_airport?: { id?: string; time?: string };
  arrival_airport?: { id?: string; time?: string };
  airline?: string;
  flight_number?: string;
  duration?: number;
}
interface SerpTrip {
  flights?: SerpLeg[];
  total_duration?: number;
  price?: number;
}

/** "21 Oct": Aviasales' search path for one way, as its site writes it (/search/FNC2110IST2). */
export const aviasalesSearch = (from: string, to: string, day: string, adults: number): string => `/search/${from}${day.slice(8, 10)}${day.slice(5, 7)}${to}${adults}`;

/**
 * Google Flights' answer as Aviasales-shaped flights (one way): its price is for everyone asked for, so per person
 * here like Aviasales'; the carrier from the first leg's number, the clocks as the airports show them.
 */
export function serpFlights(body: unknown, adults: number, from: string, to: string, day: string): AviaFlight[] {
  const b = body as { best_flights?: SerpTrip[]; other_flights?: SerpTrip[] };
  const trips = [...(b?.best_flights ?? []), ...(b?.other_flights ?? [])];
  const out: AviaFlight[] = [];
  for (const t of trips) {
    const legs = t.flights ?? [];
    const first = legs[0], last = legs.at(-1);
    const dep = first?.departure_airport?.time, arr = last?.arrival_airport?.time;
    const code = first?.flight_number?.match(/^([A-Z0-9]{2})\s*\d+/)?.[1];
    if (!legs.length || !dep || !code || typeof t.price !== "number" || t.price <= 0) continue;
    out.push({
      origin_airport: first?.departure_airport?.id ?? from,
      destination_airport: last?.arrival_airport?.id ?? to,
      airline: code,
      flight_number: first?.flight_number?.replace(/^[A-Z0-9]{2}\s*/, "") ?? "",
      departure_at: dep.replace(" ", "T"),
      arrive_local: arr?.match(/ (\d{2}:\d{2})$/)?.[1] ?? undefined,
      transfers: legs.length - 1,
      duration_to: t.total_duration,
      price: Math.round(t.price / Math.max(1, adults)),
      link: aviasalesSearch(from, to, day, adults),
      source: "Google Flights",
    });
  }
  return out;
}

interface SerpHotel {
  type?: string;
  name?: string;
  overall_rating?: number;
  reviews?: number;
  gps_coordinates?: { latitude?: number; longitude?: number };
  images?: { thumbnail?: string; original_image?: string }[];
  rate_per_night?: { extracted_lowest?: number };
  total_rate?: { extracted_lowest?: number };
  hotel_class?: string;
  amenities?: string[];
}

/**
 * Google Hotels' answer as hotels with their price for these nights (the list's own, for the people asked): kept
 * only with a name, a rating and a price; the page is Booking's search for it (a partner's).
 */
export function serpStays(body: unknown, ctx: { lang: Lang; nights: number; now: number; search: (name: string) => string }): StayCandidate[] {
  const props = ((body as { properties?: SerpHotel[] })?.properties ?? []).filter((p) => p.name && (p.overall_rating ?? 0) > 0 && (p.total_rate?.extracted_lowest ?? p.rate_per_night?.extracted_lowest ?? 0) > 0);
  return props.map((p) => {
    const total = p.total_rate?.extracted_lowest ?? Math.round(p.rate_per_night!.extracted_lowest! * ctx.nights);
    const lat = p.gps_coordinates?.latitude, lng = p.gps_coordinates?.longitude;
    const img = p.images?.[0]?.original_image ?? p.images?.[0]?.thumbnail ?? null;
    return {
      id: `gh:${p.name!.toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "-")}`,
      name: p.name!,
      rating: p.overall_rating ?? null,
      reviews: p.reviews ?? null,
      photo: img && /^https:\/\//.test(img) ? img : null,
      geo: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null,
      area: p.type === "vacation rental" ? T(ctx.lang, "Ev", "Rental") : T(ctx.lang, "Otel", "Hotel"),
      labels: [],
      url: ctx.search(p.name!),
      nightly: Math.round(total / Math.max(1, ctx.nights)),
      total,
      nights: ctx.nights,
      priceRange: null,
      source: "Google Hotels",
      currency: "EUR",
      fetchedAt: ctx.now,
    };
  });
}

/** A live hotel as an offer for the card's row (the three picked by `pickStays`' reasons, from these). */
export function candidateOffer(c: StayCandidate, why: string, lang: Lang): OfferOut {
  return {
    id: c.id, kind: "stay", title: c.name, photo: c.photo, rating: c.rating, price: c.total, currency: "EUR", nights: c.nights, url: c.url,
    why, source: c.source ?? "Google Hotels", fetchedAt: c.fetchedAt, area: c.area,
    meta: c.reviews ? T(lang, `${count(c.reviews, lang)} yorum`, `${count(c.reviews, lang)} reviews`) : null,
  };
}

/** Three of the live hotels for the row, each for its own reason (best liked, least dear well liked, the list's first). */
export function pickLiveStays(list: StayCandidate[], lang: Lang): OfferOut[] {
  if (!list.length) return [];
  const out: OfferOut[] = [];
  const taken = new Set<string>();
  const add = (c: StayCandidate | undefined, why: string) => {
    if (c && !taken.has(c.id)) {
      taken.add(c.id);
      out.push(candidateOffer(c, why, lang));
    }
  };
  add(list[0], T(lang, "Google Hotels'ta öne çıkan", "Google Hotels' top pick"));
  add([...list].filter((c) => (c.reviews ?? 0) >= 200).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0))[0], T(lang, "En beğenilenlerden", "Among the best liked"));
  add([...list].filter((c) => (c.rating ?? 0) >= 4.3).sort((a, b) => (a.total ?? 0) - (b.total ?? 0))[0], T(lang, "İyi puanlılar içinde en uygunu", "The least dear of the well liked"));
  return out;
}

// --- activities (Viator Partner API, basic access) ---------------------------------------------------------
// A city's tours, tickets and classes as Viator lists them for the dates; its own page carries the project's Viator
// partner code (pid), so it isn't turned into another partner's link. Viator asks for a search's results to be kept
// an hour at most.

export interface ViProduct {
  productCode?: string;
  title?: string;
  images?: { isCover?: boolean; variants?: { width?: number; height?: number; url?: string }[] }[];
  reviews?: { totalReviews?: number; combinedAverageRating?: number };
  duration?: { fixedDurationInMinutes?: number; variableDurationFromMinutes?: number; variableDurationToMinutes?: number };
  pricing?: { summary?: { fromPrice?: number }; currency?: string };
  productUrl?: string;
  flags?: string[];
}

/** Viator's destination id for a city, from its free-text search's first destination. */
export const viatorDestination = (body: unknown): string | null => {
  const id = (body as { destinations?: { results?: { id?: number }[] } })?.destinations?.results?.[0]?.id;
  return typeof id === "number" ? String(id) : null;
};

const viRating = (p: ViProduct) => p.reviews?.combinedAverageRating ?? 0;
const viReviews = (p: ViProduct) => p.reviews?.totalReviews ?? 0;
const viPrice = (p: ViProduct) => p.pricing?.summary?.fromPrice ?? 0;
const viOk = (p: ViProduct) => !!p.productCode && !!p.title && viRating(p) > 0 && viPrice(p) > 0 && !!p.productUrl && /^https:\/\//.test(p.productUrl);

/** "3 sa", "8–10 sa", "45 dk": how long, as Viator says it. */
export function durationWords(d: ViProduct["duration"], lang: Lang): string | null {
  const span = (m: number) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}`.replace(".", lang === "en" ? "." : ",") : `${m}`);
  const unit = (m: number) => (m >= 60 ? T(lang, "sa", "h") : T(lang, "dk", "min"));
  if (d?.fixedDurationInMinutes) return `${span(d.fixedDurationInMinutes)} ${unit(d.fixedDurationInMinutes)}`;
  const a = d?.variableDurationFromMinutes, b = d?.variableDurationToMinutes;
  if (a && b) return a >= 60 && b >= 60 ? `${span(a)}–${span(b)} ${unit(b)}` : `${span(a)} ${unit(a)}–${span(b)} ${unit(b)}`;
  return null;
}

/** The cover's picture at a card's size (about 480 wide). */
const viPhoto = (p: ViProduct): string | null => {
  const img = p.images?.find((i) => i.isCover) ?? p.images?.[0];
  const v = (img?.variants ?? []).filter((x) => x.url && /^https:\/\//.test(x.url)).sort((a, b) => Math.abs((a.width ?? 0) - 480) - Math.abs((b.width ?? 0) - 480))[0];
  return v?.url ?? null;
};

/**
 * Three, each for its own reason: Viator's own first (its featured order), the best liked with reviews enough to
 * mean it, the least dear of the well liked; "hızlı tükeniyor" said when Viator says so.
 */
export function pickActivities(list: ViProduct[], lang: Lang, adults: number, now: number, cheap = false): OfferOut[] {
  const ok = list.filter(viOk);
  if (!ok.length) return [];
  const picked: { p: ViProduct; why: string }[] = [];
  const add = (p: ViProduct | undefined, why: string) => {
    if (p && !picked.some((x) => x.p.productCode === p.productCode)) picked.push({ p, why });
  };
  if (cheap) {
    [...ok].filter((p) => viRating(p) >= 4.3).sort((a, b) => viPrice(a) - viPrice(b)).slice(0, 3).forEach((p, i) => add(p, i === 0 ? T(lang, "Bulduklarımın en ucuzu", "The cheapest I found") : T(lang, "İyi puanlı, uygun fiyatlı", "Well liked, low priced")));
  } else {
    add(ok[0], T(lang, "Viator'da öne çıkan", "Viator's featured pick"));
    add([...ok].filter((p) => viReviews(p) >= 200).sort((a, b) => viRating(b) - viRating(a) || viReviews(b) - viReviews(a))[0], T(lang, "En beğenilenlerden", "Among the best liked"));
    add([...ok].filter((p) => viRating(p) >= 4.5 && viReviews(p) >= 50).sort((a, b) => viPrice(a) - viPrice(b))[0], T(lang, "İyi puanlılar içinde en uygunu", "The least dear of the well liked"));
  }
  return picked.slice(0, 3).map(({ p, why }) => {
    const soon = p.flags?.includes("LIKELY_TO_SELL_OUT") ? T(lang, " · hızlı tükeniyor", " · likely to sell out") : "";
    const free = p.flags?.includes("FREE_CANCELLATION") ? T(lang, "Ücretsiz iptal", "Free cancellation") : null;
    return {
      id: `vi:${p.productCode}`,
      kind: "activity" as const,
      title: p.title!,
      photo: viPhoto(p),
      rating: Math.round(viRating(p) * 10) / 10,
      reviews: viReviews(p) || null,
      price: Math.round(viPrice(p) * adults),
      currency: p.pricing?.currency ?? "EUR",
      url: p.productUrl!,
      why: why + soon,
      source: "Viator",
      fetchedAt: now,
      area: durationWords(p.duration, lang),
      meta: [viReviews(p) ? T(lang, `${count(viReviews(p), lang)} yorum`, `${count(viReviews(p), lang)} reviews`) : null, free].filter(Boolean).join(" · ") || null,
    };
  });
}
