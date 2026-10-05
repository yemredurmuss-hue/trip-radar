// tests/needsBooking.test.ts
// What has to be booked (Plan, "Rezerve et") and what is only an idea (Fikirler).
import { describe, expect, it } from "vitest";
import { bookingByKind, bookingOf, isIdea, looksBookable, needsBooking } from "../src/lib/booking";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { emptyForm, templateItem, TEMPLATES } from "../src/lib/templates";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const priced = (amount: number) => ({ amount, currency: "EUR", scope: "total" as const, taxesIncluded: "unknown" as const, source: "page" as const, observedAt: 1 });
const said = (over: Partial<PlannedInput>): PlannedInput => ({
  kind: "todo", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...over,
});

describe("what the record says comes first", () => {
  it("needed or none, whatever its kind", () => {
    expect(bookingOf(makeItem({ category: "activity", name: "Pazar", booking: "needed" }))).toBe("needed");
    expect(bookingOf(makeItem({ category: "activity", name: "Douro tekne turu", price: priced(25), booking: "none" }))).toBe("none");
  });
});

describe("older records and pages that don't say: by kind", () => {
  it.each<[string, Partial<Item>]>([
    ["stay", { category: "stay" }],
    ["flight", { category: "flight" }],
    ["transport", { category: "transport", name: "Taksi" }],
    ["eSIM", { category: "esim" }],
    ["insurance", { category: "other", name: "Seyahat sağlık sigortası" }],
  ])("%s → needed", (_, over) => expect(bookingByKind(makeItem(over))).toBe("needed"));

  it("an activity: a price, a ticket seller, or ticket / reservation / tour words", () => {
    expect(bookingByKind(makeItem({ category: "activity", name: "Serralves Müzesi", price: priced(22) }))).toBe("needed");
    expect(bookingByKind(makeItem({ category: "activity", name: "Porto şarap tadımı", url: "https://www.getyourguide.com/porto-l151/x" }))).toBe("needed");
    expect(bookingByKind(makeItem({ category: "activity", name: "Belém", provider: "Tiqets" }))).toBe("needed");
    expect(bookingByKind(makeItem({ category: "activity", name: "Livraria Lello", summary: "Giriş bileti gerekiyor" }))).toBe("needed");
    expect(bookingByKind(makeItem({ category: "activity", name: "Douro tekne turu" }))).toBe("needed");
    expect(bookingByKind(makeItem({ category: "activity", name: "Fado night", summary: "Reservation recommended" }))).toBe("needed");
    expect(bookingByKind(makeItem({ category: "activity", name: "Ribeira → Foz nehir kenarı yürüyüşü" }))).toBe("none");
    expect(bookingByKind(makeItem({ category: "activity", name: "Turuncu kapılar sokağı" }))).toBe("none");
  });
  it("a restaurant only when its page asks for a reservation", () => {
    expect(bookingByKind(makeItem({ category: "food", name: "Majestic Café" }))).toBe("none");
    expect(bookingByKind(makeItem({ category: "food", name: "Belcanto", summary: "Rezervasyon şart · 2 Michelin yıldızı" }))).toBe("needed");
    expect(bookingByKind(makeItem({ category: "food", name: "Taberna", price: priced(30) }))).toBe("none");
  });
  it("a note or a to-do never; any other record with a price does", () => {
    expect(bookingByKind(makeItem({ category: "other", name: "Vize randevusu", plannedKind: "note" }))).toBe("none");
    expect(bookingByKind(makeItem({ category: "other", name: "Bilet al", plannedKind: "todo" }))).toBe("none");
    expect(bookingByKind(makeItem({ category: "other", name: "Lounge" }))).toBe("none");
    expect(bookingByKind(makeItem({ category: "other", name: "Lounge", price: priced(40) }))).toBe("needed");
  });
});

describe("chosen or booked: a thing to do by its evidence, the rest stays a booking", () => {
  it("a page booked is a booking; a thing to do chosen is one only with evidence; a restaurant chosen stays one", () => {
    expect(bookingOf(makeItem({ category: "activity", name: "Fado gecesi", status: "chosen" }))).toBe("needed");
    expect(bookingOf(makeItem({ category: "activity", name: "Ribeira yürüyüşü", status: "chosen" }))).toBe("none");
    expect(bookingOf(makeItem({ category: "activity", name: "Ribeira yürüyüşü", status: "booked" }))).toBe("needed");
    expect(bookingOf(makeItem({ category: "food", name: "Cantinho do Avillez", status: "chosen" }))).toBe("needed");
    expect(bookingOf(makeItem({ category: "other", name: "Plan · Porto", plannedKind: "other", status: "chosen", origin: "chat" }))).toBe("none");
    expect(isIdea(makeItem({ category: "activity", name: "Fado gecesi", status: "booked" }))).toBe(false);
    expect(bookingOf(makeItem({ category: "other", name: "Not", plannedKind: "note", status: "chosen" }))).toBe("none");
    expect(bookingOf(makeItem({ category: "other", name: "Pazar", plannedKind: "todo", status: "chosen" }))).toBe("none");
    // Saved and not chosen: by its words too (a fado night is a show).
    expect(bookingOf(makeItem({ category: "activity", name: "Fado gecesi" }))).toBe("needed");
    expect(bookingOf(makeItem({ category: "activity", name: "Pazar" }))).toBe("none");
  });
  it("a booking confirmation is a booking even if the page said none", () => {
    expect(bookingOf(makeItem({ category: "food", name: "Belcanto", status: "booked", booking: "none" }))).toBe("needed");
    expect(bookingOf(makeItem({ category: "food", name: "Majestic Café", status: "chosen", booking: "none" }))).toBe("none");
  });
  it("the chat's activity is a booking by its evidence, not its kind; its restaurant and note are ideas", () => {
    expect(bookingOf(plannedItem(said({ kind: "activity", title: "Fado gecesi", city: "Lizbon" }), "t1", "f", 1))).toBe("needed");
    expect(bookingOf(plannedItem(said({ kind: "activity", title: "Porto Belo Pazarı", city: "Porto" }), "t1", "f", 1))).toBe("none");
    expect(plannedItem(said({ kind: "activity", title: "Fado gecesi", city: "Lizbon" }), "t1", "f", 1).booking).toBeUndefined();
    expect(plannedItem(said({ kind: "todo", title: "Pazar" }), "t1", "g", 1).booking).toBe("none");
  });
  it("the sheet's restaurant and note are ideas (none), not bookings by being chosen", () => {
    const tpl = (id: string) => TEMPLATES.find((x) => x.id === id)!;
    const food = templateItem(tpl("food"), { ...emptyForm(tpl("food"), null, "EUR"), name: "Cantinho" }, "t1", "c", 1) as Item;
    const note = templateItem(tpl("note"), { ...emptyForm(tpl("note"), null, "EUR"), name: "Vize" }, "t1", "d", 1) as Item;
    expect([food.booking, note.booking, bookingOf(food), bookingOf(note)]).toEqual(["none", "none", "none", "none"]);
  });
});

describe("ideas for Fikirler", () => {
  it("food, activities and the rest that need no booking, not ruled out", () => {
    expect(isIdea(makeItem({ category: "food", name: "Majestic Café" }))).toBe(true);
    expect(isIdea(makeItem({ category: "food", name: "Majestic Café", status: "dismissed" }))).toBe(false);
    expect(isIdea(makeItem({ category: "activity", name: "Douro tekne turu" }))).toBe(false);
    expect(isIdea(makeItem({ category: "stay", booking: "none" }))).toBe(false);
    expect(needsBooking(makeItem({ category: "activity", name: "Douro tekne turu" }))).toBe(true);
  });
  it("set aside as none though its words say a ticket: it can move to the bookings", () => {
    expect(looksBookable(makeItem({ category: "activity", name: "Livraria Lello", summary: "Giriş bileti gerekiyor", booking: "none" }))).toBe(true);
    expect(looksBookable(makeItem({ category: "activity", name: "Livraria Lello", summary: "Giriş bileti gerekiyor" }))).toBe(false);
    expect(looksBookable(makeItem({ category: "activity", name: "Yürüyüş", booking: "none" }))).toBe(false);
    // A quick line that says it: a to-do, but it can move.
    expect(looksBookable(makeItem({ category: "other", plannedKind: "todo", name: "Porto'da Livraria Lello, giriş bileti var", booking: "none" }))).toBe(true);
  });
});

describe("a to-do as a plan", () => {
  it("said in the chat or added from the sheet: other, never a booking, named after what it is", () => {
    const todo = plannedItem(said({ title: "Pazara git", city: "Funchal" }), "t1", "x", 1);
    expect(todo).toMatchObject({ category: "other", plannedKind: "todo", name: "Pazara git", needKey: "other:todo-pazara-git", city: "Funchal" });
    expect(bookingOf(todo)).toBe("none");
    expect(plannedItem(said({ city: "Porto" }), "t1", "y", 1).name).toBe("Yapılacak · Porto");
  });
  it("the sheet's 'Yapılacak' is none; its 'Etkinlik · tur' is a booking by its evidence", () => {
    const tpl = (id: string) => TEMPLATES.find((x) => x.id === id)!;
    const todo = templateItem(tpl("todo"), { ...emptyForm(tpl("todo"), null, "EUR"), name: "Pazara git" }, "t1", "a", 1) as Item;
    const tour = templateItem(tpl("activity"), { ...emptyForm(tpl("activity"), null, "EUR"), name: "Fado" }, "t1", "b", 1) as Item;
    const market = templateItem(tpl("activity"), { ...emptyForm(tpl("activity"), null, "EUR"), name: "Porto Belo Pazarı" }, "t1", "c", 1) as Item;
    expect([todo.booking, bookingOf(tour), bookingOf(market)]).toEqual(["none", "needed", "none"]);
  });
});
