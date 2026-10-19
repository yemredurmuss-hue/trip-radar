// The home's idea chips (ana-sayfa-v1, 2026-10-19): two sets of six fixed ideas, this month's first, each with both
// languages, its mode and a drawing whose ids are its own.
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { HINTS, IDEAS, ideaArtMarkup, ideasFor, ideaTip, inSeason, monthSpan } from "../src/app/homeIdeas";
import { setLang } from "../src/lib/i18n";

afterEach(() => setLang("tr"));

describe("the idea chips", () => {
  it("two sets of six, twelve different drawings", () => {
    expect(IDEAS.map((s) => s.length)).toEqual([6, 6]);
    expect(new Set(IDEAS.flat().map((i) => i.art)).size).toBe(12);
  });
  it("Amalfi, the Sahara and Iceland start a road trip, Lisbon this weekend a last-minute one, the rest a plan", () => {
    const mode = Object.fromEntries(IDEAS.flat().map((i) => [i.art, i.mode]));
    expect(mode).toEqual({ aurora: "plan", bali: "plan", kyoto: "plan", sahara: "road", amalfi: "road", lisbon: "lastminute", iceland: "road", vienna: "plan", patagonia: "plan", kenya: "plan", festival: "plan", maldives: "plan" });
  });
  it("every text in both languages, no long dash anywhere", () => {
    for (const i of IDEAS.flat())
      for (const pair of [i.title, i.place, i.long, i.meta, i.say]) {
        expect(pair[0].trim() && pair[1].trim()).toBeTruthy();
        expect(pair.join(" ")).not.toContain("—");
      }
    for (const l of ["tr", "en"] as const) {
      setLang(l);
      for (const h of HINTS) expect(h()).not.toContain("—");
    }
  });
  it("in October the ideas in season come first, nothing else moves; an all-year idea never counts as in season", () => {
    expect(ideasFor(0, 9).map((i) => i.art)).toEqual(["aurora", "bali", "sahara", "kyoto", "amalfi", "lisbon"]);
    expect(ideasFor(1, 9).map((i) => i.art)).toEqual(["kenya", "iceland", "vienna", "patagonia", "festival", "maldives"]);
    expect(ideasFor(0, 5).map((i) => i.art)).toEqual(["bali", "amalfi", "aurora", "kyoto", "sahara", "lisbon"]);
    expect(inSeason(IDEAS[0][5], 9)).toBe(false);
  });
  it("the hover line: the long name, what it is and its months", () => {
    expect(ideaTip(IDEAS[0][0])).toBe("Kuzey ışıkları peşinde · Tromsø · 5 gece · Eyl–Mar");
    setLang("en");
    expect(ideaTip(IDEAS[0][0])).toBe("Chasing the northern lights · Tromsø · 5 nights · Sep–Mar");
    expect(monthSpan(IDEAS[0][5].months)).toBe("every month");
    expect(monthSpan([10])).toBe("Nov");
  });
  it("a drawing's ids carry its prefix, so two drawn on one page never share a gradient", () => {
    for (const i of IDEAS.flat()) {
      const svg = ideaArtMarkup(i.art, "pX");
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of [...ids, ...refs]) expect(id.startsWith("pX")).toBe(true);
    }
  });
});

describe("the home under the box", () => {
  const home = readFileSync("src/app/TripsHome.tsx", "utf8");
  it("no chip for a new trip or for joining: the purple button and the profile menu do those", () => {
    expect(home).not.toMatch(/Yeni gezi planla|Bana ilham ver/);
    expect(home).toContain('item("users", L("Paylaşılan geziye katıl", "Join a shared trip"), p.onJoin)');
  });
  it("Sürpriz bir yer starts the inspire mode", () => {
    expect(home).toContain('submit("inspire", L("Sürpriz bir yer", "Surprise me"))');
  });
  it("the headings take the display face, bundled, never fetched", () => {
    const css = readFileSync("static/app.css", "utf8");
    expect(css).toMatch(/--hm-display: "Plus Jakarta Sans", -apple-system/);
    expect(css).toMatch(/\.st-hello \{[^}]*font-family: var\(--hm-display\)[^}]*letter-spacing: -\.025em; font-weight: 800;/);
    expect(css).toMatch(/\.st-section \{ font-family: var\(--hm-display\);[^}]*font-weight: 800;/);
    // The face is the extension's own file (static/fonts), never a font host.
    expect(css).toMatch(/@font-face \{ font-family: "Plus Jakarta Sans";[^}]*url\("fonts\/PlusJakartaSans-latin\.woff2"\)/);
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic|url\("https?:/);
    expect(existsSync("static/fonts/PlusJakartaSans-latin.woff2") && existsSync("static/fonts/PlusJakartaSans-latin-ext.woff2")).toBe(true);
  });
});
