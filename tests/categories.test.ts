// The Plan by category (spec 0.34): every block and record in exactly one of the seven sections, in date
// order inside it (then time; undated last, by city), the header's pill and whether a section opens.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { categorize, catDomKey, findInSections, isIdeaSection, planProgress, sectionOfItem, sectionProgress, sectionStatus, SECTION_ORDER, type CatSection } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { ideaGroups, ideaRows, ideaTabs } from "../src/lib/ideaList";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { buildTimeline, nightsKey } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const trip: Trip = { id: "t1", title: "Porto ve Lizbon", confirmedDates: { start: "2026-10-08", end: "2026-10-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };

let n = 0;
const said = (input: Partial<PlannedInput> & Pick<PlannedInput, "kind">, over: Partial<Item> = {}): Item => ({
  ...plannedItem({ date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...input }, "t1", `p${++n}`, n),
  ...over,
});
const stay = (name: string, start: string, end: string, city: string, status: Item["status"] = "booked") =>
  makeItem({ name, category: "stay", city, needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "url" }, status, price: { amount: 300, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 } });
const flight = (name: string, from: string, to: string, day: string, status: Item["status"], at = "09:00") =>
  makeItem({ name, category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), city: to, dates: { start: day, end: null, source: "page" }, status, flight: { from, to, departure: `${day}T${at}`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 } });

/** `today`: before the trip unless a test says otherwise, so a day never goes by on its own. */
function sectionsOf(items: Item[], t: Trip = trip, today = "2026-10-01"): { sections: CatSection[]; legs: ReturnType<typeof buildLegs>; plan: ReturnType<typeof buildPlan> } {
  const plan = buildPlan(t, items);
  const legs = buildLegs(plan, t);
  const hidden = new Set(t.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  return { sections: categorize({ plan, timeline, items, legs, hidden, today }), legs, plan };
}
const names = (sections: CatSection[]) =>
  Object.fromEntries(sections.filter((s) => s.entries.length).map((s) => [s.id, s.entries.map((e) => e.row.name)]));
/** Every record drawn, with how many sections it's in. */
function drawn(sections: CatSection[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const s of sections) for (const e of s.entries) for (const id of e.itemIds) out.set(id, [...(out.get(id) ?? []), s.id]);
  return out;
}
/** Nothing live is lost, and nothing is in two sections. */
function expectEachOnce(sections: CatSection[], items: Item[], closed: string[] = []) {
  const seen = drawn(sections);
  // And on the plan's own terms: nothing fell through to the last-resort list.
  expect(sections.flatMap((s) => s.entries).filter((e) => e.key.startsWith("loose:")).map((e) => e.row.name)).toEqual([]);
  for (const i of items) {
    if (i.status === "dismissed" || closed.includes(i.id)) continue;
    expect(seen.get(i.id), i.name).toHaveLength(1);
  }
}

describe("the record's section", () => {
  it("goes by what it is: a flight, a stay, getting around, something to book or do, a meal, insurance and internet", () => {
    expect(sectionOfItem(said({ kind: "flight", date: "2026-10-08" }))).toBe("flight");
    expect(sectionOfItem(said({ kind: "stay", date: "2026-10-08", end_date: "2026-10-09", city: "Porto" }))).toBe("stay");
    for (const kind of ["train", "bus", "minibus", "ferry", "taxi", "transfer", "car_rental", "moto_rental", "rv_rental", "bike_rental"] as const) {
      expect(sectionOfItem(said({ kind, date: "2026-10-09" })), kind).toBe("transport");
    }
    expect(sectionOfItem(said({ kind: "activity", date: null, title: "Douro tekne turu" }))).toBe("activity");
    // An activity by its kind alone is not a booking: a market said as one is a thing to do.
    expect(sectionOfItem(said({ kind: "activity", date: null, title: "Porto Belo Pazarı" }, { booking: "needed" }))).toBe("todo");
    expect(sectionOfItem(said({ kind: "todo", date: null }))).toBe("todo");
    expect(sectionOfItem(said({ kind: "note", date: null }))).toBe("todo");
    expect(sectionOfItem(said({ kind: "food", date: null }))).toBe("food");
    expect(sectionOfItem(said({ kind: "food", date: null }, { booking: "needed" }))).toBe("food");
    expect(sectionOfItem(said({ kind: "esim", date: null }))).toBe("other");
    expect(sectionOfItem(said({ kind: "insurance", date: null }))).toBe("other");
  });

  it("reads older records by their words: a ticket makes an activity, insurance saved as transport is insurance", () => {
    expect(sectionOfItem(makeItem({ category: "activity", name: "Douro tekne turu", price: { amount: 25, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 } }))).toBe("activity");
    expect(sectionOfItem(makeItem({ category: "activity", name: "Ribeira'da yürüyüş" }))).toBe("todo");
    expect(sectionOfItem(makeItem({ category: "transport", name: "Seyahat sigortası Allianz" }))).toBe("other");
    expect(sectionOfItem(makeItem({ category: "other", name: "Airalo eSIM Portekiz" }))).toBe("other");
    expect(sectionOfItem(makeItem({ category: "other", name: "Fado gecesi", price: { amount: 30, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 } }))).toBe("activity");
    // Chosen with no evidence (a Maps pin): a thing to do; booked on its page, or saying it needs one: a booking.
    expect(sectionOfItem(makeItem({ category: "activity", name: "Serralves", status: "chosen" }))).toBe("todo");
    expect(sectionOfItem(makeItem({ category: "activity", name: "Serralves", status: "booked" }))).toBe("activity");
    expect(sectionOfItem(makeItem({ category: "activity", name: "Serralves", booking: "needed" }))).toBe("activity");
  });
});

describe("the sample trip by category", () => {
  it("puts every block in its section, in date order, nothing twice", async () => {
    const id = await loadDemoTrip();
    const t = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const { ctx } = await loadDecisions(t, items);
    const plan = buildPlan(t, items);
    const legs = buildLegs(plan, t, ctx.listings);
    const timeline = buildTimeline(plan, legs, items);
    const sections = categorize({ plan, timeline, items, legs });
    expect(sections.map((s) => s.id)).toEqual([...SECTION_ORDER]);
    expect(names(sections)).toEqual({
      flight: ["İstanbul → Porto", "Lizbon → İstanbul"],
      stay: ["Porto konaklaması", "Lisboa Loft"],
      transport: ["Porto → Lizbon"],
      activity: ["Douro tekne turu", "Livraria Lello", "Serralves Müzesi", "Tiyatro"],
      food: ["Majestic Café"],
      other: ["Airalo Portekiz 5 GB"],
    });
    expectEachOnce(sections, items, plan.closed.map((c) => c.item.id));
    // Everything found its place on the plan's own terms: nothing fell through to the last-resort list.
    expect(sections.flatMap((s) => s.entries).filter((e) => e.key.startsWith("loose:"))).toEqual([]);
    const flights = sections.find((s) => s.id === "flight")!;
    expect(flights.days.map((d) => [d.date, d.city])).toEqual([
      ["2026-10-08", "Porto"],
      ["2026-10-14", "Lizbon"],
    ]);
    expect(flights.entries.map((e) => e.row.meta)).toEqual(["Porto · 8 Eki · 05:40", "Lizbon · 14 Eki · 19:40"]);
    // The undated activities come after the dated one, in their city.
    const acts = sections.find((s) => s.id === "activity")!;
    expect(acts.days.map((d) => (d.date ? d.date : `Tarihsiz ${d.city}`))).toEqual(["2026-10-09", "Tarihsiz Porto"]);
    // The blocks keep their dom ids: the itinerary and the to-dos find them.
    expect(acts.entries.map(catDomKey)[0]).toMatch(/^event:/);
  });
});

describe("sections from what's saved and said", () => {
  const base = [stay("Jardim Stay", "2026-10-08", "2026-10-11", "Porto"), stay("Lisboa Loft", "2026-10-11", "2026-10-14", "Lizbon", "chosen")];

  it("transfers with a plan are under Ulaşım, a car rented too; empty transfers aren't on the plan", () => {
    const items = [
      ...base,
      flight("TP 1234", "IST", "OPO", "2026-10-08", "booked"),
      said({ kind: "car_rental", date: "2026-10-12", end_date: "2026-10-13", city: "Lizbon" }),
      said({ kind: "taxi", date: "2026-10-08", city: "Porto" }),
    ];
    const { sections } = sectionsOf(items);
    const transport = sections.find((s) => s.id === "transport")!;
    expect(transport.entries.map((e) => e.piece.kind === "entry" && e.piece.entry.kind)).toEqual(["leg", "travel", "rental"]);
    expectEachOnce(sections, items);
    // Nothing empty there: the transfer to the airport with no plan is a to-do of the itinerary.
    expect(transport.entries.every((e) => e.state !== "empty" || e.piece.kind === "entry")).toBe(true);
  });

  it("a hidden transfer's options wait with it; hidden nights leave the plan", () => {
    const items = [stay("Jardim Stay", "2026-10-08", "2026-10-10", "Porto"), flight("TP 1234", "IST", "OPO", "2026-10-08", "booked")];
    const shown = sectionsOf(items);
    const arrival = shown.legs.find((l) => l.kind === "arrival")!;
    const taxi = makeItem({ name: "Uber OPO", category: "transport", needKey: arrival.options[0]?.needKey ?? "transport:x" });
    // Empty nights 10–14: one block, "4 gece boş".
    const stays = shown.sections.find((s) => s.id === "stay")!;
    expect(stays.entries.map((e) => [e.row.name, e.state, e.nights])).toEqual([
      ["Jardim Stay", "done", 0],
      ["Konaklama yok", "empty", 4],
    ]);
    expect(stays.status).toEqual({ text: "4 gece boş", tone: "wait" });
    expect(stays.open).toBe(true);
    const hidden = sectionsOf(items, { ...trip, hidden: [nightsKey({ start: "2026-10-10", end: "2026-10-14" }), `leg:${arrival.key}`] });
    expect(hidden.sections.find((s) => s.id === "stay")!.entries.map((e) => e.row.name)).toEqual(["Jardim Stay"]);
    expect(hidden.sections.find((s) => s.id === "stay")!.status).toEqual({ text: "✓ 1 alındı", tone: "done" });
    expect(hidden.sections.find((s) => s.id === "stay")!.open).toBe(false);
    expect(taxi.name).toBe("Uber OPO");
  });

  it("orders a section by date then time, ties as on the plan, the undated last by city in the trip's order", () => {
    const items = [
      ...base,
      said({ kind: "activity", date: "2026-10-12", time: "18:00", city: "Lizbon", title: "Fado" }, { booking: "needed" }),
      said({ kind: "activity", date: "2026-10-12", time: "10:00", city: "Lizbon", title: "Tramvay 28", note: "bilet" }, { booking: "needed" }),
      said({ kind: "activity", date: "2026-10-09", city: "Porto", title: "Douro", note: "tur" }, { booking: "needed" }),
      makeItem({ name: "Oceanário", category: "activity", city: "Lizbon", booking: "needed" }),
      makeItem({ name: "Serralves", category: "activity", city: "Porto", booking: "needed" }),
      makeItem({ name: "Bir yer", category: "activity", city: null, booking: "needed" }),
      makeItem({ name: "Sintra sarayı", category: "activity", city: "Sintra", booking: "needed" }),
    ];
    const { sections } = sectionsOf(items);
    const acts = sections.find((s) => s.id === "activity")!;
    expect(acts.entries.map((e) => e.row.name)).toEqual(["Douro", "Tramvay 28", "Fado", "Serralves", "Oceanário", "Sintra sarayı", "Bir yer"]);
    expect(acts.days.map((d) => [d.date, d.city, d.entries.length])).toEqual([
      ["2026-10-09", "Porto", 1],
      ["2026-10-12", "Lizbon", 2],
      [null, "Porto", 1],
      [null, "Lizbon", 1],
      [null, "Sintra", 1],
      [null, null, 1],
    ]);
    expectEachOnce(sections, items);
  });

  it("to-dos and restaurants: on their day or waiting for one; a restaurant to book stays a restaurant", () => {
    const items = [
      ...base,
      said({ kind: "todo", date: null, city: "Porto", title: "Gün batımı" }, { status: "saved", booking: "none" }),
      said({ kind: "todo", date: "2026-10-12", city: "Lizbon", title: "Pazar" }, { status: "saved", booking: "none" }),
      said({ kind: "food", date: null, city: "Porto", title: "Majestic Café" }, { status: "saved", booking: "none" }),
      makeItem({ name: "Belcanto", category: "food", city: "Lizbon", dates: { start: "2026-10-12", end: null, source: "user" }, status: "chosen", booking: "needed" }),
    ];
    const { sections } = sectionsOf(items);
    expect(names(sections).todo).toEqual(["Pazar", "Gün batımı"]);
    expect(names(sections).food).toEqual(["Belcanto", "Majestic Café"]);
    const todo = sections.find((s) => s.id === "todo")!;
    // Ruled-out ones aren't there; one ticked off goes to the bottom of its city.
    const more = sectionsOf([
      ...items,
      said({ kind: "todo", date: null, city: "Porto", title: "Yapıldı bile" }, { status: "saved", booking: "none", doneAt: 9, createdAt: 0 }),
      said({ kind: "todo", date: null, city: "Porto", title: "Elendi" }, { status: "dismissed", booking: "none" }),
    ]).sections;
    expect(names(more).todo).toEqual(["Pazar", "Gün batımı", "Yapıldı bile"]);
    // An idea without a day isn't waiting for anything: no amber line, a neutral count instead (0.35.3).
    expect(todo.status).toBeNull();
    expect(todo.ideas).toEqual({ total: 2, onDay: 1, done: 0 });
    expect(todo.open).toBe(true);
    expect(todo.entries.map((e) => e.row.status)).toEqual(["Güne eklendi", "Fikir"]);
    const food = sections.find((s) => s.id === "food")!;
    // A table picked and not booked is still waiting; a restaurant with no day isn't.
    expect(food.status).toEqual({ text: "1 rezerve edilmedi", tone: "wait" });
    expect(food.ideas).toEqual({ total: 2, onDay: 1, done: 0 });
    expectEachOnce(sections, items);
  });

  it("the header counts what's settled of all (\"3/4\"), section by section", () => {
    const priced = { amount: 25, currency: "EUR", scope: "total" as const, taxesIncluded: "yes" as const, source: "page" as const, observedAt: 1 };
    const items = [
      ...base, // Jardim booked, Lisboa Loft chosen (not booked yet)
      flight("TP 1234", "IST", "OPO", "2026-10-08", "saved"),
      flight("PC 99", "IST", "OPO", "2026-10-08", "saved", "07:00"),
      flight("TP 99", "LIS", "IST", "2026-10-14", "booked"),
      said({ kind: "taxi", date: "2026-10-08", city: "Porto", from: "Havalimanı", to: "Otel" }),
      makeItem({ name: "Douro tekne turu", category: "activity", city: "Porto", dates: { start: "2026-10-09", end: null, source: "user" }, status: "chosen", price: priced }),
      makeItem({ name: "Livraria Lello", category: "activity", city: "Porto", dates: { start: "2026-10-10", end: null, source: "user" }, status: "booked", price: priced }),
      said({ kind: "todo", date: null, city: "Porto", title: "Gün batımı" }, { status: "saved", booking: "none" }),
      said({ kind: "todo", date: "2026-10-12", city: "Lizbon", title: "Pazar" }, { status: "saved", booking: "none" }),
      said({ kind: "todo", date: null, city: "Porto", title: "Yapıldı bile" }, { status: "saved", booking: "none", doneAt: 9 }),
      said({ kind: "food", date: null, city: "Porto", title: "Majestic Café" }, { status: "saved", booking: "none" }),
      said({ kind: "food", date: "2026-10-09", city: "Porto", title: "Taberna" }, { status: "saved", booking: "none" }),
      makeItem({ name: "Belcanto", category: "food", city: "Lizbon", dates: { start: "2026-10-12", end: null, source: "user" }, status: "chosen", booking: "needed" }),
      makeItem({ name: "Cantinho", category: "food", city: "Lizbon", dates: { start: "2026-10-13", end: null, source: "user" }, status: "booked", booking: "needed" }),
      said({ kind: "esim", date: null }, { status: "chosen", installedAt: 5 }),
      said({ kind: "insurance", date: null }, { status: "chosen" }),
    ];
    const { sections } = sectionsOf(items);
    const count = Object.fromEntries(sections.filter((s) => s.entries.length).map((s) => [s.id, `${s.settled}/${s.entries.length}`]));
    // Ulaşım: the taxi planned (nothing to book) of it and the change of city not planned yet.
    expect(count).toEqual({ flight: "1/2", stay: "1/2", transport: "1/2", activity: "1/2", todo: "2/3", food: "2/4", other: "1/2" });
    // All settled: the count is full and the pill green.
    const done = sectionsOf([stay("Jardim Stay", "2026-10-08", "2026-10-14", "Porto")]).sections.find((s) => s.id === "stay")!;
    expect([done.settled, done.entries.length, done.status?.tone]).toEqual([1, 1, "done"]);
  });

  it("eSIM and insurance are Diğer, for the whole trip; installed is done (and goes after what's left)", () => {
    const items = [...base, said({ kind: "esim", date: null }, { status: "chosen", installedAt: 5 }), said({ kind: "insurance", date: null }, { status: "chosen" })];
    const { sections } = sectionsOf(items);
    const other = sections.find((s) => s.id === "other")!;
    expect(other.entries.map((e) => [e.row.name, e.row.meta, e.row.status])).toEqual([
      ["Seyahat sigortası", "Tüm gezi", "Satın alınmadı"],
      ["eSIM", "Tüm gezi", "Kuruldu"],
    ]);
    expect(other.status).toEqual({ text: "1 satın alınmadı", tone: "wait" });
    expectEachOnce(sections, items);
  });

  it("the header: a decision, tickets missing, combined; all bought is green and closed", () => {
    const items = [
      ...base,
      flight("TP 1234", "IST", "OPO", "2026-10-08", "saved"),
      flight("PC 99", "IST", "OPO", "2026-10-08", "saved", "07:00"),
      flight("TP 99", "LIS", "IST", "2026-10-14", "chosen"),
    ];
    const { sections } = sectionsOf(items);
    const flights = sections.find((s) => s.id === "flight")!;
    expect(flights.status).toEqual({ text: "1 bilet yok · 1 karar", tone: "wait" });
    expect(flights.entries.map((e) => [e.row.ring, e.row.status])).toEqual([
      ["open", "2 seçenek"],
      ["half", "Bilet yok"],
    ]);
    const stays = sections.find((s) => s.id === "stay")!;
    expect(stays.status).toEqual({ text: "1 rezerve edilmedi", tone: "wait" });
    // The row names the option its card shows first: the best ranked.
    const plan = buildPlan(trip, items);
    const legs = buildLegs(plan, trip);
    const timeline = buildTimeline(plan, legs, items);
    const byRank = (first: Item) => categorize({ plan, timeline, items, legs, rank: new Map([[first.id, 0]]) }).find((s) => s.id === "flight")!.entries[0].row.meta;
    expect(byRank(items[3])).toBe("Porto · 8 Eki · 07:00");
    expect(byRank(items[2])).toBe("Porto · 8 Eki · 09:00");
    expect(sectionStatus("activity", [])).toBeNull();
  });

  it("an empty trip has seven empty sections; a trip without dates still shows everything", () => {
    const empty = sectionsOf([], { ...trip, confirmedDates: null });
    expect(empty.sections.map((s) => [s.id, s.entries.length, s.status])).toEqual(SECTION_ORDER.map((id) => [id, 0, null]));
    const undated: Trip = { ...trip, confirmedDates: null };
    const items = [
      makeItem({ name: "Jardim Stay", category: "stay", city: "Porto", needKey: "stay:porto" }),
      makeItem({ name: "Casa Azul", category: "stay", city: "Porto", needKey: "stay:porto" }),
      makeItem({ name: "TP 1", category: "flight", needKey: "flight:ist-opo", flight: { from: "IST", to: "OPO", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } }),
      makeItem({ name: "Douro turu", category: "activity", city: "Porto", booking: "needed" }),
      makeItem({ name: "Kiralık araç", category: "transport", plannedKind: "car_rental", city: "Porto", needKey: "transport:car" }),
      said({ kind: "todo", date: null, title: "Yürüyüş" }, { status: "saved", booking: "none" }),
      makeItem({ name: "Eski", category: "activity", status: "dismissed" }),
    ];
    const { sections } = sectionsOf(items, undated);
    expect(names(sections)).toEqual({ flight: ["İstanbul → Porto"], stay: ["Jardim Stay"], transport: ["Kiralık araç"], activity: ["Douro turu"], todo: ["Yürüyüş"] });
    expectEachOnce(sections, items);
    expect(sections.find((s) => s.id === "stay")!.entries[0].itemIds).toHaveLength(2);
  });

  it("plans for a city without a day go in their own sections; a clash of bookings stays with its block", () => {
    const items = [
      ...base,
      stay("Clash Hostel", "2026-10-09", "2026-10-10", "Porto"),
      said({ kind: "car_rental", date: null, city: "Lizbon" }),
      makeItem({ name: "Avis Lizbon", category: "transport", plannedKind: "car_rental", city: "Lizbon", needKey: "transport:car_rental:lizbon" }),
      makeItem({ name: "Belém turu", category: "activity", city: "Lizbon", status: "chosen" }),
    ];
    const { sections } = sectionsOf(items);
    expectEachOnce(sections, items);
    expect(names(sections).activity).toEqual(["Belém turu"]);
    const stays = sections.find((s) => s.id === "stay")!;
    expect(stays.entries[0].itemIds).toHaveLength(2);
    // The block's dom id goes with its first piece, so the itinerary still finds it.
    const pieces = sections.flatMap((s) => s.entries).filter((e) => e.entryKeys.some((k) => k.startsWith("plan:")));
    expect(pieces.filter((e) => e.domKey).length).toBe(1);
  });

  it("a transfer stands as its card says: a taxi planned is done, a change of city by train is a ticket to buy, then bought", () => {
    const items = [...base, flight("TP 1234", "IST", "OPO", "2026-10-08", "booked")];
    const legs = sectionsOf(items).legs;
    const arrival = legs.find((l) => l.kind === "arrival")!;
    const move = legs.find((l) => l.kind === "move")!;
    const choice = (mode: "taxi" | "train", booked = false) => ({ mode, booked, note: null, updatedAt: 1 });
    const planned = sectionsOf(items, { ...trip, legs: { [arrival.key]: choice("taxi"), [move.key]: choice("train") } }).sections;
    const transport = planned.find((s) => s.id === "transport")!;
    expect(transport.entries.map((e) => [e.row.name, e.state, e.row.status])).toEqual([
      ["Havalimanı → Otel", "done", "Planlandı"],
      ["Porto → Lizbon", "book", "Bilet yok"],
    ]);
    expect(transport.status).toEqual({ text: "1 bilet yok", tone: "wait" });
    const bought = sectionsOf(items, { ...trip, legs: { [arrival.key]: choice("taxi", true), [move.key]: choice("train", true) } }).sections;
    expect(bought.find((s) => s.id === "transport")!.entries.map((e) => e.row.status)).toEqual(["Ayarlandı", "Alındı"]);
  });

  it("a change of city by plane is a flight, under Uçuş, with or without a ticket saved", () => {
    const items = [...base, flight("TP 1234", "IST", "OPO", "2026-10-08", "booked")];
    const move = sectionsOf(items).legs.find((l) => l.kind === "move")!;
    const byPlane = (booked: boolean) => sectionsOf(items, { ...trip, legs: { [move.key]: { mode: "flight", booked, note: null, updatedAt: 1 } } }).sections;
    const planned = byPlane(false);
    expect(planned.find((s) => s.id === "transport")?.entries.map((e) => e.row.name) ?? []).not.toContain("Porto → Lizbon");
    const flights = planned.find((s) => s.id === "flight")!;
    expect(flights.entries.map((e) => [e.row.name, e.state, e.row.status])).toEqual([
      ["İstanbul → Porto", "done", "Alındı"],
      ["Porto → Lizbon", "book", "Bilet yok"],
      ["Dönüş uçuşu", "empty", "Eklenmedi"],
    ]);
    expect(byPlane(true).find((s) => s.id === "flight")!.entries.map((e) => e.row.status)).toEqual(["Alındı", "Alındı", "Eklenmedi"]);
    // The same block, by train: Ulaşım.
    const byTrain = sectionsOf(items, { ...trip, legs: { [move.key]: { mode: "train", booked: false, note: null, updatedAt: 1 } } }).sections;
    expect(byTrain.find((s) => s.id === "transport")!.entries.map((e) => e.row.name)).toContain("Porto → Lizbon");
  });

  it("finds a to-do's place: by record, transfer or block", () => {
    const items = [...base, flight("TP 1234", "IST", "OPO", "2026-10-08", "chosen"), makeItem({ name: "Serralves", category: "activity", city: "Porto", booking: "needed" })];
    const { sections } = sectionsOf(items);
    const serralves = items.at(-1)!;
    expect(findInSections(sections, { item: serralves.id })).toEqual({ section: "activity", key: `item:${serralves.id}`, dom: `cat:item:${serralves.id}` });
    expect(findInSections(sections, { entry: `event:${serralves.id}` })?.section).toBe("activity");
    expect(findInSections(sections, { entry: "stay:2026-10-11" })?.section).toBe("stay");
    expect(findInSections(sections, { item: "nope" })).toBeNull();
  });
});

describe("what's hidden, section by section (kategoriler-v4: \"Gizlenenler · N göster\" at a section's end)", () => {
  const hiddenOf = (sections: CatSection[]) =>
    Object.fromEntries(sections.filter((s) => s.hidden.length).map((s) => [s.id, s.hidden.map((h) => `${h.kind}:${h.kind === "leg" ? h.leg.kind : h.kind === "nights" ? `${h.range.start}_${h.range.end}` : h.item.name}`)]));
  /** Every dismissed or closed record, every hidden transfer and stretch of nights: in exactly one section's list. */
  function expectHiddenOnce(sections: CatSection[], ids: string[]) {
    const seen = new Map<string, string[]>();
    for (const s of sections) for (const h of s.hidden) seen.set(h.key, [...(seen.get(h.key) ?? []), s.id]);
    for (const id of ids) expect(seen.get(id), id).toHaveLength(1);
    expect([...seen.values()].every((v) => v.length === 1)).toBe(true);
  }

  it("a ruled-out record waits in its own section: a flight under Uçuş, a restaurant under Restoranlar, a tour under Etkinlikler", () => {
    const items = [
      stay("Jardim Stay", "2026-10-08", "2026-10-11", "Porto"),
      flight("TK 1755", "IST", "OPO", "2026-10-08", "dismissed"),
      makeItem({ name: "Cantinho do Avillez", category: "food", city: "Porto", status: "dismissed" }),
      makeItem({ name: "Douro tekne turu", category: "activity", city: "Porto", booking: "needed", status: "dismissed" }),
      makeItem({ name: "Airalo eSIM", category: "esim", status: "dismissed" }),
    ];
    const { sections } = sectionsOf(items);
    expect(hiddenOf(sections)).toEqual({
      flight: ["dismissed:TK 1755"],
      activity: ["dismissed:Douro tekne turu"],
      food: ["dismissed:Cantinho do Avillez"],
      other: ["dismissed:Airalo eSIM"],
    });
    expectHiddenOnce(sections, items.filter((i) => i.status === "dismissed").map((i) => `item:${i.id}`));
    // Ruled out is never on the plan itself.
    expect(drawn(sections).has(items[1].id)).toBe(false);
  });

  it("an option a booking closed waits under its section, with the reason", () => {
    const other = stay("Alfama Suites", "2026-10-08", "2026-10-11", "Porto", "saved");
    const items = [stay("Jardim Stay", "2026-10-08", "2026-10-11", "Porto"), other];
    const { sections } = sectionsOf(items);
    const stays = sections.find((s) => s.id === "stay")!;
    expect(stays.hidden).toHaveLength(1);
    const h = stays.hidden[0];
    expect(h.kind === "closed" && [h.item.name, h.reason]).toEqual(["Alfama Suites", "Jardim Stay rezervasyonu bu geceleri kapsıyor"]);
    expectHiddenOnce(sections, [`item:${other.id}`]);
  });

  it("a transfer said not needed waits under Ulaşım, nights said not needed under Konaklama", () => {
    const items = [stay("Jardim Stay", "2026-10-08", "2026-10-10", "Porto"), flight("TP 1234", "IST", "OPO", "2026-10-08", "booked")];
    const arrival = sectionsOf(items).legs.find((l) => l.kind === "arrival")!;
    const nights = nightsKey({ start: "2026-10-10", end: "2026-10-14" });
    const { sections } = sectionsOf(items, { ...trip, hidden: [nights, `leg:${arrival.key}`] });
    expect(hiddenOf(sections)).toEqual({ stay: ["nights:2026-10-10_2026-10-14"], transport: ["leg:arrival"] });
    const leg = sections.find((s) => s.id === "transport")!.hidden[0];
    expect(leg.key).toBe(`leg:${arrival.key}`);
    expect(sections.find((s) => s.id === "stay")!.hidden[0].key).toBe(nights);
    expectHiddenOnce(sections, [nights, `leg:${arrival.key}`]);
  });

  it("nothing hidden, nothing listed", () => {
    const { sections } = sectionsOf([stay("Jardim Stay", "2026-10-08", "2026-10-14", "Porto")]);
    expect(sections.every((s) => s.hidden.length === 0)).toBe(true);
  });

  it("the sample trip: the stay a booking closed is under Konaklama", async () => {
    const id = await loadDemoTrip();
    const t = (await (await db()).get("trips", id))!;
    const items = [...(await listItems(id))];
    const plan = buildPlan(t, items);
    const legs = buildLegs(plan, t);
    const sections = categorize({ plan, timeline: buildTimeline(plan, legs, items), items, legs });
    expect(hiddenOf(sections)).toEqual({ stay: plan.closed.map((c) => `closed:${c.item.name}`) });
    expectHiddenOnce(sections, [...plan.closed.map((c) => `item:${c.item.id}`), ...items.filter((i) => i.status === "dismissed").map((i) => `item:${i.id}`)]);
  });
});

describe("the header's bar", () => {
  it("fills settled of all, whole numbers; complete (green) only when everything is settled", () => {
    const of = (settled: number, total: number) => sectionProgress({ settled, entries: Array.from({ length: total }) as CatSection["entries"] });
    expect(of(3, 4)).toEqual({ settled: 3, total: 4, pct: 75, complete: false });
    expect(of(1, 3)).toEqual({ settled: 1, total: 3, pct: 33, complete: false });
    expect(of(2, 2)).toEqual({ settled: 2, total: 2, pct: 100, complete: true });
    // Only hidden things: nothing to fill, never "complete".
    expect(of(0, 0)).toEqual({ settled: 0, total: 0, pct: 0, complete: false });
  });
  it("the hero's \"Rezervasyonların\" is the headers' \"3/4\"s added up", async () => {
    const id = await loadDemoTrip();
    const t = (await (await db()).get("trips", id))!;
    const { sections } = sectionsOf(await listItems(id), t);
    const sum = sections.filter((s) => !isIdeaSection(s.id)).reduce((a, s) => ({ settled: a.settled + sectionProgress(s).settled, total: a.total + sectionProgress(s).total }), { settled: 0, total: 0 });
    const all = planProgress(sections);
    expect(all).toMatchObject(sum);
    expect(all.total).toBeGreaterThan(0);
    expect(all.pct).toBe(Math.round((sum.settled / sum.total) * 100));
    expect(planProgress([])).toEqual({ settled: 0, total: 0, pct: 0, complete: false });
    const of = (settled: number, total: number, id: CatSection["id"] = "stay") => ({ id, settled, entries: Array.from({ length: total }) as CatSection["entries"] });
    expect(planProgress([of(1, 1), of(2, 2)])).toEqual({ settled: 3, total: 3, pct: 100, complete: true });
    // The ideas aren't work waiting: things to do, restaurants and İlham stay out of "x/y onaylandı".
    expect(planProgress([of(1, 2), of(0, 5, "todo"), of(1, 4, "food"), of(0, 3, "inspo")])).toEqual({ settled: 1, total: 2, pct: 50, complete: false });
  });
});

describe("the ideas as a list by city (0.35.3)", () => {
  const base = [stay("Jardim Stay", "2026-10-08", "2026-10-11", "Porto"), stay("Lisboa Loft", "2026-10-11", "2026-10-14", "Lizbon", "chosen")];
  const todo = (title: string, city: string, date: string | null, over: Partial<Item> = {}) => said({ kind: "todo", date, city, title }, { status: "saved", booking: "none", ...over });
  const listOf = (items: Item[], today: string) => {
    const { sections, plan } = sectionsOf(items, trip, today);
    const section = sections.find((s) => s.id === "todo")!;
    return { section, groups: ideaGroups(section.entries, plan, today) };
  };
  const shape = (groups: ReturnType<typeof ideaGroups>) => groups.map((g) => [g.kind === "city" ? g.city : g.kind, g.rows.map((r) => r.item?.name)]);

  it("before the trip: the trip's cities in order, what's on a day first in each", () => {
    const items = [...base, todo("Lizbon tramvay", "Lizbon", null), todo("Gün batımı", "Porto", null), todo("Pazar", "Porto", "2026-10-09")];
    expect(shape(listOf(items, "2026-10-01").groups)).toEqual([["Porto", ["Pazar", "Gün batımı"]], ["Lizbon", ["Lizbon tramvay"]]]);
  });

  it("a day gone by without Yaptım: back in its city's pool, saying which day (the record keeps its day)", () => {
    const pazar = todo("Pazar", "Porto", "2026-10-09");
    const { section, groups } = listOf([...base, pazar, todo("Gün batımı", "Porto", null)], "2026-10-10");
    const row = groups.flatMap((g) => g.rows).find((r) => r.item?.name === "Pazar")!;
    expect(row).toMatchObject({ day: null, returned: "2026-10-09" });
    expect(row.item!.dates.start).toBe("2026-10-09");
    expect(section.ideas).toEqual({ total: 2, onDay: 0, done: 0 });
    // Done: it goes to "Yapılanlar" at the end instead, and never back to the pool.
    const done = listOf([...base, { ...pazar, doneAt: 5 }, todo("Gün batımı", "Porto", null)], "2026-10-10");
    expect(shape(done.groups)).toEqual([["Porto", ["Gün batımı"]], ["done", ["Pazar"]]]);
    expect(done.section.ideas).toEqual({ total: 2, onDay: 0, done: 1 });
  });

  it("during the trip: Bugün first, then where you sleep tonight, then the others", () => {
    const items = [...base, todo("Gün batımı", "Porto", null), todo("Tramvay 28", "Lizbon", null), todo("Alfama", "Lizbon", "2026-10-12"), todo("Belém", "Lizbon", "2026-10-13")];
    const { groups } = listOf(items, "2026-10-12");
    expect(shape(groups)).toEqual([["today", ["Alfama"]], ["Lizbon", ["Belém", "Tramvay 28"]], ["Porto", ["Gün batımı"]]]);
    expect(groups[1].here).toBe(true);
  });

  it("fikir havuzu: during the trip a missed one waits apart (Kaçtı); the tabs count each standing; a filter keeps its groups", () => {
    const items = [...base, todo("Gün batımı", "Porto", null), todo("Pazar", "Porto", "2026-10-09"), todo("Alfama", "Lizbon", "2026-10-12"), todo("Belém", "Lizbon", "2026-10-13"), todo("Sé", "Lizbon", null, { doneAt: 5 })];
    const { sections, plan } = sectionsOf(items, trip, "2026-10-12");
    const entries = sections.find((s) => s.id === "todo")!.entries;
    const groups = ideaGroups(entries, plan, "2026-10-12");
    expect(shape(groups)).toEqual([["today", ["Alfama"]], ["missed", ["Pazar"]], ["Lizbon", ["Belém"]], ["Porto", ["Gün batımı"]], ["done", ["Sé"]]]);
    const rows = ideaRows(entries, "2026-10-12");
    expect(ideaTabs(rows, plan, "2026-10-12").map((t) => `${t.tab} ${t.count}`)).toEqual(["all 5", "pool 1", "day 2", "missed 1", "done 1"]);
    expect(shape(ideaGroups(entries, plan, "2026-10-12", { tab: "day" }))).toEqual([["today", ["Alfama"]], ["Lizbon", ["Belém"]]]);
    // Before the trip nothing is missed: no Kaçtı tab.
    expect(ideaTabs(ideaRows(entries, "2026-10-01"), plan, "2026-10-01").map((t) => t.tab)).toEqual(["all", "pool", "day", "done"]);
  });

  it("a Reel, a pin, a video or a blog of a thing to do is İlham, until it's put on a day; a restaurant stays a restaurant", () => {
    const reel = todo("Ribeira gün batımı", "Porto", null, { url: "https://www.instagram.com/reel/abc/", category: "activity" });
    expect(sectionOfItem(reel)).toBe("inspo");
    expect(sectionOfItem({ ...reel, url: "https://pin.it/x1" })).toBe("inspo");
    expect(sectionOfItem({ ...reel, url: "https://youtu.be/x1" })).toBe("inspo");
    expect(sectionOfItem({ ...reel, url: "https://seyahat.example.com/blog/porto-rehberi" })).toBe("inspo");
    expect(sectionOfItem({ ...reel, url: "https://maps.app.goo.gl/x1" })).toBe("todo");
    expect(sectionOfItem({ ...reel, dates: { start: "2026-10-09", end: null, source: "user" } })).toBe("todo");
    expect(sectionOfItem(said({ kind: "food", date: null, city: "Porto", title: "Cafe Santiago" }, { url: "https://www.instagram.com/reel/def/" }))).toBe("food");
    // Closed at first, counted as saved, never in the hero's "x/y".
    const { sections } = sectionsOf([...base, reel]);
    const inspo = sections.find((s) => s.id === "inspo")!;
    expect(inspo.entries.map((e) => e.row.name)).toEqual(["Ribeira gün batımı"]);
    expect(inspo.open).toBe(false);
    expect(inspo.status).toBeNull();
    expect(planProgress(sections).total).toBe(planProgress(sections.filter((s) => s.id !== "inspo")).total);
  });
});
