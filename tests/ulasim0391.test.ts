// 0.39.1 (R4): the ways' suggestions by what the trip is for, on Emre's Bali (Bodrum → Denpasar landing 10 Ara 14:20, Canggu
// until 10 Oca, with Sabin). The Travelpayouts ways between cities (Omio's, through the offers function) are asked again for
// a way by train, bus or boat and a change of city still open (the v82 boxes never asked since the old empty leg card went,
// eb4818d); the way in from the airport is never an empty box (its ends, the landing's hour, Önerimiz by the budget and the
// hour); a rental looks on the rental sites; a taxi said for a way puts "Uber uygulamasını indir" in Hazırlık once.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { withLang } from "../src/lib/i18n";
import { offerNeed, selfSearches, type SelfSearchAt } from "../src/lib/intentFrame";
import { collectionsOf, wayPickOrder, type IntentInput, type IntentVM } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import { validOffers, type Offer } from "../src/lib/offerSource";
import { makeLiveSource, queryOf } from "../src/lib/offerSources";
import { buildPlan } from "../src/lib/plan";
import { prepHiddenKey, prepTasks, type PrepInput } from "../src/lib/prepDays";
import { memoryKV } from "../src/lib/share/store";
import { isPlaceholder } from "../src/lib/startTrip";
import { shownSuggestions } from "../src/lib/suggestions";
import { rideApps, ticketFace, waySearches, wayPicks } from "../src/lib/ticketFrame";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Suggestion, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-19";
const bali: Trip = {
  id: "bali", title: "Bali Gezisi", confirmedDates: { start: "2026-12-10", end: "2027-01-10" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: ["Sabin"], count: 2 },
};
const ID_AT: SelfSearchAt = { countries: ["ID"], countryNames: ["Endonezya"], adults: 2 };
const PT_AT: SelfSearchAt = { countries: ["PT"], countryNames: ["Portekiz"], adults: 2 };

let n = 0;
const said = (over: Partial<Item>): Item => makeItem({ id: `r${++n}`, origin: "chat", status: "chosen", dates: { start: null, end: null, source: "unverified" }, ...over });
const ends = (from: string | null, to: string | null, departure: string | null = null, arrival: string | null = null) => ({ from, to, departure, arrival, carrier: null, flightNumber: null, stops: null });
const landing = (at = "14:20") =>
  said({ name: "Bodrum → Denpasar", category: "flight", plannedKind: "flight", city: "Denpasar", dates: { start: "2026-12-10", end: null, source: "unverified" }, flight: ends("BJV", "DPS", "2026-12-09T22:00", `2026-12-10T${at}`) });
const canggu = () => said({ name: "Canggu Konaklama", category: "stay", plannedKind: "stay", city: "Canggu", dates: { start: "2026-12-10", end: "2027-01-10", source: "unverified" } });
const ai = (title: string, template: string, over: Partial<NonNullable<Suggestion["payload"]>> = {}): Suggestion => ({
  key: `ai:transport:${template}:${title}`, section: "transport", kind: "add", title, why: "Canggu'da ulaşım için", source: "ai", template, payload: { city: null, start: "2026-12-10", end: null, title, ...over }, createdAt: 1, state: "open",
});

function board(items: Item[], over: Partial<Trip> = {}, suggestions: Suggestion[] = []) {
  const t: Trip = { ...bali, ...over };
  const ctx = makeContext(t, items, { today: TODAY });
  const plan = buildPlan(t, items);
  const legs = buildLegs(plan, t);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(t, i), empty: isEmptyRecord(t, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const shown = shownSuggestions(suggestions, [], items, legs);
  const input: IntentInput = { trip: t, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx, suggestions: { transport: shown.filter((s) => s.section === "transport") } };
  const transport = collectionsOf(input).find((c) => c.section.id === "transport")?.intents ?? [];
  return { legs, transport, trip: t };
}
const road = (r: { transport: IntentVM[] }) => r.transport.find((i) => i.legKey?.includes(":arrival:"))!;

describe("the airport transfer is never empty (Denpasar (DPS) 14:20 → Canggu)", () => {
  it("fills its ends and the landing's hour, and the AI's 'Havalimanı transferi' is that box, not a second, empty one", () => {
    const r = board([landing(), canggu()], {}, [ai("Havalimanı transferi ayarlayın", "taxi", { city: "Canggu" })]);
    const box = road(r);
    expect(box.head.name).toBe("Denpasar → Canggu");
    const face = withLang("tr", () => ticketFace(box))!;
    expect(face.from).toMatchObject({ city: "Denpasar", place: "DPS", time: "14:20" });
    expect(face.to).toMatchObject({ city: "Canggu" });
    expect(face.sub).toBe("10 Ara");
    expect(r.transport.filter((i) => i.key.startsWith("suggestion:") && /transfer/i.test(i.head.name))).toEqual([]);
    expect(r.transport.filter((i) => i.legKey === box.legKey)).toHaveLength(1);
  });

  it("Önerimiz by the trip's intent: a low budget public transport first, the taxi second", () => {
    // €2.000 for 2 people over 32 days: about €31 a day each (budgetLevel "low").
    const box = road(board([landing(), canggu()], { budget: { amount: 2000, currency: "EUR" } }));
    expect(box.wayPicks).toEqual(["train", "taxi"]);
    const picks = withLang("tr", () => wayPicks(box, ID_AT));
    // Bali has no line the register knows: public transport on the map's directions (never "Tren"), picked as a bus.
    expect(picks.map((p) => [p.mode, p.label])).toEqual([["bus", "Toplu taşıma"], ["taxi", "Taksi ya da özel transfer"]]);
    const transit = new URL(picks[0].site!.url);
    expect(Object.fromEntries(transit.searchParams)).toMatchObject({ destination: "Canggu", travelmode: "transit" });
    expect(picks[1].site).toMatchObject({ id: "uber" });
    expect(picks[1].site!.url).toMatch(/dropoff\[formatted_address\]=Canggu$/);
    expect(picks.map((p) => p.label).join(" ")).not.toMatch(/\d/);
  });

  it("a mid or high budget, a luxury trip or a late landing: the taxi or private transfer first", () => {
    expect(road(board([landing(), canggu()], { budget: { amount: 12000, currency: "EUR" } })).wayPicks).toEqual(["taxi", "train"]);
    expect(road(board([landing(), canggu()], { style: { key: "k", ids: ["luxury"] } })).wayPicks).toEqual(["taxi", "train"]);
    expect(road(board([landing("23:40"), canggu()], { budget: { amount: 2000, currency: "EUR" } })).wayPicks).toEqual(["taxi", "train"]);
    // Nothing said: public transport first, as 0.38.4 had it.
    expect(road(board([landing(), canggu()])).wayPicks).toEqual(["train", "taxi"]);
    expect(wayPickOrder(bali, "04:30", 2)).toEqual(["taxi", "train"]);
    expect(wayPickOrder(bali, "05:10", 2)).toEqual(["train", "taxi"]);
  });
});

describe("a rental looks on the rental sites", () => {
  it("'Araç kiralama' (never 'Araç kiralama kiralama') with DiscoverCars, its place and days in the link's words; a motorbike on BikesBooking", () => {
    const r = board([landing(), canggu()], {}, [ai("Araç kiralama", "car"), ai("Uzun dönem motor kiralama", "moto")]);
    const car = r.transport.find((i) => i.kind === "car")!;
    expect(car.head.name).toBe("Araç kiralama");
    const links = withLang("tr", () => waySearches(car, ID_AT));
    expect(links.map((l) => l.id)).toEqual(["discovercars"]);
    expect(links[0].url).toBe("https://www.discovercars.com/");
    expect(links[0].said).toBe(`Kiralık araç ara: Canggu, ${car.head.parts[0]}`);
    expect(links[0].said).toMatch(/10 Ara.* – 10 Oca/);
    const moto = r.transport.find((i) => i.kind === "moto")!;
    expect(withLang("tr", () => waySearches(moto, ID_AT)).map((l) => [l.id, l.said?.split(":")[0]])).toEqual([["bikesbooking", "Kiralık motosiklet ara"]]);
    // No source of offers for a rental: nothing asked, no price made up.
    expect(offerNeed(car, ID_AT)).toBeNull();
  });
});

describe("the ways between cities from Travelpayouts (Omio) are asked again", () => {
  const lisbon = () => [
    said({ name: "Lizbon Konaklama", category: "stay", plannedKind: "stay", city: "Lizbon", dates: { start: "2026-12-10", end: "2026-12-14", source: "unverified" } }),
    said({ name: "Porto Konaklama", category: "stay", plannedKind: "stay", city: "Porto", dates: { start: "2026-12-14", end: "2026-12-18", source: "unverified" } }),
  ];
  const portugal: Partial<Trip> = { confirmedDates: { start: "2026-12-10", end: "2026-12-18" } };
  const ticket = (kind: "train" | "bus" | "ferry", from: string, to: string) =>
    said({ name: `${from} → ${to}`, category: "transport", plannedKind: kind, status: "saved", city: to, dates: { start: "2026-12-14", end: null, source: "unverified" }, flight: ends(from, to) });

  it("a change of city still open (Lizbon → Porto): its box asks the ways between the two cities, its day and head count", () => {
    const move = board(lisbon(), portugal).transport.find((i) => i.head.route?.from === "Lizbon" && i.head.route.to === "Porto")!;
    expect(move.modes).toEqual(["train", "bus", "car", "flight"]);
    const need = offerNeed(move, PT_AT)!;
    expect(need).toMatchObject({ section: "transport", kind: "transfer", from: "Lizbon", to: "Porto", start: "2026-12-14", adults: 2 });
    expect(queryOf(need, "tr")).toBe("kind=transfer&from=Lizbon&to=Porto&adults=2&lang=tr");
    expect(waySearches(move, PT_AT).map((l) => l.id)).toEqual(["rome2rio"]);
  });

  for (const [kind, from, to] of [["train", "Lizbon", "Porto"], ["bus", "Lizbon", "Porto"], ["ferry", "Lizbon", "Porto"]] as const) {
    it(`a ${kind} box: Omio's ways between its ends, and Rome2rio under "Kendin ara"`, () => {
      const box = board([...lisbon(), ticket(kind, from, to)], portugal).transport.find((i) => i.kind === kind)!;
      expect(box.head.route).toEqual({ from, to });
      expect(offerNeed(box, PT_AT)).toMatchObject({ kind: "transfer", from, to, start: "2026-12-14" });
      const links = selfSearches(box, PT_AT);
      expect(links.map((l) => [l.id, l.url])).toEqual([["rome2rio", `https://www.rome2rio.com/map/${from}/${to}`]]);
    });
  }

  it("a taxi or a transfer is a ride: Uber and the directions, never Omio's ways", () => {
    const r = board([landing(), canggu()], { legs: { "2026-12-10:arrival:canggu": { mode: "taxi", booked: false, note: null, updatedAt: 1 } } });
    const taxi = road(r);
    expect(taxi.kind).toBe("taxi");
    expect(offerNeed(taxi, ID_AT)).toBeNull();
    const links = waySearches(taxi, ID_AT);
    expect(links.map((l) => l.id)).toEqual(["uber", "maps"]);
    expect(links[0].url).toMatch(/^https:\/\/m\.uber\.com\/ul\/\?action=setPickup&pickup\[formatted_address\]=.+&dropoff\[formatted_address\]=Canggu$/);
    // A saved taxi with nothing of the leg's ways on it is a ride too.
    const vm = { ...taxi, modes: [] };
    expect(waySearches(vm, ID_AT).map((l) => l.id)).toEqual(["uber", "maps"]);
  });

  it("the source's answer for the way is kept as Omio's offer on the box (a fake server: nothing real is asked)", async () => {
    const omio: Offer = { id: "om:1-2:train", kind: "transfer", title: "Tren · Lisbon → Porto", url: "https://tp.media/r?u=omio", why: "En ucuz yol · başlangıç fiyatı", source: "Omio", fetchedAt: 1, price: 50, currency: "EUR", durationMinutes: 170, via: "Tren" };
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => ({ offers: [omio] }) } as Response;
    }) as unknown as typeof fetch;
    const src = makeLiveSource({ kv: memoryKV(), fetcher, now: () => 1, server: "https://srv" });
    const move = board(lisbon(), portugal).transport.find((i) => i.head.route?.to === "Porto")!;
    const need = offerNeed(move, PT_AT)!;
    const got = validOffers(await withLang("tr", () => src.offers(need)), need);
    expect(calls).toEqual(["https://srv/functions/v1/offers?kind=transfer&from=Lizbon&to=Porto&adults=2&lang=tr"]);
    expect(got.map((o) => [o.source, o.title, o.price])).toEqual([["Omio", "Tren · Lisbon → Porto", 50]]);
  });
});

describe("a taxi said for a way: 'Uber uygulamasını indir' in Hazırlık, once", () => {
  const input = (rides: string[], over: Partial<PrepInput> = {}): PrepInput => ({
    chores: [], items: [landing()], trip: {}, range: { start: "2026-12-10", end: "2027-01-10" }, passport: "TR", countries: [], today: TODAY, rides, ...over,
  });

  it("is suggested by the taxi on the way in, not by a way still open nor by the metro", () => {
    const taxi = board([landing(), canggu()], { legs: { "2026-12-10:arrival:canggu": { mode: "taxi", booked: false, note: null, updatedAt: 1 } } });
    expect(rideApps(taxi.legs, taxi.trip)).toEqual(["Uber"]);
    const open = board([landing(), canggu()]);
    expect(rideApps(open.legs, open.trip)).toEqual([]);
    const metro = board([landing(), canggu()], { legs: { "2026-12-10:arrival:canggu": { mode: "bus", booked: false, note: null, updatedAt: 1 } } });
    expect(rideApps(metro.legs, metro.trip)).toEqual([]);
  });

  it("is one chore before leaving, never repeated, taken off for good, and not when the traveller said it", () => {
    const tasks = withLang("tr", () => prepTasks(input(["Uber", "Uber"])));
    const app = tasks.filter((t) => t.key === "app:uber");
    expect(app).toHaveLength(1);
    expect(app[0]).toMatchObject({ title: "Uber uygulamasını indir", tick: "mark", day: { date: "2026-12-09", rel: "before" } });
    expect(withLang("en", () => prepTasks(input(["Uber"]))).find((t) => t.key === "app:uber")?.title).toBe("Download the Uber app");
    expect(prepTasks(input(["Uber"], { trip: { hidden: [prepHiddenKey("app:uber")] } })).some((t) => t.key === "app:uber")).toBe(false);
    expect(prepTasks(input(["Uber"], { trip: { prepDone: { "app:uber": 5 } } })).find((t) => t.key === "app:uber")).toMatchObject({ done: true, doneAt: 5 });
    const chore = said({ name: "Uber'i telefona kur", category: "other", plannedKind: "prep" });
    expect(prepTasks(input(["Uber"], { chores: [chore] })).some((t) => t.key === "app:uber")).toBe(false);
    expect(prepTasks(input([])).some((t) => t.key.startsWith("app:"))).toBe(false);
  });
});
