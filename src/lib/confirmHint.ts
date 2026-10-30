// Rezervasyonu her sitede fark etme (Emre onayladı 2026-10-30): on any site, a tab whose address looks like a booking's
// confirmation (CONFIRM_URL, lib/confirm.ts) turns the toolbar icon green with a ✓ (declarativeContent: Chrome matches it,
// 0.47.32) and opens the popup by itself (0.47.33, webNavigation: "Göz atma geçmişinizi okuma"). Each address is only
// tested here, never kept or sent; a matching one is kept for the popup until the browser closes (storage.session). The
// popup opened this way can't read the page (Chrome gives activeTab only to a press on the icon): its "Kaydet" asks Chrome
// once for that site, then reads and saves it as always. A press on the icon itself reads it without asking.
import { CONFIRM_URL } from "./confirm";

const CONFIRM_RE = new RegExp(CONFIRM_URL.replace(/^\(\?i\)/, ""), "i");
const OPENED = "confirmOpened";

/** An address that looks like a booking's confirmation (the icon's and the popup's rule, CONFIRM_URL). */
export const confirmAddress = (url: string): boolean => CONFIRM_RE.test(url);

/** The confirmation-looking address the popup was opened for on that tab (it can't see the tab's address itself). */
export async function openedFor(tabId: number): Promise<string | null> {
  try {
    const all = ((await chrome.storage.session.get(OPENED))[OPENED] ?? {}) as Record<string, string>;
    return all[String(tabId)] ?? null;
  } catch {
    return null;
  }
}

/** A tab's page (its top frame) arrived at a confirmation-looking address: the popup opens over it, once per address. */
export function listenConfirmPages(): void {
  const nav = chrome.webNavigation;
  if (!nav) return;
  const arrived = (d: { tabId: number; frameId: number; url: string }) => {
    if (d.frameId !== 0 || !CONFIRM_RE.test(d.url)) return;
    void (async () => {
      const got: Record<string, unknown> = await chrome.storage.session.get(OPENED).catch(() => ({}));
      const all = (got[OPENED] ?? {}) as Record<string, string>;
      if (all[String(d.tabId)] === d.url) return;
      await chrome.storage.session.set({ [OPENED]: { ...all, [String(d.tabId)]: d.url.slice(0, 2000) } }).catch(() => undefined);
      const tab = await chrome.tabs.get(d.tabId).catch(() => null);
      // (only the tab in front: never over another page the traveller is looking at)
      if (!tab?.active) return;
      await chrome.action.openPopup({ windowId: tab.windowId }).catch(() => undefined);
    })();
  };
  nav.onCompleted.addListener(arrived);
  // (a page that changes its address without loading, as checkouts often do)
  nav.onHistoryStateUpdated.addListener(arrived);
  chrome.tabs.onRemoved.addListener((tabId) => {
    void chrome.storage.session
      .get(OPENED)
      .then((got) => {
        const all = { ...((got[OPENED] ?? {}) as Record<string, string>) };
        if (!(String(tabId) in all)) return;
        delete all[String(tabId)];
        return chrome.storage.session.set({ [OPENED]: all });
      })
      .catch(() => undefined);
  });
}

/** The icon with a green ✓ in its corner, at the toolbar's two sizes. */
async function markedIcon(): Promise<Record<string, ImageData>> {
  const out: Record<string, ImageData> = {};
  for (const size of [16, 32]) {
    const bmp = await createImageBitmap(await (await fetch(chrome.runtime.getURL(`icons/icon-${size}.png`))).blob());
    const canvas = new OffscreenCanvas(size, size);
    const c = canvas.getContext("2d")!;
    c.drawImage(bmp, 0, 0, size, size);
    const r = size * 0.3, x = size - r, y = size - r;
    c.fillStyle = "#1f7a45";
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = Math.max(1.5, size / 11);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(x - r * 0.5, y + r * 0.02);
    c.lineTo(x - r * 0.12, y + r * 0.4);
    c.lineTo(x + r * 0.52, y - r * 0.36);
    c.stroke();
    out[String(size)] = c.getImageData(0, 0, size, size);
  }
  return out;
}

/** The rule set once (Chrome keeps it across restarts); made again on each install and update. */
export async function markConfirmPages(): Promise<void> {
  const dc = chrome.declarativeContent;
  if (!dc?.onPageChanged) return;
  const imageData = await markedIcon().catch(() => null);
  if (!imageData) return;
  await new Promise<void>((done) => dc.onPageChanged.removeRules(undefined, () => done()));
  await new Promise<void>((done) =>
    dc.onPageChanged.addRules([{ id: "confirm-page", conditions: [new dc.PageStateMatcher({ pageUrl: { urlMatches: CONFIRM_URL } })], actions: [new dc.SetIcon({ imageData })] }], () => done()),
  );
}
