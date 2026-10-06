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
  kind: "flight" | "stay";
  title: string;
  photo?: string | null;
  rating?: number | null;
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
    arrive: arrivalClock(f.departure_at, minutes ?? undefined, to ? ctx.zone(to) : null),
    fromCode: f.origin_airport ?? f.origin ?? null,
    toCode: to,
    durationMinutes: minutes,
    stops: f.transfers ?? null,
    price: Math.round(f.price! * ctx.adults),
    currency: "EUR",
    url: `https://www.aviasales.com${f.link}`,
    why,
    source: "Aviasales",
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
