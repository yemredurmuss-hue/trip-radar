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
  siteKindOf,
  type CardFacts,
  type CompanionAsk,
  type CompanionRoute,
  type CompanionWhere,
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
.ask { width: 300px; max-height: min(460px, calc(100vh - 120px)); overflow: auto; padding: 14px; border-radius: 14px; background: #fff;
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
.ask button.no { align-self: flex-start; border: 0; background: none; color: #5d5a78; font: 700 12px/1 inherit; cursor: pointer; padding: 4px 0; }
.toast { display: flex; align-items: center; gap: 10px; max-width: 320px; padding: 10px 12px; border-radius: 12px; background: #1c1a33; color: #fff; font-size: 12.5px;
  box-shadow: 0 10px 24px rgba(0,0,0,.25); }
.toast i { font-style: normal; flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 99px; background: #1f7a45; font-size: 12px; font-weight: 800; }
.toast button { border: 0; background: none; color: #c9c2f5; font: 800 12px/1 inherit; cursor: pointer; padding: 0; white-space: nowrap; }
`;

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
  const kind: SiteKind = siteKindOf(companionSiteOf(location.href) ?? "");
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

  const said = (tripTitle: string | null) => {
    toast = tripTitle ? L(`${tripTitle} · ${deckWord(kind)} destesine girdi, okunuyor`, `${tripTitle} · in the ${deckWord(kind)} deck, being read`) : L("Desteye girdi, okunuyor", "In the deck, being read");
    drawDock();
    setTimeout(() => {
      toast = null;
      drawDock();
    }, 6000);
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
      const own = where?.trips.filter((t) => t.match) ?? [];
      const others = where?.trips.filter((t) => !t.match) ?? [];
      const remember = document.createElement("input");
      remember.type = "checkbox";
      remember.checked = true;
      const pick = (p: TripPick) => asking?.then({ ...p, remember: Boolean(country) && remember.checked });
      const tripButton = (t: CompanionWhere["trips"][number], best: boolean) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `t${best ? " best" : ""}`;
        b.textContent = t.title;
        if (t.when) {
          const w = document.createElement("span");
          w.textContent = t.when;
          b.append(w);
        }
        b.onclick = () => pick({ tripId: t.id });
        return b;
      };
      if (own.length && country) {
        const g = document.createElement("small");
        g.textContent = L(`${country} gezilerin`, `Your trips to ${country}`);
        box.append(g, ...own.map((t, n) => tripButton(t, n === 0)));
      }
      if (others.length) {
        const g = document.createElement("small");
        g.textContent = own.length ? L("Diğerleri", "Others") : L("Gezilerin", "Your trips");
        box.append(g, ...others.map((t) => tripButton(t, false)));
      }
      if (country) {
        const fresh = document.createElement("button");
        fresh.type = "button";
        fresh.className = "t";
        fresh.textContent = L(`+ Yeni gezi: ${country}`, `+ New trip: ${country}`);
        fresh.onclick = () => pick({ newTrip: true });
        const label = document.createElement("label");
        label.append(remember, document.createTextNode(L(`${country} için bundan sonra hep buraya koy`, `Put ${country} there from now on`)));
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
    if (toast) {
      const t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      const i = document.createElement("i");
      i.textContent = "✓";
      const words = document.createElement("span");
      words.textContent = toast;
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = L("Planı aç", "Open the plan");
      open.onclick = () => {
        const trip = knownTrip();
        if (trip) void ask({ type: "desk:open", tripId: trip.id });
      };
      t.append(i, words);
      if (knownTrip()) t.append(open);
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
      withTrip(single === "stay" ? L("Bu konaklama", "This stay") : single === "activity" ? L("Bu etkinlik", "This activity") : L("Bu uçuş", "This flight"), async (pick) => {
        pillState = "busy";
        drawDock();
        const ok = await ask<{ ok: boolean; tripId: string | null }>({ type: "desk:page", url: location.href, snapshot: collectPage(), ...pick });
        pillState = ok?.ok ? "done" : "idle";
        if (ok?.ok) said(where?.trips.find((t) => t.id === ok.tripId)?.title ?? knownTrip()?.title ?? null);
        else drawDock();
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
   * hotel's or a tour's: a price, a link and a photo in a box the size of a result.
   */
  const findCards = (): Element[] => {
    const found: Element[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n && found.length < 200; n = walker.nextNode()) {
      const el = n as HTMLElement;
      if (el === host || el.closest("#trip-radar-companion")) continue;
      // (textContent costs no layout: a big list's is too long and goes at once; it runs words together, so the result's
      // own text is then read as it is shown)
      const loose = el.textContent ?? "";
      if (loose.length < 20 || loose.length > 900) continue;
      if (kind === "flight") {
        if (!/\d[:.][0-5]\d/.test(loose) || !isResultText(el.innerText ?? "")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 260 || r.height < 48 || r.height > 420) continue;
      } else {
        if (!/\d/.test(loose) || !el.querySelector("a[href]") || !el.querySelector("img") || !isOfferText(el.innerText ?? "")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 120 || r.height > 760) continue;
      }
      found.push(el);
    }
    // (the smallest: one that holds another candidate is the list around them)
    return found.filter((el) => !found.some((o) => o !== el && el.contains(o))).slice(0, 40);
  };

  const place = () => {
    for (const c of cards) {
      const r = c.el.getBoundingClientRect();
      const shown = r.bottom > 0 && r.top < innerHeight && r.width > 0;
      c.pin.style.display = shown ? "flex" : "none";
      if (shown) {
        // (on the card's top edge, half over it: never over the result's own price or button)
        c.pin.style.top = `${Math.max(4, r.top - 15)}px`;
        c.pin.style.left = `${Math.min(innerWidth - 40, r.right - 8)}px`;
        c.pin.style.transform = "translateX(-100%)";
      }
    }
  };

  const drawCards = () => {
    layer.replaceChildren();
    cards = [];
    // (a flight search only for a flight on the plan, or once trips are known; a hotel's own page has its "Desteye ekle")
    if (closed || single || (!route && !where)) return;
    const els = findCards();
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
      } else if (kind !== "flight" && where?.names?.length && inDeckByName((el as HTMLElement).innerText, where.names)) label = L("Destende var", "In your deck");
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
      plus.title = isIn ? L("Desteye girdi; okunuyor", "In the deck; being read") : L("Bunu desteye ekle", "Add this one to the deck");
      plus.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (added.has(el) || reading.has(el)) return;
        withTrip(kind === "stay" ? L("Bu konaklama", "This stay") : kind === "activity" ? L("Bu etkinlik", "This activity") : L("Bu uçuş", "This flight"), async (pick) => {
          reading.add(el);
          drawCards();
          const ok = await ask<{ ok: boolean; tripId: string | null }>({ type: "desk:add", url: location.href, title: document.title, text: (el as HTMLElement).innerText.replace(/\s+/g, " ").trim().slice(0, 1500), ...pick });
          reading.delete(el);
          if (ok?.ok) {
            added.add(el);
            if (!route) said(where?.trips.find((t) => t.id === ok.tripId)?.title ?? knownTrip()?.title ?? null);
          }
          drawCards();
          return Boolean(ok?.ok);
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
      // (a hotel's page often says what it is only once its scripts ran)
      if (!single && (single = offerPageKind(location.href, ldTypes()))) drawDock();
      drawCards();
    }, 700);
  };
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true });
  let frame = 0;
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };
  addEventListener("scroll", follow, { passive: true, capture: true });
  addEventListener("resize", follow, { passive: true });
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
