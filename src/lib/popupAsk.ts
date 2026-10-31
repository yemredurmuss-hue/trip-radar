// Kaydet penceresi v5 (Emre onayladı 2026-10-31: "sağ tık kaydedince ya da sayfadaki + işareti ile eklenti otomatik açılmalı
// ve sormalı"): what a right-click on a link or a result's "+" asks to save waits here, for that tab, while the popup opened
// over it asks which trip. Kept in this browser session only (storage.session), a minute or two; gone once saved or once
// the popup closes without saving (the page's "+" then turns back). The popup's own "Kaydet" saves it (lib/popupWorker.ts).
import type { ResultPrint } from "./resultMark";

export type PopupAskItem =
  /** A result's "+" on a site: the result's own words, the page it is on. */
  | { kind: "result"; url: string; title: string; name: string; text: string; print: ResultPrint | null; photo: string | null; at: number }
  /** A right-click on a link: the link's address, its words and picture on the page it was on. */
  | { kind: "link"; url: string; from: string; title: string; photo: string | null; at: number };

const KEY = "popupAsk";
const FRESH_MS = 3 * 60_000;

async function all(): Promise<Record<string, PopupAskItem>> {
  try {
    return ((await chrome.storage.session.get(KEY))[KEY] ?? {}) as Record<string, PopupAskItem>;
  } catch {
    return {};
  }
}

export async function setAsk(tabId: number, item: PopupAskItem): Promise<void> {
  const now = Date.now();
  const kept = Object.fromEntries(Object.entries(await all()).filter(([, v]) => now - v.at < FRESH_MS));
  await chrome.storage.session.set({ [KEY]: { ...kept, [String(tabId)]: item } }).catch(() => undefined);
}

/** What waits for that tab's popup (null: nothing, or asked too long ago). */
export async function askFor(tabId: number): Promise<PopupAskItem | null> {
  const item = (await all())[String(tabId)];
  return item && Date.now() - item.at < FRESH_MS ? item : null;
}

/** Saved or given up: gone; true when there was one. */
export async function clearAsk(tabId: number): Promise<boolean> {
  const got = await all();
  if (!(String(tabId) in got)) return false;
  delete got[String(tabId)];
  await chrome.storage.session.set({ [KEY]: got }).catch(() => undefined);
  return true;
}

/** Opens the toolbar's popup over that tab's window (Chrome opens it under the icon only); false when it couldn't. */
export async function openAsk(windowId: number): Promise<boolean> {
  try {
    await chrome.action.openPopup({ windowId });
    return true;
  } catch {
    return false;
  }
}

/** Said to the page's content script (its "+" waits for it): saved there, or the popup closed without saving. */
export function tellPage(tabId: number, m: { type: "companion:asked"; saved: boolean; captureId?: string }): void {
  void chrome.tabs.sendMessage(tabId, m).catch(() => undefined);
}
