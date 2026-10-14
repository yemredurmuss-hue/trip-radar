import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("static/app.css", "utf8");
const block = css.slice(css.indexOf("/* -- fark-konaklama --"));

describe("konaklama: dar plan sutununda oneri ve secenek kartlari", () => {
  it("picks wrap by the card's own width, the name takes two lines, the buttons fit", () => {
    expect(block).toMatch(/\.ek-pick-list \{[^}]*repeat\(auto-fit, minmax\(min\(100%, 210px\), 1fr\)\)/);
    expect(block).toMatch(/\.ek-pick-name \{[^}]*-webkit-line-clamp: 2[^}]*white-space: normal/);
    expect(block).toMatch(/\.ek-pick-s \{[^}]*flex-wrap: wrap/);
    expect(block).toMatch(/\.ek-pick-s \.ek-of-rate \{[^}]*flex: none/);
  });
  it("the back face's option grid wraps by width, not by the window", () => {
    expect(block).toMatch(/\.bk-grid:not\(\.fl\) \{[^}]*auto-fill, minmax\(min\(100%, 208px\), 1fr\)/);
  });
});
