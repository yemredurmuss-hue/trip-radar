// Plan v82's rows of cards (lib/collectionCards.ts, v82 geçişi aşama 4, izlenebilirlik 119-123): each card's family,
// state and lines (a bought ticket's way in, a place done), the row's four cells (four cards at most, the next coming up), Planında and Öneriler from a
// city's intent (the trip's reason first, the source's tours and then the suggestions after the saved ideas), Yapılacaklar' chips
// and its "n yapıldı".
import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { accessOf, askLike, askMore, collectionRow, doneCount, doneLine, eventPicture, familyOf, placeChips, filterOf, ideasCaption, mapsSearch, nearPlaces, offerCard, pickWord, pictureChips, recordCard, rowCells, stateOf, stopCountry, suggestionCard } from "../src/lib/collectionCards";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { bySection, shownSuggestions } from "../src/lib/suggestions";
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

describe("Emre's Ushuaia (0.38.8, option A): the badges are chips on the picture", () => {
  const tour = { id: "v1", kind: "activity" as const, title: "Tierra del Fuego National Park Tour with Optional Train Ride", url: "https://www.viator.com/t", price: 334, currency: "EUR", why: "", source: "Viator", fetchedAt: 1, place: "Ushuaia" };
  it("a source's tour is one chip with the site's mark, where it was a chip and a line", () => {
    expect(pictureChips(offerCard(tour, 2))).toEqual([{ kind: "source", tone: "mine", text: "Viator · Ushuaia", initial: null, mark: { color: "#186b6d", letter: "V" } }]);
  });
  it("a ticket on the plan says its site; the trip's own ticket says Gezinin sebebi alone", () => {
    const lakes = act("Lakes 4WD Off Road with Lunch", "chosen", { provider: "Viator", url: "https://www.viator.com/tours/lakes" });
    const planned = recordCard(lakes, { section: "activity", people: 2, planned: true, wanted: false, reason: false });
    expect(pictureChips(planned)).toEqual([{ kind: "site", brand: { label: "Viator", color: "#186b6d" } }]);
    expect(pictureChips({ ...planned, state: "booked", reason: true })).toEqual([{ kind: "reason" }]);
  });
  it("an idea who put it there and its site when the chip doesn't name it; a place its word after its source", () => {
    const item = act("teamLab Planets", "saved", { provider: "Klook", url: "https://www.klook.com/activity/1" });
    expect(pictureChips(recordCard(item, { section: "activity", people: 2, planned: false, wanted: false, reason: false })).map((c) => c.kind)).toEqual(["source", "site"]);
    const s: Suggestion = { key: "ai:faro", section: "todo", kind: "add", title: "Faro Les Eclaireurs", why: "", source: "ai", template: "todo", createdAt: 1, state: "open" };
    expect(pictureChips(suggestionCard(s, "todo"))).toEqual([{ kind: "source", tone: "ai", text: "✨ Öneri", initial: null, mark: null }, { kind: "tag", text: "Gezilecek" }]);
    const faro = place("Faro Les Eclaireurs");
    expect(pictureChips(recordCard(faro, { section: "todo", people: 2, planned: true, wanted: false, reason: false }))).toEqual([{ kind: "tag", text: "Gezilecek" }]);
  });
});

describe("a row's four cells", () => {
  it("four cards at most (0.38.9), the rest waiting in line", () => {
    expect(rowCells([1, 2, 3, 4])).toEqual({ shown: [1, 2, 3, 4], more: 0 });
    expect(rowCells([1, 2, 3, 4, 5, 6])).toEqual({ shown: [1, 2, 3, 4], more: 2 });
    expect(rowCells([1, 2])).toEqual({ shown: [1, 2], more: 0 });
    expect(rowCells([])).toEqual({ shown: [], more: 0 });
  });
  it("Öneriler' caption: the count, or how many are shown and that the rest are on the Pano", () => {
    expect(ideasCaption(3, 3)).toBe("3");
    expect(ideasCaption(7, 4)).toBe("7 · ilk 4, tümü Pano'da");
  });
  it("Şarm El-Şeyh's Öneriler: saved ideas and Viator's tours counted together, four shown; one put on the plan, the next comes up", () => {
    const sharm = makeItem({ id: next("s"), name: "Reef Oasis", category: "stay", city: "Şarm El-Şeyh", countryCode: "EG", needKey: "stay:sarm", dates: { start: "2026-11-01", end: "2026-11-07", source: "url" }, guests: two, price: eur(600), status: "booked" });
    const ai = (name: string, status: Item["status"] = "saved") => act(name, status, { city: "Şarm El-Şeyh", countryCode: "EG", addedBy: "ai" });
    const tour = (id: string, title: string) => ({ id, kind: "activity" as const, title, url: `https://viator.com/${id}`, why: "", source: "Viator", fetchedAt: 1 });
    const offers = [tour("o1", "ATV turu"), tour("o2", "Ras Muhammed tekne turu"), tour("o3", "Tiran adası şnorkel"), tour("o4", "Çöl safarisi")];
    const before = [sharm, ai("Naama Bay gece turu"), ai("Renkli Kanyon")];
    const b0 = rows(base, before);
    const r0 = collectionRow(b0.of("activity", "Şarm El-Şeyh"), b0.byId, { trip: base, people: 2, offers });
    expect(r0.ideas).toHaveLength(6);
    const o0 = rowCells(r0.ideas);
    expect(o0.shown.map((c) => c.title)).toEqual(["Naama Bay gece turu", "Renkli Kanyon", "ATV turu", "Ras Muhammed tekne turu"]);
    expect(o0.more).toBe(2);
    // "+ Plana koy" on Renkli Kanyon: it goes to Planında, Tiran adası şnorkel comes up as the fourth.
    const after = [sharm, before[1], { ...before[2], status: "chosen" as const }];
    const b1 = rows(base, after);
    const r1 = collectionRow(b1.of("activity", "Şarm El-Şeyh"), b1.byId, { trip: base, people: 2, offers });
    expect(r1.plan.map((c) => c.title)).toEqual(["Renkli Kanyon"]);
    const o1 = rowCells(r1.ideas);
    expect(o1.shown.map((c) => c.title)).toEqual(["Naama Bay gece turu", "ATV turu", "Ras Muhammed tekne turu", "Tiran adası şnorkel"]);
    expect(o1.more).toBe(1);
  });
});

describe("a city's two rows from its intent", () => {
  it("Planında: what intents.ts put on the plan (booked first); Öneriler: the rest and the source's new tours, no AI card", () => {
    const items = [...stays, act("Shibuya Sky", "booked"), act("teamLab", "chosen"), act("Sumo", "saved"), act("Tsukiji turu", "saved")];
    // An AI card stored for Etkinlik (before 0.38.4: the chat's "Sörf deneyimi") isn't shown: only real tours and saved ones.
    const ghibli: Suggestion = { key: "ai:ghibli", section: "activity", kind: "add", title: "Ghibli Müzesi", why: "", source: "ai", createdAt: 1, state: "open", payload: { city: "Tokyo" } };
    const b = rows(base, items, { suggestions: bySection(shownSuggestions([ghibli], [], items)) });
    const vm = b.of("activity", "Tokyo");
    const offers = [
      { id: "o1", kind: "activity" as const, title: "Tsukiji Turu", url: "https://viator.com/a", why: "", source: "Viator", fetchedAt: 1 },
      { id: "o2", kind: "activity" as const, title: "Asakusa yürüyüşü", url: "https://viator.com/b", why: "", source: "Viator", fetchedAt: 1 },
    ];
    const row = collectionRow(vm, b.byId, { trip: base, people: 2, offers });
    expect(row.plan.map((c) => [c.title, c.state])).toEqual([["Shibuya Sky", "booked"], ["teamLab", "planned"]]);
    // The saved tour of the same name isn't offered again.
    // The records, then the source's tours (Emre, 19 Ekim); no AI idea (0.38.4).
    expect(row.ideas.map((c) => c.title)).toEqual(["Sumo", "Tsukiji turu", "Asakusa yürüyüşü"]);
    expect(row.ideas.some((c) => c.suggestion)).toBe(false);
    expect(row.counts).toEqual({ all: 5, go: 5, food: 0 });
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

describe("Emre's Sri Lanka (0.38.4): the trip's cities near a town, and where each tour was found", () => {
  const trip: Trip = { ...base, title: "Sri Lanka", confirmedDates: { start: "2026-11-02", end: "2026-11-16" } };
  const lkStay = (id: string, city: string, start: string, end: string, countryCode: string) =>
    makeItem({ id, name: `${city} villa`, category: "stay", city, countryCode, needKey: `stay:${city}`, dates: { start, end, source: "user" }, guests: two, status: "chosen" });
  const flight = (id: string, from: string, to: string, status: Item["status"] = "chosen") =>
    makeItem({ id, name: `${from} → ${to}`, category: "flight", needKey: `flight:${from}-${to}`, status, flight: { from, to, departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } });
  const items = [
    lkStay("ah", "Ahangama", "2026-11-02", "2026-11-09", "LK"),
    lkStay("ga", "Galle", "2026-11-09", "2026-11-12", "LK"),
    lkStay("ba", "Ubud", "2026-11-12", "2026-11-16", "ID"),
    flight("in", "BJV", "CMB"),
    flight("out", "CMB", "DPS"),
    flight("old", "IST", "HRI", "dismissed"),
  ];
  const plan = buildPlan(trip, items);

  it("the stays' cities and the airports in the town's country, the town itself and the other countries left out", () => {
    // Galle a stay, Kolombo the airport flown into and out of (searched by its English name); Bali, Bodrum are elsewhere.
    expect(nearPlaces(plan, items, "Ahangama", "LK")).toEqual([{ city: "Galle", label: "Galle" }, { city: "Colombo", label: "Kolombo" }]);
    expect(nearPlaces(plan, items, "Galle", "LK").map((p) => p.label)).toEqual(["Ahangama", "Kolombo"]);
    expect(nearPlaces(plan, items, "Ahangama", null)).toEqual([]);
  });

  it("a tour's card says its source and where it was asked; a saved Viator tour its source, not an AI pick", () => {
    const o = { id: "vi:1", kind: "activity" as const, title: "Galle kalesi yürüyüşü", url: "https://www.viator.com/g", why: "", source: "Viator", fetchedAt: 1 };
    expect(offerCard({ ...o, place: "Galle" }, 2).badge).toEqual({ tone: "mine", text: "Viator · Galle", initial: null });
    expect(offerCard(o, 2).badge?.text).toBe("Viator");
    const saved = act("Galle kalesi yürüyüşü", "saved", { addedBy: "ai", provider: "Viator", url: "https://www.viator.com/g", city: "Ahangama" });
    expect(recordCard(saved, { section: "activity", people: 2, planned: false, wanted: false, reason: false }).badge?.text).toBe("Viator");
  });
});

describe("0.39.9: the source's tour as a deal (Viator's own card as the model)", () => {
  const tour = { id: "v9", kind: "activity", title: "Douro şarap turu", url: "https://viator.com/d", price: 258, currency: "EUR", why: "En beğenilenlerden · hızlı tükeniyor", source: "Viator", fetchedAt: 1, durationMinutes: 600, rating: 4.9, reviews: 21225, meta: "21.225 yorum · Ücretsiz iptal" } as const;
  it("its price a person, rating, reviews, length, free cancellation and the source's pick in a word", () => {
    expect(offerCard(tour as never, 2).deal).toEqual({ price: "€129", rating: 4.9, reviews: 21225, duration: "10 sa", free: true, pick: "En beğenilen" });
  });
  it("a rating out of 10 is said out of 5; no free cancellation unless the source says it", () => {
    const d = offerCard({ ...tour, rating: 9.2, meta: null, why: "" } as never, 1).deal;
    expect(d).toMatchObject({ rating: 4.6, free: false, pick: null, price: "€258" });
  });
  it("a city's event (Google Events) is no deal", () => {
    expect(offerCard({ ...tour, id: "ev:2026-10-23:x" } as never, 2).deal).toBeNull();
  });
  it("the source's whys as words", () => {
    expect([pickWord("Viator'da öne çıkan"), pickWord("İyi puanlılar içinde en uygunu"), pickWord("Bulduklarımın en ucuzu"), pickWord("x")]).toEqual(["Öne çıkan", "Uygun fiyatlı", "En ucuz", null]);
  });
});

describe("0.39.10: every Etkinlik card in the approved card's language", () => {
  const at = { section: "activity" as const, people: 2, planned: false, wanted: false, reason: false };
  it("a saved ticket as a deal: its day over its price a person, its rating out of 5, its length, its own words", () => {
    const t = act("Douro tekne turu", "chosen", {
      summary: "Altı köprü turu",
      rating: { value: 9.2, scale: 10, count: 530, source: "page" },
      metrics: { durationMinutes: 50 } as Item["metrics"],
      flight: { from: null, to: null, departure: "2026-11-02T16:00", arrival: null, carrier: null, flightNumber: null, stops: null },
    });
    expect(recordCard(t, { ...at, planned: true }).deal).toMatchObject({ price: "€45", per: true, rating: 4.6, reviews: 530, duration: "50 dk", free: false, pick: null, when: "2 Kasım · 16:00", note: "Altı köprü turu" });
  });
  it("a summary that is only the source's why is its pick, not its words; no price, no price", () => {
    const d = recordCard(act("Fado gecesi", "saved", { summary: "Viator'da öne çıkan", price: eur(null) }), at).deal;
    expect(d).toMatchObject({ price: null, pick: "Öne çıkan", note: null });
  });
  it("a place to see has no deal", () => {
    expect(recordCard(place("Senso-ji"), { ...at, section: "todo" }).deal).toBeNull();
  });
  it("the word on the picture: on the plan, bought, the trip's reason, the source's pick, an AI idea; the source at its foot", () => {
    const viator = act("Douro", "chosen", { addedBy: "ai", provider: "Viator", url: "https://www.viator.com/d" });
    expect(eventPicture(recordCard(viator, { ...at, planned: true }))).toEqual({ word: { text: "✓ Planında", tone: "ok" }, source: "Viator" });
    expect(eventPicture(recordCard(act("Tiyatro", "booked"), { ...at, planned: true })).word).toEqual({ text: "✓ Alındı", tone: "ok" });
    expect(eventPicture(recordCard(act("Festival", "booked"), { ...at, planned: true, reason: true })).word?.tone).toBe("rsn");
    // a saved source tour: no word over its source's name
    expect(eventPicture(recordCard({ ...viator, status: "saved" }, at)).word).toBeNull();
    const tour = { id: "v1", kind: "activity" as const, title: "Porto yemek turu", url: "https://viator.com/p", why: "Viator'da öne çıkan", source: "Viator", fetchedAt: 1, place: "Porto" };
    expect(eventPicture(offerCard(tour, 2))).toEqual({ word: { text: "Öne çıkan", tone: "acc" }, source: "Viator · Porto" });
    expect(eventPicture(offerCard({ ...tour, why: "En beğenilen" }, 2)).word).toEqual({ text: "En beğenilen", tone: "plain" });
    const s = { key: "k", kind: "add", section: "activity", title: "Fado gecesi", why: "Porto'nun sesi" } as unknown as Suggestion;
    expect(eventPicture(suggestionCard(s, "activity"))).toEqual({ word: { text: "AI fikri", tone: "plain" }, source: null });
  });
});

describe("0.39.14: Yapılacaklar, sade", () => {
  it("no ✨ Öneri nor Gezilecek on a place's picture; a restaurant still says so, who else added it too", () => {
    const s = { key: "k", kind: "add", section: "todo", title: "Kinkakuji", why: "Gün batımında" } as unknown as Suggestion;
    expect(placeChips(suggestionCard(s, "todo"))).toEqual([]);
    const f = { ...s, key: "f", section: "food", template: "food", title: "Ippudo" } as unknown as Suggestion;
    expect(placeChips(suggestionCard(f, "todo"))).toEqual([{ kind: "tag", text: "Restoran" }]);
    const pin = place("Jardins", { addedBy: "Sabine" } as Partial<Item>);
    expect(placeChips(recordCard(pin, { section: "todo", people: 2, planned: false, wanted: false, reason: false })).map((c) => c.kind)).toEqual(["source"]);
  });
});
