// Sağ tık "Trip Radar'a kaydet" (0.41.0, board E3; Kaydet penceresi v5 0.47.35, Emre: "sağ tık kaydedince eklenti otomatik
// açılmalı ve sormalı"): the toolbar's popup opens over the page and asks which trip, as a press on the icon does; a link
// right-clicked waits for it there (lib/popupAsk.ts), its words and picture on the page shown on top. The click grants
// activeTab, so no site's permission is needed. Only when Chrome can't open the popup is it saved as before, quietly, into
// the selected trip (bindFor; none, the model routes it and asks once): the icon says how it went (··· → ✓).
import { downscale, openBoard } from "./browser";
import { bindFor } from "./companionWorker";
import { db } from "./db";
import { L } from "./i18n";
import { collectPage } from "./pagecapture";
import { savePastedLink, saveSnapshot } from "./process";
import { clearAsk, openAsk, setAsk } from "./popupAsk";

const MENU = "trip-radar-save";

/** The menu item, made again on each start (its words follow the board's language). */
export function setupContextMenu(): void {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU, title: L("Trip Radar'a ekle", "Add to Trip Radar"), contexts: ["page", "link", "selection"] }, () => void chrome.runtime.lastError);
  });
}

const badge = (tabId: number, text: string) => {
  void chrome.action.setBadgeBackgroundColor({ tabId, color: text === "!" ? "#c2410c" : "#5b45e0" }).catch(() => undefined);
  void chrome.action.setBadgeText({ tabId, text }).catch(() => undefined);
};

/** Saved from the menu, then watched until it is read: ✓ on the icon, or the question's notification. */
export function listenContextMenu(process: () => void): void {
  chrome.contextMenus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU || tab?.id == null) return;
    const tabId = tab.id;
    void (async () => {
      const link = info.linkUrl && /^https?:/.test(info.linkUrl) ? info.linkUrl : null;
      if (link) {
        const on = await linkOn(tabId, link);
        await setAsk(tabId, { kind: "link", url: link.slice(0, 2000), from: tab.url ?? "", title: on?.title || info.selectionText?.trim() || link, photo: on?.photo ?? null, at: Date.now() });
      } else await clearAsk(tabId);
      if (await openAsk(tab.windowId)) return;
      await clearAsk(tabId);
      badge(tabId, "···");
      try {
        let id: string;
        if (info.linkUrl && /^https?:/.test(info.linkUrl)) {
          const bind = await bindFor(info.linkUrl, info.selectionText ?? "", {});
          id = (await savePastedLink(info.linkUrl, bind.forTripId, undefined, null, bind.forNeed)).id;
        } else {
          if (!tab.url || !/^https?:/.test(tab.url)) throw new Error("not a page");
          const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: collectPage });
          if (!result?.result) throw new Error("unread");
          let shot: string | null = null;
          try {
            shot = await downscale(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 85 }));
          } catch {
            // (some pages block it: the text is enough)
          }
          id = (await saveSnapshot(result.result, shot, await bindFor(tab.url, tab.title ?? "", {}))).id;
        }
        process();
        await watch(id, tabId);
      } catch {
        badge(tabId, "!");
      }
    })();
  });
  chrome.notifications?.onClicked.addListener((id) => {
    if (!id.startsWith("held:")) return;
    void openBoard("");
    chrome.notifications.clear(id);
  });
}

/** A right-clicked link's own words and picture on its page (its card's heading when the link itself says little). */
async function linkOn(tabId: number, href: string): Promise<{ title: string; photo: string | null } | null> {
  const [r] = await chrome.scripting
    .executeScript({
      target: { tabId },
      args: [href],
      func: (href: string) => {
        const a = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find((x) => x.href === href);
        if (!a) return null;
        const card = a.closest("article, li, [class*='card'], [class*='item']") ?? a.parentElement;
        const words = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
        let title = words(a.innerText) || words(a.title) || words(a.getAttribute("aria-label"));
        if (title.length < 4) title = words(card?.querySelector("h1,h2,h3,h4")?.textContent) || title;
        const img = a.querySelector("img") ?? card?.querySelector("img");
        const src = img?.currentSrc || img?.src || "";
        return { title: title.slice(0, 300), photo: /^https:\/\//.test(src) ? src.slice(0, 2000) : null };
      },
    })
    .catch(() => [] as chrome.scripting.InjectionResult<{ title: string; photo: string | null } | null>[]);
  return r?.result ?? null;
}

/** Up to two minutes: read (✓, gone after a while), asked (a notification), or failed (!). */
export async function watch(captureId: string, tabId: number): Promise<void> {
  const d = await db();
  for (let n = 0; n < 80; n++) {
    await new Promise((r) => setTimeout(r, 1500));
    const c = await d.get("captures", captureId);
    if (!c || c.status === "pending" || c.status === "processing") continue;
    if (c.status === "error") return badge(tabId, "!");
    if (c.held && !c.held.answer) {
      badge(tabId, "?");
      try {
        chrome.notifications?.create(`held:${captureId}`, {
          type: "basic",
          iconUrl: "icons/icon-128.png",
          title: L("Hangi geziye koyalım?", "Which trip should it go to?"),
          message: c.held.question ?? c.held.item.name,
          priority: 1,
        });
      } catch {
        // (the board's waiting list still asks)
      }
      return;
    }
    badge(tabId, "✓");
    setTimeout(() => badge(tabId, ""), 4000);
    return;
  }
}
