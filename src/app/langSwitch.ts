// The board's language switched from the chat ("Türkçeye geç"): the board's words are read once per load, so the
// page reloads into it (as Settings does), and its "Geri al" is handed across the reload for this tab only.
import { L, lang, type Lang } from "../lib/i18n";

const KEY = "tripRadar.langUndo";
const FRESH_MS = 60_000;

/** After a chat turn: the language changed during it → remember the one before, and reload into the new one. */
export function reloadIfLangChanged(tripId: string, before: Lang): void {
  if (lang() === before) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ tripId, prev: before, at: Date.now() }));
  } catch {
    // no session storage: the language is switched all the same, Settings can switch it back
  }
  location.reload();
}

/** Once, on the board after that reload: the language to go back to and the toast's words. */
export function takeLangUndo(tripId: string): { prev: Lang; label: string } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const saved = JSON.parse(raw) as { tripId?: string; prev?: string; at?: number };
    if (saved.tripId !== tripId || (saved.prev !== "tr" && saved.prev !== "en") || saved.prev === lang()) return null;
    if (typeof saved.at !== "number" || Date.now() - saved.at > FRESH_MS) return null;
    return { prev: saved.prev, label: L("Panonun dili Türkçe oldu", "The board is now in English") };
  } catch {
    return null;
  }
}
