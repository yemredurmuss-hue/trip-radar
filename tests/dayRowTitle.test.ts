// The day's lines in one standard (gün akışı satır standardı v2): NE · HANGİSİ and a grey line, every kind,
// in Turkish and English.
import { afterEach, describe, expect, it } from "vitest";
import { cityOfAirport } from "../src/lib/airports";
import { fromTime, placeName, rowTitle, simpleName, titleText, toTime, withLayovers, withoutWord } from "../src/lib/dayRowTitle";
import { setLang } from "../src/lib/i18n";
import type { DayRow } from "../src/lib/journey";
import type { Leg, Travel } from "../src/lib/legs";
import type { RentalEntry, TimelineEntry } from "../src/lib/timeline";
import type { Item, LegMode } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

afterEach(() => setLang("tr"));

const both = (fn: () => unknown) => {
  setLang("tr");
  const tr = fn();
  setLang("en");
  const en = fn();
  setLang("tr");
  return { tr, en };
};

const row = (over: Partial<DayRow>): DayRow => ({
  key: "r", kind: "info", time: null, estimated: false, hint: null, otherDay: null, title: "", sub: null, line: null, state: "info", status: "",
  notes: [], entry: null, leg: null, item: null, items: [], rental: null, stayKey: null, ...over,
});

const flight = (from: string, to: string, dep: string, arr: string, over: Partial<Item> = {}) =>
  makeItem({ category: "flight", name: "TAP · direkt", status: "booked", flight: { from, to, departure: dep, arrival: arr, carrier: null, flightNumber: null, stops: 0 }, ...over });

const travel = (item: Item | null, role: "arrival" | "departure" | "move" | "other" = "arrival", leg: Leg | null = null, mode: LegMode | null = item?.category === "flight" ? "flight" : null): TimelineEntry => ({
  kind: "travel", key: `travel:${role}:${item?.id ?? "none"}`, role, date: "2026-10-07", title: "", subtitle: item?.flight ? `${item.flight.from} → ${item.flight.to}` : "→ Porto",
  travel: item ? ({ settled: item, items: [item], mode } as unknown as Travel) : null, leg, searchUrl: null,
});

const travelRow = (item: Item | null, role: "arrival" | "departure" | "move" | "other" = "arrival", leg: Leg | null = null, mode?: LegMode | null) =>
  row({ key: `travel:${item?.id ?? "x"}`, kind: "travel", state: item ? "done" : "open", status: item ? "Bilet alındı" : "Uçuş yok", entry: travel(item, role, leg, mode) });

const point = (label: string, city: string | null = "Porto", item: Item | null = null) => ({ label, city, item });
const leg = (over: Partial<Leg>): Leg =>
  ({ key: "l", kind: "arrival", date: "2026-10-07", slot: 0, from: point("OPO havalimanı"), to: point("Bonfim Konaklaması"), after: null, before: null, options: [], mode: null, via: "flight", travel: null, status: "empty", statusText: "Boş", choice: null, notes: [], ...over }) as Leg;

describe("flights", () => {
  it("says the cities, never the codes; the airports, the arrival and the flight number in grey", () => {
    const f = flight("SAW", "CPH", "2026-10-07T09:40", "2026-10-07T12:35", { flight: { from: "SAW", to: "CPH", departure: "2026-10-07T09:40", arrival: "2026-10-07T12:35", carrier: "Turkish Airlines", flightNumber: "TK1783", stops: 0 } });
    const t = both(() => rowTitle(travelRow(f)));
    expect(t.tr).toEqual({ what: "Uçuş", which: "İstanbul → Kopenhag", detail: "Sabiha Gökçen → Kastrup · varış 12:35 · TK1783" });
    expect(t.en).toEqual({ what: "Flight", which: "Istanbul → Copenhagen", detail: "Sabiha Gökçen → Kastrup · arrives 12:35 · TK1783" });
    expect(titleText(rowTitle(travelRow(f)))).toBe("Uçuş · İstanbul → Kopenhag");
  });
  it("marks a landing the next day", () => {
    const f = flight("LIS", "IST", "2026-10-14T19:40", "2026-10-15T01:35");
    expect(rowTitle(travelRow(f, "departure")).detail).toBe("Humberto Delgado → İstanbul Havalimanı · varış 01:35 (+1)");
  });
  it("an unknown code: the record's city, else the code", () => {
    const f = flight("XQZ", "QQY", "2026-10-07T09:40", "2026-10-07T12:35", { city: "Gaula" });
    expect(rowTitle(travelRow(f)).which).toBe("XQZ → Gaula");
    expect(placeName("XQZ", "Gaula")).toBe("Gaula");
    expect(placeName("XQZ")).toBe("XQZ");
    expect(placeName("Porto Campanhã")).toBe("Porto Campanhã");
  });
  it("no flight saved yet: the way in, what's left", () => {
    expect(rowTitle(travelRow(null))).toEqual({ what: "Uçuş", which: "→ Porto", detail: "uçuş yok" });
  });
  it("the airports the app sees read as cities", () => {
    expect(["SAW", "IST", "CPH", "OPO", "LIS", "FNC"].map(cityOfAirport)).toEqual(["İstanbul", "İstanbul", "Kopenhag", "Porto", "Lizbon", "Funchal"]);
  });
});

describe("a layover", () => {
  const first = flight("SAW", "CPH", "2026-10-07T09:40", "2026-10-07T12:35");
  const second = flight("CPH", "OPO", "2026-10-07T16:30", "2026-10-07T19:10");
  it("is a quiet line between two connecting flights, its length worked out", () => {
    const rows = withLayovers([travelRow(first, "other"), travelRow(second)]);
    expect(rows.map((r) => r.kind)).toEqual(["travel", "info", "travel"]);
    expect(rows[1].time).toBe("12:35");
    const t = both(() => rowTitle(rows[1]));
    expect(t.tr).toEqual({ what: "Aktarma", which: "Kopenhag · 3 sa 55 dk", detail: "" });
    expect(t.en).toEqual({ what: "Layover", which: "Copenhagen · 3 h 55 min", detail: "" });
  });
  it("only where the first lands is where the second leaves, and only flights next to each other", () => {
    const elsewhere = flight("AMS", "OPO", "2026-10-07T16:30", "2026-10-07T19:10");
    expect(withLayovers([travelRow(first), travelRow(elsewhere)])).toHaveLength(2);
    expect(withLayovers([travelRow(first), row({ key: "x" }), travelRow(second)])).toHaveLength(3);
    // Leaving before landing (a wrong record) isn't a layover.
    expect(withLayovers([travelRow(second), travelRow(first)])).toHaveLength(2);
  });
});

describe("trains, buses, ferries and moves", () => {
  it("a train between cities: the cities, its stations in grey (else who runs it)", () => {
    const train = makeItem({ category: "transport", name: "CP Alfa Pendular · Porto → Lizbon", status: "booked", flight: { from: "Porto Campanhã", to: "Lisboa Oriente", departure: "2026-10-11T13:09", arrival: "2026-10-11T15:59", carrier: null, flightNumber: null, stops: 0 } });
    const move = leg({ kind: "move", from: point("Porto", "Porto"), to: point("Lizbon", "Lizbon"), via: null, mode: "train" });
    const t = both(() => rowTitle(travelRow(train, "move", move, "train")));
    expect(t.tr).toEqual({ what: "Tren", which: "Porto → Lizbon", detail: "Porto Campanhã → Lisboa Oriente · varış 15:59" });
    expect((t.en as { what: string }).what).toBe("Train");
    const noStations = makeItem({ category: "transport", name: "CP Alfa Pendular · Porto → Lizbon", status: "booked", flight: null });
    expect(rowTitle(travelRow(noStations, "move", move, "train")).detail).toBe("CP Alfa Pendular");
  });
  it("a bus and a ferry", () => {
    const bus = makeItem({ category: "transport", name: "FlixBus", status: "booked", plannedKind: "bus" });
    const ferry = makeItem({ category: "transport", name: "Vapur Kadıköy", status: "booked", plannedKind: "ferry" });
    expect(both(() => rowTitle(row({ kind: "item", item: bus, state: "done" })).what)).toEqual({ tr: "Otobüs", en: "Bus" });
    expect(both(() => rowTitle(row({ kind: "item", item: ferry, state: "done" })).what)).toEqual({ tr: "Vapur", en: "Ferry" });
  });
  it("a change of city by car: a transfer, the cities as which, the way in grey", () => {
    const move = leg({ kind: "move", from: point("Porto", "Porto"), to: point("Lizbon", "Lizbon"), via: null, mode: "car", choice: { mode: "car", booked: false, note: null, updatedAt: 1 } });
    const r = row({ kind: "travel", state: "info", entry: { ...travel(null, "move", move), travel: null } as TimelineEntry });
    expect(rowTitle(r)).toEqual({ what: "Transfer", which: "Porto → Lizbon", detail: "Araba" });
  });
});

describe("transfers", () => {
  it("to or from the airport: Havalimanı transferi, the way as which, the ends and what's left in grey", () => {
    const open = row({ kind: "leg", state: "open", leg: leg({}) });
    expect(both(() => rowTitle(open))).toEqual({
      tr: { what: "Havalimanı transferi", which: "", detail: "Havalimanı → Bonfim Konaklaması · planlanmadı" },
      en: { what: "Airport transfer", which: "", detail: "Airport → Bonfim Konaklaması · not planned" },
    });
    const taxi = leg({ kind: "departure", from: point("Lisboa Loft – Yeni Tasarlanmış"), to: point("LIS havalimanı"), mode: "taxi", status: "planned", choice: { mode: "taxi", booked: false, note: null, updatedAt: 1 } });
    expect(rowTitle(row({ kind: "leg", state: "pending", leg: taxi }))).toEqual({ what: "Havalimanı transferi", which: "Taksi", detail: "Lisboa Loft → havalimanı · rezerve edilmedi" });
    const metro = leg({ mode: "metro", status: "planned", choice: { mode: "metro", booked: false, note: null, updatedAt: 1 } });
    expect(both(() => rowTitle(row({ kind: "leg", leg: metro })))).toEqual({
      tr: { what: "Havalimanı transferi", which: "Metro", detail: "Havalimanı → Bonfim Konaklaması · planlandı" },
      en: { what: "Airport transfer", which: "Metro", detail: "Airport → Bonfim Konaklaması · planned" },
    });
    const booked = leg({ mode: "transfer", status: "booked", options: [makeItem({ status: "booked", plannedKind: "transfer", metrics: { ...makeItem().metrics!, durationMinutes: 25 } })] });
    expect(rowTitle(row({ kind: "leg", state: "done", leg: booked }))).toEqual({ what: "Havalimanı transferi", which: "Özel transfer", detail: "Havalimanı → Bonfim Konaklaması · 25 dk" });
  });
  it("to a station or between stays: Transfer", () => {
    const station = leg({ kind: "departure", from: point("Jardim Stay"), to: point("Porto Campanhã"), via: "train", mode: "walk", status: "planned", choice: { mode: "walk", booked: false, note: null, updatedAt: 1 } });
    expect(both(() => rowTitle(row({ kind: "leg", leg: station })))).toEqual({
      tr: { what: "Transfer", which: "Yürüyerek", detail: "Jardim Stay → Porto Campanhã · planlandı" },
      en: { what: "Transfer", which: "On foot", detail: "Jardim Stay → Porto Campanhã · planned" },
    });
  });
});

describe("check-in and check-out", () => {
  const stay = { name: "Casa Verde – Yeni Tasarlanmış, Havuzlu", placed: true, nights: 3, rule: "15:00" };
  it("the stay's short name, its own hour and nights", () => {
    expect(both(() => rowTitle(row({ key: "j:checkin", title: "Check-in", stay })))).toEqual({
      tr: { what: "Check-in", which: "Casa Verde", detail: "15:00'ten itibaren · 3 gece" },
      en: { what: "Check-in", which: "Casa Verde", detail: "from 15:00 · 3 nights" },
    });
    expect(both(() => rowTitle(row({ key: "j:checkout", title: "Check-out", stay: { ...stay, rule: "11:00" } })))).toEqual({
      tr: { what: "Check-out", which: "Casa Verde", detail: "11:00'e kadar" },
      en: { what: "Check-out", which: "Casa Verde", detail: "until 11:00" },
    });
  });
  it("no place chosen yet: the city's stay, said so", () => {
    expect(rowTitle(row({ key: "j:checkout", stay: { name: "Porto konaklaması", placed: false, nights: 3, rule: null } }))).toEqual({ what: "Check-out", which: "Porto konaklaması", detail: "yer seçilmedi" });
  });
});

describe("a rented car", () => {
  const car = makeItem({ category: "transport", name: "Sixt | Fiat 500 veya benzeri", status: "booked", city: "Funchal", location: { address: null, area: "Funchal havalimanı", approximate: false } });
  const rental = { kind: "rental", key: "rental:x", date: "2026-10-11", end: "2026-10-16", group: { items: [car] } } as unknown as RentalEntry;
  it("picked up: the company, the place and the days", () => {
    expect(both(() => rowTitle(row({ key: "rental:x", kind: "rental", state: "done", rental })))).toEqual({
      tr: { what: "Araç teslim alma", which: "Sixt", detail: "Funchal havalimanı · 5 gün" },
      en: { what: "Car pick-up", which: "Sixt", detail: "Funchal havalimanı · 5 days" },
    });
  });
  it("returned", () => {
    expect(both(() => rowTitle(row({ key: "rental:x:return", rental })).what)).toEqual({ tr: "Araç iadesi", en: "Car return" });
  });
});

describe("experiences", () => {
  const activity = (name: string, over: Partial<Item> = {}) => row({ kind: "item", state: "done", item: makeItem({ category: "activity", name, status: "booked", booking: "needed", ...over }) });
  it("their kind from their words, their own name without repeating it", () => {
    expect(rowTitle(activity("Douro nehri tekne turu")).what + " · " + rowTitle(activity("Douro nehri tekne turu")).which).toBe("Tekne turu · Douro nehri");
    expect(titleText(rowTitle(activity("Serralves Müzesi")))).toBe("Müze · Serralves");
    expect(titleText(rowTitle(activity("Fado show")))).toBe("Gösteri · Fado");
    expect(titleText(rowTitle(activity("Graham's şarap mahzeni")))).toBe("Tur · Graham's şarap mahzeni");
    expect(both(() => titleText(rowTitle(activity("Douro River Boat Tour"))))).toEqual({ tr: "Tekne turu · Douro River", en: "Boat tour · Douro River" });
  });
  it("an unknown kind is an Etkinlik", () => {
    expect(both(() => titleText(rowTitle(activity("Pastel de nata atölyesi"))))).toEqual({ tr: "Etkinlik · Pastel de nata atölyesi", en: "Event · Pastel de nata atölyesi" });
  });
  it("keeps the whole name when the word is all there is", () => {
    expect(titleText(rowTitle(activity("Tekne turu")))).toBe("Tekne turu · Tekne turu");
    expect(withoutWord("Douro tekne turu", ["tekne turu"])).toBe("Douro");
    expect(withoutWord("X tekne turu", ["tekne turu"])).toBe("X tekne turu");
    expect(withoutWord("Boat tour: Douro", ["boat tour"])).toBe("Douro");
    expect(withoutWord("Boat tour on the Douro", ["boat tour"])).toBe("Boat tour on the Douro");
  });
  it("its place, length, people and a ticket still to buy in grey", () => {
    const tour = activity("Douro nehri tekne turu", {
      status: "chosen", location: { address: null, area: "Ribeira iskelesi", approximate: false }, metrics: { ...makeItem().metrics!, durationMinutes: 50 }, guests: { adults: 2, children: null, rooms: null },
    });
    expect(rowTitle({ ...tour, state: "pending", status: "Rezerve edilmedi" }).detail).toBe("Ribeira iskelesi · 50 dk · 2 kişi · bilet alınmadı");
  });
});

describe("meals", () => {
  const food = (over: Partial<Item> = {}, time: string | null = null) => row({ kind: "idea", time, item: makeItem({ category: "food", name: "Majestic Café", booking: "none", ...over }) });
  it("by its meal, else its hour, else Yemek", () => {
    expect(both(() => titleText(rowTitle(food({ meal: "lunch" }))))).toEqual({ tr: "Öğle yemeği · Majestic Café", en: "Lunch · Majestic Café" });
    expect(rowTitle(food({}, "08:30")).what).toBe("Kahvaltı");
    expect(rowTitle(food({}, "16:00")).what).toBe("Kahve");
    expect(rowTitle(food({}, "20:00")).what).toBe("Akşam yemeği");
    expect(both(() => rowTitle(food({ name: "Cervejaria Ramos" })).what)).toEqual({ tr: "Yemek", en: "Meal" });
  });
  it("its area and rating in grey", () => {
    expect(rowTitle(food({ meal: "lunch", location: { address: null, area: "Bolhão", approximate: false }, rating: { value: 4.4, scale: 5, count: 10, source: "page" } })).detail).toBe("Bolhão · ★ 4,4");
  });
});

describe("ideas", () => {
  const idea = (name: string) => row({ kind: "idea", item: makeItem({ category: "activity", name, booking: "none", location: { address: null, area: "Ribeira", approximate: false } }) });
  it("their kind from the idea pool, their name", () => {
    expect(both(() => rowTitle(idea("Dom Luís köprüsünde gün batımı")))).toEqual({
      tr: { what: "Manzara", which: "Dom Luís köprüsünde gün batımı", detail: "Ribeira · fikir" },
      en: { what: "View", which: "Dom Luís köprüsünde gün batımı", detail: "Ribeira · idea" },
    });
    expect(rowTitle(idea("Bolhão pazarı")).what).toBe("Alışveriş");
    expect(rowTitle(idea("Serralves bahçeleri")).what).toBe("Doğa");
    expect(rowTitle(idea("Bir şey")).what).toBe("Etkinlik");
  });
});

describe("anything else", () => {
  it("is an Etkinlik with its own words", () => {
    expect(both(() => rowTitle(row({ title: "Bir şey" })))).toEqual({ tr: { what: "Etkinlik", which: "Bir şey", detail: "" }, en: { what: "Event", which: "Bir şey", detail: "" } });
  });
});

describe("helpers", () => {
  it("simplifies a name at its first separator, never under 3 characters", () => {
    expect(simpleName("Casa Verde – Yeni Tasarlanmış, Havuzlu Villa")).toBe("Casa Verde");
    expect(simpleName("Bonfim Konaklaması | Porto")).toBe("Bonfim Konaklaması");
    expect(simpleName("Ribeira Rooms - with pool")).toBe("Ribeira Rooms");
    expect(simpleName("CP Alfa Pendular · Porto → Lizbon")).toBe("CP Alfa Pendular");
    expect(simpleName("Hotel Porto, Ribeira")).toBe("Hotel Porto");
    expect(simpleName("AB - Studio, Porto")).toBe("AB - Studio");
    expect(simpleName("Jardim Stay")).toBe("Jardim Stay");
  });
  it("says Turkish times with their suffix", () => {
    expect(["15:00", "14:00", "16:00", "10:00", "12:00", "14:30", "13:00", "20:00", "00:00"].map(fromTime)).toEqual([
      "15:00'ten", "14:00'ten", "16:00'dan", "10:00'dan", "12:00'den", "14:30'dan", "13:00'ten", "20:00'den", "00:00'dan",
    ]);
    expect(["11:00", "12:00", "10:00", "16:00", "14:00", "11:30", "09:00"].map(toTime)).toEqual(["11:00'e", "12:00'ye", "10:00'a", "16:00'ya", "14:00'e", "11:30'a", "09:00'a"]);
  });
});
