// One option's card in the drawer (lib/drawerCard.ts, onay paketi 2026-10-21): the score's three parts from the decision's
// own weights, the five slots in their fixed order with "bilinmiyor" for what the record doesn't say, the reviews' pros and
// cons, "Neden?" and a flight's day band.
import { describe, expect, it } from "vitest";
import { dayBand, flightSlots, priceAge, waySlots, partsWhy, placeText, prosCons, rentalSlots, reviewsHead, scoreParts, staySlots, weightShares } from "../src/lib/drawerCard";
import { withLang } from "../src/lib/i18n";
import { EMPTY_METRICS } from "../src/lib/items";
import { thailand } from "./fixtures/thailand";

const part = (criterion: string, weight: number, s: number | null, label = criterion) => ({ criterion, weight, s, label }) as Parameters<typeof partsWhy>[0][number] & Parameters<typeof scoreParts>[0][number];

describe("score parts and weights", () => {
  const parts = [part("rating", 3, 0.9), part("details", 1, 0.7), part("amenities", 2, 1), part("location", 1.5, 1), part("price", 2.5, 0.88)];
  it("the weights add up by group to 100", () => {
    expect(weightShares(parts)).toEqual([
      { group: "reviews", share: 40 },
      { group: "features", share: 35 },
      { group: "price", share: 25 },
    ]);
    expect(weightShares([])).toEqual([]);
  });
  it("each part is the weighted mean of what is known; an unknown part is left out", () => {
    expect(scoreParts(parts)).toEqual([
      { group: "reviews", value: 85 },
      { group: "features", value: 100 },
      { group: "price", value: 88 },
    ]);
    expect(scoreParts([part("rating", 3, null), part("price", 1, 0.5)])).toEqual([{ group: "price", value: 50 }]);
  });
  it("Neden?: the weightiest it does well and badly on", () => {
    expect(partsWhy([part("price", 3, 0.95, "Fiyat"), part("stops", 2, 0.9, "Aktarma"), part("schedule", 2, 0.3, "Saatler"), part("duration", 1, 0.6, "Süre")])).toBe("Güçlü: Fiyat, Aktarma. Zayıf: Saatler.");
    expect(partsWhy([part("duration", 1, 0.6, "Süre")])).toBeNull();
    expect(placeText(2)).toBe("2. sırada");
  });
});

describe("the five slots", () => {
  const { by } = thailand();
  it("a stay: Kahvaltı, İptal, Merkez, Puan, Kaynak in that order", () => {
    const s = staySlots({ ...by.rimping, metrics: { ...EMPTY_METRICS, cancellationType: "free", distanceToCenterKm: 0.4, amenities: ["kahvaltı dahil"] } }, "Booking.com");
    expect(s.map((x) => x.key)).toEqual(["food", "cancel", "centre", "rating", "source"]);
    expect(s.map((x) => x.value)).toEqual(["Dahil", "20 Mar'a dek", "400 m", "8,6 / 10", "Booking.com"]);
    expect(s.map((x) => x.tone)).toEqual(["ok", "ok", "ok", "dim", "link"]);
  });
  it("what the record doesn't say is unknown, in grey (C19)", () => {
    const s = staySlots({ ...by.tamarind, metrics: EMPTY_METRICS }, "Agoda");
    expect(s[0]).toMatchObject({ value: "bilinmiyor", tone: "dim" });
    expect(s[1]).toMatchObject({ value: "bilinmiyor", tone: "dim" });
    expect(s[4]).toMatchObject({ value: "Agoda", tone: "dim" });
  });
  it("a flight: its bag, the cabin bag when said, the refund, where it lands, the source", () => {
    const tk = { ...by.tk69, highlights: ["23 kg bagaj dahil", "8 kg el bagajı"], concerns: [], metrics: { ...EMPTY_METRICS, checkedBagIncluded: true, cancellationType: "non_refundable" as const } };
    expect(flightSlots(tk, "Turkish Airlines").map((x) => `${x.key}:${x.value}:${x.tone}`)).toEqual(["bag:23 kg:ok", "cabin:8 kg:ok", "cancel:İade yok:warn", "gate:IST:dim", "source:Turkish Airlines:link"]);
    const pc = flightSlots({ ...by.pc, metrics: { ...EMPTY_METRICS, checkedBagIncluded: false } }, null);
    expect(pc[0]).toMatchObject({ value: "Bagaj yok", tone: "warn" });
    expect(pc[1].value).toBe("bilinmiyor");
    expect(pc[4]).toMatchObject({ value: "Kiwi.com" });
  });
  it("a train: where it leaves and arrives, how long, the refund, the source; no bag", () => {
    const s = waySlots({ ...by.train, metrics: { ...EMPTY_METRICS, durationMinutes: 90 } }, null);
    expect(s.map((x) => `${x.key}:${x.value}`)).toEqual(["from:Bangkok", "to:Ayutthaya", "length:1 sa 30 dk", "cancel:bilinmiyor", "source:bilinmiyor"]);
  });
  it("a rental: Sigorta, İptal, Teslim, Puan, Kaynak", () => {
    const s = rentalSlots({ ...by.moto, highlights: ["Otele getirip alıyor", "Sigorta dahil"] }, "BikesBooking");
    expect(s.map((x) => `${x.key}:${x.value}`)).toEqual(["cover:Dahil", "cancel:bilinmiyor", "pick:Otele", "rating:bilinmiyor", "source:BikesBooking"]);
  });
});

describe("the reviews and the day band", () => {
  const { by } = thailand();
  it("pros and cons from the page and the reviews' topics, at most three each", () => {
    const r = prosCons({ ...by.rimping, highlights: ["Tha Phae kapısına 5 dk yürüme"], concerns: ["Oda küçük"] }, [{ label: "Kahvaltı", up: true }, { label: "Gürültü", up: false }]);
    expect(r).toEqual({ pros: ["Tha Phae kapısına 5 dk yürüme", "Kahvaltı"], cons: ["Oda küçük", "Gürültü"], count: 1240 });
    expect(reviewsHead(1240)).toBe("Yorumlardan · 1.240 yorum");
    expect(prosCons(by.tamarind)).toBeNull();
  });
  it("the day asked and the day after", () => {
    expect(dayBand("2027-04-02", "2027-04-02", 3)).toEqual({ n: "2", month: "Nis", title: "2 Nisan, Cuma", note: "istenen gün · 3 seçenek", asked: true, off: 0 });
    expect(dayBand("2027-04-03", "2027-04-02", 1)).toMatchObject({ title: "3 Nisan, Cumartesi", note: "bir gün sonra · 1 seçenek", asked: false, off: 1 });
    withLang("en", () => expect(dayBand("2027-04-02", null, 2).note).toBe("2 options"));
  });
});

describe("how fresh the price is", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const day = 86_400_000;
  const price = (amount: number, at: number) => ({ amount, currency: "EUR", scope: "per_night" as const, taxesIncluded: "yes" as const, source: "page" as const, observedAt: at });
  it("read two days ago: say so; fresh: nothing", () => {
    expect(priceAge({ price: price(64, now - 2 * day - 1000), priceHistory: [] }, now)).toEqual({ ago: "2 gün önce", was: null });
    expect(priceAge({ price: price(64, now - 3600_000), priceHistory: [] }, now)).toEqual({ ago: null, was: null });
  });
  it("fell since: what it was", () => {
    expect(priceAge({ price: price(64, now - 3600_000), priceHistory: [{ amount: 71, currency: "EUR", observedAt: now - day }] }, now).was).toBe("Dün €71 idi");
    expect(priceAge({ price: price(64, now - 3600_000), priceHistory: [{ amount: 60, currency: "EUR", observedAt: now - day }] }, now).was).toBeNull();
  });
});
