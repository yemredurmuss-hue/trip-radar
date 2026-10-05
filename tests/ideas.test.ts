// tests/ideas.test.ts
// Fikirler: by city, the quick line, a day (and a meal), done, moved to the bookings.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listMessages } from "../src/lib/db";
import {
  addIdea, asBooking, cityInText, dayChip, dayChoices, doneText, foodLine, groupIdeas, ideaIcon, moveToBookings, onDay, quickIdea, quickKind,
  setDone, setIdeaDay, todoLine,
} from "../src/lib/ideas";
import { placeMapUrl } from "../src/lib/items";
import type { Plan } from "../src/lib/plan";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const block = (city: string | null, start: string, end: string) => ({ kind: "open", city, range: { start, end }, nights: 1, groups: [] }) as unknown as Plan["stayBlocks"][number];
const plan = { range: { start: "2026-10-07", end: "2026-10-18" }, stayBlocks: [block("Porto", "2026-10-07", "2026-10-10"), block("Lizbon", "2026-10-10", "2026-10-12"), block("Madeira", "2026-10-12", "2026-10-18")] };
const idea = (name: string, over: Partial<Item> = {}) => makeItem({ category: "other", plannedKind: "todo", booking: "none", name, ...over });

describe("grouped by city", () => {
  it("in the order the trip goes, restaurants apart, no city last; bookings and ruled-out ones aren't ideas", () => {
    const items = [
      idea("Mercado dos Lavradores", { city: "Madeira", createdAt: 1 }),
      makeItem({ category: "food", name: "Café Santiago", city: "Porto", createdAt: 2 }),
      idea("Dom Luís'ten gün batımı", { city: "porto", createdAt: 3 }),
      idea("Bir şey", { city: null, createdAt: 4 }),
      idea("Sintra", { city: "Sintra", createdAt: 5 }),
      makeItem({ category: "activity", name: "Douro tekne turu", city: "Porto", price: { amount: 25, currency: "EUR", scope: "total", taxesIncluded: "unknown", source: "page", observedAt: 1 } }),
      makeItem({ category: "food", name: "Elendi", city: "Porto", status: "dismissed" }),
    ];
    const groups = groupIdeas(items, plan);
    expect(groups.map((g) => [g.city, g.range, g.food.map((i) => i.name), g.todos.map((i) => i.name)])).toEqual([
      ["Porto", { start: "2026-10-07", end: "2026-10-10" }, ["Café Santiago"], ["Dom Luís'ten gün batımı"]],
      ["Madeira", { start: "2026-10-12", end: "2026-10-18" }, [], ["Mercado dos Lavradores"]],
      ["Sintra", null, [], ["Sintra"]],
      [null, null, [], ["Bir şey"]],
    ]);
  });
  it("filters: Yeme-içme only restaurants, Yapılacaklar only the rest; a done one goes last", () => {
    const items = [idea("A", { city: "Porto", doneAt: 5, createdAt: 1 }), idea("B", { city: "Porto", createdAt: 2 }), makeItem({ category: "food", name: "C", city: "Porto" })];
    expect(groupIdeas(items, plan, "food").map((g) => [g.food.length, g.todos.length])).toEqual([[1, 0]]);
    expect(groupIdeas(items, plan, "todo")[0].todos.map((i) => i.name)).toEqual(["B", "A"]);
  });
});

describe("the quick line", () => {
  it("a restaurant when it speaks of food, else a to-do", () => {
    expect(["Café Santiago'da francesinha", "Kahvaltı Manteigaria", "Meyhane akşamı", "Sokak lezzeti restoranı"].map(quickKind)).toEqual(["food", "food", "food", "food"]);
    expect(["Dom Luís köprüsünden gün batımı", "Pazara git", "Barselona'ya bak"].map(quickKind)).toEqual(["todo", "todo", "todo"]);
  });
  it("its city is the one it names, not the open filter's", () => {
    expect(cityInText("Lizbon'da fado dinle", ["Porto", "Lizbon"])).toBe("Lizbon");
    expect(cityInText("Porto'nun en iyi kahvaltısı", ["Porto", "Lizbon"])).toBe("Porto");
    expect(cityInText("Gün batımı", ["Porto", "Lizbon"])).toBeNull();
  });
  it("makes a saved idea, no booking, no day", () => {
    const made = quickIdea("  Lizbon'da   pastel de nata ", ["Porto", "Lizbon"], "t1", "q1", 7)!;
    expect(made).toMatchObject({ id: "q1", category: "food", plannedKind: "food", name: "Lizbon'da pastel de nata", city: "Lizbon", status: "saved", booking: "none", dates: { start: null } });
    expect(quickIdea("Pazara git", [], "t1", "q2", 7)).toMatchObject({ category: "other", plannedKind: "todo", city: null });
    expect(quickIdea("   ", [], "t1", "q3", 7)).toBeNull();
  });
});

describe("icons from the words", () => {
  it.each([
    ["Dom Luís köprüsünden gün batımı fotoğrafı", "camera"],
    ["Pico do Arieiro'dan gün doğumu", "sun"],
    ["Ribeira → Foz nehir kenarı yürüyüşü", "route"],
    ["Levada 25 Fontes", "route"],
    ["Mercado dos Lavradores", "bag"],
    ["Livraria Lello", "book"],
    ["Fado gecesi", "star"],
  ])("%s → %s", (name, icon) => expect(ideaIcon({ name, summary: "" })).toBe(icon));
});

describe("a day, a meal, done", () => {
  it("lists the trip's days with the city slept in", () => {
    const days = dayChoices(plan);
    expect(days.length).toBe(12);
    expect(days[0]).toMatchObject({ date: "2026-10-07", city: "Porto", label: "7 Eki Çar" });
    expect(days[3]).toMatchObject({ date: "2026-10-10", city: "Lizbon" });
    expect(days.at(-1)).toMatchObject({ date: "2026-10-18", city: "Madeira" });
    expect(dayChoices({ range: null, stayBlocks: [] })).toEqual([]);
  });
  it("on a day (a restaurant on a meal), and off it again", () => {
    const cafe = makeItem({ category: "food", name: "Café Santiago" });
    const set = onDay(cafe, "2026-10-08", "dinner");
    expect(set).toMatchObject({ dates: { start: "2026-10-08", end: null, source: "user" }, meal: "dinner" });
    expect(dayChip(set)).toBe("8 Eki akşam");
    const off = onDay(set, null, null);
    expect([off.dates.start, off.meal, dayChip(off)]).toEqual([null, undefined, null]);
    const walk = idea("Yürüyüş", { flight: { from: null, to: null, departure: "2026-10-09T07:00", arrival: null, carrier: null, flightNumber: null, stops: null } });
    expect(onDay(walk, "2026-10-13", null).flight?.departure).toBe("2026-10-13T07:00");
    expect(dayChip(onDay(walk, "2026-10-13", null))).toBe("13 Eki");
  });
  it("the grey lines: what a restaurant is and its rating; done; a ticket it needs after all", () => {
    expect(foodLine(makeItem({ category: "food", summary: "Francesinha", rating: { value: 4.5, scale: 5, count: null, source: "page" } }))).toBe("Francesinha · ★ 4,5");
    expect(foodLine(makeItem({ category: "food", summary: "" }))).toBeNull();
    expect(doneText(idea("x", { doneAt: Date.parse("2026-10-12T10:00:00Z") }))).toBe("Yapıldı · 12 Eki");
    expect(todoLine(makeItem({ category: "activity", name: "Livraria Lello", summary: "Giriş bileti gerekiyor", booking: "none" }))).toEqual({ text: "Giriş bileti gerekiyor", promote: true });
    expect(todoLine(idea("Yürüyüş", { summary: "~6 km · düz" }))).toEqual({ text: "~6 km · düz", promote: false });
  });
  it("the map: coordinates when known, else name and city", () => {
    expect(placeMapUrl({ name: "Café Santiago", city: "Porto", geo: { lat: 41.1, lng: -8.6, source: "page" } })).toBe("https://www.google.com/maps/search/?api=1&query=41.1%2C-8.6");
    expect(placeMapUrl({ name: "Café Santiago", city: "Porto", geo: null })).toBe("https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20Santiago%2C%20Porto");
  });
});

describe("moved to the bookings", () => {
  it("a to-do becomes an activity that needs booking; a restaurant stays a restaurant", () => {
    const todo = idea("Livraria Lello", { city: "Porto" });
    expect(asBooking(todo)).toMatchObject({ plannedKind: "activity", category: "activity", booking: "needed", name: "Livraria Lello", city: "Porto" });
    const food = makeItem({ category: "food", plannedKind: "food", booking: "none", name: "Cantinho" });
    expect(asBooking(food)).toMatchObject({ plannedKind: "food", category: "food", booking: "needed" });
  });
});

describe("writes", () => {
  it("adds from the quick box, puts on a day, ticks off, moves to the bookings; each with a line in the history", async () => {
    const made = (await addIdea("t20", "Bolhão pazarı", ["Porto"], "w1", 1))!;
    expect(made.name).toBe("Bolhão pazarı");
    await setIdeaDay(made, "2026-10-09", null);
    expect((await (await db()).get("items", "w1"))!.dates.start).toBe("2026-10-09");
    await setDone(made, true, Date.parse("2026-10-09T18:00:00Z"));
    expect((await (await db()).get("items", "w1"))!.doneAt).toBe(Date.parse("2026-10-09T18:00:00Z"));
    await setDone(made, false);
    expect((await (await db()).get("items", "w1"))!.doneAt).toBeUndefined();
    await moveToBookings(made);
    expect((await (await db()).get("items", "w1"))!).toMatchObject({ booking: "needed", plannedKind: "activity", category: "activity" });
    expect((await listMessages("t20")).map((m) => m.text)).toEqual([
      "Bolhão pazarı fikirlere eklendi",
      "Bolhão pazarı 9 Eki gününe eklendi",
      "Bolhão pazarı yapıldı",
      "Bolhão pazarı yapılmadı olarak geri alındı",
      "Bolhão pazarı rezerve edileceklere taşındı",
    ]);
  });
});
