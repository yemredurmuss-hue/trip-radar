// 0.38.3, Emre's Sri Lanka / Ahangama trip (live 0.38.1): the hero had only the weather and the style words, no money,
// plug, time or language (Sri Lanka wasn't in the country table, nor its emergency numbers in Hazırlık); the mosaic never
// took the source's tour photos; the closed rows' small pictures were drawings. Each part as it is now.
import { describe, expect, it } from "vitest";
import { COUNTRIES, countryInfo } from "../src/lib/countries";
import { needKey } from "../src/lib/emptyCards";
import { mosaicOf, offerTiles, tourNeeds, type MosaicPlace } from "../src/lib/heroMosaic";
import { factChips } from "../src/lib/heroStrip";
import { withLang } from "../src/lib/i18n";
import { rowThumbs } from "../src/lib/intentFrame";
import type { IntentVM } from "../src/lib/intents";
import { EMPTY_METRICS } from "../src/lib/items";
import { emergencyText, knowRows } from "../src/lib/prepKnow";
import { tripFacts } from "../src/lib/tripFacts";
import type { Item } from "../src/lib/types";

const DATES = { start: "2026-11-02", end: "2026-11-09" };

const item = (over: Partial<Item>): Item => ({
  id: "lk", tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:ahangama", name: "Ahangama Konaklama",
  provider: null, summary: "", optionDetail: null, url: null, imageUrl: null, city: "Ahangama", country: "Sri Lanka", countryCode: "LK",
  location: { address: null, area: null, approximate: false }, dates: { ...DATES, source: "user" },
  guests: { adults: 2, children: null, rooms: null },
  price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "unknown", observedAt: 0 },
  priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "unknown" },
  rating: { value: null, scale: null, count: null, source: "unknown" }, flight: null, metrics: EMPTY_METRICS,
  highlights: [], concerns: [], reviewSummary: null, missing: [], status: "chosen", statusNote: null, createdAt: 0, updatedAt: 0,
  ...over,
}) as Item;

describe("the hero's chips on a Sri Lanka trip", () => {
  const facts = tripFacts([item({})], { passport: "TR", homeCurrency: "TRY", rates: null, homeZone: "Europe/Istanbul", start: DATES.start });

  it("knows Sri Lanka: rupee, D and G plugs, Colombo's clock, Sinhala and Tamil", () => {
    expect(countryInfo("LK")).toEqual({ currency: "LKR", language: { tr: "Sinhalaca, Tamilce", en: "Sinhala, Tamil" }, timeZone: "Asia/Colombo", plugs: ["D", "G"] });
    expect(facts.local?.hours).toBe(2.5);
  });

  it("money, plug, time and language beside the weather and the visa", () => {
    const chips = factChips({ facts, countries: ["Sri Lanka"], cities: ["Ahangama"], weather: { text: "23–29°", tip: "" }, home: "TR", visaDone: false });
    expect(chips.map((c) => [c.key, c.text])).toEqual([
      ["country", "Sri Lanka"],
      ["weather", "23–29°"],
      ["money", "Sri Lanka rupisi"],
      ["plug", "D/G priz"],
      ["time", "+2,5 sa"],
      ["lang", "Sinhalaca, Tamilce"],
      ["visa", "Sri Lanka ETA (elektronik vize) gerekiyor"],
    ]);
    // The Turkish C/F plugs don't go in D or G.
    expect(chips.find((c) => c.key === "plug")?.tip).toBe("Adaptör gerekir · Türkiye C/F kullanıyor");
    expect(withLang("en", () => factChips({ facts, countries: ["Sri Lanka"], cities: [], weather: null, home: "TR", visaDone: false }).find((c) => c.key === "lang")?.text)).toBe("Sinhala, Tamil");
  });

  it("a country whose plugs we can't vouch for has no plug chip, the rest stays (the Maldives)", () => {
    const mv = tripFacts([item({ city: "Malé", countryCode: "MV" })], { passport: "TR", homeCurrency: "TRY", rates: null, homeZone: "Europe/Istanbul", start: DATES.start });
    const keys = factChips({ facts: mv, countries: ["Maldivler"], cities: [], weather: null, home: "TR", visaDone: false }).map((c) => c.key);
    expect(keys).toEqual(["country", "money", "time", "lang"]);
  });

  it("the countries Turkish travellers often go to are in the table, each with a real zone", () => {
    for (const c of ["LK", "MV", "ID", "VN", "MX", "EG", "MA", "AE", "KR", "CN", "SG", "MY", "IN", "QA", "AZ", "RS", "BA", "MK", "AL", "ME", "BG", "CY", "TN", "BR", "CA", "AU", "PH", "KH"]) {
      const info = COUNTRIES[c];
      expect(info, c).toBeDefined();
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: info.timeZone }), c).not.toThrow();
      expect(() => new Intl.DisplayNames(["tr"], { type: "currency" }).of(info.currency), c).not.toThrow();
    }
  });
});

describe("Bilmen gerekenler: the emergency numbers", () => {
  it("Sri Lanka's by service", () => {
    expect(emergencyText("LK")).toBe("119 polis · 1990 ambulans · 110 itfaiye");
  });

  it("Sri Lanka then Bali: each country's by name", () => {
    const rows = knowRows({ countries: ["LK", "ID"], passport: "TR", money: { name: "Sri Lanka rupisi", rate: null, own: false }, plug: "adapter", tips: [] });
    expect(rows.map((r) => r.id)).toEqual(["emergency", "money", "plug", "embassy"]);
    expect(rows[0].text).toBe("Sri Lanka 119 polis · 1990 ambulans · 110 itfaiye · Endonezya 112 · 110 polis · 113 itfaiye");
    expect(rows[2].text).toBe("D ve G tipi · Adaptör gerekir");
  });

  it("the others added", () => {
    expect(emergencyText("MV")).toBe("119 polis · 102 ambulans · 118 itfaiye");
    expect(emergencyText("VN")).toBe("113 polis · 115 ambulans · 114 itfaiye");
    expect(emergencyText("MA")).toBe("19 polis · 15 ambulans ve itfaiye");
  });
});

describe("the hero's mosaic takes the source's tours", () => {
  const plan = {
    stayBlocks: [{ kind: "item", city: "Ahangama", item: item({}), range: DATES, nights: 7 }],
  } as never;

  it("asks what the Etkinlik row asks (the same key, so the source's store answers it): once a city, its country", () => {
    const asks = tourNeeds(plan, ["Ahangama", "ahangama", "Bali", null], 2);
    expect(asks).toEqual([
      { need: { key: needKey("activity", "Ahangama", DATES.start, DATES.end), section: "activity", kind: "activity", city: "Ahangama", start: DATES.start, end: DATES.end, adults: 2 }, country: "LK" },
    ]);
  });

  it("tours with a photo only, each once", () => {
    const tiles = offerTiles([{ city: "Ahangama", offers: [{ id: "v1", title: "Sörf dersi", photo: "v1.jpg" }, { id: "v2", title: "Galle turu", photo: null }, { id: "v1", title: "Sörf dersi", photo: "v1.jpg" }] }]);
    expect(tiles).toEqual([{ key: "v1", name: "Sörf dersi", city: "Ahangama", image: "v1.jpg", credit: null, booked: false }]);
  });

  it("the plan's and the saved records' photos first, the cities, the moments, the tours, a drawing last", () => {
    const place = (key: string, image: string): MosaicPlace => ({ key, name: key, city: "Ahangama", image, credit: null, booked: false });
    const m = mosaicOf({
      cities: [
        { name: "Ahangama", image: "a.jpg", credit: null, nights: "7 gece" },
        { name: "Kolombo", image: "k.jpg", credit: null, nights: "1 gece" },
        { name: "Bali", image: null, credit: null, nights: "5 gece" },
      ],
      places: [place("Villa", "villa.jpg")],
      links: [place("Kaydedilen kafe", "cafe.jpg")],
      offers: offerTiles([{ city: "Ahangama", offers: [{ id: "v1", title: "Sörf dersi", photo: "v1.jpg" }, { id: "v3", title: "Villa", photo: "v3.jpg" }] }]),
      moments: [{ name: "Gün batımı", image: "g.jpg", credit: null }],
    });
    expect(m.cover?.image).toBe("a.jpg");
    // The tour named as a place already shown isn't shown twice.
    // The start's moment after the cities, the source's tours (not on the plan) after it (2026-10-25), the city with no
    // photo drawn last.
    expect(m.tiles.map((t) => [t.from, t.name])).toEqual([["place", "Villa"], ["link", "Kaydedilen kafe"], ["city", "Kolombo"], ["moment", "Gün batımı"], ["offer", "Sörf dersi"], ["art", "Bali"]]);
    expect(m.kind).toBe("place");
  });

  it("no tour photo, no tile: nothing is made up", () => {
    const m = mosaicOf({ cities: [{ name: "Ahangama", image: "a.jpg", credit: null, nights: null }], places: [], offers: offerTiles([{ city: "Ahangama", offers: [{ id: "v2", title: "Galle", photo: null }] }]) });
    expect(m.tiles).toEqual([]);
  });
});

describe("the closed row's small pictures are real photos only", () => {
  const opt = (id: string, image: string | null) => ({ id, title: id, image, item: item({ id }) });
  const vm = (over: Partial<IntentVM>): IntentVM => ({ kind: "stay", status: "deciding", planned: [], chosen: null, options: [], ...over }) as IntentVM;

  it("no photo anywhere: no picture at all (never the kind's drawing)", () => {
    expect(rowThumbs([vm({ status: "chosen", chosen: opt("Ahangama Konaklama", null) as never }), vm({ status: "searching" })])).toEqual({ thumbs: [], more: 0 });
  });

  it("the chosen one's photo, an open need's first option with a photo; a chosen one without a photo doesn't borrow an option's", () => {
    const out = rowThumbs([
      vm({ status: "chosen", chosen: opt("Villa", "villa.jpg") as never }),
      vm({ status: "deciding", options: [opt("A", null), opt("B", "b.jpg"), opt("C", "c.jpg")] as never }),
      vm({ status: "chosen", chosen: opt("Bali Konaklama", null) as never, options: [opt("D", "d.jpg")] as never }),
    ]);
    expect(out.thumbs.map((t) => t.src)).toEqual(["villa.jpg", "b.jpg"]);
    expect(out.more).toBe(0);
  });

  it("Etkinlik: its planned cards' photos, then the source's tours; at most three, the rest counted", () => {
    const out = rowThumbs([vm({ kind: "activity", status: "chosen", planned: [opt("Sörf", "s.jpg"), opt("Yoga", null)] as never })], { tours: [{ image: "v1.jpg" }, { image: null }, { image: "s.jpg" }, { image: "v2.jpg" }, { image: "v3.jpg" }] });
    expect(out.thumbs.map((t) => [t.src, t.item?.id ?? null])).toEqual([["s.jpg", "Sörf"], ["v1.jpg", null], ["v2.jpg", null]]);
    expect(out.more).toBe(1);
  });
});
