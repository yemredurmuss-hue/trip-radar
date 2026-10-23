// Benle gezen eklenti, seviye 2: "Sitede benle gel" (lib/companion.ts). Runs only on the flight sites the traveller allowed
// one by one, and does something only while the address is a search for a flight on the plan: a thin strip says which row
// it is for ("Bangkok ✈ İstanbul, 2 Nis planında · destende 7 seçenek"), each result in view gets a "+" and where it
// stands against the deck. Everything it draws is in its own closed shadow root, over the page, never inside the site's
// own elements; nothing is saved until "+" (or "Ekrandakileri desteye ekle") is pressed; no link on the site is changed.
import { cardFacts, cardLabel, isResultText, type CardFacts, type CompanionAsk, type CompanionRoute } from "./lib/companion";
import { L, loadLang } from "./lib/i18n";

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
.strip { position: fixed; z-index: 2147483646; top: 10px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
  max-width: calc(100vw - 32px); padding: 8px 8px 8px 14px; border-radius: 99px; background: #1c1a33; color: #fff;
  font: 600 13px/1.3 "Plus Jakarta Sans", system-ui, sans-serif; box-shadow: 0 10px 30px -12px rgba(28,26,51,.6); }
.strip b { font-weight: 800; white-space: nowrap; }
.strip small { color: #c9c2f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.strip button { font: 750 12.5px/1 inherit; border: 0; border-radius: 99px; padding: 8px 12px; cursor: pointer; background: #5b45e0; color: #fff; white-space: nowrap; }
.strip button.q { background: transparent; color: #c9c2f5; padding: 8px; }
.strip button:focus-visible, .plus:focus-visible { outline: 3px solid #cfc7ff; outline-offset: 1px; }
.layer { position: fixed; inset: 0; z-index: 2147483645; pointer-events: none; }
.pin { position: fixed; display: flex; align-items: center; gap: 6px; pointer-events: auto; }
.plus { width: 30px; height: 30px; border-radius: 99px; border: 0; background: #5b45e0; color: #fff; font: 800 18px/1 system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 4px 12px -4px rgba(91,69,224,.7); }
.plus.done { background: #1f7a45; font-size: 14px; }
.tag { padding: 4px 9px; border-radius: 99px; background: #efecff; color: #4a36c9; font: 800 11.5px/1.2 "Plus Jakarta Sans", system-ui, sans-serif;
  box-shadow: inset 0 0 0 1px #dcd6fb; white-space: nowrap; }
.tag.in { background: #e7f5ec; color: #1f7a45; box-shadow: inset 0 0 0 1px #bfe3c9; }
`;

function start() {
  if (window.__tripRadarCompanion) return;
  window.__tripRadarCompanion = true;
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
  root.append(style, strip, layer);
  document.documentElement.append(host);

  let route: CompanionRoute | null = null;
  let href = "";
  let closed = false;
  let cards: { el: Element; facts: CardFacts; pin: HTMLDivElement }[] = [];
  const added = new WeakSet<Element>();

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

  /** The results: the smallest elements whose text is one flight's (two hours and a price), at most forty. */
  const findCards = (): Element[] => {
    const found: Element[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n && found.length < 200; n = walker.nextNode()) {
      const el = n as HTMLElement;
      if (el === host || el.closest("#trip-radar-companion")) continue;
      // (textContent costs no layout: a big list's is too long and goes at once; it runs words together, so the result's
      // own text is then read as it is shown)
      const loose = el.textContent ?? "";
      if (loose.length < 20 || loose.length > 900 || !/\d[:.][0-5]\d/.test(loose)) continue;
      if (!isResultText(el.innerText ?? "")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 260 || r.height < 48 || r.height > 420) continue;
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
    if (!route || closed) return;
    const els = findCards();
    const facts = els.map((el) => cardFacts((el as HTMLElement).innerText));
    els.forEach((el, i) => {
      const pin = document.createElement("div");
      pin.className = "pin";
      const label = cardLabel(facts[i], route!.deck, facts);
      if (label) {
        const tag = document.createElement("span");
        tag.className = `tag${/Destende|In your deck/.test(label) ? " in" : ""}`;
        tag.textContent = label;
        pin.append(tag);
      }
      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = `plus${added.has(el) ? " done" : ""}`;
      plus.textContent = added.has(el) ? "✓" : "+";
      plus.title = L("Bunu desteye ekle", "Add this one to the deck");
      plus.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (added.has(el)) return;
        plus.disabled = true;
        const ok = await ask<{ ok: boolean }>({ type: "desk:add", url: location.href, title: document.title, text: (el as HTMLElement).innerText.replace(/\s+/g, " ").trim().slice(0, 1500) });
        plus.disabled = false;
        if (ok?.ok) {
          added.add(el);
          plus.classList.add("done");
          plus.textContent = "✓";
          plus.title = L("Desteye girdi; okunuyor", "In the deck; being read");
        }
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
    route = await ask<CompanionRoute>({ type: "desk:route", url: href });
    drawStrip();
    drawCards();
  };

  let pending = 0;
  const later = () => {
    clearTimeout(pending);
    pending = window.setTimeout(() => route && !closed && drawCards(), 700);
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
  void loadLang().catch(() => undefined).then(refresh);
}

if (document.body) start();
else addEventListener("DOMContentLoaded", start, { once: true });
