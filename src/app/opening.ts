// "Sihirli açılış" (docs/mockups/acilis-v2, B · Ritim ve sayaçlar, Emre 2026-10-10): the first time a trip's Plan is ever opened (once per
// trip, kept in localStorage), what is in view comes in from the first frame, in reading order, each piece rising a little (pıt pıt), and the
// counters count up from 0; it is all in within about a second. What is below the fold comes in once, as the traveller scrolls it into view:
// the panel never scrolls on its own. Only opacity and transform move (cheap for the browser), nothing waits for anything (a photo, the
// weather, prices arrive when they arrive), and a touch or key ends it at once. No motion at all for "azaltılmış hareket".
//
// Which pieces: whatever the page marks, so a new design takes part by marking its own (no class names here).
//   data-pit             this element comes in ("bar": its fills grow from the left; "line": it draws from the left)
//   data-pit-children    each child comes in; a child that is a grid (a section's cards) brings its own children one by one
//   data-pit-photo       the hero photo: left as it is when it was carried in from the trip's card (viewTransition.ts)
//   data-count           the first number in its text counts up from 0 as its piece comes in
// With no mark at all on the page, the panel's own blocks come in.
import { reducedMotion } from "./motion";
import { photoCarried } from "./viewTransition";

/** The beat: each piece starts this long after the one before it (ms). */
export const GAP = 80;
/** The last piece in view starts no later than this after the first, so what is in view is in within about 0.75 s. */
export const MAX_START = 450;
/** How long one piece takes to rise in, a counter to count, a bar to fill (ms). */
export const RISE_MS = 300;
export const COUNT_MS = 520;
export const BAR_MS = 600;
/** Pieces scrolled into view together come in this far apart (ms). */
export const SCROLL_GAP = 45;

/** The start time of each of `n` pieces, in order, on the beat; squeezed when the whole would run past `max`. Pure. */
export function schedule(n: number, gap = GAP, max = MAX_START): number[] {
  const last = (n - 1) * gap;
  const k = last > max ? max / last : 1;
  return Array.from({ length: Math.max(0, n) }, (_, i) => Math.round(i * gap * k));
}

/** A counter's figure `k` of the way through (0..1): fast at first, settling on `to`. Pure. */
export const countAt = (to: number, k: number) => Math.round(to * (1 - (1 - Math.min(1, Math.max(0, k))) ** 3));

// --- when it plays ---------------------------------------------------------------------------------------------------

export const openedKey = (tripId: string) => `trip-radar:opened:${tripId}`;
/** A switch for tests and for anyone who doesn't want it: set to "1" in sessionStorage and the opening never plays. */
export const OFF_KEY = "trip-radar:opening-off";

type Store = Pick<Storage, "getItem" | "setItem">;
/** Where "already played" is kept: this browser's localStorage, so it plays once per trip, not once per session. */
const remembered = (): Store | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
const session = (): Store | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * True the first time a trip's Plan is open in this browser (and marks it): never again, not on a tab switch, a re-render, a reload or
 * a later session. Never while the off switch is set (in the session, as the tests set it, or in the store). Without storage it plays once
 * per page load (nothing can be told apart).
 */
export function claimOpening(tripId: string, store: Store | null = remembered(), offStore: Store | null = session()): boolean {
  try {
    if (offStore?.getItem(OFF_KEY) === "1" || store?.getItem(OFF_KEY) === "1") return false;
    if (store?.getItem(openedKey(tripId))) return false;
    store?.setItem(openedKey(tripId), "1");
  } catch {
    /* no storage: play */
  }
  return true;
}

// --- the pieces, in reading order -----------------------------------------------------------------------------------------

type How = "rise" | "bar" | "line";
interface Piece {
  el: HTMLElement;
  how: How;
}

/** The board's scrolling panel (the Plan scrolls inside it, the page doesn't). */
export const panelOf = (root: ParentNode = document) => root.querySelector<HTMLElement>(".panel");

const drawn = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
const kids = (el: Element) => [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
const isGrid = (el: Element) => getComputedStyle(el).display.includes("grid");
const howOf = (el: HTMLElement): How => (el.dataset.pit === "bar" ? "bar" : el.dataset.pit === "line" ? "line" : "rise");

/** What the Plan view marks to come in, in reading order (see the head of this file). Whatever is not drawn is left out. */
export function findPieces(root: ParentNode = document): Piece[] {
  const marked = [...root.querySelectorAll<HTMLElement>("[data-pit], [data-pit-children]")];
  const out: HTMLElement[] = [];
  if (marked.length) {
    for (const el of marked) {
      if (el.hasAttribute("data-pit")) out.push(el);
      if (!el.hasAttribute("data-pit-children")) continue;
      for (const child of kids(el)) {
        if (child.matches("[data-pit], [data-pit-children]")) continue; // it comes in by its own mark, in its place
        if (isGrid(child) && child.children.length > 1) out.push(...kids(child));
        else out.push(child);
      }
    }
  } else {
    // No marks: the panel's blocks, a block taller than most of the view brought in by its own blocks (three levels at most).
    const panel = panelOf(root);
    const tall = (panel?.clientHeight ?? window.innerHeight) * 0.6;
    const walk = (el: HTMLElement, depth: number) =>
      kids(el).forEach((c) => (depth < 3 && c.children.length > 1 && c.getBoundingClientRect().height > tall ? walk(c, depth + 1) : out.push(c)));
    if (panel) walk(panel, 0);
  }
  const seen = new Set<HTMLElement>();
  return out
    .filter((el) => !seen.has(el) && seen.add(el) && el.isConnected && drawn(el))
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((el) => ({ el, how: howOf(el) }));
}

// --- the run -----------------------------------------------------------------------------------------------------------------

const EASE = "cubic-bezier(.2,.8,.2,1)";

export interface Run {
  /** Everything at its final state now. */
  finish: () => void;
}

/** Plays the opening over the Plan view in `doc`. Returns a handle to end it at once; it ends itself once everything is in. */
export function playOpening(doc: Document = document): Run | null {
  if (reducedMotion()) return null;
  // (a trip opened from its card arrives with its photo already carried into the hero: it is not brought in again)
  const pieces = findPieces(doc).filter((p) => !(photoCarried() && p.el.hasAttribute("data-pit-photo")));
  if (!pieces.length) return null;
  const anims: Animation[] = [];
  const restores: (() => void)[] = [];
  const frames = new Set<number>();
  let done = false;
  const anim = (el: Element, keyframes: Keyframe[], ms: number, delay = 0) => {
    const a = el.animate(keyframes, { duration: ms, delay, easing: EASE, fill: "backwards" });
    anims.push(a);
    return a;
  };

  const countUp = (el: HTMLElement, delay: number) => {
    // The first number in its text; the node is written back exactly as it was, unless the page changed it meanwhile.
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node && !/\d/.test(node.textContent ?? "")) node = walker.nextNode();
    if (!node) return;
    const text = node.textContent ?? "";
    const to = Number(/\d+/.exec(text)![0]);
    if (!to) return;
    let written = text.replace(/\d+/, "0");
    node.textContent = written;
    const start = performance.now() + delay;
    let frame = 0;
    const restore = () => {
      cancelAnimationFrame(frame);
      frames.delete(frame);
      if (node!.textContent === written) node!.textContent = text;
    };
    restores.push(restore);
    const step = (now: number) => {
      frames.delete(frame);
      if (done || node!.textContent !== written) return; // the page wrote something of its own: leave it
      const k = (now - start) / COUNT_MS;
      if (k < 1) {
        written = text.replace(/\d+/, String(countAt(to, k)));
        node!.textContent = written;
        frame = requestAnimationFrame(step);
        frames.add(frame);
      } else restore();
    };
    frame = requestAnimationFrame(step);
    frames.add(frame);
  };

  // How one piece comes in, starting `d` ms from now; its counters count as it does.
  const enter = (p: Piece, d: number) => {
    const el = p.el;
    if (p.how === "rise") anim(el, [{ opacity: 0, translate: "0 8px" }, { opacity: 1, translate: "0 0" }], RISE_MS, d);
    else {
      const grow = p.how === "bar" ? kids(el) : [el];
      for (const g of grow) {
        const before = g.style.transformOrigin;
        g.style.transformOrigin = "left center";
        restores.push(() => (g.style.transformOrigin = before));
        anim(g, [{ scale: "0 1" }, { scale: "1 1" }], p.how === "bar" ? BAR_MS : RISE_MS, d);
      }
    }
    const counters = [...(el.matches("[data-count]") ? [el] : []), ...el.querySelectorAll<HTMLElement>("[data-count]")];
    counters.forEach((c) => countUp(c, d));
  };

  // 1 · what is in view: pıt pıt, from the first frame.
  const panel = panelOf(doc);
  const bottom = (panel?.getBoundingClientRect().bottom ?? doc.defaultView?.innerHeight ?? 0) - 24;
  const inView = pieces.filter((p) => p.el.getBoundingClientRect().top < bottom);
  const below = pieces.filter((p) => p.el.getBoundingClientRect().top >= bottom);
  schedule(inView.length).forEach((t, i) => enter(inView[i], t));

  // 2 · what is below waits, hidden, until it is scrolled into view (its own style comes back at the end, whatever happens).
  let io: IntersectionObserver | null = null;
  const waiting = new Set(below.map((p) => p.el));
  const show = (el: HTMLElement, before: string) => {
    el.style.opacity = before;
    waiting.delete(el);
  };
  for (const p of below) {
    const before = p.el.style.opacity;
    p.el.style.opacity = "0";
    restores.push(() => waiting.has(p.el) && show(p.el, before));
  }
  if (below.length && typeof IntersectionObserver === "function") {
    const byEl = new Map(below.map((p) => [p.el, p]));
    io = new IntersectionObserver(
      (entries) => {
        let n = 0;
        for (const e of entries) {
          const p = byEl.get(e.target as HTMLElement);
          if (!e.isIntersecting || !p || !waiting.has(p.el)) continue;
          io?.unobserve(p.el);
          show(p.el, "");
          enter(p, n++ * SCROLL_GAP);
        }
        if (!waiting.size) settle();
      },
      { root: panel, rootMargin: "0px 0px -24px 0px" },
    );
    below.forEach((p) => io!.observe(p.el));
  }

  const stopEvents = ["pointerdown", "keydown", "touchstart"] as const;
  let guard: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(guard);
    io?.disconnect();
    frames.forEach((f) => cancelAnimationFrame(f));
    anims.forEach((a) => {
      try {
        a.cancel();
      } catch {
        /* gone */
      }
    });
    restores.forEach((r) => r());
    stopEvents.forEach((e) => doc.removeEventListener(e, finish, true));
  };
  // Over once what is in view is in and nothing waits below; whatever still waits comes in at a touch, or after half a minute.
  const inViewEnds = MAX_START + Math.max(RISE_MS, COUNT_MS, BAR_MS) + 50;
  const settle = () => {
    clearTimeout(guard);
    guard = setTimeout(finish, inViewEnds);
  };
  stopEvents.forEach((e) => doc.addEventListener(e, finish, { capture: true, passive: true }));
  if (waiting.size) guard = setTimeout(finish, 30000);
  else settle();
  return { finish };
}
