// "Plan taslağı" (LivePlan.tsx, 2026-10-09): the plan "Oluştur" would make, drawn in the board's sections while the chat
// goes on: the flights named Gidiş / Dönüş until home is said, a stay per stop with its nights, the prep as lines.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import { applyText, mergeExtracted, newStart, nextQuestion, parseStartText, type StartState } from "../src/lib/startTrip";
import { LivePlan } from "../src/app/start/LivePlan";

const TODAY = "2026-10-09";
function typed(s: StartState, text: string): StartState {
  const q = nextQuestion(s);
  const asked = { ...s, messages: [...s.messages, { role: "user" as const, text, at: 2 }] };
  return withLang("tr", () => {
    const out = applyText(asked, text, mergeExtracted(parseStartText(text, TODAY, q), null), 2, q);
    return out.understood ? out.state : asked;
  });
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Plan taslağı", () => {
  it("nothing before the destination", () => {
    expect(renderToStaticMarkup(createElement(LivePlan, { state: newStart("lp0", "plan", 1), lang: "tr" }))).toBe("");
  });

  it("Lizbon, 12 Kasım'dan 5 gece: the way out and back named until home is said, the stay with its dates and nights", () => {
    const s = typed(newStart("lp1", "plan", 1), "12 Kasım'dan 5 gece Lizbon");
    const html = text(renderToStaticMarkup(createElement(LivePlan, { state: s, lang: "tr" })));
    expect(html).toContain("Plan taslağı");
    expect(html).toContain("Uçuş");
    expect(html).toMatch(/Gidiş · Lizbon/);
    expect(html).toMatch(/Dönüş · Lizbon/);
    expect(html).toContain("Konaklama");
    expect(html).toMatch(/12–17 Kasım · 5 gece/);
  });

  it("home said: the flights read from → to", () => {
    let s = typed(newStart("lp2", "plan", 1), "12 Kasım'dan 5 gece Lizbon");
    s = { ...s, from: "İstanbul" };
    const html = text(renderToStaticMarkup(createElement(LivePlan, { state: s, lang: "tr" })));
    expect(html).toContain("İstanbul → Lizbon");
    expect(html).toContain("Lizbon → İstanbul");
    expect(html).not.toContain("Gidiş ·");
  });
});
