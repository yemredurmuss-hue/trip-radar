// The live source for the empty cards' "✨ Senin için N öneri" row (src/lib/offerSource.ts): asks Trip Radar's
// `offers` function (supabase/functions/offers) for a flight's or a stay's offers, from real sources only
// (Aviasales' cached prices; Tripadvisor's hotels and each platform's price, via Xotelo), the pages already turned
// into partner links there. Only what a search needs leaves the board: the airports or the place, the days and
// the head-count, never a name nor the trip.
//
// Answers are kept here for a few hours per question (chrome.storage), so opening the board again asks nothing.
// Nothing for the other kinds yet (transfers, activities, eSIMs: no source connected), nor when the question is
// short of what a search needs; a failure or an unconfigured server is no offers, so the row stays away.
import { lang } from "../i18n";
import { airportCode } from "../searchLinks";
import { chromeKV, DEFAULT_SERVER, type KV } from "../share/store";
import type { Need, Offer, SuggestionSource } from "../offerSource";

const STORE_KEY = "offersSeen";
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

type Answer = { offers: Offer[]; candidates?: StayCandidate[] };
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
  if (need.kind === "stay") {
    const city = need.city?.trim();
    if (!city || !need.start || !need.end || !DAY.test(need.start) || !DAY.test(need.end) || need.end <= need.start) return null;
    const q: Record<string, string> = { kind: "stay", city, start: need.start, end: need.end, adults, lang: language };
    const country = countryName(need.country);
    if (country) q.country = country;
    return new URLSearchParams(narrowed(q, narrow)).toString();
  }
  return null;
}

/** The live source, with its storage and fetch handed in for the tests; `find` is the chat's way in (find_offers). */
export function makeLiveSource(opts: { kv?: KV; fetcher?: typeof fetch; now?: () => number; server?: string } = {}): SuggestionSource & {
  find(need: Need, narrow?: Narrow): Promise<Offer[]>;
  candidates(need: Need): Promise<StayCandidate[]>;
} {
  const kv = opts.kv ?? chromeKV;
  const get = opts.fetcher ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = opts.now ?? Date.now;
  const server = opts.server ?? DEFAULT_SERVER.url;
  const asking = new Map<string, Promise<Answer>>();

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
      const body = (await res.json()) as { offers?: Offer[]; candidates?: StayCandidate[] };
      const answer: Answer = { offers: Array.isArray(body.offers) ? body.offers : [], ...(Array.isArray(body.candidates) ? { candidates: body.candidates } : {}) };
      const kept = Object.entries({ ...seen, [q]: { at: now(), ...answer } })
        .filter(([, v]) => now() - v.at < KEEP_HOURS * 36e5)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, KEEP_MAX);
      try {
        await kv.set(STORE_KEY, Object.fromEntries(kept));
      } catch {
        // not kept this time
      }
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

  return {
    available: () => true,
    offers: (need) => find(need),
    find,
    candidates,
  };
}

/**
 * The chat's find_offers: real offers for a need, the cheapest or under a ceiling when asked; [] when the sources
 * have none (then the chat says it found none rather than making one up).
 */
export const findOffers = (need: Need, narrow: Narrow = {}): Promise<Offer[]> => liveSource.find(need, narrow);

/** A stay's hotels to choose from (up to six; the priced ones first): [] when the sources have none. */
export const stayCandidates = (need: Need): Promise<StayCandidate[]> => liveSource.candidates(need);

export const liveSource = makeLiveSource();
