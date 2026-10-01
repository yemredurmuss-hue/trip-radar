// Small helpers for text that's read in the current language at the moment it's used (see i18n.ts):
// label maps whose values follow the language, counted words ("3 yorum" / "3 reviews"), durations, joins.
import { L, lang, locale } from "./i18n";

type Pair = readonly [tr: string, en: string];

/**
 * A label map read in the current language each time a key is read: liveLabels({ price: ["Fiyat",
 * "Price"] }).price is "Fiyat" or "Price" depending on the language at that moment, never frozen.
 */
export function liveLabels<T extends Record<string, Pair>>(pairs: T): { readonly [K in keyof T]: string } {
  const out = {} as { [K in keyof T]: string };
  for (const key of Object.keys(pairs) as (keyof T)[]) {
    Object.defineProperty(out, key, { get: () => L(pairs[key][0], pairs[key][1]), enumerable: true });
  }
  return out;
}

/** The same for a list: liveList([["Az", "Low"], ...])[1] follows the language. */
export function liveList(pairs: readonly Pair[]): readonly string[] {
  const out: string[] = [];
  pairs.forEach((p, i) => Object.defineProperty(out, i, { get: () => L(p[0], p[1]), enumerable: true }));
  return out;
}

/** "3 yorum" / "3 reviews": a count with its word, English plural when not one. */
export function count(n: number, tr: string, en: string, enPlural = `${en}s`): string {
  const shown = n.toLocaleString(locale());
  return L(`${shown} ${tr}`, `${shown} ${n === 1 ? en : enPlural}`);
}

export const nReviews = (n: number) => count(n, "yorum", "review");
export const nNights = (n: number) => count(n, "gece", "night");
export const nDays = (n: number) => count(n, "gün", "day");
export const nOptions = (n: number) => count(n, "seçenek", "option");
export const nStops = (n: number) => count(n, "aktarma", "stop");

/** "2 sa 10 dk" / "2 h 10 min", "45 dk" / "45 min". */
export function hoursMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const [hw, mw] = lang() === "en" ? ["h", "min"] : ["sa", "dk"];
  return h ? `${h} ${hw}${m ? ` ${m} ${mw}` : ""}` : `${m} ${mw}`;
}

/** "dk" / "min": the minutes word. */
export const minWord = () => L("dk", "min");

/** A walking or travel time in a display ("6 dk yürüme", "6 min walk"): the minutes word in either language. */
export const MINUTES_SHOWN = /\d\s*(dk|min)\b/;

/** "a, b ve c" / "a, b and c". */
export function joinAnd(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${L("ve", "and")} ${words.at(-1)}`;
}

/**
 * The casing rules for a text: Turkish (i/İ, ı/I) when it's in Turkish mode or the text has Turkish
 * letters (a finding read in Turkish on a shared trip), English otherwise ("italy" → "Italy", not "İtaly").
 */
const caseLocale = (t: string) => (lang() === "tr" || /[çğıöşüİı]/i.test(t) ? "tr-TR" : locale());

/** First letter up / down, by the text's own casing rules. */
export const capitalize = (t: string) => (t ? t.charAt(0).toLocaleUpperCase(caseLocale(t)) + t.slice(1) : t);
export const lowerFirst = (t: string) => (t ? t.charAt(0).toLocaleLowerCase(caseLocale(t)) + t.slice(1) : t);
/** Lower case for display, by the text's own casing rules. */
export const lowerText = (t: string) => t.toLocaleLowerCase(caseLocale(t));

/** A number for display: "8,9" / "8.9", "1.204" / "1,204". */
export const num = (n: number, maxDigits = 1) => n.toLocaleString(locale(), { maximumFractionDigits: maxDigits });
