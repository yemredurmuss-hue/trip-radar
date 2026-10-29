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
import { moveSave, undoSave } from "./saveUndo";
import { pocketFor, pocketRemove, pocketRetry, type Pocket } from "./pocket";
import { loadCurrent, setCurrent } from "./tripRules";
import { confirmationOf, type Confirmation } from "./confirm";
import { tripGlance, type TripGlance } from "./tripGlance";
import { tripShelf, type Shelf } from "./tripShelf";
import { today } from "./extract";
import { pageCountry } from "./companionWorker";
import { loadHome } from "./passport";
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
  | { type: "popup:save"; tabId: number; pick: TripPick; idea?: boolean; inView?: boolean }
  | { type: "popup:undo"; captureId: string }
  | { type: "popup:move"; captureId: string; pick: TripPick }
  | { type: "popup:pocket"; tripId: string | null }
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
  price: PriceBadge | null;
  /** Gezi cebi: the trip, what was added to it last, the saves waiting for a key. */
  pocket: Pocket | null;
  /** Tek bakış (0.45.0): the page's own picture (og:image), its video when it's one, a booking's confirmation on it. */
  hero: string | null;
  video: boolean;
  confirm: Confirmation | null;
  /** Pano's "Biriktirdiklerim" and the trip's next thing to do. */
  glance: TripGlance | null;
  /** No trip picked yet to collect for (the first question is "Hangi gezi için topluyorsun?"). */
  fresh: boolean;
  /** A save of this trip that couldn't be read, a moment ago (the card says it first). */
  failed: { id: string; title: string } | null;
  /** "Booking'de kartlara + koyayım mı?" was asked once already. */
  alongAsked: boolean;
  /** Where nothing can be added (a new tab, the board): the trips ahead, the selected one first (açılır kart v1.1). */
  shelf: Shelf | null;
}

/** Read in the page itself, in a blink (no layout): what it says it is, whether a price is written on it, its picture. */
function probePage(): { ld: string[]; price: boolean; image: string | null; text: string; jsonLd: unknown[] } {
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
  const meta = (k: string) => document.querySelector<HTMLMetaElement>(`meta[property="${k}"], meta[name="${k}"]`)?.content ?? null;
  // (a site that changes pages without loading them, YouTube among them, keeps the first page's og:image: only when its
  // og:url is this page; else the biggest photo in view)
  const ogUrl = meta("og:url");
  const here = (u: string) => {
    try {
      const a = new URL(u, location.href), b = new URL(location.href);
      return a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "") && a.pathname.replace(/\/+$/, "") === b.pathname.replace(/\/+$/, "");
    } catch {
      return false;
    }
  };
  const og = !ogUrl || here(ogUrl) ? ([meta("og:image"), meta("twitter:image")].find((u): u is string => Boolean(u && /^https:\/\//.test(u))) ?? null) : null;
  let big: { src: string; area: number } | null = null;
  for (const img of Array.from(document.images).slice(0, 300)) {
    const r = img.getBoundingClientRect();
    const src = img.currentSrc || img.src;
    if (!/^https:\/\//.test(src) || r.width < 200 || r.height < 120 || r.bottom < 0 || r.top > innerHeight) continue;
    const area = r.width * r.height;
    if (!big || area > big.area) big = { src, area };
  }
  const image = og ?? big?.src ?? null;
  return { ld, price: /(?:€|£|₺|\$|฿|\b(?:TL|EUR|USD|GBP|TRY|THB)\b)\s?\d|\d\s?(?:€|£|₺|\$|฿|\b(?:TL|EUR|USD|GBP|TRY|THB)\b)/.test(text), image, text: text.slice(0, 30_000), jsonLd: JSON.parse(JSON.stringify(blocks)).slice(0, 12) };
}

/** A video's own picture from its address (YouTube's thumbnail); null for anything else. */
export function videoThumb(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(?:www|m)\./, "");
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : host === "youtube.com" ? (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1] ?? null) : null;
    return id && /^[\w-]{6,20}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

const isVideo = (url: string) => /^https:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/(?:watch|shorts\/)|youtu\.be\/)|^https:\/\/(?:www\.)?vimeo\.com\/\d/.test(url);
const ALONG_ASKED = "alongAsked";
const FAILED_FRESH_MS = 15 * 60_000;

/** Pano's count and the next thing to do, for the trip the popup shows. */
async function glanceOf(tripId: string | null | undefined): Promise<TripGlance | null> {
  if (!tripId) return null;
  const d = await db();
  const trip = await d.get("trips", tripId);
  return trip ? tripGlance(trip, await d.getAllFromIndex("items", "tripId", tripId), today()) : null;
}

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
  const url = tab?.url ?? "";
  const own = chrome.runtime.getURL("");
  const base: PopupView = { kind: "none", title: tab?.title ?? "", sub: "", site: null, travelSite: false, along: false, what: "idea", where: null, desk: { candidate: null, planned: null }, key: await hasActiveKey(), price: await priceBadge(), pocket: null, hero: null, video: false, confirm: null, glance: null, fresh: false, failed: null, alongAsked: true, shelf: null };
  // (our own pages, the board or the popup in a tab: their address isn't always visible here, their context is)
  const ours = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] }).catch(() => []);
  // (our own pages and pages that can't be saved: the pocket still shows the trip and what was added last)
  if (url.startsWith(own) || ours.some((c) => c.tabId === tabId) || !/^https?:/.test(url)) {
    const pocket = await pocketFor(null);
    return { ...base, kind: url.startsWith(own) || ours.some((c) => c.tabId === tabId) ? "board" : "none", pocket, glance: await glanceOf(pocket.trip?.id), failed: await freshFailure(pocket.trip?.id), shelf: await tripShelf() };
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
  const tripId = c?.tripId ?? plannedTrip ?? where.trip?.id ?? null;
  const pocket = await pocketFor(tripId);
  const cur = await loadCurrent();
  return {
    ...base,
    kind: "page",
    sub,
    site,
    travelSite: Boolean(travel),
    along,
    what,
    where,
    desk: { candidate: c ? { name: c.name, price: c.price ?? null, badge: badgeOf(c), route: c.route } : null, planned },
    pocket,
    hero: videoThumb(url) ?? probe?.result?.image ?? null,
    video,
    confirm,
    glance: await glanceOf(tripId ?? pocket.trip?.id),
    // (no trip picked to collect for, or it's over: the first question)
    fresh: !cur || Date.now() - cur.at > 24 * 3600_000,
    failed: await freshFailure(tripId ?? pocket.trip?.id),
    alongAsked: await alongAsked(),
  };
}

/** "Desteye ekle": the page read and saved now, into its trip (and its row); the popup may close at once. */
export async function popupSave(tabId: number, pick: TripPick, idea: boolean, process: () => void, inView = false): Promise<{ captureId: string; tripId: string | null; tripTitle: string | null; deck: string } | null> {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.url || !/^https?:/.test(tab.url)) return null;
  const c = await candidateOf(tabId).catch(() => null);
  const search = flightSearchOf(tab.url);
  const d = await db();
  const planned = search ? planFlightFor(await d.getAll("items"), search) : null;
  const bind = c ? { forTripId: c.tripId } : planned ? { forTripId: planned.tripId, forNeed: planned.forNeed } : await bindFor(tab.url, tab.title ?? "", pick);
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: collectPage });
  if (!result?.result) return null;
  // ("Ekrandakileri ekle" on a list: what is in view, never the whole list as one record)
  const snap = inView ? { ...result.result, pageText: result.result.viewportText } : result.result;
  let shot: string | null = null;
  try {
    shot = await downscale(await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 85 }));
  } catch {
    // (some pages refuse it: the text is enough)
  }
  const capture = await saveSnapshot(snap, shot, { ...bind, idea });
  process();
  void watch(capture.id, tabId);
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
      return popupSave(m.tabId, m.pick ?? {}, m.idea === true, process, m.inView === true);
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
    case "popup:pocket":
      return pocketFor(typeof m.tripId === "string" ? m.tripId.slice(0, 80) : null);
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
