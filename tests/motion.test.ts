import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyStill, countAt, dropsIn, flysIn, GLOW_MS, STAGE_MS, reducedMotion, setStill, STILL_KEY, stillChosen } from "../src/app/motion";

describe("motion dictionary: the pure parts", () => {
  it("a number counts from where it was to where it is going, never past it", () => {
    expect(countAt(100, 200, 0)).toBe(100);
    expect(countAt(100, 200, 1)).toBe(200);
    expect(countAt(100, 200, 2)).toBe(200);
    expect(countAt(100, 200, -1)).toBe(100);
    const mid = countAt(100, 200, 0.5);
    expect(mid).toBeGreaterThan(150); // ease-out: most of the way early
    expect(mid).toBeLessThan(200);
    expect(countAt(200, 100, 0.5)).toBeLessThan(150);
  });
  it("a card the chat just added drops in once; old cards and cards of other origins never do", () => {
    const now = 1_000_000;
    expect(dropsIn("a", now - 500, true, now, false)).toBe(true);
    expect(dropsIn("a", now - 400, true, now, false)).toBe(false); // once
    expect(dropsIn("b", now - 60_000, true, now, false)).toBe(false); // an old card
    expect(dropsIn("c", now - 500, false, now, false)).toBe(false); // not from the chat
    expect(dropsIn("d", now - 500, true, now, true)).toBe(false); // reduced motion
  });
});

describe("motion dictionary: ticket and stage (plan-v45 4b)", () => {
  it("a ticket's plane glides to its card once per card in a session, never with reduced motion or without a card", () => {
    expect(flysIn("t-1", false)).toBe(true);
    expect(flysIn("t-1", false)).toBe(false);
    expect(flysIn("t-2", true)).toBe(false);
    expect(flysIn("t-2", false)).toBe(true); // reduced did not use up its turn
    expect(flysIn(undefined, false)).toBe(false);
  });
  const css = readFileSync("static/app.css", "utf8");
  it("aşama geçişi: glow 1.6 s 0 > 6 > 14 px, take-off 1.1 s, logo drop .7 s, label pop .5 s", () => {
    expect(STAGE_MS).toBe(1600);
    expect(css).toMatch(/\.pk-stage \{ animation: pk-stage-glow 1\.6s cubic-bezier\(\.16, 1, \.3, 1\); \}/);
    expect(css).toMatch(/@keyframes pk-stage-glow \{ 0% \{ box-shadow: 0 0 0 0 [^\n]*35% \{ box-shadow: 0 0 0 6px [^\n]*100% \{ box-shadow: 0 0 0 14px/);
    expect(css).toMatch(/@keyframes pk-takeoff \{ 0% \{ transform: translate\(-40%, 8px\) rotate\(-6deg\)/);
    expect(css).toMatch(/\.pk-stage \.tk-plane \{ animation: pk-takeoff 1\.1s cubic-bezier\(\.16, 1, \.3, 1\); \}/);
    expect(css).toMatch(/\.pk-stage \.tk-logo \{ animation: pk-logo-drop \.7s/);
    expect(css).toMatch(/animation: pk-lab-pop \.5s cubic-bezier\(\.2, 1\.6, \.4, 1\)/);
  });
  it("rt-fly .9 s from 18 px left, the Canlı dot pulses 1.6 s from a 4 px to a 7 px ring, landed 1.1 s with a 9 px ring", () => {
    expect(css).toMatch(/@keyframes pk-fly \{ from \{ opacity: 0; margin-left: -18px; \} \}/);
    expect(css).toMatch(/\.tk-fly \{ animation: pk-fly \.9s cubic-bezier\(\.16, 1, \.3, 1\) both; \}/);
    expect(css).toMatch(/box-shadow: 0 0 0 4px color-mix\(in srgb, currentColor 18%[^\n]*animation: pk-live-pulse 1\.6s ease-in-out infinite/);
    expect(css).toMatch(/@keyframes pk-live-pulse \{ 50% \{ box-shadow: 0 0 0 7px/);
    expect(css).toMatch(/\.pk-landed \{ animation: pk-landed 1\.1s/);
    expect(css).toMatch(/@keyframes pk-landed[^\n]*0 0 0 9px[^\n]*scale\(1\.015\)/);
  });
});

describe("motion dictionary: the values (plan-v45 4a)", () => {
  const css = readFileSync("static/app.css", "utf8");
  it("parlama lasts 1.1 s and grows a 10 px ring; nabız is 1.4 s with a 7 px ring; yükselme is 3 px", () => {
    expect(GLOW_MS).toBe(1100);
    expect(css).toMatch(/\.pk-glow \{ animation: pk-glow 1\.1s ease-out; \}/);
    expect(css).toMatch(/@keyframes pk-glow[^\n]*0 0 0 10px rgba\(91, 69, 224, \.6\)/);
    expect(css).toMatch(/animation: pk-pulse 1\.4s ease-in-out infinite/);
    expect(css).toMatch(/@keyframes pk-pulse[^\n]*0 0 0 7px/);
    expect(css).toMatch(/\.pk-card:not\(\.pk-open\):not\(\.ek-still\):hover \{ transform: translateY\(-3px\)/);
    expect(css).toMatch(/\.pn-card:hover \{ transform: translateY\(-3px\)/);
  });
  it("düşüş starts a little smaller; mühür keeps its turn, 0.5 s", () => {
    expect(css).toMatch(/@keyframes pk-drop \{ 0% \{ opacity: 0; transform: translateY\(-14px\) scale\(\.96\)/);
    expect(css).toMatch(/@keyframes pk-pop \{ 0% \{ transform: scale\(\.4\) rotate\(-14deg\)/);
    expect(css).toMatch(/animation: pk-pop \.5s cubic-bezier\(\.2, \.9, \.3, 1\.3\) backwards/);
  });
});

describe("Hareketi duraklat", () => {
  const store = new Map<string, string>();
  const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });
  it("is off until chosen, then reducedMotion() is true even when the system allows motion", () => {
    vi.stubGlobal("localStorage", fake);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(stillChosen()).toBe(false);
    expect(reducedMotion()).toBe(false);
    setStill(true);
    expect(store.get(STILL_KEY)).toBe("1");
    expect(reducedMotion()).toBe(true);
    setStill(false);
    expect(store.has(STILL_KEY)).toBe(false);
    expect(reducedMotion()).toBe(false);
  });
  it("puts body.still on the page and takes it off", () => {
    const classes = new Set<string>();
    vi.stubGlobal("document", { body: { classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) } } });
    vi.stubGlobal("localStorage", fake);
    applyStill(true);
    expect(classes.has("still")).toBe(true);
    applyStill(false);
    expect(classes.has("still")).toBe(false);
  });
  it("a browser that refuses storage does not break it", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(stillChosen()).toBe(false);
    expect(() => setStill(true)).not.toThrow();
  });
});
