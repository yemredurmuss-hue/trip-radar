// "Sihirli açılış" (docs/mockups/sihirli-acilis): when a trip's Plan opens for the first time in a browser session, the assistant's
// mascot leaves its seat in the chat for the border of the board, winks (slowly enough to be seen) and sends a burst of sparks; what is in
// view builds itself in reading order (pıt pıt) while it watches; it flies home; then the panel glides down on its own and everything below
// the fold pops in as it comes into view, and the panel glides back to the top (Emre, 2026-10-10). Nothing moves from its place: only
// opacity, a small transform, a blur and light, through the Web Animations API on the pieces found by their existing classes. A piece that
// is not there is skipped, and any touch, key or wheel ends it at once (the panel stays where it is then). No motion at all for
// "azaltılmış hareket".
import { reducedMotion } from "./motion";

export type Kind = "fade" | "photo" | "wipe" | "pop" | "rise" | "bar" | "glint" | "stop" | "line" | "card";

/** How long to wait, after a piece starts, before the next starts (ms). */
export const GAP: Record<Kind, number> = { fade: 70, photo: 160, wipe: 120, rise: 90, pop: 80, bar: 40, glint: 70, stop: 90, line: 60, card: 140 };
/** The last piece starts no later than this after the first, so the whole thing stays under about 2.5 s. */
export const MAX_START = 1700;

/** The mascot's part, in ms from the start: out of its seat, a slow wink, the burst; then pıt pıt starts. */
export const PHASE = { out: 100, wink: 800, burst: 1850, fill: 1900 } as const;
/** The panel glides down at this speed (px per ms), and never faster than MIN_GLIDE or slower than MAX_GLIDE in all. */
export const GLIDE_SPEED = 0.45;
export const MIN_GLIDE = 1200;
export const MAX_GLIDE = 5000;
/** At least this long between two pieces popping in while the panel glides (ms). */
export const GLIDE_GAP = 110;

/** How long the glide down takes for a distance in px. Pure. */
export const glideTime = (distance: number) => Math.round(Math.min(MAX_GLIDE, Math.max(MIN_GLIDE, Math.abs(distance) / GLIDE_SPEED)));
/** Ease in and out (0..1 → 0..1). Pure. */
export const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/** The start time of each piece, in order, from the beat of its kind; scaled down when the whole would run past MAX_START. Pure. */
export function schedule(kinds: readonly Kind[], max = MAX_START): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const k of kinds) {
    starts.push(t);
    t += GAP[k] ?? 80;
  }
  const last = starts.at(-1) ?? 0;
  const k = last > max ? max / last : 1;
  return starts.map((s) => Math.round(s * k));
}

// --- when it plays ---------------------------------------------------------------------------------------------------

export const openedKey = (tripId: string) => `trip-radar:opened:${tripId}`;
/** A switch for tests and for anyone who doesn't want it: set to "1" in sessionStorage and the opening never plays. */
export const OFF_KEY = "trip-radar:opening-off";

type Store = Pick<Storage, "getItem" | "setItem">;
const session = (): Store | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * True once per trip per browser session (and marks it): the first time its Plan is open. Never again on a tab switch, a re-render or a
 * reload in the same session; never while the off switch is set. Without storage it plays once per page load (nothing can be told apart).
 */
export function claimOpening(tripId: string, store: Store | null = session()): boolean {
  try {
    if (store?.getItem(OFF_KEY) === "1") return false;
    if (store?.getItem(openedKey(tripId))) return false;
    store?.setItem(openedKey(tripId), "1");
  } catch {
    /* no storage: play */
  }
  return true;
}

// --- the pieces, in reading order -----------------------------------------------------------------------------------------

interface Piece {
  el: HTMLElement;
  kind: Kind;
  /** Below the panel's view when it starts: it waits, hidden, until the glide brings it into view. */
  below?: boolean;
  /** A booked card: its tick stamps shortly after. */
  stamp?: boolean;
  /** A figure inside (the counters) that counts up from 0. */
  count?: boolean;
}

const all = (root: ParentNode, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const drawn = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
/** The board's scrolling panel (the Plan scrolls inside it, the page doesn't). */
export const panelOf = (root: ParentNode = document) => root.querySelector<HTMLElement>(".panel");

/** What the Plan view holds that can build itself, in the order it is read. Whatever is not in the page is not in the list. */
export function findPieces(root: ParentNode = document): Piece[] {
  const out: Piece[] = [];
  const add = (sel: string, kind: Kind, extra: Partial<Piece> = {}) => all(root, sel).forEach((el) => out.push({ el, kind, ...extra }));
  add(".view-tabs", "fade");
  add(".hx .hx-photo", "photo");
  add(".hx .hx-story h1", "wipe");
  add(".hx .hx-when", "rise");
  add(".hx .hx-lead", "rise");
  add(".hx .hx-tally button", "pop", { count: true });
  add(".hx .hx-progress", "rise");
  add(".hx .hx-progress .hx-bar", "bar");
  for (const block of all(root, ".hx .hx-side > .hx-block")) {
    const minis = [...block.querySelectorAll<HTMLElement>(".hx-minis > *")];
    const weather = [...block.querySelectorAll<HTMLElement>(".hx-weather > span")];
    if (minis.length) minis.forEach((el) => out.push({ el, kind: "glint" }));
    else {
      out.push({ el: block, kind: "rise" });
      weather.forEach((el) => out.push({ el, kind: "glint" }));
    }
  }
  for (const item of all(root, ".ts-strip > li")) {
    const stop = item.querySelector<HTMLElement>(".ts-stop");
    const hop = item.querySelector<HTMLElement>(".ts-hop");
    if (stop) out.push({ el: stop, kind: "stop" });
    if (hop) out.push({ el: hop, kind: "line" });
  }
  for (const sec of all(root, ".cat-plan .cat-sec")) {
    out.push({ el: sec, kind: "rise" });
    for (const card of sec.querySelectorAll<HTMLElement>(".pk-card, .ac-row, .it-tile")) out.push({ el: card, kind: "card", stamp: card.classList.contains("pk-booked") });
  }
  // Everything drawn takes part; what is below the panel's view waits for the glide. A piece inside one that is hidden is skipped with it.
  const view = panelOf(root)?.getBoundingClientRect();
  const bottom = view ? view.bottom : window.innerHeight;
  return out.filter((p) => p.el.isConnected && drawn(p.el)).map((p) => ({ ...p, below: p.el.getBoundingClientRect().top > bottom - 24 }));
}

// --- the run -----------------------------------------------------------------------------------------------------------------

const EASE = "cubic-bezier(.2,.8,.2,1)";
const SPRING = "cubic-bezier(.2,.9,.3,1.25)";
const FLY = "cubic-bezier(.5,0,.3,1)";

export interface Run {
  /** Everything at its final state now. */
  finish: () => void;
}

/**
 * Plays the opening over the Plan view in `doc`. `seat` is where the mascot sits in the chat (its copy leaves from there); without it only
 * pıt pıt plays. Returns a handle to end it at once; it ends itself when done.
 */
export function playOpening(doc: Document = document): Run | null {
  if (reducedMotion()) return null;
  const pieces = findPieces(doc);
  if (!pieces.length) return null;
  const anims: Animation[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const nodes: HTMLElement[] = [];
  const restores: (() => void)[] = [];
  const later = (fn: () => void, ms: number) => void timers.push(setTimeout(fn, ms));
  // (pieces of the page hold their first frame while they wait and go back to their own style after; what is drawn only for the show holds its last)
  const anim = (el: Element, frames: Keyframe[], ms: number, easing = EASE, delay = 0, fill: FillMode = "backwards") => {
    const a = el.animate(frames, { duration: ms, delay, easing, fill });
    anims.push(a);
    return a;
  };
  const layer = doc.createElement("div");
  layer.className = "op-fx";
  layer.setAttribute("aria-hidden", "true");
  doc.body.appendChild(layer);
  nodes.push(layer);

  const sparks = (x: number, y: number, n: number, far: boolean, delay = 0) => {
    for (let i = 0; i < n; i++) {
      const s = doc.createElement("span");
      const star = i % 3 === 0;
      s.className = star ? "op-star" : "op-spark";
      if (star) s.textContent = "✦";
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      layer.appendChild(s);
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const d = (far ? 46 : 18) + Math.random() * (far ? 40 : 22);
      const a = s.animate(
        [{ transform: "translate(-50%,-50%) scale(.4)", opacity: 1 }, { transform: `translate(${Math.cos(ang) * d - 3}px,${Math.sin(ang) * d - 3}px) scale(1)`, opacity: 0 }],
        { duration: far ? 820 : 620, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" },
      );
      anims.push(a);
      a.onfinish = () => s.remove();
    }
  };
  const glint = (el: HTMLElement, delay: number) => {
    const r = el.getBoundingClientRect();
    const box = doc.createElement("span");
    box.className = "op-glint";
    Object.assign(box.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: getComputedStyle(el).borderRadius });
    const bar = doc.createElement("i");
    box.appendChild(bar);
    layer.appendChild(box);
    const a = bar.animate([{ transform: "translateX(-120%)" }, { transform: "translateX(120%)" }], { duration: 900, delay, easing: "ease-out", fill: "both" });
    anims.push(a);
    a.onfinish = () => box.remove();
  };
  const countUp = (el: HTMLElement, delay: number) => {
    // The figure at the start of the counter's words ("2 uçuş"); the node is written back exactly as it was, unless the page changed it meanwhile.
    const node = [...el.querySelectorAll("span")].flatMap((s) => [...s.childNodes]).find((n) => n.nodeType === Node.TEXT_NODE && /^\s*\d+/.test(n.textContent ?? ""));
    if (!node) return;
    const text = node.textContent ?? "";
    const to = Number(/^\s*(\d+)/.exec(text)![1]);
    if (!to) return;
    let written = text.replace(/\d+/, "0");
    node.textContent = written;
    const start = performance.now() + delay;
    let frame = 0;
    const restore = () => {
      cancelAnimationFrame(frame);
      if (node.textContent === written) node.textContent = text;
    };
    restores.push(restore);
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / 650));
      if (node.textContent !== written) return; // the page wrote something of its own: leave it
      if (k < 1) {
        written = text.replace(/\d+/, String(Math.round(to * (1 - (1 - k) ** 3))));
        node.textContent = written;
        frame = requestAnimationFrame(step);
      } else restore();
    };
    frame = requestAnimationFrame(step);
  };

  // How one piece comes in, starting `d` ms from now.
  const enter = (p: Piece, d: number) => {
    const el = p.el;
    switch (p.kind) {
      case "photo":
        anim(el, [{ opacity: 0, scale: "1.05", filter: "blur(14px)" }, { opacity: 1, scale: "1", filter: "blur(0)" }], 700, EASE, d);
        break;
      case "wipe":
        anim(el, [{ opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0 0 0)" }], 520, EASE, d);
        break;
      case "pop":
      case "stop":
        anim(el, [{ opacity: 0, scale: ".6" }, { opacity: 1, scale: "1.08", offset: 0.7 }, { opacity: 1, scale: "1" }], 420, SPRING, d);
        if (p.count) countUp(el, d);
        break;
      case "bar":
      case "line": {
        const before = el.style.transformOrigin;
        el.style.transformOrigin = "left center";
        restores.push(() => (el.style.transformOrigin = before));
        anim(el, [{ opacity: 1, scale: "0 1" }, { opacity: 1, scale: "1 1" }], p.kind === "bar" ? 750 : 320, EASE, d);
        break;
      }
      case "glint":
        anim(el, [{ opacity: 0 }, { opacity: 1 }], 260, EASE, d);
        later(() => glint(el, 0), d + 120);
        break;
      case "card":
        anim(el, [{ opacity: 0, translate: "0 -14px", scale: ".97" }, { opacity: 1, translate: "0 0", scale: "1" }], 460, SPRING, d);
        later(() => {
          const r = el.getBoundingClientRect();
          sparks(r.right - 18, r.top + 10, 7, false);
        }, d + 260);
        if (p.stamp) {
          const tick = el.querySelector<HTMLElement>(".pk-stamp") ?? el.querySelector<HTMLElement>(".pk-ring.done");
          if (tick) anim(tick, [{ scale: "1.9", opacity: 0 }, { scale: ".9", opacity: 1, offset: 0.7 }, { scale: "1", opacity: 1 }], 380, SPRING, d + 380);
        }
        break;
      case "rise":
        anim(el, [{ opacity: 0, translate: "0 10px" }, { opacity: 1, translate: "0 0" }], 380, EASE, d);
        break;
      default:
        anim(el, [{ opacity: 0 }, { opacity: 1 }], 300, EASE, d);
    }
  };

  // 1 · what is in view: pıt pıt, once the mascot has winked.
  const inView = pieces.filter((p) => !p.below);
  const below = pieces.filter((p) => p.below);
  const starts = schedule(inView.map((p) => p.kind));
  inView.forEach((p, i) => enter(p, PHASE.fill + starts[i]));
  const filled = PHASE.fill + (starts.at(-1) ?? 0) + 520;
  // What is below waits, hidden, for the glide (its own style comes back at the end, whatever happens).
  below.forEach((p) => {
    const before = p.el.style.opacity;
    p.el.style.opacity = "0";
    restores.push(() => (p.el.style.opacity = before));
  });

  // 2 · the mascot: out to the border of the board, bigger; a slow wink; a burst; it watches while the screen fills; home again.
  let home = 0; // when it is back in its seat
  const seat = doc.querySelector<HTMLElement>("[data-mascot-seat]");
  const chat = doc.querySelector<HTMLElement>(".chat");
  if (seat && chat) {
    const seatSvg = seat.querySelector("svg");
    const sr = seat.getBoundingClientRect();
    const at = { x: sr.left + sr.width / 2 - 23, y: sr.top + sr.height / 2 - 23 };
    const border = { x: chat.getBoundingClientRect().right - 23, y: sr.top + 80 };
    if (seatSvg && sr.width > 0) {
      const orb = doc.createElement("span");
      orb.className = "op-orb";
      const inner = doc.createElement("span");
      inner.className = "op-orb-in ms-wrap";
      inner.dataset.state = "hold";
      // (its own gradient id: two of the same id in one page would be one definition)
      inner.innerHTML = seatSvg.outerHTML.replace(/id="([^"]+)"/g, 'id="$1-orb"').replace(/url\(#([^)]+)\)/g, "url(#$1-orb)");
      orb.appendChild(inner);
      layer.appendChild(orb);
      const tr = (p: { x: number; y: number }) => `translate(${p.x}px,${p.y}px)`;
      const fly = (from: typeof at, to: typeof at, ms: number, arc: number, delay: number) =>
        anim(orb, [{ transform: tr(from) }, { transform: tr({ x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - arc }), offset: 0.5 }, { transform: tr(to) }], ms, FLY, delay, "both");
      seat.classList.add("away");
      restores.push(() => seat.classList.remove("away"));
      // it starts exactly where the seat is, at the seat's size (34 of 46 px)
      orb.style.transform = tr(at);
      anim(inner, [{ transform: "scale(.74)" }, { transform: "scale(1.5)" }], 600, SPRING, PHASE.out, "both");
      fly(at, border, 560, 24, PHASE.out);
      // The wink: a beat with both eyes open, the right eye closes, stays closed, opens; the head tilts with it.
      const eye = inner.querySelector(".eye.r");
      if (eye) anim(eye, [{ transform: "scaleY(1)" }, { transform: "scaleY(1)", offset: 0.2 }, { transform: "scaleY(.1)", offset: 0.38 }, { transform: "scaleY(.1)", offset: 0.72 }, { transform: "scaleY(1)" }], 1000, "ease-in-out", PHASE.wink, "both");
      anim(inner, [{ transform: "scale(1.5) rotate(0)" }, { transform: "scale(1.55) rotate(-10deg)", offset: 0.4 }, { transform: "scale(1.55) rotate(-10deg)", offset: 0.7 }, { transform: "scale(1.5) rotate(0)" }], 1000, EASE, PHASE.wink, "both");
      later(() => {
        sparks(border.x + 50, border.y + 23, 14, true);
        inner.dataset.state = "work";
      }, PHASE.burst);
      // home once what is in view has filled, smiling
      later(() => (inner.dataset.state = "done"), filled);
      fly(border, at, 680, 50, filled);
      anim(inner, [{ transform: "scale(1.5)" }, { transform: "scale(.74)" }], 680, SPRING, filled, "both");
      home = filled + 700;
      later(() => {
        orb.style.visibility = "hidden";
        seat.classList.remove("away");
        anim(seatSvg, [{ transform: "scale(1.35)" }, { transform: "scale(.92)", offset: 0.6 }, { transform: "scale(1)" }], 360, SPRING);
      }, home);
    }
  }

  // 3 · the glide: the panel slides down on its own; each piece below pops in as it comes into view; then back to the top.
  const panel = panelOf(doc);
  let frame = 0;
  let done = false;
  const glide = (from: number, to: number, ms: number, onFrame: () => void, then: () => void) => {
    const t0 = performance.now();
    const step = (now: number) => {
      if (done || !panel) return;
      const k = Math.min(1, (now - t0) / ms);
      panel.scrollTop = from + (to - from) * easeInOut(k);
      onFrame();
      if (k < 1) frame = requestAnimationFrame(step);
      else then();
    };
    frame = requestAnimationFrame(step);
  };
  const waiting = [...below];
  let nextAt = 0;
  const popInView = () => {
    if (!panel) return;
    const edge = panel.getBoundingClientRect().bottom - 40;
    const now = performance.now();
    while (waiting.length && now >= nextAt && waiting[0].el.getBoundingClientRect().top < edge) {
      const p = waiting.shift()!;
      p.el.style.opacity = "";
      enter(p, 0);
      nextAt = now + (p.kind === "card" ? GLIDE_GAP : GLIDE_GAP / 2);
    }
  };
  const finishAll = () => later(finish, 0);
  later(() => {
    if (!panel || !below.length) return finishAll();
    const top = panel.scrollTop;
    const bottom = Math.max(top, panel.scrollHeight - panel.clientHeight);
    glide(top, bottom, glideTime(bottom - top), popInView, () => {
      // anything still waiting comes in now, one after another, then a breath at the bottom and back up
      const rest = () => {
        if (done) return;
        nextAt = 0;
        popInView();
        if (waiting.length) {
          const p = waiting.shift()!;
          p.el.style.opacity = "";
          enter(p, 0);
          return later(rest, GLIDE_GAP);
        }
        later(() => glide(panel.scrollTop, top, 900, () => {}, () => later(finish, 300)), 700);
      };
      rest();
    });
  }, Math.max(filled, home) + 200);

  const stopEvents = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    anims.forEach((a) => {
      a.onfinish = null;
      try {
        a.cancel();
      } catch {
        /* gone */
      }
    });
    restores.forEach((r) => r());
    nodes.forEach((n) => n.remove());
    stopEvents.forEach((e) => doc.removeEventListener(e, finish, true));
  };
  stopEvents.forEach((e) => doc.addEventListener(e, finish, { capture: true, passive: true }));
  // a last guard: whatever happens, it is over within half a minute
  later(finish, 30000);
  return { finish };
}
