// "Sihirli açılış" (docs/mockups/acilis-v2, B · Ritim ve sayaçlar, Emre 2026-10-10): the first time a trip's Plan is ever opened (once per
// trip, kept in localStorage; the Pano has its own, with its strips' cards), what is in view comes in from the first frame, in reading order, each piece rising a little (pıt pıt), and the
// counters count up from 0; it is all in within about a second. What is below the fold comes in once, as the traveller scrolls it into view:
// the panel never scrolls on its own. Only opacity and transform move (cheap for the browser), nothing waits for anything (a photo, the
// weather, prices arrive when they arrive), and a touch or key ends it at once. No motion at all for "azaltılmış hareket".
//
// Which pieces: whatever the page marks, so a new design takes part by marking its own (no class names here).
//   data-pit             this element comes in ("bar": its fills grow from the left; "line": it draws from the left)
//   data-pit-children    each child comes in; a child that is a grid (a section's cards) brings its own children one by one
//   data-pit-beat        (with data-pit-children) its children keep the full beat between them however much the rest is
//                        squeezed: the hero's mosaic tiles, 80 ms apart (E10)
//   data-pit-photo       the hero photo: left as it is when it was carried in from the trip's card (viewTransition.ts)
//   data-count           the first number in its text counts up from 0 as its piece comes in
// With no mark at all on the page, the panel's own blocks come in.
//
// On top of that, a short flourish (Emre, 2026-10-13, "orb, kıvılcım, ışıltı geri gelsin"): the assistant's mascot leaves its seat in the chat as
// a small orb for the border of the board, a burst of sparks and stars goes off there, a glint sweeps over the counters, and the orb is home
// again, all within FLOURISH_MS. It is drawn in a layer of its own over the page and never moves a piece; the old slow wink and the panel's
// glide down stay gone. It ends with the opening, at a touch, or by itself.
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

/** The flourish, in ms from the start: the orb is out at the border by `burst`, leaves it at `back`, and is home when it is over. */
export const FLOURISH = { burst: 260, back: 560 } as const;
export const FLOURISH_MS = 900;
/** The sparks of a burst: how many, and how long they fly (ms). */
export const SPARKS = 14;
export const SPARK_MS = 600;

/**
 * How long the flourish's layer still waits at its end (ms from `now`): none, unless a burst went off late (a frame held up
 * on a busy machine) and its sparks are still flying until `sparksOut`; a slow frame never swallows the burst. Pure.
 */
export const layerLeft = (now: number, sparksOut: number | null): number => (sparksOut == null ? 0 : Math.max(0, Math.ceil(sparksOut - now)));
/** A glint sweeps only the counters that start within this long (ms), so it is over with the rest. */
export const GLINT_UNTIL = 300;
export const GLINT_MS = 560;

/** The `n` sparks of a burst as flight vectors (dx, dy in px), spread around the full circle and a little uneven. Pure given `rand`. */
export function sparkVectors(n: number, far = 46, rand: () => number = Math.random): { dx: number; dy: number }[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n + rand() * 0.5;
    const d = far + rand() * far * 0.8;
    return { dx: Math.round(Math.cos(angle) * d), dy: Math.round(Math.sin(angle) * d) };
  });
}

/** The start time of each of `n` pieces, in order, on the beat; squeezed when the whole would run past `max`. Pure. */
export function schedule(n: number, gap = GAP, max = MAX_START): number[] {
  const last = (n - 1) * gap;
  const k = last > max ? max / last : 1;
  return Array.from({ length: Math.max(0, n) }, (_, i) => Math.round(i * gap * k));
}

/**
 * The start times as `schedule` gives them, except that the pieces of one beat group (E10: the mosaic's tiles; the same
 * number in `groups`, null for none) keep the full `gap` between them from where the first of them starts. Pure.
 */
export function scheduleBeats(groups: readonly (number | null)[], gap = GAP, max = MAX_START): number[] {
  const starts = schedule(groups.length, gap, max);
  const firstOf = new Map<number, { at: number; n: number }>();
  return starts.map((t, i) => {
    const g = groups[i];
    if (g == null) return t;
    const first = firstOf.get(g);
    if (!first) {
      firstOf.set(g, { at: t, n: 1 });
      return t;
    }
    return first.at + first.n++ * gap;
  });
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

// --- the flourish: orb, sparks, glint -----------------------------------------------------------------------------------

const SPRING = "cubic-bezier(.2,.9,.3,1.25)";
const FLY = "cubic-bezier(.5,0,.3,1)";

/**
 * The orb, its sparks and a glint over `counters` (each with the delay its piece starts at). Returns what ends it at once; it ends itself at
 * FLOURISH_MS. Without the chat's seat on the page (a narrow screen) only the glint plays. Nothing of the page moves.
 */
function flourish(doc: Document, counters: { el: HTMLElement; delay: number }[]): () => void {
  const anims: Animation[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const layer = doc.createElement("div");
  layer.className = "op-fx";
  layer.setAttribute("aria-hidden", "true");
  doc.body.appendChild(layer);
  const later = (fn: () => void, ms: number) => void timers.push(setTimeout(fn, ms));
  let sparksOut: number | null = null;
  const anim = (el: Element, keyframes: Keyframe[], ms: number, easing: string, delay = 0) => {
    const a = el.animate(keyframes, { duration: ms, delay, easing, fill: "both" });
    anims.push(a);
    return a;
  };

  const burst = (x: number, y: number) => {
    sparkVectors(SPARKS).forEach(({ dx, dy }, i) => {
      const star = i % 3 === 0;
      const s = doc.createElement("span");
      s.className = star ? "op-star" : "op-spark";
      if (star) s.textContent = "✦";
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      layer.appendChild(s);
      anim(s, [{ transform: "translate(-50%,-50%) scale(.4)", opacity: 1 }, { transform: `translate(calc(${dx}px - 50%),calc(${dy}px - 50%)) scale(1)`, opacity: 0 }], SPARK_MS, "cubic-bezier(.2,.7,.3,1)");
    });
    sparksOut = performance.now() + SPARK_MS;
  };
  const glint = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const box = doc.createElement("span");
    box.className = "op-glint";
    Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: getComputedStyle(el).borderRadius });
    const bar = doc.createElement("i");
    box.appendChild(bar);
    layer.appendChild(box);
    anim(bar, [{ transform: "translateX(-120%)" }, { transform: "translateX(120%)" }], GLINT_MS, "ease-out");
  };
  counters.filter((c) => c.delay <= GLINT_UNTIL).forEach((c) => later(() => glint(c.el), c.delay + 120));

  // The orb: a copy of the mascot at the seat's size, out to the board's border, a burst there, home again smiling.
  const seat = doc.querySelector<HTMLElement>("[data-mascot-seat]");
  const chat = doc.querySelector<HTMLElement>(".chat");
  const svg = seat?.querySelector("svg");
  const sr = seat?.getBoundingClientRect();
  if (seat && chat && svg && sr && sr.width > 0 && sr.height > 0) {
    const at = { x: sr.left + sr.width / 2 - 23, y: sr.top + sr.height / 2 - 23 };
    const border = { x: chat.getBoundingClientRect().right - 23, y: sr.top + 60 };
    const orb = doc.createElement("span");
    orb.className = "op-orb";
    const inner = doc.createElement("span");
    inner.className = "op-orb-in ms-wrap";
    inner.dataset.state = "hold";
    // (its own gradient id: two of the same id in one page would be one definition)
    inner.innerHTML = svg.outerHTML.replace(/id="([^"]+)"/g, 'id="$1-orb"').replace(/url\(#([^)]+)\)/g, "url(#$1-orb)");
    orb.appendChild(inner);
    layer.appendChild(orb);
    const tr = (p: { x: number; y: number }) => `translate(${p.x}px,${p.y}px)`;
    const fly = (from: typeof at, to: typeof at, ms: number, arc: number, delay: number) =>
      anim(orb, [{ transform: tr(from) }, { transform: tr({ x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - arc }), offset: 0.5 }, { transform: tr(to) }], ms, FLY, delay);
    seat.classList.add("away");
    orb.style.transform = tr(at);
    fly(at, border, FLOURISH.burst, 18, 0);
    anim(inner, [{ transform: "scale(.74)" }, { transform: "scale(1.4)" }], FLOURISH.burst, SPRING);
    later(() => {
      burst(border.x + 23, border.y + 23);
      inner.dataset.state = "done";
    }, FLOURISH.burst);
    fly(border, at, FLOURISH_MS - FLOURISH.back, 30, FLOURISH.back);
    anim(inner, [{ transform: "scale(1.4)" }, { transform: "scale(.74)" }], FLOURISH_MS - FLOURISH.back, SPRING, FLOURISH.back);
  }

  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    timers.forEach(clearTimeout);
    anims.forEach((a) => {
      try {
        a.cancel();
      } catch {
        /* gone */
      }
    });
    seat?.classList.remove("away");
    layer.remove();
  };
  const endOnceOut = () => {
    const left = layerLeft(performance.now(), sparksOut);
    if (left) later(endOnceOut, left);
    else end();
  };
  later(endOnceOut, FLOURISH_MS);
  return end;
}

// --- the run -----------------------------------------------------------------------------------------------------------------

const EASE = "cubic-bezier(.2,.8,.2,1)";

export interface Run {
  /** Everything at its final state now. */
  finish: () => void;
}

const countersOf = (el: HTMLElement) => [...(el.matches("[data-count]") ? [el] : []), ...el.querySelectorAll<HTMLElement>("[data-count]")];

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
    countersOf(el).forEach((c) => countUp(c, d));
  };

  // 1 · what is in view: pıt pıt, from the first frame.
  const panel = panelOf(doc);
  const bottom = (panel?.getBoundingClientRect().bottom ?? doc.defaultView?.innerHeight ?? 0) - 24;
  const inView = pieces.filter((p) => p.el.getBoundingClientRect().top < bottom);
  const below = pieces.filter((p) => p.el.getBoundingClientRect().top >= bottom);
  // E10: the mosaic's tiles keep their 80 ms between them (data-pit-beat), whatever the rest is squeezed to.
  const beats: HTMLElement[] = [];
  const starts = scheduleBeats(
    inView.map((p) => {
      const parent = p.el.parentElement;
      if (!parent?.hasAttribute("data-pit-beat")) return null;
      if (!beats.includes(parent)) beats.push(parent);
      return beats.indexOf(parent);
    }),
  );
  starts.forEach((t, i) => enter(inView[i], t));
  // (and the flourish over it: the orb, its sparks, a glint over the counters)
  const stopFlourish = flourish(doc, inView.flatMap((p, i) => countersOf(p.el).map((el) => ({ el, delay: starts[i] }))));

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
    stopFlourish();
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
  const inViewEnds = Math.max(MAX_START, ...starts) + Math.max(RISE_MS, COUNT_MS, BAR_MS) + 50;
  const settle = () => {
    clearTimeout(guard);
    guard = setTimeout(finish, inViewEnds);
  };
  stopEvents.forEach((e) => doc.addEventListener(e, finish, { capture: true, passive: true }));
  if (waiting.size) guard = setTimeout(finish, 30000);
  else settle();
  return { finish };
}
