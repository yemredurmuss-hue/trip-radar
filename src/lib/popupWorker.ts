// Simgeye basınca (0.43.0, tuval "Benle gezen eklenti" 8 · Simgeye basınca, Emre onayladı): the popup only shows and asks;
// reading the page, its screenshot, the save and the routing all happen here, in the service worker, only when "Desteye
// ekle" is pressed. The popup opens at once and stays light (no database, no model in it): it asks these four questions.
// Every answer is for our own extension pages only (the popup), never a site's.
import { chooseItem } from "../app/actions";
import { planFlightFor } from "./bring";
import { badgeOf, candidateOf, markBuying } from "./candidateTabs";
import { companionName, companionSiteOf, deckWord, offerPageKind, originOf, siteKindOf, type CompanionWhere, type SiteKind, type TripPick } from "./companion";
import { bindFor, whereFor } from "./companionWorker";
import { watch } from "./contextSave";
import { db, hasActiveKey } from "./db";
import { undoSave } from "./saveUndo";
import { L } from "./i18n";
import { formatDateRange } from "./items";
import { collectPage } from "./pagecapture";
import { priceBadge, type PriceBadge } from "./priceBadge";
import { saveSnapshot } from "./process";
import type { Item } from "./types";
import { flightSearchOf, parseUrl } from "./url";
import { downscale } from "./browser";

export type PopupAsk =
  | { type: "popup:view"; tabId: number }
  | { type: "popup:save"; tabId: number; pick: TripPick; idea?: boolean }
  | { type: "popup:undo"; captureId: string }
  | { type: "popup:decide"; tabId: number }
  | { type: "popup:buy"; tabId: number };

/** What the page is, as the code tells it: a place's own page, a list of results, any other page with a price, or an idea. */
export type PageWhat = SiteKind | "list" | "page" | "idea";

export interface PopupView {
  /** board: our own pages; none: a page that can't be saved (chrome://, the Web Store). */
  kind: "board" | "none" | "page";
  title: string;
  /** "Booking.com · otel · 12 – 16 Kas". */
  sub: string;
  /** The page's own site (its origin pattern) and whether the extension comes along there. */
  site: string | null;
  travelSite: boolean;
  along: boolean;
  what: PageWhat;
  where: CompanionWhere | null;
  desk: { candidate: { name: string; price: string | null; badge: string; route: string } | null; planned: { title: string; from: string; to: string; day: string; count: number } | null };
  key: boolean;
  price: PriceBadge | null;
}

/** Read in the page itself, in a blink (no layout): what it says it is, whether a price is written on it. */
function probePage(): { ld: string[]; price: boolean } {
  const ld: string[] = [];
  const walk = (v: unknown, depth: number): void => {
    if (!v || typeof v !== "object" || depth > 4) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    const t = (v as Record<string, unknown>)["@type"];
    if (typeof t === "string") ld.push(t);
    else if (Array.isArray(t)) ld.push(...t.filter((x): x is string => typeof x === "string"));
    walk((v as Record<string, unknown>)["@graph"], depth + 1);
  };
  for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(0, 12)) {
    try {
      walk(JSON.parse(s.textContent ?? ""), 0);
    } catch {
      // (broken JSON-LD: the address still says)
    }
  }
  const text = (document.body?.textContent ?? "").slice(0, 40_000);
  return { ld, price: /(?:€|£|₺|\$|฿|\b(?:TL|EUR|USD|GBP|TRY|THB)\b)\s?\d|\d\s?(?:€|£|₺|\$|฿|\b(?:TL|EUR|USD|GBP|TRY|THB)\b)/.test(text) };
}

const KIND_WORD: Record<PageWhat, () => string> = {
  stay: () => L("konaklama", "stay"),
  activity: () => L("etkinlik", "activity"),
  flight: () => L("uçuş", "flight"),
  transport: () => L("yolculuk", "journey"),
  any: () => L("sayfa", "page"),
  list: () => L("sonuç listesi", "results"),
  page: () => L("sayfa", "page"),
  idea: () => L("yazı", "article"),
};

export async function popupView(tabId: number): Promise<PopupView> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const url = tab?.url ?? "";
  const own = chrome.runtime.getURL("");
  const base: PopupView = { kind: "none", title: tab?.title ?? "", sub: "", site: null, travelSite: false, along: false, what: "idea", where: null, desk: { candidate: null, planned: null }, key: await hasActiveKey(), price: await priceBadge() };
  // (our own pages, the board or the popup in a tab: their address isn't always visible here, their context is)
  const ours = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] }).catch(() => []);
  if (url.startsWith(own) || ours.some((c) => c.tabId === tabId)) return { ...base, kind: "board" };
  if (!/^https?:/.test(url)) return base;
  const travel = companionSiteOf(url);
  const origin = originOf(url);
  const hosts = new Set<string>((chrome.runtime.getManifest().host_permissions ?? []) as string[]);
  const site = travel ?? (origin && !hosts.has(origin) ? origin : null);
  const along = site ? await chrome.permissions.contains({ origins: [site] }).catch(() => false) : false;
  const [probe] = await chrome.scripting.executeScript({ target: { tabId }, func: probePage }).catch(() => [] as chrome.scripting.InjectionResult<{ ld: string[]; price: boolean }>[]);
  const ld = probe?.result?.ld ?? [];
  const search = flightSearchOf(url);
  const single = offerPageKind(url, ld);
  const what: PageWhat = search ? "flight" : single ?? (travel ? "list" : probe?.result?.price ? "page" : "idea");
  const facts = parseUrl(url);
  const sub = [companionName(site ?? origin ?? ""), KIND_WORD[what](), facts.checkIn ? formatDateRange(facts.checkIn, facts.checkOut) : null].filter(Boolean).join(" · ");
  // (Benle gezen eklenti, seviye 1: a candidate we opened, or a search for a planned flight)
  const c = await candidateOf(tabId).catch(() => null);
  let planned: PopupView["desk"]["planned"] = null;
  if (search) {
    const d = await db();
    const p = planFlightFor(await d.getAll("items"), search);
    const trip = p ? await d.get("trips", p.tripId) : undefined;
    if (p && trip) planned = { title: trip.title, from: p.from, to: p.to, day: p.day, count: p.ids.length };
  }
  return {
    ...base,
    kind: "page",
    sub,
    site,
    travelSite: Boolean(travel),
    along,
    what,
    where: await whereFor(url, tab?.title ?? ""),
    desk: { candidate: c ? { name: c.name, price: c.price ?? null, badge: badgeOf(c), route: c.route } : null, planned },
  };
}

/** "Desteye ekle": the page read and saved now, into its trip (and its row); the popup may close at once. */
export async function popupSave(tabId: number, pick: TripPick, idea: boolean, process: () => void): Promise<{ captureId: string; tripTitle: string | null; deck: string } | null> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.url || !/^https?:/.test(tab.url)) return null;
  const c = await candidateOf(tabId).catch(() => null);
  const search = flightSearchOf(tab.url);
  const d = await db();
  const planned = search ? planFlightFor(await d.getAll("items"), search) : null;
  const bind = c ? { forTripId: c.tripId } : planned ? { forTripId: planned.tripId, forNeed: planned.forNeed } : await bindFor(tab.url, tab.title ?? "", pick);
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: collectPage });
  if (!result?.result) return null;
  let shot: string | null = null;
  try {
    shot = await downscale(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 85 }));
  } catch {
    // (some pages refuse it: the text is enough)
  }
  const capture = await saveSnapshot(result.result, shot, { ...bind, idea });
  process();
  void watch(capture.id, tabId);
  const trip = bind.forTripId ? await d.get("trips", bind.forTripId) : undefined;
  const kind = siteKindOf(companionSiteOf(tab.url) ?? "");
  return { captureId: capture.id, tripTitle: trip?.title ?? null, deck: idea ? L("Fikirler", "Ideas") : deckWord(search ? "flight" : (offerPageKind(tab.url) ?? kind)) };
}


/** On a candidate's tab: "Buna karar ver" (its deck's others stay options). */
export async function popupDecide(tabId: number): Promise<string | null> {
  const c = await candidateOf(tabId).catch(() => null);
  if (!c) return null;
  const d = await db();
  const item = await d.get("items", c.itemId);
  if (!item) return null;
  const same = item.flight?.from && item.flight.to && item.dates.start ? planFlightFor(await d.getAll("items"), { from: item.flight.from, to: item.flight.to, day: item.dates.start }) : null;
  const alternatives = same ? (await Promise.all(same.ids.map((id) => d.get("items", id)))).filter((i): i is Item => i != null) : [];
  await chooseItem(item, alternatives);
  return item.name;
}

export async function popupBuy(tabId: number): Promise<boolean> {
  await markBuying(tabId);
  return true;
}

/** The popup's questions answered; only from our own pages. */
export function popupAnswer(message: PopupAsk | { type?: unknown }, sender: chrome.runtime.MessageSender, process: () => void): Promise<unknown> | null {
  if (typeof message?.type !== "string" || !message.type.startsWith("popup:")) return null;
  // (our own pages only: the popup, or the popup opened in a tab; never a site's content script)
  if (sender.id !== chrome.runtime.id || !(sender.url ?? "").startsWith(chrome.runtime.getURL(""))) return Promise.resolve(null);
  const m = message as PopupAsk;
  switch (m.type) {
    case "popup:view":
      return popupView(m.tabId);
    case "popup:save":
      return popupSave(m.tabId, m.pick ?? {}, m.idea === true, process);
    case "popup:undo":
      return undoSave(m.captureId);
    case "popup:decide":
      return popupDecide(m.tabId);
    case "popup:buy":
      return popupBuy(m.tabId);
    default:
      return Promise.resolve(null);
  }
}
