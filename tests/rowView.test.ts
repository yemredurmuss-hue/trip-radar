// What an intent's row says on the Plan (lib/rowView.ts, onay paketi 2026-10-21), on the v83 prototype's Japonya and Ozora:
// each state only its own facts and one thing on the right (Ara · Seç and the count · Seç · Satın al / Rezerve et · Bileti
// ekle · the stub), the step's word after the kind's or a chosen stay's city (onay paketi 2026-10-22: the four steps), a rental
// drawn as a stay's card.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import type { IntentVM } from "../src/lib/intents";
import { deckLead, planSteps, rowFace, rowStage, rowView, sourceCounts } from "../src/lib/rowView";
import { boardOf, japan, JAPAN_TODAY, ozora, OZORA_TODAY } from "./fixtures/v82Trips";

const jp = () => {
  const { trip, items } = japan();
  return boardOf(trip, items, JAPAN_TODAY).intents;
};
const find = (list: IntentVM[], key: string) => list.find((v) => v.key === key)!;
const text = (parts: { text: string }[]) => parts.map((p) => p.text).join(" · ");

describe("rowView: a flight, a train, a way of travel (the thin row)", () => {
  it("our pick alone: its hours, its stops, what one pays, Seç (still among the options)", () => {
    const f = find(jp(), "flight:ist-hnd");
    const r = rowView({ ...f, options: f.options.filter((o) => o.id === f.chosen!.id), more: [], optionCount: 1 });
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
  it("our pick among several: a deck with it in front (Karar Masası, 23 Ekim): 2 seçenek, its line, Seç 2", () => {
    const r = rowView(find(jp(), "flight:ist-hnd"));
    expect(r.stage).toBe("options");
    expect(r.stageWord).toBe("2 seçenek");
    expect(text(r.line)).toMatch(/^✨ önerimiz .* · 20:10 → 20:55 · 1 aktarma$/);
    expect(r.figure).toEqual({ big: "€660", small: "önerimiz" });
    expect(r.slot).toEqual({ kind: "pick", count: 2 });
    expect(r.rest).toBe(0);
  });
  it("chosen among several: the deck stays under it, rest counts the others; one alone, none", () => {
    const f = find(jp(), "flight:ist-hnd");
    expect(rowView({ ...f, status: "chosen" }).rest).toBe(1);
    expect(rowView({ ...f, status: "chosen", options: f.options.filter((o) => o.id === f.chosen!.id), more: [] }).rest).toBe(0);
    expect(rowView({ ...f, status: "booked" }).rest).toBe(0);
  });
  it("bought with its code: the ticket in hand, its code on the stub, nothing to press", () => {
    const r = rowView(find(jp(), "flight:kix-ist"));
    expect(text(r.line)).toBe("11:00 → 17:40 · direkt");
    expect(r.figure).toEqual({ big: "K7T2QX", small: "PNR", code: true });
    expect(r.stage).toBe("ticket");
    expect(r.stageWord).toBe("Bilet elde");
    expect(r.slot).toEqual({ kind: "none" });
  });
  it("bought with its code and a seat: the seat on the stub beside the code's word (Karar Masası, karar 8)", () => {
    const { trip, items } = japan();
    const seated = items.map((i) => (i.bookingRef === "K7T2QX" ? { ...i, statusNote: "Koltuk 14C" } : i));
    const r = rowView(find(boardOf(trip, seated, JAPAN_TODAY).intents, "flight:kix-ist"));
    expect(r.figure).toEqual({ big: "K7T2QX", small: "PNR · koltuk 14C", code: true });
  });
  it("bought with nothing to show: Bilet alındı (Karar Masası), its ticket the last step, no paid sum guessed", () => {
    const vm = find(jp(), "flight:kix-ist");
    const r = rowView({ ...vm, access: vm.access && { ...vm.access, code: null, doc: { count: 0, name: null } } });
    expect(r.stage).toBe("bought");
    expect(r.stageWord).toBe("Bilet alındı");
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
    // (Karar Masası: the best one's carrier and hours on the row, its price "en iyisi")
    expect(r.figure?.small).toBe("en iyisi");
    expect(r.desk).toBe(true);
  });
});

describe("rowView: a stay (the card that doesn't fold)", () => {
  it("chosen: its name (its city and nights on the rail), the site and the area, by the night, Rezerve et", () => {
    const r = rowView(find(jp(), "stay:2027-04-02"));
    expect(r.face).toBe("card");
    expect(r.lead).toBeNull();
    expect(r.title).toBe("Hyatt Centric Ginza");
    expect(text(r.line)).toBe("Booking.com · Ginza");
    expect(r.figure).toEqual({ big: "€213", small: "gece · €639" });
    expect(r.slot).toEqual({ kind: "book", word: "Rezerve et" });
  });
  it("booked with its number: Onay elde, its check-in hour and what was paid on the stub (the number in its details)", () => {
    const vm = find(jp(), "stay:2027-04-09");
    const r = rowView(vm);
    expect(r.lead).toBeNull();
    expect(r.stageWord).toBe("Onay elde");
    expect(r.figure?.code).toBe(true);
    expect(r.figure?.plain).toBe(true);
    const at15 = rowView({ ...vm, access: { ...vm.access!, checkIn: "15:00" }, paid: "€639 ödendi" });
    expect(at15.figure).toEqual({ top: "giriş", big: "15:00", small: "€639 ödendi", code: true, plain: true });
    const noHour = rowView({ ...vm, access: { ...vm.access!, checkIn: null }, paid: "€639 ödendi" });
    expect(noHour.figure).toEqual({ big: "€639", small: "ödendi", code: true, plain: true });
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
    expect(text(r.third)).toMatch(/^Çıkış \d+ Nisan \S+ · Booking\.com \d/);
  });
  it("a rental is a card, its kind and days over its name", () => {
    expect(rowFace({ frame: "ticket", kind: "transport", ticket: { rental: { line: null, pick: null, days: 3, back: null } } as IntentVM["ticket"] })).toBe("card");
    expect(rowFace({ frame: "ticket", kind: "flight", ticket: { rental: null } as IntentVM["ticket"] })).toBe("ticket");
  });
  it("in English", () => {
    withLang("en", () => {
      const r = rowView(find(jp(), "stay:2027-04-02"));
      expect(r.lead).toBeNull();
      expect(r.slot).toEqual({ kind: "book", word: "Book" });
    });
  });
});

describe("planSteps: Planın durumu and Sıradaki işler (web)", () => {
  it("the dated needs by step; what's to decide first, then to buy, then the tickets to add", () => {
    const list = jp();
    const p = planSteps(list);
    expect(p.counts.options + p.counts.planned + p.counts.bought + p.counts.ticket).toBe(p.total);
    expect(p.total).toBe(list.filter((v) => v.status !== "skipped" && v.frame !== "collection" && ["flight", "stay", "transport"].includes(v.section)).length);
    expect(p.next.length).toBeLessThanOrEqual(3);
    const rank: Record<string, number> = { "Seç": 0, "Ara": 1, "Bileti al": 2, "Rezerve et": 2, "Bileti ekle": 3, "Onayı ekle": 3 };
    const ranks = p.next.map((n) => rank[n.act]);
    expect(ranks.every((r) => r != null)).toBe(true);
    expect(ranks.every((r, i) => i === 0 || ranks[i - 1] <= r)).toBe(true);
    expect(p.next[0].act).toBe("Seç");
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

describe("Karar Masası: the flight row's language (Uçuş first)", () => {
  const flights = () => jp().filter((v) => v.section === "flight" && v.frame !== "collection");
  it("chosen: Seçtin; bought: Bilet alındı; a train keeps Planda and Alındı", () => {
    const f = flights().find((v) => v.chosen)!;
    expect(rowView({ ...f, status: "chosen" }).stageWord).toBe("Seçtin");
    const train = find(jp(), "transport:hakone-osaka");
    expect(rowView(train).desk).toBe(false);
    expect(rowView({ ...train, status: "chosen" }).stageWord).toBe("Planda");
  });
  it("nothing found yet: Kendin ara ↗ (self); a stay keeps Ara", () => {
    const f = flights()[0];
    const r = rowView({ ...f, status: "searching", options: [], more: [], optionCount: 0, chosen: null });
    expect(r.stageWord).toBe("Aranacak");
    expect(r.slot).toEqual({ kind: "self" });
    expect(rowView(find(jp(), "stay:2027-04-12")).slot).toEqual({ kind: "ask" });
  });
  it("while the AI looks: Aranıyor and busy, Kendin ara ↗ stays; a deck keeps its count and Seç", async () => {
    const { whileSearching } = await import("../src/lib/rowView");
    const f = flights()[0];
    const r = rowView({ ...f, status: "searching", options: [], more: [], optionCount: 0, chosen: null });
    const busy = whileSearching(r, "searching", true);
    expect(busy).toMatchObject({ stageWord: "Aranıyor", busy: true, slot: { kind: "self" } });
    const { trip, items } = ozora();
    const out = boardOf(trip, items, OZORA_TODAY).intents.find((v) => v.section === "flight" && v.head.route?.to === "Budapeşte")!;
    const deck = whileSearching(rowView({ ...out, status: "deciding", chosen: null }), "deciding", true);
    expect(deck).toMatchObject({ stageWord: "2 seçenek", busy: true, slot: { kind: "pick", count: 2 } });
  });
  it("a deck's line: its best one's carrier, hours and stops", () => {
    const { trip, items } = ozora();
    const out = boardOf(trip, items, OZORA_TODAY).intents.find((v) => v.section === "flight" && v.head.route?.to === "Budapeşte")!;
    const r = rowView({ ...out, status: "deciding", chosen: null });
    const best = out.options.find((o) => o.ours) ?? out.options[0];
    expect(text(r.line)).toContain(`${best.leg!.dep} → ${best.leg!.arr}`);
  });
  it("the category's line: seçildi in Uçuş, planda elsewhere", async () => {
    const { stepParts } = await import("../src/lib/rowView");
    const counts = { options: 2, planned: 1, bought: 1, ticket: 1 };
    expect(stepParts(counts, true).map((p) => p.text)).toEqual(["2 alındı", "1 seçildi", "2 karar"]);
    expect(stepParts(counts, false).map((p) => p.text)).toEqual(["2 alındı", "1 planda", "2 karar"]);
    expect(stepParts(counts, true)[2].decide).toBe(true);
  });
  it("bought: the stamp on the stub, with the day it was marked; one's own says Senin; a cover has none", async () => {
    const { markedDay } = await import("../src/lib/rowView");
    const f = flights().find((v) => v.key === "flight:kix-ist")!;
    const at = new Date(2027, 2, 24, 9, 30).getTime();
    const bare = { ...f, access: f.access && { ...f.access, code: null, doc: { count: 0, name: null } } };
    const r = rowView({ ...bare, chosen: f.chosen && { ...f.chosen, item: { ...f.chosen.item, statusAt: at } } });
    expect(r.stamp).toEqual({ word: "Alındı", day: markedDay(at) });
    expect(markedDay(at)).toBe("24 Mar");
    expect(rowView({ ...bare, status: "arranged", selfArranged: true }).stamp?.word).toBe("Senin");
    expect(rowView({ ...f, status: "included" }).stamp).toBeNull();
    expect(rowView(f).stamp).toBeNull();
    expect(markedDay(undefined)).toBeNull();
  });
});
