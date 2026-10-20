// Hazırlık's "Telefonuna kur" (0.39.7; 0.39.8 kısa liste, lib/phoneApps.ts): the plan decides what's relevant, at most
// six and one eSIM, the rest folded; the plan's ride app; the trip's kinds; the AI's pick from the candidates.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { acceptPhoneAi, MAIN, phoneCount, phonePlan, phoneSub, tripKinds, tripShape, type PhoneInput, type PhoneTable, type TripShape } from "../src/lib/phoneApps";
import type { Item, Trip } from "../src/lib/types";

const table = JSON.parse(readFileSync("static/data/country-apps.json", "utf8")) as PhoneTable;
const names: Record<string, string> = { TH: "Tayland", VN: "Vietnam", JP: "Japonya", EG: "Mısır", PT: "Portekiz", CN: "Çin" };
const stay = (city: string, country: string, nights: number) => ({ city, country, nights });
const input = (over: Partial<PhoneInput> = {}): PhoneInput => ({
  table,
  countries: ["EG"],
  countryName: (c) => names[c] ?? c,
  kinds: [],
  shape: { stays: [], moves: false },
  rides: [],
  days: 10,
  ai: null,
  hidden: [],
  lang: "tr",
  ...over,
});
const keys = (p: ReturnType<typeof phonePlan>) => p.main.map((a) => a.key);
const moreKeys = (p: ReturnType<typeof phonePlan>) => p.more.flatMap((g) => g.apps.map((a) => a.key));
// Cairo 3 nights, Luxor 3 nights, the train between them, Hurghada 4 nights.
const egypt: TripShape = { stays: [stay("Kahire", "EG", 3), stay("Luxor", "EG", 3), stay("Hurghada", "EG", 4)], moves: true };

describe("the short list: what the plan makes relevant", () => {
  it("Egypt (Emre's 19): Uber with Careem as its backup, the train, Cairo's metro; no food, no InstaPay, no WhatsApp", () => {
    const p = phonePlan(input({ shape: egypt }));
    expect(keys(p)).toEqual(["uber", "enr", "cairo-metro"]);
    expect(p.main[0].alt).toBe("Careem");
    expect(moreKeys(p)).toEqual(expect.arrayContaining(["careem", "talabat", "instapay-egypt", "swvl"]));
    expect([...keys(p), ...moreKeys(p)]).not.toContain("whatsapp");
  });

  it("one eSIM provider, the plan picked in its app for the trip's days: no GB rows", () => {
    const p = phonePlan(input({ shape: egypt }));
    expect(p.esim?.key).toBe("esim:airalo");
    expect(p.esim?.why).toContain("10 günlük paketi uygulamada seç");
  });

  it("no train on the plan and one town: no train app; a short stay: no metro app", () => {
    expect(keys(phonePlan(input({ shape: { stays: [stay("Kahire", "EG", 1)], moves: false } })))).toEqual(["uber"]);
  });

  it("a long stay brings food; China brings its wallet", () => {
    expect(keys(phonePlan(input({ shape: { stays: [stay("Kahire", "EG", 8)], moves: false } })))).toContain("talabat");
    expect(phonePlan(input({ countries: ["CN"], shape: { stays: [stay("Şangay", "CN", 3)], moves: false } })).main.some((a) => a.cat === "pay")).toBe(true);
  });

  it("at most six on the list, the rest folded, each app once", () => {
    const p = phonePlan(input({ countries: ["TH", "VN", "JP"], kinds: ["hiking", "diving", "nightlife"], shape: { stays: [stay("Bangkok", "TH", 6), stay("Hanoi", "VN", 6), stay("Tokyo", "JP", 6)], moves: true } }));
    expect(p.main.length).toBeLessThanOrEqual(MAIN);
    const all = [...keys(p), ...moreKeys(p)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("an app said not for me stays out", () => {
    const p = phonePlan(input({ hidden: ["uber"], shape: egypt }));
    expect([...keys(p), ...moreKeys(p)]).not.toContain("uber");
  });

  it("the plan's stays and its train are read from the items", () => {
    const items = [
      { name: "Steigenberger", category: "stay", city: "Kahire", countryCode: "eg", dates: { start: "2026-03-01", end: "2026-03-04" }, status: "chosen" },
      { name: "Kahire → Luxor yataklı tren", category: "transport", dates: { start: "2026-03-04", end: null }, status: "suggested" },
    ] as unknown as Item[];
    expect(tripShape(items)).toEqual({ stays: [stay("Kahire", "EG", 3)], moves: true });
  });
});

describe("the plan's ride app and the trip's kinds", () => {
  it("an airport taxi's Uber leads where the table lists it", () => {
    expect(phonePlan(input({ countries: ["PT"], rides: ["Uber"] })).main[0].name).toBe("Uber");
  });

  it("where the table knows the country and not the app (Uber in Thailand), the plan's Uber is left out", () => {
    const p = phonePlan(input({ countries: ["TH"], rides: ["Uber"] }));
    expect([...keys(p), ...moreKeys(p)]).not.toContain("uber");
  });

  it("no country known: the plan's Uber comes with its reason", () => {
    expect(phonePlan(input({ countries: [], rides: ["Uber"] })).main[0].why).toContain("Havalimanı yolu için");
  });

  it("a hiking trip in Japan: one hiking app, Japan's own", () => {
    const p = phonePlan(input({ countries: ["JP"], kinds: ["hiking"] }));
    expect(p.main.filter((a) => a.cat === "intent:hiking").map((a) => a.key)).toEqual(["yamap"]);
  });

  it("the kinds are read from the playbook, the plan's names, the wants", () => {
    const trip = { title: "Bali", intent: { playbook: "festival" }, wants: { stays: ["camp"] } } as unknown as Trip;
    const items = [{ name: "Batur yanardağı gün doğumu yürüyüşü", category: "activity" }, { name: "Nusa Penida şnorkel turu", category: "activity" }] as unknown as Item[];
    expect(tripKinds(trip, items)).toEqual(expect.arrayContaining(["festival", "hiking", "diving", "camping", "offline-maps"]));
  });
});

describe("the AI's pick", () => {
  it("its order and words, from the candidates only, and at most two of its own, labelled", () => {
    const ai = {
      lang: "tr",
      at: 1,
      v: 2,
      pick: [{ key: "enr", why: "Luxor treni planında" }, { key: "uber", why: "Kahire ve Luxor'da" }, { key: "made-up", why: "x" }],
      list: [{ name: "Windy", cat: "intent", why: "Dalış günleri için rüzgâr" }, { name: "A", cat: "other", why: "a" }, { name: "B", cat: "other", why: "b" }],
    };
    const p = phonePlan(input({ shape: egypt, ai }));
    expect(p.main.map((a) => a.name)).toEqual(["Egyptian National Railways (ENR)", "Uber", "Windy", "A"]);
    expect(p.main[0].why).toBe("Luxor treni planında");
    expect(p.main[2].ai).toBe(true);
    expect(p.main[2].search).toContain("google.com/search");
  });

  it("a pick from 0.39.7 (no v 2) or in another language isn't used", () => {
    const old = { lang: "tr", at: 1, list: [{ name: "Windy", cat: "intent", why: "w" }] };
    expect(keys(phonePlan(input({ shape: egypt, ai: old })))).toEqual(["uber", "enr", "cairo-metro"]);
    const en = { lang: "en", at: 1, v: 2, pick: [{ key: "enr", why: "w" }], list: [] };
    expect(keys(phonePlan(input({ shape: egypt, ai: en })))[0]).toBe("uber");
  });

  it("the answer is trimmed: picks from the candidates, each once, extras at most two", () => {
    const out = acceptPhoneAi(
      { pick: [{ key: "uber", why: "a" }, { key: "uber", why: "b" }, { key: "nope", why: "c" }], extra: [{ name: "X", cat: "o", why: "w" }, { name: "Y", cat: "o", why: "w" }, { name: "Z", cat: "o", why: "w" }] },
      ["uber", "enr"],
    );
    expect(out?.pick).toEqual([{ key: "uber", why: "a" }]);
    expect(out?.list.map((a) => a.name)).toEqual(["X", "Y"]);
    expect(acceptPhoneAi({ nope: 1 }, [])).toBeNull();
  });
});

describe("the closed line", () => {
  it("says where, how many apps and the internet, and counts what's installed", () => {
    const p = phonePlan(input({ shape: egypt }));
    expect(phoneSub(["Mısır"], p)).toBe("Mısır · 3 uygulama + internet");
    expect(phoneCount(p, ["uber"])).toEqual({ done: 1, total: 4 });
  });
});
