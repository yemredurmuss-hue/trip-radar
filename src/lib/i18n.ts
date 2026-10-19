// The board's language. Every user-facing string is written in both languages side by side,
// L("Kaydet", "Save"), so a missing translation is visible where the text is. The language is read
// once at startup (board, popup and worker) from chrome.storage; changing it reloads the board.
// Code that never loads it (the tests) runs in Turkish.
export type Lang = "tr" | "en";

export const LANGS: Lang[] = ["tr", "en"];

let current: Lang = "tr";
/** Whether a language was set (loaded or chosen): until then the board's is only the default. */
let known = false;

export const lang = (): Lang => current;

export function setLang(next: Lang): void {
  current = next;
  known = true;
}

/**
 * The language what the AI writes now is written in (0.39.1, Emre: "Dili İngilizce yapmama rağmen AI tavsiyeleri
 * Türkçe gelmiş"): the board's, whatever the trip's (its start chat's). The trip's only when the board's isn't known.
 */
export const contentLang = (tripLang?: Lang | null): Lang => (known ? current : (tripLang ?? current));

/**
 * The language part of the key of something the AI wrote for a trip (its review, its mood sentence): the language it's
 * written in now (contentLang), left out when it's the one it was written in before 0.39.1 (the trip's, else Turkish),
 * so what stays in its language isn't asked again, and another language asks once.
 */
export const contentTag = (tripLang?: Lang | null, write: Lang = contentLang(tripLang)): string => (write === (tripLang ?? "tr") ? "" : write);

/** The text in the current language. */
export const L = (tr: string, en: string): string => (current === "en" ? en : tr);

/**
 * Runs `fn` with another language current and puts the board's back (the start chat speaks the language its
 * first message was written in, whatever the board's). Synchronous only: every L() inside `fn` reads `l`; an
 * await inside would let the rest run in the board's language again.
 */
export function withLang<T>(l: Lang | null | undefined, fn: () => T): T {
  if (!l || l === current) return fn();
  const before = current;
  current = l;
  try {
    return fn();
  } finally {
    current = before;
  }
}

/** Locale for numbers, dates and sorting in the current language. */
export const locale = (): string => (current === "en" ? "en-GB" : "tr-TR");

/** The language to start with when none was chosen: Turkish for a Turkish browser, English otherwise. */
export function browserLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language : "";
  return nav?.toLowerCase().startsWith("tr") ? "tr" : "en";
}

const isLang = (value: unknown): value is Lang => value === "tr" || value === "en";

/** Reads the chosen language (or the browser's) and makes it current. */
export async function loadLang(): Promise<Lang> {
  let stored: unknown;
  try {
    stored = (await chrome.storage.local.get("lang")).lang;
  } catch {
    stored = undefined; // no extension storage (tests, a plain page)
  }
  setLang(isLang(stored) ? stored : browserLang());
  return current;
}

export async function saveLang(next: Lang): Promise<void> {
  setLang(next);
  await chrome.storage.local.set({ lang: next });
}
