import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Plain text over static/app.css (vitest runs in node): the places that moved under "azaltılmış hareket" and under the person's own
// "Hareketi duraklat" (body.still) switch are all in the F8 block.
const css = readFileSync("static/app.css", "utf8");
const f8 = css.slice(css.indexOf("/* -- F8 hareket"));
// v82 (aşama 2, 3a): the category's fold and its row's bar are drawn by static/v82/plan.css, their stops sit with the boxes' (intent.css).
const v82 = ["plan", "intent"].map((f) => readFileSync(`static/v82/${f}.css`, "utf8")).join("\n");
const v82Reduced = [...v82.matchAll(/@media \(prefers-reduced-motion: reduce\) \{[^@]*/g)].map((m) => m[0]).join("\n");
const v82Still = v82.split("\n").filter((l) => l.startsWith("body.still ")).join("\n");
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
      for (const sel of [".dc-flash", ".gm-ring.go", ".pk-glow", ".pk-drop", ".pk-seal .okt", ".pk-stage .tk-plane", ".pk-stage .tk-logo", ".pk-stage .tk-lab", ".tk-fly", ".lv-dot", ".pk-landed"]) expect(block).toContain(`${prefix}${sel}`);
      expect(block).toMatch(/animation: none/);
    });
    it(`${name}: bars and card hover stop moving`, () => {
      for (const sel of [".pn-card", ".pk-card"]) expect(block).toContain(`${prefix}${sel}`);
      expect(prefix ? v82Still : v82Reduced).toContain(`${prefix}.q-bar i`);
      expect(block).toMatch(/transition: none/);
      expect(block).toContain(`${prefix}.pn-card:hover`);
      expect(block).toMatch(/transform: none/);
    });
    it(`${name}: the ticket frame's colour change stays (a colour is not movement)`, () => {
      expect(block).toContain(`${prefix}.pk-card.tk { transition: border-color .4s ease, background-color .4s ease !important; }`);
      expect(block).toContain(`${prefix}.pk-card.tk .tk-stub::before`);
    });
    it(`${name}: everything else collapses to no time, except the undo countdown`, () => {
      expect(block).toContain("animation-duration: .01ms !important");
      expect(block).toContain("transition-duration: .01ms !important");
      expect(block).toContain(":not(.pk-undo-ring .run)");
    });
    it(`${name}: the small F8d movements stop (fold row, chat message, undo toast, Neden?, heart, rotating hints)`, () => {
      for (const sel of [".pk-fold", ".msg-user", ".msg-assistant", ".pk-undo", ".pn-detail", ".pn-heart", ".pn-chev", ".st-ph", ".st-prompt textarea.rot::placeholder"]) expect(block).toContain(`${prefix}${sel}`);
    });
  }
  for (const [name, block, prefix] of [["system setting", reduced, ""], ["body.still", still, "body.still "]] as const) {
    it(`${name}: the Hareket Dili movements stop (hop, tick, banner, light, pill, skeleton, view in, section fold, sliding highlight)`, () => {
      for (const sel of [".ms-wrap[data-state=\"done\"] .ms", ".mv-tick", ".mv-banner-out", ".work-line.on i", ".work-pill.done", ".ar-skel::after", ".ar-new", ".panel .cat-plan", ".chat-banner"]) expect(block).toContain(`${prefix}${sel}`);
      for (const sel of [".cat-body", ".view-tabs.has-ind::before", ".plan-order.has-ind::before"]) expect(block).toContain(`${prefix}${sel}`);
      // v82: the category folds on .q-fold (static/v82/plan.css).
      for (const sel of [".q-fold", ".q-fold-in > *"]) expect(prefix ? v82Still : v82Reduced).toContain(`${prefix}${sel}`);
    });
  }
  it("the new movements use the motion language's own durations and curves", () => {
    expect(f8).toContain(".pk-fold { animation: mv-rise-s 300ms var(--e-out)");
    expect(f8).toContain(".pk-undo { animation: mv-toast 300ms var(--e-out)");
    expect(f8).toContain(".pn-detail { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s var(--e-out)");
    expect(f8).toContain("cubic-bezier(.2, 1.6, .4, 1)");
    expect(css).toContain("animation: tipx-in .14s");
  });
  it("every top-level animation rule from the dictionary has a stop", () => {
    // each class whose rule starts an animation in the dictionary block is named in the reduced block
    const dictionary = css.slice(css.indexOf("/* -- Hareket sözlüğü"), css.indexOf("/* -- The assistant's mascot"));
    const classes = [...dictionary.matchAll(/^(\.[\w.-]+)[^{]*\{[^}]*animation:/gm)].map((m) => m[1]);
    // the seal, the glow, the drop (v82: the empty cards' pulsing ring went with the cards)
    expect(classes.length).toBeGreaterThanOrEqual(3);
    for (const c of classes) expect(reduced + dictionary.slice(dictionary.indexOf("@media (prefers-reduced-motion")), ).toContain(c.split(" ")[0]);
  });
});
