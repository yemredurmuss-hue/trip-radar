// Benle gezen eklenti, seviye 2: the service worker's side of "Sitede benle gel" (lib/companion.ts, src/companion.ts). It
// registers the content script for the sites the traveller allowed, and answers it: which planned flight this search is
// for and that deck's options (only that), and it saves what the traveller added there with "+" into that row. A
// message is answered only from our own content script on one of those sites (who asks is checked, never just trusted).
import { countryOfAirport } from "./airports";
import { downscale, openBoard } from "./browser";
import { planFlightFor } from "./bring";
import { originOf, type CompanionAsk, type CompanionRoute, type CompanionWhere, type DeckBrief, type SavedOnSite, type TripPick } from "./companion";
import { db, listTrips, newId } from "./db";
import { today } from "./extract";
import { formatDateRange } from "./items";
import type { PageSnapshot } from "./pagecapture";
import { titleCodes, tripPlaceCodes } from "./placeCheck";
import { sizedPhoto, THUMB_W } from "./photoCache";
import { saveSnapshot } from "./process";
import { moveSave, readingCount, undoSave } from "./saveUndo";
import { countryName, gapDays, isDemoTrip, profileTrips, uniqueTitle } from "./trips";
import { loadHome } from "./passport";
import { currentFor, loadCurrent, loadRules, rememberTrip, ruleFor, RULE_SLACK_DAYS, setCurrent, worthRemembering } from "./tripRules";
import type { Item, Trip } from "./types";
import { flightSearchOf, parseUrl } from "./url";
import { L } from "./i18n";
import { clearAsk, openAsk, setAsk } from "./popupAsk";
import { pocketFor } from "./pocket";
import { printOf, type ResultPrint } from "./resultMark";
import { markSaved, marksOn, savedAlready } from "./resultMarks";

const SCRIPT_ID = "trip-radar-companion";

/** The extension's own hosts (its model and lookups): never a site to come along on. */
const OWN_HOSTS = () => new Set<string>((chrome.runtime.getManifest().host_permissions ?? []) as string[]);

/**
 * The sites allowed: the travel sites (one switch) and any other allowed on its own ("Bu sitede de"), each as its own
 * origin pattern; never the extension's own hosts, never "every site".
 */
export async function allowedSites(): Promise<string[]> {
  const granted = (await chrome.permissions.getAll()).origins ?? [];
  const own = OWN_HOSTS();
  return granted.filter((o) => /^https:\/\/[^*/]+\/\*$/.test(o) && !own.has(o));
}

/** A page the companion may answer on: an allowed travel site, or a site allowed on its own. */
async function allowedPage(url: string): Promise<boolean> {
  const origin = originOf(url);
  if (!origin) return false;
  if (OWN_HOSTS().has(origin)) return false;
  return chrome.permissions.contains({ origins: [origin] }).catch(() => false);
}

/** The content script registered for the allowed sites only (none allowed: none registered). */
export async function syncCompanion(): Promise<void> {
  if (!chrome.scripting?.registerContentScripts || !chrome.permissions?.getAll) return;
  const matches = await allowedSites();
  const had = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] }).catch(() => []);
  if (had.length) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }).catch(() => undefined);
  if (!matches.length) return;
  await chrome.scripting.registerContentScripts([{ id: SCRIPT_ID, matches: [...matches], js: ["companion.js"], runAt: "document_idle", persistAcrossSessions: true }]);
}

const clock = (iso: string | null | undefined): string | null => (iso && /T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : null);
const brief = (i: Item): DeckBrief => ({
  name: [i.flight?.carrier, i.flight?.flightNumber].filter(Boolean).join(" ") || i.name,
  dep: clock(i.flight?.departure),
  arr: clock(i.flight?.arrival),
  price: i.price.amount,
  currency: i.price.currency,
  stops: i.flight?.stops ?? null,
});

/** The planned flight a search's address is for, and its deck (nothing else of the plan leaves the extension). */
export async function routeFor(url: string): Promise<(CompanionRoute & { forNeed: string; chosenId: string | null }) | null> {
  const search = flightSearchOf(url);
  if (!search) return null;
  const d = await db();
  const items = await d.getAll("items");
  const planned = planFlightFor(items, search);
  if (!planned) return null;
  const trip = await d.get("trips", planned.tripId);
  if (!trip) return null;
  const records = planned.ids.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => i != null);
  const chosen = records.find((i) => i.status === "chosen") ?? null;
  return { tripId: planned.tripId, title: trip.title, from: planned.from, to: planned.to, day: planned.day, deck: records.map(brief), chosen: chosen ? brief(chosen) : null, chosenId: chosen?.id ?? null, forNeed: planned.forNeed };
}

/**
 * The page's country as the code reads it, before any model: a Booking hotel's address says it (/hotel/pt/), a flight
 * search's arrival airport (the flight home, landing at home: where it leaves from), else a place its address or title
 * names ("Lisbon", "Bali"). Null when nothing says.
 */
export function pageCountry(url: string, title: string, home: string | null = null): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const own = u.pathname.match(/^\/hotel\/([a-z]{2})\//)?.[1];
  if (own && /booking\.com$/.test(u.hostname)) return own.toUpperCase();
  const search = flightSearchOf(url);
  if (search) {
    const to = countryOfAirport(search.to) ?? null;
    return to && to === home ? (countryOfAirport(search.from) ?? to) : to;
  }
  const words = decodeURIComponent(`${u.pathname} ${u.searchParams.get("ss") ?? ""} ${u.searchParams.get("q") ?? ""} ${u.searchParams.get("text") ?? ""}`).replace(/[-_/+]+/g, " ");
  return [...titleCodes(`${words} ${title}`)][0] ?? null;
}

/**
 * A trip's small pictures for the picker (Pinterest's board cover): its own photo, then its last two saved with one; a
 * listed trip's only its first. Each asked for at the size it's drawn (a 70 px tile, 2x), never a page's own data: copy
 * (2026-10-24, "açılırken çok kasılıyor": eight trips' 2400 px photos and 120 KB data: pictures came on every opening).
 */
function photosOf(trip: Trip, items: Item[], n: number): string[] {
  const ok = (u: string | null | undefined): u is string => Boolean(u && /^https:\/\//.test(u));
  const last = items
    .filter((i) => i.tripId === trip.id && i.status !== "dismissed" && ok(i.imageUrl))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((i) => i.imageUrl!);
  return [...new Set([trip.heroImage, ...last].filter(ok))].slice(0, n).map((u) => sizedPhoto(u, THUMB_W));
}

/**
 * Önerilen (Pinterest's Quick Picks): the country's trip on the page's day, the country's other trip, the trip saved into
 * last; without a country, the last one and the nearest ahead. At most three, the most likely first.
 */
export function quickPicks(own: Trip[], items: Item[], code: string | null, day: string | null, end: string | null, now: string): string[] {
  const profiles = profileTrips(own, items);
  const range = (t: Trip) => t.confirmedDates ?? profiles.find((p) => p.trip.id === t.id)?.range ?? null;
  const match = (t: Trip) => Boolean(code && (tripPlaceCodes(t.id, items).has(code) || titleCodes(t.title).has(code)));
  const fits = (t: Trip) => {
    const r = range(t);
    return Boolean(day && r && gapDays(r, day, end) <= RULE_SLACK_DAYS);
  };
  const ahead = (t: Trip) => {
    const r = range(t);
    return r && r.end >= now ? r.start : "9999";
  };
  const lastSaved = [...own].sort((a, b) => lastAt(b, items) - lastAt(a, items));
  const mine = own.filter(match);
  const order = [
    ...mine.filter(fits),
    ...[...mine].sort((a, b) => ahead(a).localeCompare(ahead(b))),
    ...lastSaved.slice(0, 1),
    ...[...own].filter((t) => ahead(t) !== "9999").sort((a, b) => ahead(a).localeCompare(ahead(b))),
    ...lastSaved,
  ];
  return [...new Set(order.map((t) => t.id))].slice(0, 3);
}
const lastAt = (t: Trip, items: Item[]) => Math.max(t.updatedAt, ...items.filter((i) => i.tripId === t.id).map((i) => i.createdAt ?? 0));

/**
 * A page's own address, its dates and tracking left out; what names the thing itself kept (2026-10-24: every YouTube
 * video was "youtube.com/watch", so one saved video made each one opened "zaten destende ✓ Eklendi").
 */
const ID_PARAMS = ["v", "id", "p", "fbid", "story_fbid"];
export const pageKey = (u: string | null | undefined): string | null => {
  try {
    const x = new URL(u ?? "");
    const ids = ID_PARAMS.filter((k) => x.searchParams.get(k)).map((k) => `${k}=${x.searchParams.get(k)}`);
    return `${x.hostname.replace(/^www\./, "")}${x.pathname}`.replace(/\/+$/, "") + (ids.length ? `?${ids.join("&")}` : "");
  } catch {
    return null;
  }
};

/** Where a page would go (the route's trip, the country's remembered one), else the trips to ask among. */
export async function whereFor(url: string, title: string): Promise<CompanionWhere> {
  const d = await db();
  const [trips, items, home] = await Promise.all([listTrips(), d.getAll("items"), loadHome().catch(() => null)]);
  const own = trips.filter((t) => !isDemoTrip(t));
  const code = pageCountry(url, title, home);
  const route = await routeFor(url);
  const day = flightSearchOf(url)?.day ?? parseUrl(url).checkIn ?? null;
  const end = parseUrl(url).checkOut ?? null;
  const rules = route || !code ? null : await loadRules();
  // (the route's row, else the country's remembered trip on its days, else the current trip: picked last, a page of the
  // same country or of none it can tell; only then asked)
  const trip: Trip | null = route
    ? (own.find((t) => t.id === route.tripId) ?? null)
    : ((rules && code ? ruleFor(rules, [code], own, items, day, end, today()) : null) ?? currentFor(await loadCurrent(), code, own, items, today()));
  const profiles = profileTrips(own, items);
  const match = (t: Trip) => Boolean(code && (tripPlaceCodes(t.id, items).has(code) || titleCodes(t.title).has(code)));
  const whenOf = (t: Trip) => {
    const r = t.confirmedDates ?? profiles.find((p) => p.trip.id === t.id)?.range ?? null;
    return r ? formatDateRange(r.start, r.end) : null;
  };
  const picks = quickPicks(own, items, code, day, end, today());
  const listed = [...own].sort((a, b) => Number(match(b)) - Number(match(a)) || b.updatedAt - a.updatedAt);
  const shown = [...picks.map((id) => listed.find((t) => t.id === id)!).filter(Boolean), ...listed.filter((t) => !picks.includes(t.id))].slice(0, 8);
  const key = pageKey(url);
  return {
    trip: trip ? { id: trip.id, title: trip.title } : null,
    country: code ? countryName(code) : null,
    trips: shown.map((t) => ({ id: t.id, title: t.title, when: whenOf(t), match: match(t), photos: photosOf(t, items, picks.includes(t.id) ? 3 : 1), count: items.filter((i) => i.tripId === t.id && i.status !== "dismissed").length })),
    picks,
    saved: Boolean(key && items.some((i) => i.status !== "dismissed" && pageKey(i.url) === key)),
  };
}

/**
 * Which trip (and row) what is added on the site goes into: the route's (a search for a planned flight), else the trip
 * picked in the page's own question (remembered as the country's when said so), a new trip for the country, or the
 * remembered one. None of these (no trip at all yet): the capture goes as the toolbar's does, its trip made from it.
 */
export async function bindFor(url: string, title: string, pick: TripPick): Promise<{ forTripId?: string; forNeed?: string }> {
  const bind = await bindOnce(url, title, pick);
  // (Şu anki gezi: what was just saved into is the trip of what comes next)
  if (bind.forTripId) await setCurrent(bind.forTripId, pageCountry(url, title, await loadHome().catch(() => null)));
  return bind;
}

async function bindOnce(url: string, title: string, pick: TripPick): Promise<{ forTripId?: string; forNeed?: string }> {
  const route = await routeFor(url);
  if (route) return { forTripId: route.tripId, forNeed: route.forNeed };
  const d = await db();
  const code = pageCountry(url, title, await loadHome().catch(() => null));
  const day = flightSearchOf(url)?.day ?? parseUrl(url).checkIn ?? null;
  if (pick.newTrip) {
    const trips = await listTrips();
    const now = Date.now();
    const made: Trip = { id: newId(), title: uniqueTitle(pick.title?.trim() || countryName(code) || L("Yeni gezi", "New trip"), null, trips), confirmedDates: null, budget: null, heroImage: null, createdAt: now, updatedAt: now };
    await d.put("trips", made);
    if (pick.remember !== false) await rememberTrip(code, made.id);
    return { forTripId: made.id };
  }
  const picked = typeof pick.tripId === "string" ? await d.get("trips", pick.tripId.slice(0, 80)) : undefined;
  if (picked && !isDemoTrip(picked)) {
    const own = (await listTrips()).filter((t) => !isDemoTrip(t));
    if (pick.remember && worthRemembering(code, day, own, await d.getAll("items"))) await rememberTrip(code, picked.id);
    return { forTripId: picked.id };
  }
  const where = await whereFor(url, title);
  return where.trip ? { forTripId: where.trip.id } : {};
}

export const pickOf = (m: TripPick): TripPick => ({
  tripId: typeof m.tripId === "string" ? m.tripId : undefined,
  newTrip: m.newTrip === true,
  remember: m.remember === true,
  title: typeof m.title === "string" ? m.title.replace(/\s+/g, " ").trim().slice(0, 60) || undefined : undefined,
});

/** A whole page's snapshot from the content script (collectPage), checked field by field; its address is the sender's. */
function pageSnapshot(raw: unknown, url: string): PageSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const strings = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, n).map((x) => x.slice(0, max)) : []);
  const meta: Record<string, string> = {};
  if (r.meta && typeof r.meta === "object") for (const [k, v] of Object.entries(r.meta as Record<string, unknown>).slice(0, 40)) if (typeof v === "string") meta[k.slice(0, 80)] = v.slice(0, 1000);
  const coords = Array.isArray(r.coords) ? r.coords.filter((c): c is { lat: number; lng: number; source: string } => typeof c?.lat === "number" && typeof c?.lng === "number").slice(0, 10).map((c) => ({ lat: c.lat, lng: c.lng, source: str(c.source, 40) })) : [];
  const images = Array.isArray(r.images) ? r.images.filter((i): i is { src: string; alt: string; inView: boolean } => typeof i?.src === "string").slice(0, 20).map((i) => ({ src: i.src.slice(0, 2000), alt: str(i.alt, 200), inView: i.inView === true })) : [];
  return { url, title: str(r.title, 300), pageText: str(r.pageText, 60_000), viewportText: str(r.viewportText, 12_000), selection: str(r.selection, 4000), jsonLd: strings(r.jsonLd, 20, 40_000), meta, coords, images };
}

/** Saved on the site: "+1" on the icon a moment (on that tab), and what the note says. */
async function savedOn(tabId: number, captureId: string, tripId: string | null, badge = true): Promise<{ ok: true; tripId: string | null; tripTitle: string | null; captureId: string; reading: number }> {
  // (not for one saved before: nothing new went in)
  if (badge) {
    try {
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#1f7a45" });
      await chrome.action.setBadgeText({ tabId, text: "+1" });
      setTimeout(() => void chrome.action.setBadgeText({ tabId, text: "" }).catch(() => undefined), 2500);
    } catch {
      // (no badge: the page's own ✓ says it)
    }
  }
  const trip = tripId ? await (await db()).get("trips", tripId) : undefined;
  return { ok: true, tripId, tripTitle: trip?.title ?? null, captureId, reading: await readingCount() };
}

async function shotOf(windowId: number): Promise<string | null> {
  try {
    const shot = await chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 80 });
    return await downscale(shot).catch(() => shot);
  } catch {
    return null; // (the text is still enough)
  }
}

const snapshotOf = (url: string, title: string, text: string): PageSnapshot => ({
  url,
  title: title.slice(0, 300),
  pageText: text,
  viewportText: text,
  selection: text,
  jsonLd: [],
  meta: {},
  coords: [],
  images: [],
});

/** A result saved from its page (its "+", or the popup it opened): one record, its ✓ kept for the page by its print. */
export async function saveResult(tabId: number, url: string, title: string, text: string, print: ResultPrint | null, pick: TripPick, process: () => void): Promise<SavedOnSite> {
  const bind = await bindFor(url, title, pick);
  // (✓ hatırlanır: the same result saved here before, still standing, makes no second record)
  const before = print && !pick.newTrip ? await savedAlready(url, print, bind.forTripId ?? null) : null;
  if (before) return { ...(await savedOn(tabId, before.captureId, before.tripId, false)), again: true };
  const capture = await saveSnapshot(snapshotOf(url, title, text), null, bind);
  if (print) await markSaved(url, print, capture.id);
  process();
  return savedOn(tabId, capture.id, bind.forTripId ?? null);
}

/**
 * One of the companion's questions answered (null: not the companion's). `process`: the capture queue's run, after a save.
 * Only our own content script on an allowed site is answered; the page's address is the sender's, never the message's.
 */
export function companionAnswer(message: CompanionAsk | { type?: unknown }, sender: chrome.runtime.MessageSender, process: () => void): Promise<unknown> | null {
  if (typeof message?.type !== "string" || !message.type.startsWith("desk:")) return null;
  const url = sender.url ?? sender.tab?.url ?? "";
  if (sender.id !== chrome.runtime.id || sender.tab?.id == null) return Promise.resolve(null);
  return allowedPage(url).then((ok) => (ok ? answerOn(message as CompanionAsk, url, sender, process) : null));
}

function answerOn(m: CompanionAsk, url: string, sender: chrome.runtime.MessageSender, process: () => void): Promise<unknown> {
  const text = (s: unknown, max: number) => (typeof s === "string" ? s.slice(0, max) : "");
  switch (m.type) {
    case "desk:route":
      return routeFor(url).then((r) => (r ? { tripId: r.tripId, title: r.title, from: r.from, to: r.to, day: r.day, deck: r.deck, chosen: r.chosen ?? null } : null));
    case "desk:where":
      return whereFor(url, text(m.title, 300));
    case "desk:add":
      return saveResult(sender.tab!.id!, url, text(m.title, 300), text(m.text, 1500), printOf(m.print), pickOf(m), process);
    case "desk:ask":
      // (Kaydet penceresi v5: the popup opens over the page and asks; a place's own page is the page itself, nothing waits)
      return (async () => {
        const tabId = sender.tab!.id!;
        if (m.page === true) await clearAsk(tabId);
        else {
          const photo = typeof m.photo === "string" && /^https:\/\//.test(m.photo) ? m.photo.slice(0, 2000) : null;
          await setAsk(tabId, { kind: "result", url, title: text(m.title, 300), name: text(m.name, 200), text: text(m.text, 1500), print: printOf(m.print), photo, at: Date.now() });
        }
        const ok = await openAsk(sender.tab!.windowId);
        if (!ok) await clearAsk(tabId);
        return { ok };
      })();
    case "desk:marks":
      return marksOn(url).then((marks) => marks.map(({ p, captureId }) => ({ p, captureId })));
    case "desk:page": {
      // ("Desteye ekle" on a hotel's or a tour's own page: the page as the toolbar's save reads it, its screenshot too)
      const snap = pageSnapshot(m.snapshot, url);
      if (!snap) return Promise.resolve({ ok: false });
      return bindFor(url, snap.title, pickOf(m)).then(async (bind) => {
        const shot = await shotOf(sender.tab!.windowId);
        const capture = await saveSnapshot(snap, shot, bind);
        process();
        return savedOn(sender.tab!.id!, capture.id, bind.forTripId ?? null);
      });
    }
    case "desk:undo":
      return undoSave(text(m.captureId, 80)).then((ok) => ({ ok }));
    case "desk:move":
      // ("Değiştir" on the note: that trip, or a new one for the page's country; the current trip from now on)
      return (async () => {
        const pick = pickOf(m);
        const d = await db();
        let tripId = pick.tripId && (await d.get("trips", pick.tripId.slice(0, 80))) ? pick.tripId.slice(0, 80) : null;
        if (!tripId && pick.newTrip) tripId = (await bindFor(url, "", { newTrip: true, remember: false })).forTripId ?? null;
        if (!tripId) return { ok: false, tripId: null };
        const ok = await moveSave(text(m.captureId, 80), tripId);
        await setCurrent(tripId, pageCountry(url, "", await loadHome().catch(() => null)));
        return { ok, tripId };
      })();
    case "desk:open":
      return openBoard(`#trip=${encodeURIComponent(text(m.tripId, 80))}`).then(() => ({ ok: true }));
    case "desk:pocket":
      // (Gezi cebi on the page's edge: the trip asked for, else the page's own, else the current one)
      return (async () => pocketFor(text(m.tripId, 80) || (await whereFor(url, "")).trip?.id || null))();
    case "desk:popup":
      // (the page's tab: the toolbar's window, opened over that tab's window)
      return chrome.action
        .openPopup({ windowId: sender.tab!.windowId })
        .then(() => ({ ok: true }))
        .catch(() => ({ ok: false }));
    case "desk:confirmed":
      // (a booking's confirmation on the page: a green ✓ on the icon for that tab, the popup's first card)
      return chrome.action
        .setBadgeBackgroundColor({ tabId: sender.tab!.id!, color: "#1f7a45" })
        .then(() => chrome.action.setBadgeText({ tabId: sender.tab!.id!, text: "✓" }))
        .then(() => ({ ok: true }), () => ({ ok: false }));
    default:
      return Promise.resolve(null);
  }
}
