// The one register of the sites a need is looked for on (plan v81–v82 "Sağlayıcılar dinamik olmalı"; v82 geçişi, spec
// docs/superpowers/specs/2026-10-18-v82-gecis/02-spec.md §3, C raporu §1.10): every site a "Kendin ara" icon, a region's
// "…'da ara" or Hazırlık's shop opens, with its mark, the kinds of need it serves, where it serves (some countries, or
// everywhere), its search and whether a booking there pays the project. Which ones a need shows, in order:
//   (1) the site of the link the traveller sent for it,
//   (2) the ones for the country the trip goes to (a shop: the traveller's own country),
//   (3) the kind's defaults, in the register's order.
// Phase 0 (temel): read only, nothing calls it yet; the callers are wired in phase 7. It wraps searchLinks.ts (the
// searches and the marks), brands.ts (the label colours), affiliate.ts (the partner brands) and prepBuy.ts (what is a
// thing to buy) without changing what any of them does. Pure.
import { partnerUrl } from "./affiliate";
import { cityOfAirport } from "./airports";
import { brandOf } from "./brands";
import { L, lang } from "./i18n";
import { amazonLink } from "./prepBuy";
import { activityLinks, BRANDS as MARKS, esimLinks, flightLinks, headCount, stayLinks, type Brand as MarkId, type SearchLink } from "./searchLinks";

/** What a provider is looked up for: the plan's needs, and Hazırlık's things to buy ("shop"). */
export type ProviderKind = "flight" | "stay" | "train" | "activity" | "esim" | "shop";

export type ProviderId =
  | "booking"
  | "airbnb"
  | "agoda"
  | "skyscanner"
  | "gflights"
  | "jr"
  | "rome2rio"
  | "klook"
  | "getyourguide"
  | "viator"
  | "amazon"
  | "trendyol"
  | "hepsiburada"
  | "airalo"
  | "holafly";

/** What a search is filled with; each site takes what it can and leaves the rest (a site that can't take what's known gives none). */
export interface SearchQuery {
  /** A stay's or a tour's city. */
  city?: string | null;
  /** A trip's ends: an airport code or a city. */
  from?: string | null;
  to?: string | null;
  /** The country the trip goes to (ISO 3166-1 alpha-2): an eSIM's page. */
  country?: string | null;
  /** A stay's check-in and check-out, a trip's day (YYYY-MM-DD). */
  start?: string | null;
  end?: string | null;
  adults?: number | null;
  /** The words to look for: a thing to buy ("priz adaptörü"), a tour's subject. */
  query?: string | null;
  /** The traveller's own country (ISO): a shop's site (amazon.de for Germany). */
  home?: string | null;
}

export interface Provider {
  id: ProviderId;
  /** The site's name as the icon's tip and the button say it ("Booking.com", "Google Uçuşlar"). */
  name: () => string;
  /** Its mark: one letter on its colour, drawn in the extension (never fetched from the brand). */
  logo: { color: string; letter: string };
  /** The label's colour when a card says it is from this site (brands.ts: white text on it); null for a plain grey label. */
  chip: string | null;
  kinds: readonly ProviderKind[];
  /** Where it serves: these countries only, or everywhere. */
  countries: readonly string[] | "global";
  /** Where it comes first though it serves everywhere (Agoda and Klook in Asia). */
  front?: readonly string[];
  /** Whose country it is matched against: the trip's (a hotel site, a rail operator) or the traveller's own (a shop). */
  serves: "trip" | "home";
  /** Its pages' host, to tell a link's source. */
  site: RegExp;
  /** Its search for a need, or null when it can't take what is known. */
  search: (q: SearchQuery) => string | null;
  /** A page of it opened from the board goes through the partner redirect (affiliate.ts): a booking there pays the project. */
  partner: boolean;
}

const enc = encodeURIComponent;

/** The link one of searchLinks' builders makes for a brand, or null when it leaves that brand out. */
const urlOf = (links: SearchLink[], brand: MarkId): string | null => links.find((l) => l.brand === brand)?.url ?? null;

const stay = (q: SearchQuery) => stayLinks({ city: q.city ?? null, checkin: q.start ?? null, checkout: q.end ?? null, adults: q.adults ?? null });
const flight = (q: SearchQuery) => flightLinks({ from: q.from ?? null, to: q.to ?? null, date: q.start ?? null, adults: q.adults ?? null });
const tours = (q: SearchQuery) => activityLinks(q.city, q.query ?? undefined);

/** A real calendar day (YYYY-MM-DD), else null (searchLinks' own check, for the searches made here). */
function dayOf(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

/**
 * Agoda's search by the city's name (`/search?textToSearch&checkIn&checkOut&adults&rooms=1`), the days only both and in
 * order. Not opened anywhere yet: phase 7 checks the format before a need shows it.
 */
function agodaSearch(q: SearchQuery): string | null {
  const where = q.city?.trim();
  if (!where) return null;
  const p = new URLSearchParams({ textToSearch: where });
  const [a, b] = [dayOf(q.start), dayOf(q.end)];
  if (a && b && b > a) {
    p.set("checkIn", a);
    p.set("checkOut", b);
  }
  const n = headCount(q.adults);
  if (n) p.set("adults", String(n));
  p.set("rooms", "1");
  return `https://www.agoda.com/search?${p}`;
}

/** A trip's end as Rome2rio reads it: a city's name (an airport code is its city). */
const placeName = (text: string | null | undefined): string | null => {
  const t = text?.trim();
  return t ? cityOfAirport(t) : null;
};

/** Rome2rio's route between two places (`/map/{from}/{to}`): every way of getting there, any country. */
function rome2rioSearch(q: SearchQuery): string | null {
  const [a, b] = [placeName(q.from), placeName(q.to)];
  return a && b ? `https://www.rome2rio.com/map/${enc(a)}/${enc(b)}` : null;
}

/** Each country's own Amazon; another country's traveller gets amazon.com. */
const AMAZON_HOSTS: Readonly<Record<string, string>> = {
  TR: "www.amazon.com.tr", DE: "www.amazon.de", AT: "www.amazon.de", GB: "www.amazon.co.uk", FR: "www.amazon.fr", IT: "www.amazon.it",
  ES: "www.amazon.es", NL: "www.amazon.nl", BE: "www.amazon.com.be", SE: "www.amazon.se", PL: "www.amazon.pl", JP: "www.amazon.co.jp",
  US: "www.amazon.com", CA: "www.amazon.ca", MX: "www.amazon.com.mx", BR: "www.amazon.com.br", AU: "www.amazon.com.au", IN: "www.amazon.in",
  AE: "www.amazon.ae", SA: "www.amazon.sa", SG: "www.amazon.sg", EG: "www.amazon.eg",
};

/** The Amazon a traveller shops on: their country's; with no country known, prepBuy's rule (the board's language). */
export function amazonHost(home: string | null | undefined): string {
  const code = home?.trim().toUpperCase();
  if (code) return AMAZON_HOSTS[code] ?? "www.amazon.com";
  return lang() === "tr" ? "www.amazon.com.tr" : "www.amazon.com";
}

const shopSearch = (base: string) => (q: SearchQuery) => {
  const words = q.query?.trim();
  return words ? `${base}${enc(words)}` : null;
};

/** East, South-East and South Asia: where Agoda and Klook come before the others. */
const ASIA = ["JP", "KR", "CN", "HK", "MO", "TW", "TH", "VN", "SG", "MY", "ID", "PH", "KH", "LA", "MM", "BN", "IN", "LK", "NP", "MV"] as const;

/** A mark from searchLinks' own, else the one drawn here for a site searchLinks doesn't know yet. */
const mark = (id: MarkId) => ({ color: MARKS[id].color, letter: MARKS[id].letter });
/** The label colour brands.ts gives the name (null: a plain grey label). */
const chipOf = (name: string) => brandOf(name)?.color ?? null;
/** Whether affiliate.ts turns the site's pages into partner links. */
const isPartner = (home: string) => partnerUrl(home) !== home;

type Entry = Omit<Provider, "chip" | "partner"> & { home: string; brand?: string };

const ENTRIES: readonly Entry[] = [
  // Konaklama: Booking.com · Airbnb · Agoda (Asya'da Agoda öne).
  { id: "booking", name: () => "Booking.com", logo: mark("booking"), kinds: ["stay"], countries: "global", serves: "trip", site: /(^|\.)booking\.com$/i, home: "https://www.booking.com/", search: (q) => urlOf(stay(q), "booking") },
  { id: "airbnb", name: () => "Airbnb", logo: mark("airbnb"), kinds: ["stay"], countries: "global", serves: "trip", site: /(^|\.)airbnb\./i, home: "https://www.airbnb.com/", search: (q) => urlOf(stay(q), "airbnb") },
  { id: "agoda", name: () => "Agoda", logo: { color: "#5542f6", letter: "a" }, kinds: ["stay"], countries: "global", front: ASIA, serves: "trip", site: /(^|\.)agoda\./i, home: "https://www.agoda.com/", search: agodaSearch },
  // Uçuş: Skyscanner · Google Uçuşlar.
  { id: "skyscanner", name: () => "Skyscanner", logo: mark("skyscanner"), kinds: ["flight"], countries: "global", serves: "trip", site: /(^|\.)skyscanner\./i, home: "https://www.skyscanner.net/", search: (q) => urlOf(flight(q), "skyscanner") },
  { id: "gflights", name: () => L("Google Uçuşlar", "Google Flights"), brand: "Google Flights", logo: mark("gflights"), kinds: ["flight"], countries: "global", serves: "trip", site: /(^|\.)google\.[a-z.]+$/i, home: "https://www.google.com/travel/flights", search: (q) => urlOf(flight(q), "gflights") },
  // Tren: JR (Japonya) · Rome2rio (her yer). JR has no public search that takes the stations: its booking site (SmartEX).
  { id: "jr", name: () => "JR", logo: { color: "#0b7a3b", letter: "JR" }, kinds: ["train"], countries: ["JP"], serves: "trip", site: /(^|\.)(smart-ex\.jp|japanrailpass\.net|jr-?(east|central|west|odekake)\.[a-z.]+|eki-net\.com)$/i, home: "https://smart-ex.jp/en/", search: () => "https://smart-ex.jp/en/" },
  { id: "rome2rio", name: () => "Rome2rio", logo: { color: "#f5503d", letter: "r" }, kinds: ["train"], countries: "global", serves: "trip", site: /(^|\.)rome2rio\.com$/i, home: "https://www.rome2rio.com/", search: rome2rioSearch },
  // Etkinlik: GetYourGuide · Viator · Klook (Asya'da Klook öne), searchLinks.activityLinks' own order.
  { id: "getyourguide", name: () => "GetYourGuide", logo: mark("getyourguide"), kinds: ["activity"], countries: "global", serves: "trip", site: /(^|\.)getyourguide\./i, home: "https://www.getyourguide.com/", search: (q) => urlOf(tours(q), "getyourguide") },
  { id: "viator", name: () => "Viator", logo: mark("viator"), kinds: ["activity"], countries: "global", serves: "trip", site: /(^|\.)viator\.com$/i, home: "https://www.viator.com/", search: (q) => urlOf(tours(q), "viator") },
  { id: "klook", name: () => "Klook", logo: mark("klook"), kinds: ["activity"], countries: "global", front: ASIA, serves: "trip", site: /(^|\.)klook\.com$/i, home: "https://www.klook.com/", search: (q) => urlOf(tours(q), "klook") },
  // Hazırlık alışverişi: Türkiye'den gidene Trendyol · Hepsiburada · Amazon.com.tr; başka ülkede o ülkenin Amazon'u.
  { id: "trendyol", name: () => "Trendyol", logo: { color: "#f27a1a", letter: "T" }, kinds: ["shop"], countries: ["TR"], serves: "home", site: /(^|\.)trendyol\.com$/i, home: "https://www.trendyol.com/", search: shopSearch("https://www.trendyol.com/sr?q=") },
  { id: "hepsiburada", name: () => "Hepsiburada", logo: { color: "#ff6000", letter: "H" }, kinds: ["shop"], countries: ["TR"], serves: "home", site: /(^|\.)hepsiburada\.com$/i, home: "https://www.hepsiburada.com/", search: shopSearch("https://www.hepsiburada.com/ara?q=") },
  { id: "amazon", name: () => "Amazon", logo: { color: "#232f3e", letter: "a" }, kinds: ["shop"], countries: "global", serves: "home", site: /(^|\.)amazon\.[a-z.]+$/i, home: "https://www.amazon.com/", search: (q) => shopSearch(`https://${amazonHost(q.home)}/s?k=`)(q) },
  // İnternet: Airalo · Holafly.
  { id: "airalo", name: () => "Airalo", logo: mark("airalo"), kinds: ["esim"], countries: "global", serves: "trip", site: /(^|\.)airalo\.com$/i, home: "https://www.airalo.com/", search: (q) => urlOf(esimLinks(q.country), "airalo") },
  { id: "holafly", name: () => "Holafly", logo: mark("holafly"), kinds: ["esim"], countries: "global", serves: "trip", site: /(^|\.)holafly\.com$/i, home: "https://esim.holafly.com/", search: (q) => urlOf(esimLinks(q.country), "holafly") },
];

/** Every provider, in each kind's default order. */
export const PROVIDERS: readonly Provider[] = ENTRIES.map(({ home, brand, ...p }) => ({ ...p, chip: chipOf(brand ?? p.name()), partner: isPartner(home) }));

export const providerById = (id: ProviderId): Provider => PROVIDERS.find((p) => p.id === id)!;

/** A page's host without "www.", or null for anything that isn't a web address. */
function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.hostname.replace(/^www\./, "").toLowerCase() : null;
  } catch {
    return null;
  }
}

/** The provider a link the traveller sent comes from, or null for a site the register doesn't know (a hotel's own). */
export function providerOfLink(url: string | null | undefined): Provider | null {
  const host = hostOf(url);
  return host ? (PROVIDERS.find((p) => p.site.test(host)) ?? null) : null;
}

export interface PickAt {
  /** The link the traveller sent for the need (its first saved option's page). */
  link?: string | null;
  /** The country (or countries) the trip goes to, ISO. */
  country?: string | readonly string[] | null;
  /** The traveller's own country, ISO (Settings → Pasaport). */
  home?: string | null;
}

const codesOf = (value: string | readonly string[] | null | undefined): string[] =>
  (typeof value === "string" ? [value] : (value ?? [])).map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));

/** The countries a provider is matched against: the trip's, or the traveller's own. */
const placesFor = (p: Provider, at: PickAt): string[] => (p.serves === "home" ? codesOf(at.home) : codesOf(at.country));

/** It works there: everywhere, or one of its countries is the trip's (a shop's: the traveller's). */
const servesThere = (p: Provider, at: PickAt): boolean => p.countries === "global" || placesFor(p, at).some((c) => p.countries.includes(c));

/** It is the place's own: a country-only site there, or one that comes first there. */
const ownThere = (p: Provider, at: PickAt): boolean => {
  const places = placesFor(p, at);
  return places.some((c) => (p.countries !== "global" && p.countries.includes(c)) || (p.front?.includes(c) ?? false));
};

/**
 * The providers a need of this kind shows, in order: the site of the traveller's own link first, then the ones that are the
 * place's own (the trip's country; a shop: the traveller's), then the kind's defaults. A country-only site is left out
 * anywhere else (JR outside Japan, Trendyol for a traveller from Germany).
 */
export function pickProviders(kind: ProviderKind, at: PickAt = {}): Provider[] {
  const list = PROVIDERS.filter((p) => p.kinds.includes(kind) && servesThere(p, at));
  const own = providerOfLink(at.link);
  const first = own && list.includes(own) ? [own] : [];
  const local = list.filter((p) => !first.includes(p) && ownThere(p, at));
  return [...first, ...local, ...list.filter((p) => !first.includes(p) && !local.includes(p))];
}

/** The picked providers' searches for a need, those that can take what's known (a search with nothing to go on is left out). */
export function providerLinks(kind: ProviderKind, at: PickAt, q: SearchQuery): { provider: Provider; url: string }[] {
  return pickProviders(kind, at).flatMap((provider) => {
    const url = provider.search({ ...q, home: q.home ?? at.home ?? null });
    return url ? [{ provider, url }] : [];
  });
}

/**
 * Hazırlık's shops for a chore: only one that is a thing to buy (prepBuy.amazonLink says which, and with what words), at the
 * traveller's own shops; nothing for a visa, cash, or a chore that names its own shop.
 */
export function shopLinks(chore: string, home: string | null = null): { provider: Provider; url: string }[] {
  const amazon = amazonLink(chore);
  if (!amazon) return [];
  const query = new URL(amazon).searchParams.get("k");
  return providerLinks("shop", { home }, { query, home });
}
