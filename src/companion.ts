// Benle gezen eklenti, seviye 2: "Sitede benle gel" (lib/companion.ts). Runs only on the sites the traveller allowed one by
// one. On a flight search for a flight on the plan a thin strip says which row it is for ("Bangkok ✈ İstanbul, 2 Nis
// planında · destende 7 seçenek"); each result in view gets a "+" (and where it stands against the deck); a hotel's or a
// tour's list gets the same "+", and its own page a small "Desteye ekle" at the bottom right (0.41.0). The first "+" for a
// country not yet answered asks which trip, here on the page (Hangi gezi, lib/tripRules.ts). Everything it draws is in its
// own closed shadow root, over the page, never inside the site's own elements; nothing is saved until "+" (or "Desteye
// ekle", "Ekrandakileri desteye ekle") is pressed; no link on the site is changed.
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
import { formatPrice } from "./lib/items";
import { L, loadLang } from "./lib/i18n";
import { collectPage } from "./lib/pagecapture";

declare global {
  interface Window {
    __tripRadarCompanion?: boolean;
  }
}

const ask = <T,>(message: CompanionAsk): Promise<T | null> =>
  new Promise((done) => {
    try {
      chrome.runtime.sendMessage(message, (reply: T | null) => done(chrome.runtime.lastError ? null : (reply ?? null)));
    } catch {
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
.layer { position: fixed; inset: 0; z-index: 2147483645; pointer-events: none; }
.pin { position: fixed; display: flex; align-items: center; gap: 6px; pointer-events: auto; }
.plus { width: 30px; height: 30px; border-radius: 99px; border: 0; background: #5b45e0; color: #fff; font: 800 18px/1 system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 4px 12px -4px rgba(91,69,224,.7); }
.plus { width: auto; min-width: 30px; padding: 0 9px; display: inline-flex; align-items: center; justify-content: center; gap: 0; transition: padding 160ms ease, gap 160ms ease; }
.plus .lbl { display: inline-block; max-width: 0; overflow: hidden; white-space: nowrap; font: 800 13px/1 "Plus Jakarta Sans", system-ui, sans-serif; transition: max-width 160ms ease; }
.pin.hot .plus .lbl, .plus:hover .lbl, .plus:focus-visible .lbl { max-width: 60px; }
.pin.hot .plus, .plus:hover, .plus:focus-visible { padding: 0 12px 0 10px; gap: 5px; }
.plus.done { background: #1f7a45; font-size: 14px; }
.plus.read { background: #fff; color: #5b45e0; box-shadow: inset 0 0 0 2px #5b45e0; font-size: 12px; }
.tag { padding: 4px 9px; border-radius: 99px; background: #efecff; color: #4a36c9; font: 800 11.5px/1.2 "Plus Jakarta Sans", system-ui, sans-serif;
  box-shadow: inset 0 0 0 1px #dcd6fb; white-space: nowrap; }
.tag.in { background: #e7f5ec; color: #1f7a45; box-shadow: inset 0 0 0 1px #bfe3c9; }
.dock { position: fixed; z-index: 2147483646; right: 20px; bottom: 20px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  font: 600 13px/1.4 "Plus Jakarta Sans", system-ui, sans-serif; color: #1c1a33; }
.tip { max-width: 270px; padding: 8px 12px; border-radius: 10px; background: #1c1a33; color: #fff; font-size: 12px; }
.tip span { color: #c9c2f5; }
.pill { display: flex; align-items: center; border-radius: 99px; background: #5b45e0; box-shadow: 0 8px 22px -6px rgba(91,69,224,.6); overflow: hidden; }
.pill.done { background: #1f7a45; box-shadow: 0 8px 22px -6px rgba(31,122,69,.5); }
.pill button { font: 800 14px/1 "Plus Jakarta Sans", system-ui, sans-serif; border: 0; background: transparent; color: #fff; cursor: pointer; padding: 11px 16px; display: flex; align-items: center; gap: 8px; }
.pill button i { font-style: normal; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 99px; background: #fff; color: #5b45e0; font-size: 15px; }
.pill.done button i { color: #1f7a45; font-size: 12px; }
.pill button.x { padding: 11px 12px; color: #d9d3fb; font-weight: 600; border-left: 1px solid rgba(255,255,255,.25); }
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
.qp .cv .ini { grid-row: 1 / 3; grid-column: 1 / 3; display: grid; place-items: center; font: 800 20px/1 "Plus Jakarta Sans", system-ui, sans-serif; color: #4a36c9; }
.qp button.best .cv { box-shadow: 0 0 0 3px #5b45e0; }
.qp b { font-size: 12.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qp span.w { font-size: 11px; color: #5d5a78; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.qp button:hover .cv { filter: brightness(.95); }
.ln { all: unset; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 5px 6px; border-radius: 10px; }
.ln:hover { background: #f4f2ff; }
.ln .th { width: 34px; height: 34px; border-radius: 9px; flex: none; background: #efecff; object-fit: cover; display: grid; place-items: center; color: #4a36c9; font-weight: 800; font-size: 13px; }
.ln b { display: block; font-size: 13px; font-weight: 750; }
.ln span.w { display: block; font-size: 11px; color: #5d5a78; font-weight: 600; }
.ln.new { box-shadow: inset 0 0 0 1.5px #d6d2e4; }
.ask button.no { align-self: flex-start; border: 0; background: none; color: #5d5a78; font: 700 12px/1 inherit; cursor: pointer; padding: 4px 0; }
.toast { display: flex; align-items: center; gap: 10px; max-width: 320px; padding: 10px 12px; border-radius: 12px; background: #1c1a33; color: #fff; font-size: 12.5px;
  box-shadow: 0 10px 24px rgba(0,0,0,.25); }
.toast i { font-style: normal; flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 99px; background: #1f7a45; font-size: 12px; font-weight: 800; }
.toast button { border: 0; background: none; color: #c9c2f5; font: 800 12px/1 inherit; cursor: pointer; padding: 0; white-space: nowrap; }
.toast.sel { gap: 12px; }
.toast.sel .go { padding: 8px 12px; border-radius: 99px; background: #5b45e0; color: #fff; }
.toast.sel .go:disabled { opacity: .5; cursor: default; }
.plus.tick { background: #fff; color: #5b45e0; box-shadow: inset 0 0 0 2px #5b45e0; font-size: 14px; }
.plus.tick.on { background: #5b45e0; color: #fff; }
.hop { position: fixed; z-index: 2147483647; display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border-radius: 12px; background: #fff;
  box-shadow: 0 0 0 1.5px #c9bffa, 0 10px 26px rgba(28,26,51,.25); pointer-events: none; font: 800 12.5px/1.2 "Plus Jakarta Sans", system-ui, sans-serif; color: #1c1a33; }
.hop img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex: none; }
.hop b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

/** What the question asks about ("Bu konaklama hangi geziye?"). */
const whatOf = (kind: SiteKind): string =>
  kind === "stay" ? L("Bu konaklama", "This stay") : kind === "activity" ? L("Bu etkinlik", "This activity") : kind === "transport" ? L("Bu yolculuk", "This journey") : kind === "flight" ? L("Bu uçuş", "This flight") : L("Bu sayfa", "This page");

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
  root.append(style, strip, layer, dock);
  document.documentElement.append(host);

  let route: CompanionRoute | null = null;
  let where: CompanionWhere | null = null;
  let href = "";
  let closed = false;
  let single: SiteKind | null = null;
  let pillHidden = false;
  let pillState: "idle" | "busy" | "done" = "idle";
  let toast: string | null = null;
  let asking: { what: string; then: (pick: TripPick) => void } | null = null;
  let cards: { el: Element; facts: CardFacts; pin: HTMLDivElement }[] = [];
  const added = new WeakSet<Element>();
  const reading = new WeakSet<Element>();
  // (fiyat izleme: the chosen flight's price here, asked once a page; its answer, what it saves)
  let seen: { href: string; save: number | null } | null = null;
  const HIDE = `pillHidden:${location.hostname}`;

  /** The trip it goes to without asking: the route's, the remembered one; null with trips to ask among: asked first. */
  const knownTrip = (): { id: string; title: string } | null => (route ? { id: route.tripId, title: route.title } : (where?.trip ?? null));
  const mustAsk = () => !knownTrip() && Boolean(where?.trips?.length);

  /** Hangi gezi on the page: asked once (its answer kept as the country's trip when said so), then sent. */
  const withTrip = (what: string, send: (pick: TripPick) => Promise<boolean>) => {
    if (!mustAsk()) return void send({});
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
    const dx = innerWidth - 36 - (from.left + from.width / 2);
    const dy = -(from.top + from.height / 2) + 4;
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

  // Bu sayfadan seç (0.43.0, from the toolbar): the results' "+" become ticks; the dock says how many, and adds them all.
  let selecting = false;
  const chosen = new Set<Element>();
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
    if (selecting) {
      const bar = document.createElement("div");
      bar.className = "toast sel";
      const words = document.createElement("span");
      words.textContent = chosen.size ? L(`${chosen.size} seçili`, `${chosen.size} picked`) : L("Eklemek istediklerini işaretle", "Tick what to add");
      const go = document.createElement("button");
      go.type = "button";
      go.className = "go";
      go.textContent = L("Desteye ekle", "Add to the deck");
      go.disabled = !chosen.size;
      go.onclick = () =>
        withTrip(L("Bu sonuçlar", "These results"), async (pick) => {
          const list = [...chosen];
          selecting = false;
          chosen.clear();
          let lastOk: SavedOnSite | null = null;
          for (const el of list) lastOk = (await addCard(el, pick)) ?? lastOk;
          drawCards();
          if (lastOk) said(lastOk, list.length);
          else drawDock();
          return Boolean(lastOk);
        });
      const no = document.createElement("button");
      no.type = "button";
      no.textContent = L("Vazgeç", "Cancel");
      no.onclick = () => {
        selecting = false;
        chosen.clear();
        drawCards();
        drawDock();
      };
      bar.append(words, go, no);
      dock.append(bar);
    } else if (toast) {
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
            if (single) pillState = "idle";
            drawCards();
            drawDock();
          });
        t.append(change, undo);
      }
      dock.append(t);
    }
    if (!single || pillHidden) return;
    // "Desteye ekle" (E3): a hotel's or a tour's own page; where it goes said before it's pressed.
    const trip = knownTrip();
    if (pillState === "idle" && !where?.saved) {
      const tip = document.createElement("div");
      tip.className = "tip";
      tip.textContent = trip ? L(`${trip.title} gezisi · ${deckWord(single)} destesine girer`, `${trip.title} · joins the ${deckWord(single)} deck`) : mustAsk() ? L("Basınca hangi gezi diye sorarım", "I'll ask which trip when you press it") : L("Basınca yeni bir gezi açarım", "I'll start a trip when you press it");
      dock.append(tip);
    }
    const pill = document.createElement("div");
    const done = pillState === "done" || (pillState === "idle" && Boolean(where?.saved));
    pill.className = `pill${done ? " done" : ""}`;
    const add = document.createElement("button");
    add.type = "button";
    const icon = document.createElement("i");
    icon.textContent = done ? "✓" : pillState === "busy" ? "···" : "+";
    add.append(icon, document.createTextNode(pillState === "busy" ? L("Okunuyor", "Reading") : done ? (pillState === "done" ? L("Destede", "In the deck") : L("Destende", "In your deck")) : L("Desteye ekle", "Add to the deck")));
    add.disabled = pillState !== "idle" || done;
    add.onclick = () =>
      withTrip(whatOf(single!), async (pick) => {
        pillState = "busy";
        drawDock();
        const ok = await ask<SavedOnSite>({ type: "desk:page", url: location.href, snapshot: collectPage(), ...pick });
        pillState = ok?.ok ? "done" : "idle";
        if (ok?.ok) {
          const h = document.querySelector("h1");
          fly((h ?? document.body).getBoundingClientRect(), photoOf(document.body), document.title);
          said(ok);
        } else drawDock();
        return Boolean(ok?.ok);
      });
    const x = document.createElement("button");
    x.type = "button";
    x.className = "x";
    x.setAttribute("aria-label", L("Bu sitede gizle", "Hide on this site"));
    x.textContent = "×";
    x.onclick = () => {
      pillHidden = true;
      void chrome.storage.local.set({ [HIDE]: true }).catch(() => undefined);
      drawDock();
    };
    pill.append(add, x);
    dock.append(pill);
  };

  const drawStrip = () => {
    strip.replaceChildren();
    if (!route || closed) return void (strip.hidden = true);
    strip.hidden = false;
    const what = document.createElement("b");
    what.textContent = `Trip Radar · ${route.from} ✈ ${route.to}`;
    const sub = document.createElement("small");
    sub.textContent = L(`${route.title} planında · destende ${route.deck.length} seçenek`, `on your ${route.title} plan · ${route.deck.length} in your deck`);
    const shot = document.createElement("button");
    shot.type = "button";
    shot.textContent = L("Ekrandakileri desteye ekle", "Add what's on screen");
    shot.onclick = async () => {
      shot.disabled = true;
      const ok = await ask<{ ok: boolean }>({ type: "desk:shot", url: location.href, title: document.title, text: visibleText() });
      shot.textContent = ok?.ok ? L("✓ Okunuyor, desteye girecek", "✓ Reading, it joins the deck") : L("Olmadı, yeniden dene", "Didn't work, try again");
      shot.disabled = Boolean(ok?.ok);
    };
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
    strip.append(what, sub, shot, open, x);
  };

  /** The text in view (as the toolbar's save reads it), for "Ekrandakileri desteye ekle". */
  const visibleText = (): string => {
    const out: string[] = [];
    for (const el of findCards()) {
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) out.push((el as HTMLElement).innerText.replace(/\s+/g, " ").trim());
    }
    return out.join("\n").slice(0, 12_000);
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
  const findCards = (): Element[] => {
    const prices: Text[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        const v = n.nodeValue ?? "";
        if (v.length > 80 || !/\d/.test(v)) return NodeFilter.FILTER_REJECT;
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

  const place = () => {
    for (const c of cards) {
      const r = c.el.getBoundingClientRect();
      const shown = r.bottom > 0 && r.top < innerHeight && r.width > 0;
      c.pin.style.display = shown ? "flex" : "none";
      if (shown) {
        // (on the card's top edge, half over it: never over the result's own price or button)
        const top = Math.max(4, r.top - 15);
        let right = Math.min(innerWidth - 40, r.right - 8);
        // (the site's own button under the "+" (a heart, a share): the "+" steps left of it)
        const under = document.elementsFromPoint(right - 15, Math.max(1, r.top + 6)).find((x) => x !== host && !host.contains(x));
        if (under && c.el.contains(under) && under.closest("button, [role='button'], input, select")) right -= 44;
        c.pin.style.top = `${top}px`;
        c.pin.style.left = `${right}px`;
        c.pin.style.transform = "translateX(-100%)";
      }
    }
  };

  const drawCards = (force = true) => {
    // (a flight search only for a flight on the plan, or once trips are known; a hotel's own page has its "Desteye ekle")
    if (closed || single || (!route && !where)) {
      layer.replaceChildren();
      cards = [];
      return;
    }
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
      if (selecting && !isIn) {
        plus.className = `plus tick${chosen.has(el) ? " on" : ""}`;
        plus.textContent = chosen.has(el) ? "✓" : "";
        plus.title = L("Seç", "Pick");
      }
      plus.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (added.has(el) || reading.has(el)) return;
        if (selecting) {
          if (chosen.has(el)) chosen.delete(el);
          else chosen.add(el);
          drawCards();
          drawDock();
          return;
        }
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
  };

  const refresh = async () => {
    if (location.href === href) return;
    href = location.href;
    closed = false;
    pillState = "idle";
    asking = null;
    single = offerPageKind(href, ldTypes());
    [route, where] = await Promise.all([
      kind === "flight" ? ask<CompanionRoute>({ type: "desk:route", url: href }) : Promise.resolve(null),
      ask<CompanionWhere>({ type: "desk:where", url: href, title: document.title }),
    ]);
    drawStrip();
    drawCards();
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
      if (!single && (single = offerPageKind(location.href, ldTypes()))) drawDock();
      drawCards(false);
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
      const pin = c?.pin ?? null;
      if (pin === hot) return;
      hot?.classList.remove("hot");
      hot = pin;
      hot?.classList.add("hot");
    },
    { passive: true, capture: true },
  );
  addEventListener("resize", follow, { passive: true });
  chrome.runtime.onMessage?.addListener((m: { type?: unknown }) => {
    if (m?.type !== "desk:select" || single) return;
    selecting = true;
    chosen.clear();
    drawCards();
    drawDock();
  });
  // (a search page changes its address without loading: the way or the day changed)
  setInterval(() => void refresh(), 1500);
  void chrome.storage.local
    .get(HIDE)
    .then((got) => (pillHidden = got[HIDE] === true))
    .catch(() => undefined)
    .then(() => loadLang().catch(() => undefined))
    .then(refresh);
}

if (document.body) start();
else addEventListener("DOMContentLoaded", start, { once: true });
