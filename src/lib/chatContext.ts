// What the chat was just about, sent with every message (Sohbet Faz 2, 2026-10-24, Emre: "önce ekran görüntüsü atıp sonra
// onun hakkında bir şey söylediğimde benimle iletişim kurabilmeli", "art ardına gönderdiğim mesajlar farklı farklı tepkiler
// vererek değil"): the files handed over lately and what each became, and the records the last answer touched, so "bunun
// fiyatı", "onu sil", "bunu genel yap" go to the right record. Pure; the gathering is in assistant.ts.
import { lineOf, type BoardLine } from "./boardChange";
import type { Item } from "./types";

/** A file handed over lately: its name, when, and the record it became (null while it's read, or when it became none). */
export interface RecentFile {
  file: string;
  at: number;
  became: BoardLine | null;
  /** The document's kind as read ("ticket", "booking"...), when it was one. */
  doc?: string;
}

/** How far back a file still counts as "the one I just sent". */
export const RECENT_MS = 2 * 60 * 60 * 1000;
const FILES_MAX = 5;

const clock = (at: number) => new Date(at).toTimeString().slice(0, 5);

/**
 * The block for the model: the files, newest first, and the focus (the last answer's records), each by its id to point at.
 * null when there is nothing to say.
 */
export function recentBlock(files: readonly RecentFile[], focus: readonly Item[], now = Date.now()): string | null {
  const fresh = [...files].filter((f) => now - f.at <= RECENT_MS).sort((a, b) => b.at - a.at).slice(0, FILES_MAX);
  if (!fresh.length && !focus.length) return null;
  return JSON.stringify({
    ...(fresh.length ? { files: fresh.map((f) => ({ file: f.file, added: clock(f.at), became: f.became, ...(f.doc ? { doc: f.doc } : {}) })) } : {}),
    ...(focus.length ? { focus: focus.map(lineOf) } : {}),
    note: "files: what the traveller sent lately, newest first, and the record each became (\"this\", \"its price\", \"the screenshot\" mean the newest). focus: the records your last answer changed (\"it\", \"that one\", \"make it general\" mean these). Point at them by id.",
  });
}

/** The records the last answer touched, as they are now (dismissed ones too: "geri getir" points at them). */
export function focusOf(touched: readonly string[] | undefined, items: readonly Item[]): Item[] {
  if (!touched?.length) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  return [...new Set(touched)].map((id) => byId.get(id)).filter((i): i is Item => i != null).slice(0, 8);
}
