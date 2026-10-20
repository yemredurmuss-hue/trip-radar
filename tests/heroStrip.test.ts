// The hero strip's words (lib/heroStrip.ts, v83 B9, C19, Etsy T5): the two shares and their sentence with the Turkish
// endings, a new backbone's line, the dates' tip (and only the nights for a guessed start, D15), the weather chip, the
// budget window and each person's share, a budget typed in (D16), the bookings without their file (B15), each country of
// a trip of several (D9).
import { describe, expect, it } from "vitest";
import type { CityWeather } from "../src/lib/climate";
import { withLang } from "../src/lib/i18n";
import type { IntentStatus } from "../src/lib/intents";
import { budgetAmount, budgetView, budgetWords, countryRows, datesTip, datesWords, heroDatesWords, docsMissing, docsWords, factChips, freshWords, heroCounts, heroLine, nextParts, numberLocative, readyWords, shareSentence, shareWords, shortRange, weatherChip, whereLine, whoWords } from "../src/lib/heroStrip";
import type { CountryFacts } from "../src/lib/tripFacts";
import type { BudgetBar } from "../src/lib/progress";

// A Dahil box counts as what covers it (spec §1.3): here a pass already bought (Hakone Free Pass), so it is alındı.
const PASS_BOUGHT = { key: null, itemId: "pass", by: "Hakone Free Pass ile", open: "Pass'i aç", status: "booked" as const };
const of = (list: [IntentStatus, number][]) =>
  list.flatMap(([status, n]) => Array.from({ length: n }, () => ({ status, cover: status === "included" ? PASS_BOUGHT : null })));

describe("heroCounts and its words", () => {
  // The v83 prototype's own numbers: 18 needs, 11 planned, 6 booked, 7 to decide.
  const japan = heroCounts(of([["booked", 4], ["arranged", 1], ["chosen", 5], ["included", 1], ["suggested", 3], ["deciding", 3], ["searching", 1], ["skipped", 2]]));
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
    expect(chip?.text).toBe("12° / 24°");
    expect(chip?.sky).toBe("sun");
    expect(chip?.tip).toMatch(/^Porto · Ekim ortalaması, son 5 yıl: gündüz 21°, gece 13° · yağışlı gün 2\/4 · Lizbon/);
    expect(weatherChip([], "Ekim")).toBeNull();
  });

  it("writes a frost with a real minus sign, one temperature once (A · Kapak)", () => {
    expect(weatherChip([w("Tromsø", -12, -3, "cloud")], "Ocak")?.text).toBe("−12° / −3°");
    expect(weatherChip([w("Senja", -5, 2, "cloud")], "Ocak")?.text).toBe("−5° / 2°");
    expect(weatherChip([w("Porto", 18, 18, "sun")], "Ekim")?.text).toBe("18°");
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
    expect(v.sign).toBe("~");
    // D17: converted from another money, the likely total is said with "≈".
    expect(budgetView(bar({ converted: true }), 2)!.sign).toBe("≈");
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
    expect(chips.map((c) => c.text)).toEqual(["Portekiz", "13–24°", "Euro", "C/F priz", "−2 sa", "Portekizce", "Schengen vizesi gerekiyor"]);
    // A · Kapak: the plug's types for its socket, the language's country for its flag.
    expect(chips[3].plugs).toEqual(["C", "F"]);
    expect(chips[5].flag).toBe("PT");
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
    // 0.39.1: Indonesia's visa on arrival, amber until marked.
    const voa = { kind: "arrival" as const, label: "Varışta vize ya da e-VOA", days: 30, link: "x" };
    expect(factChips({ facts: facts({ visa: voa }), countries: ["Endonezya"], cities: [], weather: null, home: "TR", visaDone: false }).at(-1)).toMatchObject({ text: "Varışta vize ya da e-VOA", tip: "30 güne kadar · ücretli", tone: "warn" });
    expect(factChips({ facts: facts({ visa: voa }), countries: ["Endonezya"], cities: [], weather: null, home: "TR", visaDone: true }).at(-1)).toMatchObject({ text: "Vize alındı", tone: "ok" });
    const two = factChips({ facts: facts({ local: null, visa: null }), countries: ["Portekiz", "İspanya"], cities: ["Porto", "Madrid"], weather: null, home: "TR", visaDone: false });
    expect(two).toEqual([{ key: "country", text: "2 ülke", tip: "Portekiz, İspanya · Porto, Madrid · 2 şehir" }]);
    expect(factChips({ facts: facts({ local: null, visa: { kind: "unknown", label: "Resmi kaynağa bak", link: "x" } }), countries: [], cities: [], weather: null, home: "TR", visaDone: false })).toEqual([]);
  });
});

describe("heroLine", () => {
  const counts = heroCounts(of([["booked", 2], ["chosen", 1], ["deciding", 4]]));
  const view = { currency: "EUR", sign: "~" as const, likely: 1019, total: 1500, over: 0, lines: [], perPerson: null, note: [] };
  it("folds the summary into one line, leaving out what isn't known", () => {
    const range = { start: "2026-10-08", end: "2026-10-14" };
    expect(heroLine({ range, estimated: false, people: 2, counts, budget: view })).toBe("8–14 Ekim · 2 kişi · %43 planda · ~€1.019 / €1.500");
    expect(heroLine({ range, estimated: true, people: 2, counts, budget: view, short: true })).toBe("~8–14 Eki · 2 kişi");
    expect(heroLine({ range: null, estimated: false, people: 0, counts: heroCounts(of([["suggested", 2], ["searching", 1]])), budget: null })).toBe("3 ihtiyaç · 2'sinde önerimiz var");
    // D17: sums converted from another money are said with "≈".
    expect(heroLine({ range: null, estimated: false, people: 0, counts, budget: { ...view, currency: "JPY", sign: "≈", likely: 160000, total: null } })).toBe("%43 planda · ≈¥160.000");
  });
});

describe("D15: a start guessed from a month or a season says only the nights", () => {
  const range = { start: "2027-07-01", end: "2027-07-11" };
  it("is \"~ · 10 gece\" in the strip and in the folded line, the real dates otherwise", () => {
    expect(datesWords({ range, estimated: false, rough: true })).toBe("~ · 10 gece");
    expect(datesWords({ range, estimated: true })).toBe("~1–11 Temmuz");
    // The hero's big value: the month written out within one month, short across two (it ran over the people).
    expect(heroDatesWords({ range: { start: "2026-10-08", end: "2026-10-14" }, estimated: false })).toBe("8–14 Ekim");
    expect(heroDatesWords({ range: { start: "2026-11-24", end: "2026-12-03" }, estimated: false })).toBe("24 Kas – 3 Ara");
    // A guess from a month: the nights alone (no lone "~ ·").
    expect(heroDatesWords({ range, estimated: false, rough: true })).toBe("10 gece");
    expect(datesWords({ range, estimated: false }, true)).toBe("1–11 Tem");
    const counts = heroCounts(of([["booked", 1]]));
    expect(heroLine({ range, estimated: false, rough: true, people: 2, counts, budget: null, short: true })).toBe("~ · 10 gece · 2 kişi");
    expect(withLang("en", () => datesWords({ range, estimated: false, rough: true }))).toBe("~ · 10 nights");
  });
});

describe("B15: the bookings without their file in their last two weeks", () => {
  const vm = (status: IntentStatus, docMissing: boolean | null) => ({ status, access: docMissing == null ? null : { docMissing } });
  it("counts only a booking whose box says \"belge yok\"", () => {
    expect(docsMissing([vm("booked", true), vm("booked", false), vm("chosen", null), vm("booked", null), vm("booked", true)])).toHaveLength(2);
    expect(docsWords(2).text).toBe("2 belge yok");
    expect(docsWords(1).tip).toBe("1 rezervasyonun belgesi eklenmedi; 14 gün içinde başlıyor. Basınca ilkine gider.");
    expect(withLang("en", () => docsWords(1).text)).toBe("1 file missing");
  });
});

describe("D16: a budget typed in the window", () => {
  it("reads a whole amount with any thousands mark, nothing else", () => {
    expect(budgetAmount("1500")).toBe(1500);
    expect(budgetAmount("1.500")).toBe(1500);
    expect(budgetAmount("1 500 €")).toBe(1500);
    expect(budgetAmount("€1,500.50")).toBe(1501);
    expect(budgetAmount("2.500,75")).toBe(2501);
    expect(budgetAmount("12.000.000")).toBe(12000000);
    expect(budgetAmount("")).toBeNull();
    expect(budgetAmount("abc")).toBeNull();
    expect(budgetAmount("0")).toBeNull();
  });
});

describe("D9: each country of a trip of several", () => {
  const pt: CountryFacts = {
    country: "PT",
    visa: { kind: "visa", label: "Schengen vizesi", link: "x" },
    local: { currency: "EUR", rateText: null, hours: -2, info: { currency: "EUR", language: { tr: "Portekizce", en: "Portuguese" }, timeZone: "Europe/Lisbon", plugs: ["C", "F"] } },
  };
  const ma: CountryFacts = {
    country: "MA",
    visa: { kind: "free", label: "Vizesiz · 90 gün", days: 90, link: "x" },
    local: { currency: "MAD", rateText: null, hours: -2, info: { currency: "MAD", language: { tr: "Arapça", en: "Arabic" }, timeZone: "Africa/Casablanca", plugs: [] } },
  };
  const xx: CountryFacts = { country: "XX", visa: { kind: "unknown", label: "Resmi kaynağa bak", link: "x" }, local: null };
  it("a row for each with its money, clock, plug and visa; a country nothing is known of has none", () => {
    const rows = countryRows([pt, ma, xx], ["Portekiz", "Fas", "Bilinmez"], false);
    expect(rows.map((r) => [r.name, r.parts])).toEqual([
      ["Portekiz", ["Euro", "−2 saat", "C/F priz", "Schengen vizesi gerekiyor"]],
      ["Fas", [expect.stringMatching(/Dirhem/i), "−2 saat", "Vizesiz · 90 gün"]],
    ]);
    expect(countryRows([pt], ["Portekiz"], true)[0].parts.at(-1)).toBe("Schengen vizesi alındı");
  });
  it("puts them under the \"n ülke\" chip", () => {
    const facts = { origin: null, adults: 2, country: "PT", visa: pt.visa, local: pt.local };
    const chips = factChips({ facts, countries: ["Portekiz", "Fas"], cities: ["Lizbon", "Marakeş"], weather: null, home: "TR", visaDone: false, perCountry: [pt, ma] });
    expect(chips[0]).toMatchObject({ key: "country", text: "2 ülke" });
    expect(chips[0].rows?.map((r) => r.name)).toEqual(["Portekiz", "Fas"]);
  });
});

// A · Kapak (2026-10-19): the summary card's words and the line over the trip's name.
describe("the summary card under the photo", () => {
  it("says who goes: the count big, the names under it, \"Sadece sen\" alone, \"kişi\" with no names", () => {
    expect(whoWords({ names: [], count: 0 })).toEqual({ count: null, line: "Kimler gidiyor?" });
    expect(whoWords({ names: ["Emre"], count: 1 })).toEqual({ count: "1", line: "Sadece sen" });
    expect(whoWords({ names: ["Emre", "Sabine"], count: 2 })).toEqual({ count: "2", line: "Sen ve Sabine" });
    expect(whoWords({ names: ["Emre", "Sabine", "Ali"], count: 3 })).toEqual({ count: "3", line: "Sen, Sabine ve Ali" });
    expect(whoWords({ names: ["Emre", "Sabine"], count: 4 })).toEqual({ count: "4", line: "Sen, Sabine +2" });
    expect(whoWords({ names: [], count: 2 })).toEqual({ count: "2", line: "kişi" });
    expect(withLang("en", () => whoWords({ names: ["Emre", "Sabine"], count: 2 }).line)).toBe("You and Sabine");
    expect(withLang("en", () => whoWords({ names: ["Emre"], count: 1 }).line)).toBe("Just you");
  });

  it("says ready: the planned share big, what's booked and still to book under the bar", () => {
    const japan = heroCounts(of([["booked", 4], ["arranged", 1], ["chosen", 5], ["included", 1], ["suggested", 3], ["deciding", 3], ["searching", 1], ["skipped", 2]]));
    expect(readyWords(japan)).toEqual({ pct: "%61", line: "%33 alındı · 5 alınacak" });
    expect(withLang("en", () => readyWords(japan))).toEqual({ pct: "61%", line: "33% booked · 5 to book" });
    expect(readyWords(heroCounts(of([["booked", 3]])))).toEqual({ pct: "%100", line: "%100 alındı" });
    // Nothing booked yet: only what's still to book ("%0 alındı" says nothing).
    expect(readyWords(heroCounts(of([["chosen", 2], ["deciding", 9]])))).toEqual({ pct: "%18", line: "2 alınacak" });
  });

  it("says what's left of the budget, how much over it, or that the total is an estimate", () => {
    expect(budgetWords({ currency: "EUR", likely: 2980, total: 3500, over: 0 })).toBe("€3.500 bütçeden €520 kaldı");
    expect(withLang("en", () => budgetWords({ currency: "EUR", likely: 2980, total: 3500, over: 0 }))).toBe("€520 left of €3,500");
    expect(budgetWords({ currency: "EUR", likely: 1800, total: 1500, over: 300 })).toBe("€1.500 bütçeyi €300 aşıyor");
    expect(budgetWords({ currency: "EUR", likely: 1003, total: null, over: 0 })).toBe("tahmini");
  });

  it("splits the next step into \"Sıradaki\" and the step itself, whole", () => {
    expect(nextParts("Sıradaki: vize randevusu")).toEqual({ head: "Sıradaki", text: "Vize randevusu" });
    expect(nextParts("Next: Book your stay in Ravello")).toEqual({ head: "Next", text: "Book your stay in Ravello" });
    expect(nextParts("İlk kaydı ekle")).toEqual({ head: "Sıradaki", text: "İlk kaydı ekle" });
  });

  it("writes the places over the name, with the country when there is one", () => {
    expect(whereLine(["Tromsø", "Senja"], ["Norveç"])).toBe("Tromsø · Senja, Norveç");
    expect(whereLine(["Porto", "Madrid"], ["Portekiz", "İspanya"])).toBe("Porto · Madrid");
    expect(whereLine([], ["Japonya"])).toBe("Japonya");
    expect(whereLine([], [])).toBe("");
    // What the cover says already is left out: the places on the route, the country in the name.
    expect(whereLine(["Tokyo", "Kyoto"], ["Japonya"], { title: "10 Günlük Japonya Kültür Gezisi", route: ["Tokyo", "Kyoto"] })).toBe("");
    expect(whereLine(["Tokyo", "Kyoto", "Nara"], ["Japonya"], { title: "Bahar gezisi", route: ["Tokyo", "Kyoto"] })).toBe("Nara, Japonya");
    expect(whereLine(["Porto", "Lizbon"], ["Portekiz"], { title: "Portekiz (örnek)", route: [] })).toBe("Porto · Lizbon");
  });
});
