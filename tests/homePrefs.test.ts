// 0.39.1, Seyahatlerim's ₺ € $ and TR / EN pills: "the language and money don't change on the home, they do from the
// profile". The lists opened under the hero (".hm-prefs" blurs, its own stacking context), so a click on "USD" or
// "Türkçe" landed on the hero and closed the list. Fixed in CSS; and the home's own reload stays on the home.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HOME_HASH, openingTrip } from "../src/lib/openingTrip";

describe("the board's first trip on load", () => {
  it("the popup's #trip=<id> opens that trip", () => {
    expect(openingTrip("#trip=bali-1", "sri-lanka")).toBe("bali-1");
  });
  it("after the home's own reload (#home) the home, whatever trip another tab showed last", () => {
    expect(openingTrip(HOME_HASH, "bali-1")).toBeNull();
  });
  it("otherwise the last trip viewed, or none", () => {
    expect(openingTrip("", "bali-1")).toBe("bali-1");
    expect(openingTrip("#settings", null)).toBeNull();
  });
});

describe("the home's pickers open over the hero", () => {
  const hero = readFileSync("static/v82/hero.css", "utf8");
  it("the bar stacks above the hero below it, so its lists take the click", () => {
    expect(hero).toMatch(/\.hm-bar \{ position: relative; z-index: 2; \}/);
  });
  it("the picker's list is the popover itself: no bullets", () => {
    expect(hero).toMatch(/ul\.hm-pop \{ list-style: none; margin: 0; padding: 6px; \}/);
  });
  it("both pickers mark the reload as the home's own", () => {
    const home = readFileSync("src/app/TripsHome.tsx", "utf8");
    expect(home.match(/onPick=\{\([cl]\) => \(stayHome\(\), void save(Currency|Lang)\(/g)).toHaveLength(2);
  });
});
