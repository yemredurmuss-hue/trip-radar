// tests/ideas.test.ts
// Fikirler: by city, the quick line, a day (and a meal), done, moved to the bookings.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listMessages } from "../src/lib/db";
import {
  addIdea, asBooking, cityInText, ideaSource, ideaThumb, ideaTitle, dayChip, dayChoices, doneText, foodLine, ideaIcon, moveToBookings, onDay, quickIdea, quickKind,
  setDone, setIdeaDay, todoLine,
} from "../src/lib/ideas";
import { placeMapUrl } from "../src/lib/items";
import type { Plan } from "../src/lib/plan";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const block = (city: string | null, start: string, end: string) => ({ kind: "open", city, range: { start, end }, nights: 1, groups: [] }) as unknown as Plan["stayBlocks"][number];
const plan = { range: { start: "2026-10-07", end: "2026-10-18" }, stayBlocks: [block("Porto", "2026-10-07", "2026-10-10"), block("Lizbon", "2026-10-10", "2026-10-12"), block("Madeira", "2026-10-12", "2026-10-18")] };
const idea = (name: string, over: Partial<Item> = {}) => makeItem({ category: "other", plannedKind: "todo", booking: "none", name, ...over });

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
  it("the city it names leaves the title (with 'da/'dan and a comma), the rest starts with a capital", () => {
    const cities = ["Porto", "Lizbon", "Funchal", "İzmir", "Málaga"];
    expect(ideaTitle("Porto'da Dom Luís köprüsünden gün batımı", cities)).toBe("Dom Luís köprüsünden gün batımı");
    expect(ideaTitle("lizbon'dan sintra'ya tren", cities)).toBe("Sintra'ya tren");
    expect(ideaTitle("Funchal’de levada yürüyüşü", cities)).toBe("Levada yürüyüşü");
    expect(ideaTitle("Lizbonda fado", cities)).toBe("Fado");
    expect(ideaTitle("Porto'ta deneme", cities)).toBe("Deneme");
    expect(ideaTitle("Porto, Ribeira yürüyüşü", cities)).toBe("Ribeira yürüyüşü");
    expect(ideaTitle("İzmir'de kumru", cities)).toBe("Kumru");
    expect(ideaTitle("Malaga'da tapas", cities)).toBe("Tapas");
    expect(ideaTitle("Gün batımı Porto'da", cities)).toBe("Gün batımı");
    expect(ideaTitle("Gün batımı, Porto", cities)).toBe("Gün batımı");
    // No city, a city said another way (of, a word with it), or nothing left: as typed.
    expect(ideaTitle("pazara git", cities)).toBe("pazara git");
    expect(ideaTitle("Porto'nun en iyi kahvaltısı", cities)).toBe("Porto'nun en iyi kahvaltısı");
    expect(ideaTitle("Porto şarabı tadımı", cities)).toBe("Porto şarabı tadımı");
    expect(ideaTitle("Portekiz'de bir gün", cities)).toBe("Portekiz'de bir gün");
    expect(ideaTitle("Porto'da", cities)).toBe("Porto'da");
  });
  it("makes a saved idea, no booking, no day", () => {
    const made = quickIdea("  Lizbon'da   pastel de nata ", ["Porto", "Lizbon"], "t1", "q1", 7)!;
    expect(made).toMatchObject({ id: "q1", category: "food", plannedKind: "food", name: "Pastel de nata", city: "Lizbon", status: "saved", booking: "none", dates: { start: null } });
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
    ["Porto Belo Pazarı", "bag"],
    ["Outdoor alışverişi", "bag"],
    ["Decathlon'dan yağmurluk al", "bag"],
    ["Dom Luís'te gün batımı", "sun"],
    ["Miradouro da Vitória", "sun"],
    ["Serralves Müzesi", "book"],
    ["Bolhão'da francesinha", "food"],
    ["Street food at Time Out Market", "bag"],
    ["Sokak lezzetleri turu", "food"],
    ["Sé Katedrali", "star"],
  ])("%s → %s", (name, icon) => expect(ideaIcon({ name, summary: "" })).toBe(icon));
});

describe("a page's photo instead of the icon", () => {
  it("a record from a Maps (or any page) link with its page's image shows it; the rest keep their icon", () => {
    const img = "https://lh5.googleusercontent.com/p/abc=w400";
    expect(ideaThumb(makeItem({ category: "activity", url: "https://maps.app.goo.gl/x", imageUrl: img }))).toBe(img);
    expect(ideaThumb(makeItem({ category: "activity", url: "https://www.timeout.com/porto/x", imageUrl: img }))).toBe(img);
    expect(ideaThumb(makeItem({ category: "activity", url: "https://maps.app.goo.gl/x", imageUrl: null }))).toBeNull();
    expect(ideaThumb(makeItem({ category: "other", plannedKind: "todo", origin: "chat", url: null, imageUrl: null }))).toBeNull();
    expect(ideaThumb(makeItem({ category: "activity", url: null, imageUrl: img }))).toBeNull();
  });
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
  it("a restaurant's review count goes with its rating, only when known", () => {
    expect(foodLine(makeItem({ category: "food", optionDetail: "Francesinha", rating: { value: 4.5, scale: 5, count: 1204, source: "page" } }))).toBe("Francesinha · ★ 4,5 (1.204)");
    expect(foodLine(makeItem({ category: "food", optionDetail: null, summary: "", rating: { value: null, scale: null, count: 80, source: "page" } }))).toBeNull();
  });
  it("where an idea came from: Maps, Instagram or Reels, Pinterest, a blog, the site, a note", () => {
    expect(ideaSource({ url: "https://www.google.com/maps/place/Majestic+Caf%C3%A9" })).toBe("Maps");
    expect(ideaSource({ url: "https://maps.app.goo.gl/abc" })).toBe("Maps");
    expect(ideaSource({ url: "https://www.instagram.com/reel/C1/" })).toBe("Reels");
    expect(ideaSource({ url: "https://www.instagram.com/p/C1/" })).toBe("Instagram");
    expect(ideaSource({ url: "https://tr.pinterest.com/pin/1/" })).toBe("Pinterest");
    expect(ideaSource({ url: "https://gezgin.blogspot.com/2024/porto" })).toBe("blog");
    expect(ideaSource({ url: "https://example.com/blog/porto-gezisi" })).toBe("blog");
    expect(ideaSource({ url: "https://www.timeout.com/porto" })).toBe("timeout.com");
    expect(ideaSource({ url: null, plannedKind: "note" })).toBe("not");
    expect(ideaSource({ url: null, plannedKind: "todo" })).toBeNull();
    expect(ideaSource({ url: "not a url" })).toBeNull();
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
      "Bolhão pazarı etkinliklere taşındı",
    ]);
  });
});
