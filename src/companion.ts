// Benle gezen eklenti, seviye 2: "Sitede benle gel" (lib/companion.ts). Runs only on the sites the traveller allowed one by
// one. On a flight search for a flight on the plan a thin strip says which row it is for ("Bangkok ✈ İstanbul, 2 Nis
// planında · destende 7 seçenek"); each result in view gets a "+" (and where it stands against the deck); a hotel's or a
// tour's list gets the same "+". On the right edge the gezi cebi (0.44.0, lib/pocket.ts): the current trip, this page ("+ Konaklama
// destesine ekle" on a place's own page, "+ ile ekle" on a list), what was added last with how each stands, the
// trip's board. The first "+" for a country not yet answered asks which trip, here on the page (Hangi gezi,
// lib/tripRules.ts). Everything it draws is in its own closed shadow root, over the page, never inside the site's own
// elements; nothing is saved until a press; no link on the site is changed.
import {
  cardFacts,
  cardLabel,
  companionSiteOf,
  deckWord,
  inDeckByName,
  isOfferText,
  isResultText,
  offerPageKind,
  originOf,
  siteKindOf,
  timedSite,
  type CardFacts,
  type CompanionAsk,
  type CompanionRoute,
  type CompanionWhere,
  type SavedOnSite,
  type SiteKind,
  type TripPick,
} from "./lib/companion";
import type { Pocket, PocketRow } from "./lib/pocket";
import { confirmationOf, type Confirmation } from "./lib/confirm";
import { formatPrice } from "./lib/items";
import { L, loadLang } from "./lib/i18n";
import { collectPage } from "./lib/pagecapture";

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
.strip { position: fixed; z-index: 2147483646; top: 10px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
  max-width: calc(100vw - 32px); padding: 8px 8px 8px 14px; border-radius: 99px; background: #1c1a33; color: #fff;
  font: 600 13px/1.3 "Plus Jakarta Sans", system-ui, sans-serif; box-shadow: 0 10px 30px -12px rgba(28,26,51,.6); }
.strip b { font-weight: 800; white-space: nowrap; }
.strip small { color: #c9c2f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.strip button { font: 750 12.5px/1 inherit; border: 0; border-radius: 99px; padding: 8px 12px; cursor: pointer; background: #5b45e0; color: #fff; white-space: nowrap; }
.strip button.q { background: transparent; color: #c9c2f5; padding: 8px; }
button:focus-visible, .plus:focus-visible { outline: 3px solid #cfc7ff; outline-offset: 1px; }
.layer { position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483645; pointer-events: none; }
.pin { position: absolute; display: flex; align-items: center; gap: 6px; pointer-events: auto; }
.pin.out { flex-direction: column-reverse; align-items: flex-start; }
.pin.out .tag { max-width: var(--room, 120px); white-space: normal; border-radius: 10px; }
.pin.edge .tag { position: absolute; right: calc(15px + var(--step, 0px)); top: calc(4px - var(--h, 30px) / 2); white-space: nowrap; }
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
.tag { padding: 4px 9px; border-radius: 99px; background: #efecff; color: #4a36c9; font: 800 11.5px/1.2 "Plus Jakarta Sans", system-ui, sans-serif;
  box-shadow: inset 0 0 0 1px #dcd6fb; white-space: nowrap; }
.tag.in { background: #e7f5ec; color: #1f7a45; box-shadow: inset 0 0 0 1px #bfe3c9; }
.dock { position: fixed; z-index: 2147483646; right: 20px; bottom: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  font: 600 13px/1.4 "Plus Jakarta Sans", system-ui, sans-serif; color: #1c1a33; }
.tab { position: fixed; z-index: 2147483646; right: 0; top: 38vh; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 8px 7px 8px 9px; border: 0;
  border-radius: 14px 0 0 14px; background: #1c1a33; color: #fff; cursor: pointer; box-shadow: -6px 6px 22px -8px rgba(28,26,51,.55); font: 800 12px/1 "Plus Jakarta Sans", system-ui, sans-serif; }
.tab .th { width: 30px; height: 30px; border-radius: 8px; overflow: hidden; display: grid; place-items: center; background: #3b2f7a; color: #fff; font-size: 13px; }
.tab .th img { width: 100%; height: 100%; object-fit: cover; }
.tab .n { min-width: 20px; padding: 3px 5px; border-radius: 99px; background: #5b45e0; text-align: center; }
.tab .w { margin-top: -2px; font-size: 9.5px; font-weight: 700; color: #cfc8f5; }
.tab .n.bump { animation: bump 380ms cubic-bezier(.3,.7,.2,1.4); }
.tab .add { width: 22px; height: 22px; border-radius: 99px; background: #fff; color: #5b45e0; display: grid; place-items: center; font-size: 15px; }
@keyframes bump { 0% { transform: scale(1); } 40% { transform: scale(1.45); background: #1f7a45; } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .tab .n.bump { animation: none; } }
.cep { position: fixed; z-index: 2147483646; right: 0; top: 64px; width: 280px; max-height: calc(100vh - 96px); overflow: auto; border-radius: 14px 0 0 14px; background: #fff;
  box-shadow: -8px 0 28px rgba(28,26,51,.22), 0 0 0 1px #dcd8e8; display: flex; flex-direction: column; font: 600 12.5px/1.4 "Plus Jakarta Sans", system-ui, sans-serif; color: #1c1a33; }
.cep .hd { display: flex; align-items: center; gap: 4px; padding: 8px 6px 8px 12px; background: linear-gradient(90deg,#1c1a33,#3b2f7a); color: #fff; }
.cep .hd .tp { all: unset; flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; cursor: pointer; border-radius: 8px; }
.cep .hd .cl { border: 0; background: none; color: #cfc8f5; font: 700 18px/1 system-ui, sans-serif; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
.cep .hd .cl:hover { background: rgba(255,255,255,.12); }
.cep .hd .th { width: 32px; height: 32px; border-radius: 8px; overflow: hidden; flex: none; display: grid; place-items: center; background: rgba(255,255,255,.14); font-weight: 800; }
.cep .hd .th img { width: 100%; height: 100%; object-fit: cover; }
.cep .hd span.t { min-width: 0; display: grid; }
.cep .hd b { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cep .hd small { font-size: 11px; color: #cfc8f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cep .hd em { margin-left: auto; font-style: normal; color: #cfc8f5; }
.cep .bd { padding: 12px; display: flex; flex-direction: column; gap: 9px; }
.cep .go.ghost { background: #fff; color: #4a36c9; box-shadow: inset 0 0 0 1.5px #c9bffa; }
.cep .r > b { flex: 1; min-width: 0; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cep .r .x { opacity: 0; transition: opacity 120ms; }
.cep .r:hover .x, .cep .r .x:focus-visible { opacity: 1; }
@media (hover: none) { .cep .r .x { opacity: 1; } }
.cep .k { font-size: 10.5px; font-weight: 800; color: #8e8aa6; }
.cep .pg { font-size: 13px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.cep .go { font: 800 13px/1.2 "Plus Jakarta Sans", system-ui, sans-serif; border: 0; border-radius: 10px; padding: 10px; background: #5b45e0; color: #fff; cursor: pointer; }
.cep .go.done { background: #e7f5ec; color: #1f7a45; cursor: default; }
.cep .go:disabled { cursor: default; }
.cep .note { font-size: 11.5px; color: #5d5a78; line-height: 1.45; }
.cep .lnk { align-self: flex-start; border: 0; background: none; padding: 0; color: #4a36c9; font: 800 12px/1.2 "Plus Jakarta Sans", system-ui, sans-serif; cursor: pointer; }
.cep .r { display: flex; align-items: center; gap: 7px; min-width: 0; }
.cep .r .th { width: 28px; height: 28px; border-radius: 7px; overflow: hidden; flex: none; display: grid; place-items: center; background: #efecff; color: #4a36c9; font-weight: 800; font-size: 12px; }
.cep .r .th img { width: 100%; height: 100%; object-fit: cover; }
.cep .r span.t { flex: 1; min-width: 0; display: grid; }
.cep .r b { font-weight: 750; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cep .r .lnk { align-self: center; font-size: 11px; }
.cep .r small { font-size: 10.5px; color: #5d5a78; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cep .st { flex: none; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 99px; background: #e7f5ec; color: #1f7a45; }
.cep .st.reading { background: #efecff; color: #4a36c9; }
.cep .st.failed { background: #fde8e4; color: #b23a1d; }
.cep .x { flex: none; border: 0; background: none; color: #8e8aa6; font: 800 15px/1 system-ui, sans-serif; cursor: pointer; padding: 2px 4px; border-radius: 6px; }
.cep .x:hover { color: #b23a1d; background: #f4f2ff; }
.cep .hint { padding: 2px 2px 0; color: #4a36c9; font-size: 12.5px; font-weight: 700; line-height: 1.4; }
.cep .warn { padding: 8px 10px; border-radius: 10px; background: #fff7e8; color: #8a5a00; font-size: 11.5px; font-weight: 700; }
.cep .ft { display: flex; justify-content: space-between; gap: 8px; padding: 9px 12px; border-top: 1px solid #efedf5; }
.cep .ft button { border: 0; background: none; padding: 0; cursor: pointer; font: 800 12px/1.2 "Plus Jakarta Sans", system-ui, sans-serif; color: #4a36c9; }
.cep .ft button.q { color: #8e8aa6; font-weight: 700; }
.ask { width: 340px; max-height: min(460px, calc(100vh - 120px)); overflow: auto; padding: 14px; border-radius: 14px; background: #fff;
  box-shadow: 0 0 0 1px #dcd8e8, 0 18px 40px rgba(28,26,51,.22); display: flex; flex-direction: column; gap: 8px; }
.ask b { font-size: 14.5px; font-weight: 800; }
.ask small { font-size: 11.5px; font-weight: 800; color: #5d5a78; }
.ask button.t { font: 700 13px/1.3 "Plus Jakarta Sans", system-ui, sans-serif; text-align: left; border: 0; border-radius: 10px; padding: 9px 11px; cursor: pointer;
  background: #fff; color: #1c1a33; box-shadow: inset 0 0 0 1px #e3e0ec; display: flex; flex-direction: column; gap: 1px; }
.ask button.t span { font-weight: 600; font-size: 11.5px; color: #5d5a78; }
.ask button.t.best { box-shadow: inset 0 0 0 2px #5b45e0; background: #f7f5ff; }
.ask button.t:hover { background: #f4f2ff; }
.ask label { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: 10px; background: #f7f5ff; font-size: 12px; cursor: pointer; }
.ask label input { margin: 1px 0 0; accent-color: #5b45e0; }
.qp { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.qp button { all: unset; cursor: pointer; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.qp .cv { position: relative; height: 70px; border-radius: 12px; overflow: hidden; display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; background: #efecff; }
.qp .cv img { width: 100%; height: 100%; object-fit: cover; display: block; }
.qp .cv img:first-child { grid-row: 1 / 3; }
.qp .cv img:only-child { grid-column: 1 / 3; }
.qp .cv img:nth-child(2):last-child { grid-row: 1 / 3; }
.qp .cv .ini { grid-row: 1 / 3; grid-column: 1 / 3; display: grid; place-items: center; font: 800 20px/1 "Plus Jakarta Sans", system-ui, sans-serif; color: #4a36c9; }
.qp button.best .cv { box-shadow: 0 0 0 3px #5b45e0; }
.qp b { font-size: 12.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qp span.w { font-size: 11px; color: #5d5a78; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qp button:hover .cv { filter: brightness(.95); }
.ln { all: unset; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 5px 6px; border-radius: 10px; }
.ln:hover { background: #f4f2ff; }
.ln .th { width: 34px; height: 34px; border-radius: 9px; overflow: hidden; flex: none; background: #efecff; display: grid; place-items: center; color: #4a36c9; font-weight: 800; font-size: 13px; }
.ln .th img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ln b { display: block; font-size: 13px; font-weight: 750; }
.ln span.w { display: block; font-size: 11px; color: #5d5a78; font-weight: 600; }
.ln.new { box-shadow: inset 0 0 0 1.5px #d6d2e4; }
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
.toast.sel { gap: 12px; }
.toast.sel .go { padding: 8px 12px; border-radius: 99px; background: #5b45e0; color: #fff; }
.toast.sel .go:disabled { opacity: .5; cursor: default; }
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
  const strip = document.createElement("div");
  strip.className = "strip";
  strip.hidden = true;
  const layer = document.createElement("div");
  layer.className = "layer";
  const dock = document.createElement("div");
  dock.className = "dock";
  const side = document.createElement("div");
  root.append(style, strip, layer, side, dock);
  document.documentElement.append(host);

  let route: CompanionRoute | null = null;
  let where: CompanionWhere | null = null;
  let href = "";
  let closed = false;
  let single: SiteKind | null = null;
  // Gezi cebi: hidden on this site (its ×), open or not, what it shows; this page's "Desteye ekle".
  let sideHidden = false;
  let sideOpen = false;
  let pocket: Pocket | null = null;
  let pageState: "idle" | "busy" | "done" = "idle";
  let stale = false;
  // Rezervasyon onayı (0.45.0): the page is a booking's confirmation; asked once a page whether to save it to the trip.
  let confirmAsk: Confirmation | null = null;
  // A place's own page (0.45.1, Emre: "detay sayfasındayken artıya basmak kolayca basılır olsun"): the list's "+" beside its name.
  let titlePin: HTMLDivElement | null = null;
  let confirmTries = 0;
  let toast: string | null = null;
  let asking: { what: string; then: (pick: TripPick) => void } | null = null;
  let cards: { el: Element; facts: CardFacts; pin: HTMLDivElement }[] = [];
  const added = new WeakSet<Element>();
  const reading = new WeakSet<Element>();
  // (fiyat izleme: the chosen flight's price here, asked once a page; its answer, what it saves)
  let seen: { href: string; save: number | null } | null = null;
  const HIDE = `pillHidden:${location.hostname}`;
  onStale = () => {
    if (stale) return;
    stale = true;
    sideOpen = false;
    drawSide();
    drawDock();
  };

  /** The trip it goes to without asking: the route's, the remembered one; null with trips to ask among: asked first. */
  const knownTrip = (): { id: string; title: string } | null => (route ? { id: route.tripId, title: route.title } : (where?.trip ?? null));
  const mustAsk = () => !knownTrip() && Boolean(where?.trips?.length);

  /** Hangi gezi on the page: asked once (its answer kept as the country's trip when said so), then sent. */
  const withTrip = (what: string, send: (pick: TripPick) => Promise<boolean>) => {
    // (the trip on the pocket's top is where it goes: said so, so the save and the pocket never disagree)
    if (!mustAsk()) return void send(!route && knownTrip() ? { tripId: knownTrip()!.id } : {});
    sideOpen = false;
    drawSide();
    asking = {
      what,
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
  const said = (r: SavedOnSite, n = 1) => {
    const title = r.tripTitle ?? where?.trips.find((t) => t.id === r.tripId)?.title ?? knownTrip()?.title ?? null;
    const what = n > 1 ? L(`${n} sonuç`, `${n} results`) : "";
    toast = [
      title ? L(`${what ? `${what} · ` : ""}${title} · ${deckWord(kind)} destesine girdi`, `${what ? `${what} · ` : ""}in ${title} · ${deckWord(kind)}`) : L("Desteye girdi", "In the deck"),
      r.reading && r.reading > 1 ? L(`${r.reading} okunuyor`, `${r.reading} being read`) : L("okunuyor", "being read"),
    ].join(" · ");
    last = r.captureId ? { captureId: r.captureId, tripId: r.tripId, el: lastEl } : null;
    lastEl = null;
    // (the trip it went to is the one the next "+" goes to, without asking)
    if (where && r.tripId && title && !where.trip) where = { ...where, trip: { id: r.tripId, title } };
    drawDock();
    void loadPocket(true);
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast = null;
      drawDock();
    }, 6500);
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
    const r = await ask<SavedOnSite>({ type: "desk:add", url: location.href, title: document.title, text: (el as HTMLElement).innerText.replace(/\s+/g, " ").trim().slice(0, 1500), ...pick });
    reading.delete(el);
    if (r?.ok) {
      added.add(el);
      lastEl = el;
      fly(el.getBoundingClientRect(), photoOf(el), nameOf(el));
    }
    return r?.ok ? r : null;
  };

  const drawDock = () => {
    dock.replaceChildren();
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
    if (closed) return;
    if (asking) {
      const box = document.createElement("div");
      box.className = "ask";
      box.setAttribute("role", "dialog");
      const h = document.createElement("b");
      h.textContent = L(`${asking.what} hangi geziye?`, `${asking.what}: which trip?`);
      box.append(h);
      const country = where?.country ?? null;
      const remember = document.createElement("input");
      remember.type = "checkbox";
      remember.checked = true;
      const pick = (p: TripPick) => asking?.then({ ...p, remember: Boolean(country) && remember.checked });
      const cover = (t: CompanionWhere["trips"][number], big: boolean) => {
        const frame = document.createElement("span");
        frame.className = big ? "cv" : "th";
        // (no photo, or the site's own rules refuse ours: the trip's first letter)
        const initial = () => {
          if (frame.querySelector("img")) return;
          const ini = document.createElement("span");
          if (big) ini.className = "ini";
          ini.textContent = t.title.slice(0, 1).toLocaleUpperCase("tr");
          frame.replaceChildren(ini);
        };
        const photos = (t.photos ?? []).slice(0, big ? 3 : 1);
        for (const src of photos) {
          const img = document.createElement("img");
          // (decoded off the page's own work; a row scrolled to only when it's in view)
          img.decoding = "async";
          img.loading = "lazy";
          img.src = src;
          img.alt = "";
          img.referrerPolicy = "no-referrer";
          img.onerror = () => (img.remove(), initial());
          frame.append(img);
        }
        if (!photos.length) initial();
        return frame;
      };
      const words = (t: CompanionWhere["trips"][number]) => {
        const w = document.createElement("span");
        w.className = "w";
        w.textContent = [t.when, t.match && country ? country : null].filter(Boolean).join(" · ") || L("tarihsiz", "no dates");
        return w;
      };
      // Önerilen (Pinterest's Quick Picks): the three most likely, with their covers; the first picked by one press.
      const picks = (where?.picks ?? []).map((id) => where!.trips.find((t) => t.id === id)).filter((t): t is CompanionWhere["trips"][number] => Boolean(t));
      if (picks.length) {
        const g = document.createElement("small");
        g.textContent = L("Önerilen", "Suggested");
        const row = document.createElement("div");
        row.className = "qp";
        picks.forEach((t, n) => {
          const b = document.createElement("button");
          b.type = "button";
          if (n === 0) b.className = "best";
          const name = document.createElement("b");
          name.textContent = t.title;
          b.append(cover(t, true), name, words(t));
          b.onclick = () => pick({ tripId: t.id });
          row.append(b);
        });
        box.append(g, row);
      }
      const rest = (where?.trips ?? []).filter((t) => !picks.includes(t));
      if (rest.length) {
        const g = document.createElement("small");
        g.textContent = L("Tüm geziler", "All trips");
        box.append(g);
        for (const t of rest) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "ln";
          const text = document.createElement("span");
          const name = document.createElement("b");
          name.textContent = t.title;
          text.append(name, words(t));
          b.append(cover(t, false), text);
          b.onclick = () => pick({ tripId: t.id });
          box.append(b);
        }
      }
      if (country) {
        const fresh = document.createElement("button");
        fresh.type = "button";
        fresh.className = "ln new";
        const plusTh = document.createElement("span");
        plusTh.className = "th";
        plusTh.textContent = "+";
        const text = document.createElement("span");
        const name = document.createElement("b");
        name.textContent = L(`Yeni gezi: ${country}`, `New trip: ${country}`);
        text.append(name);
        fresh.append(plusTh, text);
        fresh.onclick = () => pick({ newTrip: true });
        const label = document.createElement("label");
        label.append(remember, document.createTextNode(L(`${country} için bundan sonra sormadan buraya`, `${country} goes there from now on`)));
        box.append(fresh, label);
      }
      const no = document.createElement("button");
      no.type = "button";
      no.className = "no";
      no.textContent = L("Vazgeç", "Cancel");
      no.onclick = () => {
        asking = null;
        drawDock();
        drawCards();
      };
      box.append(no);
      dock.append(box);
      return;
    }
    if (confirmAsk && !toast) {
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
        withTrip(L("Bu rezervasyon", "This booking"), async (pick) => {
          const ok = await ask<SavedOnSite>({ type: "desk:page", url: location.href, snapshot: collectPage(), ...pick });
          if (ok?.ok) said(ok);
          return Boolean(ok?.ok);
        });
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
    if (toast) {
      const t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      const i = document.createElement("i");
      i.textContent = "✓";
      const words = document.createElement("span");
      words.textContent = toast;
      t.append(i, words);
      const done = last;
      if (done) {
        const change = document.createElement("button");
        change.type = "button";
        change.textContent = L("Değiştir", "Change");
        change.onclick = () => {
          if (!where?.trips.length) return;
          asking = {
            what: L("Bunu", "This"),
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
        const undo = document.createElement("button");
        undo.type = "button";
        undo.textContent = L("Geri al", "Undo");
        undo.onclick = () =>
          void ask({ type: "desk:undo", captureId: done.captureId }).then(() => {
            toast = L("Geri alındı", "Taken back");
            if (done.el) added.delete(done.el);
            last = null;
            if (single) pageState = "idle";
            drawCards();
            drawDock();
            void loadPocket();
          });
        t.append(change, undo);
      }
      dock.append(t);
    }
  };

  /** What the pocket shows: the trip the page goes to (else the current one) and what was added to it last. */
  const loadPocket = async (bump = false) => {
    const p = await ask<Pocket>({ type: "desk:pocket", tripId: knownTrip()?.id ?? null });
    if (!p) return;
    pocket = p;
    drawSide(bump);
  };

  /** "+ Konaklama destesine ekle" on a place's own page: the page as the toolbar reads it, its screenshot too. */
  const addPage = () =>
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
    });
  /** "Ekrandakini ekle": what is in view, with its screenshot (a list whose results aren't found, any other page). */
  const addView = () =>
    withTrip(L("Ekrandakiler", "What's on screen"), async (pick) => {
      const r = await ask<SavedOnSite>({ type: "desk:shot", url: location.href, title: document.title, text: collectPage().viewportText.slice(0, 12_000), ...pick });
      if (r?.ok) said(r);
      return Boolean(r?.ok);
    });

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
  const twoLines = (title: string, sub: string) => {
    const t = document.createElement("span");
    t.className = "t";
    const b = document.createElement("b");
    b.textContent = title;
    const small = document.createElement("small");
    small.textContent = sub;
    t.append(b, small);
    return t;
  };
  const button = (cls: string, text: string, onclick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = text;
    b.onclick = onclick;
    return b;
  };
  const DECK_OF: Partial<Record<SiteKind, { cat: "stay" | "flight" | "activity" | "transport"; word: () => string }>> = {
    stay: { cat: "stay", word: () => L("otel", "stays") },
    flight: { cat: "flight", word: () => L("uçuş", "flights") },
    activity: { cat: "activity", word: () => L("tur", "tours") },
    transport: { cat: "transport", word: () => L("yol", "rides") },
  };
  const STATE_WORD: Record<PocketRow["state"], () => string> = {
    in: () => L("destede", "in the deck"),
    reading: () => L("okunuyor", "being read"),
    failed: () => L("okunamadı", "couldn't read"),
  };

  /** "Bundan sonrakiler hangi geziye?": the trip on the pocket's top changed; what comes next goes there. */
  const changeTrip = () => {
    if (!where?.trips.length) return;
    asking = {
      what: L("Bundan sonrakiler", "What comes next"),
      then: (pick) => {
        asking = null;
        drawDock();
        void ask<{ ok: boolean; tripId: string | null; title: string | null }>({ type: "desk:current", ...pick }).then((r) => {
          if (r?.ok && r.tripId && where) where = { ...where, trip: { id: r.tripId, title: r.title ?? "" } };
          void loadPocket();
        });
      },
    };
    sideOpen = false;
    drawSide();
    drawDock();
  };

  /**
   * Gezi cebi on the right edge: closed, a small tab (the trip's cover, how many on it, a "+" on a place's own page);
   * open, the trip, this page, what was added last, the board. One surface for all four jobs.
   */
  const drawSide = (bump = false) => {
    side.replaceChildren();
    if (stale || closed || sideHidden) return;
    const trip = pocket?.trip ?? null;
    const listy = !single && !route && cards.length > 0;
    if (!trip && !single && !listy) return;
    const inDeck = pageState === "done" || (pageState === "idle" && Boolean(where?.saved));
    // (the number on the tab: this site's deck on the trip, the hotels on a hotel site; the whole trip elsewhere)
    const deck = trip && DECK_OF[kind] ? { n: trip.decks?.[DECK_OF[kind]!.cat] ?? 0, word: DECK_OF[kind]!.word() } : null;
    if (!sideOpen) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "tab";
      tab.setAttribute("aria-label", trip ? (deck ? L(`Gezi cebi: ${trip.title}, ${deckWord(kind)} destesinde ${deck.n}`, `Trip pocket: ${trip.title}, ${deck.n} in ${deckWord(kind)}`) : L(`Gezi cebi: ${trip.title}, ${trip.count} kayıt`, `Trip pocket: ${trip.title}, ${trip.count} saved`)) : L("Gezi cebi", "Trip pocket"));
      tab.append(thumb(trip?.photo, trip?.title ?? "+"));
      if (trip) {
        const n = document.createElement("span");
        n.className = `n${bump ? " bump" : ""}`;
        n.textContent = String(deck ? deck.n : trip.count);
        tab.append(n);
        if (deck) {
          const w = document.createElement("span");
          w.className = "w";
          w.textContent = deck.word;
          tab.append(w);
        }
      }
      if (single && !inDeck) {
        const add = document.createElement("span");
        add.className = "add";
        add.textContent = "+";
        tab.append(add);
      }
      // (0.45.0, tek bakış: the tab opens the toolbar's own window, the same one card; where Chrome won't, the pocket here)
      tab.onclick = () =>
        void ask<{ ok: boolean }>({ type: "desk:popup" }).then((r) => {
          if (r?.ok || stale) return;
          sideOpen = true;
          drawSide();
          void loadPocket();
        });
      side.append(tab);
      return;
    }
    const box = document.createElement("div");
    box.className = "cep";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", L("Gezi cebi", "Trip pocket"));
    const hd = document.createElement("div");
    hd.className = "hd";
    const tp = document.createElement("button");
    tp.type = "button";
    tp.className = "tp";
    // (0.44.2, Emre: "çok karışık, çok daha sade"): the trip and one number; one button; the last three by name; the board.
    const many = deck ? `${deck.n} ${deck.word}` : trip ? L(`${trip.count} kayıt`, `${trip.count} saved`) : L("İlk ekleme geziyi açar", "The first add starts one");
    tp.append(thumb(trip?.photo, trip?.title ?? "+"), twoLines(trip?.title ?? L("Henüz gezi yok", "No trip yet"), many));
    if (where?.trips.length) {
      const em = document.createElement("em");
      em.textContent = "▾";
      tp.append(em);
      tp.setAttribute("aria-label", L("Başka gezi seç", "Pick another trip"));
    }
    tp.onclick = changeTrip;
    hd.append(
      tp,
      button("cl", "×", () => {
        sideOpen = false;
        drawSide();
      }),
    );
    hd.lastElementChild!.setAttribute("aria-label", L("Kapat", "Close"));
    const bd = document.createElement("div");
    bd.className = "bd";
    if (single) {
      const go = button(`go${inDeck ? " done" : ""}`, inDeck ? L("✓ Destede", "✓ In the deck") : pageState === "busy" ? L("Okunuyor…", "Reading…") : L(`+ ${deckWord(single)} destesine ekle`, `+ Add to ${deckWord(single)}`), addPage);
      go.disabled = inDeck || pageState === "busy";
      bd.append(go);
    } else if (listy) {
      const hint = document.createElement("div");
      hint.className = "hint";
      hint.textContent = L("Beğendiğin sonucun yanındaki + ile ekle", "Add a result with the + beside it");
      bd.append(hint);
    } else {
      bd.append(button("go ghost", L("Ekrandakini ekle", "Add what's on screen"), addView));
    }
    const rows = (pocket?.rows ?? []).slice(0, 3);
    if (rows.length) {
      const k = document.createElement("span");
      k.className = "k";
      k.textContent = L("Son eklenenler", "Added last");
      bd.append(k);
      for (const r of rows) {
        const row = document.createElement("div");
        row.className = "r";
        const name = document.createElement("b");
        name.textContent = r.title;
        row.append(thumb(r.photo, r.title), name);
        // (only what isn't fine says so; a record in its deck is just its name)
        if (r.state !== "in") {
          const st = document.createElement("span");
          st.className = `st ${r.state}`;
          st.textContent = STATE_WORD[r.state]();
          row.append(st);
        }
        if (r.state === "failed") row.append(button("lnk", L("tekrar", "retry"), () => void ask({ type: "desk:retry", id: r.id }).then(() => loadPocket())));
        const x = button("x", "×", () => {
          row.remove();
          void ask({ type: "desk:remove", id: r.id }).then(() => loadPocket());
        });
        x.setAttribute("aria-label", L(`${r.title} kaldır`, `Remove ${r.title}`));
        row.append(x);
        bd.append(row);
      }
    }
    if (pocket && !pocket.key) {
      const w = document.createElement("div");
      w.className = "warn";
      w.textContent = pocket.waiting ? L(`AI bağlı değil · ${pocket.waiting} kayıt bekliyor`, `AI not connected · ${pocket.waiting} waiting`) : L("AI bağlı değil · eklediklerin bekler", "AI not connected · saves wait");
      bd.append(w);
    }
    const ft = document.createElement("div");
    ft.className = "ft";
    ft.append(
      button("", L("Panoyu aç ↗", "Open the board ↗"), () => void ask({ type: "desk:open", tripId: trip?.id ?? "" })),
      button("q", L("Bu sitede gösterme", "Not on this site"), () => {
        sideHidden = true;
        sideOpen = false;
        void chrome.storage.local.set({ [HIDE]: true }).catch(() => undefined);
        drawSide();
      }),
    );
    box.append(hd, bd, ft);
    side.append(box);
  };

  const drawStrip = () => {
    strip.replaceChildren();
    if (!route || closed) return void (strip.hidden = true);
    strip.hidden = false;
    const what = document.createElement("b");
    what.textContent = `Trip Radar · ${route.from} ✈ ${route.to}`;
    const sub = document.createElement("small");
    sub.textContent = L(`${route.title} planında · destende ${route.deck.length} seçenek`, `on your ${route.title} plan · ${route.deck.length} in your deck`);
    // (no "Ekrandakileri desteye ekle": a result goes in by its own "+", one at a time; Emre 2026-10-24: "toplu listeye
    // ekleme diye bir şey olamaz")
    const open = document.createElement("button");
    open.type = "button";
    open.className = "q";
    open.textContent = L("Planı aç", "Open the plan");
    open.onclick = () => void ask({ type: "desk:open", tripId: route!.tripId });
    const x = document.createElement("button");
    x.type = "button";
    x.className = "q";
    x.setAttribute("aria-label", L("Bu sayfada gizle", "Hide on this page"));
    x.textContent = "×";
    x.onclick = () => {
      closed = true;
      drawStrip();
      drawDock();
      layer.replaceChildren();
      cards = [];
    };
    strip.append(what, sub, open, x);
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
        // (a price written for screen readers only, 1 px wide, isn't where the card shows it: Skyscanner puts "Total cost
        // 8,480 TL" in the times' half, and the "+" landed in the middle of the card, on the price; 0.47.3)
        if (!shownBox(n.parentElement)) return NodeFilter.FILTER_REJECT;
        if (PRICE.test(v)) return NodeFilter.FILTER_ACCEPT;
        // (a price split in two spans: "€" in one, "912" in the next)
        const up = n.parentElement?.parentElement;
        const near = up?.textContent ?? "";
        return near.length < 60 && PRICE.test(near) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
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
    if (!single || closed || stale || !titleEl()) return;
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
      lbl.textContent = L(`${deckWord(single)} destesine ekle`, `Add to ${deckWord(single)}`);
      plus.append(lbl);
    }
    plus.title = inDeck ? L("Destende", "In your deck") : L("Bu sayfayı desteye ekle", "Add this page to the deck");
    plus.setAttribute("aria-label", plus.title);
    plus.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (inDeck || pageState === "busy") return;
      addPage();
    };
    pin.append(plus);
    layer.append(pin);
    titlePin = pin;
    place();
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
  const place = () => {
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
        let step = 0;
        if (r.top > 0 && r.top < innerHeight) {
          const under = document.elementsFromPoint(edge - 20, r.top + 6).find((x) => x !== host && !host.contains(x));
          if (under && c.el.contains(under) && under.closest("button, [role='button'], input, select")) step = 44;
        }
        c.pin.style.setProperty("--h", `${r.height}px`);
        c.pin.style.setProperty("--step", `${step}px`);
        c.pin.style.top = `${r.top + y0 + r.height / 2 - 15}px`;
        c.pin.style.left = `${edge - 15 + x0}px`;
      }
    }
  };

  const drawCards = (force = true) => {
    // (a flight search only for a flight on the plan, or once trips are known; a hotel's own page has its "Desteye ekle")
    if (closed || single || (!route && !where)) {
      layer.replaceChildren();
      cards = [];
      titlePin = null;
      if (single) drawTitlePin();
      return;
    }
    const had = cards.length;
    const els = findCards();
    // (the same results as drawn: only placed again, nothing rebuilt; the page's own changes come often)
    if (!force && els.length === cards.length && els.every((el, i) => cards[i]?.el === el)) return place();
    layer.replaceChildren();
    cards = [];
    const facts = els.map((el) => cardFacts((el as HTMLElement).innerText));
    els.forEach((el, i) => {
      const pin = document.createElement("div");
      pin.className = "pin";
      let label: string | null = null;
      if (route) {
        const c = route.chosen;
        const mine = c && c.dep && facts[i].dep === c.dep && facts[i].arr === c.arr && facts[i].price != null;
        label = cardLabel(facts[i], route.deck, facts);
        if (mine) {
          label = seen?.href === href && seen.save ? L(`Seçtiğin uçuş · ${formatPrice(seen.save, facts[i].currency)} ucuz`, `Your flight · ${formatPrice(seen.save, facts[i].currency)} less`) : L("Seçtiğin uçuş", "Your flight");
          if (seen?.href !== href) {
            seen = { href, save: null };
            void ask<{ save: number | null }>({ type: "desk:seen", url: location.href, price: facts[i].price!, currency: facts[i].currency }).then((r) => {
              if (r?.save && seen?.href === href) {
                seen.save = r.save;
                drawCards();
              }
            });
          }
        }
      } else if (!timed && where?.names?.length && inDeckByName((el as HTMLElement).innerText, where.names)) label = L("Destende var", "In your deck");
      if (label) {
        const tag = document.createElement("span");
        tag.className = `tag${/Destende|In your deck|Seçtiğin|Your flight/.test(label) ? " in" : ""}`;
        tag.textContent = label;
        pin.append(tag);
      }
      const plus = document.createElement("button");
      plus.type = "button";
      const isIn = added.has(el), busy = reading.has(el);
      plus.className = `plus${isIn ? " done" : busy ? " read" : ""}`;
      plus.textContent = isIn ? "✓" : busy ? "···" : "+";
      // (Pinterest's: a small "+" on the card's top edge; over the card, it says "+ Ekle")
      if (!isIn && !busy) {
        const lbl = document.createElement("span");
        lbl.className = "lbl";
        lbl.textContent = L("Ekle", "Add");
        plus.append(lbl);
      }
      plus.title = isIn ? L("Desteye girdi; okunuyor", "In the deck; being read") : L("Bunu desteye ekle", "Add this one to the deck");
      plus.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (added.has(el) || reading.has(el)) return;
        withTrip(whatOf(kind), async (pick) => {
          const r = await addCard(el, pick);
          drawCards();
          if (r && !route) said(r);
          return Boolean(r);
        });
      };
      pin.append(plus);
      layer.append(pin);
      cards.push({ el, facts: facts[i], pin });
    });
    place();
    // (results came or went: the pocket's "Bu sayfa" says so)
    if (Boolean(had) !== Boolean(cards.length) && !sideOpen) drawSide();
  };

  const refresh = async () => {
    if (location.href === href) return;
    href = location.href;
    closed = false;
    pageState = "idle";
    asking = null;
    confirmAsk = null;
    confirmTries = 0;
    single = offerPageKind(href, ldTypes());
    [route, where] = await Promise.all([
      kind === "flight" ? ask<CompanionRoute>({ type: "desk:route", url: href }) : Promise.resolve(null),
      ask<CompanionWhere>({ type: "desk:where", url: href, title: document.title }),
    ]);
    drawStrip();
    drawCards();
    checkConfirm();
    drawDock();
    void loadPocket();
  };

  /** A booking's confirmation on this page (its words and number, or its JSON-LD): asked once, the icon's ✓ beside it. */
  const checkConfirm = () => {
    if (confirmTries >= 3 || where?.saved) return;
    confirmTries++;
    const c = confirmationOf({ text: (document.body?.innerText ?? "").slice(0, 60_000), jsonLd: ldBlocks(), title: document.title });
    if (!c) return;
    confirmTries = 3;
    confirmAsk = c;
    void ask({ type: "desk:confirmed" });
    drawDock();
  };

  let pending = 0;
  const later = () => {
    clearTimeout(pending);
    pending = window.setTimeout(() => {
      if (closed) return;
      // (only while the page is in view; the page's own work first)
      if (document.hidden) return;
      // (a hotel's page often says what it is only once its scripts ran)
      if (!single && (single = offerPageKind(location.href, ldTypes()))) (drawSide(), drawCards());
      // (the name comes in late on some pages: its "+" then)
      if (single && !titlePin) drawTitlePin();
      drawCards(false);
      // (a confirmation page often writes its number once its scripts ran)
      if (!confirmAsk && confirmTries < 3) checkConfirm();
    }, 700);
  };
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => !document.hidden && later());
  let frame = 0;
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };
  addEventListener("scroll", follow, { passive: true, capture: true });
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
  // (the pocket closes on a press elsewhere, or Escape)
  addEventListener(
    "pointerdown",
    (e) => {
      if (sideOpen && !e.composedPath().includes(host)) {
        sideOpen = false;
        drawSide();
      }
    },
    { capture: true, passive: true },
  );
  addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && sideOpen) {
      sideOpen = false;
      drawSide();
    }
  });
  // (a search page changes its address without loading: the way or the day changed; nothing once cut off by an update)
  const tick = window.setInterval(() => (alive() ? void refresh() : clearInterval(tick)), 1500);
  void chrome.storage.local
    .get(HIDE)
    .then((got) => (sideHidden = got[HIDE] === true))
    .catch(() => undefined)
    .then(() => loadLang().catch(() => undefined))
    .then(refresh);
}

if (document.body) start();
else addEventListener("DOMContentLoaded", start, { once: true });
