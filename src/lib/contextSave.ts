// Sağ tık "Trip Radar'a kaydet" (0.41.0, board E3; tek Kaydet 0.47.31): the page under the mouse, or a link on it, saved as
// the toolbar saves it (the click grants activeTab, so no site's permission is needed). Into the selected trip, the
// popup's own: a planned flight's search, else the country's remembered trip, else the one picked last (bindFor); none,
// the model routes it and asks once (lib/tripRules.ts). The icon says how it went on that tab (··· → ✓); asked, a
// notification opens the board where the question waits.
import { downscale, openBoard } from "./browser";
import { bindFor } from "./companionWorker";
import { db } from "./db";
import { L } from "./i18n";
import { collectPage } from "./pagecapture";
import { savePastedLink, saveSnapshot } from "./process";

const MENU = "trip-radar-save";

/** The menu item, made again on each start (its words follow the board's language). */
export function setupContextMenu(): void {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU, title: L("Trip Radar'a kaydet", "Save to Trip Radar"), contexts: ["page", "link", "selection"] }, () => void chrome.runtime.lastError);
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
