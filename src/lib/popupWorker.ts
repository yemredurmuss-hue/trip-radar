// Simgeye basınca (0.43.0, tuval "Benle gezen eklenti" 8; tek Kaydet 0.47.29): the popup only shows and asks; reading the
// page, its screenshot, the save and the routing all happen here, in the service worker, only when "Kaydet" is pressed.
// The popup opens at once and stays light (no database, no model in it): it asks these questions.
// Every answer is for our own extension pages only (the popup), never a site's.
import { chooseItem } from "../app/actions";
import { planFlightFor } from "./bring";
import { badgeOf, candidateOf, markBuying } from "./candidateTabs";
import { companionName, companionSiteOf, deckWord, offerPageKind, originOf, siteKindOf, type CompanionWhere, type SiteKind, type TripPick } from "./companion";
import { bindFor, pickOf, whereFor } from "./companionWorker";
import { watch } from "./contextSave";
import { db, hasActiveKey } from "./db";
import { moveSave, undoSave } from "./saveUndo";
import { pocketFor, pocketRemove, pocketRetry, type Pocket } from "./pocket";
import { rememberTrip, setCurrent } from "./tripRules";
import { confirmationOf, type Confirmation } from "./confirm";
import { tripShelf, type Shelf } from "./tripShelf";
import { pageCountry, pageKey } from "./companionWorker";
import { loadHome } from "./passport";
import { L } from "./i18n";
import { formatDateRange } from "./items";
import { collectPage } from "./pagecapture";
import { saveSnapshot } from "./process";
import type { Item } from "./types";
import { flightSearchOf, parseUrl } from "./url";
import { downscale } from "./browser";
import { confirmAddress, openedFor } from "./confirmHint";
import { askFor, clearAsk, tellPage } from "./popupAsk";
import { cleanTitle, videoThumb } from "./saveLabels";
import { saveResult } from "./companionWorker";
import { savePastedLink } from "./process";

export type PopupAsk =
  | { type: "popup:view"; tabId: number }
  | { type: "popup:save"; tabId: number; pick: TripPick; idea?: boolean; ask?: boolean }
  | { type: "popup:undo"; captureId: string }
  | { type: "popup:move"; captureId: string; pick: TripPick }
  | { type: "popup:remove"; id: string }
  | { type: "popup:retry"; id: string }
  | ({ type: "popup:current"; tabId: number } & TripPick)
  | { type: "popup:along-asked" }
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
  /** Gezi cebi: the trip, what was added to it last, the saves waiting for a key. */
  pocket: Pocket | null;
  /** A booking's confirmation on the page (tek bakış 0.45.0). */
  confirm: Confirmation | null;
  /** A save of this trip that couldn't be read, a moment ago (the card says it first). */
  failed: { id: string; title: string } | null;
  /** "Booking'de kartlara + koyayım mı?" was asked once already. */
  alongAsked: boolean;
  /** The trips ahead, the selected one first (açılır kart v1.1); on a page too, every one (tek Kaydet: the trip list is the popup). */
  shelf: Shelf | null;
  /** The page's own little icon (the tab's), https or data only. */
  favicon: string | null;
  /** This page is on the plan already: in which trip, its card, and whether "Çıkar" may take it (only a card not chosen or booked). */
  here: { tripId: string; itemId: string; removable: boolean } | null;
  /**
   * Opened by itself over a booking's confirmation (lib/confirmHint.ts): the page's address looks like one, and the site
   * this popup may not read yet (Chrome gives that only to a press on the icon): "Kaydet" asks Chrome for it first, once.
   */
  confirmUrl: boolean;
  access: string | null;
  /** The page's own picture for the card on top (v5): a video's frame, its og:image; null: its icon. */
  photo: string | null;
  /** What a result's "+" or a right-click on a link asked to save (lib/popupAsk.ts): shown on top instead of the page. */
  ask: { kind: "result" | "link"; title: string; sub: string; photo: string | null; flight: boolean } | null;
}

/** Read in the page itself, in a blink (no layout): what it says it is, whether a price is written on it, its words. */
function probePage(): { ld: string[]; price: boolean; text: string; jsonLd: unknown[]; og: { title: string; image: string; site: string } } {
  const ld: string[] = [];
  const blocks: unknown[] = [];
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
      const v = JSON.parse(s.textContent ?? "");
      blocks.push(v);
      walk(v, 0);
    } catch {
      // (broken JSON-LD: the address still says)
    }
  }
  const text = (document.body?.textContent ?? "").replace(/\s+/g, " ").slice(0, 40_000);
  const meta = (k: string) => (document.querySelector(`meta[property="${k}"], meta[name="${k}"]`)?.getAttribute("content") ?? "").trim().slice(0, 2000);
  const og = { title: meta("og:title"), image: meta("og:image") || meta("twitter:image"), site: meta("og:site_name") };
  return { ld, price: /(?:€|£|₺|\$|฿|\b(?:TL|EUR|USD|GBP|TRY|THB)\b)\s?\d|\d\s?(?:€|£|₺|\$|฿|\b(?:TL|EUR|USD|GBP|TRY|THB)\b)/.test(text), text: text.slice(0, 30_000), jsonLd: JSON.parse(JSON.stringify(blocks)).slice(0, 12), og };
}

const isVideo = (url: string) => /^https:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch|shorts\/)|youtu\.be\/)|^https:\/\/(?:www\.)?vimeo\.com\/\d/.test(url);
const ALONG_ASKED = "alongAsked";
const FAILED_FRESH_MS = 15 * 60_000;

/** A save of this trip that failed a moment ago: said before anything else, with its "Tekrar dene". */
async function freshFailure(tripId: string | null | undefined): Promise<{ id: string; title: string } | null> {
  const d = await db();
  const now = Date.now();
  const failed = (await d.getAllFromIndex("captures", "status", "error"))
    .filter((c) => now - c.capturedAt < FAILED_FRESH_MS && (!c.forTripId || c.forTripId === tripId))
    .sort((a, b) => b.capturedAt - a.capturedAt)[0];
  return failed ? { id: `c:${failed.id}`, title: (failed.title ?? "").trim() || companionName(originOf(failed.url ?? "") ?? "") } : null;
}

async function alongAsked(): Promise<boolean> {
  try {
    return (await chrome.storage.local.get(ALONG_ASKED))[ALONG_ASKED] === true;
  } catch {
    return true;
  }
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
  // (opened by itself over a confirmation, without a press on the icon: Chrome hides the tab's address; the one it was
  // opened for, kept for it in this browser session)
  const opened = tab?.url ? null : await openedFor(tabId);
  const url = tab?.url ?? opened ?? "";
  const own = chrome.runtime.getURL("");
  const base: PopupView = { kind: "none", title: tab?.title ?? "", sub: "", site: null, travelSite: false, along: false, what: "idea", where: null, desk: { candidate: null, planned: null }, key: await hasActiveKey(), pocket: null, confirm: null, failed: null, alongAsked: true, shelf: null, favicon: null, here: null, confirmUrl: false, access: null, photo: null, ask: null };
  // (our own pages, the board or the popup in a tab: their address isn't always visible here, their context is)
  const ours = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] }).catch(() => []);
  // (our own pages and pages that can't be saved: the pocket still shows the trip and what was added last)
  if (url.startsWith(own) || ours.some((c) => c.tabId === tabId) || !/^https?:/.test(url)) {
    const pocket = await pocketFor(null);
    return { ...base, kind: url.startsWith(own) || ours.some((c) => c.tabId === tabId) ? "board" : "none", pocket, failed: await freshFailure(pocket.trip?.id), shelf: await tripShelf(true) };
  }
  const travel = companionSiteOf(url);
  const origin = originOf(url);
  const hosts = new Set<string>((chrome.runtime.getManifest().host_permissions ?? []) as string[]);
  const site = travel ?? (origin && !hosts.has(origin) ? origin : null);
  const along = site ? await chrome.permissions.contains({ origins: [site] }).catch(() => false) : false;
  const [probe] = await chrome.scripting.executeScript({ target: { tabId }, func: probePage }).catch(() => [] as chrome.scripting.InjectionResult<ReturnType<typeof probePage>>[]);
  const ld = probe?.result?.ld ?? [];
  const search = flightSearchOf(url);
  const single = offerPageKind(url, ld);
  const video = isVideo(url);
  const what: PageWhat = video ? "idea" : search ? "flight" : single ?? (travel ? "list" : probe?.result?.price ? "page" : "idea");
  const confirm = probe?.result ? confirmationOf({ text: probe.result.text, jsonLd: probe.result.jsonLd, title: tab?.title, url }) : null;
  const facts = parseUrl(url);
  const sub = [companionName(site ?? origin ?? ""), KIND_WORD[what](), facts.checkIn ? formatDateRange(facts.checkIn, facts.checkOut) : null].filter(Boolean).join(" · ");
  // (Benle gezen eklenti, seviye 1: a candidate we opened, or a search for a planned flight)
  const c = await candidateOf(tabId).catch(() => null);
  let planned: PopupView["desk"]["planned"] = null;
  let plannedTrip: string | null = null;
  if (search) {
    const d = await db();
    const p = planFlightFor(await d.getAll("items"), search);
    const trip = p ? await d.get("trips", p.tripId) : undefined;
    if (p && trip) planned = { title: trip.title, from: p.from, to: p.to, day: p.day, count: p.ids.length };
    if (p && trip) plannedTrip = trip.id;
  }
  const where = await whereFor(url, tab?.title ?? "");
  const key = pageKey(url);
  const mine = key && where.saved ? (await (await db()).getAll("items")).find((i) => i.status !== "dismissed" && pageKey(i.url) === key) : undefined;
  const icon = tab?.favIconUrl ?? "";
  const tripId = c?.tripId ?? plannedTrip ?? where.trip?.id ?? null;
  const pocket = await pocketFor(tripId);
  const siteName = probe?.result?.og.site || companionName(site ?? origin ?? "");
  // (the page's own title, cleaned of the tab's noise; YouTube's og:title lags behind its own moves, its tab's doesn't)
  const named = (!video && probe?.result?.og.title) || tab?.title || "";
  const image = probe?.result?.og.image ?? "";
  const asked = await askFor(tabId);
  return {
    ...base,
    kind: "page",
    // (the page's own name is hidden too when it was opened by itself: its site's)
    title: named ? cleanTitle(named, siteName) : companionName(site ?? origin ?? ""),
    sub,
    site,
    travelSite: Boolean(travel),
    along,
    what,
    where,
    desk: { candidate: c ? { name: c.name, price: c.price ?? null, badge: badgeOf(c), route: c.route } : null, planned },
    pocket,
    confirm,
    failed: await freshFailure(tripId ?? pocket.trip?.id),
    alongAsked: await alongAsked(),
    shelf: await tripShelf(true),
    favicon: /^(https:|data:image\/)/.test(icon) ? icon.slice(0, 4000) : null,
    here: mine ? { tripId: mine.tripId, itemId: mine.id, removable: mine.status === "saved" } : null,
    // (the address alone: Chrome's own rule, the same as the icon's green ✓)
    confirmUrl: confirmAddress(url),
    access: opened && origin ? origin : null,
    photo: videoThumb(url) ?? (/^https:\/\//.test(image) ? image : null),
    ask: asked ? askView(asked) : null,
  };
}

/** What waits to be saved, as the card on top says it: its own words, its site and kind, its picture. */
function askView(a: NonNullable<Awaited<ReturnType<typeof askFor>>>): NonNullable<PopupView["ask"]> {
  if (a.kind === "link") {
    const site = companionSiteOf(a.url) ?? originOf(a.url) ?? "";
    const kind = offerPageKind(a.url);
    return { kind: "link", title: cleanTitle(a.title, companionName(site)), sub: [companionName(site), kind ? KIND_WORD[kind]() : L("bağlantı", "link")].join(" · "), photo: a.photo, flight: kind === "flight" };
  }
  const site = companionSiteOf(a.url) ?? originOf(a.url) ?? "";
  // (the result's heading, a hotel's name; a flight's row has none: its own words, airline, times, price)
  const name = (a.name || a.text).replace(/\s+/g, " ").trim().slice(0, 160);
  const kind = siteKindOf(companionSiteOf(a.url) ?? "");
  // (a flight's row has no picture of its own, only an airline's logo: the plane says it better)
  return { kind: "result", title: cleanTitle(name, null), sub: [companionName(site), KIND_WORD[kind]()].join(" · "), photo: kind === "flight" ? null : a.photo, flight: kind === "flight" };
}

/** "Kaydet" for what a "+" or a right-click asked (lib/popupAsk.ts): saved into the trip picked, the page told. */
export async function popupSaveAsk(tabId: number, pick: TripPick, process: () => void): Promise<{ captureId: string; tripId: string | null; tripTitle: string | null; deck: string } | null> {
  const a = await askFor(tabId);
  if (!a) return null;
  const d = await db();
  if (a.kind === "result") {
    const r = await saveResult(tabId, a.url, a.title, a.text, a.print, pick, process);
    await clearAsk(tabId);
    if (!r.ok || !r.captureId) return null;
    tellPage(tabId, { type: "companion:asked", saved: true, captureId: r.captureId });
    return { captureId: r.captureId, tripId: r.tripId, tripTitle: r.tripTitle ?? null, deck: deckWord(siteKindOf(companionSiteOf(a.url) ?? "")) };
  }
  const bind = await bindFor(a.url, a.title, pick);
  const capture = await savePastedLink(a.url, bind.forTripId, undefined, null, bind.forNeed);
  await clearAsk(tabId);
  process();
  void watch(capture.id, tabId);
  const trip = bind.forTripId ? await d.get("trips", bind.forTripId) : undefined;
  return { captureId: capture.id, tripId: bind.forTripId ?? null, tripTitle: trip?.title ?? null, deck: deckWord(offerPageKind(a.url) ?? "any") };
}

/** "Kaydet": the page read and saved now, into its trip (and its row); the popup may close at once. */
export async function popupSave(tabId: number, pick: TripPick, idea: boolean, process: () => void): Promise<{ captureId: string; tripId: string | null; tripTitle: string | null; deck: string } | null> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.url || !/^https?:/.test(tab.url)) return null;
  const c = await candidateOf(tabId).catch(() => null);
  const search = flightSearchOf(tab.url);
  const d = await db();
  const planned = search ? planFlightFor(await d.getAll("items"), search) : null;
  const bind = c ? { forTripId: c.tripId } : planned ? { forTripId: planned.tripId, forNeed: planned.forNeed } : await bindFor(tab.url, tab.title ?? "", pick);
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: collectPage });
  if (!result?.result) return null;
  const snap = result.result;
  let shot: string | null = null;
  try {
    shot = await downscale(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 85 }));
  } catch {
    // (some pages refuse it: the text is enough)
  }
  const capture = await saveSnapshot(snap, shot, { ...bind, idea });
  process();
  void watch(capture.id, tabId);
  // (a place's own page whose "+ Kaydet" opened the popup: its "+" turns ✓)
  tellPage(tabId, { type: "companion:asked", saved: true, captureId: capture.id });
  const trip = bind.forTripId ? await d.get("trips", bind.forTripId) : undefined;
  const kind = siteKindOf(companionSiteOf(tab.url) ?? "");
  return { captureId: capture.id, tripId: bind.forTripId ?? null, tripTitle: trip?.title ?? null, deck: idea ? L("İlham", "Inspiration") : deckWord(search ? "flight" : (offerPageKind(tab.url) ?? kind)) };
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
      return m.ask === true ? popupSaveAsk(m.tabId, pickOf(m.pick ?? {}), process) : popupSave(m.tabId, pickOf(m.pick ?? {}), m.idea === true, process);
    case "popup:undo":
      return undoSave(m.captureId);
    case "popup:move":
      // ("Değiştir" after a save: that trip, the current one from now on)
      return (async () => {
        const tripId = typeof m.pick?.tripId === "string" ? m.pick.tripId.slice(0, 80) : null;
        if (!tripId || !(await moveSave(m.captureId, tripId))) return null;
        // (the trip of that page's country from now on, never of every country)
        const moved = await (await db()).get("captures", m.captureId);
        await setCurrent(tripId, moved?.url ? pageCountry(moved.url, moved.title ?? "", await loadHome().catch(() => null)) : null);
        return { tripId, tripTitle: (await (await db()).get("trips", tripId))?.title ?? null };
      })();
    case "popup:remove":
      return pocketRemove(String(m.id));
    case "popup:retry":
      return pocketRetry(String(m.id), process);
    case "popup:current":
      // (the trip chip: what this page and the next go to; a new trip for the page's country)
      return (async () => {
        const tab = await chrome.tabs.get(m.tabId).catch(() => null);
        const url = tab?.url ?? "";
        const country = /^https?:/.test(url) ? pageCountry(url, tab?.title ?? "", await loadHome().catch(() => null)) : null;
        const d = await db();
        const picked = typeof m.tripId === "string" ? await d.get("trips", m.tripId.slice(0, 80)) : undefined;
        let tripId = picked?.id ?? null;
        if (!tripId && m.newTrip && /^https?:/.test(url)) tripId = (await bindFor(url, tab?.title ?? "", { newTrip: true, remember: false })).forTripId ?? null;
        if (!tripId) return null;
        await setCurrent(tripId, country);
        // (a row picked on a page of a country: that country's trip from now on, so the pick shows; Ayarlar forgets it)
        if (m.remember === true) await rememberTrip(country, tripId);
        return popupView(m.tabId);
      })();
    case "popup:along-asked":
      return chrome.storage.local.set({ [ALONG_ASKED]: true }).then(() => true, () => false);
    case "popup:decide":
      return popupDecide(m.tabId);
    case "popup:buy":
      return popupBuy(m.tabId);
    default:
      return Promise.resolve(null);
  }
}
