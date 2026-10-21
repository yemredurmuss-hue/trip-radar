// What an intent's row says on the Plan (lib/rowView.ts, onay paketi 2026-10-21), on the v83 prototype's Japonya and Ozora:
// each state only its own facts and one thing on the right (Ara · Seç and the count · Bunu seç · Satın al / Rezerve et ·
// Alındı / Rezerve), the kind's word or a chosen stay's city over the name, a rental drawn as a stay's card.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import type { IntentVM } from "../src/lib/intents";
import { deckLead, rowFace, rowView, sourceCounts } from "../src/lib/rowView";
import { boardOf, japan, JAPAN_TODAY, ozora, OZORA_TODAY } from "./fixtures/v82Trips";

const jp = () => {
  const { trip, items } = japan();
  return boardOf(trip, items, JAPAN_TODAY).intents;
};
const find = (list: IntentVM[], key: string) => list.find((v) => v.key === key)!;
const text = (parts: { text: string }[]) => parts.map((p) => p.text).join(" · ");

describe("rowView: a flight, a train, a way of travel (the thin row)", () => {
  it("our pick: its hours, its stops, what one pays, Bunu seç", () => {
    const r = rowView(find(jp(), "flight:ist-hnd"));
    expect(r.face).toBe("ticket");
    expect(r.lead).toBe("✨ Önerimiz");
    expect(r.title).toBe("İstanbul → Tokyo");
    expect(text(r.line)).toBe("20:10 → 20:55 · 1 aktarma");
    expect(r.line[0].tone).toBe("bold");
    expect(r.figure).toEqual({ big: "€660", small: "kişi başı" });
    expect(r.slot).toEqual({ kind: "take" });
  });
  it("bought: its code where the price was, the green hap", () => {
    const r = rowView(find(jp(), "flight:kix-ist"));
    expect(text(r.line)).toBe("11:00 → 17:40 · direkt");
    expect(r.figure).toEqual({ big: "K7T2QX", small: "PNR", code: true });
    expect(r.slot).toEqual({ kind: "hap", tone: "ok", text: "Alındı" });
  });
  it("in Ulaşım the kind's word leads; chosen: Satın al", () => {
    const train = rowView(find(jp(), "transport:hakone-osaka"));
    expect(train.lead).toBe("Tren");
    expect(train.slot).toEqual({ kind: "book", word: "Satın al" });
    expect(train.figure?.big).toBe("€98");
    expect(rowView(find(jp(), "transport:kyoto-hakone")).figure).toEqual({ big: "OD-7721", small: "Bilet", code: true });
  });
  it("sorted out: a grey hap, nothing to do", () => {
    const r = rowView(find(jp(), "leg:2027-04-01:arrival:?"));
    expect(r.slot).toEqual({ kind: "hap", tone: "arr", text: "Ayarlandı" });
    expect(r.figure).toBeNull();
  });
  it("options to pick from: Seç with how many, the first one's price", () => {
    const { trip, items } = ozora();
    const out = boardOf(trip, items, OZORA_TODAY).intents.find((v) => v.section === "flight" && v.head.route?.to === "Budapeşte")!;
    const r = rowView({ ...out, status: "deciding", chosen: null });
    expect(r.slot).toEqual({ kind: "pick", count: 2 });
    expect(r.count).toBe(2);
    expect(r.figure?.small).toMatch(/önerimiz|ilk sırada/);
  });
});

describe("rowView: a stay (the card that doesn't fold)", () => {
  it("chosen: its city and nights over its name, the site and the area, by the night, Rezerve et", () => {
    const r = rowView(find(jp(), "stay:2027-04-02"));
    expect(r.face).toBe("card");
    expect(r.lead).toBe("Tokyo · 3 gece");
    expect(r.title).toBe("Hyatt Centric Ginza");
    expect(text(r.line)).toBe("Booking.com · Ginza");
    expect(r.figure).toEqual({ big: "€213", small: "gece · €639" });
    expect(r.slot).toEqual({ kind: "book", word: "Rezerve et" });
  });
  it("booked: its booking number, Rezerve", () => {
    const r = rowView(find(jp(), "stay:2027-04-09"));
    expect(r.lead).toBe("Hakone · 3 gece");
    expect(r.figure).toEqual({ big: "GK-48213", small: "Rezervasyon no", code: true });
    expect(r.slot).toEqual({ kind: "hap", tone: "ok", text: "Rezerve" });
  });
  it("still to find: the city, no dates twice (the rail says them), Ara", () => {
    const r = rowView(find(jp(), "stay:2027-04-12"));
    expect(r.lead).toBeNull();
    expect(r.title).toBe("Osaka");
    expect(r.line.some((p) => /Nisan|gece/.test(p.text))).toBe(false);
    expect(r.slot).toEqual({ kind: "ask" });
  });
  it("a deck: where the options came from and their range", () => {
    const kyoto = find(jp(), "stay:2027-04-05");
    const r = rowView({ ...kyoto, status: "deciding", chosen: null });
    expect(r.slot.kind).toBe("pick");
    expect(text(r.third)).toMatch(/^Booking\.com \d/);
  });
  it("a rental is a card, its kind and days over its name", () => {
    expect(rowFace({ frame: "ticket", kind: "transport", ticket: { rental: { line: null, pick: null, days: 3, back: null } } as IntentVM["ticket"] })).toBe("card");
    expect(rowFace({ frame: "ticket", kind: "flight", ticket: { rental: null } as IntentVM["ticket"] })).toBe("ticket");
  });
  it("in English", () => {
    withLang("en", () => {
      const r = rowView(find(jp(), "stay:2027-04-02"));
      expect(r.lead).toBe("Tokyo · 3 nights");
      expect(r.slot).toEqual({ kind: "book", word: "Book" });
    });
  });
});

describe("rowView's helpers", () => {
  it("the deck's price is our pick's, else the first", () => {
    const o = (id: string, ours = false) => ({ id, ours }) as IntentVM["options"][number];
    expect(deckLead([o("a"), o("b", true)])?.id).toBe("b");
    expect(deckLead([o("a"), o("b")])?.id).toBe("a");
    expect(deckLead([])).toBeNull();
  });
  it("the sources, the most first", () => {
    const b = (label: string) => ({ brand: { label, color: null } }) as unknown as IntentVM["options"][number];
    expect(sourceCounts([b("Airbnb"), b("Booking.com"), b("Booking.com")])).toBe("Booking.com 2 · Airbnb 1");
    expect(sourceCounts([])).toBeNull();
  });
});
