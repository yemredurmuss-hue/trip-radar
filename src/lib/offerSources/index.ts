// The live source for the empty cards' "✨ Senin için N öneri" row (src/lib/offerSource.ts): asks Trip Radar's
// `offers` function (supabase/functions/offers) for a flight's or a stay's offers, from real sources only
// (Aviasales' cached prices; Tripadvisor's hotels and each platform's price, via Xotelo; a city's tours on Viator),
// the pages already partner links there. Only what a search needs leaves the board: the airports or the place, the days and
// the head-count, never a name nor the trip.
//
// Answers are kept here for a few hours per question (chrome.storage), so opening the board again asks nothing.
// Nothing for the other kinds yet (transfers, eSIMs: no source connected), nor when the question is
// short of what a search needs; a failure or an unconfigured server is no offers, so the row stays away.
import { lang } from "../i18n";
import { sectionLooking } from "../looking";
import { airportCode } from "../searchLinks";
import { chromeKV, DEFAULT_SERVER, type KV } from "../share/store";
import { validOffers, type Need, type Offer, type SuggestionSource } from "../offerSource";
import { validDays, validInsight, type DayFare, type PriceAsk, type PriceInsight } from "../priceVerdict";
import { validSights, type Sight } from "../citySights";
import { acceptStyle, type StyleId } from "../tripStyle";
import type { Trip } from "../types";

const STORE_KEY = "offersSeen";
const PRICE_KEY = "priceSeen";
const PRICE_HOURS = 24;
const SIGHTS_KEY = "sightsSeen";
const SIGHTS_DAYS = 30;
const DAYS_KEY = "daysSeen";
const DAYS_HOURS = 12;
const EVENTS_KEY = "eventsSeen";
const EVENTS_HOURS = 24;
const KEEP_HOURS = 6;
/** Answers kept at most; the oldest go first. */
const KEEP_MAX = 60;

/**
 * A hotel to choose from (the offers function's `candidates`): what the sources said, nothing guessed. `nightly`
 * and `total` are for these nights (null when this one wasn't priced); `priceRange` is Tripadvisor's usual one.
 */
export interface StayCandidate {
  id: string;
  name: string;
  rating: number | null;
  reviews: number | null;
  photo: string | null;
  geo: { lat: number; lng: number } | null;
  area: string | null;
  labels: string[];
  url: string;
  nightly: number | null;
  total: number | null;
  nights: number;
  priceRange: { min: number; max: number } | null;
  source: string | null;
  currency: "EUR";
  fetchedAt: number;
}

/**
 * A place to see or eat at as Google Maps has it (the offers function's `places`, kind=place): what Maps said, nothing
 * guessed; `url` is the place's own Maps page. From Google's Places API, `photo` is the function's own kind=placephoto
 * address (an <img> is sent on to Google's photo) and `photoBy` who took it.
 */
export interface MapsPlace {
  id: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  photo: string | null;
  geo: { lat: number; lng: number } | null;
  type: string | null;
  url: string;
  source: string;
  fetchedAt: number;
  photoBy?: string;
}

type Answer = { offers: Offer[]; candidates?: StayCandidate[]; places?: MapsPlace[] };
type Seen = Record<string, { at: number } & Answer>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const countryName = (code: string | null | undefined): string | null => {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
};

/**
 * The second question for a town the source doesn't know as a destination (Ahangama: Viator has nothing under its name):
 * the stay's country as the destination, searched by the town's name. Null when the country isn't known, the need already
 * names its words, or the town is the country itself.
 */
export function countryNeed(need: Need, countryCode: string | null | undefined): Need | null {
  if (need.kind !== "activity" || need.query?.trim()) return null;
  const country = countryName(countryCode);
  const town = need.city?.trim();
  if (!country || !town || country.toLocaleLowerCase("en") === town.toLocaleLowerCase("en")) return null;
  return { ...need, key: `${need.key}:in:${countryCode!.toUpperCase()}`, city: country, country: null, query: town };
}

/** Fewer of a town's own tours than this: the trip's nearby cities and the country's popular ones are asked too. */
export const FEW_TOURS = 4;

/** A city of the trip in the town's country (a stay's, an airport's): its name to search by, and as its card says it. */
export interface NearPlace {
  city: string;
  label: string;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Search words for the trip's kind ("Sörf tatili" → surf), tried in order on its label and name; the source's own words. */
const KIND_WORDS: readonly [RegExp, string][] = [
  [/kite/, "kitesurfing"],
  [/windsurf/, "windsurfing"],
  [/sorf|surf/, "surf"],
  [/dalis|dive|diving|scuba/, "diving"],
  [/snorkel/, "snorkeling"],
  [/yoga/, "yoga"],
  [/safari/, "safari"],
  [/trek|hiking|yuruyus/, "hiking"],
  [/tirmanis|climb/, "climbing"],
  [/\bski/, "ski"],
  [/gastronomi|culinary|yemek/, "cooking class"],
  // P10 (F63): a honeymoon's tours are the two of them's (a sunset dinner, a couples' spa), not an ATV or a jungle swing.
  [/balayi|honeymoon/, "romantic"],
];
/** The style chips' words (Doğa: safari, hiking); a style with no tour of its own (Lüks, Şehir) says none. */
const STYLE_WORDS: Partial<Record<StyleId, readonly string[]>> = {
  nature: ["safari", "hiking"],
  adventure: ["adventure"],
  active: ["hiking"],
  beach: ["snorkeling"],
  culture: ["culture"],
  food: ["cooking class"],
  romantic: ["sunset"],
};
/** Words asked at most (each one more question to the source, kept for hours like the rest). */
export const TASTE_MAX = 3;

/**
 * What the trip is for, as tour search words (Emre, 0.38.5: "etkinlikler bu turun niyetine göre zengin gelsin"): its
 * kind's (a surf trip: surf) first, then its style chips' (Doğa: safari, hiking); none for a trip that says neither.
 */
export function tourWords(trip: Pick<Trip, "intent" | "style"> | null | undefined): string[] {
  const said = fold(`${trip?.intent?.label ?? ""} ${trip?.intent?.name ?? ""} ${trip?.intent?.playbook === "ski" ? "ski" : ""} ${trip?.intent?.playbook === "wellness" ? "yoga" : ""} ${trip?.intent?.playbook === "honeymoon" ? "honeymoon" : ""}`).replace(/ı/g, "i");
  const words = KIND_WORDS.filter(([re]) => re.test(said)).map(([, w]) => w);
  for (const id of acceptStyle(trip?.style?.ids ?? [])) words.push(...(STYLE_WORDS[id] ?? []));
  return [...new Set(words)].slice(0, TASTE_MAX);
}

/** Kinds of place Google Maps is asked for, by the trip's kind (its label and name; a honeymoon is romantic). */
const KIND_PLACES: readonly [RegExp, (city: string) => string][] = [
  [/kite|windsurf|sorf|surf/, (c) => `surf spots in ${c}`],
  [/dalis|dive|diving|scuba|snorkel/, (c) => `dive sites near ${c}`],
  [/yoga|wellness|retreat/, (c) => `yoga studios in ${c}`],
  [/trek|hiking|yuruyus/, (c) => `hiking trails near ${c}`],
  [/balayi|honeymoon/, (c) => `romantic restaurants in ${c}`],
  [/gastronomi|culinary|yemek/, (c) => `local restaurants in ${c}`],
];
/** By the style chips (Romantik: romantic restaurants, Doğa: waterfalls); a style with no kind of place of its own says none. */
const STYLE_PLACES: Partial<Record<StyleId, (city: string) => string>> = {
  romantic: (c) => `romantic restaurants in ${c}`,
  nature: (c) => `waterfalls near ${c}`,
  beach: (c) => `beaches in ${c}`,
  culture: (c) => `historic sites in ${c}`,
  food: (c) => `local restaurants in ${c}`,
  active: (c) => `hiking trails near ${c}`,
  family: (c) => `family friendly restaurants in ${c}`,
  luxury: (c) => `fine dining restaurants in ${c}`,
  calm: (c) => `quiet cafes in ${c}`,
};
/** Kinds of place asked at most for a trip (each one more SerpApi search, kept a month there and hours here). */
export const PLACE_SEARCH_MAX = 2;

/**
 * What the trip is for, as Google Maps searches for its kinds of place in a city (Emre, 0.39.1: "seyahatin niyetini
 * anlayıp ona göre öneriler"): its kind's first (a surf trip: surf spots), then its style chips' (Romantik, Doğa:
 * romantic restaurants, waterfalls), then who goes (with children: family friendly restaurants). At most
 * PLACE_SEARCH_MAX; none for a trip that says none of these.
 */
export function placeSearches(trip: Pick<Trip, "intent" | "style" | "travellers"> | null | undefined, city: string): string[] {
  const c = city.trim();
  if (!c) return [];
  const said = fold(`${trip?.intent?.label ?? ""} ${trip?.intent?.name ?? ""} ${trip?.intent?.playbook ?? ""}`).replace(/ı/g, "i");
  const out = KIND_PLACES.filter(([re]) => re.test(said)).map(([, q]) => q(c));
  for (const id of acceptStyle(trip?.style?.ids ?? [])) {
    const q = STYLE_PLACES[id];
    if (q) out.push(q(c));
  }
  if ((trip?.travellers?.children ?? 0) > 0) out.push(`family friendly restaurants in ${c}`);
  return [...new Set(out)].slice(0, PLACE_SEARCH_MAX);
}

/**
 * A city's tours from a source, each with the place it was asked for: the trip's kind first when `words` say it (the
 * town searched by "surf", or for a town it doesn't know its country by "surf Ahangama"), then the city's own, else
 * (none) its country's searched by the town's name; while they are few (FEW_TOURS), the trip's cities in the same
 * country (`near`: Kolombo for Ahangama) and the country's popular ones (no words) after them. Joined without repeats;
 * a failure is none. Only the source's real tours, never a made-up card.
 */
export async function cityTours(source: Pick<SuggestionSource, "offers">, need: Need, countryCode: string | null | undefined, near: readonly NearPlace[] = [], words: readonly string[] = []): Promise<Offer[]> {
  const tours = (n: Need, place: string | null | undefined): Promise<Offer[]> =>
    source.offers(n).then(
      (list) => list.filter((o) => o.kind === "activity").map((o) => ({ ...o, place: place ?? null })),
      () => [] as Offer[],
    );
  const join = (into: Offer[], more: readonly Offer[]) => {
    for (const o of more) if (!into.some((x) => x.id === o.id || x.url === o.url || fold(x.title) === fold(o.title))) into.push(o);
    return into;
  };
  const town = need.city?.trim() ?? null;
  let list = await tours(need, town);
  const wider = list.length ? null : countryNeed(need, countryCode);
  if (wider) list = await tours(wider, town);
  if (need.kind !== "activity" || need.query?.trim()) return list;
  // The trip's kind: asked where the town's own were found (the town, or its country by the town's name).
  const base = wider ?? (list.length ? need : null);
  const tasted = base
    ? (await Promise.all(words.slice(0, TASTE_MAX).map((w) => tours({ ...base, key: `${base.key}:taste:${fold(w)}`, query: wider ? `${w} ${town}` : w }, town)))).flat()
    : [];
  const own = list.length;
  list = join(join([], tasted), list);
  if (own >= FEW_TOURS) return list;
  const country = countryName(countryCode);
  const others = near.filter((p, i) => fold(p.city) !== fold(town ?? "") && near.findIndex((q) => fold(q.city) === fold(p.city)) === i);
  const asks = [
    ...others.map((p) => tours({ ...need, key: `${need.key}:near:${fold(p.city)}`, city: p.city, country: countryCode ?? need.country ?? null, query: null }, p.label)),
    ...(country && fold(country) !== fold(town ?? "") ? [tours({ ...need, key: `${need.key}:in:${countryCode!.toUpperCase()}:top`, city: country, country: null, query: null }, countryLabel(countryCode!))] : []),
  ];
  for (const more of await Promise.all(asks)) join(list, more);
  return list;
}

/** The country as the traveller reads it ("Sri Lanka", "Endonezya"). */
const countryLabel = (code: string): string => {
  try {
    return new Intl.DisplayNames([lang()], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

/** How the chat may narrow it: the cheapest instead of the mixed three, a ceiling in euros (a stay's by the night, a flight's per person). */
export interface Narrow {
  prefer?: "cheap" | null;
  max?: number | null;
  /** A live look (Google Flights / Google Hotels, now): only when the traveller asks, its quota is small. */
  live?: boolean;
}

const narrowed = (q: Record<string, string>, n: Narrow): Record<string, string> => {
  if (n.prefer === "cheap") q.prefer = "cheap";
  if (n.max != null && Number.isFinite(n.max) && n.max >= 1) q.max = String(Math.round(n.max));
  if (n.live) q.live = "1";
  return q;
};

/** The function's question for a need, or null when it can't be searched (or its kind has no source yet). */
export function queryOf(need: Need, language: "tr" | "en" = lang(), narrow: Narrow = {}): string | null {
  const adults = String(Math.min(9, Math.max(1, Math.round(need.adults ?? 1))));
  if (need.kind === "flight") {
    const from = need.fromCode ?? airportCode(need.from);
    const to = need.toCode ?? airportCode(need.to);
    if (!from || !to || from === to || !need.start || !DAY.test(need.start)) return null;
    return new URLSearchParams(narrowed({ kind: "flight", from, to, day: need.start, adults, lang: language }, narrow)).toString();
  }
  if (need.kind === "activity") {
    const city = need.city?.trim();
    if (!city) return null;
    const q: Record<string, string> = { kind: "activity", city, adults, lang: language };
    if (need.start && need.end && DAY.test(need.start) && DAY.test(need.end) && need.end >= need.start) Object.assign(q, { start: need.start, end: need.end });
    const country = countryName(need.country);
    if (country) q.country = country;
    const words = need.query?.trim();
    if (words) q.q = words.slice(0, 80);
    return new URLSearchParams(narrowed(q, narrow)).toString();
  }
  if (need.kind === "stay") {
    const city = need.city?.trim();
    if (!city || !need.start || !need.end || !DAY.test(need.start) || !DAY.test(need.end) || need.end <= need.start) return null;
    const q: Record<string, string> = { kind: "stay", city, start: need.start, end: need.end, adults, lang: language };
    const country = countryName(need.country);
    if (country) q.country = country;
    if (need.home) q.home = "1";
    // The kind of place wanted (0.39.4): the server searches it in words; a server before it reads hotels, as always.
    const stay = need.stay?.trim();
    if (stay) q.stay = stay.slice(0, 60);
    return new URLSearchParams(narrowed(q, narrow)).toString();
  }
  if (need.kind === "transfer") {
    const from = need.from?.trim(), to = need.to?.trim();
    if (!from || !to || from.toLocaleLowerCase("tr") === to.toLocaleLowerCase("tr")) return null;
    return new URLSearchParams({ kind: "transfer", from, to, adults, lang: language }).toString();
  }
  if (need.kind === "esim") {
    const country = need.country?.trim().toUpperCase();
    if (!country || !/^[A-Z]{2}$/.test(country)) return null;
    const q: Record<string, string> = { kind: "esim", country, lang: language };
    if (need.start && need.end && DAY.test(need.start) && DAY.test(need.end) && need.end >= need.start) Object.assign(q, { start: need.start, end: need.end });
    return new URLSearchParams(q).toString();
  }
  return null;
}

/** A place from the function, kept only with what a card needs whole: a name, an id and an https page of its own. */
const mapsPlaceOk = (p: MapsPlace): boolean =>
  !!p && typeof p.name === "string" && !!p.name.trim() && typeof p.id === "string" && typeof p.url === "string" && /^https:\/\//.test(p.url) && (p.photo == null || /^https:\/\//.test(p.photo));

/** The function's question for a place search (kind=place), or null when the words can't be searched. */
export function placeQueryOf(search: string, language: "tr" | "en" = lang()): string | null {
  const q = search.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!q || q.length > 100 || !/^[\p{L}\p{M}\p{N} .,'’&()-]+$/u.test(q)) return null;
  return new URLSearchParams({ kind: "place", q, lang: language }).toString();
}

/** The live source, with its storage and fetch handed in for the tests; `find` is the chat's way in (find_offers). */
export function makeLiveSource(opts: { kv?: KV; fetcher?: typeof fetch; now?: () => number; server?: string } = {}): SuggestionSource & {
  find(need: Need, narrow?: Narrow): Promise<Offer[]>;
  candidates(need: Need): Promise<StayCandidate[]>;
  places(search: string): Promise<MapsPlace[]>;
  price(ask: PriceAsk): Promise<PriceInsight | null>;
  sights(city: string, country?: string | null): Promise<Sight[]>;
  days(ask: PriceAsk): Promise<DayFare[]>;
  events(city: string, start: string, end: string): Promise<Offer[]>;
} {
  const kv = opts.kv ?? chromeKV;
  const fetcher = opts.fetcher ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  // Only a question that really goes to the server marks its category (its row on the Plan moves, lib/looking.ts): an
  // answer kept from before is no search (2026-10-24, Emre: "her açıp kapattığımda aranıyor çıkıyor").
  const get = (url: string): Promise<Response> => {
    const section = SECTION_OF_KIND[new URL(url).searchParams.get("kind") ?? ""];
    const going = fetcher(url);
    return section ? sectionLooking.track(section, going) : going;
  };
  const now = opts.now ?? Date.now;
  const server = opts.server ?? DEFAULT_SERVER.url;
  const asking = new Map<string, Promise<Answer>>();
  // Answers are written one after another, each onto the store as it is then: questions asked at once (a board's
  // boxes, a city's tours and its neighbours') never overwrite each other's answer, which would be asked again next time.
  let writing: Promise<void> = Promise.resolve();
  const keep = (q: string, answer: Answer): Promise<void> =>
    (writing = writing.then(async () => {
      try {
        const stored = (await kv.get<Seen>(STORE_KEY)) ?? {};
        const kept = Object.entries({ ...stored, [q]: { at: now(), ...answer } })
          .filter(([, v]) => now() - v.at < KEEP_HOURS * 36e5)
          .sort((a, b) => b[1].at - a[1].at)
          .slice(0, KEEP_MAX);
        await kv.set(STORE_KEY, Object.fromEntries(kept));
      } catch {
        // not kept this time
      }
    }));

  async function ask(q: string): Promise<Answer> {
    let seen: Seen = {};
    try {
      seen = (await kv.get<Seen>(STORE_KEY)) ?? {};
    } catch {
      // no storage: asked every time
    }
    const had = seen[q];
    if (had && now() - had.at < KEEP_HOURS * 36e5) return had;
    try {
      const res = await get(`${server}/functions/v1/offers?${q}`);
      if (!res.ok) return { offers: [] };
      const body = (await res.json()) as { offers?: Offer[]; candidates?: StayCandidate[]; places?: MapsPlace[] };
      const answer: Answer = {
        offers: Array.isArray(body.offers) ? body.offers : [],
        ...(Array.isArray(body.candidates) ? { candidates: body.candidates } : {}),
        ...(Array.isArray(body.places) ? { places: body.places.filter(mapsPlaceOk) } : {}),
      };
      await keep(q, answer);
      return answer;
    } catch {
      return { offers: [] };
    }
  }
  const once = (q: string): Promise<Answer> => {
    // The same question asked by two cards at once goes out once.
    const going = asking.get(q) ?? ask(q).finally(() => asking.delete(q));
    asking.set(q, going);
    return going;
  };

  const find = async (need: Need, narrow: Narrow = {}): Promise<Offer[]> => {
    const q = queryOf(need, lang(), narrow);
    return q ? (await once(q)).offers : [];
  };
  /** Up to six hotels for a stay to choose three from ("Sana en uygun", "Daha ekonomik", "Daha konforlu"). */
  const candidates = async (need: Need): Promise<StayCandidate[]> => {
    if (need.kind !== "stay") return [];
    const q = queryOf(need, lang());
    return q ? ((await once(`${q}&candidates=1`)).candidates ?? []) : [];
  };
  /** Google Maps' places for a name and its town, or a kind of place ("romantic restaurants in Canggu"); [] when none (or a function without them). */
  const places = async (search: string): Promise<MapsPlace[]> => {
    const q = placeQueryOf(search, lang());
    return q ? ((await once(q)).places ?? []) : [];
  };

  /**
   * A flight's fare judged (spec 2026-10-19 SerpApi, 2 and 4): Google's usual range and last weeks for one person on the
   * route and day, kept a day here (PRICE_KEY) so a card drawn again asks nothing; null when the server has none.
   */
  const pricing = new Map<string, Promise<PriceInsight | null>>();
  async function askPrice(a: PriceAsk): Promise<PriceInsight | null> {
    const q = `kind=price&from=${a.from}&to=${a.to}&day=${a.day}`;
    let seen: Record<string, { at: number; insight: PriceInsight | null }> = {};
    try {
      seen = (await kv.get<typeof seen>(PRICE_KEY)) ?? {};
    } catch {
      // no storage: asked every time
    }
    const had = seen[q];
    if (had && now() - had.at < PRICE_HOURS * 36e5) return had.insight;
    try {
      const res = await get(`${server}/functions/v1/offers?${q}`);
      if (!res.ok) return null;
      const insight = validInsight(((await res.json()) as { insight?: unknown }).insight);
      const kept = Object.entries({ ...seen, [q]: { at: now(), insight } })
        .filter(([, v]) => now() - v.at < PRICE_HOURS * 36e5)
        .sort((x, y) => y[1].at - x[1].at)
        .slice(0, KEEP_MAX);
      try {
        await kv.set(PRICE_KEY, Object.fromEntries(kept));
      } catch {
        // not kept this time
      }
      return insight;
    } catch {
      return null;
    }
  }
  const price = (a: PriceAsk): Promise<PriceInsight | null> => {
    const k = `${a.from}|${a.to}|${a.day}`;
    const going = pricing.get(k) ?? askPrice(a).finally(() => pricing.delete(k));
    pricing.set(k, going);
    return going;
  };

  /** A city's sights (spec 2026-10-19 SerpApi, item 3), kept 30 days here (SIGHTS_KEY): they change slowly. */
  const sighting = new Map<string, Promise<Sight[]>>();
  async function askSights(city: string, country: string | null): Promise<Sight[]> {
    const q = new URLSearchParams({ kind: "sights", city, ...(country ? { country } : {}), lang: lang() }).toString();
    let seen: Record<string, { at: number; sights: Sight[] }> = {};
    try {
      seen = (await kv.get<typeof seen>(SIGHTS_KEY)) ?? {};
    } catch {
      // no storage: asked every time
    }
    const had = seen[q];
    if (had && now() - had.at < SIGHTS_DAYS * 864e5) return had.sights;
    try {
      const res = await get(`${server}/functions/v1/offers?${q}`);
      if (!res.ok) return [];
      const sights = validSights(((await res.json()) as { sights?: unknown }).sights);
      const kept = Object.entries({ ...seen, [q]: { at: now(), sights } })
        .filter(([, v]) => now() - v.at < SIGHTS_DAYS * 864e5)
        .sort((x, y) => y[1].at - x[1].at)
        .slice(0, KEEP_MAX);
      try {
        await kv.set(SIGHTS_KEY, Object.fromEntries(kept));
      } catch {
        // not kept this time
      }
      return sights;
    } catch {
      return [];
    }
  }
  const sights = (city: string, country: string | null = null): Promise<Sight[]> => {
    const k = `${city.toLocaleLowerCase("tr")}|${country ?? ""}`;
    const going = sighting.get(k) ?? askSights(city, country).finally(() => sighting.delete(k));
    sighting.set(k, going);
    return going;
  };

  /** A route's fares a day either side of three (item 5), kept 12 hours here (DAYS_KEY). */
  const daying = new Map<string, Promise<DayFare[]>>();
  async function askDays(a: PriceAsk): Promise<DayFare[]> {
    const q = `kind=days&from=${a.from}&to=${a.to}&day=${a.day}`;
    let seen: Record<string, { at: number; days: DayFare[] }> = {};
    try {
      seen = (await kv.get<typeof seen>(DAYS_KEY)) ?? {};
    } catch {
      // no storage: asked every time
    }
    const had = seen[q];
    if (had && now() - had.at < DAYS_HOURS * 36e5) return had.days;
    try {
      const res = await get(`${server}/functions/v1/offers?${q}`);
      if (!res.ok) return [];
      const days = validDays(((await res.json()) as { days?: unknown }).days);
      const kept = Object.entries({ ...seen, [q]: { at: now(), days } })
        .filter(([, v]) => now() - v.at < DAYS_HOURS * 36e5)
        .sort((x, y) => y[1].at - x[1].at)
        .slice(0, KEEP_MAX);
      try {
        await kv.set(DAYS_KEY, Object.fromEntries(kept));
      } catch {
        // not kept this time
      }
      return days;
    } catch {
      return [];
    }
  }
  const days = (a: PriceAsk): Promise<DayFare[]> => {
    const k = `${a.from}|${a.to}|${a.day}`;
    const going = daying.get(k) ?? askDays(a).finally(() => daying.delete(k));
    daying.set(k, going);
    return going;
  };

  /** What's on in a city on a stay's days (spec 2026-10-19 SerpApi, item 8), kept a day here (EVENTS_KEY). */
  const eventing = new Map<string, Promise<Offer[]>>();
  async function askEvents(city: string, start: string, end: string): Promise<Offer[]> {
    const q = new URLSearchParams({ kind: "events", city, start, end, lang: lang() }).toString();
    let seen: Record<string, { at: number; offers: Offer[] }> = {};
    try {
      seen = (await kv.get<typeof seen>(EVENTS_KEY)) ?? {};
    } catch {
      // no storage: asked every time
    }
    const had = seen[q];
    if (had && now() - had.at < EVENTS_HOURS * 36e5) return had.offers;
    try {
      const res = await get(`${server}/functions/v1/offers?${q}`);
      if (!res.ok) return [];
      const offers = validOffers(((await res.json()) as { offers?: unknown }).offers, { kind: "activity" });
      const kept = Object.entries({ ...seen, [q]: { at: now(), offers } })
        .filter(([, v]) => now() - v.at < EVENTS_HOURS * 36e5)
        .sort((x, y) => y[1].at - x[1].at)
        .slice(0, KEEP_MAX);
      try {
        await kv.set(EVENTS_KEY, Object.fromEntries(kept));
      } catch {
        // not kept this time
      }
      return offers;
    } catch {
      return [];
    }
  }
  const events = (city: string, start: string, end: string): Promise<Offer[]> => {
    const k = `${city.toLocaleLowerCase("tr")}|${start}|${end}`;
    const going = eventing.get(k) ?? askEvents(city, start, end).finally(() => eventing.delete(k));
    eventing.set(k, going);
    return going;
  };

  return {
    available: () => true,
    offers: (need) => find(need),
    find,
    candidates,
    places,
    price,
    sights,
    days,
    events,
  };
}

/** The Plan's category a question to the server searches for (by its kind); none for a fare's check or a map's place. */
const SECTION_OF_KIND: Record<string, string> = { stay: "stay", flight: "flight", transfer: "transport", activity: "activity", events: "activity", esim: "other", sights: "todo" };

/**
 * The chat's find_offers: real offers for a need, the cheapest or under a ceiling when asked; [] when the sources
 * have none (then the chat says it found none rather than making one up).
 */
export const findOffers = (need: Need, narrow: Narrow = {}): Promise<Offer[]> => liveSource.find(need, narrow);

/** A stay's hotels to choose from (up to six; the priced ones first): [] when the sources have none. */
export const stayCandidates = (need: Need): Promise<StayCandidate[]> => liveSource.candidates(need);

/** Google Maps' places for a search (a place's name and town, or a kind of place): [] when the sources have none. */
export const findPlaces = (search: string): Promise<MapsPlace[]> => liveSource.places(search);
/** A flight's fare judged: Google's usual range and its last weeks, or null (spec 2026-10-19 SerpApi, 2 and 4). */
export const flightPrice = (ask: PriceAsk): Promise<PriceInsight | null> => liveSource.price(ask);

/** A city's sights from Google, or [] (spec 2026-10-19 SerpApi, item 3). */
export const citySights = (city: string, country: string | null = null): Promise<Sight[]> => liveSource.sights(city, country);

/** A route's fares a day either side of three, from the shared flight search, or [] (spec 2026-10-19 SerpApi, 5). */
export const flightDays = (ask: PriceAsk): Promise<DayFare[]> => liveSource.days(ask);

/** What's on in a city on a stay's days, from Google, or [] (spec 2026-10-19 SerpApi, item 8). */
export const cityEvents = (city: string, start: string, end: string): Promise<Offer[]> => liveSource.events(city, start, end);

export const liveSource = makeLiveSource();
