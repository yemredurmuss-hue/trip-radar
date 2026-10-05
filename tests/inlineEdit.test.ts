// tests/inlineEdit.test.ts
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listMessages } from "../src/lib/db";
import { editableFields, editField, fieldInput, firstField, fieldPlaceholder, fieldValue, nextField, saveCardField, saveField } from "../src/lib/inlineEdit";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { quickItem, TEMPLATES, type TemplateId } from "../src/lib/templates";
import { makeItem } from "./fixtures/makeItem";

const quick = (id: TemplateId, at = { city: "Porto", date: "2026-10-09" }) => quickItem(TEMPLATES.find((t) => t.id === id)!, at, "t1", `e-${id}`, 5);
const said = (over: Partial<PlannedInput>) =>
  plannedItem({ kind: "activity", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...over }, "t1", "s1", 5);
const ok = (r: ReturnType<typeof editField>) => {
  if (r == null || typeof r === "string") throw new Error(`no record: ${r}`);
  return r;
};

describe("which fields a card offers, in Tab order", () => {
  it("by kind: a trip, a rental, a stay, a restaurant or an activity, the rest", () => {
    expect(editableFields(quick("bus"))).toEqual(["from", "to", "date", "time", "price"]);
    expect(editableFields(quick("taxi"))).toEqual(["from", "to", "date", "time", "price"]);
    expect(editableFields(quick("car"))).toEqual(["city", "date", "end", "price"]);
    expect(editableFields(quick("hotel"))).toEqual(["name", "city", "date", "end", "price"]);
    expect(editableFields(quick("food"))).toEqual(["name", "city", "date", "time", "price"]);
    expect(editableFields(quick("activity"))).toEqual(["name", "city", "date", "time", "price"]);
    expect(editableFields(quick("todo"))).toEqual(["name", "city", "date", "price"]);
    expect(editableFields(quick("esim"))).toEqual(["name", "city", "date", "price"]);
  });
  it("a plan said in the chat, and a saved page by what it is", () => {
    expect(editableFields(said({ title: "Tekne turu" }))).toEqual(["name", "city", "date", "time", "price"]);
    expect(editableFields(makeItem({ category: "activity", name: "Douro tekne turu" }))).toEqual(["name", "city", "date", "time", "price"]);
    expect(editableFields(makeItem({ category: "stay", name: "Jardim Stay" }))).toEqual(["name", "city", "date", "end", "price"]);
    const flight = { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: null, carrier: null, flightNumber: null, stops: 0 };
    expect(editableFields(makeItem({ category: "flight", flight }))).toEqual(["from", "to", "date", "time", "price"]);
    expect(editableFields(makeItem({ category: "transport", name: "Europcar · Funchal", city: "Funchal", dates: { start: "2026-10-12", end: "2026-10-15", source: "page" } }))).toEqual(["city", "date", "end", "price"]);
    expect(editableFields(makeItem({ category: "esim", name: "Airalo Portekiz" }))).toEqual(["name", "city", "date", "price"]);
  });
  it("a card just added opens at its title, or where a trip goes", () => {
    expect([firstField(quick("todo")), firstField(quick("hotel")), firstField(quick("bus")), firstField(quick("car"))]).toEqual(["name", "name", "to", "end"]);
    expect(firstField(quick("bus", { city: null, date: null } as never))).toBe("from");
  });
  it("Tab goes on, Shift+Tab back, and stops at the ends", () => {
    const f = editableFields(quick("hotel"));
    expect([nextField(f, "name"), nextField(f, "price"), nextField(f, "city", true), nextField(f, "name", true)]).toEqual(["city", null, "name", null]);
  });
  it("empty fields ask; each opens its own box", () => {
    const bus = quick("bus");
    expect([fieldPlaceholder("to", bus), fieldPlaceholder("time", bus), fieldPlaceholder("price", bus)]).toEqual(["Nereye", "Saat ekle", "Fiyat ekle"]);
    expect([fieldPlaceholder("date", quick("hotel")), fieldPlaceholder("end", quick("hotel")), fieldPlaceholder("city", quick("car"))]).toEqual(["Giriş ekle", "Çıkış ekle", "Yer ekle"]);
    expect(["date", "end", "time", "price", "name"].map((k) => fieldInput(k as never))).toEqual(["date", "date", "time", "number", "text"]);
  });
  it("a box starts with the value; the kind's word is blank (it shows as the box's hint)", () => {
    expect([fieldValue(quick("bus"), "from", "EUR"), fieldValue(quick("bus"), "to", "EUR"), fieldValue(quick("todo"), "name", "EUR")]).toEqual(["Porto", "", ""]);
  });
});

describe("a change made on the card", () => {
  it("the title of a just-added to-do", () => {
    expect(ok(editField(quick("todo"), { name: "Bolhão pazarı" }, 9))).toMatchObject({ name: "Bolhão pazarı", city: "Porto", plannedKind: "todo", booking: "none", updatedAt: 9 });
  });
  it("where a bus goes: its name and its city follow", () => {
    expect(ok(editField(quick("bus"), { to: "Lizbon" }, 9))).toMatchObject({ name: "Otobüs · Porto → Lizbon", city: "Lizbon", flight: { from: "Porto", to: "Lizbon" } });
  });
  it("a date and an hour", () => {
    const bus = ok(editField(quick("bus"), { date: "2026-10-11" }, 9));
    expect(bus.dates.start).toBe("2026-10-11");
    expect(ok(editField(bus, { time: "10:00" }, 10)).flight?.departure).toBe("2026-10-11T10:00");
    expect(ok(editField(quick("food"), { time: "20:30" }, 9)).flight?.departure).toBe("2026-10-09T20:30");
  });
  it("a price, in the currency picked beside it; cleared, it's gone", () => {
    const priced = ok(editField(quick("bus"), { price: "18", currency: "EUR" }, 9));
    expect(priced.price).toMatchObject({ amount: 18, currency: "EUR", source: "user" });
    expect(ok(editField(priced, { price: "20", currency: "TRY" }, 10)).price).toMatchObject({ amount: 20, currency: "TRY" });
    expect(ok(editField(priced, { price: "" }, 10)).price.amount).toBeNull();
  });
  it("a stay's check-in moved keeps its nights; its check-out alone changes them", () => {
    const hotel = quick("hotel");
    expect(ok(editField(hotel, { date: "2026-10-10" }, 9)).dates).toMatchObject({ start: "2026-10-10", end: "2026-10-11" });
    expect(ok(editField(hotel, { end: "2026-10-11" }, 9)).dates).toMatchObject({ start: "2026-10-09", end: "2026-10-11" });
  });
  it("keeps the note, the PNR, the status and the time a plan was said with", () => {
    const tour = said({ title: "Tekne turu", date: "2026-10-12", time: "10:30", city: "Lizbon", booked: true, note: "PNR AB12" });
    expect(ok(editField(tour, { name: "Tejo tekne turu" }, 9))).toMatchObject({
      name: "Tejo tekne turu", status: "booked", statusNote: "PNR AB12", plannedKind: "activity", flight: { departure: "2026-10-12T10:30" },
    });
  });
  it("what's still missing may stay missing; a wrong value is refused; nothing changed is nothing", () => {
    expect(ok(editField(quick("car", { city: null, date: null } as never), { date: "2026-10-12" }, 9)).dates.start).toBe("2026-10-12");
    expect(editField(quick("hotel"), { end: "2026-10-08" }, 9)).toMatch(/Bitiş tarihi geçersiz/);
    expect(editField(quick("bus"), { price: "abc" }, 9)).toMatch(/Fiyat bir sayı olmalı/);
    expect(editField(quick("bus"), { from: " Porto " }, 9)).toBeNull();
  });
});

describe("saving a field", () => {
  it("a saved page's card keeps it as a correction; the page's value stays under it", async () => {
    const page = makeItem({ id: "pg1", tripId: "t-inline2", category: "activity", name: "Douro tekne turu", city: "Porto" });
    await (await db()).put("items", page);
    expect(await saveCardField(page, { name: "Douro gün batımı turu" }, "EUR")).toMatchObject({ name: "Douro gün batımı turu" });
    expect(await (await db()).get("items", "pg1")).toMatchObject({ name: "Douro tekne turu", userEdits: { name: "Douro gün batımı turu" } });
  });
  it("writes the record and a line in the history; an error writes nothing", async () => {
    const todo = quickItem(TEMPLATES.find((t) => t.id === "todo")!, { city: "Porto", date: null }, "t-inline", "td", 5);
    await (await db()).put("items", todo);
    expect(await saveField(todo, { name: "Bolhão pazarı" }, "EUR", 9)).toMatchObject({ name: "Bolhão pazarı" });
    expect((await (await db()).get("items", "td"))?.name).toBe("Bolhão pazarı");
    expect(await saveField(todo, { date: "12.10" }, "EUR", 10)).toMatch(/YYYY-AA-GG/);
    expect((await listMessages("t-inline")).map((m) => m.text)).toEqual(["Bolhão pazarı güncellendi"]);
  });
});
