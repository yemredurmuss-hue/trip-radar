import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Plain text over static/app.css (vitest runs in node): the places that moved under "azaltılmış hareket" and under the person's own
// "Hareketi duraklat" (body.still) switch are all in the F8 block.
const css = readFileSync("static/app.css", "utf8");
const f8 = css.slice(css.indexOf("/* -- F8 hareket"));
const reduced = f8.slice(f8.indexOf("@media (prefers-reduced-motion: reduce)"), f8.indexOf("body.still .dc-flash"));
const still = f8.slice(f8.indexOf("body.still .dc-flash"));

describe("reduced motion and Hareketi duraklat", () => {
  it("has its own F8 block at the end of the stylesheet", () => {
    expect(css.indexOf("/* -- F8 hareket")).toBeGreaterThan(0);
    expect(reduced.length).toBeGreaterThan(100);
    expect(still.length).toBeGreaterThan(100);
  });
  for (const [name, block, prefix] of [["system setting", reduced, ""], ["body.still", still, "body.still "]] as const) {
    it(`${name}: the animated gaps are stopped`, () => {
      for (const sel of [".dc-flash", ".gm-ring.go", ".pk-glow", ".pk-drop", ".pk-seal .okt", ".ek-card .pk-ring.open"]) expect(block).toContain(`${prefix}${sel}`);
      expect(block).toMatch(/animation: none/);
    });
    it(`${name}: bars and card hover stop moving`, () => {
      for (const sel of [".cat-bar > span", ".hx-bar i", ".pn-card", ".pk-card"]) expect(block).toContain(`${prefix}${sel}`);
      expect(block).toMatch(/transition: none/);
      expect(block).toContain(`${prefix}.pn-card:hover`);
      expect(block).toMatch(/transform: none/);
    });
    it(`${name}: everything else collapses to no time, except the undo countdown`, () => {
      expect(block).toContain("animation-duration: .01ms !important");
      expect(block).toContain("transition-duration: .01ms !important");
      expect(block).toContain(":not(.pk-undo-ring .run)");
    });
  }
  it("every top-level animation rule from the dictionary has a stop", () => {
    // each class whose rule starts an animation in the dictionary block is named in the reduced block
    const dictionary = css.slice(css.indexOf("/* -- Hareket sözlüğü"), css.indexOf("/* -- The assistant's mascot"));
    const classes = [...dictionary.matchAll(/^(\.[\w.-]+)[^{]*\{[^}]*animation:/gm)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(3);
    for (const c of classes) expect(reduced + dictionary.slice(dictionary.indexOf("@media (prefers-reduced-motion")), ).toContain(c.split(" ")[0]);
  });
});
