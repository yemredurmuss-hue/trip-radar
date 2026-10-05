// What goes to Etkinlikler (a booking) and what to Yapılacak şeyler (a thing to do): a record needs a booking
// only with positive evidence — a price, a ticket seller, ticket / reservation / tour / show words, or a
// booking made on a real page. Whatever kind the chat or the add sheet gave it, a market, a walk, a shopping
// trip or a sunset is a to-do. Turkish and English phrasings, chat plans, the add sheet, quick lines, pages,
// and older records written before the rule.
import { describe, expect, it } from "vitest";
import { bookingOf, isIdea, looksBookable, needsBooking } from "../src/lib/booking";
import { sectionOfItem } from "../src/lib/categories";
import { quickIdea } from "../src/lib/ideas";
import { plannedItem, planToSave, type PlannedInput } from "../src/lib/planned";
import { emptyForm, quickItem, templateItem, TEMPLATES } from "../src/lib/templates";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const said = (over: Partial<PlannedInput>): PlannedInput => ({
  kind: "activity", date: null, end_date: null, time: null, from: null, to: null, city: "Porto", title: null, booked: false, note: null, ...over,
});
/** As the chat's plan_item saves it. */
const chat = (over: Partial<PlannedInput>, items: Item[] = []): Item => planToSave(said(over), items, "t1", "c1", 1).item;
const priced = (amount: number) => ({ amount, currency: "EUR", scope: "total" as const, taxesIncluded: "unknown" as const, source: "page" as const, observedAt: 1 });
const tpl = (id: string) => TEMPLATES.find((x) => x.id === id)!;

describe("the chat's plan_item: kind activity without evidence is a to-do", () => {
  it.each<[string, Partial<PlannedInput>]>([
    ["Porto Belo Pazarı", { title: "Porto Belo Pazarı" }],
    ["Porto Belo Pazarı, marked as booked", { title: "Porto Belo Pazarı", booked: true }],
    ["outdoor alışveriş", { title: "Outdoor alışverişi" }],
    ["Decathlon'dan yağmurluk al", { title: "Decathlon'dan yağmurluk al" }],
    ["Dom Luís'te gün batımı", { title: "Dom Luís'te gün batımı", date: "2026-10-09" }],
    ["Ribeira walk", { title: "Walk along Ribeira" }],
    ["Bolhão market", { title: "Bolhão market", booked: true }],
    ["Foz beach", { title: "Foz plajı" }],
    ["Miradouro da Vitória", { title: "Miradouro da Vitória viewpoint" }],
    ["Sé Katedrali", { title: "Sé Katedrali" }],
  ])("%s → Yapılacak şeyler", (_, over) => {
    const item = chat(over);
    expect(bookingOf(item)).toBe("none");
    expect(isIdea(item)).toBe(true);
    expect(sectionOfItem(item)).toBe("todo");
  });

  it.each<[string, Partial<PlannedInput>]>([
    ["Livraria Lello giriş bileti", { title: "Livraria Lello giriş bileti" }],
    ["Fado gecesi bileti aldım (said in the note)", { title: "Fado gecesi", booked: true, note: "Bileti aldım" }],
    ["Fado gecesi (a show)", { title: "Fado gecesi" }],
    ["GetYourGuide Douro turu", { title: "GetYourGuide Douro turu" }],
    ["Douro wine tour", { title: "Douro Valley wine tour" }],
    ["a concert", { title: "Coliseu konseri" }],
    ["a booking said with its PNR", { title: "Serralves", booked: true, note: "Rezervasyon no ABC123" }],
    ["entry fee", { title: "Palácio da Bolsa", note: "entry fee 12€" }],
  ])("%s → Etkinlikler", (_, over) => {
    const item = chat(over);
    expect(bookingOf(item)).toBe("needed");
    expect(sectionOfItem(item)).toBe("activity");
  });

  it("the kind 'other' chosen in the chat is read the same way, not as a booking by being chosen", () => {
    expect(sectionOfItem(chat({ kind: "other", title: "Outdoor alışveriş" }))).toBe("todo");
    expect(sectionOfItem(chat({ kind: "other", title: "Stadyum turu" }))).toBe("activity");
  });

  it("the to-do said again with a ticket moves to Etkinlikler (the same plan, updated)", () => {
    const first = chat({ title: "Fado", date: "2026-10-10" });
    // "Fado" alone is a show: a booking. A market said again stays one record.
    expect(sectionOfItem(first)).toBe("activity");
    const market = chat({ title: "Porto Belo Pazarı", date: "2026-10-10" });
    const again = planToSave(said({ title: "Porto Belo Pazarı", date: "2026-10-10", booked: true }), [market], "t1", "c2", 2);
    expect(again.same?.id).toBe(market.id);
    expect(sectionOfItem(again.item)).toBe("todo");
  });

  it("plannedItem no longer writes a booking for an activity: it is read from its evidence", () => {
    expect(plannedItem(said({ title: "Porto Belo Pazarı" }), "t1", "x", 1).booking).toBeUndefined();
  });
});

describe("the add sheet", () => {
  it("'Etkinlik · tur' named as a market is a to-do; with a price or ticket words it stays a booking", () => {
    const market = templateItem(tpl("activity"), { ...emptyForm(tpl("activity"), null, "EUR"), name: "Porto Belo Pazarı" }, "t1", "a", 1) as Item;
    expect(sectionOfItem(market)).toBe("todo");
    const tour = templateItem(tpl("activity"), { ...emptyForm(tpl("activity"), null, "EUR"), name: "Tekne", price: "25" }, "t1", "b", 1) as Item;
    expect(sectionOfItem(tour)).toBe("activity");
  });
  it("a tile pressed in Etkinlikler stays there until it's named; named as a market it goes to Yapılacak şeyler", () => {
    const placeholder = quickItem(tpl("activity"), { city: "Porto", date: "2026-10-09" }, "t1", "q", 1);
    expect(placeholder.name).toBe("Etkinlik");
    expect(sectionOfItem(placeholder)).toBe("activity");
    expect(sectionOfItem({ ...placeholder, name: "Porto Belo Pazarı" })).toBe("todo");
    expect(sectionOfItem({ ...placeholder, name: "Livraria Lello giriş bileti" })).toBe("activity");
  });
  it("a quick line is a to-do; one that says a ticket offers to move", () => {
    const line = quickIdea("Livraria Lello giriş bileti", ["Porto"], "t1", "l", 1)!;
    expect(sectionOfItem(line)).toBe("todo");
    expect(looksBookable(line)).toBe(true);
    expect(looksBookable(quickIdea("Porto Belo Pazarı", ["Porto"], "t1", "m", 1)!)).toBe(false);
  });
});

describe("older records (migration on read)", () => {
  it("a chat activity stored as needed by the old plannedItem, with no evidence, is read as a to-do", () => {
    const old = { ...chat({ title: "Porto Belo Pazarı", booked: true }), booking: "needed" as const };
    expect(sectionOfItem(old)).toBe("todo");
    const walk = { ...chat({ title: "Ribeira yürüyüşü" }), booking: "needed" as const, status: "chosen" as const };
    expect(sectionOfItem(walk)).toBe("todo");
  });
  it("a chat activity with evidence stays in Etkinlikler", () => {
    const old = { ...chat({ title: "Fado gecesi", booked: true, note: "bileti aldım" }), booking: "needed" as const };
    expect(sectionOfItem(old)).toBe("activity");
  });
  it("a page with a ticket seller or a price never moves, chosen or booked", () => {
    for (const status of ["saved", "chosen", "booked"] as const) {
      expect(sectionOfItem(makeItem({ category: "activity", name: "Douro Valley", url: "https://www.getyourguide.com/porto-l151/douro", status }))).toBe("activity");
      expect(sectionOfItem(makeItem({ category: "activity", name: "Serralves", price: priced(22), status }))).toBe("activity");
      expect(sectionOfItem(makeItem({ category: "activity", name: "Something", provider: "Tiqets", status }))).toBe("activity");
    }
  });
  it("a page that said it needs a booking is taken at its word; a page booked is a booking", () => {
    expect(sectionOfItem(makeItem({ category: "activity", name: "Palácio da Bolsa", booking: "needed" }))).toBe("activity");
    expect(sectionOfItem(makeItem({ category: "activity", name: "Ribeira", status: "booked" }))).toBe("activity");
  });
  it("a page chosen without evidence (a Maps link to a market) is a to-do, not lost", () => {
    const maps = makeItem({ category: "activity", name: "Mercado do Bolhão", url: "https://maps.app.goo.gl/abc", status: "chosen" });
    expect(sectionOfItem(maps)).toBe("todo");
    expect(isIdea(maps)).toBe(true);
  });
  it("the rest keeps its section: stays, flights, transport, eSIM, insurance, restaurants", () => {
    expect(needsBooking(makeItem({ category: "stay", status: "chosen" }))).toBe(true);
    expect(needsBooking(makeItem({ category: "transport", name: "Taksi" }))).toBe(true);
    expect(sectionOfItem(makeItem({ category: "other", name: "Seyahat sağlık sigortası" }))).toBe("other");
    expect(sectionOfItem(makeItem({ category: "food", name: "Majestic Café", status: "chosen" }))).toBe("food");
    expect(bookingOf(makeItem({ category: "food", name: "Belcanto", status: "booked", booking: "none" }))).toBe("needed");
  });
});
