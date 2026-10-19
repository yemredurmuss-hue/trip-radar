// Plan v82's rows of cards (lib/collectionCards.ts, v82 geçişi aşama 4, izlenebilirlik 119-123): each 224 px card's family,
// state and lines (a bought ticket's way in, a place done), the row's four cells ("+n Pano'da"), Planında and Öneriler from a
// city's intent (the trip's reason first, the source's tours and then the suggestions after the saved ideas), Yapılacaklar' chips
// and its "n yapıldı".
import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { accessOf, askLike, askMore, collectionRow, doneCount, doneLine, familyOf, filterOf, ideasCaption, mapsSearch, offerCard, recordCard, rowCells, stateOf, stopCountry, suggestionCard } from "../src/lib/collectionCards";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { isPlaceholder } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Suggestion, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-01";
const base: Trip = {
  id: "t1", title: "Japonya", confirmedDates: { start: "2026-11-01", end: "2026-11-07" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: [], count: 2 },
};
const eur = (amount: number | null): Item["price"] => ({ amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 });
const two = { adults: 2, children: null, rooms: 1 };
let n = 0;
const next = (p: string) => `${p}${++n}`;
const stay = (name: string, city: string, start: string, end: string) =>
  makeItem({ id: next("s"), name, category: "stay", city, countryCode: "JP", needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "url" }, guests: two, price: eur(600), status: "booked" });
const act = (name: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({ id: next("a"), name, category: "activity", needKey: `activity:${name}`, city: "Tokyo", countryCode: "JP", status, guests: two, price: eur(90), dates: { start: "2026-11-02", end: null, source: "page" }, ...over });
const place = (name: string, over: Partial<Item> = {}) =>
  makeItem({ id: next("t"), name, category: "activity", plannedKind: "todo", booking: "none", needKey: `activity:${name}`, city: "Tokyo", countryCode: "JP", status: "saved", ...over });
const food = (name: string, over: Partial<Item> = {}) =>
  makeItem({ id: next("f"), name, category: "food", plannedKind: "food", booking: "none", needKey: `food:${name}`, city: "Tokyo", countryCode: "JP", status: "saved", ...over });
const stays = [stay("Hyatt", "Tokyo", "2026-11-01", "2026-11-04"), stay("Ryokan", "Kyoto", "2026-11-04", "2026-11-07")];

/** The board as TripPanel builds it, and a section's rows. */
function rows(trip: Trip, items: Item[], extra: Partial<IntentInput> = {}) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const decisions = decideTrip(items, ctx);
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, hidden, today: TODAY, stageCtx });
  const all = collectionsOf({ trip, plan, sections, items, today: TODAY, decisions, ctx, ...extra });
  const byId = new Map(items.map((i) => [i.id, i]));
  return { all, byId, of: (section: string, city: string) => all.find((c) => c.section.id === section)!.intents.find((i) => i.head.city === city && i.frame === "collection")! };
}

describe("a card's family and state", () => {
  it("a ticket in Etkinlik, a place, a restaurant or a note in Yapılacaklar", () => {
    expect(familyOf("activity", { category: "activity" })).toBe("event");
    expect(familyOf("todo", { category: "activity", plannedKind: "todo" })).toBe("place");
    expect(familyOf("todo", { category: "food", plannedKind: "food" })).toBe("food");
    expect(familyOf("todo", { category: "other", plannedKind: "note" })).toBe("note");
  });
  it("done counts in Yapılacaklar only: a ticket is bought, never done", () => {
    const at = { planned: true, wanted: false };
    expect(stateOf("todo", { status: "chosen", doneAt: 5 }, at)).toBe("done");
    expect(stateOf("activity", { status: "chosen", doneAt: 5 }, at)).toBe("planned");
    expect(stateOf("activity", { status: "booked", doneAt: undefined }, at)).toBe("booked");
    expect(stateOf("activity", { status: "saved", doneAt: undefined }, { planned: false, wanted: false })).toBe("idea");
    expect(stateOf("activity", { status: "chosen", doneAt: undefined }, { planned: false, wanted: true })).toBe("wanted");
  });
  it("Hepsi · Gezilecek · Restoranlar: a restaurant is a restaurant, anything else to see", () => {
    expect(filterOf({ family: "food" })).toBe("food");
    expect(filterOf({ family: "place" })).toBe("go");
    expect(filterOf({ family: "note" })).toBe("go");
  });
});

describe("a card's lines", () => {
  it("a ticket: its site, its day and hour, its price a person; + Plana koy while it's an idea", () => {
    const item = act("teamLab Planets", "saved", { provider: "Klook", url: "https://www.klook.com/activity/1", flight: { from: null, to: null, departure: "2026-11-02T17:20", arrival: null, carrier: null, flightNumber: null, stops: null } });
    const c = recordCard(item, { section: "activity", people: 2, planned: false, wanted: false, reason: false });
    expect(c).toMatchObject({ family: "event", state: "idea", title: "teamLab Planets", art: "illus/etkinlik-tur.png", tag: null, canPut: true, page: item.url, line: "2 Kasım · 17:20 · €45 kişi başı" });
    expect(c.brand?.label).toBe("Klook");
    expect(c.badge).toMatchObject({ tone: "mine", text: "Senin linkin" });
  });
  it("v81 alındı: a bought ticket's day and hour, its meeting place, its code to copy, the map", () => {
    const item = act("Shibuya Sky", "booked", { bookingRef: "KL-90231", location: { address: "Shibuya Scramble Square", area: "Shibuya", approximate: false }, flight: { from: null, to: null, departure: "2026-11-02T17:20", arrival: null, carrier: null, flightNumber: null, stops: null } });
    const c = recordCard(item, { section: "activity", people: 2, planned: true, wanted: false, reason: false });
    expect(c.state).toBe("booked");
    expect(c.access).toMatchObject({ when: "2 Kas 17:20", where: "Shibuya Scramble Square", code: { label: "Bilet", value: "KL-90231" } });
    expect(c.access?.map).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Shibuya/);
    expect(c.canPut).toBe(false);
  });
  it("a code from the booking's note when the record has none; no meeting place is ever guessed", () => {
    const a = accessOf(act("Sumo", "booked", { statusNote: "Bilet · VI-77310" }), "event", 2);
    expect(a.code).toEqual({ label: "Bilet", value: "VI-77310" });
    expect(a.where).toBeNull();
  });
  it("a booked table: its day, meal, hour and how many", () => {
    const item = food("Gion Karyo", { status: "booked", bookingRef: "TC-4471", meal: "dinner", dates: { start: "2026-11-05", end: null, source: "page" }, guests: two, flight: { from: null, to: null, departure: "2026-11-05T19:30", arrival: null, carrier: null, flightNumber: null, stops: null } });
    const c = recordCard(item, { section: "todo", people: 2, planned: true, wanted: false, reason: false });
    expect(c).toMatchObject({ family: "food", tag: "Restoran", art: "illus/restoran.png" });
    expect(c.access).toMatchObject({ when: "5 Kas akşam · 19:30 · 2 kişi", code: { label: "Rezervasyon", value: "TC-4471" } });
  });
  it("a place: its note, its area and rating (the city is the row's), its day as a chip; done says when", () => {
    const item = place("Meiji Tapınağı", { summary: "sabah erken", location: { address: null, area: "Harajuku", approximate: false }, rating: { value: 4.7, scale: 5, count: 20, source: "page" }, dates: { start: "2026-11-03", end: null, source: "user" } });
    const c = recordCard(item, { section: "todo", people: 2, planned: true, wanted: false, reason: false });
    expect(c).toMatchObject({ family: "place", state: "planned", tag: "Gezilecek", day: "3 Kas", line: "sabah erken · Harajuku · ★ 4,7" });
    const done = Date.parse("2026-11-03T12:00:00Z");
    expect(recordCard({ ...item, doneAt: done }, { section: "todo", people: 2, planned: true, wanted: false, reason: false }).line).toBe("Yapıldı · 3 Kas");
    expect(doneLine({ doneAt: done, category: "food" })).toBe("Gidildi · 3 Kas");
  });
  it("a pin saved from Google Maps says Maps, its map is its own page", () => {
    const pin = place("Jardins do Palácio de Cristal", { url: "https://maps.app.goo.gl/x" });
    expect(recordCard(pin, { section: "todo", people: 2, planned: false, wanted: false, reason: false })).toMatchObject({ badge: { text: "Maps" }, map: "https://maps.app.goo.gl/x" });
  });
  it("a suggestion and the source's tour", () => {
    const s: Suggestion = { key: "ai:ramen", section: "food", kind: "add", title: "Ichiran Ramen", why: "Gece de açık.", source: "ai", template: "food", createdAt: 1, state: "open" };
    expect(suggestionCard(s, "todo")).toMatchObject({ key: "s:ai:ramen", family: "food", tag: "Restoran", line: "Gece de açık.", canPut: true, item: null });
    const o = offerCard({ id: "v1", kind: "activity", title: "Tsukiji lezzet turu", url: "https://viator.com/t", price: 136, currency: "EUR", why: "", source: "Viator", fetchedAt: 1, durationMinutes: 240 }, 2);
    expect(o).toMatchObject({ key: "o:v1", line: "4 sa · €68 kişi başı", page: "https://viator.com/t", canPut: true });
    expect(o.brand?.label).toBe("Viator");
    // The source's name, not "AI önerisi": a real tour it lists (Emre, 19 Ekim).
    expect(o.badge).toMatchObject({ text: "Viator" });
    expect(o.badge?.text).not.toContain("AI");
  });
});

describe("a row's four cells", () => {
  it("every card while they fit, else three and +n Pano'da", () => {
    expect(rowCells([1, 2, 3, 4])).toEqual({ shown: [1, 2, 3, 4], more: 0 });
    expect(rowCells([1, 2, 3, 4, 5, 6])).toEqual({ shown: [1, 2, 3], more: 3 });
    expect(rowCells([])).toEqual({ shown: [], more: 0 });
  });
  it("Öneriler' caption: the count, or how many are shown and that the rest are on the Pano", () => {
    expect(ideasCaption(3, 3)).toBe("3");
    expect(ideasCaption(7, 3)).toBe("7 · ilk 3, tümü Pano'da");
  });
});

describe("a city's two rows from its intent", () => {
  it("Planında: what intents.ts put on the plan (booked first); Öneriler: the rest, the source's new tours, the suggestions", () => {
    const items = [...stays, act("Shibuya Sky", "booked"), act("teamLab", "chosen"), act("Sumo", "saved"), act("Tsukiji turu", "saved")];
    const b = rows(base, items, { suggestions: { activity: [{ key: "ai:ghibli", section: "activity", kind: "add", title: "Ghibli Müzesi", why: "", source: "ai", createdAt: 1, state: "open", payload: { city: "Tokyo" } }] } });
    const vm = b.of("activity", "Tokyo");
    const offers = [
      { id: "o1", kind: "activity" as const, title: "Tsukiji Turu", url: "https://viator.com/a", why: "", source: "Viator", fetchedAt: 1 },
      { id: "o2", kind: "activity" as const, title: "Asakusa yürüyüşü", url: "https://viator.com/b", why: "", source: "Viator", fetchedAt: 1 },
    ];
    const row = collectionRow(vm, b.byId, { trip: base, people: 2, offers });
    expect(row.plan.map((c) => [c.title, c.state])).toEqual([["Shibuya Sky", "booked"], ["teamLab", "planned"]]);
    // The saved tour of the same name isn't offered again.
    // The records, then the source's tours, then the AI's ideas (Emre, 19 Ekim).
    expect(row.ideas.map((c) => c.title)).toEqual(["Sumo", "Tsukiji turu", "Asakusa yürüyüşü", "Ghibli Müzesi"]);
    expect(row.counts).toEqual({ all: 6, go: 6, food: 0 });
  });
  it("Gezinin sebebi: on a festival trip its ticket leads Planında", () => {
    const trip: Trip = { ...base, intent: { playbook: "festival", name: "Ozora Festival" } };
    const items = [...stays, act("Gün batımı tekne turu", "chosen"), act("Ozora Festival bileti", "booked")];
    const b = rows(trip, items);
    const row = collectionRow(b.of("activity", "Tokyo"), b.byId, { trip, people: 2 });
    expect(row.plan[0]).toMatchObject({ title: "Ozora Festival bileti", reason: true });
    expect(row.plan.filter((c) => c.reason)).toHaveLength(1);
    expect(collectionRow(b.of("activity", "Tokyo"), b.byId, { trip: base, people: 2 }).plan.some((c) => c.reason)).toBe(false);
  });
  it("Yapılacaklar: places and restaurants side by side, counted for the chips; a place done says it on the closed row", () => {
    const items = [...stays, place("Meiji Tapınağı", { status: "chosen" }), place("Yanaka", { doneAt: 5 }), food("Ichiran Ramen"), food("Tsukiji sushi", { status: "chosen" })];
    const b = rows(base, items);
    const vm = b.of("todo", "Tokyo");
    const row = collectionRow(vm, b.byId, { trip: base, people: 2 });
    expect(row.counts).toEqual({ all: 4, go: 2, food: 2 });
    expect(row.plan.map((c) => [c.title, c.state]).sort()).toEqual([["Meiji Tapınağı", "planned"], ["Tsukiji sushi", "planned"], ["Yanaka", "done"]]);
    expect(row.ideas.map((c) => c.title)).toEqual(["Ichiran Ramen"]);
    const todo = b.all.find((c) => c.section.id === "todo")!;
    expect(doneCount(todo.intents, b.byId)).toBe(1);
    // A ticket is never "yapıldı" (H1): Etkinlik's records don't count.
    expect(doneCount(b.all.find((c) => c.section.id === "activity")?.intents ?? [], b.byId)).toBe(0);
  });
});

describe("the chat's lines and Kendin ara", () => {
  it("more for the city, more like a place", () => {
    expect(askMore("activity", "Tokyo")).toBe("Tokyo için bilet ya da rezervasyon gerektiren birkaç etkinlik ve tur daha öner.");
    expect(askMore("todo", "Kyoto")).toBe("Kyoto için gezilecek birkaç yer ve restoran daha öner.");
    expect(askLike({ title: "Ichiran", family: "food" }, "Tokyo")).toBe("Tokyo için “Ichiran” gibi birkaç restoran daha öner.");
  });
  it("Google Haritalar for the city's places, by the chip", () => {
    expect(mapsSearch("Tokyo", "food")?.url).toBe("https://www.google.com/maps/search/?api=1&query=Tokyo%20restoran");
    expect(mapsSearch(null, "all")).toBeNull();
  });
});

describe("a stop's country (the second question for a town the source doesn't know)", () => {
  it("is the stay record's, by city", () => {
    const items = [makeItem({ id: "lk", name: "Ahangama Konaklama", category: "stay", city: "Ahangama", countryCode: "LK", needKey: "stay:ahangama", dates: { start: "2026-11-02", end: "2026-11-09", source: "user" }, guests: two, status: "chosen" })];
    const trip: Trip = { ...base, confirmedDates: { start: "2026-11-02", end: "2026-11-09" } };
    const plan = buildPlan(trip, items);
    expect(stopCountry(plan, "Ahangama")).toBe("LK");
    expect(stopCountry(plan, "Kolombo")).toBeNull();
  });
});
