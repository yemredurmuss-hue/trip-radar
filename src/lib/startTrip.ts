// Starting a trip by chat (spec 2026-10-06 §2): a short interview — where, where from, who, when (length and
// start asked apart), what they're after, the route — that the code runs. Each question comes with quick
// answers, "Atla" and free typing; one message can fill several answers at once ("Sabine'yle 10 Aralık'tan
// 1 ay Bali"). The model reads free text into a strict shape when there is one; without it (no key, the AI
// gate closed) the code reads dates, lengths, a few places, "partnerimle"... itself, and the interview works
// the same. Nothing here touches storage: the screen (app/start) keeps the state, startDrafts.ts saves it,
// startCreate.ts builds the trip from it. Pure.
import { z } from "zod";
import { L, lang } from "./i18n";
import { formatDateRange, isoDate, nightsBetween } from "./items";
import { placesKey } from "./destinations";
import { addDays, cityKeyOf } from "./plan";
import type { PlannedInput } from "./planned";
import { STYLES, type BudgetLevel, type StyleId } from "./tripStyle";
import type { ChatMessage, Item, Trip } from "./types";

// --- the state -----------------------------------------------------------------------------------------

/** How the interview was started (the home's chips): the order and the quick answers follow it. */
export type StartMode = "plan" | "inspire" | "road" | "lastminute";
export type QuestionId = "where" | "from" | "who" | "names" | "duration" | "start" | "want" | "route";
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
  /** "Bu olsun" pressed (or typed by the traveller): only then is it built as more than one stop. */
  confirmed: boolean;
  source: "ai" | "user" | "single";
}
export interface StartMsg {
  role: "user" | "assistant";
  text: string;
  at: number;
}

export interface StartState {
  id: string;
  mode: StartMode;
  where: Place | null;
  from: string | null;
  who: { kind: Companions | null; names: string[] } | null;
  duration: Duration | null;
  start: { date: string; approx: boolean } | null;
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
  messages: StartMsg[];
  /** The trip record once made: a retry after a failed step continues it, never makes a second trip. */
  tripId: string | null;
  createdAt: number;
  updatedAt: number;
}

export function newStart(id: string, mode: StartMode, now: number): StartState {
  return {
    id, mode, where: null, from: null, who: null, duration: null, start: null, styles: [], budget: null, wantDone: false,
    route: null, editingRoute: false, skipped: [], asking: null, messages: [], tripId: null, createdAt: now, updatedAt: now,
  };
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
}
const P = (tr: string, en: string, countryTr: string | null, countryEn: string | null, city: boolean, also: string[] = []): KnownPlace => ({ tr, en, countryTr, countryEn, city, also });
/** A few places the code knows without the model (the no-key path): popular cities, islands and countries. */
export const KNOWN_PLACES: KnownPlace[] = [
  P("Bali", "Bali", "Endonezya", "Indonesia", false),
  P("Porto", "Porto", "Portekiz", "Portugal", true),
  P("Lizbon", "Lisbon", "Portekiz", "Portugal", true, ["lisboa"]),
  P("Madeira", "Madeira", "Portekiz", "Portugal", false),
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
  P("Dubai", "Dubai", "Birleşik Arap Emirlikleri", "United Arab Emirates", true),
  P("New York", "New York", "ABD", "United States", true),
  P("Kahire", "Cairo", "Mısır", "Egypt", true),
  P("Tiflis", "Tbilisi", "Gürcistan", "Georgia", true),
  P("İstanbul", "Istanbul", "Türkiye", "Türkiye", true),
  P("Ankara", "Ankara", "Türkiye", "Türkiye", true),
  P("İzmir", "Izmir", "Türkiye", "Türkiye", true),
  P("Antalya", "Antalya", "Türkiye", "Türkiye", true),
  P("Bodrum", "Bodrum", "Türkiye", "Türkiye", true),
  P("Kapadokya", "Cappadocia", "Türkiye", "Türkiye", false),
  P("Maldivler", "Maldives", null, null, false),
  P("İzlanda", "Iceland", null, null, false),
  P("Tayland", "Thailand", null, null, false),
  P("Japonya", "Japan", null, null, false),
  P("İtalya", "Italy", null, null, false),
  P("İspanya", "Spain", null, null, false),
  P("Portekiz", "Portugal", null, null, false),
  P("Yunanistan", "Greece", null, null, false),
  P("Vietnam", "Vietnam", null, null, false),
  P("Meksika", "Mexico", null, null, false),
  P("Sri Lanka", "Sri Lanka", null, null, false),
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
const PLACE_INDEX = new Map<string, KnownPlace>();
for (const p of KNOWN_PLACES) for (const n of [p.tr, p.en, ...(p.also ?? [])]) PLACE_INDEX.set(plain(n), p);

const placeName = (p: KnownPlace) => L(p.tr, p.en);
/** Its country in the board's language; a country stands for itself. */
const countryNameOf = (p: KnownPlace) => (p.countryTr ? L(p.countryTr, p.countryEn ?? p.countryTr) : placeName(p));

export function knownPlaceOf(name: string | null | undefined): KnownPlace | null {
  return name ? (PLACE_INDEX.get(plain(name)) ?? null) : null;
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
/** "Endonezya", "Indonesia" → "ID": a country's name in Turkish or English (Intl), compared plain; null for anything else. */
export function countryCodeOfName(name: string | null | undefined): string | null {
  if (!name) return null;
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
          if (n && n !== code && !countryIndex.has(plain(n))) countryIndex.set(plain(n), code);
        }
    }
    for (const [n, code] of Object.entries(MORE_CODES)) countryIndex.set(plain(n), code);
  }
  return countryIndex.get(plain(name)) ?? null;
}
/** Names Intl doesn't give (short forms). */
const MORE_CODES: Record<string, string> = { ABD: "US", USA: "US", "Birleşik Krallık": "GB", İngiltere: "GB", England: "GB", Türkiye: "TR", Turkey: "TR", Hollanda: "NL", Çekya: "CZ" };

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
  start: { date: string; approx: boolean } | null;
  duration: Duration | null;
  styles: StyleId[];
  budget: BudgetLevel | null;
}

export const EMPTY_EXTRACTED: Extracted = { where: null, from: null, who: null, start: null, duration: null, styles: [], budget: null };

const NUMBER_WORDS: Record<string, number> = {
  bir: 1, iki: 2, üç: 3, uc: 3, dört: 4, dort: 4, beş: 5, bes: 5, altı: 6, alti: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const FROM_SUFFIX = new Set(["dan", "den", "tan", "ten"]);
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

/** What one message says, read by the code alone: dates, lengths, a few places, who, styles. */
export function parseStartText(text: string, today: string): Extracted {
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

  // Places: a known one; "X'den" is where from, anything else where to.
  for (let i = 0; i < raw.length; i++) {
    for (const len of [2, 1]) {
      if (i + len > raw.length) continue;
      const words = raw.slice(i, i + len).join(" ");
      const known = knownPlaceOf(words);
      if (!known) continue;
      const suffix = low[i + len] ?? "";
      const isFrom = FROM_SUFFIX.has(suffix) || low[i - 1] === "from";
      if (isFrom && !out.from) out.from = placeName(known);
      else if (!isFrom && !out.where) out.where = { place: placeName(known), country: countryNameOf(known), code: knownCode(known) };
      i += len - 1;
      break;
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

export const extractionSystem = () =>
  L(
    `Bir gezi planlama sohbetinde kullanıcının mesajından yalnız açıkça söylenenleri çıkar. Uydurma; söylenmeyen alan boş kalır ("" ya da 0 ya da []).
destination: gidilecek yer (şehir, ada, bölge ya da ülke) yalnız adı, ek olmadan ("Bali'ye" → "Bali"). destination_country: biliniyorsa ülkesi; destination_country_code: o ülkenin ISO 3166-1 alpha-2 kodu ("ID").
origin: yola çıkılan şehir ("İstanbul'dan" → "İstanbul"). companions: solo | partner | friends | family ya da "". names: birlikte gidilen kişilerin adları (kullanıcının kendisi değil).
start_date: başlangıç günü YYYY-MM-DD (bugünden sonraki ilk uygun yıl). Yalnız ay söylendiyse start_date "" ve start_month 1-12.
duration_days: gün olarak süre (gece söylendiyse gece + 1); "1 ay" gibi ay söylendiyse duration_months. styles: yalnız bu id'lerden: ${Object.keys(STYLES).join(", ")}. budget: low | mid | high ya da "".
Asistan az önce bir soru sorduysa, tek kelimelik bir yer adı o sorunun cevabıdır (ör. "Nereden?" sorusuna "İzmir" → origin).`,
    `From the user's message in a trip-planning chat, take only what is clearly said. Never invent; what isn't said stays empty ("" or 0 or []).
destination: the place to go (a city, island, region or country), its name only. destination_country: its country when known; destination_country_code: that country's ISO 3166-1 alpha-2 code ("ID").
origin: the city they leave from. companions: solo | partner | friends | family or "". names: the people going with them (not the user).
start_date: the first day, YYYY-MM-DD (the first fitting year from today). If only a month is said, start_date "" and start_month 1-12.
duration_days: the length in days (nights said: nights + 1); a length in months goes in duration_months. styles: only these ids: ${Object.keys(STYLES).join(", ")}. budget: low | mid | high or "".
If the assistant just asked a question, a bare place name answers it (e.g. "Where from?" → "Izmir" → origin).`,
  );

export const extractionPrompt = (text: string, today: string, question: string | null) =>
  `<start_message>\n${L("Bugün", "Today")}: ${today}\n${question ? `${L("Asistanın sorusu", "The assistant's question")}: ${question}\n` : ""}${L("Mesaj", "Message")}: ${text}\n</start_message>`;

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
    if (s in STYLES && !out.styles.includes(s as StyleId)) out.styles.push(s as StyleId);
  }
  out.budget = (BUDGETS as readonly string[]).includes(raw.budget) ? (raw.budget as BudgetLevel) : null;
  return out;
}

/** The code's reading wins where it's sure (dates, lengths, places it knows); the model fills what the code missed. */
export function mergeExtracted(code: Extracted, model: Extracted | null): Extracted {
  if (!model) return code;
  const names = [...new Set([...(code.who?.names ?? []), ...(model.who?.names ?? [])])];
  const kind = code.who?.kind ?? model.who?.kind ?? null;
  return {
    where: code.where ?? model.where,
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
  plan: ["where", "from", "who", "names", "duration", "start", "want", "route"],
  road: ["where", "from", "who", "names", "duration", "start", "want", "route"],
  lastminute: ["where", "from", "who", "names", "duration", "start", "want", "route"],
  inspire: ["want", "where", "from", "who", "names", "duration", "start", "route"],
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
    case "want":
      return !s.wantDone;
    case "route":
      return Boolean(s.where && totalNights(s) && !s.route?.confirmed);
  }
}

/** The question asked now: one pressed in the checklist, else the first still open in the mode's order. */
export function nextQuestion(s: StartState): QuestionId | null {
  if (s.asking) return s.asking;
  return ORDER[s.mode].find((q) => open(s, q)) ?? null;
}

/** "Gezimi oluştur" works once where and when (the start and the length) are known. */
export const canGenerate = (s: StartState): boolean => Boolean(s.where && tripDates(s));

/** What's still needed to generate, in words ("Nereye", "Ne zaman"). */
export function missingForGenerate(s: StartState): string[] {
  const out: string[] = [];
  if (!s.where) out.push(L("nereye", "where"));
  if (!s.start || !s.duration) out.push(L("ne zaman", "when"));
  return out;
}

export function skip(s: StartState, q: QuestionId, now: number): StartState {
  return { ...s, skipped: [...new Set([...s.skipped, q])], asking: null, editingRoute: q === "route" ? false : s.editingRoute, updatedAt: now };
}

/** A row of the checklist pressed: ask that again (its skip forgotten). */
export function askAgain(s: StartState, q: QuestionId, now: number): StartState {
  return { ...s, asking: q, skipped: s.skipped.filter((x) => x !== q), editingRoute: q === "route" ? s.editingRoute : false, updatedAt: now };
}

/** A route made for other places or another length isn't the trip's any more. */
function keepRoute(before: StartState, after: StartState): StartState {
  if (!after.route) return after;
  const placeChanged = before.where?.place !== after.where?.place;
  const total = totalNights(after);
  const sum = after.route.stops.reduce((a, b) => a + b.nights, 0);
  if (placeChanged || total == null || (sum !== total && after.route.source !== "single")) return { ...after, route: null, editingRoute: false };
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
  | { q: "want"; styles: StyleId[]; budget: BudgetLevel | null }
  | { q: "route"; action: "accept" | "change" | "single" };

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
    case "want":
      next = { ...next, styles: a.styles, budget: a.budget, wantDone: true };
      break;
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
 * A typed message for the question on screen: what it says (code and model readings merged), and when it says
 * nothing the code recognises, a short answer taken as the answer to that question ("İzmir" to "Nereden?").
 * `understood: false` when nothing came of it.
 */
export function applyText(s: StartState, text: string, read: Extracted, now: number): { state: StartState; understood: boolean } {
  const q = nextQuestion(s);
  let e = read;
  // "İzmir" answering "Nereden?" (or the model calling it the destination while the destination is known).
  if (q === "from" && !e.from && e.where && s.where && e.where.place !== s.where.place) e = { ...e, from: e.where.place, where: null };
  let state = applyExtracted(s, e, now);
  const filled = said(e);
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
      const list = [...new Set([ctx.fromGuess, ...common].filter((c): c is string => !!c))].slice(0, 4);
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
  if (datesAfter && datesAfter !== datesBefore) parts.push(datesAfter);
  if (after.from && after.from !== before.from && parts.length) parts.push(L(`${after.from}${fromSuffix(after.from)}`, `from ${after.from}`));
  if (after.route?.confirmed && !before.route?.confirmed) return L("Tamam, rota bu.", "Great, that's the route.");
  if (!parts.length) return "";
  if (parts.length === 1 && after.where && after.where.place !== before.where?.place) return L(`Harika, ${after.where.place}!`, `Great, ${after.where.place}!`);
  return L(`Not aldım: ${parts.join(" · ")}.`, `Got it: ${parts.join(" · ")}.`);
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
export function replyText(before: StartState, after: StartState, ctx: StartCtx): string {
  const ack = ackText(before, after, ctx);
  const q = nextQuestion(after);
  if (!q) {
    const ready = canGenerate(after)
      ? L("Hazırım. Gezimi oluştur'a bas; eklemek istediğin bir şey varsa yaz.", "I'm ready. Press Generate my trip, or type anything you'd like to add.")
      : L(`Oluşturmak için ${missingForGenerate(after).join(" ve ")} gerekli; listeden ona basabilirsin.`, `To generate I need ${missingForGenerate(after).join(" and ")}; press it in the list.`);
    return [ack, ready].filter(Boolean).join(" ");
  }
  return [ack, questionOf(after, q, ctx).text].filter(Boolean).join(" ");
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
    // Days as the board's hero counts them (first and last day included), so both say the same.
    const days = L(`${n + 1} gün`, `${n + 1} days`);
    if (s.start.approx) {
      const m = Number(s.start.date.slice(5, 7));
      return `${monthName(m)} · ${days}`;
    }
    return `${formatDateRange(dates.start, dates.end)} · ${days}`;
  }
  if (s.duration) return `${durationText(s.duration)} · ${L("başlangıç?", "start?")}`;
  if (s.start) return s.start.approx ? monthName(Number(s.start.date.slice(5, 7))) : formatDateRange(s.start.date, null);
  return "";
}

export function wantText(s: Pick<StartState, "styles" | "budget">): string {
  const budget = s.budget ? { low: L("Ekonomik", "Budget"), mid: L("Orta bütçe", "Mid-range"), high: L("Lüks bütçe", "Luxury budget") }[s.budget] : "";
  return [s.styles.map((id) => STYLES[id]()).join(", "), budget].filter(Boolean).join(" · ");
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
      id: "when", label: L("NE ZAMAN", "WHEN"), value: whenText(s) || L("Ne zaman, kaç gün?", "When, and for how long?"), done: !!tripDates(s),
      ask: !s.duration ? "duration" : "start", required: true, skipped: s.skipped.includes("duration") || s.skipped.includes("start"),
    },
    { id: "want", label: L("NE İSTİYORSUN", "WHAT YOU'RE AFTER"), value: wantText(s) || L("Sence ne yapsın bu gezi?", "What should this trip be about?"), done: s.wantDone && Boolean(s.styles.length || s.budget), ask: "want", required: false, skipped: s.skipped.includes("want") },
    {
      id: "route", label: L("ROTA", "ROUTE"),
      value: s.route?.confirmed ? routeText(s.route) : s.route ? L(`Öneri: ${routeText(s.route)}`, `Suggested: ${routeText(s.route)}`) : s.where && total ? L("Rota hazırlanıyor", "Working out a route") : L("Nereye ve süre belli olunca önereceğim", "I'll suggest one once where and how long are known"),
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
  L(
    "Bir gezi için 1 ile 4 durak arasında gerçekçi bir rota öner. Her durak gerçek bir şehir ya da kasaba adı; gece sayıları tam sayı ve toplamı tam olarak verilen geceye eşit. Az durak tercih et (uzun kalış için 2-3). country_code: durağın ülkesinin ISO 3166-1 alpha-2 kodu (ör. ID). arrival_airport_city: ilk uçuşun indiği şehir (havalimanı olan); departure_airport_city: dönüş uçuşunun kalktığı şehir. Bilmiyorsan \"\" yaz.",
    "Suggest a realistic route of 1 to 4 stops for a trip. Each stop is a real city or town; the nights are whole numbers adding up to exactly the given total. Prefer few stops (2-3 for a long stay). country_code: the stop's country, ISO 3166-1 alpha-2 (e.g. ID). arrival_airport_city: the city the first flight lands in (with an airport); departure_airport_city: where the flight home leaves from. Write \"\" if unsure.",
  );

export function routePrompt(s: StartState): string {
  const total = totalNights(s);
  return [
    "<route_request>",
    `${L("Yer", "Place")}: ${s.where?.place ?? ""}${s.where?.country ? ` (${s.where.country})` : ""}`,
    `${L("Toplam gece", "Total nights")}: ${total}`,
    s.start ? `${L("Başlangıç", "Start")}: ${s.start.date}` : "",
    s.styles.length ? `${L("Tarz", "Style")}: ${s.styles.join(", ")}` : "",
    s.mode === "road" ? L("Yol gezisi (araçla).", "A road trip (by car).") : "",
    "</route_request>",
  ].filter(Boolean).join("\n");
}

const STOP_NAME = /^[\p{L}][\p{L} .'’-]{1,40}$/u;

/** The model's route, kept only when it holds: 1–4 distinct real-looking names, whole nights adding up to the total. */
export function acceptRoute(raw: RawRoute, total: number): StartRoute | null {
  const stops: RouteStop[] = (raw.stops ?? []).map((x) => {
    const code = isoCode(x.country_code);
    return { city: (x.city ?? "").trim(), nights: x.nights, ...(code ? { code } : {}) };
  });
  if (stops.length < 1 || stops.length > 4) return null;
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
  return { route: { stops: stops.map((x) => ({ city: capitalizeWords(x.city), nights: x.nights })), arrive: null, leave: null, confirmed: true, source: "user" } };
}

// --- what gets made ------------------------------------------------------------------------------------------

export interface Creation {
  title: string;
  dates: { start: string; end: string };
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

export function creationOf(s: StartState): Creation | null {
  const dates = tripDates(s);
  if (!s.where || !dates) return null;
  const where = s.where;
  const total = nightsBetween(dates.start, dates.end);
  const stops = stopsOf(s);
  // The stops' nights follow the dates (a route made for a rough length is fitted: the last stop takes the rest).
  const fitted = stops.map((x) => ({ ...x }));
  const sum = fitted.reduce((a, b) => a + b.nights, 0);
  if (fitted.length && sum !== total) fitted[fitted.length - 1].nights = Math.max(1, fitted[fitted.length - 1].nights + total - sum);
  const stays: PlannedInput[] = [];
  let day = dates.start;
  for (const [i, stop] of fitted.entries()) {
    const end = i === fitted.length - 1 ? dates.end : addDays(day, stop.nights);
    if (end <= day) break;
    stays.push(said0({ kind: "stay", date: day, end_date: end, city: stop.city }));
    day = end;
  }
  const road = s.mode === "road";
  const first = fitted[0]?.city ?? where.place;
  const last = fitted.at(-1)?.city ?? where.place;
  const arrive = (s.route?.confirmed && s.route.arrive) || first;
  const leave = (s.route?.confirmed && s.route.leave) || last;
  const travel: PlannedInput[] = road
    ? [said0({ kind: "car_rental", date: dates.start, end_date: dates.end, city: first })]
    : [
        said0({ kind: "flight", date: dates.start, from: s.from, to: arrive }),
        said0({ kind: "flight", date: dates.end, from: leave, to: s.from }),
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
    styles: s.styles,
    countries,
    parents,
    road,
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
 * The hero's sentence while the start's places are still to fill: "2 uçuş ve 31 gece seni bekliyor." (only the
 * placeholders still on the plan, and the nights with no place yet). Null when none is left: the usual sentence then.
 */
export function startLead(trip: Pick<Trip, "startGuide">, items: Item[], openNights: number, closed: ReadonlySet<string> = new Set()): string | null {
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
  const text = L(`${joined} seni bekliyor.`, `${joined} ${parts.length === 1 && /^1 /.test(joined) ? "is" : "are"} waiting for you.`);
  return text.charAt(0).toLocaleUpperCase("tr") + text.slice(1);
}

/** The line under "Gezin hazır": "31 gün, 3 durak. Önce uçuşu bul, sonra Ubud konaklamasını seçelim." */
export function readyText(c: Creation): string {
  // Days as the hero counts them (first and last included).
  const days = nightsBetween(c.dates.start, c.dates.end) + 1;
  const stops = c.stays.length;
  const firstCity = c.stays[0]?.city ?? "";
  const head = L(`${c.title} hazır: ${days} gün, ${stops} durak.`, `${c.title} is ready: ${days} days, ${stops} stop${stops === 1 ? "" : "s"}.`);
  const next = c.road
    ? L(`Önce aracı seç, sonra ${firstCity} konaklamasını bulalım.`, `First pick the car, then let's find a place in ${firstCity}.`)
    : L(`Önce uçuşu bul, sonra ${firstCity} konaklamasını seçelim. Her adımda buradayım.`, `First find the flight, then let's pick a place in ${firstCity}. I'm here at every step.`);
  return `${head} ${next}`;
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
