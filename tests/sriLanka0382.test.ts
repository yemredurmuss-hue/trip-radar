// 0.38.2: Emre's Sri Lanka trip (the start's chat made Ahangama; then "Bodrum → Kolombo, Sri Lanka → Bali" was added in the
// chat). The start's placeholders are no options on the Pano; a stay or a flight named only by its kind and its places is
// still to find (Aranıyor); the empty nights after the flight out to Bali are no stay to find; the road from Colombo's
// airport to Ahangama is a way to plan in Ulaşım.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { withLang } from "../src/lib/i18n";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs, farHub } from "../src/lib/legs";
import { stageOf } from "../src/lib/lifecycle";
import { afterExit } from "../src/lib/nightsAboard";
import { panoEntries } from "../src/lib/pano";
import { panoBoardOf } from "../src/lib/panoBoard";
import { buildPlan } from "../src/lib/plan";
import { namesSomething } from "../src/lib/planned";
import { isPlaceholder } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-19";
const trip: Trip = {
  id: "t1", title: "Sri Lanka", confirmedDates: { start: "2026-11-01", end: "2026-11-15" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: [], count: 2 },
};

let n = 0;
const next = (p: string) => `${p}${++n}`;
/** A plan said in the chat: chosen, no page, no price, no hour (plannedItem's shape). */
const said = (over: Partial<Item>): Item => makeItem({ id: next("c"), origin: "chat", status: "chosen", dates: { start: null, end: null, source: "unverified" }, ...over });
const flight = (name: string, from: string, to: string, day: string, over: Partial<Item> = {}) =>
  said({ name, category: "flight", plannedKind: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), city: to, dates: { start: day, end: null, source: "unverified" }, flight: { from, to, departure: null, arrival: null, carrier: null, flightNumber: null, stops: null }, ...over });
const stay = (name: string, city: string, start: string, end: string, over: Partial<Item> = {}) =>
  said({ name, category: "stay", plannedKind: "stay", city, needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "unverified" }, ...over });

/** The board as TripPanel builds it, and the v82 categories on it. */
function board(items: Item[], t: Trip = trip) {
  const ctx = makeContext(t, items, { today: TODAY });
  const decisions = decideTrip(items, ctx);
  const plan = buildPlan(t, items);
  const legs = buildLegs(plan, t);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(t, i), empty: isEmptyRecord(t, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip: t, plan, sections, items, today: TODAY, decisions, ctx };
  const all = collectionsOf(input);
  const of = (section: string) => all.find((c) => c.section.id === section)?.intents ?? [];
  return { input, decisions, legs, of, pano: panoBoardOf({ ...input, people: 2, me: null }) };
}

const sriLanka = () => [
  flight("Bodrum → Kolombo Uçuşu", "BJV", "CMB", "2026-11-01"),
  stay("Ahangama Konaklama", "Ahangama", "2026-11-01", "2026-11-10"),
  flight("Sri Lanka → Bali", "CMB", "DPS", "2026-11-10", { city: "Bali" }),
];

describe("madde 1: the start's placeholders are not on the Pano", () => {
  it("shows only the stay with a Booking link, and its tab counts the same", () => {
    const linked = makeItem({
      id: next("b"), name: "Kaba Kaba Villa", category: "stay", city: "Ahangama", needKey: "stay:ahangama", status: "saved", url: "https://www.booking.com/hotel/lk/kaba.html",
      dates: { start: "2026-11-01", end: "2026-11-10", source: "url" },
    });
    const items = [...sriLanka(), linked];
    const { pano, decisions } = board(items);
    const options = pano.cats.flatMap((c) => c.needs.flatMap((x) => x.options.map((o) => o.item.name)));
    expect(options).toEqual(["Kaba Kaba Villa"]);
    expect(pano.counts.all).toBe(1);
    expect(panoEntries(items, decisions).map((e) => e.item.name)).toEqual(["Kaba Kaba Villa"]);
  });

  it("keeps a booked plan said in the chat, and one with a link", () => {
    const booked = stay("Ahangama Konaklama", "Ahangama", "2026-11-01", "2026-11-10", { status: "booked" });
    const withLink = flight("Bodrum → Kolombo Uçuşu", "BJV", "CMB", "2026-11-01", { url: "https://www.turkishairlines.com/x" });
    expect(panoEntries([booked, withLink]).length).toBe(2);
  });
});

describe("madde 5: a name that says only the kind and the places is still to find", () => {
  it("reads the kind's words with their endings and the record's own places", () => {
    expect(namesSomething({ name: "Ahangama Konaklama", provider: null, city: "Ahangama" })).toBe(false);
    expect(namesSomething({ name: "Bali Konaklaması", provider: null, city: "Bali" })).toBe(false);
    expect(namesSomething({ name: "Bodrum → Kolombo Uçuşu", provider: null, city: "CMB", flight: { from: "BJV", to: "CMB", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } })).toBe(false);
    expect(namesSomething({ name: "Kolombo'ya uçuş", provider: null, city: "Kolombo" })).toBe(false);
    expect(namesSomething({ name: "Flight to Bali", provider: null, city: "Bali" })).toBe(false);
    // An airport's country is one of its places too.
    expect(namesSomething({ name: "Sri Lanka → Bali", provider: null, city: "Bali", flight: { from: "CMB", to: "DPS", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } })).toBe(false);
    expect(namesSomething({ name: "Jardim Stay", provider: null, city: "Porto" })).toBe(true);
    expect(namesSomething({ name: "Ahangama Konaklama", provider: "Booking.com", city: "Ahangama" })).toBe(true);
    // Another city's name is something said: not this record's own place.
    expect(namesSomething({ name: "Galle Konaklama", provider: null, city: "Ahangama" })).toBe(true);
  });

  it("puts Ahangama's stay and the flight there in Aranıyor, a named stay stays chosen", () => {
    const [out, ahangama] = sriLanka();
    const ctx = { empty: true };
    expect(stageOf(ahangama, ctx)).toBe("search");
    expect(stageOf(out, ctx)).toBe("search");
    expect(stageOf(stay("Jardim Stay", "Porto", "2026-11-01", "2026-11-05"), ctx)).toBe("planned");

    const { of } = board(sriLanka());
    expect(of("stay").map((i) => [i.head.name, i.status])).toEqual([["Ahangama", "searching"]]);
    // Both flights said in the chat (the way home is an empty one to add).
    expect(of("flight").map((i) => [i.head.name, i.status])).toEqual([["Bodrum → Kolombo", "searching"], ["Ahangama → Bali", "searching"], ["Bali → Bodrum", "searching"]]);
    const named = board([stay("Jardim Stay", "Porto", "2026-11-01", "2026-11-15")]);
    expect(named.of("stay").map((i) => i.status)).toEqual(["chosen"]);
  });
});

describe("madde 6b: no stay to find after the way out", () => {
  it("opens no Bali nights after the flight out of Sri Lanka", () => {
    const { of } = board(sriLanka());
    expect(of("stay").map((i) => i.head.name)).toEqual(["Ahangama"]);
    expect(afterExit({ start: "2026-11-10", end: "2026-11-15" }, sriLanka())).toBe(true);
  });

  it("keeps them with a stay where the flight lands, or a way on from there", () => {
    const items = sriLanka();
    expect(afterExit({ start: "2026-11-10", end: "2026-11-15" }, [...items, stay("Ubud Konaklama", "Bali", "2026-11-12", "2026-11-15")])).toBe(false);
    const onward = flight("Bali → İstanbul", "DPS", "IST", "2026-11-15", { status: "saved" });
    expect(afterExit({ start: "2026-11-10", end: "2026-11-15" }, [...items, onward])).toBe(false);
  });

  it("keeps the nights where the way in lands (no stay before it)", () => {
    const items = [flight("İstanbul → Porto", "IST", "OPO", "2026-11-01", { city: "Porto" })];
    expect(afterExit({ start: "2026-11-01", end: "2026-11-15" }, items)).toBe(false);
    expect(board(items).of("stay").map((i) => [i.head.name, i.status])).toEqual([["Porto", "searching"]]);
  });

  it("Lizbon → Porto with a stay in Porto: Porto's nights stand", () => {
    const items = [
      stay("Casa Alfama", "Lizbon", "2026-11-01", "2026-11-06"),
      flight("Lizbon → Porto", "LIS", "OPO", "2026-11-06", { status: "booked" }),
      stay("Porto Konaklama", "Porto", "2026-11-06", "2026-11-15"),
    ];
    expect(board(items).of("stay").map((i) => i.head.name)).toEqual(["Lizbon", "Porto"]);
  });
});

describe("madde 7: from an airport in another city to the stay", () => {
  it("draws Kolombo → Ahangama in Ulaşım, still to find, with the ways between two places", () => {
    const { of, legs } = board(sriLanka());
    const arrival = legs.find((l) => l.kind === "arrival")!;
    expect(farHub(arrival)).toBe("Kolombo");
    const road = of("transport").find((i) => i.head.name === "Kolombo → Ahangama");
    expect(road).toMatchObject({ status: "searching", head: { route: { from: "Kolombo", to: "Ahangama" } } });
    // And back to the airport on the day of the flight to Bali (it leaves from Colombo too).
    expect(of("transport").map((i) => [i.head.name, i.status])).toEqual([["Kolombo → Ahangama", "searching"], ["Ahangama → Kolombo", "searching"]]);
    expect(road!.modes).toEqual(["train", "bus", "transfer", "taxi", "car"]);
    expect(road!.options).toEqual([]);
    expect(road!.estimate).toBeNull();
  });

  it("draws no such box when the flight lands in the stay's city", () => {
    const items = [flight("İstanbul → Porto", "IST", "OPO", "2026-11-01"), stay("Porto Konaklama", "Porto", "2026-11-01", "2026-11-15")];
    const { of, legs } = board(items);
    expect(legs.filter((l) => l.kind === "arrival" || l.kind === "departure").map(farHub)).toEqual([null, null]);
    expect(of("transport").filter((i) => i.status === "searching")).toEqual([]);
  });

  it("reads the airport's city in either language (LIS is Lisbon in English, the stay in Lizbon)", () => {
    const items = [flight("Lizbon → İstanbul", "LIS", "IST", "2026-11-15", { city: "İstanbul" }), stay("Lisboa Loft", "Lizbon", "2026-11-01", "2026-11-15")];
    for (const lang of ["tr", "en"] as const) expect(withLang(lang, () => board(items).legs.filter((l) => l.kind === "departure").map(farHub))).toEqual([null]);
  });

  it("needs both cities known: an airport the table can't name says nothing", () => {
    const items = [flight("X → Y", "IST", "ZZQ", "2026-11-01"), stay("Ahangama Konaklama", "Ahangama", "2026-11-01", "2026-11-15")];
    expect(board(items).legs.filter((l) => l.kind === "arrival").map(farHub)).toEqual([null]);
  });
});
