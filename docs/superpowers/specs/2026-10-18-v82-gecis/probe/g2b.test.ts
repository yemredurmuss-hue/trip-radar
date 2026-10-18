// Görev 2 (b): pano durumları. Japonya örneği (1–16 Nisan 2027, 2 kişi) üzerinde kayıtlarla oynanır.
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { applyAnswer, fresh, made, pipeline, setLang, typed, withLang } from "./lib";
import { makeItem } from "/home/user/trip-radar/tests/fixtures/makeItem";
import { plannedItem } from "/home/user/trip-radar/src/lib/planned";
import { budgetBar } from "/home/user/trip-radar/src/lib/progress";
import { buildPlan } from "/home/user/trip-radar/src/lib/plan";
import { decideTrip, makeContext } from "/home/user/trip-radar/src/lib/decision";
import { convert } from "/home/user/trip-radar/src/lib/currency";
import { CURRENCIES } from "/home/user/trip-radar/src/lib/displayCurrency";
import { stageOf, needStage } from "/home/user/trip-radar/src/lib/lifecycle";
import { ruleSuggestions } from "/home/user/trip-radar/src/lib/suggestions";
import { panoEntries, panoCounts } from "/home/user/trip-radar/src/lib/pano";
import { journeyFlow } from "/home/user/trip-radar/src/lib/journey";
import { buildLegs } from "/home/user/trip-radar/src/lib/legs";
import { buildTimeline } from "/home/user/trip-radar/src/lib/timeline";
import type { Item, Trip } from "/home/user/trip-radar/src/lib/types";

const out: Record<string, unknown> = {};
const run = (name: string, fn: () => unknown) => { try { out[name] = fn(); } catch (e) { out[name] = { HATA: (e as Error).message, stack: (e as Error).stack?.split("\n").slice(0, 5) }; } };
const P = (amount: number, currency = "EUR", scope: "total" | "per_night" | "per_person" = "total") => ({ amount, currency, scope, taxesIncluded: "yes" as const, source: "page" as const, observedAt: 1 });
const trip: Trip = { id: "t1", title: "Japonya turu", confirmedDates: { start: "2027-04-01", end: "2027-04-16" }, budget: { amount: 8000, currency: "EUR" }, heroImage: null, createdAt: 1, updatedAt: 1 };
const stay = (name: string, city: string, start: string, end: string, status: Item["status"] = "saved", over: Partial<Item> = {}) =>
  makeItem({ name, category: "stay", city, countryCode: "JP", needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "page" }, status, price: P(400), guests: { adults: 2, children: null, rooms: 1 }, ...over });
const fl = (name: string, from: string, to: string, dep: string, arr: string, status: Item["status"] = "saved", over: Partial<Item> = {}) =>
  makeItem({ name, category: "flight", city: to, needKey: `flight:${from}-${to}`.toLowerCase(), dates: { start: dep.slice(0, 10), end: null, source: "page" }, status, price: P(900), flight: { from, to, departure: dep, arrival: arr, carrier: name.split(" ")[0], flightNumber: name.split(" ")[1] ?? null, stops: 0 }, ...over });
const base = (): Item[] => [
  fl("TK 52", "IST", "HND", "2027-04-01T01:55", "2027-04-01T19:25", "booked"),
  stay("Hyatt Centric Ginza", "Tokyo", "2027-04-01", "2027-04-05", "chosen"),
  stay("Gion Hatanaka", "Kyoto", "2027-04-05", "2027-04-09"),
  stay("Gora Kadan", "Hakone", "2027-04-09", "2027-04-12", "booked"),
  stay("Swissotel Nankai", "Osaka", "2027-04-12", "2027-04-16"),
  fl("TK 49", "KIX", "IST", "2027-04-16T11:00", "2027-04-16T17:40", "booked"),
  makeItem({ name: "Shibuya Sky günbatımı", category: "activity", city: "Tokyo", countryCode: "JP", dates: { start: "2027-04-04", end: null, source: "page" }, status: "booked", price: P(90) }),
];
const brief = (t: Trip, items: Item[], today = "2026-10-18") => { const p = pipeline(t, items, today); return { sections: p.sections, rules: p.rules, legs: p.legs, blocks: p.stayBlocks, shape: p.shape, nights: p.nights }; };

it("g2b", () => {
  setLang("tr");
  run("00_japan_base", () => brief(trip, base()));
  // 17: aynı şehirde iki otel (Tokyo 1–3 ve 3–5)
  run("17_same_city_two_hotels", () => {
    const items = base().filter((i) => i.name !== "Hyatt Centric Ginza");
    items.push(stay("Asakusa Ryokan", "Tokyo", "2027-04-01", "2027-04-03", "booked"), stay("Shinjuku Granbell", "Tokyo", "2027-04-03", "2027-04-05", "chosen"));
    return brief(trip, items);
  });
  // 18: gece uçuşu, ertesi gün iniş (IST 23:55 → HND ertesi 18:00), otel ertesi günden
  run("18_night_flight_plus1", () => {
    const items = base().filter((i) => i.name !== "TK 52" && i.name !== "Hyatt Centric Ginza");
    items.push(fl("TK 198", "IST", "HND", "2027-03-31T23:55", "2027-04-01T18:00", "booked"), stay("Hyatt Centric Ginza", "Tokyo", "2027-04-01", "2027-04-05", "booked"));
    const t = { ...trip, confirmedDates: { start: "2027-03-31", end: "2027-04-16" } };
    return brief(t, items);
  });
  // 19: aktarmalı, iki ayrı bilet (IST→DOH, DOH→HND, 50 dk aktarma)
  run("19_multileg_separate", () => {
    const items = base().filter((i) => i.name !== "TK 52");
    items.push(fl("QR 240", "IST", "DOH", "2027-04-01T02:10", "2027-04-01T06:00", "chosen", { provider: "Qatar Airways" }), fl("QR 806", "DOH", "HND", "2027-04-01T06:50", "2027-04-01T22:30", "chosen", { provider: "Pegasus", key: "x2" }));
    return brief(trip, items);
  });
  run("19b_multileg_one_record", () => {
    const items = base().filter((i) => i.name !== "TK 52");
    items.push(fl("QR 240", "IST", "HND", "2027-04-01T02:10", "2027-04-01T22:30", "chosen", { flight: { from: "IST", to: "HND", departure: "2027-04-01T02:10", arrival: "2027-04-01T22:30", carrier: "QR", flightNumber: "QR240", stops: 1 } }));
    return brief(trip, items);
  });
  // 21: gezi sırasında (bugün 7 Nisan, Kyoto) ve bitti (20 Nisan)
  run("21a_during_trip_kyoto", () => brief(trip, base(), "2027-04-07"));
  run("21b_after_trip", () => brief(trip, base(), "2027-04-20"));
  run("21c_stages", () => {
    const b = base();
    return { during: b.map((i) => `${i.name}: ${stageOf(i, { today: "2027-04-07" })}`), after: b.map((i) => `${i.name}: ${stageOf(i, { today: "2027-04-20" })}`) };
  });
  // 22: iptal/iade: Hakone oteli iptal edildi (dismissed + cancelledAt)
  run("22_cancelled_hotel", () => {
    const items = base().map((i) => (i.name === "Gora Kadan" ? { ...i, status: "dismissed" as const, cancelledAt: 5, statusNote: "İade: €900, 14 gün içinde" } : i));
    return { ...brief(trip, items), stage: stageOf(items.find((i) => i.name === "Gora Kadan")!), need: needStage(["cancelled"]) };
  });
  // 23: 32 Tokyo oteli linki biriktirildi
  run("23_thirty_links", () => {
    const items = base();
    for (let n = 0; n < 32; n++) items.push(stay(`Tokyo otel ${n + 1}`, "Tokyo", "2027-04-01", "2027-04-05", "saved", { price: P(300 + n * 10), key: `k${n}` }));
    const r = brief(trip, items);
    const pano = panoCounts(panoEntries(items));
    return { ...r, pano: pano.cats };
  });
  // 24: hiç seçenek yok (yalnız başlangıcın yer tutucuları)
  run("24_no_options", () => {
    let s = typed(fresh(), "1 Nisan'dan 15 gece Japonya, Sabine'yle", { destination: "Japonya", destination_country: "Japonya", destination_country_code: "JP", start_date: "2027-04-01", duration_days: 16 });
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    s = { ...s, route: { stops: [{ city: "Tokyo", nights: 4, code: "JP" }, { city: "Kyoto", nights: 4, code: "JP" }, { city: "Hakone", nights: 3, code: "JP" }, { city: "Osaka", nights: 4, code: "JP" }], arrive: "Tokyo", leave: "Osaka", confirmed: true, source: "ai" as const } };
    return made(s);
  });
  // 25: yalnız linkler, tarih yok (gezinin tarihi de yok)
  run("25_links_no_dates", () => {
    const t = { ...trip, confirmedDates: null };
    const items = [
      makeItem({ name: "Hotel Gracery Shinjuku", category: "stay", city: "Tokyo", countryCode: "JP", needKey: "stay:tokyo", price: P(150, "EUR", "per_night") }),
      makeItem({ name: "Kyoto Brighton", category: "stay", city: "Kyoto", countryCode: "JP", needKey: "stay:kyoto", price: P(210, "EUR", "per_night") }),
      makeItem({ name: "teamLab Planets", category: "activity", city: "Tokyo", countryCode: "JP", price: P(45) }),
      makeItem({ name: "Ichiran Ramen", category: "food", city: "Tokyo", countryCode: "JP" }),
      makeItem({ name: "Skyscanner IST-TYO", category: "flight", needKey: "flight:ist-tyo", flight: { from: "IST", to: "HND", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null }, price: P(800) }),
    ];
    return brief(t, items);
  });
  // 28: karışık para birimi (TRY uçuş, USD otel, JPY etkinlik), bütçe EUR
  run("28_mixed_currency", () => {
    const items = base().map((i) =>
      i.name === "TK 52" ? { ...i, price: P(36000, "TRY") } : i.name === "Hyatt Centric Ginza" ? { ...i, price: P(1100, "USD") } : i.name === "Shibuya Sky günbatımı" ? { ...i, price: P(14000, "JPY") } : i,
    );
    const rates = { base: "EUR" as const, date: "2026-10-18", rates: { EUR: 1, TRY: 40, USD: 1.08, JPY: 162 } };
    const noJpy = { base: "EUR" as const, date: "2026-10-18", rates: { EUR: 1, TRY: 40, USD: 1.08 } };
    const plan = buildPlan(trip, items);
    const ctx = makeContext(trip, items, { rates, today: "2026-10-18" });
    const ctx2 = makeContext(trip, items, { rates: noJpy, today: "2026-10-18" });
    const ctx3 = makeContext({ ...trip, budget: { amount: 300000, currency: "JPY" } }, items, { rates, today: "2026-10-18" });
    return {
      bar: budgetBar(plan, items, ctx, undefined), barNoJpy: budgetBar(plan, items, ctx2, undefined), barJpyBudget: budgetBar(plan, items, ctx3, undefined),
      displayCurrencies: CURRENCIES, conv: convert(14000, "JPY", "EUR", rates),
    };
  });
  // 13b: 8 kişi, oda dağılımı yok: misafir alanı
  run("13b_group_guests", () => {
    const items = [stay("Rixos Lares", "Antalya", "2027-08-01", "2027-08-08", "saved", { guests: { adults: 4, children: 4, rooms: 2 }, price: P(250, "EUR", "per_night") })];
    const t = { ...trip, confirmedDates: { start: "2027-08-01", end: "2027-08-08" }, budget: null, travellers: undefined };
    const ctx = makeContext(t, items, { today: "2026-10-18" });
    return { ...brief(t, items), bar: budgetBar(buildPlan(t, items), items, ctx, undefined) };
  });
  // 10/11 tekrar (model okuması ile): otobüsle hafta sonu, günübirlik
  run("10b_weekend_bursa_bus_AI", () => made(applyAnswer(typed(fresh(), "Bu hafta sonu Bursa'ya otobüsle, 2 kişi", { destination: "Bursa", destination_country: "Türkiye", destination_country_code: "TR" }), { q: "from", city: "İstanbul" }, 3)));
  // Tomorrowland: etkinlik tarihleri onaylandı
  run("02c_tomorrowland_confirmed", () => {
    let s = typed(fresh(), "Temmuzda Tomorrowland'e gidiyoruz, 2 kişi");
    s = applyAnswer(s, { q: "event", confirm: true }, 3);
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 4);
    return made(s);
  });
  // 27: İngilizce arayüz
  run("27_english", () => {
    setLang("en");
    let s = typed(fresh("plan", "en"), "Ski trip to Bansko in January, 5 nights, two of us", { destination: "Bansko", destination_country: "Bulgaria", destination_country_code: "BG", start_date: "2027-01-15", duration_days: 6 });
    s = applyAnswer(s, { q: "from", city: "Istanbul" }, 3);
    const r = made(s);
    const j = withLang("en", () => brief(trip, base()));
    setLang("tr");
    return { ski: r, japanSections: j.sections, rules: j.rules };
  });
  // Yolculuk sırası (canlı journeyFlow) Japonya için
  run("29_journey_flow", () => {
    const items = base();
    const plan = buildPlan(trip, items);
    const legs = buildLegs(plan, trip);
    const tl = buildTimeline(plan, legs, items, new Set());
    return journeyFlow(tl, items).map((n: any) => `${n.kind}${n.city ? " " + n.city : ""}${n.date ? " " + n.date : ""}${n.title ? " " + n.title : ""}`);
  });
  writeFileSync("out-g2b.json", JSON.stringify(out, null, 1));
});
