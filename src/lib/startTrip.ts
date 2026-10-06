// Starting a trip by chat (spec 2026-10-06 §2): a short interview — where, where from, who, when (length and
// start asked apart), what they're after, the route — that the code runs. Each question comes with quick
// answers, "Atla" and free typing; one message can fill several answers at once ("Sabine'yle 10 Aralık'tan
// 1 ay Bali"). The model reads free text into a strict shape when there is one; without it (no key, the AI
// gate closed) the code reads dates, lengths, a few places, "partnerimle"... itself, and the interview works
// the same. Nothing here touches storage: the screen (app/start) keeps the state, startDrafts.ts saves it,
// startCreate.ts builds the trip from it. Pure.
//
// Revision 2 (2026-10-06): the chat speaks the language of its first typed message (state.lang, every line made
// inside withLang); an answer fills the question it answers ("İstanbul" to "Nereden?" is where from, never where
// to); the most specific place said wins ("Tayland Kohphandan" → Koh Phangan, Thailand), spelled loosely; a trip
// can be made as soon as the destination is known; the model writes the replies (one call per message, read and
// reply together) over the code's lines; photos, the route and the rules' suggestions are prepared in the draft
// while chatting (state.prepared), so "Oluştur" mostly writes what is there.
import { z } from "zod";
import { L, lang, type Lang } from "./i18n";
import { formatDateRange, isoDate, nightsBetween } from "./items";
import { placesKey } from "./destinations";
import { addDays, cityKeyOf } from "./plan";
import { looksLikeUrl } from "./url";
import type { PlannedInput } from "./planned";
import { CIRCUITS, englishName, fitCircuit } from "./startCircuits";
import { STYLES, type BudgetLevel, type StyleId } from "./tripStyle";
import type { ChatMessage, Item, Trip } from "./types";

// --- the state -----------------------------------------------------------------------------------------

/** How the interview was started (the home's chips): the order and the quick answers follow it. */
export type StartMode = "plan" | "inspire" | "road" | "lastminute";
/** "guess": a place read from a loose spelling, asked back before it is taken ("Koh Phangan mı demek istedin?"). */
export type QuestionId = "where" | "from" | "who" | "names" | "duration" | "start" | "day" | "want" | "route" | "guess";
/** Which part of a month a start chip took: never a day made up without saying so. */
export type MonthPart = "begin" | "mid" | "end";
export interface StartDay {
  date: string;
  /** Not a day the traveller gave: a month only (asked next), or a part of it (said back in the chat). */
  approx: boolean;
  /** The part of the month a chip took ("Ortası" → the 15th). */
  part?: MonthPart | null;
}
/** The checklist's six rows. */
export type SlotId = "where" | "from" | "who" | "when" | "want" | "route";
export type Companions = "solo" | "partner" | "friends" | "family";
export type DurationUnit = "day" | "night" | "week" | "month" | "weekend";

export interface Duration {
  unit: DurationUnit;
  n: number;
}
export interface RouteStop {
  city: string;
  nights: number;
  /** The stop's country (ISO 3166-1 alpha-2) when the route says it; else the destination's. */
  code?: string | null;
}
/** A place said: its name, its country's name and code (ISO 3166-1 alpha-2), when known. */
export interface Place {
  place: string;
  country: string | null;
  code?: string | null;
}
export interface StartRoute {
  stops: RouteStop[];
  /** Where the flight in lands and the one out leaves, when it isn't the first/last stop ("Denpasar" for Ubud). */
  arrive: string | null;
  leave: string | null;
  /** "Bu olsun" pressed (or typed by the traveller), or "Oluştur" pressed with it: only then is it built as more than one stop. */
  confirmed: boolean;
  /** The model's proposal, the traveller's own, one stop, or the classic circuit for the country (rev 3: at once, no model). */
  source: "ai" | "user" | "single" | "circuit";
}
export interface StartMsg {
  role: "user" | "assistant";
  text: string;
  at: number;
  /** Stable while the line is said again in other words (the screen keys it by this; older drafts have none). */
  id?: string;
}

export interface StartState {
  id: string;
  mode: StartMode;
  where: Place | null;
  from: string | null;
  who: { kind: Companions | null; names: string[] } | null;
  duration: Duration | null;
  start: StartDay | null;
  styles: StyleId[];
  budget: BudgetLevel | null;
  /** "Ne istiyorsun" answered (styles and budget may still be empty: "Tamam" with nothing picked). */
  wantDone: boolean;
  /** The proposed or agreed route; null until where and how long are known. */
  route: StartRoute | null;
  /** "Değiştir" pressed: the route question asks for the stops in words. */
  editingRoute: boolean;
  skipped: QuestionId[];
  /** A row of the checklist pressed: that question is asked again. */
  asking: QuestionId | null;
  /** A place read from a loose spelling, waiting for "Evet" or "Hayır" (never taken silently). */
  guess?: PlaceGuess | null;
  messages: StartMsg[];
  /** The trip record once made: a retry after a failed step continues it, never makes a second trip. */
  tripId: string | null;
  /** The language the chat speaks: its first typed message's, else the board's (a chip start) until one is typed. */
  lang: Lang;
  /** A typed message decided the language (the first one does; a chip's label never does). */
  langFixed: boolean;
  /** Made while chatting (item 7), kept only here (the draft): never a trip, never in a list, the sync or an export. */
  prepared: Prepared;
  createdAt: number;
  updatedAt: number;
}

/** What is prepared while the interview goes on, so "Oluştur" writes it instead of waiting for it. */
export interface Prepared {
  /** Photos looked for (the city-image proxy), by place name (null: none found), for the destination `for` (whereKey). */
  photos: { for: string; urls: Record<string, string | null> } | null;
  /** Route proposals asked, by routeKey ("kohphangan|TH|31"): each asked once; another place or length asks anew. */
  routes: Record<string, StartRoute | null>;
  /** The rules' suggestions for what would be made (their titles), for `key` (what would be made, in short). */
  rules: { key: string; titles: string[] } | null;
}
export const noPrep = (): Prepared => ({ photos: null, routes: {}, rules: null });

export function newStart(id: string, mode: StartMode, now: number, l: Lang = lang()): StartState {
  return {
    id, mode, where: null, from: null, who: null, duration: null, start: null, styles: [], budget: null, wantDone: false,
    route: null, editingRoute: false, skipped: [], asking: null, guess: null, messages: [], tripId: null, lang: l, langFixed: false, prepared: noPrep(),
    createdAt: now, updatedAt: now,
  };
}

// --- the chat's language --------------------------------------------------------------------------------------

/**
 * Turkish words a message is likely to have even typed without its letters ("gitmek", "ile"). Never right after an
 * apostrophe ("we've" is not "ve"); none that are also common in English or too short to tell ("ve", "ay", "gun").
 */
const TR_WORDS =
  /(?<![\p{L}'’])(ile|bir|aylık|gün|gece|hafta|için|icin|gitmek|gitmeyi|gidelim|gidiyoruz|gideceğiz|düşünüyorum|dusunuyorum|istiyoruz|istiyorum|beraber|birlikte|nereye|nereden|tatil|tatile|gezi|sevgilimle|eşimle|ailemle|arkadaşlarla|yalnız|olsun|evet|hayır|tamam|civarı|civarları|aslında|değil|ama|çok|cok|biz|ben|sonra|önce)(?![\p{L}'’])/giu;
/** English words that tell English apart from a bare name ("Bali" says nothing). */
const EN_WORDS =
  /(?<![\p{L}'’])(the|a|an|to|with|and|for|from|want|wants|wanted|wanna|going|go|goes|fly|flying|trip|weeks?|days?|nights?|months?|we|i|i'm|my|our|us|in|of|at|around|about|thinking|planning|yes|no|just|me|partner|friends|family|always|got|have|has|would|like|love|visit|visiting|travel|travelling|traveling|holiday|vacation|next|this|is|are|be|it|there|then|instead|how|make|actually|maybe|live|not)(?![\p{L}'’])/giu;
/** A Turkish ending after an apostrophe ("Bali'ye", "İstanbul'dan"); English endings ("I've", "we're", "Bali's") are not. */
const TR_SUFFIX = /\p{L}['’](d[ae]n|t[ae]n|y?[ae]|d[ae]|t[ae]|y?l[ae]|n[ae]|n[ıiuü]n|y[ıiuü])(?![\p{L}])/gu;
const EN_SUFFIX = /\p{L}['’](ve|re|ll|m|d|s|t)(?![\p{L}])/giu;

/**
 * The language a message shows, weighed: English words and endings against Turkish words, endings and Turkish
 * letters in words that aren't capitalised (a name like "İstanbul" or "Şule" in an English line says nothing).
 * Null when it can't tell ("Bali") or it's even.
 */
export function langSignal(text: string): Lang | null {
  const count = (re: RegExp) => text.match(re)?.length ?? 0;
  const letters = text.split(/[^\p{L}'’]+/u).filter((w) => /[çğıöşü]/.test(w) && !/^\p{Lu}/u.test(w)).length;
  const tr = count(TR_WORDS) + 2 * count(TR_SUFFIX) + letters;
  const en = count(EN_WORDS) + count(EN_SUFFIX);
  if (tr > en) return "tr";
  if (en > tr) return "en";
  return null;
}

/**
 * The first message's language: Turkish when it shows any sign of it, English when it shows English words; a bare
 * name ("Lizbon", "Bali") says neither, and the board's language stands.
 */
export const detectLang = (text: string, fallback: Lang = lang()): Lang => langSignal(text) ?? fallback;

/**
 * A typed message, before it is added: the first one that shows its language decides the chat's (a bare name like
 * "Lizbon" doesn't, nor a chip's label: the board's language until then). Then it stays.
 */
export function withTypedLang(s: StartState, text: string): StartState {
  if (s.langFixed) return s;
  const said = langSignal(text);
  if (!said) return s;
  return { ...s, lang: said, langFixed: true };
}

/** What the screen knows besides the interview: the traveller's name, a guess of where they leave from, today. */
export interface StartCtx {
  myName: string | null;
  fromGuess: string | null;
  today: string;
}

// --- dates and lengths -------------------------------------------------------------------------------------

export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const total = m - 1 + n;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * Nights a length stands for (a month, when the start isn't known yet, is 30). Days are counted the way the
 * board's hero counts them, first and last day included: "10 gün" is 9 nights and the hero then says "10 gün";
 * a week is 7 nights, "10 gece" 10 nights.
 */
export function roughNights(d: Duration): number {
  if (d.unit === "weekend") return 2;
  if (d.unit === "week") return 7 * d.n;
  if (d.unit === "month") return 30 * d.n;
  if (d.unit === "night") return d.n;
  return Math.max(1, d.n - 1);
}

/** The last day (check-out) for a start and a length: a month is a calendar month ("10 Ara – 10 Oca"). */
export function endOf(start: string, d: Duration): string {
  return d.unit === "month" ? addMonths(start, d.n) : addDays(start, roughNights(d));
}

export function totalNights(s: Pick<StartState, "duration" | "start">): number | null {
  if (!s.duration) return null;
  return s.start ? nightsBetween(s.start.date, endOf(s.start.date, s.duration)) : roughNights(s.duration);
}

export function tripDates(s: Pick<StartState, "duration" | "start">): { start: string; end: string } | null {
  return s.duration && s.start ? { start: s.start.date, end: endOf(s.start.date, s.duration) } : null;
}

const MONTHS_TR = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_NAMES_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (m: number) => L(MONTH_NAMES_TR[m - 1], MONTH_NAMES_EN[m - 1]);

/** The question particle after a name, by its last vowel: "Antalya mı", "Koh Phangan mı", "Berlin mi", "Porto mu", "Köln mü". */
export function questionParticle(name: string): string {
  const last = [...name.toLocaleLowerCase("tr")].reverse().find((ch) => /[aeıioöuü]/.test(ch));
  return last === "e" || last === "i" ? "mi" : last === "o" || last === "u" ? "mu" : last === "ö" || last === "ü" ? "mü" : "mı";
}

/** "aralık", "ara", "december", "dec" → 12; null for anything else (3 letters at least, so "ay" isn't May). */
export function monthOf(token: string): number | null {
  const t = token.toLocaleLowerCase("tr");
  if (t.length < 3) return null;
  for (let i = 0; i < 12; i++) {
    if (MONTHS_TR[i] === t || MONTHS_EN[i] === t) return i + 1;
    // An abbreviation: the first 3+ letters of a month ("ara", "dec", "sept"), never a word that only starts like one.
    if ((MONTHS_TR[i].startsWith(t) || MONTHS_EN[i].startsWith(t)) && t.length <= 4 && t.length >= 3) return i + 1;
  }
  return null;
}

/** The next time this month/day comes, from today on (this year's if it hasn't passed). */
export function nextDate(month: number, day: number, today: string, year?: number): string | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (year) return isoDate(`${year}-${pad(month)}-${pad(day)}`);
  const y = Number(today.slice(0, 4));
  const first = isoDate(`${y}-${pad(month)}-${pad(day)}`);
  if (first && first >= today) return first;
  return isoDate(`${y + 1}-${pad(month)}-${pad(day)}`);
}

/** The 1st of the month the next time it comes (this month counts while it's not half gone). */
export function monthStart(month: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (month === m) return d <= 15 ? addDays(today, 7) : `${y + 1}-${pad(month)}-01`;
  return `${month > m ? y : y + 1}-${pad(month)}-01`;
}

/** The coming Friday (today when it is Friday or Saturday), or the one a week after. */
export function weekendStart(today: string, next = false): string {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun … 5 Fri, 6 Sat
  const toFriday = day === 5 ? 0 : day === 6 ? -1 : (5 - day + 7) % 7;
  return addDays(today, toFriday + (next ? 7 : 0));
}

export function durationText(d: Duration): string {
  if (d.unit === "weekend") return L("Hafta sonu", "A weekend");
  if (d.unit === "week") return d.n === 1 ? L("1 hafta", "1 week") : L(`${d.n} hafta`, `${d.n} weeks`);
  if (d.unit === "month") return d.n === 1 ? L("1 ay", "1 month") : L(`${d.n} ay`, `${d.n} months`);
  if (d.unit === "night") return L(`${d.n} gece`, d.n === 1 ? "1 night" : `${d.n} nights`);
  return L(`${d.n} gün`, d.n === 1 ? "1 day" : `${d.n} days`);
}

// --- places --------------------------------------------------------------------------------------------------

interface KnownPlace {
  tr: string;
  en: string;
  countryTr: string | null;
  countryEn: string | null;
  /** A city stays one stop; a country, an island or a region can be a route. */
  city: boolean;
  also?: string[];
  /** Where flights land for it, when that isn't its own name (Bali → Denpasar). */
  airport?: string;
  /** The airport's city in English when it's spelt otherwise ("Kolombo" / "Colombo"). */
  airportEn?: string;
}
const P = (tr: string, en: string, countryTr: string | null, countryEn: string | null, city: boolean, also: string[] = [], airport?: string): KnownPlace => ({ tr, en, countryTr, countryEn, city, also, ...(airport ? { airport } : {}) });
/** A few places the code knows without the model (the no-key path): popular cities, islands and countries. */
export const KNOWN_PLACES: KnownPlace[] = [
  P("Bali", "Bali", "Endonezya", "Indonesia", false, [], "Denpasar"),
  P("Porto", "Porto", "Portekiz", "Portugal", true),
  P("Lizbon", "Lisbon", "Portekiz", "Portugal", true, ["lisboa"]),
  P("Madeira", "Madeira", "Portekiz", "Portugal", false, [], "Funchal"),
  P("Roma", "Rome", "İtalya", "Italy", true),
  P("Paris", "Paris", "Fransa", "France", true),
  P("Londra", "London", "Birleşik Krallık", "United Kingdom", true),
  P("Barselona", "Barcelona", "İspanya", "Spain", true),
  P("Amsterdam", "Amsterdam", "Hollanda", "Netherlands", true),
  P("Berlin", "Berlin", "Almanya", "Germany", true),
  P("Prag", "Prague", "Çekya", "Czechia", true),
  P("Viyana", "Vienna", "Avusturya", "Austria", true),
  P("Budapeşte", "Budapest", "Macaristan", "Hungary", true),
  P("Atina", "Athens", "Yunanistan", "Greece", true),
  P("Santorini", "Santorini", "Yunanistan", "Greece", false),
  P("Tokyo", "Tokyo", "Japonya", "Japan", true),
  P("Kyoto", "Kyoto", "Japonya", "Japan", true),
  P("Bangkok", "Bangkok", "Tayland", "Thailand", true),
  P("Phuket", "Phuket", "Tayland", "Thailand", false),
  // Thailand's islands and the north (an island with no airport of its own flies to the one next to it).
  P("Koh Phangan", "Koh Phangan", "Tayland", "Thailand", false, ["ko pha-ngan", "ko phangan", "kohphangan", "koh pha ngan"], "Koh Samui"),
  P("Koh Samui", "Koh Samui", "Tayland", "Thailand", false, ["ko samui", "samui"]),
  P("Koh Tao", "Koh Tao", "Tayland", "Thailand", false, ["ko tao"], "Koh Samui"),
  P("Koh Lanta", "Koh Lanta", "Tayland", "Thailand", false, ["ko lanta"], "Krabi"),
  P("Krabi", "Krabi", "Tayland", "Thailand", false),
  P("Chiang Mai", "Chiang Mai", "Tayland", "Thailand", true),
  P("Dubai", "Dubai", "Birleşik Arap Emirlikleri", "United Arab Emirates", true),
  P("New York", "New York", "ABD", "United States", true),
  P("Kahire", "Cairo", "Mısır", "Egypt", true),
  P("Tiflis", "Tbilisi", "Gürcistan", "Georgia", true),
  P("İstanbul", "Istanbul", "Türkiye", "Türkiye", true),
  P("Ankara", "Ankara", "Türkiye", "Türkiye", true),
  P("İzmir", "Izmir", "Türkiye", "Türkiye", true),
  P("Antalya", "Antalya", "Türkiye", "Türkiye", true),
  P("Bodrum", "Bodrum", "Türkiye", "Türkiye", true),
  P("Kapadokya", "Cappadocia", "Türkiye", "Türkiye", false, [], "Kayseri"),
  P("Maldivler", "Maldives", null, null, false, ["maldiv", "maldiv adaları"], "Malé"),
  P("İzlanda", "Iceland", null, null, false),
  P("Tayland", "Thailand", null, null, false),
  P("Japonya", "Japan", null, null, false),
  P("İtalya", "Italy", null, null, false),
  P("İspanya", "Spain", null, null, false),
  P("Portekiz", "Portugal", null, null, false),
  P("Yunanistan", "Greece", null, null, false),
  P("Vietnam", "Vietnam", null, null, false),
  P("Meksika", "Mexico", null, null, false),
  { ...P("Sri Lanka", "Sri Lanka", null, null, false, ["srilanka", "seylan", "ceylon"], "Kolombo"), airportEn: "Colombo" },
  P("Endonezya", "Indonesia", null, null, false),
  P("Fransa", "France", null, null, false),
];

const plain = (s: string) =>
  s
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
/** A name compared without case, accents, spaces or dashes ("Ko Pha-ngan" and "Kohphangan" alike). */
const squash = (s: string) => plain(s).replace(/[^\p{L}\p{N}]/gu, "");
const PLACE_INDEX = new Map<string, KnownPlace>();
for (const p of KNOWN_PLACES) for (const n of [p.tr, p.en, ...(p.also ?? [])]) PLACE_INDEX.set(squash(n), p);

const placeName = (p: KnownPlace) => L(p.tr, p.en);
/** Its country in the chat's language; a country stands for itself. */
const countryNameOf = (p: KnownPlace) => (p.countryTr ? L(p.countryTr, p.countryEn ?? p.countryTr) : placeName(p));

export function knownPlaceOf(name: string | null | undefined): KnownPlace | null {
  return name ? (PLACE_INDEX.get(squash(name)) ?? null) : null;
}

/** Edits (insert, delete, change a letter) between two words; anything above `max` is max + 1. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return Math.min(prev[b.length], max + 1);
}

/**
 * A known place spelled loosely ("Kohphandan" → Koh Phangan): compared without spaces, at most 2 edits, and only
 * between long names (8+ letters both): "Antakya" is never Antalya, "Frances", "Athena" or "Lyndon" never a place.
 * Real countries' names ("Ireland" isn't Iceland) are never guessed. The chat asks back before taking it.
 */
export function fuzzyPlaceOf(word: string): KnownPlace | null {
  const k = squash(word);
  if (k.length < 8 || countryCodeOfName(word)) return null;
  let best: KnownPlace | null = null;
  let bestD = Infinity;
  for (const [name, p] of PLACE_INDEX) {
    if (name.length < 8) continue;
    const max = 2;
    const d = editDistance(k, name, max);
    if (d <= max && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Turkish endings typed onto a name without an apostrophe ("İstanbuldan", "Balide", "Romaya"): where from, where to, where at. */
const GLUED: [RegExp, "from" | "to" | null][] = [
  [/(dan|den|tan|ten)$/, "from"],
  [/(ya|ye|a|e)$/, "to"],
  [/(da|de|ta|te)$/, null],
];
function gluedPlace(word: string): { p: KnownPlace; dir: "from" | "to" | null } | null {
  const k = squash(word);
  for (const [re, dir] of GLUED) {
    const bare = k.replace(re, "");
    if (bare !== k && bare.length >= 3) {
      const p = PLACE_INDEX.get(bare);
      if (p) return { p, dir };
    }
  }
  return null;
}

/** "Bali" → { Bali, Endonezya }: a known place in the board's language, else as written (capitalised). */
export function placeOf(name: string, country: string | null = null, code: string | null = null): Place {
  const known = knownPlaceOf(name);
  if (known) return { place: placeName(known), country: countryNameOf(known), code: knownCode(known) };
  const c = country?.trim() || null;
  return { place: capitalizeWords(name.trim()), country: c, code: isoCode(code) ?? countryCodeOfName(c) ?? countryCodeOfName(name) };
}

const isoCode = (v: string | null | undefined) => (v && /^[A-Za-z]{2}$/.test(v.trim()) ? v.trim().toUpperCase() : null);

let countryIndex: Map<string, string> | null = null;
/** The same names compared without spaces or dashes ("yenizelanda"), for a name with an ending typed on. */
let countrySquashed: Map<string, string> | null = null;
/**
 * Codes Intl names that are no country to travel to (the EU, the UN, the eurozone, pseudo-regions), and the old
 * codes it still names like today's: "Almanya" is DE, never East Germany's DD; "Vietnam" VN, never VD.
 */
const NOT_COUNTRIES = new Set(["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ", "AQ", "AN", "BU", "CS", "DD", "FX", "SU", "TP", "VD", "YD", "YU", "ZR", "UK"]);

/** "Endonezya", "Indonesia" → "ID": a country's name in Turkish or English (Intl), compared plain; null for anything else. */
export function countryCodeOfName(name: string | null | undefined): string | null {
  if (!name) return null;
  return countryNames().get(plain(name)) ?? null;
}

/** A country's name in a language (Intl), or null. */
export function regionName(code: string, l: Lang): string | null {
  try {
    const n = new Intl.DisplayNames([l], { type: "region" }).of(code);
    return n && n !== code ? n : null;
  } catch {
    return null;
  }
}

/** A country as a known place (rev 3: every country, by its Turkish or English name): the table's entry when it has one. */
function countryPlace(code: string): KnownPlace | null {
  const tr = MAIN_NAMES[code]?.[0] ?? regionName(code, "tr");
  const en = MAIN_NAMES[code]?.[1] ?? regionName(code, "en");
  if (!tr || !en) return null;
  return PLACE_INDEX.get(squash(tr)) ?? PLACE_INDEX.get(squash(en)) ?? { tr, en, countryTr: null, countryEn: null, city: false, also: [] };
}

/**
 * Any country said by its name, with a Turkish ending typed on or not ("Yeni Zelanda'ya", "Güney Kore'ye",
 * "Dominik Cumhuriyeti'ne", "Japonyadan"): the country and which way the ending points. Null for anything else.
 */
export function countryNamed(words: string): { p: KnownPlace; dir: "from" | "to" | null } | null {
  if (!countrySquashed) {
    countrySquashed = new Map();
    for (const [n, code] of countryNames()) {
      const k = squash(n);
      if (k.length >= 3 && !countrySquashed.has(k)) countrySquashed.set(k, code);
    }
  }
  const k = squash(words);
  const direct = countrySquashed.get(k);
  if (direct) return withDir(countryPlace(direct), null);
  for (const [re, dir] of GLUED) {
    const bare = k.replace(re, "");
    const code = bare !== k && bare.length >= 3 ? countrySquashed.get(bare) : undefined;
    if (code) return withDir(countryPlace(code), dir);
  }
  return null;
}
const withDir = (p: KnownPlace | null, dir: "from" | "to" | null) => (p ? { p, dir } : null);

/** Every country's name (Intl, Turkish and English, every code A–Z), plain → its code; built once. */
function countryNames(): Map<string, string> {
  if (!countryIndex) {
    countryIndex = new Map();
    for (const l of ["tr", "en"]) {
      let names: Intl.DisplayNames;
      try {
        names = new Intl.DisplayNames([l], { type: "region" });
      } catch {
        continue;
      }
      for (let i = 0; i < 26; i++)
        for (let j = 0; j < 26; j++) {
          const code = String.fromCharCode(65 + i, 65 + j);
          let n: string | undefined;
          try {
            n = names.of(code);
          } catch {
            n = undefined;
          }
          if (n && n !== code && !NOT_COUNTRIES.has(code) && !countryIndex.has(plain(n))) countryIndex.set(plain(n), code);
        }
    }
    for (const [n, code] of Object.entries(MORE_CODES)) countryIndex.set(plain(n), code);
  }
  return countryIndex;
}
/** Names Intl doesn't give (short forms, older names). */
const MORE_CODES: Record<string, string> = {
  ABD: "US", USA: "US", Amerika: "US", "Birleşik Krallık": "GB", İngiltere: "GB", England: "GB", Türkiye: "TR", Turkey: "TR", Hollanda: "NL", Holland: "NL",
  Çekya: "CZ", "Çek Cumhuriyeti": "CZ", "Czech Republic": "CZ", "Güney Kore": "KR", "South Korea": "KR", Emirlikler: "AE", Seylan: "LK", Ceylon: "LK",
};
/** The name the chat uses for a country whose Intl name is long or official. */
const MAIN_NAMES: Record<string, [string, string]> = { US: ["ABD", "United States"], GB: ["Birleşik Krallık", "United Kingdom"], CZ: ["Çekya", "Czechia"], NL: ["Hollanda", "Netherlands"] };

/** A known place's country code: its country's, or its own when it is a country. */
const knownCode = (p: KnownPlace): string | null => countryCodeOfName(p.countryEn ?? p.en) ?? countryCodeOfName(p.countryTr ?? p.tr);

const capitalizeWords = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toLocaleUpperCase("tr"));

/** A short typed answer that can be a place's name: letters, at most four words, no digits. */
export function looksLikePlace(text: string): boolean {
  const t = text.trim().replace(/[.!?]+$/, "");
  return /^[\p{L}][\p{L} .'’-]{0,40}$/u.test(t) && t.split(/\s+/).length <= 4;
}

/** The place's name without the Turkish ending ("Bali'ye" → "Bali", "İzmir'den" → "İzmir"). */
export const bareName = (text: string) => text.trim().replace(/[.!?]+$/, "").split(/['’]/)[0].trim();

// --- reading a message without the model ---------------------------------------------------------------------

export interface Extracted {
  where: Place | null;
  from: string | null;
  who: { kind: Companions | null; names: string[] } | null;
  start: StartDay | null;
  duration: Duration | null;
  styles: StyleId[];
  budget: BudgetLevel | null;
  /**
   * The code's destination is marked as one ("Bali'ye", "to Bali", an island inside the country said): the model's
   * reading doesn't override it. Unmarked, the model's destination wins when it has one.
   */
  whereSure?: boolean;
  /** A place recognised only by a loose spelling: asked back ("Antalya mı demek istedin?"), never taken silently. */
  guess?: PlaceGuess | null;
}

/** "Kohphandan" read as Koh Phangan: kept apart until the traveller says yes ("Evet") or no ("Hayır, Kohphandan"). */
export interface PlaceGuess {
  typed: string;
  place: Place;
  slot: "where" | "from";
}

export const EMPTY_EXTRACTED: Extracted = { where: null, from: null, who: null, start: null, duration: null, styles: [], budget: null };

const NUMBER_WORDS: Record<string, number> = {
  bir: 1, iki: 2, üç: 3, uc: 3, dört: 4, dort: 4, beş: 5, bes: 5, altı: 6, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const FROM_SUFFIX = new Set(["dan", "den", "tan", "ten"]);
const TO_SUFFIX = new Set(["ya", "ye", "a", "e", "na", "ne"]);
const WITH_SUFFIX = new Set(["yle", "yla", "le", "la", "ile"]);
const STYLE_WORDS: [RegExp, StyleId][] = [
  [/\b(doğa|doga|nature|hiking|yürüyüş)/i, "nature"],
  [/\b(deniz|plaj|sahil|beach|sea)/i, "beach"],
  [/\b(kültür|kultur|tarih|müze|culture|history|museum)/i, "culture"],
  [/\b(romantik|balayı|romantic|honeymoon)/i, "romantic"],
  [/\b(macera|adventure)/i, "adventure"],
  [/\b(lüks|luks|luxury)/i, "luxury"],
  [/\b(gastronomi|yemek|lezzet|food|foodie)/i, "food"],
  [/\b(dingin|sakin|huzur|calm|relax)/i, "calm"],
  [/\b(şehir gezisi|city break)/i, "city"],
  [/\b(eğlence|gece hayatı|nightlife|party|parti)/i, "nightlife"],
  [/\b(aktif|spor|active|sport)/i, "active"],
];

const COMPANION_WORDS: [RegExp, Companions][] = [
  [/(partnerimle|sevgilimle|eşimle|esimle|karımla|kocamla|nişanlımla|my partner|my wife|my husband|my girlfriend|my boyfriend|as a couple)/i, "partner"],
  [/(arkadaşlarımla|arkadaşlarla|arkadaşımla|with friends|with my friends|with a friend)/i, "friends"],
  [/(ailemle|ailece|çocuklarla|çocuklarımla|with my family|with family|with the kids|with kids)/i, "family"],
  [/(yalnız|tek başıma|solo|alone|by myself|on my own)/i, "solo"],
];

/** Words that look like a name before "ile" but aren't one. */
const NOT_NAMES = new Set(["ben", "biz", "sen", "o", "onlar", "partner", "aile", "arkadaş", "araba", "uçak", "tren", "otobüs", "gemi", "feribot"]);

/** Tokens of the original text: letters/digits runs, the Turkish ending after an apostrophe as its own token. */
function tokensOf(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * What one message says, read by the code alone: dates, lengths, a few places, who, styles. `pending`: the question
 * it answers (a bare place answering "Nereden?" is where from).
 */
export function parseStartText(text: string, today: string, pending: QuestionId | null = null): Extracted {
  const out: Extracted = { ...EMPTY_EXTRACTED, styles: [] };
  const raw = tokensOf(text);
  const low = raw.map((t) => t.toLocaleLowerCase("tr"));
  const used = new Set<number>();

  // Dates written with numbers: 2026-12-10, 10.12.2026, 10/12.
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const dotted = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (iso && isoDate(iso[0])) out.start = { date: iso[0], approx: false };
  else if (dotted) {
    const [d, m] = [Number(dotted[1]), Number(dotted[2])];
    const y = dotted[3] ? Number(dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3]) : undefined;
    const date = m >= 1 && m <= 12 ? nextDate(m, d, today, y) : null;
    if (date) out.start = { date, approx: false };
  }

  for (let i = 0; i < low.length; i++) {
    const t = low[i];
    const n = /^\d{1,3}$/.test(t) ? Number(t) : (NUMBER_WORDS[t] ?? null);
    // "10 Aralık", "10 December" (a year may follow).
    if (!out.start && n != null && /^\d/.test(t) && i + 1 < low.length) {
      const m = monthOf(low[i + 1]);
      if (m && n >= 1 && n <= 31) {
        const year = /^\d{4}$/.test(low[i + 2] ?? "") ? Number(low[i + 2]) : undefined;
        const date = nextDate(m, n, today, year);
        if (date) {
          out.start = { date, approx: false };
          used.add(i).add(i + 1);
          continue;
        }
      }
    }
    // "December 10".
    if (!out.start && monthOf(t) && /^\d{1,2}$/.test(low[i + 1] ?? "") && !/^(ay|gün|gun|gece|hafta|day|days|night|nights|week|weeks|month|months)$/.test(low[i + 2] ?? "")) {
      const date = nextDate(monthOf(t)!, Number(low[i + 1]), today);
      if (date) {
        out.start = { date, approx: false };
        used.add(i).add(i + 1);
        continue;
      }
    }
    // Lengths: "1 ay", "iki hafta", "10 gün", "10 gece", "2 weeks".
    if (!out.duration && n != null && i + 1 < low.length) {
      const unit = low[i + 1];
      const u: DurationUnit | null = /^(ay|aylık|month|months)$/.test(unit)
        ? "month"
        : /^(hafta|haftalık|week|weeks)$/.test(unit)
          ? "week"
          : /^(gece|gecelik|night|nights)$/.test(unit)
            ? "night"
            : /^(gün|gun|günlük|day|days)$/.test(unit)
              ? "day"
              : null;
      if (u && n >= 1 && n <= (u === "day" || u === "night" ? 120 : u === "week" ? 16 : 4)) {
        out.duration = { unit: u, n };
        used.add(i).add(i + 1);
        continue;
      }
    }
  }
  // "hafta sonu", "this weekend", "next weekend".
  const lowText = text.toLocaleLowerCase("tr");
  if (/hafta ?sonu|weekend/.test(lowText)) {
    out.duration ??= { unit: "weekend", n: 1 };
    if (!out.start && /(bu|this) (hafta ?sonu|weekend)/.test(lowText)) out.start = { date: weekendStart(today), approx: false };
    if (!out.start && /(gelecek|önümüzdeki|next) (hafta ?sonu|weekend)/.test(lowText)) out.start = { date: weekendStart(today, true), approx: false };
  }
  // A month alone ("Aralık'ta", "in December"): its beginning, roughly.
  if (!out.start) {
    for (let i = 0; i < low.length; i++) {
      if (used.has(i)) continue;
      const m = monthOf(low[i]);
      // "May" in English is also a word: only as a month next to "in"/"ayında"/a suffix.
      if (m && (low[i].length > 3 || /^(ta|da|te|de|ayında|ayi|ayı)$/.test(low[i + 1] ?? "") || low[i - 1] === "in")) {
        if (low[i] === "may" && low[i - 1] !== "in") continue;
        out.start = { date: monthStart(m, today), approx: true };
        used.add(i);
        break;
      }
    }
  }

  // Places: known ones (spelled loosely too); "X'den" is where from, "X'e" where to. An answer to "Nereden?" is
  // where from unless it says "to" ("aslında Bali'ye"). Where to is the most specific place said: "Tayland
  // Kohphandan" is Koh Phangan (in Thailand), not Thailand.
  type Hit = { p: KnownPlace; dir: "from" | "to" | null; loose: string | null };
  const found: Hit[] = [];
  const capital = (w: string | undefined) => !!w && /^\p{Lu}/u.test(w);
  const short = looksLikePlace(text);
  // A change of mind ("Rome instead", "Hayır, Roma") answers no pending "Nereden?": it is where to.
  const change = saysWhereTo(text);
  const JOINERS = new Set(["with", "and", "ile", "ve"]);
  const joined = (i: number, n: number) =>
    JOINERS.has(low[i - 1] ?? "") || JOINERS.has(low[i + n] ?? "") || WITH_SUFFIX.has(low[i + n] ?? "") || new RegExp(`&\\s*${raw[i]}|${raw[i + n - 1]}\\s*&`, "u").test(text);
  for (let i = 0; i < raw.length; i++) {
    let hit: Hit | null = null;
    let len = 0;
    for (const n of [3, 2, 1]) {
      if (i + n > raw.length) continue;
      const words = raw.slice(i, i + n).join(" ");
      const known = knownPlaceOf(words);
      if (known) {
        hit = { p: known, dir: null, loose: null };
        len = n;
        break;
      }
      // A name of several words with a Turkish ending typed on ("Sri lankaya", "Koh Samuiden").
      const glued = gluedPlace(words);
      if (glued) {
        [hit, len] = [{ ...glued, loose: null }, n];
        break;
      }
      // Any country by its Turkish or English name (rev 3), endings too ("Yeni Zelanda'ya", "Güney Kore'ye"). One
      // word only when capitalised or the whole answer (a country's name can be a word: "mali", "ırak"), never a
      // person's ("with Jordan", "Chad and I"), never "New Jersey", nor while who's coming is asked.
      if (pending !== "who" && pending !== "names" && (n > 1 || capital(raw[i]) || squash(bareName(text)) === squash(words)) && !joined(i, n) && !(n === 1 && low[i - 1] === "new") && !monthOf(raw[i])) {
        const country = countryNamed(words);
        if (country) {
          [hit, len] = [{ ...country, loose: null }, n];
          break;
        }
      }
    }
    // Spelled loosely (8+ letters): a capitalised word or a short answer that is only a name; never a common word, a
    // word next to "with"/"and"/"ile"/"&" (a person: "Frances and I"), nor while who's coming is asked. Asked back.
    if (!hit && pending !== "who" && pending !== "names" && (capital(raw[i]) || short) && !monthOf(raw[i]) && !NOT_NAMES.has(low[i])) {
      for (const n of [2, 1]) {
        if (i + n > raw.length || (n === 2 && !capital(raw[i + 1])) || joined(i, n)) continue;
        const loose = fuzzyPlaceOf(raw.slice(i, i + n).join(""));
        if (loose) {
          [hit, len] = [{ p: loose, dir: null, loose: raw.slice(i, i + n).join(" ") }, n];
          break;
        }
      }
    }
    if (!hit) continue;
    const next = low[i + len] ?? "";
    // "Bali değil", "not Bali", "instead of Bali": not where they go.
    const denied = next === "değil" || low[i - 1] === "not" || (low[i - 1] === "of" && low[i - 2] === "instead");
    if (!denied) {
      hit.dir ??= FROM_SUFFIX.has(next) || low[i - 1] === "from" || next === "to" || (low[i - 1] === "in" && ["live", "living", "based"].includes(low[i - 2] ?? ""))
        ? "from"
        : TO_SUFFIX.has(next) || low[i - 1] === "to"
          ? "to"
          : null;
      found.push(hit);
    }
    i += len - 1;
  }
  const fromHit = found.find((f) => f.dir === "from") ?? (pending === "from" && !change ? found.find((f) => f.dir !== "to") : undefined);
  if (fromHit?.loose) out.guess = { typed: fromHit.loose, place: placeOf(placeName(fromHit.p)), slot: "from" };
  else if (fromHit) out.from = placeName(fromHit.p);
  const toHits = found.filter((f) => f !== fromHit && (f.p !== fromHit?.p || f.dir === "to"));
  if (toHits.length) {
    // The place marked as where they go ("Bali'ye", "to Bali"); inside it (or anywhere), a place in a country said
    // (an island in the country); else a place before a country; else the first.
    const marked = toHits.filter((f) => f.dir === "to");
    const pool = marked.length ? marked : toHits;
    const inside = toHits.find((f) => f.p.countryEn && pool.some((g) => g !== f && g.p.en === f.p.countryEn));
    const pick = inside ?? pool.find((f) => f.p.countryEn) ?? pool[0];
    const sure = (p: Hit) => p.dir === "to" || p === inside;
    const where = (p: Hit): Place => ({ place: placeName(p.p), country: countryNameOf(p.p), code: knownCode(p.p) });
    if (pick.loose) {
      // Asked back first; meanwhile the place it is in, when that was said exactly.
      out.guess = { typed: pick.loose, place: where(pick), slot: "where" };
      const host = pool.find((f) => !f.loose && f.p.en === pick.p.countryEn) ?? pool.find((f) => !f.loose);
      if (host) out.where = where(host);
    } else {
      out.where = where(pick);
      out.whereSure = sure(pick);
    }
  }

  // Who: words for a companion, and names ("Sabine'yle", "Sabine ile", "with Sabine").
  let kind: Companions | null = null;
  for (const [re, k] of COMPANION_WORDS) if (re.test(text)) {
    kind = k;
    break;
  }
  const names: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const word = raw[i];
    const isName = /^\p{Lu}\p{Ll}{1,20}$/u.test(word) && !knownPlaceOf(word) && !monthOf(word) && !NOT_NAMES.has(word.toLocaleLowerCase("tr"));
    if (!isName) continue;
    const next = low[i + 1] ?? "";
    if (WITH_SUFFIX.has(next) || low[i - 1] === "with") names.push(word);
  }
  if (kind || names.length) out.who = { kind, names: [...new Set(names)] };

  for (const [re, id] of STYLE_WORDS) if (re.test(text) && !out.styles.includes(id)) out.styles.push(id);
  if (/(ekonomik|ucuz|düşük bütçe|budget trip|cheap|on a budget)/i.test(text)) out.budget = "low";
  else if (/(orta bütçe|mid-range|mid range)/i.test(text)) out.budget = "mid";
  else if (/(yüksek bütçe|bol bütçe|high budget|splurge)/i.test(text)) out.budget = "high";
  return out;
}

// --- reading a message with the model (a strict shape, checked here) ------------------------------------------

/** No nullable fields (Claude's grammar limits unions): "" and 0 stand for "not said". */
export const extractionSchema = z.object({
  destination: z.string(),
  destination_country: z.string(),
  destination_country_code: z.string(),
  origin: z.string(),
  companions: z.string(),
  names: z.array(z.string()),
  start_date: z.string(),
  start_month: z.number(),
  duration_days: z.number(),
  duration_months: z.number(),
  styles: z.array(z.string()),
  budget: z.string(),
});
export type RawExtraction = z.infer<typeof extractionSchema>;

/** "Answer in Turkish." in the chat's language: every prompt of the start flow ends with it. */
export const answerIn = () => L("Yanıtı Türkçe yaz.", "Answer in English.");

export const extractionSystem = () =>
  L(
    `Bir gezi planlama sohbetinde kullanıcının mesajından yalnız açıkça söylenenleri çıkar. Uydurma; söylenmeyen alan boş kalır ("" ya da 0 ya da []).
destination: gidilecek yer (şehir, ada, bölge ya da ülke) yalnız adı, ek olmadan ("Bali'ye" → "Bali"); birden çok yer söylendiyse en belirgini ("Tayland Kohphandan" → "Koh Phangan", ülkesi Tayland), yazımı bozuksa doğru adı. destination_country: biliniyorsa ülkesi; destination_country_code: o ülkenin ISO 3166-1 alpha-2 kodu ("TH").
origin: yola çıkılan şehir ("İstanbul'dan" → "İstanbul"). companions: solo | partner | friends | family ya da "". names: birlikte gidilen kişilerin adları (kullanıcının kendisi değil).
start_date: başlangıç günü YYYY-MM-DD (bugünden sonraki ilk uygun yıl). Yalnız ay söylendiyse start_date "" ve start_month 1-12.
duration_days: gün olarak süre (gece söylendiyse gece + 1); "1 ay" gibi ay söylendiyse duration_months. styles: yalnız bu id'lerden: ${Object.keys(STYLES).join(", ")}. budget: low | mid | high ya da "".
"Kullanıcının cevapladığı soru" verildiyse mesaj o soruyu cevaplar: "nereden" sorusuna verilen yer adı origin'dir, destination değil. Gidilecek yer bilinirken destination yalnız kullanıcı açıkça başka yere gitmek istediğini söylerse ("aslında Bali'ye gidelim") dolar.`,
    `From the user's message in a trip-planning chat, take only what is clearly said. Never invent; what isn't said stays empty ("" or 0 or []).
destination: the place to go (a city, island, region or country), its name only; when several are said, the most specific ("Thailand, Koh Phangan" → "Koh Phangan", country Thailand), spelled correctly. destination_country: its country when known; destination_country_code: that country's ISO 3166-1 alpha-2 code ("TH").
origin: the city they leave from. companions: solo | partner | friends | family or "". names: the people going with them (not the user).
start_date: the first day, YYYY-MM-DD (the first fitting year from today). If only a month is said, start_date "" and start_month 1-12.
duration_days: the length in days (nights said: nights + 1); a length in months goes in duration_months. styles: only these ids: ${Object.keys(STYLES).join(", ")}. budget: low | mid | high or "".
When "The user is answering" is given, the message answers that question: a place given to "where from" is the origin, not the destination. While the destination is known, destination is filled only when the user clearly says they want to go somewhere else ("actually, let's go to Bali").`,
  );

/** What each question asks, in words for the model ("where they leave from"). */
export const slotWords = (q: QuestionId): string =>
  ({
    where: L("nereye gidileceği", "where to go"),
    from: L("nereden yola çıkılacağı (origin)", "where they leave from (origin)"),
    who: L("kimle gidileceği", "who is coming"),
    names: L("birlikte gidenlerin adları", "the names of who is coming"),
    duration: L("kaç gün ya da gece", "how many days or nights"),
    start: L("başlangıç tarihi", "the start date"),
    day: L("ayın hangi günü başlanacağı", "which day of the month it starts"),
    want: L("gezide ne istendiği (tarz, bütçe)", "what they want from the trip (style, budget)"),
    route: L("rota", "the route"),
    guess: L("yazılan yerin doğru okunup okunmadığı", "whether the place typed was read right"),
  })[q];

export const extractionPrompt = (text: string, today: string, pending: QuestionId | null) =>
  `<start_message>\n${L("Bugün", "Today")}: ${today}\n${pending ? `${L("Kullanıcının cevapladığı soru", "The user is answering")}: ${slotWords(pending)}\n` : ""}${L("Mesaj", "Message")}: ${text}\n</start_message>`;

// --- the replies, written by the model when there is one (item 5) --------------------------------------------

/** The model's reply: a warm line about the place, and the one next question in its own words. */
export const replySchema = z.object({ text: z.string(), question: z.string() });
export type RawReply = z.infer<typeof replySchema>;
/** One call per typed message: what it says, and the reply to it. */
export const turnSchema = extractionSchema.extend({ reply: replySchema });
export type RawTurn = z.infer<typeof turnSchema>;

const replyRules = () =>
  L(
    `reply.text: sıcak, samimi, 1-2 kısa cümle; söylenen yere özgü renk kat (ör. "Sabine ile Tayland kulağa harika geliyor: Bangkok'tan Chiang Mai'nin sisli dağlarına ve güneyin cennet koylarına."). En fazla 220 karakter. Fiyat yazma; uçuş, otel ya da rezervasyon hakkında olgu uydurma; text içinde soru sorma.
reply.question: yalnız "Sıradaki soru" için tek, kısa bir soru, soru işaretiyle biter; sıradaki soru yoksa "".`,
    `reply.text: warm, friendly, 1-2 short sentences with colour specific to the place (e.g. "Thailand with Sabine sounds incredible: from Bangkok to the misty mountains of Chiang Mai and the idyllic beaches down south."). At most 220 characters. No prices; never invent facts about flights, hotels or bookings; no question in text.
reply.question: one short question for "Next question" only, ending with a question mark; "" when there is no next question.`,
  );

/** The system prompt for a typed message: read it, then reply. */
export const turnSystem = () => `${extractionSystem()}\n${replyRules()}\n${answerIn()}`;

/** What is known so far, one line per answer, for the model ("Nereye: Koh Phangan (Tayland)"). */
export function knownLines(s: StartState, ctx: StartCtx): string {
  const rows = [
    s.where ? `${L("Nereye", "Where to")}: ${s.where.place}${s.where.country && s.where.country !== s.where.place ? ` (${s.where.country})` : ""}` : "",
    s.from ? `${L("Nereden", "From")}: ${s.from}` : "",
    s.who ? `${L("Kimle", "Who")}: ${whoText(s.who, ctx.myName)}` : "",
    whenText(s) ? `${L("Ne zaman", "When")}: ${whenText(s)}` : "",
    wantText(s) ? `${L("Tarz", "Style")}: ${wantText(s)}` : "",
  ].filter(Boolean);
  return rows.length ? rows.join("; ") : L("henüz bir şey yok", "nothing yet");
}

/** A typed message for the model: today, what is known, the question it answers, the next question, the message. */
export function turnPrompt(a: { text: string; today: string; pending: QuestionId | null; next: QuestionId | null; known: string }): string {
  return [
    "<start_message>",
    `${L("Bugün", "Today")}: ${a.today}`,
    `${L("Bilinenler", "Known so far")}: ${a.known}`,
    a.pending ? `${L("Kullanıcının cevapladığı soru", "The user is answering")}: ${slotWords(a.pending)}` : "",
    `${L("Sıradaki soru", "Next question")}: ${a.next ? slotWords(a.next) : L("yok", "none")}`,
    `${L("Mesaj", "Message")}: ${a.text}`,
    "</start_message>",
  ].filter(Boolean).join("\n");
}

const PRICE = /[€$£₺¥฿]|\d[\d.,]*\s?(tl|try|eur|euro|usd|dolar|dollars?|lira|baht|thb|gbp|pound)(?![\p{L}])/iu;
const BOOKING = /(rezervasyon\p{L}*\s+(yap|tamam|hazır|onay)|ayırttım|ayırdım|bilet\p{L}*\s+(aldım|alındı)|booked|reserved|i'?ve (booked|reserved)|tickets? (are )?(bought|booked))/iu;
export const REPLY_MAX = 220;

/**
 * The model's reply kept only when it holds: in the chat's language, at most 220 characters, no prices, no claims
 * about bookings; the question only when it is one (ends with "?"). Null: the code's line stands.
 */
export function acceptReply(raw: RawReply | null | undefined, l: Lang): { text: string; question: string | null } | null {
  if (!raw) return null;
  const clean = (v: string) => v.replace(/\s+/g, " ").replace(/—/g, ",").trim();
  const text = clean(raw.text ?? "");
  const question = clean(raw.question ?? "");
  // A line that reads as the other language, weighed (a Turkish name like "İstanbul", or "I've", says nothing).
  const wrongLang = (v: string) => {
    const said = langSignal(v);
    return said != null && said !== l;
  };
  if (!text || text.length > REPLY_MAX || PRICE.test(text) || BOOKING.test(text) || wrongLang(text)) return null;
  const q = question && question.endsWith("?") && question.length <= 160 && !PRICE.test(question) && !wrongLang(question) ? question : null;
  return { text, question: q };
}

const COMPANIONS: readonly Companions[] = ["solo", "partner", "friends", "family"];
const BUDGETS: readonly BudgetLevel[] = ["low", "mid", "high"];

/** The model's answer, kept only where it makes sense: a real date, a sane length, a name-like place, listed styles. */
export function acceptExtraction(raw: RawExtraction, today: string): Extracted {
  const out: Extracted = { ...EMPTY_EXTRACTED, styles: [] };
  const dest = bareName(raw.destination ?? "");
  if (dest && looksLikePlace(dest)) out.where = placeOf(dest, raw.destination_country || null, raw.destination_country_code || null);
  const origin = bareName(raw.origin ?? "");
  if (origin && looksLikePlace(origin)) out.from = placeOf(origin).place;
  const kind = (COMPANIONS as readonly string[]).includes(raw.companions) ? (raw.companions as Companions) : null;
  const names = (raw.names ?? []).map((n) => n.trim()).filter((n) => /^[\p{L}][\p{L} .'-]{0,30}$/u.test(n)).slice(0, 8);
  if (kind || names.length) out.who = { kind, names: [...new Set(names)] };
  const date = isoDate(raw.start_date);
  // A start in the past (or years away) is a misread, not a plan.
  if (date && date >= today && date <= addMonths(today, 36)) out.start = { date, approx: false };
  else if (Number.isInteger(raw.start_month) && raw.start_month >= 1 && raw.start_month <= 12) out.start = { date: monthStart(raw.start_month, today), approx: true };
  if (Number.isInteger(raw.duration_months) && raw.duration_months >= 1 && raw.duration_months <= 4) out.duration = { unit: "month", n: raw.duration_months };
  else if (Number.isInteger(raw.duration_days) && raw.duration_days >= 1 && raw.duration_days <= 120) out.duration = { unit: "day", n: raw.duration_days };
  for (const id of raw.styles ?? []) {
    const s = id.trim().toLowerCase();
    if (Object.hasOwn(STYLES, s) && !out.styles.includes(s as StyleId)) out.styles.push(s as StyleId);
  }
  out.budget = (BUDGETS as readonly string[]).includes(raw.budget) ? (raw.budget as BudgetLevel) : null;
  return out;
}

/** The code's reading wins where it's sure (dates, lengths, places it knows); the model fills what the code missed. */
export function mergeExtracted(code: Extracted, model: Extracted | null): Extracted {
  if (!model) return code;
  const names = [...new Set([...(code.who?.names ?? []), ...(model.who?.names ?? [])])];
  const kind = code.who?.kind ?? model.who?.kind ?? null;
  // The code's destination when it is marked as one ("Bali'ye", "to Bali"); unmarked, the model's when it has one.
  const where = code.where && (code.whereSure || !model.where) ? code.where : (model.where ?? code.where);
  // A loose spelling the model read as the same place needs no asking back.
  const guess = code.guess && !(model.where && samePlace(model.where.place, code.guess.place.place)) ? code.guess : null;
  return {
    where,
    whereSure: where === code.where && code.whereSure,
    guess,
    from: code.from ?? model.from,
    who: kind || names.length ? { kind, names } : null,
    start: code.start && !code.start.approx ? code.start : (model.start ?? code.start),
    duration: code.duration ?? model.duration,
    styles: [...new Set([...code.styles, ...model.styles])],
    budget: code.budget ?? model.budget,
  };
}

const said = (e: Extracted) => Boolean(e.where || e.from || e.who || e.start || e.duration || e.styles.length || e.budget);

// --- the interview ----------------------------------------------------------------------------------------

const ORDER: Record<StartMode, QuestionId[]> = {
  plan: ["where", "from", "who", "names", "duration", "start", "day", "want", "route"],
  road: ["where", "from", "who", "names", "duration", "start", "day", "want", "route"],
  lastminute: ["where", "from", "who", "names", "duration", "start", "day", "want", "route"],
  inspire: ["want", "where", "from", "who", "names", "duration", "start", "day", "route"],
};

const NAMED_COMPANY: Companions[] = ["partner", "friends", "family"];

function open(s: StartState, q: QuestionId): boolean {
  if (s.skipped.includes(q)) return false;
  switch (q) {
    case "where":
      return !s.where;
    case "from":
      return !s.from;
    case "who":
      return !s.who;
    case "names":
      return Boolean(s.who?.kind && NAMED_COMPANY.includes(s.who.kind) && !s.who.names.length && !s.skipped.includes("who"));
    case "duration":
      return !s.duration;
    case "start":
      return !s.start;
    case "day":
      // A month only: which day of it (never one made up silently).
      return Boolean(s.start?.approx && !s.start.part);
    case "want":
      return !s.wantDone;
    case "route":
      return Boolean(s.where && totalNights(s) && !s.route?.confirmed);
    case "guess":
      return Boolean(s.guess);
  }
}

/** The question asked now: a loose spelling to confirm, one pressed in the checklist, else the first still open in the mode's order. */
export function nextQuestion(s: StartState): QuestionId | null {
  if (s.guess) return "guess";
  if (s.asking) return s.asking;
  return ORDER[s.mode].find((q) => open(s, q)) ?? null;
}

/** A start that is a month only: its day is still to be said (or a part of the month picked). */
const monthOnly = (s: Pick<StartState, "start">) => Boolean(s.start?.approx && !s.start.part);

/**
 * "Oluştur" works as soon as the destination is known (item 4): what's missing is asked later in the board's chat,
 * which goes on with this conversation. A month only is made as its beginning, said to be rough.
 */
export const canGenerate = (s: StartState): boolean => Boolean(s.where);

/** What's still needed to generate, in words ("nereye"): only the destination. */
export function missingForGenerate(s: StartState): string[] {
  return s.where ? [] : [L("nereye", "where")];
}

/** What the checklist still misses, in words ("nereden, ne zaman"): asked on the board's chat after "Oluştur". */
export function missingInfo(s: StartState): string[] {
  const out: string[] = [];
  if (!s.where) out.push(L("nereye", "where to"));
  if (!s.from) out.push(L("nereden", "where from"));
  if (!s.who) out.push(L("kimle", "who's coming"));
  if (!s.start || !s.duration) out.push(L("ne zaman", "when"));
  else if (monthOnly(s)) out.push(L("başlangıç günü", "the start day"));
  if (!(s.wantDone && (s.styles.length || s.budget))) out.push(L("gezinin tarzı", "the trip's style"));
  return out;
}

/** Every row of the checklist done: "Gezimi oluştur" (else "Şimdilik bununla oluştur"). */
export const isComplete = (s: StartState): boolean => checklist(s, { myName: null, fromGuess: null, today: "" }).every((r) => r.done);

export function skip(s: StartState, q: QuestionId, now: number): StartState {
  // A guess skipped is a guess not taken.
  if (q === "guess") return { ...s, guess: null, updatedAt: now };
  // The day skipped: the month's beginning, said back as a guess (never a day made up silently).
  if (q === "day" && s.start && monthOnly(s)) {
    // (The month's own start as the month chip took it: its 1st, or a week from today for this month.)
    return { ...s, start: { date: s.start.date, approx: true, part: "begin" }, skipped: [...new Set([...s.skipped, q])], asking: null, updatedAt: now };
  }
  return { ...s, skipped: [...new Set([...s.skipped, q])], asking: null, editingRoute: q === "route" ? false : s.editingRoute, updatedAt: now };
}

/** A row of the checklist pressed: ask that again (its skip forgotten). */
export function askAgain(s: StartState, q: QuestionId, now: number): StartState {
  return { ...s, asking: q, skipped: s.skipped.filter((x) => x !== q), editingRoute: q === "route" ? s.editingRoute : false, updatedAt: now };
}

/**
 * A route made for other places or another length isn't the trip's any more; photos and suggestions prepared for
 * another destination neither (item 7: a change of place starts what's prepared anew).
 */
function keepRoute(before: StartState, next: StartState): StartState {
  const after = keepPrepared(next);
  if (!after.route) return restoreRoute(after);
  const placeChanged = before.where?.place !== after.where?.place;
  const total = totalNights(after);
  const sum = after.route.stops.reduce((a, b) => a + b.nights, 0);
  if (placeChanged || total == null || (sum !== total && after.route.source !== "single")) return restoreRoute({ ...after, route: null, editingRoute: false });
  // A single stop follows the length.
  if (after.route.source === "single" && sum !== total) return { ...after, route: { ...after.route, stops: [{ ...after.route.stops[0], nights: total }] } };
  return after;
}

export type Answer =
  | ({ q: "where" } & Place)
  | { q: "from"; city: string }
  | { q: "who"; kind: Companions }
  | { q: "names"; names: string[] }
  | { q: "duration"; duration: Duration }
  | { q: "start"; date: string; approx: boolean }
  | { q: "day"; date: string; part: MonthPart | null }
  | { q: "want"; styles: StyleId[]; budget: BudgetLevel | null }
  | { q: "route"; action: "accept" | "change" | "single" }
  | { q: "guess"; accept: boolean };

/** A quick answer (a chip) applied. */
export function applyAnswer(s: StartState, a: Answer, now: number): StartState {
  let next: StartState = { ...s, asking: null, updatedAt: now };
  switch (a.q) {
    case "where":
      next.where = { place: a.place, country: a.country, code: a.code ?? null };
      break;
    case "from":
      next.from = a.city;
      break;
    case "who":
      next.who = { kind: a.kind, names: a.kind === "solo" ? [] : (s.who?.names ?? []) };
      break;
    case "names":
      next.who = { kind: s.who?.kind ?? null, names: a.names };
      break;
    case "duration":
      next.duration = a.duration;
      break;
    case "start":
      next.start = { date: a.date, approx: a.approx };
      break;
    case "day":
      // A part of the month is still a guess (kept as such: the hero says "tarih yaklaşık"); a day picked is the day.
      next.start = a.part ? { date: a.date, approx: true, part: a.part } : { date: a.date, approx: false };
      break;
    case "want":
      next = { ...next, styles: a.styles, budget: a.budget, wantDone: true };
      break;
    case "guess": {
      // "Evet": the place read; "Hayır, Kohphandan": the name as typed.
      const g = s.guess;
      next.guess = null;
      if (!g) return next;
      const place = a.accept ? g.place : placeOf(g.typed);
      if (g.slot === "from") next.from = place.place;
      else next.where = place;
      return keepRoute(s, next);
    }
    case "route":
      if (a.action === "accept" && s.route) next = { ...next, route: { ...s.route, confirmed: true }, editingRoute: false };
      else if (a.action === "change") next = { ...next, editingRoute: true, asking: "route" };
      else if (a.action === "single") {
        const single = singleRoute(s);
        next = { ...next, route: single ? { ...single, confirmed: true } : s.route, editingRoute: false };
      }
      return next;
  }
  return keepRoute(s, { ...next, skipped: next.skipped.filter((q) => q !== a.q) });
}

/** What a typed message filled, applied (a later message wins over an earlier one). */
export function applyExtracted(s: StartState, e: Extracted, now: number): StartState {
  const next: StartState = { ...s, updatedAt: now };
  if (e.where) next.where = e.where;
  if (e.from) next.from = e.from;
  if (e.who) next.who = { kind: e.who.kind ?? s.who?.kind ?? null, names: e.who.names.length ? e.who.names : (s.who?.names ?? []) };
  if (e.start) next.start = e.start;
  if (e.duration) next.duration = e.duration;
  if (e.styles.length || e.budget) {
    next.styles = e.styles.length ? e.styles : s.styles;
    next.budget = e.budget ?? s.budget;
    next.wantDone = true;
  }
  return keepRoute(s, next);
}

/**
 * A reading that came late (rev 3: after the traveller said something newer): only what is still empty is taken
 * (where, where from, who, when, the style), never a loose spelling to ask back. Nothing said since is overwritten.
 */
export function onlyEmpty(s: StartState, e: Extracted): Extracted {
  const want = !s.wantDone && !s.skipped.includes("want");
  return {
    where: s.where || s.guess || s.skipped.includes("where") ? null : e.where,
    whereSure: e.whereSure,
    guess: null,
    from: s.from || s.skipped.includes("from") ? null : e.from,
    who: s.who || s.skipped.includes("who") ? null : e.who,
    start: s.start || s.skipped.includes("start") ? null : e.start,
    duration: s.duration || s.skipped.includes("duration") ? null : e.duration,
    styles: want ? e.styles : [],
    budget: want ? e.budget : null,
  };
}

/** Whether a reading says anything at all. */
export const saysSomething = (e: Extracted): boolean => said(e);

const samePlace = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && (cityKeyOf(a) === cityKeyOf(b) || squash(a) === squash(b));

/** "Aslında Bali'ye gidelim", "olsun", "let's go to Bali instead": the traveller means to change where they go. */
export function saysWhereTo(text: string): boolean {
  const low = text.toLocaleLowerCase("tr");
  // "Bali'ye", "Roma'ya gidelim", and the same typed on ("Romaya gidelim").
  if (/['’](y?[ae]|n[ae])(?![\p{L}])/u.test(text)) return true;
  if (text.split(/[^\p{L}]+/u).some((w) => gluedPlace(w)?.dir === "to")) return true;
  if (/(?<![\p{L}])(aslında|yerine|vazgeç\p{L}*|değiştir\p{L}*|değil|hayır|gidelim|gidiyoruz|gideceğiz|gidiyorum|gideceğim|gitmek|gitmeyi|gitsek|olsun)(?![\p{L}])/u.test(low)) return true;
  return /\b(actually|instead|rather|how about|what about|make it|let'?s go|go to|going to|travel to|head to|fly to|switch to|change (it|the destination|the place))\b/i.test(text);
}

/**
 * The reading bound to the question it answers (item 2): what was already said about where to is changed only
 * when the traveller clearly says so (the question asked again, "aslında Bali'ye", a place inside the country said);
 * a place answering "Nereden?" is where from; any other place said in passing changes nothing.
 */
export function bindToQuestion(s: StartState, text: string, read: Extracted, q: QuestionId | null = nextQuestion(s)): Extracted {
  const e = read;
  if (!e.where || !s.where || samePlace(e.where.place, s.where.place)) return e;
  // Koh Phangan after Thailand: the same country, said more exactly.
  const refines = Boolean(s.where.code && e.where.code === s.where.code && countryCodeOfName(s.where.place) === s.where.code);
  if (q === "where" || refines) return e;
  // A change of mind: where changes; where from stays as it was unless this line says it ("İstanbul'dan", "from").
  if (saysWhereTo(text)) return q === "from" && !/['’](d|t)[ae]n(?![\p{L}])|\bfrom\b/iu.test(text) ? { ...e, from: null } : e;
  if (q === "from" && !e.from) return { ...e, from: e.where.place, where: null };
  return { ...e, where: null };
}

/**
 * A typed message for the question on screen: what it says (code and model readings merged), and when it says
 * nothing the code recognises, a short answer taken as the answer to that question ("İzmir" to "Nereden?").
 * `understood: false` when nothing came of it.
 */
export function applyText(s: StartState, text: string, read: Extracted, now: number, pending: QuestionId | null = nextQuestion(s)): { state: StartState; understood: boolean } {
  const q = pending;
  let e = bindToQuestion(s, text, read, q);
  // An origin that is the destination itself ("İstanbul" read as both) is the answer to the question asked only
  // (a change of mind is where to).
  if (e.from && e.where && samePlace(e.from, e.where.place)) e = !saysWhereTo(text) && (q === "from" || s.where) ? { ...e, where: null } : { ...e, from: null };
  // A loose spelling already taken (the model read it the same way) needs no asking back.
  if (e.guess && [e.where?.place, e.from, s.where?.place, s.from].some((p) => samePlace(p, e.guess!.place.place))) e = { ...e, guess: null };
  let state = applyExtracted(s, e, now);
  if (e.guess) state = { ...state, guess: e.guess };
  // A guess still asked about that is now taken (the model's reading said that place): asked no more.
  const asked = state.guess;
  if (asked && [state.where?.place, state.from].some((p) => samePlace(p, asked.place.place))) state = { ...state, guess: null };
  const filled = said(e) || Boolean(e.guess);
  const bare = bareName(text);
  if (q === "where" && !e.where && looksLikePlace(bare) && !filled) state = applyAnswer(state, { q: "where", ...placeOf(bare) }, now);
  else if (q === "from" && !e.from && looksLikePlace(bare) && !filled) state = applyAnswer(state, { q: "from", city: placeOf(bare).place }, now);
  else if (q === "names" && !e.who?.names.length) {
    const names = text.split(/,|\bve\b|\band\b|&/).map((n) => bareName(n)).filter((n) => /^[\p{L}][\p{L} .-]{0,30}$/u.test(n));
    if (names.length) state = applyAnswer(state, { q: "names", names: names.map(capitalizeWords) }, now);
  }
  const understood = state !== s && JSON.stringify({ ...state, updatedAt: 0, asking: null }) !== JSON.stringify({ ...s, updatedAt: 0, asking: null });
  return { state: understood ? { ...state, asking: null } : s, understood };
}

// --- questions and quick answers --------------------------------------------------------------------------------

export type Chip = { label: string; answer: Answer };
export interface Question {
  id: QuestionId;
  text: string;
  /** A second line under the question (why it's asked, what the route is). */
  hint?: string;
  chips: Chip[];
  /** Styles and budget: chips toggled, then "Tamam". */
  multi?: boolean;
  /** "Başka…" (focus the typing box), "📅" (a date input) on this question. */
  other?: boolean;
  date?: boolean;
}

/** Common cities to leave from, after the guess. */
const ORIGINS_TR = ["İstanbul", "Ankara", "İzmir", "Antalya"];
const ORIGINS_EN = ["London", "Berlin", "Amsterdam", "Paris"];
/** The passport country's main city, the guess when no trip says where they leave from. */
const MAIN_CITY: Record<string, [string, string]> = {
  TR: ["İstanbul", "Istanbul"], DE: ["Berlin", "Berlin"], GB: ["Londra", "London"], US: ["New York", "New York"], NL: ["Amsterdam", "Amsterdam"],
  FR: ["Paris", "Paris"], ES: ["Madrid", "Madrid"], IT: ["Roma", "Rome"], PT: ["Lizbon", "Lisbon"], AT: ["Viyana", "Vienna"], CH: ["Zürih", "Zurich"],
  BE: ["Brüksel", "Brussels"], GR: ["Atina", "Athens"], DK: ["Kopenhag", "Copenhagen"], SE: ["Stockholm", "Stockholm"], PL: ["Varşova", "Warsaw"],
};

/**
 * Where they'll most likely leave from: the city the trips' first flights leave from most often (the earliest
 * flight of each trip, as written), else the passport country's main city.
 */
export function guessOrigin(trips: Trip[], items: Item[], passport: string | null): string | null {
  const counts = new Map<string, { name: string; n: number }>();
  for (const trip of trips) {
    if (trip.demo) continue;
    const flights = items
      .filter((i) => i.tripId === trip.id && i.category === "flight" && i.status !== "dismissed" && i.flight?.from)
      .sort((a, b) => (a.flight?.departure ?? a.dates.start ?? "9").localeCompare(b.flight?.departure ?? b.dates.start ?? "9"));
    const from = flights[0]?.flight?.from?.trim();
    const key = cityKeyOf(from);
    if (!from || !key) continue;
    const at = counts.get(key) ?? { name: from, n: 0 };
    at.n++;
    counts.set(key, at);
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (best) return best.name;
  const main = passport ? MAIN_CITY[passport.toUpperCase()] : undefined;
  return main ? L(main[0], main[1]) : null;
}

/** Places to suggest for "Bana ilham ver", by the styles picked. */
const INSPIRE: Partial<Record<StyleId, string[]>> = {
  beach: ["Bali", "Phuket", "Maldivler"],
  nature: ["Madeira", "İzlanda", "Kapadokya"],
  culture: ["Roma", "Kyoto", "Kahire"],
  romantic: ["Santorini", "Paris", "Lizbon"],
  food: ["Lizbon", "Tokyo", "Barselona"],
  calm: ["Madeira", "Bali", "Sri Lanka"],
  adventure: ["İzlanda", "Vietnam", "Meksika"],
  city: ["Tokyo", "New York", "Barselona"],
  nightlife: ["Barselona", "Berlin", "Bangkok"],
  luxury: ["Maldivler", "Dubai", "Santorini"],
  family: ["Antalya", "Madeira", "Barselona"],
  active: ["Madeira", "İzlanda", "Kapadokya"],
};
export function inspirations(styles: StyleId[]): string[] {
  const picks = styles.length ? styles.flatMap((s) => INSPIRE[s] ?? []) : ["Bali", "Lizbon", "Tokyo", "Madeira", "Santorini"];
  return [...new Set(picks)].slice(0, 5).map((p) => placeOf(p).place);
}

/** A month's beginning (the 1st), middle (the 15th) and end (a week before its last day), from today on. */
export function monthParts(anyDay: string, today: string): { part: MonthPart; date: string }[] {
  const [y, m] = anyDay.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: { part: MonthPart; date: string }[] = [
    { part: "begin", date: `${y}-${pad(m)}-01` },
    { part: "mid", date: `${y}-${pad(m)}-15` },
    { part: "end", date: `${y}-${pad(m)}-${pad(last - 6)}` },
  ];
  return out.filter((d) => d.date > today);
}

/** "15 Aralık" for a day. */
export const dayText = (date: string) => formatDateRange(date, null);

/** Months to start in: this one while it's not half gone, then the next five. */
function monthChips(today: string): Chip[] {
  const [, m, d] = today.split("-").map(Number);
  const first = d <= 15 ? m : m + 1;
  return Array.from({ length: 6 }, (_, k) => ((first - 1 + k) % 12) + 1).map((month) => ({
    label: monthName(month),
    answer: { q: "start" as const, date: monthStart(month, today), approx: true },
  }));
}

export const routeText = (r: StartRoute) => {
  const stops = r.stops.map((x) => `${x.city} ${x.nights}`).join(" · ");
  return `${stops} ${L("gece", r.stops.length === 1 && r.stops[0].nights === 1 ? "night" : "nights")}`;
};

/** A Turkish proper name with "to": "Bali'ye", "Porto'ya", "Paris'e", "Porto ve Madeira Gezisi'ne". */
export function dative(name: string): string {
  const n = name.trim();
  if (!n) return n;
  const lower = n.toLocaleLowerCase("tr-TR");
  const last = [...lower].reverse().find((ch) => /[aeıioöuüâîû]/.test(ch));
  const front = last != null && /[eiöüî]/.test(last);
  // A possessive ending ("Gezisi") takes an "n": Gezisi'ne.
  if (/(si|sı|su|sü)$/.test(lower) && /gezisi$|turu$|tatili$/.test(lower)) return `${n}'n${front ? "e" : "a"}`;
  const vowelEnd = /[aeıioöuü]$/.test(lower);
  return `${n}'${vowelEnd ? "y" : ""}${front ? "e" : "a"}`;
}

/** The question on screen, its words and its quick answers. */
export function questionOf(s: StartState, q: QuestionId, ctx: StartCtx): Question {
  const tr = lang() === "tr";
  switch (q) {
    case "guess": {
      const g = s.guess;
      const place = g?.place.place ?? "";
      return {
        id: q,
        text: L(`${place} ${questionParticle(place)} demek istedin?`, `Did you mean ${place}?`),
        chips: [
          { label: L("Evet", "Yes"), answer: { q: "guess", accept: true } },
          { label: L(`Hayır, ${g?.typed ?? ""}`, `No, ${g?.typed ?? ""}`), answer: { q: "guess", accept: false } },
        ],
      };
    }
    case "where": {
      if (s.mode === "inspire") {
        return {
          id: q, text: L("Sana uyabilecek birkaç yer. Biri hoşuna gitti mi, ya da aklında başka bir yer var mı?", "A few places that could suit you. Like one, or have somewhere else in mind?"),
          chips: inspirations(s.styles).map((p) => ({ label: p, answer: { q: "where", ...placeOf(p) } })), other: true,
        };
      }
      const text = s.mode === "road" ? L("Yol gezisi nerede olsun?", "Where should the road trip be?") : s.mode === "lastminute" ? L("Nereye kaçalım?", "Where shall we escape to?") : L("Nereye gidiyoruz?", "Where are we going?");
      return { id: q, text, chips: [], other: false };
    }
    case "from": {
      const common = tr ? ORIGINS_TR : ORIGINS_EN;
      // The guess in the chat's language ("Istanbul" from an English board is "İstanbul" in a Turkish chat), once.
      const guess = ctx.fromGuess ? placeOf(ctx.fromGuess).place : null;
      const list = [...new Map([guess, ...common].filter((c): c is string => !!c).map((c) => [squash(c), c])).values()].slice(0, 4);
      return { id: q, text: L("Nereden yola çıkıyorsun?", "Where are you leaving from?"), chips: list.map((city) => ({ label: city, answer: { q: "from", city } })), other: true };
    }
    case "who":
      return {
        id: q, text: L("Kimle gidiyorsun?", "Who's coming?"),
        chips: ([["solo", L("Yalnız", "Just me")], ["partner", L("Partnerimle", "With my partner")], ["friends", L("Arkadaşlarla", "With friends")], ["family", L("Ailemle", "With family")]] as const).map(
          ([kind, label]) => ({ label, answer: { q: "who" as const, kind } }),
        ),
      };
    case "names":
      return {
        id: q,
        text: s.who?.kind === "partner" ? L("Partnerinin adı ne? (istersen)", "What's your partner's name? (optional)") : L("Kimler geliyor? Adlarını yazabilirsin (istersen).", "Who's coming? You can type their names (optional)."),
        chips: [],
      };
    case "duration": {
      const where = s.where?.place;
      const text = where ? L(`${where} için kaç gün?`, `How long for ${where}?`) : L("Kaç gün?", "How long?");
      const lengths: Duration[] = s.mode === "lastminute"
        ? [{ unit: "weekend", n: 1 }, { unit: "night", n: 3 }, { unit: "night", n: 4 }, { unit: "week", n: 1 }]
        : [{ unit: "weekend", n: 1 }, { unit: "week", n: 1 }, { unit: "day", n: 10 }, { unit: "week", n: 2 }, { unit: "week", n: 3 }, { unit: "month", n: 1 }];
      return { id: q, text, chips: lengths.map((duration) => ({ label: durationText(duration), answer: { q: "duration", duration } })) };
    }
    case "start": {
      const chips: Chip[] = s.mode === "lastminute"
        ? [
            { label: L("Bu hafta sonu", "This weekend"), answer: { q: "start", date: weekendStart(ctx.today), approx: false } },
            { label: L("Gelecek hafta sonu", "Next weekend"), answer: { q: "start", date: weekendStart(ctx.today, true), approx: false } },
          ]
        : monthChips(ctx.today);
      return { id: q, text: L("Ne zaman başlıyor?", "When does it start?"), hint: L("Bir ay seç ya da günü işaretle.", "Pick a month or mark the day."), chips, date: true };
    }
    case "day": {
      const month = Number((s.start?.date ?? ctx.today).slice(5, 7));
      const days = monthParts(s.start?.date ?? ctx.today, ctx.today);
      const labels: Record<MonthPart, string> = { begin: L("Ayın başı", "Early in the month"), mid: L("Ortası", "Mid-month"), end: L("Sonu", "Late in the month") };
      return {
        id: q,
        text: L(`${monthName(month)} ayının hangi günü başlıyor?`, `Which day in ${monthName(month)} does it start?`),
        hint: L("Günü seç; bilmiyorsan ayın başı, ortası ya da sonu.", "Pick the day; if you don't know yet, early, mid or late in the month."),
        chips: days.map(({ part, date }) => ({ label: labels[part], answer: { q: "day" as const, date, part } })),
        date: true,
      };
    }
    case "want":
      return {
        id: q, text: L("Bu gezide en çok ne istiyorsun? (birden çok seçebilirsin)", "What are you after on this trip? (pick as many as you like)"),
        chips: [], multi: true,
      };
    case "route": {
      const where = s.where?.place ?? "";
      if (s.editingRoute || !s.route) {
        return {
          id: q,
          text: L(`Nasıl olsun? Şehirleri ve geceleri yaz (ör. ${where ? `${where} ${totalNights(s) ?? 7}` : "Ubud 12, Canggu 19"}).`, `How should it go? Type the places and nights (e.g. ${where ? `${where} ${totalNights(s) ?? 7}` : "Ubud 12, Canggu 19"}).`),
          chips: where ? [{ label: L(`Tek durak: ${where}`, `One stop: ${where}`), answer: { q: "route", action: "single" } }] : [],
        };
      }
      const many = s.route.stops.length > 1;
      return {
        id: q,
        text: many ? L(`Rota önerim: ${routeText(s.route)}. Bu olsun mu?`, `My route: ${routeText(s.route)}. Shall we go with it?`) : L(`Tek durak öneriyorum: ${routeText(s.route)}. Bu olsun mu?`, `I'd keep it to one stop: ${routeText(s.route)}. Go with it?`),
        hint: many ? L("Geceler buna göre bölünür; sonra sohbetten değişir.", "The nights are split this way; you can change it later in the chat.") : undefined,
        chips: [
          { label: L("Bu olsun", "Go with it"), answer: { q: "route", action: "accept" } },
          { label: L("Değiştir", "Change it"), answer: { q: "route", action: "change" } },
        ],
      };
    }
  }
}

/** What the last answer added, said back in a few words before the next question ("Harika, Bali!"). */
export function ackText(before: StartState, after: StartState, ctx: StartCtx): string {
  const parts: string[] = [];
  if (after.where && after.where.place !== before.where?.place) parts.push(after.where.place);
  if (after.who && JSON.stringify(after.who) !== JSON.stringify(before.who)) {
    const w = whoText(after.who, ctx.myName);
    if (w) parts.push(w);
  }
  const datesBefore = whenText(before);
  const datesAfter = whenText(after);
  // Only dates worth saying back (a length with no start yet is asked next, not said).
  if (datesAfter && datesAfter !== datesBefore && after.start && !after.start.part) parts.push(datesAfter);
  if (after.from && after.from !== before.from && parts.length) parts.push(L(`${after.from}${fromSuffix(after.from)}`, `from ${after.from}`));
  if (after.route?.confirmed && !before.route?.confirmed) return L("Tamam, rota bu.", "Great, that's the route.");
  // A part of the month taken as the start: said, so it can be changed.
  if (after.start?.part && (after.start.date !== before.start?.date || !before.start?.part)) {
    const d = dayText(after.start.date);
    return L(`${d}'${dayAccusative(after.start.date)} başlangıç aldım, değiştirebilirsin.`, `I've taken ${d} as the start; you can change it.`);
  }
  if (!parts.length) return "";
  // The place just said gets a word of its own (a small table of popular places; the model writes richer ones).
  const newPlace = Boolean(after.where && after.where.place !== before.where?.place);
  const colour = newPlace ? colourLine(after, ctx) : null;
  if (parts.length === 1 && newPlace) return colour ?? L(`Harika, ${after.where!.place}!`, `Great, ${after.where!.place}!`);
  const got = L(`Not aldım: ${parts.join(" · ")}.`, `Got it: ${parts.join(" · ")}.`);
  return colour ? `${colour} ${got}` : got;
}

/** A few words for popular places (no key, or until the model's line comes): by country, a few places of their own. */
const COLOUR: Record<string, [string, string]> = {
  TH: ["Bangkok'un sokak lezzetleri, Chiang Mai'nin sisli dağları ve güneyin cennet adaları", "Bangkok's street food, the misty mountains of Chiang Mai and idyllic islands down south"],
  ID: ["Ubud'un pirinç terasları, tapınaklar ve okyanusta gün batımları", "Ubud's rice terraces, temples and sunsets over the ocean"],
  PT: ["Lizbon'un tepeleri, Porto'nun şarap mahzenleri ve Atlantik kıyıları", "Lisbon's hills, Porto's wine cellars and the Atlantic coast"],
  JP: ["Tokyo'nun ışıkları, Kyoto'nun tapınakları ve unutulmaz sofralar", "Tokyo's lights, Kyoto's temples and unforgettable food"],
  IT: ["Roma'nın tarihi, Toskana'nın tepeleri ve her köşede iyi yemek", "Rome's history, the Tuscan hills and good food on every corner"],
  GR: ["beyaz adalar, berrak koylar ve uzun Ege akşamları", "white islands, clear coves and long Aegean evenings"],
  ES: ["Barselona'nın sokakları, tapas akşamları ve güneşli kıyılar", "Barcelona's streets, tapas evenings and sunny coasts"],
  TR: ["masmavi koylar, antik kentler ve bereketli sofralar", "turquoise coves, ancient cities and generous tables"],
  FR: ["Paris'in kafeleri, Provence'ın lavanta tarlaları ve Riviera", "Paris cafés, the lavender fields of Provence and the Riviera"],
  VN: ["Hanoi'nin sokakları, Ha Long'un kayalıkları ve taze erişteler", "Hanoi's streets, the cliffs of Ha Long and fresh noodles"],
  MX: ["renkli kasabalar, Maya kalıntıları ve Karayip kıyıları", "colourful towns, Maya ruins and Caribbean beaches"],
  IS: ["şelaleler, buzullar ve kuzey ışıkları", "waterfalls, glaciers and the northern lights"],
  LK: ["çay tepeleri, safariler ve sakin sahiller", "tea hills, safaris and quiet beaches"],
  MV: ["su üstü villalar ve turkuaz lagünler", "overwater villas and turquoise lagoons"],
};
const PLACE_COLOUR: Record<string, [string, string]> = {
  kohphangan: ["palmiyeli koylar, orman şelaleleri ve gün batımında sakin kumsallar", "palm-fringed coves, jungle waterfalls and quiet sunset beaches"],
  bali: ["Ubud'un pirinç terasları, tapınaklar ve okyanusta gün batımları", "Ubud's rice terraces, temples and sunsets over the ocean"],
};

/** "Sabine ile Koh Phangan kulağa harika geliyor: palmiyeli koylar…" for a place in the table; null for any other. */
export function colourLine(s: Pick<StartState, "where" | "who">, ctx: Pick<StartCtx, "myName">): string | null {
  if (!s.where) return null;
  const code = s.where.code ?? countryCodeOfName(s.where.country) ?? countryCodeOfName(s.where.place);
  const words = PLACE_COLOUR[squash(s.where.place)] ?? (code ? COLOUR[code] : undefined);
  if (!words) return null;
  const names = (s.who?.kind === "solo" ? [] : (s.who?.names ?? [])).filter((n) => n !== ctx.myName);
  const place = s.where.place;
  return L(
    `${names.length ? `${names.join(", ")} ile ` : ""}${place} kulağa harika geliyor: ${words[0]}.`,
    `${place}${names.length ? ` with ${names.join(", ")}` : ""} sounds incredible: ${words[1]}.`,
  );
}

/** "15 Aralık'ı", "1 Ocak'ı", "25 Eylül'ü": the month's own ending. */
function dayAccusative(date: string): string {
  const m = Number(date.slice(5, 7));
  return ["ı", "ı", "ı", "ı", "ı", "ı", "u", "u", "ü", "i", "ı", "ı"][m - 1];
}

/** "'dan" / "'den" / "'tan" / "'ten" after a place. */
function fromSuffix(name: string): string {
  const lower = name.toLocaleLowerCase("tr-TR");
  const last = [...lower].reverse().find((ch) => /[aeıioöuü]/.test(ch));
  const front = last != null && /[eiöü]/.test(last);
  const hard = /[fstkçşhp]$/.test(lower);
  return `'${hard ? "t" : "d"}${front ? "e" : "a"}n`;
}

/** The next assistant line: what was understood, then the next question (or "ready"). */
export function replyText(before: StartState, after: StartState, ctx: StartCtx, drawing = false): string {
  return [ackText(before, after, ctx), nextLine(after, ctx, drawing)].filter(Boolean).join(" ");
}

/** The route is the question but its proposal is still being drawn (rev 3): said, and the chat goes on meanwhile. */
export const drawingLine = () =>
  L(
    "Rotayı çiziyorum; hazır olunca burada öneririm. Bu arada istersen oluşturabilir ya da eklemek istediğini yazabilirsin.",
    "I'm drawing the route and will suggest it here when it's ready. Meanwhile you can generate, or type anything you'd like to add.",
  );

/** The question asked next, or "ready" when none is left; `drawing`: the route's proposal is on its way. */
export function nextLine(after: StartState, ctx: StartCtx, drawing = false): string {
  const q = nextQuestion(after);
  if (q === "route" && drawing && !after.route && !after.editingRoute) return drawingLine();
  if (q) return questionOf(after, q, ctx).text;
  return canGenerate(after)
    ? L("Hazırım. Gezimi oluştur'a bas; eklemek istediğin bir şey varsa yaz.", "I'm ready. Press Generate my trip, or type anything you'd like to add.")
    : L(`Oluşturmak için ${missingForGenerate(after).join(" ve ")} gerekli; listeden ona basabilirsin.`, `To generate I need ${missingForGenerate(after).join(" and ")}; press it in the list.`);
}

/**
 * Whether the model may write this reply: not when the code says something back that must be exact (a guessed
 * start day, the route agreed) or the route is proposed (its stops and nights are the code's).
 */
export function modelMayReply(before: StartState, after: StartState): boolean {
  if (after.route?.confirmed && !before.route?.confirmed) return false;
  if (after.start?.part && (after.start.date !== before.start?.date || !before.start?.part)) return false;
  return nextQuestion(after) !== "route";
}

/**
 * The reply with the model's words: its line, then its question when it asks what the code asks next (else the
 * code's question); the code's line when the model's didn't hold. The route and "ready" are always the code's.
 */
export function modelReplyText(before: StartState, after: StartState, ctx: StartCtx, reply: { text: string; question: string | null } | null, askedFor: QuestionId | null, drawing = false): string {
  if (!reply || !modelMayReply(before, after)) return replyText(before, after, ctx, drawing);
  const q = nextQuestion(after);
  const question = q && q === askedFor && reply.question ? reply.question : nextLine(after, ctx, drawing);
  return `${reply.text} ${question}`;
}

export const NOT_UNDERSTOOD = () =>
  L("Bunu anlayamadım. Çiplerden seçebilir, başka türlü yazabilir ya da Atla diyebilirsin.", "I didn't catch that. Pick a chip, put it another way, or press Skip.");

// --- the checklist -----------------------------------------------------------------------------------------------

export function whoText(who: StartState["who"], myName: string | null): string {
  if (!who) return "";
  const n = peopleCount(who);
  const count = n ? L(`${n} kişi`, n === 1 ? "1 person" : `${n} people`) : "";
  if (who.kind === "solo") return L("Yalnız · 1 kişi", "Just me · 1 person");
  if (who.names.length) {
    const names = myName ? [myName, ...who.names] : who.names;
    const text = myName ? (names.length === 2 ? `${names[0]} & ${names[1]}` : names.join(", ")) : L(`${who.names.join(", ")} ile`, `with ${who.names.join(", ")}`);
    return [text, count].filter(Boolean).join(" · ");
  }
  const word = { partner: L("Partnerinle", "With your partner"), friends: L("Arkadaşlarla", "With friends"), family: L("Ailenle", "With family") };
  return [who.kind ? word[who.kind] : "", count].filter(Boolean).join(" · ");
}

/** How many travel: one alone, two with a partner, everyone named and the traveller; null when not said. */
export function peopleCount(who: StartState["who"]): number | null {
  if (!who) return null;
  if (who.kind === "solo") return 1;
  if (who.names.length) return who.names.length + 1;
  if (who.kind === "partner") return 2;
  return null;
}

export function whenText(s: Pick<StartState, "start" | "duration">): string {
  const dates = tripDates(s);
  const n = totalNights(s);
  if (dates && s.start && n != null) {
    const nights = L(`${n} gece`, `${n} night${n === 1 ? "" : "s"}`);
    // A month only: no day yet (asked next). A part of the month: the dates, said to be a guess.
    if (s.start.approx && !s.start.part) return `${monthName(Number(s.start.date.slice(5, 7)))} · ${nights}`;
    return `${formatDateRange(dates.start, dates.end)} · ${nights}${s.start.approx ? L(" (yaklaşık)", " (roughly)") : ""}`;
  }
  if (s.duration) return `${durationText(s.duration)} · ${L("başlangıç?", "start?")}`;
  if (s.start) return s.start.approx ? monthName(Number(s.start.date.slice(5, 7))) : formatDateRange(s.start.date, null);
  return "";
}

/** Only the ids on the list (a draft or an answer with another word can't break the screen). */
export const knownStyles = (ids: readonly string[] | undefined): StyleId[] => (Array.isArray(ids) ? ids.filter((id): id is StyleId => typeof id === "string" && Object.hasOwn(STYLES, id)) : []);

/** A budget in words, never the style "Lüks" again: Ekonomik · Orta bütçe · Yüksek bütçe. */
const BUDGET_WORDS: Record<BudgetLevel, () => string> = {
  low: () => L("Ekonomik", "Budget"),
  mid: () => L("Orta bütçe", "Mid-range"),
  high: () => L("Yüksek bütçe", "High budget"),
};
export const budgetWord = (level: BudgetLevel): string => BUDGET_WORDS[level]();
/** The budget's quick answers: Ekonomik · Orta · Yüksek bütçe (Budget · Mid-range · High budget). */
export const budgetChips = (): [BudgetLevel, string][] => [["low", L("Ekonomik", "Budget")], ["mid", L("Orta", "Mid-range")], ["high", L("Yüksek bütçe", "High budget")]];

export function wantText(s: Pick<StartState, "styles" | "budget">): string {
  const budget = s.budget && Object.hasOwn(BUDGET_WORDS, s.budget) ? budgetWord(s.budget) : "";
  return [knownStyles(s.styles).map((id) => STYLES[id]()).join(", "), budget].filter(Boolean).join(" · ");
}

export interface ChecklistRow {
  id: SlotId;
  label: string;
  value: string;
  done: boolean;
  /** The question a press on the row asks again. */
  ask: QuestionId;
  /** Needed for "Gezimi oluştur". */
  required: boolean;
  skipped: boolean;
}

export function checklist(s: StartState, ctx: StartCtx): ChecklistRow[] {
  const total = totalNights(s);
  const rows: ChecklistRow[] = [
    { id: "where", label: L("NEREYE", "WHERE TO"), value: s.where ? [...new Set([s.where.place, s.where.country])].filter(Boolean).join(" · ") : L("Nereye gidiyoruz?", "Where are we going?"), done: !!s.where, ask: "where", required: true, skipped: s.skipped.includes("where") },
    { id: "from", label: L("NEREDEN", "WHERE FROM"), value: s.from ?? L("Nereden yola çıkıyorsun?", "Where are you leaving from?"), done: !!s.from, ask: "from", required: false, skipped: s.skipped.includes("from") },
    { id: "who", label: L("KİMLE", "WHO'S COMING"), value: whoText(s.who, ctx.myName) || L("Kimle gidiyorsun?", "Who's coming?"), done: !!s.who, ask: "who", required: false, skipped: s.skipped.includes("who") },
    {
      id: "when", label: L("NE ZAMAN", "WHEN"), value: whenText(s) || L("Ne zaman, kaç gün?", "When, and for how long?"), done: !!tripDates(s) && !monthOnly(s),
      ask: !s.duration ? "duration" : "start", required: true, skipped: s.skipped.includes("duration") || s.skipped.includes("start"),
    },
    { id: "want", label: L("NE İSTİYORSUN", "WHAT YOU'RE AFTER"), value: wantText(s) || L("Sence ne yapsın bu gezi?", "What should this trip be about?"), done: s.wantDone && Boolean(s.styles.length || s.budget), ask: "want", required: false, skipped: s.skipped.includes("want") },
    {
      id: "route", label: L("ROTA", "ROUTE"),
      value: s.route?.confirmed ? routeText(s.route) : s.route ? L(`Öneri: ${routeText(s.route)}`, `Suggested: ${routeText(s.route)}`) : s.where && total ? L("Sırası gelince önereceğim", "I'll suggest one when we get there") : L("Nereye ve süre belli olunca önereceğim", "I'll suggest one once where and how long are known"),
      done: !!s.route?.confirmed, ask: "route", required: false, skipped: s.skipped.includes("route"),
    },
  ];
  return rows;
}

export const progressOf = (rows: ChecklistRow[]) => ({ done: rows.filter((r) => r.done).length, total: rows.length });

// --- the route ------------------------------------------------------------------------------------------------

/** One stop: the place itself for all the nights. */
export function singleRoute(s: Pick<StartState, "where" | "duration" | "start">): StartRoute | null {
  const total = totalNights(s);
  if (!s.where || !total) return null;
  return { stops: [{ city: s.where.place, nights: total }], arrive: null, leave: null, confirmed: false, source: "single" };
}

/** The country a destination is when it is one ("Sri Lanka" → LK); null for a city, an island or a region. */
function countryItself(where: Place): string | null {
  const code = countryCodeOfName(where.place);
  return code && (!where.code || where.code === code) ? code : null;
}

/**
 * The classic circuit for a week or more in a popular country (or Bali), fitted to the nights and the style (rev 3):
 * proposed at once, without the model, which refines it when its own comes and differs. Null for anything else.
 */
export function circuitRoute(s: Pick<StartState, "where" | "duration" | "start" | "styles">): StartRoute | null {
  const total = totalNights(s);
  if (!s.where || !total || total < 7) return null;
  const region = squash(s.where.place);
  const code = Object.hasOwn(CIRCUITS, region) ? region : countryItself(s.where);
  const circuit = code && Object.hasOwn(CIRCUITS, code) ? CIRCUITS[code] : null;
  if (!code || !circuit) return null;
  const fit = fitCircuit(circuit, total, s.styles);
  if (!fit) return null;
  const stopCode = s.where.code ?? (code.length === 2 ? code : null);
  return { stops: fit.stops.map((x) => ({ ...x, ...(stopCode ? { code: stopCode } : {}) })), arrive: fit.arrive, leave: fit.leave, confirmed: false, source: "circuit" };
}

/**
 * The route "Oluştur" builds (rev 3): the one agreed; else, unless the route was skipped, the proposal on screen (the
 * model's, kept or prepared), else the classic circuit, else one stop. Agreed by pressing it.
 */
export function routeForGenerate(s: StartState): StartRoute | null {
  if (s.route?.confirmed) return s.route;
  const single = singleRoute(s);
  if (s.skipped.includes("route")) return single ? { ...single, confirmed: true } : null;
  const kept = preparedRoute(s);
  const best = (s.route && s.route.source !== "single" ? s.route : null) ?? (kept?.source === "ai" ? kept : null) ?? circuitRoute(s) ?? s.route ?? single;
  return best ? { ...best, confirmed: true } : null;
}

/** Short trips and single cities are one stop; the model is asked only for a longer trip to a country, an island or a region. */
export function wantsRouteAdvice(s: Pick<StartState, "where" | "duration" | "start">): boolean {
  const total = totalNights(s) ?? 0;
  if (!s.where || total < 6) return false;
  const known = knownPlaceOf(s.where.place);
  return !known?.city;
}

export const routeSchema = z.object({
  stops: z.array(z.object({ city: z.string(), nights: z.number(), country_code: z.string() })),
  arrival_airport_city: z.string(),
  departure_airport_city: z.string(),
});
export type RawRoute = z.infer<typeof routeSchema>;

export const routeSystem = () =>
  `${L(
    "Bu tarz ve gece sayısı için yerin klasik rotasını öner: 1-4 gerçek şehir, kasaba ya da ada, gezilecek sırayla; geceler tam sayı, toplamı tam verilen gece. Bir ülke ya da büyük bölgede 7+ gece için 2-4 durak (ör. Sri Lanka 14 gece: Sigiriya 3, Kandy 3, Ella 3, Mirissa 5); bir şehir tek durak. Yurt dışında yola çıkılan şehir durak olmaz. country_code: durağın ISO 3166-1 alpha-2 kodu. arrival_airport_city / departure_airport_city: ilk uçuşun indiği, dönüşün kalktığı havalimanlı şehir (ör. Kolombo); bilmiyorsan \"\".",
    "Suggest the place's classic route for this style and length: 1-4 real cities, towns or islands in travel order; whole nights adding up to exactly the total. For 7+ nights in a country or large region, 2-4 stops (e.g. Sri Lanka 14 nights: Sigiriya 3, Kandy 3, Ella 3, Mirissa 5); a city is one stop. Abroad, the city they leave from is never a stop. country_code: the stop's ISO 3166-1 alpha-2 code. arrival_airport_city / departure_airport_city: the city with the airport the first flight lands in and the flight home leaves from (e.g. Colombo); \"\" if unsure.",
  )}\n${L("Yer adlarını Türkçe yaz.", "Write the place names in English.")}`;

export function routePrompt(s: StartState): string {
  const total = totalNights(s);
  return [
    "<route_request>",
    `${L("Yer", "Place")}: ${s.where?.place ?? ""}${s.where?.country && s.where.country !== s.where.place ? ` (${s.where.country})` : ""}`,
    s.from ? `${L("Yola çıkış", "Leaving from")}: ${s.from}` : "",
    `${L("Toplam gece", "Total nights")}: ${total}`,
    s.start ? `${L("Başlangıç", "Start")}: ${s.start.date}` : "",
    s.styles.length ? `${L("Tarz", "Style")}: ${s.styles.join(", ")}` : "",
    s.mode === "road" ? L("Yol gezisi (araçla).", "A road trip (by car).") : "",
    "</route_request>",
  ].filter(Boolean).join("\n");
}

const STOP_NAME = /^[\p{L}][\p{L} .'’-]{1,40}$/u;

/** The model's route, kept only when it holds: 1–4 distinct real-looking names, whole nights adding up to the total. */
export function acceptRoute(raw: RawRoute, total: number, origin: string | null = null, whereCode: string | null = null): StartRoute | null {
  const stops: RouteStop[] = (raw.stops ?? []).map((x) => {
    const code = isoCode(x.country_code);
    return { city: (x.city ?? "").trim(), nights: x.nights, ...(code ? { code } : {}) };
  });
  if (stops.length < 1 || stops.length > 4) return null;
  // Abroad, the city they leave from is never a stop (item 2: the route comes from the destination, never the
  // origin); a trip at home may pass through it (Ankara → İstanbul → Bodrum, all in Türkiye).
  const originCode = origin ? (knownPlaceOf(origin) ? knownCode(knownPlaceOf(origin)!) : countryCodeOfName(origin)) : null;
  const domestic = Boolean(originCode && whereCode && originCode === whereCode);
  if (origin && !domestic && stops.some((x) => samePlace(x.city, origin))) return null;
  if (stops.some((x) => !STOP_NAME.test(x.city) || !Number.isInteger(x.nights) || x.nights < 1)) return null;
  if (new Set(stops.map((x) => cityKeyOf(x.city))).size !== stops.length) return null;
  if (stops.reduce((a, b) => a + b.nights, 0) !== total) return null;
  const airport = (v: string) => (STOP_NAME.test(v.trim()) ? v.trim() : null);
  return { stops, arrive: airport(raw.arrival_airport_city ?? ""), leave: airport(raw.departure_airport_city ?? ""), confirmed: false, source: "ai" };
}

/** "Ubud 12, Canggu 19" typed: the stops, or why it can't be one (the nights must add up). */
export function parseRouteText(text: string, total: number): { route: StartRoute } | { error: string } {
  const parts = [...text.matchAll(/([\p{L}][\p{L} .'’-]*?)\s*[:\-–]?\s*(\d{1,3})(?:\s*(?:gece|gün|gun|nights?|days?))?/gu)];
  const stops = parts.map((m) => ({ city: bareName(m[1].replace(/\b(ve|and|sonra|then)\b/gi, "").trim()), nights: Number(m[2]) })).filter((x) => x.city);
  if (!stops.length) return { error: L("Şehirleri gece sayısıyla yaz, ör. \"Ubud 12, Canggu 19\".", "Type each place with its nights, e.g. \"Ubud 12, Canggu 19\".") };
  if (stops.length > 4) return { error: L("En fazla 4 durak olabilir.", "At most 4 stops.") };
  const sum = stops.reduce((a, b) => a + b.nights, 0);
  if (sum !== total) return { error: L(`Geceler toplamı ${total} olmalı (yazdığın: ${sum}).`, `The nights must add up to ${total} (you wrote ${sum}).`) };
  return {
    route: {
      stops: stops.map((x) => {
        const code = knownPlaceOf(x.city) ? placeOf(x.city).code : null;
        return { city: capitalizeWords(x.city), nights: x.nights, ...(code ? { code } : {}) };
      }),
      arrive: null,
      leave: null,
      confirmed: true,
      source: "user",
    },
  };
}

// --- made while chatting (item 7): kept in the draft, never a trip until "Oluştur" ------------------------------

/** The destination what's prepared is for ("kohphangan|TH"). */
export const whereKey = (s: Pick<StartState, "where">): string | null => (s.where ? `${squash(s.where.place)}|${s.where.code ?? ""}` : null);

/** The nights once they won't change by themselves: a length in months waits for its start (a month is 28 to 31 nights). */
export function stableNights(s: Pick<StartState, "where" | "duration" | "start">): number | null {
  if (!s.where || !s.duration || (s.duration.unit === "month" && !s.start)) return null;
  return totalNights(s);
}

/** The place and nights a route proposal is for ("kohphangan|TH|31"). */
export const routeKey = (s: Pick<StartState, "where" | "duration" | "start">): string | null => {
  const w = whereKey(s);
  const n = totalNights(s);
  return w && n ? `${w}|${n}` : null;
};

/** The proposal kept for the place and nights now; undefined when none was asked for them. */
export function preparedRoute(s: StartState): StartRoute | null | undefined {
  const k = routeKey(s);
  return k && Object.hasOwn(s.prepared.routes, k) ? s.prepared.routes[k] : undefined;
}

/**
 * The route to ask the model for now, in the background (its key), or null: the place and the nights settled, a
 * place that can be a route (wantsRouteAdvice), none asked for them before. One call per distinct place and nights.
 */
export function routeToPrepare(s: StartState): string | null {
  // Not while a loosely spelt place waits for its yes (the destination may still change).
  if (s.guess || stableNights(s) == null || !wantsRouteAdvice(s) || s.route?.confirmed) return null;
  const k = routeKey(s);
  return k && !Object.hasOwn(s.prepared.routes, k) ? k : null;
}

/** At most this many proposals are kept (the newest). */
const MAX_ROUTES = 6;

/** A proposal back: kept for its key, and the interview's proposal when it is still for the place and nights now. */
export function withPreparedRoute(s: StartState, key: string, route: StartRoute | null): StartState {
  const routes = { ...s.prepared.routes, [key]: route };
  for (const old of Object.keys(routes).slice(0, Math.max(0, Object.keys(routes).length - MAX_ROUTES))) delete routes[old];
  const next: StartState = { ...s, prepared: { ...s.prepared, routes } };
  if (!route || routeKey(next) !== key) return next;
  if (!next.route) return { ...next, route: { ...route, confirmed: false } };
  // The model's proposal refines the classic circuit shown meanwhile (never one agreed, typed or edited).
  const refines = route.source === "ai" && next.route.source === "circuit" && !next.route.confirmed && !next.editingRoute && routeText(route) !== routeText(next.route);
  return refines ? { ...next, route: { ...route, confirmed: false } } : next;
}

/** The places to show and make photos for: the destination, the route's stops, its country (four at most). */
export function photoPlaces(s: Pick<StartState, "where" | "route">): string[] {
  if (!s.where) return [];
  const names = [s.where.place, ...(s.route?.stops ?? []).map((x) => x.city), s.where.country ?? ""].filter(Boolean);
  return [...new Map(names.map((n) => [squash(n), n])).values()].slice(0, 4);
}

/**
 * What to ask the photo search for a place (rev 3): a country as its landscape ("Sri Lanka landscape"), a stop with
 * its country so a town isn't a person ("Ella Sri Lanka"; Wikipedia "Ella, Sri Lanka" first), the destination as it
 * is named. English names, which the search knows best.
 */
export function photoQuery(place: string, s: Pick<StartState, "where">): { query: string; titles: string[] } {
  const own = countryCodeOfName(place);
  if (own) return { query: `${regionName(own, "en") ?? place} landscape`, titles: [] };
  const code = s.where?.code ?? countryCodeOfName(s.where?.country) ?? null;
  const country = code ? regionName(code, "en") : null;
  if (!country || samePlace(place, s.where?.place)) return { query: place, titles: [] };
  const en = englishName(place) ?? knownPlaceOf(place)?.en ?? place;
  return { query: `${en} ${country}`, titles: [`${en}, ${country}`] };
}

/** The places whose photo hasn't been looked for yet (for this destination). */
export function photosToFind(s: StartState): string[] {
  if (s.guess) return [];
  const k = whereKey(s);
  const have = s.prepared.photos?.for === k ? s.prepared.photos.urls : {};
  return photoPlaces(s).filter((p) => !Object.hasOwn(have, p));
}

/** Photos found (null: looked for, none), kept when they are still for the destination now. */
export function withPhotos(s: StartState, forKey: string, found: Record<string, string | null>): StartState {
  if (whereKey(s) !== forKey) return s;
  const urls = { ...(s.prepared.photos?.for === forKey ? s.prepared.photos.urls : {}), ...found };
  return { ...s, prepared: { ...s.prepared, photos: { for: forKey, urls } } };
}

/** The photos ready for the places now, in their order. */
export function preparedPhotos(s: StartState): { place: string; url: string }[] {
  const urls = s.prepared.photos?.for === whereKey(s) ? s.prepared.photos.urls : {};
  return photoPlaces(s).flatMap((place) => (urls[place] ? [{ place, url: urls[place]! }] : []));
}

/** What would be made, in short: the rules' suggestions are worked out again only when it changes. */
export function rulesKey(s: StartState): string | null {
  const c = creationOf(s);
  if (!c) return null;
  return `${whereKey(s)}#${JSON.stringify([c.dates, c.stays.map((x) => [x.city, x.date, x.end_date]), c.travel.map((x) => [x.kind, x.from, x.to, x.date]), c.travellers?.count ?? null])}`;
}

/** Photos and suggestions prepared for another destination are dropped (the route keeps its own key). */
function keepPrepared(s: StartState): StartState {
  const p = s.prepared ?? noPrep();
  const k = whereKey(s);
  const photos = p.photos && p.photos.for === k ? p.photos : null;
  const rules = p.rules && k && p.rules.key.startsWith(`${k}#`) ? p.rules : null;
  if (photos === p.photos && rules === p.rules && s.prepared) return s;
  return { ...s, prepared: { ...p, photos, rules } };
}

/** A proposal asked before for the place and nights now comes back when the interview has none (no second call). */
export function restoreRoute(s: StartState): StartState {
  if (s.route) return s;
  const kept = preparedRoute(s);
  // The model's proposal kept; else the classic circuit at once (rev 3); else what was kept (one stop).
  const best = (kept?.source === "ai" ? kept : null) ?? (s.guess ? null : circuitRoute(s)) ?? kept;
  return best ? { ...s, route: { ...best, confirmed: false } } : s;
}

// --- the preview on the right (item 4): what the trip is so far ---------------------------------------------------

export interface Preview {
  photos: { place: string; url: string }[];
  /** The stops and their nights (the agreed route, the proposal, or the place itself), and whether it's agreed. */
  stops: RouteStop[];
  routeAgreed: boolean;
  routeProposed: boolean;
  when: string | null;
  people: string | null;
  styles: StyleId[];
  budget: string | null;
  /** "İstanbul ⇄ Koh Samui" (the car's city on a road trip). */
  flights: string | null;
  road: boolean;
  /** The country's facts (money, language, plugs) when the table knows them. */
  country: { name: string; code: string } | null;
  rules: string[];
}

export function previewOf(s: StartState, ctx: StartCtx): Preview | null {
  if (!s.where) return null;
  const total = totalNights(s);
  const stops = s.route ? s.route.stops : total ? [{ city: s.where.place, nights: total }] : [{ city: s.where.place, nights: 0 }];
  const air = airportsOf(s, s.route?.confirmed ? s.route.stops : stopsOf(s).length ? stopsOf(s) : stops);
  const road = s.mode === "road";
  const code = s.where.code ?? countryCodeOfName(s.where.country);
  return {
    photos: preparedPhotos(s),
    stops,
    routeAgreed: Boolean(s.route?.confirmed),
    routeProposed: Boolean(s.route && !s.route.confirmed && s.route.source !== "single"),
    when: whenText(s) || null,
    people: s.who ? whoText(s.who, ctx.myName) || null : null,
    styles: knownStyles(s.styles),
    budget: s.budget && Object.hasOwn(BUDGET_WORDS, s.budget) ? budgetWord(s.budget) : null,
    flights: road ? null : air ? (s.from ? `${s.from} ⇄ ${air.arrive}` : air.arrive) : null,
    road,
    country: code ? { code, name: s.where.country ?? s.where.place } : null,
    rules: s.prepared.rules && rulesKey(s) === s.prepared.rules.key ? s.prepared.rules.titles : [],
  };
}

// --- what gets made ------------------------------------------------------------------------------------------

export interface Creation {
  title: string;
  /** Null when the days aren't said yet: the trip is made without dates, its stays and flights undated. */
  dates: { start: string; end: string } | null;
  /** One stay said per stop, its nights in order (plan_item kind stay). */
  stays: PlannedInput[];
  /** The flights in and out (or the car of a road trip), said the same way. */
  travel: PlannedInput[];
  /** Who goes (trip.travellers): the names said, and how many when it's known. */
  travellers: { names: string[]; count: number | null } | null;
  /** The style words picked (trip.style). */
  styles: StyleId[];
  /** Each stop's country by its city key (the stays and the car carry it: the flag, the weather, the visa). */
  countries: Record<string, { code: string; name: string | null }>;
  /** The stops inside the destination ("Ubud" → "Bali"): the hero's main place without asking the model. */
  parents: { key: string; parents: Record<string, string> } | null;
  road: boolean;
  /** The start was a guess (a part of the month, or a month only): the hero says "tarih yaklaşık" until confirmed. */
  approxStart: string | null;
}

const said0 = (p: Partial<PlannedInput> & Pick<PlannedInput, "kind">): PlannedInput => ({
  date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...p,
});

/** The stops the trip is built with: the agreed route, else one stop (an unconfirmed route is never built). */
export function stopsOf(s: StartState): RouteStop[] {
  if (s.route?.confirmed) return s.route.stops;
  const single = singleRoute(s);
  return single ? single.stops : [];
}

/** Where the flights land and leave: the agreed route's airports, else the place's own (Bali → Denpasar, Koh Phangan → Koh Samui), else the stop. */
export function airportsOf(s: StartState, stops: RouteStop[] = stopsOf(s)): { arrive: string; leave: string } | null {
  if (!s.where) return null;
  const where = s.where;
  const first = stops[0]?.city ?? where.place;
  const last = stops.at(-1)?.city ?? where.place;
  const airportName = (p: KnownPlace | null) => (p?.airport ? L(p.airport, p.airportEn ?? p.airport) : undefined);
  const airportOf = (city: string) => airportName(knownPlaceOf(city)) ?? (city === first || city === last ? airportName(knownPlaceOf(where.place)) : undefined) ?? city;
  return { arrive: (s.route?.confirmed && s.route.arrive) || airportOf(first), leave: (s.route?.confirmed && s.route.leave) || airportOf(last) };
}

/**
 * What "Oluştur" makes. Only the destination is needed (item 4): without dates the stays and flights are made
 * undated (to fill when the days are said in the board's chat), and the trip has no dates yet.
 */
export function creationOf(s: StartState): Creation | null {
  if (!s.where) return null;
  const dates = tripDates(s);
  const where = s.where;
  const stops = dates ? stopsOf(s) : s.route?.confirmed ? s.route.stops : [{ city: where.place, nights: 0, code: where.code ?? null }];
  // The stops' nights follow the dates (a route made for a rough length is fitted: the last stop takes the rest).
  const fitted = stops.map((x) => ({ ...x }));
  const stays: PlannedInput[] = [];
  if (dates) {
    const total = nightsBetween(dates.start, dates.end);
    const sum = fitted.reduce((a, b) => a + b.nights, 0);
    if (fitted.length && sum !== total) fitted[fitted.length - 1].nights = Math.max(1, fitted[fitted.length - 1].nights + total - sum);
    let day = dates.start;
    for (const [i, stop] of fitted.entries()) {
      const end = i === fitted.length - 1 ? dates.end : addDays(day, stop.nights);
      if (end <= day) break;
      stays.push(said0({ kind: "stay", date: day, end_date: end, city: stop.city }));
      day = end;
    }
  } else for (const stop of fitted) stays.push(said0({ kind: "stay", city: stop.city }));
  const road = s.mode === "road";
  const first = fitted[0]?.city ?? where.place;
  const { arrive, leave } = airportsOf(s, fitted)!;
  const travel: PlannedInput[] = road
    ? [said0({ kind: "car_rental", date: dates?.start ?? null, end_date: dates?.end ?? null, city: first })]
    : [
        said0({ kind: "flight", date: dates?.start ?? null, from: s.from, to: arrive }),
        // The flight home needs its day or where home is (an undated one to nowhere is no plan).
        ...(dates || s.from ? [said0({ kind: "flight", date: dates?.end ?? null, from: leave, to: s.from })] : []),
      ];
  const count = peopleCount(s.who);
  const names = s.who?.kind === "solo" ? [] : (s.who?.names ?? []);
  // The country of each stop: the route's own (a trip across two countries), else the destination's.
  const whereCode = where.code ?? countryCodeOfName(where.country) ?? null;
  const countries: Creation["countries"] = {};
  for (const stop of fitted) {
    const code = stop.code ?? whereCode;
    const key = cityKeyOf(stop.city);
    if (key && code) countries[key] = { code, name: code === whereCode ? where.country : null };
  }
  // A route through a region (Ubud, Canggu in Bali): the hero shows Bali. A country's cities stay the main places.
  const region = fitted.length > 1 && !fitted.some((x) => cityKeyOf(x.city) === cityKeyOf(where.place)) && !countryCodeOfName(where.place);
  const parents = region ? { key: placesKey(fitted.map((x) => x.city)), parents: Object.fromEntries(fitted.map((x) => [cityKeyOf(x.city)!, where.place])) } : null;
  return {
    title: L(`${where.place} Gezisi`, `${where.place} trip`),
    dates,
    stays,
    travel,
    travellers: count || names.length ? { names, count } : null,
    styles: knownStyles(s.styles),
    countries,
    parents,
    road,
    approxStart: s.start?.approx && dates ? dates.start : null,
  };
}

// --- placeholders: what the start made, not what the traveller chose -------------------------------------------

/** What a made record says that the traveller would change: its status, days, where from and to, its city, its name. */
export const placeholderPrint = (i: Item): string =>
  [i.status, i.dates.start, i.dates.end, i.flight?.from, i.flight?.to, i.flight?.departure, i.city, i.name].map((v) => v ?? "").join("|");

/**
 * The flights and stays the start made are places to fill, not choices: until the traveller changes one (a choice,
 * a booking, the chat saying it again with a time or another day), it isn't "chosen" for the hero. Kept on the trip
 * by id with what the record said when made (a place's coordinates arriving later change nothing).
 */
export function isPlaceholder(trip: Pick<Trip, "startGuide">, item: Item): boolean {
  const print = trip.startGuide?.placeholders?.[item.id];
  return print != null && print === placeholderPrint(item) && item.status === "chosen" && item.origin === "chat";
}

/**
 * A trip made without dates gets them later in its chat (update_trip): the undated places the start made take them
 * instead of new ones being made beside them. The stay (when there is one) the whole stay, the flight there the
 * first day, the flight home the last, a car the whole stay. They stay places to fill (their new prints returned).
 */
export function datePlaceholders(trip: Pick<Trip, "startGuide">, items: Item[], dates: { start: string; end: string }): { items: Item[]; prints: Record<string, string> } {
  const open = items.filter((i) => !i.dates.start && i.status !== "dismissed" && isPlaceholder(trip, i));
  const dated = (i: Item, start: string, end: string | null): Item => ({ ...i, dates: { ...i.dates, start, end } });
  const out: Item[] = [];
  const stays = open.filter((i) => i.category === "stay");
  if (stays.length === 1) out.push(dated(stays[0], dates.start, dates.end));
  // Made in order: the flight there first, the flight home after it.
  const flights = open.filter((i) => i.category === "flight").sort((a, b) => a.createdAt - b.createdAt);
  if (flights[0]) out.push(dated(flights[0], dates.start, null));
  if (flights[1]) out.push(dated(flights[1], dates.end, null));
  for (const car of open.filter((i) => i.category === "transport")) out.push(dated(car, dates.start, dates.end));
  return { items: out, prints: Object.fromEntries(out.map((i) => [i.id, placeholderPrint(i)])) };
}

/**
 * The hero's sentence while the start's places are still to fill: "2 uçuş ve 31 gece seni bekliyor." (only the
 * placeholders still on the plan, and the nights with no place yet). Null when none is left: the usual sentence then.
 */
/** The start's dates are still the guess made from a month (not confirmed, not changed since). */
export const approxDates = (trip: Pick<Trip, "startGuide" | "confirmedDates">): boolean =>
  Boolean(trip.startGuide?.approxStart && trip.confirmedDates?.start === trip.startGuide.approxStart);

export function startLead(trip: Pick<Trip, "startGuide" | "confirmedDates">, items: Item[], openNights: number, closed: ReadonlySet<string> = new Set()): string | null {
  const live = items.filter((i) => !closed.has(i.id) && i.status !== "dismissed" && isPlaceholder(trip, i));
  if (!live.length) return null;
  const flights = live.filter((i) => i.category === "flight").length;
  const cars = live.filter((i) => i.category === "transport").length;
  const parts = [
    flights ? L(`${flights} uçuş`, `${flights} flight${flights === 1 ? "" : "s"}`) : "",
    cars ? L(`${cars} araç`, `${cars} car${cars === 1 ? "" : "s"}`) : "",
    openNights ? L(`${openNights} gece`, `${openNights} night${openNights === 1 ? "" : "s"}`) : "",
  ].filter(Boolean);
  if (!parts.length) return null;
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${L("ve", "and")} ${parts.at(-1)}` : parts[0];
  const approx = approxDates(trip) ? L(" · tarih yaklaşık", " · dates are rough") : "";
  const text = L(`${joined} seni bekliyor${approx}.`, `${joined} ${parts.length === 1 && /^1 /.test(joined) ? "is" : "are"} waiting for you${approx}.`);
  return text.charAt(0).toLocaleUpperCase("tr") + text.slice(1);
}

/** The line under "Gezin hazır": "31 gün, 3 durak. Önce uçuşu bul, sonra Ubud konaklamasını seçelim." */
export function readyText(c: Creation, missing: string[] = []): string {
  const stops = c.stays.length;
  const firstCity = c.stays[0]?.city ?? "";
  // What wasn't said in the interview is asked here, in the board's chat that goes on with it (item 4).
  const ask = missing.length ? L(` Eksik kalanları buradan konuşalım: ${missing.join(", ")}.`, ` Let's settle what's still open here: ${missing.join(", ")}.`) : "";
  if (!c.dates) {
    return `${L(`${c.title} hazır.`, `${c.title} is ready.`)} ${L("Tarihleri söyleyince geceleri ve uçuşları yerleştiririm.", "Tell me the dates and I'll place the nights and the flights.")}${ask}`;
  }
  const nights = nightsBetween(c.dates.start, c.dates.end);
  const head = L(`${c.title} hazır: ${nights} gece, ${stops} durak.`, `${c.title} is ready: ${nights} night${nights === 1 ? "" : "s"}, ${stops} stop${stops === 1 ? "" : "s"}.`);
  const rough = c.approxStart ? L(` Başlangıç ${dayText(c.approxStart)} olarak yaklaşık; kesinleşince söyle.`, ` The start, ${dayText(c.approxStart)}, is a rough guess; tell me when it's set.`) : "";
  const next = c.road
    ? L(`Önce aracı seç, sonra ${firstCity} konaklamasını bulalım.`, `First pick the car, then let's find a place in ${firstCity}.`)
    : L(`Önce uçuşu bul, sonra ${firstCity} konaklamasını seçelim. Her adımda buradayım.`, `First find the flight, then let's pick a place in ${firstCity}. I'm here at every step.`);
  return `${head} ${next}${rough}${ask}`;
}

// --- the conversation as the trip's chat --------------------------------------------------------------------------

/**
 * The interview as the trip's chat history (item 8): user and assistant turns in the chat provider's own
 * format (Claude text blocks, Gemini parts), the same role twice in a row joined, always starting with the
 * traveller and ending with the assistant's "ready" line, so the next message on the board continues it.
 */
export function historyRows(messages: StartMsg[], closing: string, provider: "gemini" | "anthropic", tripId: string): Omit<ChatMessage, "id">[] {
  const turns: { role: "user" | "assistant"; text: string; at: number }[] = [];
  for (const m of [...messages, { role: "assistant" as const, text: closing, at: (messages.at(-1)?.at ?? 0) + 1 }]) {
    const text = m.text.trim();
    if (!text) continue;
    const prev = turns.at(-1);
    if (prev && prev.role === m.role) prev.text = `${prev.text}\n\n${text}`;
    else turns.push({ role: m.role, text, at: m.at });
  }
  if (turns[0]?.role === "assistant") turns.unshift({ role: "user", text: L("Yeni gezi planla", "Plan a new trip"), at: turns[0].at - 1 });
  const content = (text: string) => (provider === "anthropic" ? [{ type: "text", text }] : [{ text }]);
  let at = 0;
  return turns.map((t) => ({
    tripId,
    role: t.role,
    content: content(t.text),
    text: t.text,
    choices: [],
    provider,
    createdAt: (at = Math.max(at + 1, t.at)),
  }));
}

/** The links in what was typed on the home, and the words around them ("Bali'ye 3 hafta https://…" → both). */
export function splitLinks(text: string): { links: string[]; words: string } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const links = tokens.filter(looksLikeUrl);
  return { links, words: tokens.filter((t) => !looksLikeUrl(t)).join(" ") };
}

// --- "Porto'da bir otel daha": a place of a trip there is ---------------------------------------------------------

/** Words in a trip's title that aren't a place. */
const TITLE_WORDS = new Set(["gezisi", "gezi", "trip", "ve", "and", "tatil", "tatili", "turu", "tour", "ornek", "sample", "yeni", "new"]);

/**
 * The trip whose place the text names ("Porto'da bir otel daha" → Porto ve Madeira Gezisi): its stays' and
 * plans' cities, and the place words of its title. Sample trips are never offered. Null when none is named.
 */
export function tripNamedIn(text: string, trips: Trip[], items: Item[]): { trip: Trip; place: string } | null {
  const raw = tokensOf(text);
  const keys = new Map<string, string>();
  for (let i = 0; i < raw.length; i++) {
    for (const len of [1, 2]) {
      if (i + len > raw.length) continue;
      const words = raw.slice(i, i + len).join(" ");
      const key = cityKeyOf(words);
      if (key && key.length >= 3) keys.set(key, words);
    }
  }
  if (!keys.size) return null;
  const ordered = [...trips].filter((t) => !t.demo && !/\((örnek|sample)\)$/.test(t.title.trim())).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const trip of ordered) {
    const places = new Set<string>();
    for (const i of items) if (i.tripId === trip.id && i.status !== "dismissed" && i.city) places.add(cityKeyOf(i.city)!);
    for (const w of tokensOf(trip.title)) {
      const k = cityKeyOf(w);
      if (k && !TITLE_WORDS.has(k) && k.length >= 3) places.add(k);
    }
    for (const [key, words] of keys) if (places.has(key)) return { trip, place: words };
  }
  return null;
}

// --- the start card on the new trip's board -------------------------------------------------------------------------

export interface GuideStep {
  id: "flights" | "stays" | "suggestions";
  label: string;
  done: boolean;
}

/** What the start card reads from the board: its plan (nights, what was set aside) and the suggestions shown now. */
export interface GuideInput {
  items: Item[];
  plan: { nights: { open: number }; stayBlocks: unknown[]; closed: { item: { id: string } }[] };
  /** Suggestions shown on the board now (the rules' and the stored ones, open). */
  openSuggestions: number;
}

/**
 * The one-time start card's three steps (item 7), each ticked from the board's own state: no flight (a car on a
 * road trip) is a place the start made any more (one picked or booked, or a saved page in its place); no night
 * without a place; the suggestions looked at, or none left open.
 */
export function guideSteps(trip: Trip, g: GuideInput): GuideStep[] {
  const guide = trip.startGuide;
  const closed = new Set(g.plan.closed.map((c) => c.item.id));
  const kind = guide?.road ? "transport" : "flight";
  const live = g.items.filter((i) => i.category === kind && i.status !== "dismissed" && !closed.has(i.id));
  const travelDone = live.length > 0 && !live.some((i) => isPlaceholder(trip, i));
  return [
    guide?.road ? { id: "flights", label: L("Aracı seç", "Pick the car"), done: travelDone } : { id: "flights", label: L("Uçuşları bul", "Find the flights"), done: travelDone },
    { id: "stays", label: L("Konaklamaları seç", "Choose the stays"), done: g.plan.stayBlocks.length > 0 && g.plan.nights.open === 0 },
    { id: "suggestions", label: L("Önerilere bak", "Look at the suggestions"), done: Boolean(guide?.looked) || g.openSuggestions === 0 },
  ];
}

/** The card shows until every step is done or it's closed (×). */
export const guideVisible = (trip: Trip, steps: GuideStep[]): boolean => Boolean(trip.startGuide && !trip.startGuide.closed && steps.some((s) => !s.done));
