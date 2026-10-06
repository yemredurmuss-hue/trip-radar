// Where to look next (0.35.11): a search the Plan offers when something is plainly missing. A one-way flight
// with no way home gets "Dönüş bileti ara" (Google Flights, the trip's last city to where it started, on the
// trip's last day); Etkinlikler gets a GetYourGuide search per city. Plain links: nothing is bought or saved,
// no affiliate code. Pure.
//
// Boş kartlar (spec 2026-10-06-bos-kartlar-design.md): the branded searches under an empty card, prefilled with
// the place, the dates and how many go, and nothing else about the traveller. Only public URL formats that are
// documented or have stood for years; every value is encoded; a brand that can't take what's known is left out
// (Skyscanner and Kayak need airport codes) rather than opened half-filled.
import { cityOfAirport } from "./airports";
import { L } from "./i18n";
import { cityKeyOf, sameCity, type Plan } from "./plan";
import type { Item } from "./types";

const decided = (i: Item) => i.status === "chosen" || i.status === "booked";
const place = (code: string) => cityOfAirport(code);

/**
 * "Dönüş bileti ara": the first decided flight is the way out; when no decided flight goes back to where it
 * started, a search from the trip's last city (else where that flight landed) home, on the trip's last day.
 * Null when there's no flight yet or the way home is there.
 */
export function returnFlightSearch(items: Item[], plan: Pick<Plan, "range" | "stayBlocks">): { label: string; url: string } | null {
  const flights = items
    .filter((i) => i.category === "flight" && decided(i) && i.flight?.from && i.flight?.to)
    .sort((a, b) => (a.flight?.departure ?? a.dates.start ?? "").localeCompare(b.flight?.departure ?? b.dates.start ?? ""));
  const out = flights[0];
  if (!out) return null;
  const home = out.flight!.from!;
  const homeCity = place(home);
  // The first decided flight leaving from one of the trip's own cities isn't the way out (the way out is still
  // being decided; this one is the way home or between cities): no search ("Lizbon → Lizbon" before).
  if (plan.stayBlocks.some((b) => b.city && sameCity(b.city, homeCity))) return null;
  if (flights.slice(1).some((f) => f.flight!.to === home || sameCity(place(f.flight!.to!), homeCity))) return null;
  const from = plan.stayBlocks.at(-1)?.city ?? place(out.flight!.to!);
  if (sameCity(from, homeCity)) return null;
  const date = plan.range?.end ?? null;
  const query = `Flights from ${from} to ${homeCity}${date ? ` on ${date}` : ""} one way`;
  return {
    label: L(`Dönüş bileti ara · ${from} → ${homeCity}`, `Find a flight home · ${from} → ${homeCity}`),
    url: `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`,
  };
}

/** "Porto etkinliklerini ara": a GetYourGuide search for each city of the trip, in the trip's order. */
export function activitySearches(plan: Pick<Plan, "stayBlocks">): { city: string; label: string; url: string }[] {
  const cities: string[] = [];
  for (const b of plan.stayBlocks) if (b.city && !cities.some((c) => sameCity(c, b.city!))) cities.push(b.city);
  return cities.map((city) => ({
    city,
    label: L(`${city} etkinliklerini ara`, `Find things to book in ${city}`),
    url: activityUrl("getyourguide", city),
  }));
}

// --- branded searches (boş kartlar) ------------------------------------------------------------------------

export type Brand =
  | "gflights"
  | "skyscanner"
  | "kayak"
  | "booking"
  | "airbnb"
  | "uber"
  | "maps"
  | "getyourguide"
  | "viator"
  | "klook"
  | "airalo"
  | "holafly";

/** A brand's mark on the card: one letter on its colour (drawn in the extension, never fetched from the brand). */
export interface BrandMark {
  name: string;
  color: string;
  letter: string;
}

export const BRANDS: Readonly<Record<Brand, BrandMark>> = {
  gflights: { name: "Google Flights", color: "#4285f4", letter: "G" },
  skyscanner: { name: "Skyscanner", color: "#0770e3", letter: "S" },
  kayak: { name: "Kayak", color: "#ff690f", letter: "K" },
  booking: { name: "Booking", color: "#003580", letter: "B" },
  airbnb: { name: "Airbnb", color: "#ff5a5f", letter: "A" },
  uber: { name: "Uber", color: "#000000", letter: "U" },
  maps: { name: "Google Maps", color: "#34a853", letter: "G" },
  getyourguide: { name: "GetYourGuide", color: "#ff5533", letter: "G" },
  viator: { name: "Viator", color: "#186b6d", letter: "V" },
  klook: { name: "Klook", color: "#ff5722", letter: "K" },
  airalo: { name: "Airalo", color: "#1c1c1e", letter: "a" },
  holafly: { name: "Holafly", color: "#e8344e", letter: "H" },
};

export interface SearchLink {
  brand: Brand;
  /** What the link says ("Google Flights"; "Yol tarifi" for the directions). */
  label: string;
  url: string;
}

const enc = encodeURIComponent;
const link = (brand: Brand, url: string, label = BRANDS[brand].name): SearchLink => ({ brand, label, url });

/** A real calendar day (YYYY-MM-DD), else null. */
function dayOf(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

/** How many go, as the sites take it: a whole number from 1 to 9 (more than nine is nine; none or nonsense, null). */
export function headCount(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const whole = Math.floor(n);
  return whole < 1 ? null : Math.min(whole, 9);
}

/** The airport the sites search for a city (its main one; a code given stays as it is). */
const CITY_AIRPORTS: Record<string, string> = Object.fromEntries(
  (
    [
      ["IST", "İstanbul", "Istanbul"], ["ESB", "Ankara"], ["ADB", "İzmir", "Izmir"], ["AYT", "Antalya"], ["DLM", "Dalaman"],
      ["BJV", "Bodrum"], ["TZX", "Trabzon"], ["ASR", "Kayseri", "Kapadokya", "Cappadocia"],
      ["LHR", "Londra", "London"], ["CDG", "Paris"], ["FRA", "Frankfurt"], ["MUC", "Münih", "Munich"], ["AMS", "Amsterdam"],
      ["FCO", "Roma", "Rome"], ["MAD", "Madrid"], ["BCN", "Barselona", "Barcelona"], ["LIS", "Lizbon", "Lisbon", "Lisboa"],
      ["OPO", "Porto"], ["FNC", "Funchal", "Madeira"], ["DXB", "Dubai"], ["JFK", "New York"], ["CPH", "Kopenhag", "Copenhagen"],
      ["BER", "Berlin"], ["VIE", "Viyana", "Vienna"], ["ZRH", "Zürih", "Zurich"], ["BRU", "Brüksel", "Brussels"], ["DUB", "Dublin"],
      ["ATH", "Atina", "Athens"], ["PRG", "Prag", "Prague"], ["BUD", "Budapeşte", "Budapest"], ["WAW", "Varşova", "Warsaw"],
      ["ARN", "Stockholm"], ["OSL", "Oslo"], ["HEL", "Helsinki"], ["MXP", "Milano", "Milan"], ["VCE", "Venedik", "Venice"],
      ["NAP", "Napoli", "Naples"], ["NCE", "Nice"], ["PMI", "Palma"], ["AGP", "Malaga"], ["SVQ", "Sevilla", "Seville"],
      ["FAO", "Faro"], ["PDL", "Ponta Delgada"], ["DOH", "Doha"], ["DPS", "Denpasar", "Bali"], ["BKK", "Bangkok"],
      ["HKT", "Phuket"], ["HND", "Tokyo"], ["TBS", "Tiflis", "Tbilisi"], ["CAI", "Kahire", "Cairo"], ["MLE", "Malé", "Male", "Maldivler", "Maldives"],
    ] as string[][]
  ).flatMap(([code, ...names]) => names.map((n) => [cityKeyOf(n)!, code])),
);

/** An airport code for a place: a three-letter code as it is ("IST"), else a city the table knows; null otherwise. */
export function airportCode(placeText: string | null | undefined): string | null {
  const text = placeText?.trim();
  if (!text) return null;
  if (/^[A-Z]{3}$/.test(text)) return text;
  return CITY_AIRPORTS[cityKeyOf(text) ?? ""] ?? null;
}

export interface FlightNeed {
  /** Where it leaves from and goes to: an airport code or a city. */
  from: string | null;
  to: string | null;
  date: string | null;
  adults: number | null;
}

/**
 * A one-way flight search on Google Flights (plain words, the city as written: it reads both), Skyscanner
 * (`/transport/flights/ist/ams/261210/?adultsv2=2&rtn=0`) and Kayak (`/flights/IST-AMS/2026-12-10/2adults`).
 * Skyscanner and Kayak only with both airports known and a day; Google Flights needs one end (with no home
 * known, the way home is "Flights from Porto on …": it fills in where the traveller is).
 */
export function flightLinks({ from, to, date, adults }: FlightNeed): SearchLink[] {
  const [a, b] = [from?.trim() || null, to?.trim() || null];
  if (!a && !b) return [];
  const day = dayOf(date);
  const n = headCount(adults);
  const words = ["Flights", a && `from ${cityOfAirport(a)}`, b && `to ${cityOfAirport(b)}`, day && `on ${day}`, "one way"].filter(Boolean).join(" ");
  const out = [link("gflights", `https://www.google.com/travel/flights?q=${enc(words)}`)];
  const [ca, cb] = [airportCode(a), airportCode(b)];
  if (ca && cb && ca !== cb && day) {
    const yymmdd = day.slice(2).replace(/-/g, "");
    out.push(link("skyscanner", `https://www.skyscanner.net/transport/flights/${enc(ca.toLowerCase())}/${enc(cb.toLowerCase())}/${yymmdd}/?${new URLSearchParams({ adultsv2: String(n ?? 1), rtn: "0" })}`));
    out.push(link("kayak", `https://www.kayak.com/flights/${enc(ca)}-${enc(cb)}/${day}${n ? `/${n}adults` : ""}`));
  }
  return out;
}

export interface StayNeed {
  city: string | null;
  checkin: string | null;
  checkout: string | null;
  adults: number | null;
}

/** Booking (`searchresults.html?ss&checkin&checkout&group_adults&no_rooms=1`) and Airbnb (`/s/{place}/homes?checkin&checkout&adults`). */
export function stayLinks({ city, checkin, checkout, adults }: StayNeed): SearchLink[] {
  const where = city?.trim();
  if (!where) return [];
  let [inDay, outDay] = [dayOf(checkin), dayOf(checkout)];
  if (!inDay || !outDay || outDay <= inDay) [inDay, outDay] = [null, null];
  const n = headCount(adults);
  const booking = new URLSearchParams({ ss: where });
  if (inDay && outDay) {
    booking.set("checkin", inDay);
    booking.set("checkout", outDay);
  }
  if (n) booking.set("group_adults", String(n));
  booking.set("no_rooms", "1");
  const airbnb = new URLSearchParams();
  if (inDay && outDay) {
    airbnb.set("checkin", inDay);
    airbnb.set("checkout", outDay);
  }
  if (n) airbnb.set("adults", String(n));
  const q = airbnb.toString();
  return [
    link("booking", `https://www.booking.com/searchresults.html?${booking}`),
    link("airbnb", `https://www.airbnb.com/s/${enc(where)}/homes${q ? `?${q}` : ""}`),
  ];
}

export interface TransferNeed {
  /** Each end as a place the map can find ("Denpasar Havalimanı", a hotel's address, a city). */
  from: string | null;
  to: string | null;
}

/**
 * Uber's universal link (`m.uber.com/ul/?action=setPickup&pickup[formatted_address]&dropoff[formatted_address]`,
 * its documented deep link) and Google Maps directions (`maps/dir/?api=1&origin&destination`), said "Yol tarifi".
 * Bolt has no public web link that takes the two ends, so the directions stand in for it.
 */
export function transferLinks({ from, to }: TransferNeed): SearchLink[] {
  const [a, b] = [from?.trim() || null, to?.trim() || null];
  if (!b) return [];
  const uber = `https://m.uber.com/ul/?action=setPickup&${a ? `pickup[formatted_address]=${enc(a)}` : "pickup=my_location"}&dropoff[formatted_address]=${enc(b)}`;
  const maps = new URLSearchParams({ api: "1", ...(a ? { origin: a } : {}), destination: b });
  return [link("uber", uber), link("maps", `https://www.google.com/maps/dir/?${maps}`, L("Yol tarifi", "Directions"))];
}

const activityUrl = (brand: "getyourguide" | "viator" | "klook", city: string): string =>
  brand === "getyourguide"
    ? `https://www.getyourguide.com/s/?q=${enc(city)}`
    : brand === "viator"
      ? `https://www.viator.com/searchResults/all?text=${enc(city)}`
      : `https://www.klook.com/search/result/?query=${enc(city)}`;

/** Tours and tickets in a city: GetYourGuide (`/s/?q=`), Viator (`/searchResults/all?text=`), Klook (`/search/result/?query=`). */
export function activityLinks(city: string | null | undefined): SearchLink[] {
  const where = city?.trim();
  if (!where) return [];
  return (["getyourguide", "viator", "klook"] as const).map((b) => link(b, activityUrl(b, where)));
}

/** The country's page names where its English name doesn't make the slug (each site's own, checked). */
const ESIM_SLUGS: Record<string, { airalo: string; holafly: string }> = {
  TR: { airalo: "turkey", holafly: "turkey" },
  US: { airalo: "united-states", holafly: "usa" },
  GB: { airalo: "united-kingdom", holafly: "united-kingdom" },
  CZ: { airalo: "czech-republic", holafly: "czech-republic" },
  // Intl says "Hong Kong SAR China", "Macao SAR China", "Myanmar (Burma)".
  HK: { airalo: "hong-kong", holafly: "hong-kong" },
  MO: { airalo: "macau", holafly: "macau" },
  MM: { airalo: "myanmar", holafly: "myanmar" },
};

/** "Netherlands" → "netherlands", "United Arab Emirates" → "united-arab-emirates"; null for anything not a country code. */
function countrySlug(code: string): string | null {
  if (!/^[A-Z]{2}$/.test(code)) return null;
  let name: string | undefined;
  try {
    name = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" }).of(code);
  } catch {
    return null;
  }
  // Codes no country holds (ZZ, the private-use ones) come back as "Unknown Region" or not at all.
  if (!name || name === code || /unknown/i.test(name)) return null;
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A country's eSIM page on Airalo (`/{country}-esim`) and Holafly (`esim.holafly.com/esim-{country}/`). */
export function esimLinks(countryCode: string | null | undefined): SearchLink[] {
  const code = countryCode?.trim().toUpperCase() ?? "";
  const fixed = ESIM_SLUGS[code];
  const slug = countrySlug(code);
  const [airalo, holafly] = [fixed?.airalo ?? slug, fixed?.holafly ?? slug];
  if (!airalo || !holafly) return [];
  return [link("airalo", `https://www.airalo.com/${airalo}-esim`), link("holafly", `https://esim.holafly.com/esim-${holafly}/`)];
}
