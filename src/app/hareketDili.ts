// Hareket Dili (docs/mockups/artifact-arsivi/hareket-dili-P2qVN5, Emre's m-* decisions): the movements that are put on the page from
// outside, so the cards' and views' own files stay as they are. Each reads the page the way putFly.ts and exitMotion.ts do:
//   m-sekme   the segmented tabs (Plan | Pano, Kategoriye göre | Yolculuk | Gün gün): the chosen segment's highlight slides to the new one
//             (260 ms), the old view fades in 120 ms (a copy of it) while the new one comes in 12 px from the side it was chosen on
//             (app.css `mv-tab-in`). The Pano tab opens a window over the plan (aria-haspopup="dialog"): to it and back from it only
//             the highlight slides, the plan stays where it is (no copy, nothing from the side; v82 E report §3.9)
//   m-sert    a banner that goes (the chat's "Asistana bağlanamadım") is pulled up out of the page in 200 ms
//   m-kurallar at most two pulsing rings on screen at once (the third and later keep still)
// All of it is off for "azaltılmış hareket" and "Hareketi duraklat" (reducedMotion()); the indicator still moves to the chosen segment, at once.
import { reducedMotion } from "./motion";

/** The segmented pairs that carry a sliding highlight. */
export const TABLISTS = ".view-tabs, .plan-order";
/** The views a tab shows (app.css "Hareket dili" 1): what comes in from the side and what is left as a fading copy. */
export const VIEW_CONTENT = ".panel .cat-plan, .panel .trip-plan, .panel .doc-tab, .panel .tm-tab, .panel .pn";
/** The ghost of the old view fades over this long (--t-instant), the new one comes in over --t-base. */
export const GHOST_MS = 120;
/** How long the side the new view comes from is kept after a tab press (the view is drawn in the same moment). */
const DIR_MS = 700;
/** The rings that may pulse on screen at once. */
export const MAX_PULSES = 2;
/** What pulses (app.css `pk-pulse`): an empty card's ring, an empty ticket's frame. */
export const PULSERS = ".ek-card .pk-ring.open, .ek-card .pk-ring.half, .pk-card.tk.tk-search";
/** The banner's way out: --t-base. */
export const BANNER_OUT_MS = 200;
export const BANNERS = ".chat-banner";

/** Which way the new view comes from: 1 from the right (a later segment), -1 from the left, 0 (a fade only). Pure. */
export const slideDir = (from: number, to: number): number => (to > from ? 1 : to < from ? -1 : 0);

/** Of the pulsing rings on screen, in page order, the ones that keep still: all after the first `max`. Pure. */
export const pulseSurplus = <T>(onScreenInOrder: readonly T[], max = MAX_PULSES): T[] => onScreenInOrder.slice(max);

type Box = { x: number; y: number; w: number; h: number };

let copiedRules: CSSStyleSheet | null | undefined;
/** The page's own style rules as one sheet a copy's shadow tree can wear (made once). `:root[data-theme="dark"]` becomes `:host-context(...)`. */
function ghostSheet(doc: Document): CSSStyleSheet | null {
  if (copiedRules !== undefined) return copiedRules;
  try {
    const text = [...doc.styleSheets]
      .flatMap((s) => {
        try {
          return [...s.cssRules].map((r) => r.cssText);
        } catch {
          return [];
        }
      })
      .join("\n")
      .replace(/:root\[data-theme="dark"\]/g, ':host-context([data-theme="dark"])');
    copiedRules = new CSSStyleSheet();
    copiedRules.replaceSync(text);
  } catch {
    copiedRules = null;
  }
  return copiedRules;
}
let still: CSSStyleSheet | undefined;
/** The copy replays nothing of its own (entrances, loops, transitions). */
function quietSheet(): CSSStyleSheet {
  if (!still) {
    still = new CSSStyleSheet();
    still.replaceSync("*, *::before, *::after { animation: none !important; transition: none !important; }");
  }
  return still;
}

function installTabSlide(doc: Document): () => void {
  const lastBox = new Map<string, Box>();
  const keyOf = (list: Element) => (list.classList.contains("view-tabs") ? "view-tabs" : "plan-order");
  const tabsOf = (list: Element) => [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  const setBox = (list: HTMLElement, b: Box) => {
    const v = { "--ind-x": `${b.x}px`, "--ind-y": `${b.y}px`, "--ind-w": `${b.w}px`, "--ind-h": `${b.h}px` };
    for (const [k, val] of Object.entries(v)) if (list.style.getPropertyValue(k) !== val) list.style.setProperty(k, val);
  };
  const place = (list: HTMLElement) => {
    const on = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!on || on.offsetWidth === 0) return;
    const box = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
    const key = keyOf(list);
    if (!list.classList.contains("has-ind")) {
      // A list drawn anew (the Plan's order is drawn again by each of its views) starts where the last one's highlight ended, then moves.
      const from = lastBox.get(key);
      setBox(list, from && !reducedMotion() ? from : box);
      list.classList.add("has-ind");
      void list.offsetWidth;
    }
    setBox(list, box);
    lastBox.set(key, box);
  };
  const placeAll = () => doc.querySelectorAll<HTMLElement>(TABLISTS).forEach(place);
  let frame = 0;
  const later = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      placeAll();
    });
  };
  let clear: ReturnType<typeof setTimeout> | undefined;
  const onPress = (e: Event) => {
    const tab = (e.target as Element | null)?.closest?.<HTMLElement>('[role="tab"]');
    const list = tab?.closest<HTMLElement>(TABLISTS);
    if (!tab || !list || tab.getAttribute("aria-selected") === "true" || reducedMotion()) return;
    const tabs = tabsOf(list);
    const from = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    // A tab that opens a window over the view (the Pano), or shuts it: the view behind never changed.
    if ([tab, tabs[from]].some((t) => t?.getAttribute("aria-haspopup") === "dialog")) return;
    const dir = slideDir(from, tabs.indexOf(tab));
    doc.documentElement.style.setProperty("--tab-dir", String(dir));
    clearTimeout(clear);
    clear = setTimeout(() => doc.documentElement.style.removeProperty("--tab-dir"), DIR_MS);
    // The view being left stays as a still copy that fades (120 ms, e-in) while the new one is drawn: the app takes it out at once. The copy
    // lives in a closed shadow tree (the page's own rules copied into it), so no query or test of the page ever finds a second plan.
    const sheet = ghostSheet(doc);
    if (!sheet) return;
    for (const el of doc.querySelectorAll<HTMLElement>(VIEW_CONTENT)) {
      const panel = el.closest<HTMLElement>(".panel");
      const r = el.getBoundingClientRect();
      if (!panel || r.width === 0 || r.height === 0) continue;
      const p = panel.getBoundingClientRect();
      const host = doc.createElement("div");
      host.className = "mv-ghost";
      host.setAttribute("aria-hidden", "true");
      Object.assign(host.style, { position: "absolute", margin: "0", pointerEvents: "none", zIndex: "4", left: `${r.left - p.left + panel.scrollLeft}px`, top: `${r.top - p.top + panel.scrollTop}px`, width: `${r.width}px`, height: `${r.height}px`, overflow: "hidden" });
      const shadow = host.attachShadow({ mode: "closed" });
      shadow.adoptedStyleSheets = [sheet, quietSheet()];
      // the box the page's rules expect around a view: .panel (a query container as wide as the view)
      const frame = doc.createElement("div");
      frame.className = "panel";
      frame.style.cssText = `padding:0;background:none;overflow:visible;width:${r.width}px;`;
      const copy = el.cloneNode(true) as HTMLElement;
      copy.removeAttribute("id");
      copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      frame.appendChild(copy);
      shadow.appendChild(frame);
      panel.appendChild(host);
      host.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-dir * 8}px)` }], { duration: GHOST_MS, easing: "cubic-bezier(.5, 0, .75, 0)", fill: "forwards" });
      setTimeout(() => host.remove(), GHOST_MS + 60);
    }
  };
  const observer = new MutationObserver(later);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected"] });
  doc.addEventListener("click", onPress, true);
  addEventListener("resize", later);
  later();
  return () => {
    observer.disconnect();
    doc.removeEventListener("click", onPress, true);
    removeEventListener("resize", later);
    cancelAnimationFrame(frame);
    clearTimeout(clear);
  };
}

function installBannerExit(doc: Document): () => void {
  const observer = new MutationObserver((records) => {
    if (reducedMotion()) return;
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (!(node instanceof HTMLElement) || !node.matches(BANNERS) || node.classList.contains("mv-banner-out")) continue;
        const parent = record.target as Element;
        if (!parent.isConnected) continue;
        const copy = node.cloneNode(true) as HTMLElement;
        copy.removeAttribute("role");
        copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
        copy.classList.add("mv-banner-out");
        copy.setAttribute("aria-hidden", "true");
        copy.inert = true;
        const next = record.nextSibling && record.nextSibling.parentNode === parent ? record.nextSibling : null;
        parent.insertBefore(copy, next);
        // It is pulled up out of the page: what is under it follows by the height it leaves.
        copy.style.setProperty("--mv-pull", `${-copy.offsetHeight}px`);
        setTimeout(() => copy.remove(), BANNER_OUT_MS + 60);
      }
    }
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function installPulseCap(doc: Document): () => void {
  if (typeof IntersectionObserver !== "function") return () => {};
  const onScreen = new Set<Element>();
  const watched = new Set<Element>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) onScreen.add(e.target);
      else onScreen.delete(e.target);
    }
    apply();
  });
  function apply() {
    const shown = [...onScreen].filter((el) => el.isConnected).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const still = new Set(pulseSurplus(shown));
    for (const el of watched) {
      if (still.has(el)) el.setAttribute("data-np", "");
      else el.removeAttribute("data-np");
    }
  }
  let frame = 0;
  const scan = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const now = new Set(doc.querySelectorAll(PULSERS));
      for (const el of now) if (!watched.has(el)) (watched.add(el), io.observe(el));
      for (const el of [...watched]) {
        if (now.has(el)) continue;
        watched.delete(el);
        onScreen.delete(el);
        io.unobserve(el);
      }
      apply();
    });
  };
  const observer = new MutationObserver(scan);
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  scan();
  return () => {
    observer.disconnect();
    io.disconnect();
    cancelAnimationFrame(frame);
  };
}

/** Puts all of them on the page (call once at start). Returns the undo. */
export function installHareketDili(doc: Document = document): () => void {
  if (typeof MutationObserver !== "function") return () => {};
  const off = [installTabSlide(doc), installBannerExit(doc), installPulseCap(doc)];
  return () => off.forEach((f) => f());
}

/** The small tick that is stamped on a card that has just been read in (m-iskelet): big first, pressed down (app.css `mv-stamp`, 420 ms). */
export const TICK_STAY_MS = 1300;
export function stampTick(el: Element | null, doc: Document = document): void {
  if (!el || reducedMotion()) return;
  const r = el.getBoundingClientRect();
  const view = doc.defaultView?.innerHeight ?? 0;
  if (r.width === 0 || r.bottom < 0 || r.top > view) return;
  const tick = doc.createElement("span");
  tick.className = "mv-tick";
  tick.setAttribute("aria-hidden", "true");
  tick.textContent = "✓";
  tick.style.left = `${Math.max(8, r.right - 36)}px`;
  tick.style.top = `${Math.min(Math.max(8, r.top + 10), view - 30)}px`;
  doc.body.appendChild(tick);
  setTimeout(() => tick.remove(), TICK_STAY_MS);
}
