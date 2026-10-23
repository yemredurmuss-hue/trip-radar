// Benle gezen eklenti, seviye 2: the service worker's side of "Sitede benle gel" (lib/companion.ts, src/companion.ts). It
// registers the content script for the sites the traveller allowed, and answers it: which planned flight this search is
// for and that deck's options (only that), and it saves what the traveller added there with "+" into that row. A
// message is answered only from our own content script on one of those sites (who asks is checked, never just trusted).
import { countryOfAirport } from "./airports";
import { downscale, openBoard } from "./browser";
import { planFlightFor } from "./bring";
import { COMPANION_SITES, companionName, companionSiteOf, siteKindOf, type CompanionAsk, type CompanionRoute, type CompanionWhere, type DeckBrief, type TripPick } from "./companion";
import { db, listTrips, newId } from "./db";
import { today } from "./extract";
import { formatDateRange } from "./items";
import type { PageSnapshot } from "./pagecapture";
import { titleCodes, tripPlaceCodes } from "./placeCheck";
import { saveSnapshot } from "./process";
import { countryName, isDemoTrip, profileTrips, uniqueTitle } from "./trips";
import { loadRules, rememberTrip, ruleFor } from "./tripRules";
import type { Item, Trip } from "./types";
import { flightSearchOf, parseUrl } from "./url";
import { seenCheaper } from "./priceWatchWorker";

const SCRIPT_ID = "trip-radar-companion";

/** The content script registered for the allowed sites only (none allowed: none registered). */
export async function syncCompanion(): Promise<void> {
  if (!chrome.scripting?.registerContentScripts || !chrome.permissions?.getAll) return;
  const granted = new Set((await chrome.permissions.getAll()).origins ?? []);
  const matches = COMPANION_SITES.filter((p) => granted.has(p));
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
 * search's arrival airport, else a place its address or title names ("Lisbon", "Bali"). Null when nothing says.
 */
export function pageCountry(url: string, title: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const own = u.pathname.match(/^\/hotel\/([a-z]{2})\//)?.[1];
  if (own && /booking\.com$/.test(u.hostname)) return own.toUpperCase();
  const search = flightSearchOf(url);
  if (search) return countryOfAirport(search.to) ?? null;
  const words = decodeURIComponent(`${u.pathname} ${u.searchParams.get("ss") ?? ""} ${u.searchParams.get("q") ?? ""} ${u.searchParams.get("text") ?? ""}`).replace(/[-_/+]+/g, " ");
  return [...titleCodes(`${words} ${title}`)][0] ?? null;
}

const pageKey = (u: string | null | undefined): string | null => {
  try {
    const x = new URL(u ?? "");
    return `${x.hostname.replace(/^www\./, "")}${x.pathname}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
};

/** Where a page would go (the route's trip, the country's remembered one), else the trips to ask among. */
export async function whereFor(url: string, title: string): Promise<CompanionWhere> {
  const d = await db();
  const [trips, items] = await Promise.all([listTrips(), d.getAll("items")]);
  const own = trips.filter((t) => !isDemoTrip(t));
  const code = pageCountry(url, title);
  const route = await routeFor(url);
  const day = flightSearchOf(url)?.day ?? parseUrl(url).checkIn ?? null;
  const rules = route || !code ? null : await loadRules();
  const trip: Trip | null = route ? (own.find((t) => t.id === route.tripId) ?? null) : rules && code ? ruleFor(rules, [code], own, items, day, parseUrl(url).checkOut ?? null, today()) : null;
  const profiles = profileTrips(own, items);
  const match = (t: Trip) => Boolean(code && (tripPlaceCodes(t.id, items).has(code) || titleCodes(t.title).has(code)));
  const whenOf = (t: Trip) => {
    const r = t.confirmedDates ?? profiles.find((p) => p.trip.id === t.id)?.range ?? null;
    return r ? formatDateRange(r.start, r.end) : null;
  };
  const listed = [...own].sort((a, b) => Number(match(b)) - Number(match(a)) || b.updatedAt - a.updatedAt).slice(0, 6);
  const key = pageKey(url);
  const kind = siteKindOf(companionSiteOf(url) ?? "");
  const category = kind === "stay" ? "stay" : kind === "activity" ? "activity" : "flight";
  return {
    trip: trip ? { id: trip.id, title: trip.title } : null,
    country: code ? countryName(code) : null,
    trips: listed.map((t) => ({ id: t.id, title: t.title, when: whenOf(t), match: match(t) })),
    saved: Boolean(key && items.some((i) => i.status !== "dismissed" && pageKey(i.url) === key)),
    names: trip ? items.filter((i) => i.tripId === trip.id && i.category === category && i.status !== "dismissed").map((i) => i.name).slice(0, 60) : [],
  };
}

/**
 * Which trip (and row) what is added on the site goes into: the route's (a search for a planned flight), else the trip
 * picked in the page's own question (remembered as the country's when said so), a new trip for the country, or the
 * remembered one. None of these (no trip at all yet): the capture goes as the toolbar's does, its trip made from it.
 */
export async function bindFor(url: string, title: string, pick: TripPick): Promise<{ forTripId?: string; forNeed?: string }> {
  const route = await routeFor(url);
  if (route) return { forTripId: route.tripId, forNeed: route.forNeed };
  const code = pageCountry(url, title);
  const d = await db();
  if (pick.newTrip) {
    const trips = await listTrips();
    const now = Date.now();
    const made: Trip = { id: newId(), title: uniqueTitle(countryName(code) ?? "Yeni gezi", null, trips), confirmedDates: null, budget: null, heroImage: null, createdAt: now, updatedAt: now };
    await d.put("trips", made);
    if (pick.remember !== false) await rememberTrip(code, made.id);
    return { forTripId: made.id };
  }
  const picked = typeof pick.tripId === "string" ? await d.get("trips", pick.tripId.slice(0, 80)) : undefined;
  if (picked && !isDemoTrip(picked)) {
    if (pick.remember) await rememberTrip(code, picked.id);
    return { forTripId: picked.id };
  }
  const where = await whereFor(url, title);
  return where.trip ? { forTripId: where.trip.id } : {};
}

const pickOf = (m: TripPick): TripPick => ({ tripId: typeof m.tripId === "string" ? m.tripId : undefined, newTrip: m.newTrip === true, remember: m.remember === true });

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

/**
 * One of the companion's questions answered (null: not the companion's). `process`: the capture queue's run, after a save.
 * Only our own content script on an allowed site is answered; the page's address is the sender's, never the message's.
 */
export function companionAnswer(message: CompanionAsk | { type?: unknown }, sender: chrome.runtime.MessageSender, process: () => void): Promise<unknown> | null {
  if (typeof message?.type !== "string" || !message.type.startsWith("desk:")) return null;
  const url = sender.url ?? sender.tab?.url ?? "";
  if (sender.id !== chrome.runtime.id || sender.tab?.id == null || !companionSiteOf(url)) return Promise.resolve(null);
  const m = message as CompanionAsk;
  const text = (s: unknown, max: number) => (typeof s === "string" ? s.slice(0, max) : "");
  switch (m.type) {
    case "desk:route":
      return routeFor(url).then((r) => (r ? { tripId: r.tripId, title: r.title, from: r.from, to: r.to, day: r.day, deck: r.deck, chosen: r.chosen ?? null } : null));
    case "desk:seen":
      // (fiyat izleme: the chosen flight's price on the site, read as the traveller sees it; said when it's less)
      return routeFor(url).then(async (r) => {
        if (!r?.chosenId || typeof m.price !== "number" || !(m.price > 0)) return { save: null };
        return { save: await seenCheaper(r.chosenId, m.price, typeof m.currency === "string" ? m.currency : null, companionName(companionSiteOf(url) ?? "")) };
      });
    case "desk:where":
      return whereFor(url, text(m.title, 300));
    case "desk:add":
      return bindFor(url, text(m.title, 300), pickOf(m)).then(async (bind) => {
        await saveSnapshot(snapshotOf(url, text(m.title, 300), text(m.text, 1500)), null, bind);
        process();
        return { ok: true, tripId: bind.forTripId ?? null };
      });
    case "desk:shot":
      return bindFor(url, text(m.title, 300), pickOf(m)).then(async (bind) => {
        const shot = await shotOf(sender.tab!.windowId);
        await saveSnapshot(snapshotOf(url, text(m.title, 300), text(m.text, 12_000)), shot, bind);
        process();
        return { ok: true, tripId: bind.forTripId ?? null };
      });
    case "desk:page": {
      // ("Desteye ekle" on a hotel's or a tour's own page: the page as the toolbar's save reads it, its screenshot too)
      const snap = pageSnapshot(m.snapshot, url);
      if (!snap) return Promise.resolve({ ok: false });
      return bindFor(url, snap.title, pickOf(m)).then(async (bind) => {
        const shot = await shotOf(sender.tab!.windowId);
        await saveSnapshot(snap, shot, bind);
        process();
        return { ok: true, tripId: bind.forTripId ?? null };
      });
    }
    case "desk:open":
      return openBoard(`#trip=${encodeURIComponent(text(m.tripId, 80))}`).then(() => ({ ok: true }));
    default:
      return Promise.resolve(null);
  }
}
