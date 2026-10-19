// Hazırlık's "Bilmen gerekenler" (lib/prepKnow.ts, v82 aşama 7, Etsy T8 b): only what has a source — the emergency table,
// the embassy as a map search, the money and the plugs as the hero has them, the AI's notes marked — and no row unknown.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import { EMERGENCY, emergencyText, knowRows, knowSub, type KnowInput } from "../src/lib/prepKnow";

const input = (over: Partial<KnowInput> = {}): KnowInput => ({ countries: ["PT"], passport: "TR", money: { name: "Euro", rate: "€1 = ₺38,20", own: false }, plug: "fits", tips: [], ...over });

describe("the emergency numbers", () => {
  it("by service or one for all, as the table has them", () => {
    expect(emergencyText("JP")).toBe("110 polis · 119 ambulans ve itfaiye");
    expect(emergencyText("HU")).toBe("112 (AB ortak numara)");
    expect(emergencyText("DE")).toBe("112 (AB ortak numara) · 110 polis");
    expect(emergencyText("GB")).toBe("999 ya da 112");
    expect(emergencyText("TH")).toBe("191 polis · 1669 ambulans · 199 itfaiye · 1155 turist polisi");
    expect(withLang("en", () => emergencyText("JP"))).toBe("110 police · 119 ambulance and fire");
  });

  it("a country the table doesn't know has none (nothing guessed)", () => {
    expect(emergencyText("MA")).toBeNull();
    expect(emergencyText(null)).toBeNull();
    // Every EU country is in it.
    for (const c of ["PT", "ES", "FR", "IT", "NL", "GR", "HR", "CZ", "PL", "SE", "FI", "RO"]) expect(EMERGENCY[c]?.all).toContain("112");
  });
});

describe("the card's rows", () => {
  it("emergency, money, plugs, the AI's notes (marked), the embassy as a map search", () => {
    const rows = knowRows(input({ tips: [{ label: "Bahşiş", text: "Servis ücreti çoğu zaman hesapta." }] }));
    expect(rows.map((r) => r.id)).toEqual(["emergency", "money", "plug", "tip:0", "embassy"]);
    expect(rows[1].text).toBe("Euro · €1 = ₺38,20");
    expect(rows[2].text).toBe("C ve F tipi · Adaptör gerekmez");
    expect(rows[3]).toMatchObject({ label: "Bahşiş", ai: true, icon: "hand" });
    expect(rows.filter((r) => r.ai)).toHaveLength(1);
    const embassy = rows[4];
    expect(embassy).toMatchObject({ label: "Türkiye Büyükelçiliği", text: "Portekiz" });
    expect(embassy.link?.url).toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Türkiye Büyükelçiliği Portekiz")}`);
  });

  it("what isn't known isn't drawn: no rate, the traveller's own money, at home", () => {
    expect(knowRows(input({ money: { name: "Euro", rate: null, own: false } }))[1].text).toBe("Euro");
    expect(knowRows(input({ money: { name: "Euro", rate: null, own: true } })).some((r) => r.id === "money")).toBe(false);
    const home = knowRows(input({ countries: ["TR"], money: null, plug: "fits" }));
    expect(home.map((r) => r.id)).toEqual(["emergency"]);
    expect(knowRows(input({ countries: ["MA"], money: null, plug: null })).map((r) => r.id)).toEqual(["embassy"]);
    expect(knowRows(input({ countries: [], money: null, plug: null }))).toEqual([]);
  });

  it("two countries: each one's numbers by name when they differ", () => {
    expect(knowRows(input({ countries: ["PT", "ES"] }))[0].text).toBe("112 (AB ortak numara)");
    expect(knowRows(input({ countries: ["JP", "TH"] }))[0].text).toBe("Japonya 110 polis · 119 ambulans ve itfaiye · Tayland 191 polis · 1669 ambulans · 199 itfaiye · 1155 turist polisi");
  });

  it("the heading names the countries; English too", () => {
    expect(knowSub(["PT"])).toBe("Portekiz · gezi boyunca işine yarayacaklar");
    expect(withLang("en", () => knowRows(input()).find((r) => r.id === "embassy")?.label)).toBe("Embassy of Türkiye");
  });
});
