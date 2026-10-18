// The hero strip's words (lib/heroStrip.ts, v83 B9, C19, Etsy T5): the two shares and their sentence with the Turkish
// endings, a new backbone's line, the dates' tip, the weather chip, the budget window and each person's share.
import { describe, expect, it } from "vitest";
import type { CityWeather } from "../src/lib/climate";
import { withLang } from "../src/lib/i18n";
import type { IntentStatus } from "../src/lib/intents";
import { budgetView, datesTip, factChips, freshWords, heroCounts, heroLine, numberLocative, shareSentence, shareWords, shortRange, weatherChip } from "../src/lib/heroStrip";
import type { BudgetBar } from "../src/lib/progress";

const of = (list: [IntentStatus, number][]) => list.flatMap(([status, n]) => Array.from({ length: n }, () => ({ status })));

describe("heroCounts and its words", () => {
  // The v83 prototype's own numbers: 18 needs, 11 planned, 6 booked, 7 to decide.
  const japan = heroCounts(of([["booked", 5], ["arranged", 1], ["chosen", 4], ["included", 1], ["suggested", 3], ["deciding", 3], ["searching", 1], ["skipped", 2]]));
  it("counts every need but those not needed", () => {
    expect(japan).toMatchObject({ total: 18, open: 7, suggested: 3, fresh: false });
    expect([japan.plan.count, japan.plan.pct, japan.booked.count, japan.booked.pct]).toEqual([11, 61, 6, 33]);
  });

  it("says it in short and in a whole sentence with the Turkish endings", () => {
    expect(shareWords(japan)).toEqual({ plan: "%61 planda", booked: "%33 alındı" });
    expect(shareSentence(japan)).toBe("Omurganın %61'i planda (18 ihtiyaçtan 11'i), %33'ü alındı (6). 7 karar bekliyor.");
    expect(withLang("en", () => shareSentence(japan))).toBe("61% of the plan's needs are planned (11 of 18), 33% booked (6). 7 to decide.");
    const done = heroCounts(of([["booked", 3]]));
    expect(shareSentence(done)).toBe("Omurganın %100'ü planda (3 ihtiyaçtan 3'ü), %100'ü alındı (3). Karar bekleyen yok.");
  });

  it("is a new backbone until something is chosen or bought, and says how many needs and picks", () => {
    const fresh = heroCounts(of([["suggested", 5], ["searching", 12], ["arranged", 1]]));
    expect(fresh.fresh).toBe(true);
    expect(freshWords(fresh)).toBe("18 ihtiyaç · 5'inde önerimiz var");
    expect(freshWords(heroCounts(of([["searching", 4]])))).toBe("4 ihtiyaç");
    expect(withLang("en", () => freshWords(fresh))).toBe("18 needs · 5 with our pick");
  });

  it("puts a number in the locative", () => {
    expect([1, 2, 3, 5, 6, 9, 10, 40, 100].map(numberLocative)).toEqual(["1'inde", "2'sinde", "3'ünde", "5'inde", "6'sında", "9'unda", "10'unda", "40'ında", "100'ünde"]);
  });
});

describe("dates", () => {
  it("says each city's days and that they're a guess, nothing when nothing is known", () => {
    const places = [{ city: "Porto", start: "2026-10-08", end: "2026-10-11" }, { city: "Lizbon", start: "2026-10-11", end: "2026-10-14" }];
    expect(datesTip(places, false)).toBe("Porto 8–11 Ekim · Lizbon 11–14 Ekim");
    expect(datesTip([], true)).toBe("Tahmini · kayıtlardan");
    expect(datesTip([], false)).toBeNull();
    expect(shortRange("2026-10-08", "2026-10-14")).toBe("8–14 Eki");
    expect(shortRange("2026-10-29", "2026-11-03")).toBe("29 Eki – 3 Kas");
  });
});

describe("weatherChip", () => {
  const w = (city: string, low: number, high: number, sky: CityWeather["sky"]): CityWeather => ({ city, low, high, sky, rainy: 2, days: 4, source: "average" });
  it("spans the coolest night to the warmest day, the most common sky, each city in the tip", () => {
    const chip = weatherChip([w("Porto", 13, 21, "partly"), w("Lizbon", 15, 24, "sun"), w("Sintra", 12, 19, "sun")], "Ekim");
    expect(chip?.text).toBe("12–24°");
    expect(chip?.sky).toBe("sun");
    expect(chip?.tip).toMatch(/^Porto · Ekim ortalaması, son 5 yıl: gündüz 21°, gece 13° · yağışlı gün 2\/4 · Lizbon/);
    expect(weatherChip([], "Ekim")).toBeNull();
  });
});

describe("budgetView", () => {
  const bar = (over: Partial<BudgetBar>): BudgetBar => ({
    currency: "EUR", total: 1500, booked: 552, chosen: 25, open: 442, uncounted: 0,
    byCategory: { flight: 162, stay: 390, transport: 0, activity: 25, other: 0 }, expected: { flight: 0, stay: 0, transport: 0, activity: 0, other: 0 }, ...over,
  });
  it("has the booked, planned and free lines, each person's share and the closing words", () => {
    const v = budgetView(bar({}), 2)!;
    expect(v.likely).toBe(1019);
    expect(v.lines.map((l) => [l.key, l.amount])).toEqual([["booked", 552], ["planned", 25], ["free", 923]]);
    expect(v.perPerson).toEqual({ amount: 510, people: 2 });
    expect(v.note).toEqual(["Karar bekleyenler seçilince yaklaşık €442 daha eklenir.", "Tahmini toplam ~€1.019, bütçeye sığar · €481 pay."]);
    expect(v.over).toBe(0);
  });

  it("says what's over, and no share for one person or with no budget", () => {
    const over = budgetView(bar({ total: 500 }), 1)!;
    expect(over.lines.map((l) => l.key)).toEqual(["booked", "planned", "over"]);
    expect(over.over).toBe(519);
    expect(over.perPerson).toBeNull();
    expect(over.note[1]).toBe("Tahmini toplam ~€1.019, bütçeyi €519 aşar.");
    const none = budgetView(bar({ total: null, uncounted: 1 }), 2)!;
    expect(none.total).toBeNull();
    expect(none.perPerson).toBeNull();
    expect(none.note).toEqual(["Karar bekleyenler seçilince yaklaşık €442 daha eklenir.", "1 fiyat sayılamadı."]);
  });

  it("is nothing with no budget and no price (no segment, C19)", () => {
    expect(budgetView(bar({ total: null, booked: 0, chosen: 0, open: 0 }), 2)).toBeNull();
    expect(budgetView(null, 2)).toBeNull();
  });
});

describe("factChips", () => {
  const facts = (over: Partial<import("../src/lib/tripFacts").TripFacts> = {}) => ({
    origin: null, adults: 2, country: "PT",
    visa: { kind: "visa" as const, label: "Schengen vizesi", link: "x" },
    local: { currency: "EUR", rateText: "€1 = ₺40,00", hours: -2, info: { currency: "EUR", language: { tr: "Portekizce", en: "Portuguese" }, timeZone: "Europe/Lisbon", plugs: ["C", "F"] } },
    ...over,
  });
  it("names the country, its money, plug, time and language, and the visa to get in amber", () => {
    const chips = factChips({ facts: facts(), countries: ["Portekiz"], cities: ["Porto", "Lizbon"], weather: { text: "13–24°", tip: "…" }, home: "TR", visaDone: false });
    expect(chips.map((c) => c.text)).toEqual(["Portekiz", "13–24°", "Euro", "C/F priz", "−2 saat", "Portekizce", "Schengen vizesi gerekiyor"]);
    expect(chips[0].tip).toBe("Porto, Lizbon · 2 şehir");
    expect(chips[2].tip).toBe("€1 = ₺40,00");
    expect(chips[3].tip).toBe("Adaptör gerekmez · Türkiye C/F kullanıyor");
    expect(chips[4].tip).toBe("Sende 12:00 iken orada 10:00. Uçuş saatleri yerel saattir.");
    expect(chips[5].tip).toBeNull();
    expect(chips[6]).toMatchObject({ tone: "warn", tip: "Türk pasaportuyla Schengen vizesi gerekir. Nereye başvurulacağı resmî kaynakta." });
  });

  it("says a visa got, a visa-free stay, several countries; nothing that isn't known", () => {
    expect(factChips({ facts: facts(), countries: ["Portekiz"], cities: [], weather: null, home: "TR", visaDone: true }).at(-1)).toMatchObject({ text: "Vize alındı", tone: "ok" });
    const free = factChips({ facts: facts({ visa: { kind: "free", label: "Vizesiz · 90 gün", days: 90, link: "x" } }), countries: ["Japonya"], cities: ["Tokyo"], weather: null, home: "TR", visaDone: false });
    expect(free.at(-1)).toMatchObject({ text: "Vize gerekmiyor", tip: "Türk pasaportuyla 90 güne kadar vizesiz", tone: "ok" });
    const two = factChips({ facts: facts({ local: null, visa: null }), countries: ["Portekiz", "İspanya"], cities: ["Porto", "Madrid"], weather: null, home: "TR", visaDone: false });
    expect(two).toEqual([{ key: "country", text: "2 ülke", tip: "Portekiz, İspanya · Porto, Madrid · 2 şehir" }]);
    expect(factChips({ facts: facts({ local: null, visa: { kind: "unknown", label: "Resmi kaynağa bak", link: "x" } }), countries: [], cities: [], weather: null, home: "TR", visaDone: false })).toEqual([]);
  });
});

describe("heroLine", () => {
  const counts = heroCounts(of([["booked", 2], ["chosen", 1], ["deciding", 4]]));
  const view = { currency: "EUR", likely: 1019, total: 1500, over: 0, lines: [], perPerson: null, note: [] };
  it("folds the summary into one line, leaving out what isn't known", () => {
    const range = { start: "2026-10-08", end: "2026-10-14" };
    expect(heroLine({ range, estimated: false, people: 2, counts, budget: view })).toBe("8–14 Ekim · 2 kişi · %43 planda · ~€1.019 / €1.500");
    expect(heroLine({ range, estimated: true, people: 2, counts, budget: view, short: true })).toBe("~8–14 Eki · 2 kişi");
    expect(heroLine({ range: null, estimated: false, people: 0, counts: heroCounts(of([["suggested", 2], ["searching", 1]])), budget: null })).toBe("3 ihtiyaç · 2'sinde önerimiz var");
  });
});
