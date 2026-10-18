// Hazırlık's Bavul (lib/prepPack.ts, v82 aşama 7, Etsy T6 a): the trip's own list when there's no AI (only what the trip
// says), the AI's answer checked, the list on screen (records in place, answers, "bana göre değil", the traveller's own),
// the counts and the folded line's words, and the traveller's lists in storage.
import { describe, expect, it } from "vitest";
import type { CityWeather } from "../src/lib/climate";
import { withLang } from "../src/lib/i18n";
import {
  acceptPack,
  bagFact,
  drivesOnTrip,
  isPackLine,
  kindWord,
  loadPackMine,
  packCount,
  packKey,
  packPrompt,
  packSub,
  packView,
  planNames,
  rulesAsk,
  rulesPack,
  savePackMine,
  stayCities,
  tripDays,
  withName,
  type PackAnswer,
  type PackFacts,
} from "../src/lib/prepPack";
import { memoryKV } from "../src/lib/share/store";
import type { Item } from "../src/lib/types";
import { visaFor } from "../src/lib/visa";
import { makeItem } from "./fixtures/makeItem";

const prep = (name: string, over: Partial<Item> = {}) => makeItem({ category: "other", needKey: `other:prep-${name}`, name, plannedKind: "prep", origin: "chat", status: "chosen", booking: "none", ...over });
const w = (city: string, low: number, high: number, rainy = 0, days = 6): CityWeather => ({ city, low, high, rainy, days, sky: "partly", source: "average" });
const facts = (over: Partial<PackFacts> = {}): PackFacts => ({
  weather: [],
  range: { start: "2027-04-01", end: "2027-04-16" },
  kind: null,
  country: "JP",
  countryName: "Japonya",
  home: "TR",
  plug: "adapter",
  visa: null,
  money: "Japon Yeni",
  driving: false,
  ...over,
});

describe("what's a Bavul line", () => {
  it("a bare thing said as Hazırlık; a chore, one moved by hand, a page are not", () => {
    expect(isPackLine(prep("Çadır"))).toBe(true);
    expect(isPackLine(prep("Kulak tıkacı"))).toBe(true);
    expect(isPackLine(prep("Decathlon'dan yağmurluk al"))).toBe(false);
    expect(isPackLine(prep("Döviz bozdur"))).toBe(false);
    expect(isPackLine(prep("Dom Luís'te gün batımı", { plannedKind: "todo", category: "activity", prep: true }))).toBe(false);
    expect(isPackLine(prep("Şemsiye", { prep: true }))).toBe(false);
  });

  it("a line's key is its words, case and spacing aside", () => {
    expect(packKey("  Priz  Dönüştürücü. ")).toBe(packKey("priz dönüştürücü"));
    expect(withName(["Kulaklık"], "kulaklık ", true)).toEqual(["kulaklık"]);
    expect(withName(["Kulaklık", "Uyku maskesi"], "KULAKLIK", false)).toEqual(["Uyku maskesi"]);
  });
});

describe("the trip's own list (no AI)", () => {
  it("the weather read: its range and the rainy city in the title, what it asks for with why", () => {
    const [g] = rulesPack(facts({ weather: [w("Tokyo", 9, 19), w("Kyoto", 6, 18, 3)], plug: null, money: null, home: "JP" }));
    expect(g.title).toBe("Hava · 6–19°, Kyoto'da yağmur");
    expect(g.lines).toEqual([
      { name: "Yağmurluk", why: "Kyoto için", buy: false },
      { name: "Kalın mont", why: "akşamları 6°", buy: false },
      { name: "Kat kat giyim", why: null, buy: false },
    ]);
    const hot = rulesPack(facts({ weather: [w("Ozora", 15, 29)], plug: null, money: null, home: "JP" }))[0];
    expect(hot.lines.map((l) => l.name)).toEqual(["İnce mont", "Güneş kremi, şapka", "Kat kat giyim"]);
    expect(withLang("en", () => rulesPack(facts({ weather: [w("Kyoto", 6, 18, 3)], plug: null, money: null, home: "JP" }))[0].title)).toBe("Weather · 6–18°, rain in Kyoto");
  });

  it("no weather read, no weather group (nothing guessed)", () => {
    expect(rulesPack(facts()).map((g) => g.title)).toEqual(["Elektronik", "Belgeler ve para"]);
  });

  it("the kind's own lines under its word; the plug adapter to buy; the papers and the money", () => {
    const groups = rulesPack(facts({ kind: { title: "Festival", lines: ["Çadır", "Kafa lambası"] }, country: "HU", countryName: "Macaristan", plug: "fits", visa: visaFor("TR", "HU"), money: "Macar Forinti", driving: true }));
    expect(groups.map((g) => g.title)).toEqual(["Festival", "Belgeler ve para"]);
    expect(groups[1].lines.map((l) => l.name)).toEqual(["Pasaport", "Schengen vizesi", "Ehliyet", "Kart ve biraz Macar Forinti"]);
    const plug = rulesPack(facts())[0];
    expect(plug.lines).toEqual([{ name: "Priz dönüştürücü (A tipi)", why: "Japonya A ve B tipi", buy: true }]);
    // At home: no passport, no money line.
    expect(rulesPack(facts({ country: "TR", home: "TR", plug: "fits", money: null }))).toEqual([]);
  });

  it("a long trip asks about washing; its answers add their lines", () => {
    expect(tripDays({ start: "2027-04-01", end: "2027-04-16" })).toBe(16);
    expect(rulesAsk({ start: "2026-10-08", end: "2026-10-14" })).toEqual([]);
    const [q] = rulesAsk({ start: "2027-04-01", end: "2027-04-16" });
    expect(q.text).toBe("16 günde çamaşır yıkayacak mısın?");
    expect(q.options.map((o) => o.label)).toEqual(["Evet", "Hayır"]);
    expect(q.options[1].add[0].name).toBe("16 günlük iç çamaşırı ve çorap");
  });

  it("the bag from the first booked or chosen flight that says it, with its kilos when written", () => {
    const tk = makeItem({ category: "flight", status: "booked", optionDetail: "EcoFly (23 kg bagaj)", metrics: { checkedBagIncluded: true } as Item["metrics"], flight: { from: "KIX", to: "IST", departure: "2027-04-16T11:00", arrival: null, carrier: "THY", flightNumber: "TK49", stops: 0 } });
    expect(bagFact([tk])).toBe("Valiz · 23 kg · bagaj dahil (TK49)");
    expect(bagFact([{ ...tk, optionDetail: null, metrics: { checkedBagIncluded: false } as Item["metrics"] }])).toBe("Yalnız kabin bagajı (TK49)");
    expect(bagFact([{ ...tk, status: "saved" }])).toBeNull();
    expect(bagFact([{ ...tk, metrics: undefined }])).toBeNull();
  });

  it("what the trip holds: the cities slept in, the plan's names, a car rented, the kind's word", () => {
    const stay = (city: string, start: string) => makeItem({ category: "stay", city, status: "booked", dates: { start, end: start, source: "page" } });
    expect(stayCities([stay("Kyoto", "2027-04-06"), stay("Tokyo", "2027-04-01"), stay("tokyo", "2027-04-03")])).toEqual(["Tokyo", "Kyoto"]);
    const tour = makeItem({ category: "activity", name: "Fushimi Inari turu", status: "chosen" });
    const camp = makeItem({ category: "stay", metrics: { stayKind: "camp" } as Item["metrics"] });
    expect(planNames([tour, camp, makeItem({ category: "activity", name: "Bir fikir", status: "saved" })])).toEqual(["Fushimi Inari turu", "stay: camp"]);
    expect(drivesOnTrip([makeItem({ category: "transport", plannedKind: "car_rental", status: "chosen" })])).toBe(true);
    expect(drivesOnTrip([tour])).toBe(false);
    expect(kindWord({ playbook: "festival" })).toBe("Festival");
    expect(kindWord({ playbook: "classic" })).toBeNull();
    expect(kindWord({ playbook: "custom", label: "Liveaboard dalış" })).toBe("Liveaboard dalış");
  });
});

describe("the list on screen", () => {
  const groups = [
    { title: "Hava", lines: [{ name: "Yağmurluk", why: "Kyoto için", buy: true }, { name: "İnce mont", why: null, buy: false }] },
    { title: "Elektronik", lines: [{ name: "Priz dönüştürücü", why: null, buy: true }, { name: "Kulaklık", why: null, buy: false }, { name: "yağmurluk", why: null, buy: false }] },
  ];
  const ask = rulesAsk({ start: "2027-04-01", end: "2027-04-16" });

  it("each line once; the ticked ones; the counts: ready, all, still to buy", () => {
    const v = packView({ groups, ask, answers: {}, ready: [packKey("İnce mont"), packKey("Priz dönüştürücü")], records: [], recordsTitle: "Eklediklerin", never: [], always: [] });
    expect(v.groups.map((g) => g.rows.map((r) => r.name))).toEqual([["Yağmurluk", "İnce mont"], ["Priz dönüştürücü", "Kulaklık"]]);
    expect(v).toMatchObject({ total: 4, ready: 2, toBuy: 1 });
    expect(packCount(v)).toBe("2/4 hazır · 1 alınacak");
    expect(withLang("en", () => packCount(v))).toBe("2/4 packed · 1 to buy");
    expect(packCount({ ...v, toBuy: 0 })).toBe("2/4 hazır");
    expect(v.asks).toEqual([{ id: "laundry", text: "16 günde çamaşır yıkayacak mısın?", options: ["Evet", "Hayır"], answer: null }]);
  });

  it("'bana göre değil' is never suggested again; what's taken every trip is shown apart, not counted", () => {
    const v = packView({ groups, ask: [], answers: {}, ready: [], records: [], recordsTitle: "Eklediklerin", never: ["yağmurluk"], always: ["KULAKLIK"] });
    expect(v.groups.map((g) => g.rows.map((r) => r.name))).toEqual([["İnce mont"], ["Priz dönüştürücü"]]);
    expect(v.total).toBe(2);
  });

  it("a Hazırlık record takes the place of its line (ticked on itself), the rest under their group; never hides no record", () => {
    const tent = prep("Yağmurluk", { doneAt: 4 });
    const plugs = prep("Kulak tıkacı");
    const v = packView({ groups, ask: [], answers: {}, ready: [], records: [tent, plugs], recordsTitle: "Festival", never: ["yağmurluk", "kulak tıkacı"], always: [] });
    const rain = v.groups[0].rows[0];
    expect(rain).toMatchObject({ name: "Yağmurluk", ready: true, item: tent, buy: true });
    expect(v.groups.at(-1)).toMatchObject({ title: "Festival", rows: [{ name: "Kulak tıkacı", ready: false, item: plugs }] });
  });

  it("an answer adds its lines under 'Cevaplarına göre'", () => {
    const v = packView({ groups, ask, answers: { laundry: "Hayır" }, ready: [], records: [], recordsTitle: "Eklediklerin", never: [], always: [] });
    expect(v.asks[0].answer).toBe("Hayır");
    expect(v.groups.at(-1)).toMatchObject({ title: "Cevaplarına göre", rows: [{ name: "16 günlük iç çamaşırı ve çorap" }] });
  });

  it("the folded line: whose list and what it goes by, only what's known", () => {
    expect(packSub({ name: "Emre", month: "Nisan", weather: true, days: 16, kind: null, places: true })).toBe("Emre için · Nisan havası, 16 gün, plandaki yerler");
    expect(packSub({ name: null, month: "Nisan", weather: false, days: 8, kind: "festival", places: false })).toBe("8 gün, festival");
    expect(withLang("en", () => packSub({ name: "Emre", month: "April", weather: true, days: 1, kind: null, places: false }))).toBe("For Emre · April weather, 1 day");
    expect(packSub({ name: "", month: null, weather: false, days: 0, kind: null, places: false })).toBe("");
  });
});

describe("the AI's list, made once", () => {
  const raw = (over: Partial<PackAnswer> = {}): PackAnswer => ({
    groups: [
      { title: "Hava · 6–19°", lines: [{ name: "Yağmurluk", why: "Kyoto için", buy: true }, { name: " ", why: null, buy: false }, { name: "yağmurluk", why: null, buy: false }] },
      { title: "", lines: [{ name: "Lost", why: null, buy: false }] },
      { title: "Elektronik", lines: [{ name: "Priz dönüştürücü https://amzn.to/x", why: "A tipi", buy: true }, { name: "Uyku maskesi", why: null, buy: false }] },
    ],
    ask: [
      { id: "laundry", text: "Çamaşır yıkayacak mısın?", options: [{ label: "Evet", add: [{ name: "Deterjan", why: null, buy: false }] }, { label: "Hayır", add: [] }] },
      { id: "one", text: "Tek seçenek?", options: [{ label: "Evet", add: [] }] },
    ],
    tips: [{ label: "Bahşiş", text: "Verilmez; bırakırsan geri getirebilirler." }, { label: "", text: "boş" }],
    ...over,
  });

  it("kept within its limits: each line once, no link, never-said lines out, empty groups and one-answer questions dropped", () => {
    const list = acceptPack(raw(), 9, ["Uyku maskesi"])!;
    expect(list.at).toBe(9);
    expect(list.groups).toEqual([
      { title: "Hava · 6–19°", lines: [{ name: "Yağmurluk", why: "Kyoto için", buy: true }] },
      { title: "Elektronik", lines: [{ name: "Priz dönüştürücü", why: "A tipi", buy: true }] },
    ]);
    expect(list.ask.map((a) => a.id)).toEqual(["laundry"]);
    expect(list.tips).toEqual([{ label: "Bahşiş", text: "Verilmez; bırakırsan geri getirebilirler." }]);
  });

  it("nothing left: no list (the trip's own stands)", () => {
    expect(acceptPack(raw({ groups: [{ title: "x", lines: [] }] }), 1)).toBeNull();
  });

  it("at most 30 lines, 8 a group, 6 groups, 2 questions, 4 notes", () => {
    const many = Array.from({ length: 9 }, (_, g) => ({ title: `G${g}`, lines: Array.from({ length: 10 }, (_, i) => ({ name: `L${g}-${i}`, why: null, buy: false })) }));
    const list = acceptPack(raw({ groups: many, tips: Array.from({ length: 6 }, (_, i) => ({ label: `T${i}`, text: "x" })) }), 1)!;
    expect(list.groups.length).toBeLessThanOrEqual(6);
    expect(Math.max(...list.groups.map((g) => g.lines.length))).toBe(8);
    expect(list.groups.reduce((n, g) => n + g.lines.length, 0)).toBe(30);
    expect(list.tips).toHaveLength(4);
  });

  it("the model is told the trip's facts only, and what never to suggest", () => {
    const text = packPrompt({ countries: ["JP"], cities: ["Tokyo 2027-04-01–2027-04-05"], range: { start: "2027-04-01", end: "2027-04-16" }, people: 2, kind: null, weather: [w("Kyoto", 6, 18, 3)], plan: ["Fushimi Inari turu"], bag: "Valiz · bagaj dahil (TK49)", plug: "A/B (an adapter is needed)", home: "TR", never: ["Yağmurluk"], always: ["Kulaklık"] });
    expect(text).toContain("dates: 2027-04-01 – 2027-04-16 (16 days)");
    expect(text).toContain("weather Kyoto: 6–18°C, rain on 3/6 days (average)");
    expect(text).toContain("never: Yağmurluk");
    expect(text).toContain("always: Kulaklık");
    expect(text).not.toContain("kind:");
  });
});

describe("the traveller's own lists", () => {
  it("kept in storage, read back clean", async () => {
    const kv = memoryKV();
    expect(await loadPackMine(kv)).toEqual({ always: [], never: [] });
    await savePackMine({ always: ["Kulaklık"], never: ["Yağmurluk"] }, kv);
    expect(await loadPackMine(kv)).toEqual({ always: ["Kulaklık"], never: ["Yağmurluk"] });
    await kv.set("packMine", { always: ["  ", 3, "Uyku maskesi"], never: "x" });
    expect(await loadPackMine(kv)).toEqual({ always: ["Uyku maskesi"], never: [] });
  });
});
