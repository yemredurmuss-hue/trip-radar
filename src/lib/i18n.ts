// The board's language. Every user-facing string is written in both languages side by side,
// L("Kaydet", "Save"), so a missing translation is visible where the text is. The language is read
// once at startup (board, popup and worker) from chrome.storage; changing it reloads the board.
// Code that never loads it (the tests) runs in Turkish.
export type Lang = "tr" | "en";

export const LANGS: Lang[] = ["tr", "en"];

let current: Lang = "tr";

export const lang = (): Lang => current;

export function setLang(next: Lang): void {
  current = next;
}

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
