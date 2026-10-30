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
  const layer = document.createElement("div");
  layer.className = "layer";
  const dock = document.createElement("div");
  dock.className = "dock";
  const side = document.createElement("div");
  root.append(style, layer, side, dock);
  document.documentElement.append(host);

  let route: CompanionRoute | null = null;
  let where: CompanionWhere | null = null;
  let href = "";
  let single: SiteKind | null = null;
  // Gezi cebi's tab: the trip and how many are saved on it; this page's "Desteye ekle".
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
  const withTrip = (what: string, send: (pick: TripPick) => Promise<boolean>) => {
    // (the trip on the pocket's top is where it goes: said so, so the save and the pocket never disagree)
    if (!mustAsk()) return void send(!route && knownTrip() ? { tripId: knownTrip()!.id } : {});
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
    // (pressed again on one saved before: nothing new went in, said so)
    if (r.again) toast = title ? L(`Zaten ${title} destesinde`, `Already in ${title}`) : L("Zaten destede", "Already in the deck");
    else toast = [
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
            marks = marks.filter((m) => m.captureId !== done.captureId);
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

  /** The gezi cebi's tab: the trip the page goes to (else the current one) and how many are saved on it. */
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
    side.append(tab);
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
        if (isSaved(el) || reading.has(el)) return;
        withTrip(whatOf(kind), async (pick) => {
          const r = await addCard(el, pick);
          drawCards();
          if (r) said(r);
          return Boolean(r);
        });
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
  // (a search page changes its address without loading: the way or the day changed; nothing once cut off by an update)
  const tick = window.setInterval(() => (alive() ? void refresh() : clearInterval(tick)), 1500);
  void loadLang()
    .catch(() => undefined)
    .then(refresh);
}

if (document.body) start();
else addEventListener("DOMContentLoaded", start, { once: true });
