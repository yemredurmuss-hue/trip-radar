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

type Seen = Record<string, { at: number; offers: Offer[] }>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const countryName = (code: string | null | undefined): string | null => {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
};

/** The function's question for a need, or null when it can't be searched (or its kind has no source yet). */
export function queryOf(need: Need, language: "tr" | "en" = lang()): string | null {
  const adults = String(Math.min(9, Math.max(1, Math.round(need.adults ?? 1))));
  if (need.kind === "flight") {
    const from = need.fromCode ?? airportCode(need.from);
    const to = need.toCode ?? airportCode(need.to);
    if (!from || !to || from === to || !need.start || !DAY.test(need.start)) return null;
    return new URLSearchParams({ kind: "flight", from, to, day: need.start, adults, lang: language }).toString();
  }
  if (need.kind === "stay") {
    const city = need.city?.trim();
    if (!city || !need.start || !need.end || !DAY.test(need.start) || !DAY.test(need.end) || need.end <= need.start) return null;
    const q: Record<string, string> = { kind: "stay", city, start: need.start, end: need.end, adults, lang: language };
    const country = countryName(need.country);
    if (country) q.country = country;
    return new URLSearchParams(q).toString();
  }
  return null;
}

/** The live source, with its storage and fetch handed in for the tests. */
export function makeLiveSource(opts: { kv?: KV; fetcher?: typeof fetch; now?: () => number; server?: string } = {}): SuggestionSource {
  const kv = opts.kv ?? chromeKV;
  const get = opts.fetcher ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = opts.now ?? Date.now;
  const server = opts.server ?? DEFAULT_SERVER.url;
  const asking = new Map<string, Promise<Offer[]>>();

  async function ask(q: string): Promise<Offer[]> {
    let seen: Seen = {};
    try {
      seen = (await kv.get<Seen>(STORE_KEY)) ?? {};
    } catch {
      // no storage: asked every time
    }
    const had = seen[q];
    if (had && now() - had.at < KEEP_HOURS * 36e5) return had.offers;
    try {
      const res = await get(`${server}/functions/v1/offers?${q}`);
      if (!res.ok) return [];
      const body = (await res.json()) as { offers?: Offer[] };
      const offers = Array.isArray(body.offers) ? body.offers : [];
      const kept = Object.entries({ ...seen, [q]: { at: now(), offers } })
        .filter(([, v]) => now() - v.at < KEEP_HOURS * 36e5)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, KEEP_MAX);
      try {
        await kv.set(STORE_KEY, Object.fromEntries(kept));
      } catch {
        // not kept this time
      }
      return offers;
    } catch {
      return [];
    }
  }

  return {
    available: () => true,
    offers(need) {
      const q = queryOf(need);
      if (!q) return Promise.resolve([]);
      // The same question asked by two cards at once goes out once.
      const going = asking.get(q) ?? ask(q).finally(() => asking.delete(q));
      asking.set(q, going);
      return going;
    },
  };
}

export const liveSource: SuggestionSource = makeLiveSource();
