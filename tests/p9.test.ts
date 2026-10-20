// P9: the small ones (the UX test's F08, F56).
import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { cleanTheme, tripName, type TitleState } from "../src/lib/tripName";

beforeEach(() => setLang("tr"));
const state = (over: Partial<TitleState>): TitleState => ({ where: { place: "Porto", country: "Portekiz", code: "PT" }, intent: null, messages: [], ...over }) as TitleState;

describe("P9", () => {
  it("F08: a trip said as one city with a route on to another is named by both; never 'Şehir Turu'", () => {
    const route = { stops: [{ city: "Porto", nights: 3 }, { city: "Lizbon", nights: 3 }], arrive: null, leave: null, confirmed: true, source: "user" } as TitleState["route"];
    expect(tripName(state({ route, duration: { unit: "night", n: 6 } }))).toMatch(/^7 Günlük Porto ve Lizbon /);
    expect(cleanTheme("Şehir Turu", "Porto")).toBeNull();
    expect(cleanTheme("Gastronomi", "Porto")).toBe("Gastronomi");
  });
  it("F56: 'bu cuma … 3 gecelik kaçamak' is a weekend getaway", () => {
    const messages = [{ role: "user" as const, text: "Bu cuma Lizbon'a 3 gecelik kaçamak", at: 1 }];
    expect(tripName(state({ where: { place: "Lizbon", country: "Portekiz", code: "PT" }, duration: { unit: "night", n: 3 }, messages }))).toBe("Lizbon Hafta Sonu Kaçamağı");
  });
});
