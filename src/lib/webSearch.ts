// Web search, the extension's side (supabase/functions/web-search): a short answer grounded in Google Search,
// with its sources. The board chat asks only when it needs a live fact (an event's dates, opening hours, a ferry
// timetable, entry rules) or the traveller says "şunu araştır". Only the question leaves the extension: nothing
// about the person or the rest of the trip. Answers are kept in memory and in IndexedDB as long as the server keeps
// them (event dates 30 days, a fact 7, research 3, "nothing found" 1), so asking again costs nothing.
import { openDB, type IDBPDatabase } from "idb";
import { chromeKV, DEFAULT_SERVER, type KV } from "./share/store";

export type SearchKind = "event_dates" | "fact" | "research";
export const SEARCH_KINDS: readonly SearchKind[] = ["event_dates", "fact", "research"];

export interface SearchSource {
  title: string;
  url: string;
}
export interface EventDates {
  start: string | null;
  end: string | null;
  place: string | null;
  official_url: string | null;
  confidence: "high" | "medium" | "low" | null;
}
/**
 * Why there's no answer: the server has no key (not-configured), the day's searches are used up (capped, or this
 * computer's: limited), nothing was found (no-result), or it didn't answer in time / at all.
 */
export type SearchMiss = "not-configured" | "capped" | "limited" | "no-result" | "timeout" | "network" | "error";

export interface WebSearchResult {
  answer: string | null;
  sources: SearchSource[];
  kind: SearchKind;
  cached: boolean;
  /** When the answer was found (ISO); null when there's none. */
  at: string | null;
  /** event_dates only: the dates read from the answer. */
  event?: EventDates | null;
  reason?: SearchMiss;
}

/** A search the chat may stand behind; any other miss means "can't search right now". */
export const cantSearch = (r: WebSearchResult) => r.answer == null && r.reason !== "no-result";

const FRESH_DAYS: Record<SearchKind, number> = { event_dates: 30, fact: 7, research: 3 };
const MISS_DAYS = 1;
export const TIMEOUT_MS = 8000;

/** The question as the server keys it: trimmed, lower case, one space, at most 200 characters. */
export const normalizeQuery = (q: string) => q.trim().toLowerCase().replace(/\u0307/g, "").replace(/\s+/g, " ").slice(0, 200).trim();
const keyOf = (kind: SearchKind, q: string, year: number | null) => `${kind}|${year ?? 0}|${normalizeQuery(q)}`;

export interface SearchCache {
  get(key: string): Promise<{ result: WebSearchResult; savedAt: number } | undefined>;
  set(key: string, value: { result: WebSearchResult; savedAt: number }): Promise<void>;
}

const memory = new Map<string, { result: WebSearchResult; savedAt: number }>();
let dbPromise: Promise<IDBPDatabase> | null = null;
/** Answers kept across sessions: a database of their own (the main one's version is left alone). */
export const idbCache: SearchCache = {
  async get(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      dbPromise ??= openDB("trip-radar-search", 1, { upgrade: (d) => void d.createObjectStore("answers") });
      const hit = (await (await dbPromise).get("answers", key)) as { result: WebSearchResult; savedAt: number } | undefined;
      if (hit) memory.set(key, hit);
      return hit;
    } catch {
      return undefined;
    }
  },
  async set(key, value) {
    memory.set(key, value);
    try {
      dbPromise ??= openDB("trip-radar-search", 1, { upgrade: (d) => void d.createObjectStore("answers") });
      await (await dbPromise).put("answers", value, key);
    } catch {
      // memory only (a private window, no IndexedDB)
    }
  },
};

const INSTALL_KEY = "installId";
/** This computer's install id (a random UUID made once): the server counts searches per install with it. */
export async function installId(kv: KV = chromeKV): Promise<string | null> {
  try {
    const had = await kv.get<string>(INSTALL_KEY);
    if (typeof had === "string" && had) return had;
    const id = crypto.randomUUID();
    await kv.set(INSTALL_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export interface SearchOptions {
  kind?: SearchKind;
  lang?: "tr" | "en";
  year?: number | null;
  fetch?: typeof fetch;
  cache?: SearchCache | null;
  kv?: KV;
  timeoutMs?: number;
  now?: () => number;
}

const miss = (kind: SearchKind, reason: SearchMiss): WebSearchResult => ({ answer: null, sources: [], kind, cached: false, at: null, reason });
const REASONS: readonly SearchMiss[] = ["not-configured", "capped", "limited", "no-result", "timeout", "network", "error"];

function readSources(raw: unknown): SearchSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is { title?: unknown; url: string } => typeof s?.url === "string" && /^https?:\/\//.test(s.url))
    .map((s) => ({ title: typeof s.title === "string" ? s.title : "", url: s.url }))
    .slice(0, 5);
}

/** Asks the server; never throws. A miss says why (reason). */
export async function webSearch(q: string, opts: SearchOptions = {}): Promise<WebSearchResult> {
  const kind = opts.kind && SEARCH_KINDS.includes(opts.kind) ? opts.kind : "fact";
  const year = typeof opts.year === "number" && Number.isInteger(opts.year) ? opts.year : null;
  const question = q.trim().slice(0, 200);
  if (question.length < 2) return miss(kind, "error");
  const now = opts.now ?? Date.now;
  const cache = opts.cache === undefined ? idbCache : opts.cache;
  const key = keyOf(kind, question, year);
  const hit = await cache?.get(key);
  if (hit && (now() - hit.savedAt) / 864e5 < (hit.result.answer ? FRESH_DAYS[kind] : MISS_DAYS)) return { ...hit.result, cached: true };

  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: DEFAULT_SERVER.anonKey };
  if (DEFAULT_SERVER.anonKey.startsWith("eyJ")) headers.Authorization = `Bearer ${DEFAULT_SERVER.anonKey}`;
  const id = await installId(opts.kv);
  if (id) headers["x-install-id"] = id;
  let body: any;
  try {
    const res = await (opts.fetch ?? fetch)(`${DEFAULT_SERVER.url}/functions/v1/web-search`, {
      method: "POST",
      headers,
      body: JSON.stringify({ q: question, lang: opts.lang ?? "tr", kind, ...(year ? { year } : {}) }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    });
    // Not deployed yet (404) is the same as no key: the chat says it can't search.
    if (res.status === 404) return miss(kind, "not-configured");
    try {
      body = await res.json();
    } catch {
      return miss(kind, "error");
    }
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    return miss(kind, name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
  }
  const answer = typeof body?.answer === "string" && body.answer.trim() ? body.answer.trim() : null;
  if (!answer) {
    const reason: SearchMiss = REASONS.includes(body?.reason) ? body.reason : "error";
    const result = { ...miss(kind, reason), at: typeof body?.at === "string" ? body.at : null };
    if (reason === "no-result") await cache?.set(key, { result, savedAt: now() });
    return result;
  }
  const result: WebSearchResult = {
    answer,
    sources: readSources(body.sources),
    kind,
    cached: Boolean(body.cached),
    at: typeof body.at === "string" ? body.at : new Date(now()).toISOString(),
    ...(kind === "event_dates" ? { event: body.event ?? null } : {}),
  };
  await cache?.set(key, { result, savedAt: now() });
  return result;
}

/** A source's name for the reply: "uefa.com" (its title when that's a site name, else the link's host). */
export function siteName(s: SearchSource): string {
  const title = s.title.trim();
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(title)) return title.toLowerCase().replace(/^www\./, "");
  try {
    const host = new URL(s.url).hostname.replace(/^www\./, "");
    return /(^|\.)vertexaisearch\.cloud\.google\.com$/.test(host) && title ? title : host;
  } catch {
    return title;
  }
}
