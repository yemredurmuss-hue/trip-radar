// The hero's planning bar (two tones): what needs a booking, in three stages — booked, planned (decided, not
// booked yet), waiting for a decision. What takes no booking isn't counted.
import { describe, expect, it } from "vitest";
import { categorize, planStages, type CatSection } from "../src/lib/categories";
import { buildLegs, withLegChoice } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { isPlaceholder, placeholderPrint } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const base: Trip = { id: "t1", title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };

let n = 0;
const said = (input: Partial<PlannedInput> & Pick<PlannedInput, "kind">, over: Partial<Item> = {}): Item => ({
  ...plannedItem({ date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...input }, "t1", `s${++n}`, n),
  ...over,
});
const stay = (name: string, status: Item["status"]) =>
  makeItem({ name, category: "stay", city: "Porto", needKey: "stay:porto", dates: { start: "2026-10-08", end: "2026-10-11", source: "url" }, status });
const flight = (name: string, from: string, to: string, day: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    name,
    category: "flight",
    needKey: `flight:${from}-${to}`.toLowerCase(),
    city: to === "IST" ? "İstanbul" : "Porto",
    dates: { start: day, end: null, source: "page" },
    status,
    flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 },
    ...over,
  });

/** `placeholders`: tell categorize which records the start chat only made room for (TripPanel does). */
function sectionsOf(items: Item[], trip: Trip = base, placeholders = false): CatSection[] {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const stageCtx = placeholders ? (i: Item) => ({ placeholder: isPlaceholder(trip, i) }) : undefined;
  return categorize({ plan, timeline, items, legs, hidden, today: "2026-10-01", stageCtx });
}
/** The three the first hero counted: booked (and ready), planned, waiting for a decision (to find, or options). */
const stagesOf = (sections: CatSection[]) => {
  const c = planStages(sections);
  const out = { booked: c.booked + c.ready, planned: c.planned, open: c.search + c.options };
  return { ...out, total: out.booked + out.planned + out.open };
};
/** Only the flights and stays: the airport transfers a dated trip grows are their own needs (see below). */
const flightsAndStays = (s: CatSection[]) => s.filter((x) => x.id === "flight" || x.id === "stay");

describe("planStages", () => {
  it("a booked flight, a hotel chosen and not booked, a flight the start chat only made room for: 1 / 1 / 1", () => {
    const home = flight("Dönüş", "OPO", "IST", "2026-10-11", "chosen", { origin: "chat" });
    const trip: Trip = { ...base, startGuide: { placeholders: { [home.id]: placeholderPrint(home) } } as Trip["startGuide"] };
    const items = [flight("Gidiş", "IST", "OPO", "2026-10-08", "booked"), stay("Jardim Stay", "chosen"), home];
    expect(isPlaceholder(trip, home)).toBe(true);
    expect(stagesOf(flightsAndStays(sectionsOf(items, trip, true)))).toEqual({ booked: 1, planned: 1, open: 1, total: 3 });
    // Without the start chat's print it's a choice like any other.
    expect(stagesOf(flightsAndStays(sectionsOf(items, trip)))).toEqual({ booked: 1, planned: 2, open: 0, total: 3 });
  });

  it("planned in the chat: planned; booked: booked", () => {
    const items = [
      said({ kind: "flight", date: "2026-10-08", from: "IST", to: "OPO", title: "TK1449" }),
      said({ kind: "stay", date: "2026-10-08", end_date: "2026-10-11", city: "Porto", title: "Jardim Stay", booked: true }),
    ];
    expect(items[0].status).toBe("chosen");
    expect(items[1].status).toBe("booked");
    const s = stagesOf(flightsAndStays(sectionsOf(items)));
    expect(s).toMatchObject({ booked: 1, planned: 1 });
  });

  it("a need with only saved options waits for a decision", () => {
    const items = [stay("Jardim Stay", "saved"), stay("Ribeira Loft", "saved")];
    expect(stagesOf(sectionsOf(items).filter((x) => x.id === "stay"))).toEqual({ booked: 0, planned: 0, open: 1, total: 1 });
  });

  it("empty nights and a flight not added yet are needs waiting too (the empty cards)", () => {
    // Two cities a night apart: the gap between the stays is an empty card, a stay to find.
    const items = [makeItem({ name: "Jardim Stay", category: "stay", city: "Porto", needKey: "stay:porto", dates: { start: "2026-10-08", end: "2026-10-09", source: "url" }, status: "booked" })];
    const s = stagesOf(sectionsOf(items).filter((x) => x.id === "stay"));
    expect(s.booked).toBe(1);
    expect(s.open).toBeGreaterThanOrEqual(1);
  });

  it("an empty trip has nothing", () => {
    const blank: Trip = { ...base, confirmedDates: null };
    expect(stagesOf(sectionsOf([], blank))).toEqual({ booked: 0, planned: 0, open: 0, total: 0 });
    expect(stagesOf([])).toEqual({ booked: 0, planned: 0, open: 0, total: 0 });
  });

  it("everything booked", () => {
    const items = [flight("Gidiş", "IST", "OPO", "2026-10-08", "booked"), stay("Jardim Stay", "booked"), flight("Dönüş", "OPO", "IST", "2026-10-11", "booked")];
    expect(stagesOf(flightsAndStays(sectionsOf(items)))).toEqual({ booked: 3, planned: 0, open: 0, total: 3 });
  });

  it("what takes no booking isn't counted: ideas, a restaurant, a chore, a transfer planned as a taxi", () => {
    const items = [
      stay("Jardim Stay", "booked"),
      said({ kind: "todo", date: "2026-10-09", city: "Porto", title: "Ribeira yürüyüşü" }, { status: "chosen", booking: "none" }),
      said({ kind: "food", date: "2026-10-09", city: "Porto", title: "Cantinho do Avillez" }, { status: "chosen" }),
      said({ kind: "prep", title: "Pasaportu kontrol et" }, { doneAt: 5 }),
      said({ kind: "prep", title: "Adaptör al" }),
    ];
    const sections = sectionsOf(items);
    // They're on the Plan (the chores in Diğer's Hazırlık, the ideas in their sections), just not needs.
    expect(sections.find((x) => x.id === "other")!.entries).toHaveLength(2);
    expect(sections.filter((x) => x.id === "todo" || x.id === "food").flatMap((x) => x.entries)).toHaveLength(2);
    const stays = stagesOf(sections.filter((x) => x.id === "stay" || x.id === "todo" || x.id === "food" || x.id === "other"));
    expect(stays).toEqual({ booked: 1, planned: 0, open: 0, total: 1 });
  });

  it("an airport transfer: not on the Plan while nothing is said, not a need once it's a taxi, booked once arranged", () => {
    const items = [flight("Gidiş", "IST", "OPO", "2026-10-08", "booked"), stay("Jardim Stay", "booked")];
    const transport = (t: Trip) => stagesOf(sectionsOf(items, t).filter((x) => x.id === "transport"));
    expect(transport(base).total).toBe(0);
    const arrival = buildLegs(buildPlan(base, items), base).find((l) => l.kind === "arrival")!;
    expect(transport(withLegChoice(base, arrival.key, { mode: "taxi", booked: false }))).toEqual({ booked: 0, planned: 0, open: 0, total: 0 });
    expect(transport(withLegChoice(base, arrival.key, { mode: "taxi", booked: true }))).toEqual({ booked: 1, planned: 0, open: 0, total: 1 });
  });

  it("a car hire: planned once said, booked once booked", () => {
    const car = said({ kind: "car_rental", date: "2026-10-09", end_date: "2026-10-10", city: "Porto" });
    const of = (i: Item) => stagesOf(sectionsOf([stay("Jardim Stay", "booked"), i]).filter((x) => x.id === "transport"));
    expect(of(car)).toEqual({ booked: 0, planned: 1, open: 0, total: 1 });
    expect(of({ ...car, status: "booked" })).toEqual({ booked: 1, planned: 0, open: 0, total: 1 });
  });

  it("an eSIM is bought: chosen is planned, put in (Kurdum) is done", () => {
    const esim = makeItem({ name: "Airalo Portekiz", category: "esim", needKey: "esim:pt", status: "chosen" });
    const of = (i: Item) => stagesOf(sectionsOf([stay("Jardim Stay", "booked"), i]).filter((x) => x.id === "other"));
    expect(of(esim)).toEqual({ booked: 0, planned: 1, open: 0, total: 1 });
    expect(of({ ...esim, installedAt: 5 })).toEqual({ booked: 1, planned: 0, open: 0, total: 1 });
  });

  it("a ruled-out option is never counted", () => {
    const items = [stay("Jardim Stay", "chosen"), stay("Ribeira Loft", "dismissed")];
    expect(stagesOf(sectionsOf(items).filter((x) => x.id === "stay"))).toEqual({ booked: 0, planned: 1, open: 0, total: 1 });
  });
});
