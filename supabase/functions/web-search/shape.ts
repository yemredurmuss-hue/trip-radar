// The web-search function's rules (Trip Radar), kept free of Deno and Supabase so they're tested with the
// extension's own tests (tests/webSearchShape.test.ts): what may be asked, how long an answer stays good, the
// prompt sent to Gemini, and Gemini's answer read into { answer, sources, event }.

export const KINDS = ["event_dates", "fact", "research"] as const;
export type SearchKind = (typeof KINDS)[number];

export interface Source {
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
export interface Shaped {
  /** null: the search found nothing usable. */
  answer: string | null;
  sources: Source[];
  event: EventDates | null;
}

/** The question as it's cached: trimmed, lower case ("İ" → "i", no dot left over), one space between words, at most 200 characters. */
export function normalizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase().replace(/\u0307/g, "").replace(/\s+/g, " ").slice(0, 200).trim();
}

export const kindOf = (raw: unknown): SearchKind => ((KINDS as readonly unknown[]).includes(raw) ? (raw as SearchKind) : "fact");
export const langOf = (raw: unknown): "tr" | "en" => (raw === "en" ? "en" : "tr");
/** A year said with the question (an edition: "Ozora 2027"); 0 when none (the cache key's "no year"). */
export function yearOf(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : 0;
}

/** Days an answer stays good: event dates 30, a fact 7, research 3; "nothing found" 1 whatever the kind. */
export const FRESH_DAYS: Record<SearchKind, number> = { event_dates: 30, fact: 7, research: 3 };
export const MISS_DAYS = 1;
export const freshDays = (kind: SearchKind, found: boolean) => (found ? FRESH_DAYS[kind] : MISS_DAYS);

export const DEFAULT_DAILY_CAP = 150;
export const PER_CALLER_DAILY = 30;
/** SEARCH_DAILY_CAP when it's a positive whole number, else 150. */
export function dailyCap(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_CAP;
}

/** The extension's install id (a random UUID it keeps), when the header carries one. */
export const installIdOf = (raw: string | null): string | null =>
  raw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.trim()) ? raw.trim().toLowerCase() : null;

/** What the model is told to write when the search found nothing. */
export const NOT_FOUND = "NOT_FOUND";

/** The one prompt sent with the google_search tool. Only the question goes: nothing about the person or the trip. */
export function searchPrompt(q: string, kind: SearchKind, lang: "tr" | "en", year: number, today: string): string {
  const language = lang === "en" ? "English" : "Turkish";
  const lines = [
    `Today is ${today}. Search the web and answer in ${language}, briefly: one short paragraph or a compact list of at most 5 lines.`,
    "State only what the sources say. Never guess a date, a time or a price. Prefer official sources (the organiser, the operator, the government).",
    `If the sources don't answer it, write exactly ${NOT_FOUND} and nothing else.`,
  ];
  if (kind === "event_dates") {
    lines.push(
      `It's about the dates of an event${year ? ` in ${year}` : " (its next edition)"}. After the answer, add one fenced block:`,
      '```json\n{"start":"YYYY-MM-DD or null","end":"YYYY-MM-DD or null","place":"town, country or null","official_url":"https://… or null","confidence":"high|medium|low"}\n```',
      "Use null for anything not announced yet; confidence is high only when the organiser's own site gives the dates.",
    );
  } else if (year) {
    lines.push(`The year that matters is ${year}.`);
  }
  if (kind === "research") lines.push("Give the few facts a traveller needs to plan it (where, when, how to get there, what to book ahead).");
  lines.push(`Question: ${q}`);
  return lines.join("\n");
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim().slice(0, max) : null);
const httpUrl = (v: unknown): string | null => {
  const s = str(v, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** The event block the model was asked for; null when there's none or it says nothing. */
export function readEvent(text: string): EventDates | null {
  const m = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i) ?? text.match(/(\{[^{}]*"start"[^{}]*\})/);
  if (!m) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const day = (v: unknown) => {
    const s = str(v, 10);
    return s && ISO_DAY.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
  };
  const start = day(raw.start);
  const end = day(raw.end);
  const confidence = raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low" ? raw.confidence : null;
  const event: EventDates = { start, end: end && start && end < start ? null : end, place: str(raw.place), official_url: httpUrl(raw.official_url), confidence };
  return event.start || event.end || event.place || event.official_url ? event : null;
}

/** The answer without its JSON block, and nothing when it's the "not found" word or empty. */
function cleanAnswer(text: string): string | null {
  const t = text
    .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!t || t.replace(/[.\s]/g, "").toUpperCase() === NOT_FOUND) return null;
  return t.slice(0, 1200);
}

/** A source's name: its title when it's a site name ("uefa.com"), else the link's host without "www.". */
export function siteName(s: Source): string {
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s.title.trim())) return s.title.trim().toLowerCase().replace(/^www\./, "");
  try {
    const host = new URL(s.url).hostname.replace(/^www\./, "");
    // Gemini's grounding links go through a Google redirect: the title is the site then.
    if (/(^|\.)vertexaisearch\.cloud\.google\.com$/.test(host)) return s.title.trim() || host;
    return host;
  } catch {
    return s.title.trim();
  }
}

function addSource(out: Source[], url: unknown, title: unknown) {
  const u = httpUrl(url);
  if (!u || out.some((s) => s.url === u)) return;
  out.push({ title: str(title) ?? new URL(u).hostname.replace(/^www\./, ""), url: u });
}

/**
 * Gemini's answer read the same way whichever API gave it: the Interactions API (steps[] → model_output with
 * url_citation annotations, or outputs[] in its earlier shape) or generateContent (candidates[0] with
 * groundingMetadata.groundingChunks[].web).
 */
export function shapeAnswer(body: unknown): Shaped {
  const b = (body ?? {}) as Record<string, any>;
  const texts: string[] = [];
  const sources: Source[] = [];
  const blocks: any[] = [];
  for (const step of Array.isArray(b.steps) ? b.steps : []) if (step?.type === "model_output" && Array.isArray(step.content)) blocks.push(...step.content);
  for (const out of Array.isArray(b.outputs) ? b.outputs : []) blocks.push(out);
  for (const block of blocks) {
    if (block?.type !== "text" || typeof block.text !== "string") continue;
    texts.push(block.text);
    for (const a of Array.isArray(block.annotations) ? block.annotations : []) if (a?.type === "url_citation") addSource(sources, a.url, a.title);
  }
  const cand = Array.isArray(b.candidates) ? b.candidates[0] : null;
  if (cand) {
    for (const p of Array.isArray(cand.content?.parts) ? cand.content.parts : []) if (typeof p?.text === "string" && !p.thought) texts.push(p.text);
    for (const c of Array.isArray(cand.groundingMetadata?.groundingChunks) ? cand.groundingMetadata.groundingChunks : []) addSource(sources, c?.web?.uri, c?.web?.title);
  }
  const text = texts.join("").trim();
  const event = readEvent(text);
  const answer = cleanAnswer(text);
  return { answer, sources: answer ? sources.slice(0, 5) : [], event: answer ? event : null };
}
