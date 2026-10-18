// Yolculuk sırasıyla (v81–v83, lib/journeyChapters.ts): the trip in chapters as it is lived, each step one of the Plan's
// boxes. The prototype's Japonya (1–16 Nisan: Tokyo, Kyoto, Hakone, Osaka; 7 chapters) and Ozora; the night on the plane
// (D14), a trip with no dates (D15), today's chapter and what was left open on a day gone by (D8, K17).
import { beforeEach, describe, expect, it } from "vitest";
import { setLang, withLang } from "../src/lib/i18n";
import { journeyChapters, type JourneyChapter, type JourneyView } from "../src/lib/journeyChapters";
import { nightsAboard } from "../src/lib/tripPhase";
import type { DocMeta, Item, Trip } from "../src/lib/types";
import { boardOf, flight, INSURANCE, JAPAN_TODAY, japan, ozora, stay } from "./fixtures/v82Trips";

const viewOf = (trip: Trip, items: Item[], today = JAPAN_TODAY, docs: string[] = []): JourneyView => {
  const docsFor = (id: string): DocMeta[] => (docs.includes(id) ? [{ id: `d-${id}`, itemId: id, tripId: trip.id, name: "belge.pdf", type: "application/pdf", size: 1, addedAt: 1 }] : []);
  const b = boardOf(trip, items, today, { suggestions: { other: [INSURANCE] }, docsFor });
  return journeyChapters({ input: b.input, timeline: b.timeline, collections: b.collections });
};
const chapter = (v: JourneyView, title: string): JourneyChapter => v.chapters.find((c) => c.title === title)!;
const line = (c: JourneyChapter) => c.steps.map((s) => [s.dateLabel, `${s.kindWord} · ${s.statusText}`, s.title]);

beforeEach(() => setLang("tr"));

describe("Japonya: seven chapters in the order the trip is lived", () => {
  const { trip, items, by } = japan();
  const v = viewOf(trip, items);

  it("Yola çıkmadan, the way in, the four cities with their days and nights, the way home", () => {
    expect(v.available).toBe(true);
    expect(v.chapters.map((c) => [c.kind, c.title, c.sub])).toEqual([
      ["before", "Yola çıkmadan", "Gezi öncesi"],
      ["travel", "İstanbul → Tokyo", "1 Nisan"],
      ["city", "Tokyo", "2–5 Nisan · 3 gece"],
      ["city", "Kyoto", "5–9 Nisan · 4 gece"],
      ["city", "Hakone", "9–12 Nisan · 3 gece"],
      ["city", "Osaka", "12–16 Nisan · 4 gece"],
      ["travel", "Osaka → İstanbul", "16 Nisan"],
    ]);
  });

  it("a city's picture is the hero's own, from the trip's city photos", () => {
    expect(v.chapters.filter((c) => c.kind === "city").map((c) => c.photo)).toEqual([
      { key: "tokyo", url: "photos/shibuya.jpg" },
      { key: "kyoto", url: "photos/inari.jpg" },
      { key: "hakone", url: "photos/onsen.jpg" },
      { key: "osaka", url: "photos/dotonbori.jpg" },
    ]);
  });

  it("each city's steps by day: the way there, the bed, what's planned, 'esnek' without a day, the ideas last", () => {
    expect(line(chapter(v, "Tokyo"))).toEqual([
      ["2 Nis", "Transfer · Ayarlandı", "Havalimanı → Otel"],
      ["2 Nis", "Konaklama · Seçildi", "Hyatt Centric Ginza"],
      ["3 Nis", "Etkinlik · Planda", "teamLab Planets"],
      ["3 Nis", "Yer · Planda", "Ichiran Ramen"],
      ["4 Nis", "Etkinlik · Bilet alındı", "Shibuya Sky"],
      ["esnek", "Yer · Planda", "Meiji Jingu"],
      ["", "Etkinlik · ", "Tokyo için 2 etkinlik önerisi"],
    ]);
    expect(line(chapter(v, "Hakone"))).toEqual([
      ["9 Nis", "Tren · Bilet alındı", "Kyoto → Hakone"],
      ["9 Nis", "Konaklama · Rezerve edildi", "Gora Kadan"],
    ]);
  });

  it("'2 hazır · 4 karar': what's done and what's left; the ideas aren't counted", () => {
    expect(v.chapters.map((c) => c.summary.text)).toEqual(["1 hazır · 1 karar", "1 karar", "2 hazır · 4 karar", "2 hazır · 3 karar", "2 hazır", "2 karar", "1 hazır"]);
  });

  it("each step's one button, by its state", () => {
    const kyoto = chapter(v, "Kyoto").steps;
    const train = kyoto.find((s) => s.title === "Tokyo → Kyoto")!;
    expect(train).toMatchObject({ statusText: "Önerimiz, onayla", action: { kind: "take", label: "Bunu seç" }, price: "€95", sub: "Shinkansen Hikari · JR" });
    expect([by.nozomi.id, by.hikari.id]).toContain(train.action!.itemId);
    const tokyo = chapter(v, "Tokyo").steps;
    expect(tokyo[1]).toMatchObject({ sub: "Booking.com · €213 / gece", price: "€213", action: { kind: "book", label: "Rezerve et", itemId: by.hyatt.id, url: by.hyatt.url, brand: { label: "Booking.com" } } });
    expect(tokyo[2].action).toMatchObject({ kind: "book", label: "Satın al" });
    expect(tokyo[3].action).toBeNull();
    expect(tokyo[6].action).toMatchObject({ kind: "ideas", label: "Önerilere bak" });
    expect(chapter(v, "Osaka").steps[1]).toMatchObject({ statusText: "Aranıyor", action: { kind: "search", label: "Ara" } });
    const home = chapter(v, "Osaka → İstanbul").steps[0];
    expect(home).toMatchObject({ statusText: "Bilet alındı", title: "Osaka → İstanbul", code: { label: "PNR", value: "K7T2QX" }, action: { kind: "addDoc", label: "Bileti ekle" } });
    const before = chapter(v, "Yola çıkmadan").steps;
    expect(before.map((s) => [s.dateLabel, s.title, s.sub, s.action?.label])).toEqual([
      ["", "Hazırlık", "1/3 hazır · sıradaki 31 Mar: Yen bozdur", "Listeyi aç"],
      ["", "eSIM · Japonya", "Airalo Japonya 10 GB", "QR kodu ekle"],
      ["", "Seyahat sağlık sigortası", null, "Ara"],
    ]);
  });

  it("a booking with its file opens it: 'Onay e-postası aç', 'E-bilet aç', 'Bileti aç'", () => {
    const w = viewOf(trip, items, JAPAN_TODAY, [by.goraKadan.id, by.tk49.id, by.shibuya.id]);
    expect(chapter(w, "Hakone").steps[1].action).toMatchObject({ kind: "doc", label: "Onay e-postası aç", itemId: by.goraKadan.id });
    expect(chapter(w, "Osaka → İstanbul").steps[0].action).toMatchObject({ kind: "doc", label: "E-bilet aç" });
    expect(chapter(w, "Tokyo").steps.find((s) => s.title === "Shibuya Sky")!.action).toMatchObject({ kind: "doc", label: "Bileti aç" });
  });

  it("'›' goes to the step's box; a choice made in the Plan is the step's at once", () => {
    const b = boardOf(trip, items, JAPAN_TODAY);
    const box = b.intents.find((i) => i.section === "stay" && i.head.city === "Kyoto")!;
    const step = chapter(v, "Kyoto").steps.find((s) => s.target?.section === "stay")!;
    expect(step.target).toEqual({ intentKey: box.key, section: "stay", domKeys: box.domKeys, itemId: null });
    const card = chapter(v, "Tokyo").steps.find((s) => s.title === "Shibuya Sky")!;
    expect(card.target).toMatchObject({ section: "activity", itemId: by.shibuya.id });
    // Gion Hatanaka chosen in the Plan: the same step says so.
    const chosen = items.map((i) => (i.id === by.hatanaka.id ? { ...i, status: "chosen" as const } : i));
    const after = chapter(viewOf(trip, chosen), "Kyoto").steps.find((s) => s.target?.section === "stay")!;
    expect(after).toMatchObject({ title: "Gion Hatanaka", statusText: "Seçildi", action: { kind: "book", label: "Rezerve et", itemId: by.hatanaka.id } });
  });

  it("D14: the night on the plane is no bed to find but an 'Uçakta' line on the way in", () => {
    const way = chapter(v, "İstanbul → Tokyo");
    expect(line(way)).toEqual([
      ["1 Nis", "Uçuş · Önerimiz, onayla", "İstanbul → Tokyo"],
      ["1 Nis", "Gece · uçakta", "Uçakta"],
    ]);
    // No flight taken yet: none named on the line; once bought, its hours.
    expect(way.steps[1].sub).toBeNull();
    const booked = japan({ during: true });
    expect(chapter(viewOf(booked.trip, booked.items), "İstanbul → Tokyo").steps[1].sub).toBe("Turkish Airlines TK52 · 23:55 → 18:40 (+1)");
    // Both options leave on the 1st and land on the 2nd: the night is the plane's whichever is taken; nothing to search.
    const steps = v.chapters.flatMap((c) => c.steps);
    expect(steps.some((s) => s.target?.section === "stay" && s.date === "2027-04-01")).toBe(false);
    expect(chapter(v, "Tokyo")).toMatchObject({ range: { start: "2027-04-02", end: "2027-04-05" }, nights: 3 });
  });

  it("in English", () => {
    const en = withLang("en", () => viewOf(trip, items));
    expect(en.chapters.map((c) => c.title).slice(0, 2)).toEqual(["Before you go", "Istanbul → Tokyo"]);
    expect(en.chapters[0].sub).toBe("Before the trip");
    const kyoto = en.chapters.find((c) => c.title === "Kyoto")!;
    expect(kyoto.steps[0]).toMatchObject({ statusText: "Our pick, take it", action: { label: "Take it" } });
    expect(kyoto.steps.at(-1)!.title).toBe("1 activity idea for Kyoto");
    expect(kyoto.summary.text).toBe("2 ready · 3 to decide");
  });
});

describe("nightsAboard (D14)", () => {
  it("a night between leaving and landing is the plane's: the flight taken, or every option agreeing", () => {
    const late = flight("IST", "HND", "2027-04-01T23:55", "2027-04-02T18:40", "saved");
    const day = flight("IST", "HND", "2027-04-01T01:55", "2027-04-01T19:25", "saved");
    expect([...nightsAboard([late]).keys()]).toEqual(["2027-04-01"]);
    // One option lands the same day: not every way spends the night in the air.
    expect(nightsAboard([late, day]).size).toBe(0);
    // Taken: that one says it.
    expect([...nightsAboard([late, { ...day, status: "dismissed" }]).keys()]).toEqual(["2027-04-01"]);
    expect(nightsAboard([{ ...late, status: "booked" }, day]).get("2027-04-01")?.map((f) => f.id)).toEqual([late.id]);
    // Not taken yet, two overnight options: the night is the plane's, no one flight named.
    const other = flight("IST", "HND", "2027-04-01T20:10", "2027-04-02T20:55", "saved");
    expect(nightsAboard([late, other]).get("2027-04-01")?.map((f) => f.id)).toEqual([late.id, other.id]);
    expect(nightsAboard([late, { ...day, status: "chosen" }]).size).toBe(0);
  });
});

describe("Ozora: the festival's chapters", () => {
  const { trip, items, by } = ozora();
  const v = viewOf(trip, items);

  it("the way in, a night in Budapeşte, the festival, the way home from Budapeşte", () => {
    expect(v.chapters.map((c) => [c.title, c.sub])).toEqual([
      ["Yola çıkmadan", "Gezi öncesi"],
      ["İstanbul → Budapeşte", "26 Temmuz"],
      ["Budapeşte", "26–27 Temmuz · 1 gece"],
      ["Ozora", "27 Temmuz – 2 Ağustos · 6 gece"],
      ["Budapeşte → İstanbul", "2 Ağustos"],
    ]);
  });

  it("the camp is covered by the ticket (Dahil, done); the festival bus there and back are in the festival's chapter", () => {
    const oz = chapter(v, "Ozora");
    expect(line(oz)).toEqual([
      ["27 Tem", "Otobüs · Karar bekliyor", "Budapeşte → Ozora"],
      ["27 Tem", "Konaklama · Dahil", "Çadır kampı"],
      ["27 Tem", "Etkinlik · Bilet alındı", "Ozora Festival bileti"],
      ["2 Ağu", "Otobüs · Karar bekliyor", "Ozora → Budapeşte"],
    ]);
    expect(oz.steps[1]).toMatchObject({ ready: true, action: null, sub: "Rezervasyon gerekmez · bilete dahil" });
    expect(oz.steps[3].sub).toBe(`1 seçenek · en iyi: ${by.busBack.name} €35`);
    expect(oz.summary.text).toBe("2 hazır · 2 karar");
    // No photo known for Ozora: none drawn, the key is there for the hero's own.
    expect(oz.photo).toEqual({ key: "ozora", url: null });
  });

  it("Hazırlık leads Yola çıkmadan with the next chore by its day", () => {
    expect(chapter(v, "Yola çıkmadan").steps[0].sub).toBe("0/2 hazır · sıradaki 11 Tem: Vize randevusu al");
  });
});

describe("D15: a trip with no dates has no journey to tell", () => {
  it("the view is shut, with why", () => {
    const trip: Trip = { id: "x", title: "Yazın bir ara", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const items = [stay("Lizbon evi", "Lizbon", "", "", "saved", { tripId: "x", dates: { start: null, end: null, source: "none" } })];
    const v = viewOf(trip, items);
    expect(v).toEqual({ available: false, reason: "Tarihler belli olunca açılır", chapters: [], todayKey: null });
    expect(withLang("en", () => viewOf(trip, items).reason)).toBe("Opens once the dates are set");
  });
});

describe("D8 and K17: on the trip", () => {
  it("today's chapter says so (the view opens there); the days behind are folded", () => {
    const { trip, items } = japan({ during: true });
    const v = viewOf(trip, items, "2027-04-06");
    expect(v.todayKey).toBe(chapter(v, "Kyoto").key);
    expect(v.chapters.filter((c) => c.today).map((c) => c.title)).toEqual(["Kyoto"]);
    expect(v.chapters.filter((c) => c.past).map((c) => c.title)).toEqual(["Yola çıkmadan", "İstanbul → Tokyo", "Tokyo"]);
    // The flight home's day is the way home's chapter, not Osaka's.
    expect(viewOf(trip, items, "2027-04-16").todayKey).toBe("chapter:out");
    expect(viewOf(trip, items, "2027-04-01").todayKey).toBe("chapter:in");
    // Back home (D8, an archive): no chapter is today's, every one is behind.
    const after = viewOf(trip, items, "2027-04-20");
    expect(after.todayKey).toBeNull();
    expect(after.chapters.every((c) => c.past && !c.today)).toBe(true);
  });

  it("left open on a day gone by: 'Kaçtı', no button, not counted; still ahead: as it was", () => {
    const { trip, items } = japan();
    const v = viewOf(trip, items, "2027-04-13");
    const kyoto = chapter(v, "Kyoto");
    const bed = kyoto.steps.find((s) => s.target?.section === "stay")!;
    expect(bed).toMatchObject({ missed: true, statusText: "Kaçtı", action: null });
    expect(kyoto.steps.find((s) => s.title === "Tokyo → Kyoto")).toMatchObject({ missed: true, statusText: "Kaçtı" });
    expect(kyoto.summary.text).toBe("2 hazır");
    // Kyoto's ideas are behind it too: no line for them.
    expect(kyoto.steps.some((s) => s.kind === "ideas")).toBe(false);
    expect(chapter(v, "Osaka").steps[1]).toMatchObject({ missed: false, statusText: "Aranıyor", action: { kind: "search" } });
  });
});
