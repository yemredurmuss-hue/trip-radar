import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyStill, countAt, dropsIn, GLOW_MS, reducedMotion, setStill, STILL_KEY, stillChosen } from "../src/app/motion";

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
