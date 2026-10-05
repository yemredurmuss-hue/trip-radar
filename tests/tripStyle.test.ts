// The style chips under the hero's title: two words at most from a fixed list, and the money's word from the budget.
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { acceptStyle, budgetLevel, STYLE_META, STYLES, styleChips, styleKey, stylePrompt, type StyleId } from "../src/lib/tripStyle";

afterEach(() => setLang("tr"));
const rates = { base: "EUR" as const, date: "2026-10-01", rates: { EUR: 1, TRY: 50 } };

describe("trip style", () => {
  it("keeps only listed ids, each once, at most two", () => {
    expect(acceptStyle(["calm", "calm", "beach", "romantic"])).toEqual(["calm", "beach"]);
    expect(acceptStyle(["romantic", " Calm ", "luxury"])).toEqual(["romantic", "calm"]);
    expect(acceptStyle(["sunny", "cheap"])).toEqual([]);
  });
  it("reads the budget per person per day", () => {
    expect(budgetLevel({ amount: 1500, currency: "EUR" }, 7, 2, rates)).toBe("mid"); // ~€107
    expect(budgetLevel({ amount: 600, currency: "EUR" }, 7, 2, rates)).toBe("low");
    expect(budgetLevel({ amount: 6000, currency: "EUR" }, 7, 2, rates)).toBe("high");
    expect(budgetLevel({ amount: 40000, currency: "TRY" }, 7, 2, rates)).toBe("low"); // €800 / 14 ≈ €57
    expect(budgetLevel({ amount: 1500, currency: "XYZ" }, 7, 2, rates)).toBeNull();
    expect(budgetLevel(null, 7, 2, rates)).toBeNull();
  });
  it("shows the words, then the money's", () => {
    expect(styleChips(["romantic", "calm"], "mid").map((c) => c.label)).toEqual(["Romantik", "Dingin", "Orta bütçe"]);
    expect(styleChips(["adventure"], null)).toEqual([{ label: "Macera", icon: "mountain", bg: "#e3f3ea", fg: "#1f7a4d" }]);
    expect(styleChips([], "low")[0]).toMatchObject({ label: "Ekonomik", icon: "wallet" });
    setLang("en");
    expect(styleChips([], "high").map((c) => c.label)).toEqual(["High budget"]);
  });
  it("gives every style its own icon and colours", () => {
    const ids = Object.keys(STYLES) as StyleId[];
    expect(Object.keys(STYLE_META).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(STYLE_META[id]).toMatchObject({ icon: expect.any(String), bg: expect.stringMatching(/^#[0-9a-f]{6}$/), fg: expect.stringMatching(/^#[0-9a-f]{6}$/) });
    expect(new Set(ids.map((id) => STYLE_META[id].icon)).size).toBe(ids.length);
  });
  it("asks again only when cities or what was understood change", () => {
    expect(styleKey(["Porto", "Lizbon"], ["Sessizlik: çok önemli"])).toBe(styleKey([" porto", "LIZBON "], ["Sessizlik: çok önemli"]));
    expect(stylePrompt()).toContain("romantic (Romantik)");
  });
});
