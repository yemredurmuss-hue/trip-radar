// What an intent's row says on the Plan (lib/rowView.ts, onay paketi 2026-10-21), on the v83 prototype's Japonya and Ozora:
// each state only its own facts and one thing on the right (Ara · Seç and the count · Seç · Satın al / Rezerve et · Bileti
// ekle · the stub), the step's word after the kind's or a chosen stay's city (onay paketi 2026-10-22: the four steps), a rental
// drawn as a stay's card.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import type { IntentVM } from "../src/lib/intents";
import { deckLead, rowFace, rowStage, rowView, sourceCounts, stageMeters } from "../src/lib/rowView";
import { boardOf, japan, JAPAN_TODAY, ozora, OZORA_TODAY } from "./fixtures/v82Trips";

const jp = () => {
  const { trip, items } = japan();
  return boardOf(trip, items, JAPAN_TODAY).intents;
};
const find = (list: IntentVM[], key: string) => list.find((v) => v.key === key)!;
const text = (parts: { text: string }[]) => parts.map((p) => p.text).join(" · ");

describe("rowView: a flight, a train, a way of travel (the thin row)", () => {
  it("our pick: its hours, its stops, what one pays, Seç (still among the options)", () => {
    const r = rowView(find(jp(), "flight:ist-hnd"));
    expect(r.face).toBe("ticket");
    expect(r.lead).toBeNull();
    expect(r.stage).toBe("options");
    expect(r.stageWord).toBe("✨ Önerimiz");
    expect(r.title).toBe("İstanbul → Tokyo");
    expect(text(r.line)).toBe("20:10 → 20:55 · 1 aktarma");
    expect(r.line[0].tone).toBe("bold");
    expect(r.figure).toEqual({ big: "€660", small: "kişi başı" });
    expect(r.slot).toEqual({ kind: "take" });
  });
  it("bought with its code: the ticket in hand, its code on the stub, nothing to press", () => {
    const r = rowView(find(jp(), "flight:kix-ist"));
    expect(text(r.line)).toBe("11:00 → 17:40 · direkt");
    expect(r.figure).toEqual({ big: "K7T2QX", small: "PNR", code: true });
    expect(r.stage).toBe("ticket");
    expect(r.stageWord).toBe("Bilet elde");
    expect(r.slot).toEqual({ kind: "none" });
  });
  it("bought with nothing to show: Alındı, its ticket the last step, no paid sum guessed", () => {
    const vm = find(jp(), "flight:kix-ist");
    const r = rowView({ ...vm, access: vm.access && { ...vm.access, code: null, doc: { count: 0, name: null } } });
    expect(r.stage).toBe("bought");
    expect(r.stageWord).toBe("Alındı");
    expect(r.figure).toBeNull();
    expect(r.slot).toEqual({ kind: "proof", word: "Bileti ekle" });
    // (a file is as good as a code)
    expect(rowStage({ status: "booked", access: { ...vm.access!, code: null, doc: { count: 1, name: "e-bilet.pdf" } } })).toBe("ticket");
  });
  it("in Ulaşım the kind's word leads; chosen: Satın al", () => {
    const train = rowView(find(jp(), "transport:hakone-osaka"));
    expect(train.lead).toBe("Tren");
    expect(train.stageWord).toBe("Planda");
    expect(train.slot).toEqual({ kind: "book", word: "Satın al" });
    expect(train.figure?.big).toBe("€98");
    expect(rowView(find(jp(), "transport:kyoto-hakone")).figure).toEqual({ big: "OD-7721", small: "Bilet", code: true });
  });
  it("\"Ben hallettim\": sorted out by the traveller, counted bought; nothing to book: Planda, where it's paid (never \"Ayarlandı\")", () => {
    const own = rowView(find(jp(), "leg:2027-04-01:arrival:?"));
    expect(own.stage).toBe("bought");
    expect(own.stageWord).toBe("Sen hallettin");
    const r = rowView({ ...find(jp(), "leg:2027-04-01:arrival:?"), selfArranged: undefined });
    expect(r.stage).toBe("planned");
    expect(r.stageWord).toBe("Planda");
    expect(r.slot).toEqual({ kind: "onsite", text: "Yerinde alınır" });
    expect(r.figure).toBeNull();
  });
  it("options to pick from: Seç with how many, the first one's price", () => {
    const { trip, items } = ozora();
    const out = boardOf(trip, items, OZORA_TODAY).intents.find((v) => v.section === "flight" && v.head.route?.to === "Budapeşte")!;
    const r = rowView({ ...out, status: "deciding", chosen: null });
    expect(r.slot).toEqual({ kind: "pick", count: 2 });
    expect(r.stage).toBe("options");
    expect(r.stageWord).toBe("2 seçenek");
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
  it("booked with its number: Onay elde, the number on the stub", () => {
    const r = rowView(find(jp(), "stay:2027-04-09"));
    expect(r.lead).toBe("Hakone · 3 gece");
    expect(r.stageWord).toBe("Onay elde");
    expect(r.figure).toEqual({ big: "GK-48213", small: "Rezervasyon no", code: true });
    expect(r.slot).toEqual({ kind: "none" });
  });
  it("still to find: the city, no dates twice (the rail says them), Ara", () => {
    const r = rowView(find(jp(), "stay:2027-04-12"));
    expect(r.lead).toBeNull();
    expect(r.stageWord).toBe("Aranacak");
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

describe("stageMeters: a dated category's head (Karar, Bilet)", () => {
  it("decided of all; bought of those to buy ahead (a way paid on the spot isn't one)", () => {
    const at = (status: IntentVM["status"], code = false) => ({ status, access: code ? ({ code: { label: "PNR", value: "X" }, doc: { count: 0, name: null } } as IntentVM["access"]) : null });
    const m = stageMeters([at("deciding"), at("chosen"), at("arranged"), at("booked"), at("booked", true), at("skipped")]);
    expect(m.decided).toEqual([4, 5]);
    expect(m.bought).toEqual([2, 3]);
  });
  it("on the Japonya trip's flights", () => {
    const m = stageMeters(jp().filter((v) => v.section === "flight"));
    expect(m.decided[1]).toBeGreaterThan(0);
    expect(m.bought[0]).toBeGreaterThan(0);
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

describe("whileSearching (Kaçırdıklarımız 1)", () => {
  it("Aranıyor… in the slot while the AI looks, for a need still to find or decide only", async () => {
    const { whileSearching } = await import("../src/lib/rowView");
    const r = rowView(find(jp(), "stay:2027-04-12"));
    expect(whileSearching(r, "searching", true).slot).toEqual({ kind: "hap", tone: "busy", text: "Aranıyor…" });
    expect(whileSearching(r, "searching", true).stageWord).toBe("Aranıyor");
    expect(whileSearching(r, "searching", false).slot).toEqual({ kind: "ask" });
    expect(whileSearching(r, "chosen", true)).toBe(r);
  });
});
