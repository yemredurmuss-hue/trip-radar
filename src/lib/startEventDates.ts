// An event's dates looked up live in the start chat (2026-10-07, spec 2026-10-06-niyet-planlayici "Bölüm 3"): once
// the chat knows the traveller is going to an event (the table's, or one the model read), one web search asks for
// its dates that year (webSearch, kind event_dates; cached on the server and here for 30 days). It runs in the
// background: the chat and the countdown never wait for it. What comes back is used only when it is sure enough:
// read from the official site (high: the dates are no longer "tahmini"), or likely (medium: taken, but said and
// labelled "teyitsiz"). Anything else (no answer, the day's searches used up, a timeout, a low confidence, dates that
// make no sense) leaves the table's dates as they were, "tahmini" with the official link, and nothing is said.
//
// Dates the traveller gave are never changed: their own event dates mean no look-up at all, and a start of their own
// stays (the trip's days follow the event only when they were worked out from it); when the event's real dates miss
// theirs, the chat says so once and the existing clash question asks what to do. A result that lands after the trip
// started being made is dropped (the chat is gone by then; the cached answer serves the next time).
//
// Only the event's name and the year leave the extension (webSearch). Pure but for startLookup (which starts the
// search); the chat screen fires it and applies what comes back.
import { L } from "./i18n";
import { formatDateRange, isoDate } from "./items";
import { daysBetween, type Intent } from "./startEvents";
import { eventClash, nextQuestion, questionOf, withIntent, type StartCtx, type StartState } from "./startTrip";
import { siteName, webSearch, type SearchOptions, type WebSearchResult } from "./webSearch";

/** One look-up: an event's dates in a year (its key: the same event and year are searched once). */
export interface DatesLookup {
  key: string;
  name: string;
  year: number;
  /** The question sent: "AfrikaBurn 2027 dates". */
  query: string;
}

/** The longest an event can run (as for the model's own event dates). */
const MAX_DAYS = 60;

/**
 * The look-up the chat's intent calls for, or null: an event with a name, not looked up yet, whose dates the
 * traveller didn't give themselves (dates not approx, never checked: they confirmed or changed them). Its year: the
 * one said with it, else its dates', else this year's.
 */
export function lookupFor(s: Pick<StartState, "intent">, today: string): DatesLookup | null {
  const it = s.intent;
  if (!it || it.kind !== "event" || it.checked) return null;
  if (it.dates && !it.dates.approx) return null;
  // "AfrikaBurn 2028" named with its year: the year asked on its own.
  const name = it.name.replace(/\s+(19|20)\d{2}$/, "").trim();
  if (name.length < 2) return null;
  const year = it.year ?? (it.dates ? Number(it.dates.start.slice(0, 4)) : Number(today.slice(0, 4)));
  return { key: `${name.toLowerCase()}|${year}`, name, year, query: `${name} ${year} dates` };
}

export type Searcher = (q: string, opts: SearchOptions) => Promise<WebSearchResult>;

/**
 * The look-up to start now and its search, or null: at most one per event and year (`asked` keeps the keys started,
 * for as long as the chat is open; webSearch also joins the same search already on its way).
 */
export function startLookup(s: Pick<StartState, "intent" | "lang">, today: string, asked: Set<string>, search: Searcher = webSearch): { look: DatesLookup; job: Promise<WebSearchResult> } | null {
  const look = lookupFor(s, today);
  if (!look || asked.has(look.key)) return null;
  asked.add(look.key);
  return { look, job: search(look.query, { kind: "event_dates", year: look.year, lang: s.lang }) };
}

/** How long the countdown before the trip makes itself waits for the dates, from when the intent was known. */
export const DATES_WAIT_MS = 12_000;

/**
 * The countdown's wait for the dates (2026-10-07): until the search settles (at once for a cached answer) or `ms`
 * have passed, whichever comes first; never rejects. After it, the countdown goes on as before (a late answer is
 * dropped once the trip is being made). "Oluştur" pressed never waits.
 */
export function datesWait(job: Promise<unknown>, ms = DATES_WAIT_MS): Promise<"answered" | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<"timeout">((resolve) => (timer = setTimeout(() => resolve("timeout"), ms)));
  const settled = job.then(() => "answered" as const, () => "answered" as const);
  return Promise.race([settled, cap]).finally(() => clearTimeout(timer));
}

/** The step line while it runs (v5): "2027 tarihlerini resmî siteden kontrol ediyorum…". */
export const checkingLine = (look: DatesLookup) => L(`${look.year} tarihlerini resmî siteden kontrol ediyorum…`, `Checking the ${look.year} dates on the official site…`);

export interface LiveDates {
  start: string;
  end: string;
  /** Read from the official site (high); else likely (medium). */
  sure: boolean;
  /** The site's name said with them ("afrikaburn.org"). */
  site: string | null;
  /** The official site's link, when the answer gave one. */
  url: string | null;
}

/**
 * The dates an answer gives, or null when there are none to stand behind: no answer, a low (or no) confidence, dates
 * that aren't days, end before start, longer than MAX_DAYS, another year than the one asked, or already over.
 */
export function readLiveDates(r: WebSearchResult, look: DatesLookup, today: string): LiveDates | null {
  const ev = r.answer ? r.event : null;
  if (!ev || (ev.confidence !== "high" && ev.confidence !== "medium")) return null;
  const start = ev.start && isoDate(ev.start) ? ev.start : null;
  const end = ev.end && isoDate(ev.end) ? ev.end : start;
  if (!start || !end || end < start || daysBetween(start, end) > MAX_DAYS) return null;
  if (start.slice(0, 4) !== String(look.year) || end < today) return null;
  const official = typeof ev.official_url === "string" && /^https:\/\//.test(ev.official_url) ? ev.official_url : null;
  const source = official ? { title: "", url: official } : (r.sources[0] ?? null);
  return { start, end, sure: ev.confidence === "high", site: source ? siteName(source) || null : null, url: official };
}

/** "17–23 Temmuz 2027". */
const rangeWithYear = (start: string, end: string) => `${formatDateRange(start, end)} ${end.slice(0, 4)}`;

/**
 * The answer applied to the chat (in the chat's language: called inside withLang). The same state when there's
 * nothing to take (the intent changed meanwhile, the answer isn't sure enough); else the intent's dates replaced
 * (the trip's days and its route follow unless the traveller gave their start) and one line said: what was found and
 * where, the clash with the traveller's dates when it just began, and the question again when it changed.
 */
export function applyLiveDates(s: StartState, look: DatesLookup, r: WebSearchResult, ctx: StartCtx, now: number): StartState {
  const it = s.intent;
  if (!it || lookupFor(s, ctx.today)?.key !== look.key) return s;
  const got = readLiveDates(r, look, ctx.today);
  if (!got) return s;
  // On now: its days from today, as the table's.
  const running = got.start < ctx.today;
  const intent: Intent = {
    ...it,
    dates: { start: running ? ctx.today : got.start, end: got.end, approx: !got.sure },
    running,
    checked: { sure: got.sure, site: got.site, url: got.url },
    url: got.url ?? it.url ?? null,
    year: look.year,
  };
  const asked = nextQuestion(s);
  const after = withIntent(s, intent, now);
  const range = rangeWithYear(got.start, got.end);
  const from = got.site ? ` (${got.site})` : "";
  const words = [
    got.sure
      ? L(`Resmî siteden teyit ettim: ${range}${from}.`, `Checked on the official site: ${range}${from}.`)
      : L(`${look.name} ${look.year} için ${range} görünüyor, henüz kesin değil${got.site ? ` (kaynak: ${got.site})` : ""}.`, `${look.name} ${look.year} looks like ${range}, not confirmed yet${got.site ? ` (source: ${got.site})` : ""}.`),
  ];
  // Their own dates miss the event's real ones: said once (the clash question asks what to do).
  if (eventClash(after) && !eventClash(s)) words.push(L("Senin tarihlerin bu günlere denk gelmiyor.", "Your dates don't meet these days."));
  let line = words.join(" ");
  // The question on screen changed (another one, or its words: the event's length, its hint): asked again under it,
  // unless a reply to the traveller's last line is still coming (it asks).
  const q = nextQuestion(after);
  if (q && s.messages.at(-1)?.role === "assistant") {
    const was = asked ? questionOf(s, asked, ctx).text : null;
    const is = questionOf(after, q, ctx).text;
    if (q !== asked || was !== is) line += `\n${is}`;
  }
  const link = got.url ?? undefined;
  return {
    ...after,
    messages: [...after.messages, { role: "assistant", text: line, at: now, id: `${now.toString(36)}-dates`, ...(link ? { link } : {}) }],
    updatedAt: now,
  };
}
