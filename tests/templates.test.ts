// tests/templates.test.ts
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { transportMode } from "../src/lib/cardKinds";
import { db, listItems, listMessages } from "../src/lib/db";
import { plannedItem } from "../src/lib/planned";
import {
  addFromTemplate, editedItem, emptyForm, formOf, insertAt, insertAtCity, insertAtDay, insertAtStart, parseAmount, templateInput, templateItem, templateLabel, TEMPLATES,
  type FormValues, type TemplateId,
} from "../src/lib/templates";
import type { TimelineEntry, TimelineSection } from "../src/lib/timeline";
import { isInsurance, isRental } from "../src/lib/travelKinds";
import { makeItem } from "./fixtures/makeItem";

const tpl = (id: TemplateId) => TEMPLATES.find((x) => x.id === id)!;
const form = (id: TemplateId, over: Partial<FormValues>) => ({ ...emptyForm(tpl(id), null, "EUR"), ...over });

describe("the add sheet's tiles", () => {
  it("ten ways to travel, two places to stay, six others", () => {
    expect(TEMPLATES.filter((x) => x.group === "move").map((x) => templateLabel(x.id))).toEqual([
      "Uçuş", "Tren", "Otobüs", "Minibüs", "Vapur", "Taksi · transfer", "Araç kiralama", "Motosiklet", "Karavan", "Bisiklet",
    ]);
    expect(TEMPLATES.filter((x) => x.group === "stay").map((x) => templateLabel(x.id))).toEqual(["Otel", "Ev · daire"]);
    expect(TEMPLATES.filter((x) => x.group === "other").map((x) => templateLabel(x.id))).toEqual(["Etkinlik · tur", "Yapılacak", "Restoran", "eSIM", "Sigorta", "Not"]);
  });
  it("the form starts with the city and day of where it was opened", () => {
    const at = { city: "Porto", date: "2026-10-09" };
    expect(emptyForm(tpl("train"), at, "EUR")).toMatchObject({ from: "Porto", city: "Porto", date: "2026-10-09", to: "" });
    expect(emptyForm(tpl("car"), at, "EUR")).toMatchObject({ from: "", city: "Porto", date: "2026-10-09" });
  });
});

describe("what a template makes", () => {
  it("a bus: a plan between two places, planned, with its price", () => {
    const item = templateItem(tpl("bus"), form("bus", { from: "Lizbon", to: "Lagos", date: "2026-10-13", time: "10:00", price: "18" }), "t1", "b1", 5);
    expect(item).toMatchObject({
      id: "b1", name: "Otobüs · Lizbon → Lagos", category: "transport", plannedKind: "bus", status: "chosen", origin: "chat", city: "Lagos",
      flight: { from: "Lizbon", to: "Lagos", departure: "2026-10-13T10:00" },
      price: { amount: 18, currency: "EUR", scope: "total", source: "user" },
    });
  });
  it("a motorbike rental: in its city for its days", () => {
    const item = templateItem(tpl("moto"), form("moto", { city: "Funchal", date: "2026-10-12", end: "2026-10-15" }), "t1", "m1", 5);
    expect(typeof item).toBe("object");
    if (typeof item === "string") return;
    expect(item.name).toBe("Motosiklet kiralama · Funchal");
    expect(isRental(item)).toBe(true);
    expect(transportMode(item)).toBe("moto");
  });
  it("named things need a name; insurance and an eSIM can go without", () => {
    expect(templateItem(tpl("activity"), form("activity", { date: "2026-10-09" }), "t1", "a", 5)).toBe("Adını yaz.");
    const ins = templateItem(tpl("insurance"), form("insurance", { date: "2026-10-07" }), "t1", "s", 5);
    expect(ins).toMatchObject({ name: "Seyahat sigortası", category: "other" });
    expect(isInsurance(ins as never)).toBe(true);
  });
  it("a hotel: its name, city and nights", () => {
    expect(templateItem(tpl("hotel"), form("hotel", { name: "Hotel Ribeira", city: "Porto", date: "2026-10-09", end: "2026-10-11" }), "t1", "h", 5)).toMatchObject({
      category: "stay", name: "Hotel Ribeira", dates: { start: "2026-10-09", end: "2026-10-11" },
    });
  });
  it("prices as people type them; anything else is refused", () => {
    expect([parseAmount("68"), parseAmount("1.240"), parseAmount("68,50"), parseAmount("€ 1.240,50"), parseAmount("abc")]).toEqual([68, 1240, 68.5, 1240.5, null]);
    expect(templateInput(tpl("bus"), form("bus", { to: "Lagos", date: "2026-10-13", price: "abc" }))).toMatch(/Fiyat bir sayı olmalı/);
  });
  it("a template is always a new plan, never one said before", () => {
    const item = templateItem(tpl("flight"), form("flight", { to: "Madeira", date: "2026-10-11", time: "09:30" }), "t1", "new", 5);
    expect(item).toMatchObject({ id: "new", status: "chosen", flight: { departure: "2026-10-11T09:30" } });
  });
});

describe("Düzenle", () => {
  it("a plan's form comes back as it was saved, and an edit keeps the record", () => {
    const bus = templateItem(tpl("bus"), form("bus", { from: "Lizbon", to: "Lagos", date: "2026-10-13", time: "10:00", price: "18" }), "t1", "b1", 5);
    if (typeof bus === "string") throw new Error(bus);
    const back = formOf(bus, "EUR");
    expect(back.template.id).toBe("bus");
    expect(back.values).toMatchObject({ from: "Lizbon", to: "Lagos", date: "2026-10-13", time: "10:00", price: "18", name: "" });
    const edited = editedItem({ ...bus, status: "booked" }, back.template, { ...back.values, date: "2026-10-14" }, 9);
    expect(edited).toMatchObject({ id: "b1", status: "booked", createdAt: 5, dates: { start: "2026-10-14" } });
  });
  it("an edit that changes only the name keeps the note, the time and the summary", () => {
    const tour = plannedItem({ kind: "activity", date: "2026-10-12", end_date: null, time: "10:30", from: null, to: null, city: "Lizbon", title: "Tekne turu", booked: true, note: "PNR AB12 · iskele 3" }, "t1", "a1", 5);
    const back = formOf(tour, "EUR");
    const edited = editedItem(tour, back.template, { ...back.values, name: "Tejo tekne turu" }, 9);
    expect(edited).toMatchObject({
      id: "a1", name: "Tejo tekne turu", status: "booked", statusNote: "PNR AB12 · iskele 3", summary: "PNR AB12 · iskele 3",
      plannedKind: "activity", flight: { departure: "2026-10-12T10:30" },
    });
  });
  it("a transfer said without a day can be edited, and stays a transfer", () => {
    const transfer = plannedItem({ kind: "transfer", date: null, end_date: null, time: null, from: "Havalimanı", to: "Otel", city: null, title: null, booked: false, note: null }, "t1", "x1", 5);
    const back = formOf(transfer, "EUR");
    expect(back.template.id).toBe("taxi");
    const edited = editedItem(transfer, back.template, { ...back.values, to: "Alfama" }, 9);
    expect(edited).toMatchObject({ id: "x1", plannedKind: "transfer", category: "transport", flight: { from: "Havalimanı", to: "Alfama" }, dates: { start: null } });
  });
  it("a chat transfer or 'other' plan opens as a taxi or a note", () => {
    expect(formOf(makeItem({ origin: "chat", plannedKind: "transfer" }), "EUR").template.id).toBe("taxi");
    expect(formOf(makeItem({ origin: "chat", plannedKind: "other", category: "other" }), "EUR").template.id).toBe("note");
  });
});

describe("the + between two cards", () => {
  const trip = (role: string, from: string, to: string, date: string, legTo: string | null = null) =>
    ({
      kind: "travel", key: `t:${role}`, role, date, title: "", subtitle: null, searchUrl: null,
      travel: { items: [makeItem({ flight: { from, to, departure: `${date}T09:00`, arrival: null, carrier: null, flightNumber: null, stops: null } })], settled: null },
      leg: legTo ? { to: { city: legTo }, from: { city: null } } : null,
    }) as unknown as TimelineEntry;
  it("brings the city and the day of the card above it; after a stay, its city and no day", () => {
    const stay = { kind: "stay", key: "s", date: "2026-10-08", block: { kind: "open", range: { start: "2026-10-08", end: "2026-10-11" }, nights: 3, city: "Porto", groups: [], searchUrl: "" }, title: "", subtitle: "" } as TimelineEntry;
    const event = { kind: "event", key: "e", date: "2026-10-09", dayNo: 2, item: makeItem({ city: "Porto" }) } as TimelineEntry;
    const leg = { kind: "leg", key: "l", date: "2026-10-11", leg: { to: { city: "Lizbon" }, from: { city: "Porto" } } } as unknown as TimelineEntry;
    expect([insertAt(stay), insertAt(event), insertAt(leg)]).toEqual([
      { city: "Porto", date: null }, { city: "Porto", date: "2026-10-09" }, { city: "Lizbon", date: "2026-10-11" },
    ]);
  });
  it("a trip's city is never an airport code or a station: the leg's city, else the airport's", () => {
    expect(insertAt(trip("arrival", "IST", "OPO", "2026-10-08"))).toEqual({ city: "Porto", date: "2026-10-08" });
    expect(insertAt(trip("move", "Porto Campanhã", "Lisboa Santa Apolónia", "2026-10-11", "Lizbon"))).toEqual({ city: "Lizbon", date: "2026-10-11" });
    expect(insertAt(trip("other", "LIS", "FNC", "2026-10-12"))).toEqual({ city: "Funchal", date: "2026-10-12" });
  });
  it("after the flight home: the day, no city", () => {
    expect(insertAt(trip("departure", "LIS", "IST", "2026-10-14"))).toEqual({ city: null, date: "2026-10-14" });
  });
  it("the top of the plan, a city's head, a day of the itinerary", () => {
    const arrival = trip("arrival", "IST", "OPO", "2026-10-08");
    const city = { kind: "city", key: "c", index: 1, city: "Porto", range: { start: "2026-10-08", end: "2026-10-11" }, nights: 3, stays: [], entries: [] } as Extract<TimelineSection, { kind: "city" }>;
    expect(insertAtStart([{ kind: "travel", key: "x", entry: arrival } as TimelineSection, city])).toEqual({ city: null, date: "2026-10-08" });
    expect(insertAtStart([])).toEqual({ city: null, date: null });
    expect(insertAtCity(city)).toEqual({ city: "Porto", date: "2026-10-08" });
    expect(insertAtDay("2026-10-10", "Porto")).toEqual({ city: "Porto", date: "2026-10-10" });
  });
});

describe("saving", () => {
  const names = async (tripId: string) => (await listItems(tripId)).map((i) => i.name).sort();
  it("a second restaurant in the same city and day is added next to the first", async () => {
    await addFromTemplate("t6", tpl("food"), form("food", { name: "Le Comptoir", city: "Paris", date: "2026-10-12" }), "r1", 1);
    await addFromTemplate("t6", tpl("food"), form("food", { name: "Chez Janou", city: "Paris", date: "2026-10-12" }), "r2", 2);
    expect(await names("t6")).toEqual(["Chez Janou", "Le Comptoir"]);
  });
  it("a second hotel with the same check-in is added next to the first", async () => {
    await addFromTemplate("t7", tpl("hotel"), form("hotel", { name: "Hotel A", city: "Porto", date: "2026-10-09", end: "2026-10-11" }), "h1", 1);
    await addFromTemplate("t7", tpl("hotel"), form("hotel", { name: "Hotel B", city: "Porto", date: "2026-10-09", end: "2026-10-10" }), "h2", 2);
    expect(await names("t7")).toEqual(["Hotel A", "Hotel B"]);
  });
  it("two flights on the same route and day are two flights", async () => {
    await addFromTemplate("t8", tpl("flight"), form("flight", { from: "Lisbon", to: "Lyon", date: "2026-10-14", time: "08:00" }), "f1", 1);
    await addFromTemplate("t8", tpl("flight"), form("flight", { from: "Lisbon", to: "Lyon", date: "2026-10-14", time: "18:00" }), "f2", 2);
    const deps = (await listItems("t8")).map((i) => i.flight?.departure).sort();
    expect(deps).toEqual(["2026-10-14T08:00", "2026-10-14T18:00"]);
  });
  it("writes the plan and a line in the trip's history", async () => {
    const made = await addFromTemplate("t5", tpl("ferry"), form("ferry", { from: "Funchal", to: "Porto Santo", date: "2026-10-16" }), "f1", 7);
    expect(made).toMatchObject({ id: "f1", name: "Feribot · Funchal → Porto Santo" });
    expect(await (await db()).get("items", "f1")).toBeTruthy();
    expect((await listMessages("t5")).map((m) => m.text)).toEqual(["Feribot · Funchal → Porto Santo plana eklendi"]);
  });
});
