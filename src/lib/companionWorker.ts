// Benle gezen eklenti, seviye 2: the service worker's side of "Sitede benle gel" (lib/companion.ts, src/companion.ts). It
// registers the content script for the sites the traveller allowed, and answers it: which planned flight this search is
// for and that deck's options (only that), and it saves what the traveller added there with "+" into that row. A
// message is answered only from our own content script on one of those sites (who asks is checked, never just trusted).
import { downscale, openBoard } from "./browser";
import { planFlightFor } from "./bring";
import { COMPANION_SITES, companionName, companionSiteOf, type CompanionAsk, type CompanionRoute, type DeckBrief } from "./companion";
import { db } from "./db";
import type { PageSnapshot } from "./pagecapture";
import { saveSnapshot } from "./process";
import type { Item } from "./types";
import { flightSearchOf } from "./url";
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
    case "desk:add":
      return routeFor(url).then(async (r) => {
        if (!r) return { ok: false };
        await saveSnapshot(snapshotOf(url, text(m.title, 300), text(m.text, 1500)), null, { forTripId: r.tripId, forNeed: r.forNeed });
        process();
        return { ok: true };
      });
    case "desk:shot":
      return routeFor(url).then(async (r) => {
        if (!r) return { ok: false };
        let shot: string | null = null;
        try {
          shot = await chrome.tabs.captureVisibleTab(sender.tab!.windowId, { format: "jpeg", quality: 80 });
          shot = await downscale(shot).catch(() => shot);
        } catch {
          shot = null; // (the text in view is still enough)
        }
        await saveSnapshot(snapshotOf(url, text(m.title, 300), text(m.text, 12_000)), shot, { forTripId: r.tripId, forNeed: r.forNeed });
        process();
        return { ok: true };
      });
    case "desk:open":
      return openBoard(`#trip=${encodeURIComponent(text(m.tripId, 80))}`).then(() => ({ ok: true }));
    default:
      return Promise.resolve(null);
  }
}
