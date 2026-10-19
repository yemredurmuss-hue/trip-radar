import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GHOST_MS, MAX_PULSES, pulseSurplus, slideDir, stampTick, TICK_STAY_MS } from "../src/app/hareketDili";
import { FOLD_MS, LATE_MS } from "../src/app/motion";
import { BUMP_MS, BUMP_SCALE, onScreen, SECTION_MARKS } from "../src/app/putFly";
import { addedCount, DONE_MS } from "../src/app/WorkPill";

// Hareket Dili (docs/mockups/artifact-arsivi/hareket-dili-P2qVN5, Emre's m-* decisions): the pure parts, and the values the F8b block of
// app.css carries (read as plain text: vitest runs in node).
const css = readFileSync("static/app.css", "utf8");
const f8b = css.slice(css.indexOf("/* -- F8b Hareket Dili"));
const plan = readFileSync("static/v82/plan.css", "utf8");

describe("m-sekme: tabs", () => {
  it("the new view comes from the side the later segment is on", () => {
    expect(slideDir(0, 1)).toBe(1);
    expect(slideDir(2, 0)).toBe(-1);
    expect(slideDir(1, 1)).toBe(0);
  });
  it("the highlight slides 260 ms e-out; the view comes in 12 px over 260 ms, the old one leaves in 120 ms e-in", () => {
    expect(f8b).toContain("transition: transform var(--t-base) var(--e-out), width var(--t-base) var(--e-out)");
    expect(css).toContain("@keyframes mv-tab-in { from { opacity: 0; transform: translateX(calc(var(--tab-dir, 0) * 12px)); } }");
    expect(css).toContain("animation: mv-tab-in var(--t-base) var(--e-out) backwards");
    expect(GHOST_MS).toBe(120);
    expect(css).toMatch(/--t-instant: 120ms; --t-quick: 180ms; --t-base: 260ms; --t-slow: 380ms; --t-story: 600ms;/);
  });
});

describe("m-bolum: a section folds on a grid", () => {
  it("rows 0fr to 1fr over 260 ms, the cards 80 ms late and 180 ms, shut at once", () => {
    expect(FOLD_MS).toBe(260);
    // v82: the category's body (static/v82/plan.css .q-fold, plan/Section.tsx).
    expect(plan).toContain(".q-fold { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--t-base) var(--e-out); }");
    expect(plan).toContain(".q-fold.on { grid-template-rows: 1fr; }");
    expect(plan).toContain(".q-fold-in > * { opacity: 0; transition: opacity var(--t-quick) var(--e-out); }");
    expect(plan).toContain(".q-fold.on > .q-fold-in > * { opacity: 1; transition-delay: 80ms; }");
  });
  it("the card's own opening (the Pano's detail) is the old rule, untouched", () => {
    expect(css).toContain(".pn-detail { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s var(--e-out)");
  });
});

describe("m-iskelet, m-isik, m-kurallar: waiting", () => {
  it("a wait under 0.4 s shows no skeleton, dots or turning mark", () => {
    expect(LATE_MS).toBe(400);
    expect(f8b).toContain(".thinking { animation: mv-fade var(--t-quick) var(--e-out) 400ms backwards; }");
  });
  it("the skeleton is dashed with a 1.3 s light; the real card sets in over 380 ms; the tick is stamped 420 ms", () => {
    expect(f8b).toContain("border: 1.5px dashed #ddd8ea");
    expect(f8b).toContain("animation-duration: 1.3s");
    expect(css).toContain(".ar-new { animation: mv-swap-in var(--t-slow) var(--e-out) both,");
    expect(f8b).toContain("@keyframes mv-swap-in { from { opacity: 0; transform: translateY(-6px) scale(.98); } }");
    expect(f8b).toMatch(/\.mv-tick \{[^}]*animation: mv-stamp 420ms cubic-bezier\(\.2, \.9, \.3, 1\.3\) both/);
    // the old row-over light stays
    expect(css).toContain("animation: mv-sweep 1.6s ease-in-out infinite");
  });
  it("the light along the top is 3 px, a third wide, 1.2 s a pass", () => {
    expect(f8b).toMatch(/\.work-line \{[^}]*height: 3px;/);
    expect(f8b).toMatch(/\.work-line i \{[^}]*width: 35%;/);
    expect(f8b).toContain(".work-line.on i { animation: mv-indet 1.2s var(--e-move) infinite; }");
  });
  it("the pill ends with the count of what was added, never counting failures", () => {
    expect(addedCount(3, 0, 0)).toBe(3);
    expect(addedCount(3, 1, 0)).toBe(2);
    expect(addedCount(2, 5, 4)).toBe(1);
    expect(addedCount(1, 2, 0)).toBe(0);
    expect(DONE_MS).toBe(2200);
    expect(f8b).toContain("animation: mv-pill-bye 2200ms var(--e-out) forwards");
  });
  it("at most two rings pulse on screen; the others keep still", () => {
    expect(MAX_PULSES).toBe(2);
    expect(pulseSurplus(["a", "b", "c", "d"])).toEqual(["c", "d"]);
    expect(pulseSurplus(["a", "b"])).toEqual([]);
    expect(pulseSurplus([])).toEqual([]);
    expect(f8b).toContain("[data-np] { animation: none !important; }");
  });
  it("one focus: with a window open the cards behind stop pulsing", () => {
    expect(f8b).toContain("body:has(.modal:not(.mv-leaving)");
    expect(f8b).toContain("animation-play-state: paused");
  });
});

describe("m-maskot, m-nabiz, m-cekmece, m-sert", () => {
  it("Oldu hops: 900 ms, 5 px, 1.04x, alternating", () => {
    expect(css).toContain('.ms-wrap[data-state="done"] .ms { animation: ms-hop 900ms cubic-bezier(.2, .9, .3, 1.3) infinite alternate; }');
    expect(css).toContain("@keyframes ms-hop { to { transform: translateY(-5px) scale(1.04); } }");
  });
  it("the drawer comes in 320 ms and leaves in 220 ms, 102 %", () => {
    expect(css).toContain(".drawer { animation: mv-drawer 320ms var(--e-out) backwards; }");
    expect(css).toContain("animation: mv-drawer-out 220ms var(--e-in) forwards !important");
    expect(css).toContain("@keyframes mv-drawer { from { transform: translateX(102%); } }");
  });
  it("the trip's photo takes 600 ms in and 420 ms back; the blur is 16 px at 1.05x", () => {
    expect(css).toContain("::view-transition-group(trip-photo) { animation-duration: 600ms;");
    expect(css).toContain(':root[data-photo="back"]::view-transition-group(trip-photo)');
    expect(css).toContain("animation-duration: 420ms; }");
    expect(css).toContain("@keyframes mv-blur-up { from { opacity: 0; filter: blur(16px); transform: scale(1.05); } }");
  });
  it("Plana koy: the number jumps 1.35x over 380 ms; the Plan tab stays the other target", () => {
    expect(BUMP_SCALE).toBe(1.35);
    expect(BUMP_MS).toBe(380);
    expect(SECTION_MARKS[0]).toContain(".cat-n");
    expect(onScreen({ top: 10, bottom: 40, width: 20, height: 20 }, 800)).toBe(true);
    expect(onScreen({ top: -5, bottom: 20, width: 20, height: 20 }, 800)).toBe(false);
    expect(onScreen({ top: 780, bottom: 820, width: 20, height: 20 }, 800)).toBe(false);
    expect(onScreen({ top: 10, bottom: 40, width: 0, height: 0 }, 800)).toBe(false);
  });
  it("the banner comes down whole in 380 ms and is pulled up in 200 ms; the notice ends green #16311f", () => {
    expect(css).toContain("animation: mv-banner-in var(--t-slow) var(--e-out) backwards");
    expect(css).toContain("@keyframes mv-banner-in { from { transform: translateY(-105%); } }");
    expect(f8b).toContain(".mv-banner-out { pointer-events: none; animation: mv-banner-up 200ms var(--e-in) forwards; }");
    expect(css).toContain(".reconnect.ok { background: #16311f; }");
  });
});

describe("m-iskelet: the tick stamped on a card that has just been read in", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const page = () => {
    const appended: Array<{ className: string; textContent: string; style: Record<string, string>; removed: boolean; remove: () => void; setAttribute: (k: string, v: string) => void }> = [];
    const doc = {
      defaultView: { innerHeight: 800 },
      body: { appendChild: (el: (typeof appended)[number]) => appended.push(el) },
      createElement: () => {
        const el = { className: "", textContent: "", style: {} as Record<string, string>, removed: false, remove() { this.removed = true; }, setAttribute() {} };
        return el;
      },
    } as unknown as Document;
    return { doc, appended };
  };
  const card = (top: number) => ({ getBoundingClientRect: () => ({ left: 100, right: 500, top, bottom: top + 120, width: 400, height: 120 }) }) as unknown as Element;
  it("is put at the card's top right for 1.3 s, and not for a card out of sight, nor with reduced motion", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("localStorage", { getItem: () => null });
    const { doc, appended } = page();
    stampTick(card(200), doc);
    expect(appended).toHaveLength(1);
    expect(appended[0].className).toBe("mv-tick");
    expect(appended[0].textContent).toBe("✓");
    expect(appended[0].style.left).toBe("464px");
    expect(appended[0].style.top).toBe("210px");
    vi.advanceTimersByTime(TICK_STAY_MS);
    expect(appended[0].removed).toBe(true);
    stampTick(card(2000), doc);
    stampTick(null, doc);
    expect(appended).toHaveLength(1);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    stampTick(card(200), doc);
    expect(appended).toHaveLength(1);
  });
});
