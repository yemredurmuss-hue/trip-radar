// Sitede "+" (lib/companion.ts), 0.47.26 sade hali (Emre 2026-10-29: "+ basınca desteye eklesin istiyorum sadece"; Skyscanner
// açıkken bilgisayar donuyordu). Runs only on the sites the traveller allowed. Three things, nothing else:
//  · a "+" beside each result (and beside a place's own name): one press saves it to the trip's deck, as the toolbar does;
//  · the gezi cebi's tab on the right edge: the trip's cover and how many are saved on it; a press opens the toolbar's window;
//  · a booking's confirmation page: "Kaydedeyim mi?", looked for a few times after the page opens, never read again and again.
// It never watches the page: a change only marks the results stale; they are looked for again on the page's first seconds,
// after a scroll and when the mouse moves (at most once a second). Gone (0.47.26): the route strip, the labels beside the
// results, the price seen on the site, the pocket's open panel. The first "+" for a country not yet answered asks which
// trip, here on the page (lib/tripRules.ts). Everything it draws is in its own closed shadow root, over the page, never
// inside the site's own elements; nothing is saved until a press; no link on the site is changed.
import {
  companionSiteOf,
  deckWord,
  isOfferText,
  isResultText,
  offerPageKind,
  originOf,
  siteKindOf,
  timedSite,
  type CompanionAsk,
  type CompanionRoute,
  type CompanionWhere,
  type SavedOnSite,
  type SiteKind,
  type TripPick,
} from "./lib/companion";
import type { Pocket } from "./lib/pocket";
import { confirmationOf, type Confirmation } from "./lib/confirm";
import { L, loadLang } from "./lib/i18n";
import { collectPage } from "./lib/pagecapture";
import { resultPrint, sameResult, type ResultPrint } from "./lib/resultMark";

declare global {
  interface Window {
    __tripRadarCompanion?: boolean;
  }
}

/** The extension still there: after an update the page's old script is cut off from it (Chrome's "context invalidated"). */
const alive = (): boolean => {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
};
let onStale: () => void = () => undefined;
const ask = <T,>(message: CompanionAsk): Promise<T | null> =>
  new Promise((done) => {
    if (!alive()) {
      onStale();
      return done(null);
    }
    try {
      chrome.runtime.sendMessage(message, (reply: T | null) => done(chrome.runtime.lastError ? null : (reply ?? null)));
    } catch {
      if (!alive()) onStale();
      done(null);
    }
  });

const CSS = `
:host { all: initial; }
[hidden] { display: none !important; }
button:focus-visible, .plus:focus-visible { outline: 3px solid #cfc7ff; outline-offset: 1px; }
.layer { position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483645; pointer-events: none; }
.pin { position: absolute; display: flex; align-items: center; gap: 6px; pointer-events: auto; }
.pin.out { flex-direction: column-reverse; align-items: flex-start; }
.pin.edge .plus .lbl { display: none; }
.pin.edge .plus, .pin.edge.hot .plus, .pin.edge .plus:hover { width: 30px; padding: 0; }
.plus { width: 30px; height: 30px; border-radius: 99px; border: 0; background: #5b45e0; color: #fff; font: 800 18px/1 system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 4px 12px -4px rgba(91,69,224,.7); }
.plus { width: auto; min-width: 30px; padding: 0 9px; display: inline-flex; align-items: center; justify-content: center; gap: 0; transition: padding 160ms ease, gap 160ms ease; }
.plus .lbl { display: inline-block; max-width: 0; overflow: hidden; white-space: nowrap; font: 800 13px/1 "Plus Jakarta Sans", system-ui, sans-serif; transition: max-width 160ms ease; }
.pin.hot .plus .lbl, .plus:hover .lbl, .plus:focus-visible .lbl { max-width: 60px; }
.pin.open .plus .lbl { max-width: 260px; }
.pin.open .plus { padding: 0 14px 0 11px; gap: 6px; height: 34px; }
.pin.hot .plus, .plus:hover, .plus:focus-visible { padding: 0 12px 0 10px; gap: 5px; }
.plus.done { background: #1f7a45; font-size: 14px; }
.plus.read { background: #fff; color: #5b45e0; box-shadow: inset 0 0 0 2px #5b45e0; font-size: 12px; }
.dock { position: fixed; z-index: 2147483646; right: 20px; bottom: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  font: 600 13px/1.4 "Plus Jakarta Sans", system-ui, sans-serif; color: #1c1a33; }
.pocket { position: fixed; z-index: 2147483646; right: 0; top: 38vh; display: flex; align-items: center; }
.grip { width: 12px; height: 34px; margin-right: 2px; border-radius: 6px; cursor: ns-resize; touch-action: none; opacity: .5; transition: opacity 160ms ease;
  background: radial-gradient(circle, #8e8aa6 1.2px, transparent 1.6px) 0 0 / 6px 6px; }
.pocket:hover .grip, .grip:focus-visible { opacity: 1; }
.grip:focus-visible { outline: 3px solid #cfc7ff; }
.tab { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 8px 7px 8px 9px; border: 0;
  border-radius: 14px 0 0 14px; background: #1c1a33; color: #fff; cursor: pointer; box-shadow: -6px 6px 22px -8px rgba(28,26,51,.55); font: 800 12px/1 "Plus Jakarta Sans", system-ui, sans-serif; }
.tab .th { width: 30px; height: 30px; border-radius: 8px; overflow: hidden; display: grid; place-items: center; background: #3b2f7a; color: #fff; font-size: 13px; }
.tab .th img { width: 100%; height: 100%; object-fit: cover; }
.tab .n { min-width: 20px; padding: 3px 5px; border-radius: 99px; background: #5b45e0; text-align: center; }
.tab .w { margin-top: -2px; font-size: 9.5px; font-weight: 700; color: #cfc8f5; }
.tab .n.bump { animation: bump 380ms cubic-bezier(.3,.7,.2,1.4); }
.tab .add { width: 22px; height: 22px; border-radius: 99px; background: #fff; color: #5b45e0; display: grid; place-items: center; font-size: 15px; }
@keyframes bump { 0% { transform: scale(1); } 40% { transform: scale(1.45); background: #1f7a45; } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .tab .n.bump { animation: none; } }
.ask { width: 340px; max-height: min(460px, calc(100vh - 120px)); overflow: auto; padding: 14px; border-radius: 14px; background: #fff;
  box-shadow: 0 0 0 1px #dcd8e8, 0 18px 40px rgba(28,26,51,.22); display: flex; flex-direction: column; gap: 8px; }
.ask b { font-size: 14.5px; font-weight: 800; }
.ask small { font-size: 11.5px; font-weight: 800; color: #5d5a78; }
.ask.conf { width: 320px; gap: 6px; box-shadow: 0 0 0 1.5px #bfe3c9, 0 18px 40px rgba(28,26,51,.22); }
.ask.conf > b { color: #1f7a45; }
.ask.conf small { font-weight: 700; }
.ask.conf .q { font-size: 13px; font-weight: 700; line-height: 1.4; color: #1c1a33; }
.ask.conf .row { display: flex; gap: 8px; margin-top: 4px; }
.ask.conf .row button { flex: 1; height: 40px; border: 0; border-radius: 12px; cursor: pointer; font: 800 13.5px/1 "Plus Jakarta Sans", system-ui, sans-serif; }
.ask.conf .row .yes { background: #1f7a45; color: #fff; }
.ask.conf .row .no { background: #f7f6fb; color: #5d5a78; align-self: auto; padding: 0; }
.ask button.no { align-self: flex-start; border: 0; background: none; color: #5d5a78; font: 700 12px/1 inherit; cursor: pointer; padding: 4px 0; }
.toast { display: flex; align-items: center; gap: 10px; max-width: 320px; padding: 10px 12px; border-radius: 12px; background: #1c1a33; color: #fff; font-size: 12.5px;
  box-shadow: 0 10px 24px rgba(0,0,0,.25); }
.toast i { font-style: normal; flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 99px; background: #1f7a45; font-size: 12px; font-weight: 800; }
.toast button { border: 0; background: none; color: #c9c2f5; font: 800 12px/1 inherit; cursor: pointer; padding: 0; white-space: nowrap; }
/* (under the pocket, along the window's edge: beside it, it fell on a result's "+") */
.note { position: absolute; right: 8px; top: calc(100% + 8px); display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 6px;
  border-radius: 14px; background: #1c1a33; color: #fff; white-space: nowrap; box-shadow: -6px 10px 26px -8px rgba(28,26,51,.6); font: 800 13px/1 "Plus Jakarta Sans", system-ui, sans-serif; }
.note .th { width: 30px; height: 30px; border-radius: 8px; overflow: hidden; display: grid; place-items: center; background: #3b2f7a; font-size: 12px; flex: none; }
.note .th img { width: 100%; height: 100%; object-fit: cover; }
.note .ok { width: 20px; height: 20px; border-radius: 99px; display: grid; place-items: center; background: #1f7a45; flex: none; }
.note .ok svg { width: 12px; height: 12px; }
.note .nm { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; padding: 6px 4px; border-radius: 8px; }
.note .nm:hover { background: rgba(255,255,255,.08); }
.note .nm svg { width: 12px; height: 12px; color: #c9c2f5; flex: none; }
.note .nm[disabled] { cursor: default; }
.note .say { padding: 0 6px; }
.note small { font: 700 12px/1 inherit; color: #c9c2f5; }
.note .ib { all: unset; cursor: pointer; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: #c9c2f5; flex: none; }
.note .ib:hover { background: rgba(255,255,255,.1); color: #fff; }
.note .ib svg { width: 17px; height: 17px; }
.note.in { animation: note-in 220ms cubic-bezier(.3,.7,.2,1); }
@keyframes note-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .note.in { animation: none; } }
.pick { position: fixed; z-index: 2147483647; width: 280px; max-height: min(420px, calc(100vh - 16px)); overflow: auto; padding: 8px; border-radius: 14px; background: #fff;
  box-shadow: 0 0 0 1px #dcd8e8, 0 18px 40px rgba(28,26,51,.24); display: flex; flex-direction: column; gap: 2px; font: 600 13px/1.4 "Plus Jakarta Sans", system-ui, sans-serif; color: #1c1a33; }
.pick .hd { display: flex; align-items: center; justify-content: space-between; padding: 2px 2px 6px 8px; }
.pick .hd b { font-size: 14px; font-weight: 800; }
.pick .ib { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #5d5a78; }
.pick .ib:hover { background: #f7f6fb; color: #1c1a33; }
.pick .ib svg { width: 16px; height: 16px; }
.pick .tr { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 8px; border-radius: 11px; }
.pick .tr:hover, .pick .tr:focus-visible { background: #f4f2ff; }
.pick .tr.best { box-shadow: inset 0 0 0 1.5px #d6cffd; }
.pick .tr .th { width: 36px; height: 36px; border-radius: 10px; overflow: hidden; flex: none; background: #efecff; display: grid; place-items: center; color: #4a36c9; font-weight: 800; font-size: 13px; }
.pick .tr .th img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pick .tr b { min-width: 0; font-size: 14px; font-weight: 750; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pick .tr .cnt { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 750; color: #5d5a78; font-variant-numeric: tabular-nums; }
.pick .tr .cnt svg { width: 13px; height: 13px; }
.pick .tr.new { color: #4a36c9; }
.pick .tr.new .th { background: #fff; box-shadow: inset 0 0 0 1.5px #d6cffd; font-size: 18px; }
.hop { position: fixed; z-index: 2147483647; display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 12px; background: #fff;
  box-shadow: 0 0 0 1.5px #c9bffa, 0 10px 26px rgba(28,26,51,.25); pointer-events: none; font: 800 12.5px/1.2 "Plus Jakarta Sans", system-ui, sans-serif; color: #1c1a33; }
.hop img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex: none; }
.hop b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

/** What the question asks about ("Bu konaklama hangi geziye?"). */
const whatOf = (kind: SiteKind): string =>
  kind === "stay" ? L("Bu konaklama", "This stay") : kind === "activity" ? L("Bu etkinlik", "This activity") : kind === "transport" ? L("Bu yolculuk", "This journey") : kind === "flight" ? L("Bu uçuş", "This flight") : L("Bu sayfa", "This page");

/** The page's JSON-LD blocks as written (a booking's confirmation says its number there). */
function ldBlocks(): unknown[] {
  const out: unknown[] = [];
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      out.push(JSON.parse(s.textContent ?? ""));
    } catch {
      // (broken JSON-LD: the words still say)
    }
  }
  return out.slice(0, 12);
}

/** The JSON-LD types a page says it is ("Hotel", "TouristTrip"). */
function ldTypes(): string[] {
  const out: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 4) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    const t = (v as Record<string, unknown>)["@type"];
    if (typeof t === "string") out.push(t);
    else if (Array.isArray(t)) out.push(...t.filter((x): x is string => typeof x === "string"));
    walk((v as Record<string, unknown>)["@graph"], depth + 1);
  };
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      walk(JSON.parse(s.textContent ?? ""), 0);
    } catch {
      // (a site's broken JSON-LD: its address still says)
    }
  }
  return out;
}

function start() {
  if (window.__tripRadarCompanion) return;
  window.__tripRadarCompanion = true;
  const site = companionSiteOf(location.href) ?? originOf(location.href) ?? "";
  const kind: SiteKind = siteKindOf(site);
  const timed = timedSite(site);
  // (an update left the old script's drawing on the page: the new one takes its place)
  document.getElementById("trip-radar-companion")?.remove();
  const host = document.createElement("div");
  host.id = "trip-radar-companion";
  const root = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const layer = document.createElement("div");
  layer.className = "layer";
  const dock = document.createElement("div");
  dock.className = "dock";
  const side = document.createElement("div");
  const pop = document.createElement("div");
  root.append(style, layer, side, dock, pop);
  document.documentElement.append(host);

  let route: CompanionRoute | null = null;
  let where: CompanionWhere | null = null;
  let href = "";
  let single: SiteKind | null = null;
  // Gezi cebi's tab: the trip and how many are saved on it; this page's "Desteye ekle".
  let pocket: Pocket | null = null;
  // Where the pocket sits on this site, as a share of the window's height (null: where it always was, 38%).
  let pocketAt: number | null = null;
  const POCKET_KEY = "pocketAt";
  const savePocketAt = () => {
    if (pocketAt == null || !alive()) return;
    void chrome.storage.local
      .get(POCKET_KEY)
      .then((got) => chrome.storage.local.set({ [POCKET_KEY]: { ...((got[POCKET_KEY] as Record<string, number> | undefined) ?? {}), [location.hostname]: Math.round(pocketAt! * 1000) / 1000 } }))
      .catch(() => undefined);
  };
  let pageState: "idle" | "busy" | "done" = "idle";
  let stale = false;
  // Rezervasyon onayı (0.45.0): the page is a booking's confirmation; asked once a page whether to save it to the trip.
  let confirmAsk: Confirmation | null = null;
  // A place's own page (0.45.1, Emre: "detay sayfasındayken artıya basmak kolayca basılır olsun"): the list's "+" beside its name.
  let titlePin: HTMLDivElement | null = null;
  let confirmTries = 0;
  // The note beside the pocket after a save (tek Kaydet v3: feedback in one place): saved, pressed again, or taken back.
  let note: { kind: "saved" | "again" | "undone"; title: string | null; photo: string | null; fresh: boolean } | null = null;
  // "Hangi geziye?" (tek Kaydet v3): opened beside what was pressed (the "+", the trip's name in the note), Pinterest's way.
  let asking: { what: string; then: (pick: TripPick) => void; at: Element | null; move?: string | null } | null = null;
  // (step: how far the label steps left of the site's own button on the card's top edge, found when the "+" is drawn)
  let cards: { el: Element; pin: HTMLDivElement; step: number }[] = [];
  const added = new WeakSet<Element>();
  const reading = new WeakSet<Element>();
  // ✓ hatırlanır (tek Kaydet v3): the results saved on this page before (reloaded, back from the Pano), by their prints.
  let marks: { p: ResultPrint; captureId: string }[] = [];
  // (textContent, not innerText: no layout asked for; the same reading at the save and at the check)
  const printOfCard = (el: Element) => resultPrint((el.textContent ?? "").slice(0, 3000), el.querySelector("h1,h2,h3,h4")?.textContent ?? "");
  const isSaved = (el: Element) => added.has(el) || (marks.length > 0 && marks.some((m) => sameResult(m.p, printOfCard(el))));
  onStale = () => {
    if (stale) return;
    stale = true;
    drawSide();
    drawDock();
  };

  /** The trip it goes to without asking: the route's, the remembered one; null with trips to ask among: asked first. */
  const knownTrip = (): { id: string; title: string } | null => (route ? { id: route.tripId, title: route.title } : (where?.trip ?? null));
  const mustAsk = () => !knownTrip() && Boolean(where?.trips?.length);

  /** Hangi gezi on the page: asked once (its answer kept as the country's trip when said so), then sent. */
  const withTrip = (what: string, send: (pick: TripPick) => Promise<boolean>, at: Element | null = null) => {
    // (the trip on the pocket's top is where it goes: said so, so the save and the pocket never disagree)
    if (!mustAsk()) return void send(!route && knownTrip() ? { tripId: knownTrip()!.id } : {});
    asking = {
      what,
      at,
      then: (pick) => {
        asking = null;
        drawDock();
        void send(pick).then((ok) => {
          const t = where?.trips.find((x) => x.id === pick.tripId);
          // (said so: the next "+" here goes there without asking)
          if (ok && where && pick.remember && t) where = { ...where, trip: { id: t.id, title: t.title } };
          if (ok && where && pick.remember && pick.newTrip) void ask<CompanionWhere>({ type: "desk:where", url: location.href, title: document.title }).then((w) => (where = w ?? where));
        });
      },
    };
    drawDock();
  };

  // The note after a save: where it went, how many are still being read, "Değiştir" and "Geri al" (0.43.0).
  let last: { captureId: string; tripId: string | null; el: Element | null } | null = null;
  let lastEl: Element | null = null;
  let toastTimer = 0;
  const said = (r: SavedOnSite) => {
    const title = r.tripTitle ?? where?.trips.find((t) => t.id === r.tripId)?.title ?? knownTrip()?.title ?? null;
    const photo = where?.trips.find((t) => t.id === r.tripId)?.photos?.[0] ?? (pocket?.trip?.id === r.tripId ? (pocket?.trip?.photo ?? null) : null);
    // (pressed again on one saved before: nothing new went in, said so)
    note = { kind: r.again ? "again" : "saved", title, photo, fresh: true };
    last = r.captureId ? { captureId: r.captureId, tripId: r.tripId, el: lastEl } : null;
    lastEl = null;
    // (the trip it went to is the one the next "+" goes to, without asking)
    if (where && r.tripId && title && !where.trip) where = { ...where, trip: { id: r.tripId, title } };
    drawDock();
    void loadPocket(true);
    noteFor(6000);
  };
  /** The note stays this long, longer while the mouse is on it. */
  const noteFor = (ms: number) => {
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      note = null;
      drawDock();
    }, ms);
  };

  /** "Hop": a small copy of what was added (its photo, its name) flies to the icon's corner; none when motion is off. */
  const fly = (from: DOMRect, photo: string | null, label: string) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chip = document.createElement("div");
    chip.className = "hop";
    if (photo) {
      const img = document.createElement("img");
      img.src = photo;
      img.alt = "";
      chip.append(img);
    }
    const b = document.createElement("b");
    b.textContent = label.slice(0, 40);
    chip.append(b);
    const w = Math.min(220, Math.max(120, from.width * 0.5));
    chip.style.left = `${from.left + from.width / 2 - w / 2}px`;
    chip.style.top = `${Math.max(0, from.top + from.height / 2 - 28)}px`;
    chip.style.width = `${w}px`;
    root.append(chip);
    // (into the pocket's tab on the edge when it shows, else the toolbar's corner)
    const to = side.querySelector(".tab")?.getBoundingClientRect();
    const dx = (to ? to.left + to.width / 2 : innerWidth - 36) - (from.left + from.width / 2);
    const dy = (to ? to.top + to.height / 2 : 4) - (from.top + from.height / 2);
    chip
      .animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 30}px) scale(.7)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${dy}px) scale(.12)`, opacity: 0.2 },
        ],
        { duration: 420, easing: "cubic-bezier(.3,.7,.2,1)" },
      )
      .finished.catch(() => undefined)
      .then(() => chip.remove());
  };
  const photoOf = (el: Element): string | null => {
    const img = el.querySelector("img");
    const src = img?.currentSrc || img?.src || "";
    return /^https:\/\//.test(src) ? src : null;
  };
  const nameOf = (el: Element): string => (el.querySelector("h1,h2,h3,h4,b,strong,a")?.textContent ?? (el as HTMLElement).innerText ?? "").replace(/\s+/g, " ").trim();

  // (no picking several and adding them all: a result goes in by its own "+", one at a time; Emre 2026-10-24: "toplu
  // listeye ekleme diye bir şey olamaz", "Bu listeden seç" gone with it)
  const addCard = async (el: Element, pick: TripPick): Promise<SavedOnSite | null> => {
    reading.add(el);
    drawCards();
    const print = printOfCard(el);
    const r = await ask<SavedOnSite>({ type: "desk:add", url: location.href, title: document.title, text: (el as HTMLElement).innerText.replace(/\s+/g, " ").trim().slice(0, 1500), print, ...pick });
    reading.delete(el);
    if (r?.ok) {
      added.add(el);
      lastEl = el;
      if (r.captureId && !marks.some((m) => m.captureId === r.captureId)) marks = [...marks, { p: print, captureId: r.captureId }];
      if (!r.again) fly(el.getBoundingClientRect(), photoOf(el), nameOf(el));
    }
    return r?.ok ? r : null;
  };

  /** One line family for the signs (never a typed character). */
  const ICONS: Record<string, string> = {
    check: '<path d="M5 12.5 10 17.5 19 7" stroke-width="2.8"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    down: '<path d="m6 9 6 6 6-6" stroke-width="2.6"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    board: '<rect x="3.5" y="3.5" width="7" height="9" rx="2" stroke-width="2"/><rect x="13.5" y="3.5" width="7" height="5" rx="2" stroke-width="2"/><rect x="13.5" y="11.5" width="7" height="9" rx="2" stroke-width="2"/><rect x="3.5" y="15.5" width="7" height="5" rx="2" stroke-width="2"/>',
  };
  const icon = (name: string): SVGSVGElement => {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    t.setAttribute("viewBox", "0 0 24 24");
    t.setAttribute("fill", "none");
    t.setAttribute("stroke", "currentColor");
    t.setAttribute("stroke-width", "2.2");
    t.setAttribute("stroke-linecap", "round");
    t.setAttribute("stroke-linejoin", "round");
    t.setAttribute("aria-hidden", "true");
    // (our own fixed drawing, never the page's words)
    t.innerHTML = ICONS[name] ?? "";
    return t;
  };
  const iconButton = (name: string, label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ib";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.append(icon(name));
    b.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    return b;
  };

  /** "Geri al" in the note: the save taken back, its "+" a "+" again. */
  const undoLast = () => {
    const done = last;
    if (!done) return;
    void ask({ type: "desk:undo", captureId: done.captureId }).then(() => {
      note = { kind: "undone", title: null, photo: null, fresh: false };
      if (done.el) added.delete(done.el);
      marks = marks.filter((m) => m.captureId !== done.captureId);
      last = null;
      if (single) pageState = "idle";
      drawCards();
      drawDock();
      void loadPocket();
      noteFor(2500);
    });
  };
  /** The trip's name in the note: the trips open beside it, a press moves the save there (the same record). */
  const moveLast = (at: Element) => {
    const done = last;
    if (!done || !where?.trips.some((t) => t.id !== done.tripId)) return;
    clearTimeout(toastTimer);
    asking = {
      what: L("Bunu", "This"),
      at,
      move: done.tripId,
      then: (pick) => {
        asking = null;
        void ask<{ ok: boolean; tripId: string | null }>({ type: "desk:move", captureId: done.captureId, ...pick }).then((r) => {
          lastEl = done.el;
          if (r?.ok && r.tripId) said({ ok: true, tripId: r.tripId, tripTitle: where?.trips.find((x) => x.id === r.tripId)?.title ?? null, captureId: done.captureId });
          else drawDock();
        });
      },
    };
    drawDock();
  };
  /** The note: the trip's cover, ✓ and its name (▾: move it), ↶; it slides out of the pocket. */
  const noteEl = (): HTMLDivElement | null => {
    if (!note) return null;
    const n = note;
    const box = document.createElement("div");
    box.className = `note${n.fresh ? " in" : ""}`;
    box.setAttribute("role", "status");
    n.fresh = false;
    box.onmouseenter = () => clearTimeout(toastTimer);
    box.onmouseleave = () => noteFor(2500);
    if (n.kind === "undone") {
      const say = document.createElement("span");
      say.className = "say";
      say.textContent = L("Geri alındı", "Taken back");
      box.append(say);
      return box;
    }
    box.append(thumb(n.photo, n.title ?? "✓"));
    const ok = document.createElement("span");
    ok.className = "ok";
    ok.append(icon("check"));
    box.append(ok);
    if (n.kind === "again") {
      const already = document.createElement("small");
      already.textContent = L("Zaten", "Already");
      box.append(already);
    }
    const name = document.createElement("button");
    name.type = "button";
    name.className = "nm";
    name.textContent = n.title ?? L("Kaydedildi", "Saved");
    const movable = Boolean(last && where?.trips.some((t) => t.id !== last!.tripId));
    if (movable) {
      name.append(icon("down"));
      name.title = L("Başka geziye taşı", "Move to another trip");
      name.onclick = () => moveLast(name);
    } else name.disabled = true;
    box.append(name);
    if (last && n.kind === "saved") box.append(iconButton("undo", L("Geri al", "Undo"), undoLast));
    return box;
  };

  /** "Hangi geziye?" beside what was pressed: the trips (cover, name, Pano's count), then a new one. A press decides. */
  const drawPop = () => {
    pop.replaceChildren();
    if (!asking || stale) return;
    const a = asking;
    const country = where?.country ?? null;
    const box = document.createElement("div");
    box.className = "pick";
    box.setAttribute("role", "dialog");
    const hd = document.createElement("div");
    hd.className = "hd";
    const h = document.createElement("b");
    h.textContent = a.move !== undefined ? L("Hangi geziye taşıyayım?", "Move it to which trip?") : L("Hangi geziye?", "Which trip?");
    box.setAttribute("aria-label", h.textContent);
    hd.append(h, iconButton("x", L("Vazgeç", "Cancel"), closePop));
    box.append(hd);
    // (picked here, the country's trip from now on: the next "+" on its pages goes there without asking; Ayarlar forgets)
    const pick = (p: TripPick) => a.then({ ...p, remember: Boolean(country) });
    const ids = [...(where?.picks ?? []), ...(where?.trips ?? []).map((t) => t.id)].filter((id, i, all) => all.indexOf(id) === i && id !== a.move);
    ids.forEach((id, i) => {
      const t = where?.trips.find((x) => x.id === id);
      if (!t) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `tr${i === 0 && t.match ? " best" : ""}`;
      const nm = document.createElement("b");
      nm.textContent = t.title;
      b.append(thumb(t.photos?.[0] ?? null, t.title), nm);
      if (typeof t.count === "number") {
        const c = document.createElement("span");
        c.className = "cnt";
        c.append(icon("board"), document.createTextNode(String(t.count)));
        b.append(c);
      }
      b.onclick = () => pick({ tripId: t.id });
      box.append(b);
    });
    if (a.move === undefined) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tr new";
      const th = document.createElement("span");
      th.className = "th";
      th.textContent = "+";
      const nm = document.createElement("b");
      nm.textContent = country ? L(`Yeni gezi: ${country}`, `New trip: ${country}`) : L("Yeni gezi", "New trip");
      b.append(th, nm);
      b.onclick = () => pick({ newTrip: true });
      box.append(b);
    }
    pop.append(box);
    placePop();
    box.querySelector<HTMLButtonElement>(".tr")?.focus({ preventScroll: true });
  };
  /** Beside its button: on its left when there's room (over the card, never on the button), else under it. */
  const placePop = () => {
    const box = pop.firstElementChild as HTMLElement | null;
    if (!box || !asking) return;
    const at = (asking.at?.isConnected ? asking.at : null) ?? side.querySelector(".tab");
    const w = box.offsetWidth, h = box.offsetHeight;
    const r = at?.getBoundingClientRect() ?? new DOMRect(innerWidth - 20, innerHeight - 20, 0, 0);
    let left = r.left - w - 12;
    let top = r.top + r.height / 2 - 28;
    if (left < 8) {
      left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8);
      top = r.bottom + 8;
      if (top + h > innerHeight - 8) top = r.top - h - 8;
    }
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(Math.min(Math.max(8, top), innerHeight - h - 8))}px`;
  };
  const closePop = () => {
    asking = null;
    drawDock();
    drawCards();
  };

  /** What sits over the page besides the "+"s: the note (by the pocket), a confirmation's question, the trip question. */
  const drawDock = () => {
    dock.replaceChildren();
    drawSide();
    drawPop();
    if (stale) {
      // (the extension was updated while this page was open: said, never broken in silence)
      const t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      const words = document.createElement("span");
      words.textContent = L("Trip Radar yenilendi; bu sayfayı yenileyince + geri gelir.", "Trip Radar was updated; reload this page to get the + back.");
      const again = document.createElement("button");
      again.type = "button";
      again.textContent = L("Sayfayı yenile", "Reload");
      again.onclick = () => location.reload();
      t.append(words, again);
      dock.append(t);
      return;
    }
    if (confirmAsk && !note && !asking) {
      const c = confirmAsk;
      const box = document.createElement("div");
      box.className = "ask conf";
      box.setAttribute("role", "dialog");
      const h = document.createElement("b");
      h.textContent = L("Bu bir rezervasyon onayı", "This is a booking confirmation");
      const line = document.createElement("small");
      line.textContent = [c.name, L(`Onay kodu ${c.code}`, `Confirmation ${c.code}`), c.paid].filter(Boolean).join(" · ");
      const q = document.createElement("span");
      const trip = knownTrip();
      q.className = "q";
      q.textContent = trip ? L(`${trip.title} · ${deckWord(single ?? kind)} destesine rezervasyon olarak kaydedeyim mi?`, `Save it to ${trip.title} · ${deckWord(single ?? kind)} as a booking?`) : L("Rezervasyon olarak kaydedeyim mi?", "Save it as a booking?");
      const row = document.createElement("div");
      row.className = "row";
      const yes = document.createElement("button");
      yes.type = "button";
      yes.className = "yes";
      yes.textContent = L("Kaydet", "Save");
      yes.onclick = () => {
        confirmAsk = null;
        drawDock();
        withTrip(
          L("Bu rezervasyon", "This booking"),
          async (pick) => {
            const ok = await ask<SavedOnSite>({ type: "desk:page", url: location.href, snapshot: collectPage(), ...pick });
            if (ok?.ok) said(ok);
            return Boolean(ok?.ok);
          },
          null,
        );
      };
      const no = document.createElement("button");
      no.type = "button";
      no.className = "no";
      no.textContent = L("Şimdi değil", "Not now");
      no.onclick = () => {
        confirmAsk = null;
        drawDock();
      };
      row.append(yes, no);
      box.append(h, line, q, row);
      dock.append(box);
      return;
    }
    // (no pocket on this page: the note where the pocket would be, at the bottom right)
    if (note && !side.querySelector(".tab")) {
      const n = noteEl();
      if (n) {
        n.style.position = "static";
        dock.append(n);
      }
    }
  };

  /** The gezi cebi's tab: the trip the page goes to (else the current one) and how many are saved on it. */
  const loadPocket = async (bump = false) => {
    const p = await ask<Pocket>({ type: "desk:pocket", tripId: knownTrip()?.id ?? null });
    if (!p) return;
    pocket = p;
    drawSide(bump);
  };

  /** "+ Konaklama destesine ekle" on a place's own page: the page as the toolbar reads it, its screenshot too. */
  const addPage = (at: Element | null = null) =>
    withTrip(whatOf(single ?? kind), async (pick) => {
      pageState = "busy";
      drawSide();
      drawTitlePin();
      const ok = await ask<SavedOnSite>({ type: "desk:page", url: location.href, snapshot: collectPage(), ...pick });
      pageState = ok?.ok ? "done" : "idle";
      drawSide();
      drawTitlePin();
      if (ok?.ok) {
        const h = document.querySelector("h1");
        fly((h ?? document.body).getBoundingClientRect(), photoOf(document.body), document.title);
        said(ok);
      }
      return Boolean(ok?.ok);
    }, at);
  const thumb = (photo: string | null | undefined, title: string) => {
    const th = document.createElement("span");
    th.className = "th";
    const initial = () => void (th.textContent = title.slice(0, 1).toLocaleUpperCase("tr"));
    if (photo) {
      const img = document.createElement("img");
      img.decoding = "async";
      img.loading = "lazy";
      img.src = photo;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => (img.remove(), initial());
      th.append(img);
    } else initial();
    return th;
  };
  /**
   * Gezi cebi on the right edge (0.47.26 sade, Emre 2026-10-29: "içinde bir şey göstermene gerek yok"): the trip's cover and
   * how many are saved on it, the number going up with each "+" (saves still being read count too, lib/pocket.ts); a press
   * opens the toolbar's own window (the same as the icon), else, where Chrome won't, the trip's board.
   */
  const drawSide = (bump = false) => {
    side.replaceChildren();
    const trip = pocket?.trip ?? null;
    if (stale || !trip) return;
    const wrap = document.createElement("div");
    wrap.className = "pocket";
    if (pocketAt != null) wrap.style.top = `${Math.round(pocketAt * innerHeight)}px`;
    // (tek Kaydet v3: the pocket moves up and down by its grip, where it covers nothing of this site; kept per site)
    const grip = document.createElement("span");
    grip.className = "grip";
    grip.tabIndex = 0;
    grip.setAttribute("role", "slider");
    grip.setAttribute("aria-orientation", "vertical");
    grip.setAttribute("aria-label", L("Cebi yukarı aşağı taşı", "Move the pocket up or down"));
    grip.title = grip.getAttribute("aria-label")!;
    const moveTo = (top: number) => {
      const y = Math.min(Math.max(48, top), innerHeight - wrap.offsetHeight - 24);
      wrap.style.top = `${Math.round(y)}px`;
      pocketAt = y / innerHeight;
      placePop();
    };
    grip.onpointerdown = (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const from = e.clientY - wrap.getBoundingClientRect().top;
      grip.onpointermove = (m) => moveTo(m.clientY - from);
      grip.onpointerup = grip.onpointercancel = () => {
        grip.onpointermove = grip.onpointerup = grip.onpointercancel = null;
        savePocketAt();
      };
    };
    grip.onkeydown = (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      moveTo(wrap.getBoundingClientRect().top + (e.key === "ArrowUp" ? -24 : 24));
      savePocketAt();
    };
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab";
    tab.title = trip.title;
    tab.setAttribute("aria-label", L(`Gezi cebi: ${trip.title}, ${trip.count} kayıt`, `Trip pocket: ${trip.title}, ${trip.count} saved`));
    tab.append(thumb(trip.photo, trip.title));
    const n = document.createElement("span");
    n.className = `n${bump ? " bump" : ""}`;
    n.textContent = String(trip.count);
    tab.append(n);
    tab.onclick = () =>
      void ask<{ ok: boolean }>({ type: "desk:popup" }).then((r) => {
        if (r?.ok || stale) return;
        void ask({ type: "desk:open", tripId: trip.id });
      });
    wrap.append(grip, tab);
    const said = noteEl();
    if (said) wrap.append(said);
    side.append(wrap);
  };

  /**
   * The results: the smallest elements whose text is one result's, at most forty. A flight's: two hours and a price; a
   * hotel's or a tour's: a price, a link and a photo in a box the size of a result. Found from the prices up (0.42.1): the
   * page's text read once, each price climbing to its card; never every element's whole text (that froze big pages).
   */
  const PRICE = /(?:€|£|₺|\$|฿|\b(?:TL|EUR|USD|GBP|TRY|THB)\b)\s?\d|\d\s?(?:€|£|₺|\$|฿|\b(?:TL|EUR|USD|GBP|TRY|THB)\b)/;
  const AD = /\b(?:Sponsorlu|Sponsored|Reklam|Promoted|Anzeige|Gesponsert|Publicidad)\b/i;
  const fits = (el: HTMLElement): boolean => {
    const loose = el.textContent ?? "";
    if (loose.length < 20 || loose.length > 900) return false;
    // (an ad or a sponsored result gets no "+")
    if (AD.test(loose)) return false;
    if (timed) {
      if (!/\d[:.][0-5]\d/.test(loose) || !isResultText(el.innerText ?? "")) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 260 && r.height >= 48 && r.height <= 420;
    }
    if (!el.querySelector("a[href]") || !el.querySelector("img") || !isOfferText(el.innerText ?? "")) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 200 && r.height >= 120 && r.height <= 760;
  };
  /** Drawn where an eye can see it: not a screen reader's 1 px text, not hidden. */
  const shownBox = (el: Element | null): boolean => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 3 && r.height > 3;
  };
  const findCards = (): Element[] => {
    const prices: Text[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const v = n.nodeValue ?? "";
        if (v.length > 80 || !/\d/.test(v)) return NodeFilter.FILTER_REJECT;
        // (a price, or a price split in two spans: "€" in one, "912" in the next; read before any box is measured, 0.47.26)
        let price = PRICE.test(v);
        if (!price) {
          const near = n.parentElement?.parentElement?.textContent ?? "";
          price = near.length < 60 && PRICE.test(near);
        }
        // (a price written for screen readers only, 1 px wide, isn't where the card shows it: Skyscanner puts "Total cost
        // 8,480 TL" in the times' half, and the "+" landed in the middle of the card, on the price; 0.47.3)
        return price && shownBox(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    for (let n = walker.nextNode(); n && prices.length < 400; n = walker.nextNode()) prices.push(n as Text);
    const found = new Set<Element>();
    const seen = new Set<Element>();
    for (const t of prices) {
      let el = t.parentElement;
      for (let up = 0; el && up < 14 && el !== document.body; up++, el = el.parentElement) {
        if (seen.has(el)) break;
        seen.add(el);
        if ((el.textContent?.length ?? 0) > 900) break;
        if (fits(el)) {
          found.add(el);
          break;
        }
      }
      if (found.size >= 40) break;
    }
    const list = [...found];
    // (the smallest: one that holds another is the list around them)
    return list.filter((el) => !list.some((o) => o !== el && el.contains(o)));
  };

  /**
   * Each "+" beside its card, in the page's own coordinates (0.44.1): it scrolls with the page as the site's own parts do,
   * never chasing it. Always on the card's right (never its left: a site's filters sit there): outside it when there's
   * room; with none (a flight list as wide as the page), half over its right edge at its middle, so it covers nothing of
   * the result, its words (a label) along the top edge left of the site's own button (Emre 2026-10-24: "uçuş kartında da
   * sağına al"; on the top edge it fell on the price).
   */
  const OUT = 52;
  /** The page's own name: its first visible h1 with words. */
  const titleEl = (): HTMLElement | null => Array.from(document.querySelectorAll<HTMLElement>("h1")).find((h) => (h.textContent ?? "").trim().length > 1 && h.getBoundingClientRect().width > 0) ?? null;
  /** The "+" beside a place's own name: the same as a result's, one press adds the page; ✓ once it's in the deck. */
  const drawTitlePin = () => {
    titlePin?.remove();
    titlePin = null;
    if (!single || stale || !titleEl()) return;
    const inDeck = pageState === "done" || (pageState === "idle" && Boolean(where?.saved));
    const pin = document.createElement("div");
    // (always open on a place's own page: "+ Konaklama destesine ekle", one big target)
    pin.className = "pin open";
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = `plus${inDeck ? " done" : pageState === "busy" ? " read" : ""}`;
    plus.textContent = inDeck ? "✓" : pageState === "busy" ? "···" : "+";
    if (!inDeck && pageState !== "busy") {
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = L("Kaydet", "Save");
      plus.append(lbl);
    }
    plus.title = inDeck ? L("Kaydedildi", "Saved") : L("Bu sayfayı kaydet", "Save this page");
    plus.setAttribute("aria-label", plus.title);
    plus.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (inDeck || pageState === "busy") return;
      addPage(plus);
    };
    pin.append(plus);
    layer.append(pin);
    titlePin = pin;
    place(true);
  };
  const placeTitle = (x0: number, y0: number) => {
    const h = titlePin && titleEl();
    if (!titlePin || !h) return;
    // (right after the name's last line, not the h1's whole width)
    const range = document.createRange();
    range.selectNodeContents(h);
    const lines = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    const last = lines[lines.length - 1] ?? h.getBoundingClientRect();
    titlePin.style.top = `${last.top + y0 + last.height / 2 - 15}px`;
    titlePin.style.left = `${Math.min(last.right + 12, innerWidth - 200) + x0}px`;
    titlePin.style.transform = "none";
  };
  /** `look`: after a look for the results (not on a scroll): whether a site's own button sits where the label goes. */
  const place = (look = false) => {
    const x0 = scrollX, y0 = scrollY;
    placeTitle(x0, y0);
    for (const c of cards) {
      const r = c.el.getBoundingClientRect();
      const shown = r.width > 0 && r.height > 0;
      c.pin.style.display = shown ? "flex" : "none";
      if (!shown) continue;
      const room = innerWidth - r.right - 18;
      const out = room >= OUT - 18;
      c.pin.classList.toggle("out", out);
      c.pin.classList.toggle("edge", !out);
      c.pin.style.transform = "none";
      if (out) {
        c.pin.style.setProperty("--room", `${room}px`);
        c.pin.style.top = `${r.top + y0 + 10}px`;
        c.pin.style.left = `${r.right + x0 + 10}px`;
      } else {
        const edge = Math.min(r.right, innerWidth - 16);
        // (the site's own button where the label meets the top edge (a heart, a share): the label steps left of it)
        if (look && r.top > 0 && r.top < innerHeight) {
          const under = document.elementsFromPoint(edge - 20, r.top + 6).find((x) => x !== host && !host.contains(x));
          c.step = under && c.el.contains(under) && under.closest("button, [role='button'], input, select") ? 44 : 0;
        }
        c.pin.style.setProperty("--h", `${r.height}px`);
        c.pin.style.setProperty("--step", `${c.step}px`);
        c.pin.style.top = `${r.top + y0 + r.height / 2 - 15}px`;
        c.pin.style.left = `${edge - 15 + x0}px`;
      }
    }
  };

  const drawCards = (force = true) => {
    // (a flight search only for a flight on the plan, or once trips are known; a hotel's own page has its "Desteye ekle")
    if (stale || single || (!route && !where)) {
      layer.replaceChildren();
      cards = [];
      titlePin = null;
      if (single) drawTitlePin();
      return;
    }
    const els = findCards();
    // (the same results as drawn: only placed again, nothing rebuilt)
    if (!force && els.length === cards.length && els.every((el, i) => cards[i]?.el === el)) return place(true);
    layer.replaceChildren();
    cards = [];
    for (const el of els) {
      const pin = document.createElement("div");
      pin.className = "pin";
      const plus = document.createElement("button");
      plus.type = "button";
      const isIn = isSaved(el), busy = reading.has(el);
      plus.className = `plus${isIn ? " done" : busy ? " read" : ""}`;
      plus.textContent = isIn ? "✓" : busy ? "···" : "+";
      // (Pinterest's: a small "+" on the card's top edge; over the card, it says "+ Kaydet")
      if (!isIn && !busy) {
        const lbl = document.createElement("span");
        lbl.className = "lbl";
        lbl.textContent = L("Kaydet", "Save");
        plus.append(lbl);
      }
      plus.title = isIn ? L("Kaydedildi", "Saved") : L("Bunu kaydet", "Save this one");
      plus.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isSaved(el) || reading.has(el)) return;
        withTrip(
          whatOf(kind),
          async (pick) => {
            const r = await addCard(el, pick);
            drawCards();
            if (r) said(r);
            return Boolean(r);
          },
          plus,
        );
      };
      pin.append(plus);
      layer.append(pin);
      cards.push({ el, pin, step: 0 });
    }
    place(true);
  };

  /**
   * A booking's confirmation (0.45.0; 0.47.26 sade): only on a page whose address, title or JSON-LD says it might be one
   * ("success", "confirmation", "onay", a Reservation), its words read at most three times in its first seconds; asked
   * once whether to save it to the trip.
   */
  const CONFIRM_HINT = /confirm|success|thank|receipt|reservation|itinerary|booking-?complete|bestaetigung|bestätigung|onay|tesekkur|teşekkür|rezervasyon/i;
  const mayConfirm = () => CONFIRM_HINT.test(`${location.pathname} ${location.search} ${document.title}`) || ldTypes().some((t) => /Reservation/.test(t));
  const checkConfirm = () => {
    if (stale || confirmAsk || confirmTries >= 3 || where?.saved || document.hidden) return;
    confirmTries++;
    if (!mayConfirm()) return;
    const c = confirmationOf({ text: (document.body?.innerText ?? "").slice(0, 60_000), jsonLd: ldBlocks(), title: document.title, url: location.href });
    if (!c) return;
    confirmTries = 3;
    confirmAsk = c;
    void ask({ type: "desk:confirmed" });
    drawDock();
  };

  /**
   * Looking for the results (0.47.26, Emre 2026-10-29: "Skyscanner açınca donuyor"). The page is never watched: its changes
   * only mark the results stale (a flag, nothing else); they are looked for again on the page's first seconds (a live
   * search's results arrive then), after a scroll, when the mouse moves (at most once a second) and when the tab comes
   * back. A page that keeps changing by itself (prices turning, ads) costs nothing while nobody touches it.
   */
  let dirty = true;
  let openedAt = Date.now();
  const look = () => {
    if (stale || document.hidden) return;
    // (a hotel's page often says what it is only once its scripts ran: asked in its first seconds only)
    if (!single && dirty && Date.now() - openedAt < 20_000 && (single = offerPageKind(location.href, ldTypes()))) drawCards();
    // (the name comes in late on some pages: its "+" then)
    if (single && !titlePin) drawTitlePin();
    if (!dirty) return;
    dirty = false;
    drawCards(false);
  };
  const SETTLE_MS = [700, 1800, 3500, 6000, 10_000, 16_000];
  let settle: number[] = [];
  const settleLooks = () => {
    settle.forEach(clearTimeout);
    settle = SETTLE_MS.map((ms) => window.setTimeout(look, ms));
    // (a confirmation page often writes its number once its scripts ran)
    for (const ms of [0, 2500, 7000]) settle.push(window.setTimeout(checkConfirm, ms));
  };

  const refresh = async () => {
    if (location.href === href) return;
    href = location.href;
    openedAt = Date.now();
    pageState = "idle";
    asking = null;
    confirmAsk = null;
    confirmTries = 0;
    single = offerPageKind(href, ldTypes());
    let saved: typeof marks | null;
    [route, where, saved] = await Promise.all([
      kind === "flight" ? ask<CompanionRoute>({ type: "desk:route", url: href }) : Promise.resolve(null),
      ask<CompanionWhere>({ type: "desk:where", url: href, title: document.title }),
      ask<typeof marks>({ type: "desk:marks" }),
    ]);
    marks = Array.isArray(saved) ? saved : [];
    dirty = false;
    drawCards();
    drawDock();
    void loadPocket();
    settleLooks();
  };

  new MutationObserver(() => void (dirty = true)).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => !document.hidden && look());
  let frame = 0;
  let quiet = 0;
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => place());
  };
  addEventListener(
    "scroll",
    (e) => {
      // (the "+"s are in the page's own coordinates: the page's scroll carries them; only a box scrolled inside the page
      // moves its results from under them)
      if (e.target !== document && e.target !== document.documentElement) follow();
      clearTimeout(quiet);
      quiet = window.setTimeout(look, 300);
    },
    { passive: true, capture: true },
  );
  let moved = 0;
  addEventListener(
    "mousemove",
    () => {
      const now = Date.now();
      if (now - moved < 1000) return;
      moved = now;
      look();
    },
    { passive: true },
  );
  // (the card under the mouse: its "+" opens into "+ Ekle")
  let hot: HTMLDivElement | null = null;
  addEventListener(
    "mouseover",
    (e) => {
      const t = e.target as Node | null;
      const c = t ? cards.find((x) => x.el.contains(t)) : undefined;
      const h = titlePin && t ? titleEl() : null;
      const pin = c?.pin ?? (h && (h.contains(t) || titlePin!.contains(t)) ? titlePin : null);
      if (pin === hot) return;
      hot?.classList.remove("hot");
      hot = pin;
      hot?.classList.add("hot");
    },
    { passive: true, capture: true },
  );
  addEventListener("resize", follow, { passive: true });
  // (the trip question stays beside its button as the page scrolls; Escape, or a press anywhere else, closes it)
  addEventListener("scroll", () => asking && placePop(), { passive: true, capture: true });
  addEventListener("keydown", (e: KeyboardEvent) => e.key === "Escape" && asking && closePop(), true);
  addEventListener("pointerdown", (e) => asking && !e.composedPath().includes(host) && closePop(), true);
  // (a search page changes its address without loading: the way or the day changed; nothing once cut off by an update)
  const tick = window.setInterval(() => (alive() ? void refresh() : clearInterval(tick)), 1500);
  void Promise.all([
    loadLang().catch(() => undefined),
    chrome.storage.local
      .get(POCKET_KEY)
      .then((got) => {
        const at = (got[POCKET_KEY] as Record<string, number> | undefined)?.[location.hostname];
        if (typeof at === "number" && at > 0 && at < 1) pocketAt = at;
      })
      .catch(() => undefined),
  ]).then(refresh);
}

if (document.body) start();
else addEventListener("DOMContentLoaded", start, { once: true });
