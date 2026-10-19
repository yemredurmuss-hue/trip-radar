// 0.38.8 (Emre, Patagonya): a rented car on the plan drives the roads between the cities over its days. Those roads
// are "Dahil · kiralık araçla" with Değiştir, no "Aranıyor" and no picker; a way said or saved for one of them (a
// train) stays; with no rental, as before. Also the transfer from the airport when the car is picked up there.
import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { setLang, withLang } from "../src/lib/i18n";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs, legKey } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { wouldMake } from "../src/lib/startCreate";
import { applyAnswer, isPlaceholder, newStart, placeholderPrint, type StartState } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-18";
setLang("tr");

function board(trip: Trip, items: Item[]) {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, hidden, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY };
  return collectionsOf(input).flatMap((c) => c.intents);
}

/** Ushuaia 3 nights → El Calafate 2 → El Chaltén 2, from İstanbul, as the start makes it. */
function patagonia(): { trip: Trip; items: Item[] } {
  let s: StartState = newStart("p", "plan", 1, "tr");
  s = applyAnswer(s, { q: "where", place: "Arjantin", country: "Arjantin", code: "AR" }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: 7 } }, 2);
  s = applyAnswer(s, { q: "start", date: "2027-01-10", approx: false }, 2);
  s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
  s = { ...s, route: { stops: [{ city: "Ushuaia", nights: 3, code: "AR" }, { city: "El Calafate", nights: 2, code: "AR" }, { city: "El Chaltén", nights: 2, code: "AR" }], arrive: null, leave: null, confirmed: true, source: "user" } };
  return withLang("tr", () => {
    const w = wouldMake(s, 1)!;
    const placeholders = Object.fromEntries(w.items.filter((i) => i.plannedKind !== "prep").map((i) => [i.id, placeholderPrint(i)]));
    return { trip: { ...w.trip, startGuide: { ...w.trip.startGuide!, placeholders } }, items: w.items };
  });
}

const car = (over: Partial<Item> = {}) =>
  makeItem({ id: "car", category: "transport", plannedKind: "car_rental", name: "Araç kiralama", city: "Ushuaia", status: "chosen", dates: { start: "2027-01-10", end: "2027-01-17", source: "user" }, ...over });

const moves = (intents: ReturnType<typeof board>) =>
  intents.filter((i) => i.section === "transport" && i.legKey?.includes(":move:")).map((i) => [i.head.name, i.status, i.cover?.by ?? "", i.modes.length > 0]);

describe("a rented car drives the roads between the cities (Patagonya)", () => {
  it("with no rental, as before: both roads to find, their ways to pick from", () => {
    const { trip, items } = patagonia();
    expect(moves(board(trip, items))).toEqual([
      ["Ushuaia → El Calafate", "searching", "", true],
      ["El Calafate → El Chaltén", "searching", "", true],
    ]);
  });

  it("a car for all the days: both roads by the car, sorted (Dahil · kiralık araçla), Değiştir's ways kept, no picker", () => {
    const { trip, items } = patagonia();
    const intents = board({ ...trip, id: "t1" }, [...items, car()]);
    expect(moves(intents)).toEqual([
      ["Ushuaia → El Calafate", "included", "kiralık araçla", true],
      ["El Calafate → El Chaltén", "included", "kiralık araçla", true],
    ]);
    // Değiştir offers the other ways; nothing is drawn as Önerimiz's picks.
    const road = intents.find((i) => i.head.name === "Ushuaia → El Calafate")!;
    expect(road.modes).toEqual(["train", "bus", "car", "flight"]);
    expect(road.wayPicks).toBeUndefined();
    expect(road.cover?.itemId).toBe("car");
  });

  it("the AI's rental put on the plan from the first day with no last one runs to the trip's end", () => {
    const { trip, items } = patagonia();
    const intents = board(trip, [...items, car({ dates: { start: "2027-01-10", end: null, source: "unverified" }, status: "saved" })]);
    expect(moves(intents).map((m) => m[1])).toEqual(["included", "included"]);
    // With no day at all, the whole trip too.
    const undated = board(trip, [...items, car({ dates: { start: null, end: null, source: "none" } })]);
    expect(moves(undated).map((m) => m[1])).toEqual(["included", "included"]);
  });

  it("a car for some days covers only the roads within them", () => {
    const { trip, items } = patagonia();
    const intents = board(trip, [...items, car({ dates: { start: "2027-01-10", end: "2027-01-13", source: "user" } })]);
    expect(moves(intents).map((m) => m[1])).toEqual(["included", "searching"]);
  });

  it("a train saved for one road stays; the car takes the other", () => {
    const { trip, items } = patagonia();
    const train = makeItem({
      id: "train", category: "transport", plannedKind: "train", name: "Tren Ushuaia → El Calafate", needKey: "transport:ush-fte", city: "El Calafate", status: "chosen", url: "https://example.com/t",
      dates: { start: "2027-01-13", end: null, source: "page" }, flight: { from: "Ushuaia", to: "El Calafate", departure: "2027-01-13T09:00", arrival: null, carrier: null, flightNumber: null, stops: 0 },
    });
    const intents = board(trip, [...items, car(), train]);
    const [first, second] = moves(intents);
    expect(first[1]).not.toBe("included");
    expect(intents.find((i) => i.itemIds.includes("train"))?.kind).toBe("train");
    expect(second).toEqual(["El Calafate → El Chaltén", "included", "kiralık araçla", true]);
  });

  it("a way picked on a road (Değiştir → Otobüs) wins over the car", () => {
    const { trip, items } = patagonia();
    const key = legKey("2027-01-13", "move", "Ushuaia", "El Calafate");
    const picked: Trip = { ...trip, legs: { [key]: { mode: "bus", booked: false, note: null, updatedAt: 1 } } };
    const intents = board(picked, [...items, car()]);
    const [first, second] = moves(intents);
    expect(first.slice(0, 3)).toEqual(["Ushuaia → El Calafate", "chosen", ""]);
    expect(intents.find((i) => i.legKey === key)?.kind).toBe("bus");
    expect(second[1]).toBe("included");
  });
});

describe("the road from the airport, when the car is picked up there", () => {
  // Landing at CMB (Kolombo), staying in Ahangama: the road from the airport is a box of its own (legs.farHub).
  const trip: Trip = { id: "t1", title: "Sri Lanka", confirmedDates: { start: "2026-11-24", end: "2026-12-03" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  const items = [
    makeItem({ id: "home", name: "Harumalgoda Airbnb", category: "stay", city: "Ahangama", needKey: "stay:ahangama", status: "booked", dates: { start: "2026-11-24", end: "2026-12-03", source: "page" } }),
    makeItem({ id: "in", name: "IST-CMB", category: "flight", needKey: "flight:cmb", city: "Kolombo", status: "booked", dates: { start: "2026-11-23", end: null, source: "page" }, flight: { from: "IST", to: "CMB", departure: "2026-11-23T20:00", arrival: "2026-11-24T09:00", carrier: "Turkish Airlines", flightNumber: "TK730", stops: 0 } }),
  ];
  const road = (intents: ReturnType<typeof board>) => intents.find((i) => i.legKey?.includes(":arrival:"));

  it("picked up in Kolombo the day it lands: the road is the car's, Değiştir's ways kept", () => {
    const intents = board(trip, [...items, car({ city: "Kolombo", name: "Araç kiralama · Bandaranaike Havalimanı", dates: { start: "2026-11-24", end: "2026-12-03", source: "user" } })]);
    expect([road(intents)?.head.name, road(intents)?.status, road(intents)?.cover?.by]).toEqual(["Kolombo → Ahangama", "included", "kiralık araçla"]);
    expect(road(intents)?.modes.length).toBeGreaterThan(0);
    expect(road(intents)?.wayPicks).toBeUndefined();
  });

  it("picked up in Ahangama, or a day later, or no rental: the road stays to find", () => {
    const there = board(trip, [...items, car({ city: "Ahangama", dates: { start: "2026-11-24", end: "2026-12-03", source: "user" } })]);
    expect(road(there)?.status).toBe("searching");
    const later = board(trip, [...items, car({ city: "Kolombo", dates: { start: "2026-11-25", end: "2026-12-03", source: "user" } })]);
    expect(road(later)?.status).toBe("searching");
    expect(road(board(trip, items))?.status).toBe("searching");
  });
});
