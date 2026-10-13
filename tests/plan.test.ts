import { describe, expect, it } from "vitest";
import { decideTrip, makeContext } from "../src/lib/decision";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { buildPlan, cityKeyOf, groupKeyOf, liveGroups, tripRange, type StayBlock } from "../src/lib/plan";
import type { Item, ItemStatus, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t", title: "Porto ve Madeira", confirmedDates: { start: "2026-10-07", end: "2026-10-17" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1, ...over,
});

let seq = 0;
function item(name: string, over: Partial<Item> = {}): Item {
  return {
    id: `p${++seq}`, tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name, provider: null,
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: null, end: null, source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: 200, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null, metrics: EMPTY_METRICS, geo: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
    ...over,
  };
}
const stay = (name: string, start: string, end: string, status: ItemStatus = "saved", city = "Porto") =>
  item(name, { dates: { start, end, source: "url" }, status, city, needKey: `stay:${city.toLowerCase()}` });
const flight = (name: string, from: string, to: string, day: string, status: ItemStatus = "saved", city: string | null = null) =>
  item(name, {
    category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), city,
    dates: { start: day, end: null, source: "page" },
    flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 },
    status,
  });

const names = (block: StayBlock) => (block.kind === "booked" ? [] : block.groups.map((g) => g.items.map((i) => i.name)));

describe("plan: nights, bookings and gaps", () => {
  // The traveller's own example: flying in on the 7th, 10–14 booked in Funchal.
  function example() {
    const faa = stay("FAA Rentals", "2026-10-10", "2026-10-14", "booked", "Funchal");
    const items = [
      flight("Pegasus", "IST", "OPO", "2026-10-07", "booked", "Porto"),
      faa,
      stay("Jardim Stay", "2026-10-07", "2026-10-10"),
      stay("Casa Azul", "2026-10-07", "2026-10-10"),
      stay("Late Inn", "2026-10-08", "2026-10-10"),
      stay("Clash Suites", "2026-10-09", "2026-10-12", "saved", "Funchal"),
      stay("Other Funchal", "2026-10-10", "2026-10-14", "saved", "Funchal"),
    ];
    return { faa, items };
  }

  it("shows booked nights, open nights with the options that fit, and closes what a booking made irrelevant", () => {
    const { items } = example();
    const plan = buildPlan(trip(), items);
    expect(plan.nights).toEqual({ total: 10, booked: 4, chosen: 0, open: 6 });
    expect(plan.stayBlocks.map((b) => [b.kind, b.range.start, b.range.end])).toEqual([
      ["open", "2026-10-07", "2026-10-10"],
      ["booked", "2026-10-10", "2026-10-14"],
      ["open", "2026-10-14", "2026-10-17"],
    ]);
    const [first, , last] = plan.stayBlocks;
    // Late Inn (8–10) overlaps Jardim and Casa (7–10) in Porto: one decision over 7–10, compared per night.
    expect(names(first)).toEqual([["Jardim Stay", "Casa Azul", "Late Inn"]]);
    expect(first.city).toBe("Porto");
    // Nothing saved for the last three nights: say so, and link a search with the right dates.
    expect(names(last)).toEqual([]);
    expect(last.kind === "open" && last.searchUrl).toContain("checkin=2026-10-14&checkout=2026-10-17");
    expect(plan.closed.map((c) => c.item.name)).toEqual(["Clash Suites", "Other Funchal"]);
    expect(plan.closed[0].reason).toContain("FAA Rentals");
  });

  it("brings the closed options back when the booking is undone (nothing was deleted)", () => {
    const { faa, items } = example();
    const plan = buildPlan(trip(), items.map((i) => (i === faa ? { ...i, status: "saved" as const } : i)));
    expect(plan.closed).toEqual([]);
    expect(plan.stayBlocks.map((b) => b.kind)).toEqual(["open"]);
    // Clash Suites (Funchal 9–12) overlaps FAA (10–14) in the same city: they're one decision now.
    const funchal = liveGroups(plan).find((g) => g.items.some((i) => i.id === faa.id))!;
    expect([funchal.key, funchal.items.map((i) => i.name).sort()]).toEqual(["stay@2026-10-09_2026-10-14", ["Clash Suites", "FAA Rentals", "Other Funchal"]]);
  });

  it("keeps a choice with its alternatives and opens the transfer between cities", () => {
    const jardim = stay("Jardim Stay", "2026-10-07", "2026-10-10", "chosen");
    const items = [
      jardim,
      stay("Casa Azul", "2026-10-07", "2026-10-10"),
      stay("Late Inn", "2026-10-08", "2026-10-10"),
      stay("FAA Rentals", "2026-10-10", "2026-10-14", "booked", "Funchal"),
    ];
    const plan = buildPlan(trip(), items);
    const chosen = plan.stayBlocks[0];
    expect(chosen.kind).toBe("chosen");
    expect(names(chosen)).toEqual([["Jardim Stay", "Casa Azul", "Late Inn"]]);
    const move = buildLegs(plan, trip()).find((l) => l.kind === "move")!;
    expect([move.date, move.from.label, move.to.label, move.status]).toEqual(["2026-10-10", "Jardim Stay", "FAA Rentals", "empty"]);
    // A flight saved for that day is its option, with the airport transfers on both sides.
    const covered = buildLegs(buildPlan(trip(), [...items, flight("TAP", "OPO", "FNC", "2026-10-10")]), trip());
    expect(covered.filter((l) => l.date === "2026-10-10").map((l) => `${l.kind} ${l.status}`)).toEqual(["departure empty", "move options", "arrival empty"]);
  });

  it("warns about overlapping bookings", () => {
    const plan = buildPlan(trip(), [
      stay("A", "2026-10-07", "2026-10-10", "booked"),
      stay("B", "2026-10-09", "2026-10-11", "booked"),
    ]);
    expect(plan.notices.map((n) => n.text)).toEqual(["9–10 Ekim (1 gece) için iki rezervasyon var: A ve B"]);
  });

  it("derives the nights from booked flights, not alternatives, when no dates were confirmed", () => {
    const items = [
      flight("Out", "IST", "OPO", "2026-10-07", "booked"),
      flight("Back", "FNC", "IST", "2026-10-17", "booked"),
      flight("Earlier out", "IST", "OPO", "2026-10-06"),
    ];
    expect(tripRange(trip({ confirmedDates: null }), items)).toEqual({ start: "2026-10-07", end: "2026-10-17" });
    const undecided = items.map((i) => ({ ...i, status: "saved" as const }));
    expect(tripRange(trip({ confirmedDates: null }), undecided)).toEqual({ start: "2026-10-06", end: "2026-10-17" });
    // Even with nothing saved for them yet, the nights show as open.
    const plan = buildPlan(trip({ confirmedDates: null }), items);
    expect(plan.stayBlocks).toHaveLength(1);
    expect(plan.stayBlocks[0].kind).toBe("open");
  });

  it("puts undated stays and stays outside the trip aside, and never trusts broken dates", () => {
    const plan = buildPlan(trip(), [
      stay("No dates", null as never, null as never),
      stay("Next month", "2026-11-03", "2026-11-05"),
      stay("Reversed", "2026-10-12", "2026-10-09"),
      stay("Booked after", "2026-10-17", "2026-10-19", "booked"),
    ]);
    expect(plan.looseStays.map((g) => g.items.map((i) => i.name))).toEqual([["Next month"], ["No dates", "Reversed"]]);
    // A booking outside the given dates widens the trip rather than disappearing.
    expect(plan.range).toEqual({ start: "2026-10-07", end: "2026-10-19" });
    expect(plan.stayBlocks.at(-1)!.kind).toBe("booked");
    expect(tripRange(trip({ confirmedDates: { start: "2026-01-01", end: "2027-06-01" } }), [])).toBeNull();
  });

  it("compares a stay saved without dates (any site) with the others for its city's open nights", () => {
    const booking = stay("Impar Studios", "2026-10-07", "2026-10-10");
    const gallery = stay("The Gallery", "2026-10-07", "2026-10-10");
    const airbnb = item("Airbnb loft", { provider: "Airbnb", url: "https://www.airbnb.com.tr/rooms/42" });
    const funchal = stay("FAA Rentals", "2026-10-10", "2026-10-14", "booked", "Funchal");
    const plan = buildPlan(trip({ confirmedDates: { start: "2026-10-07", end: "2026-10-14" } }), [booking, gallery, airbnb, funchal]);
    const porto = plan.stayBlocks[0];
    expect(porto.kind).toBe("open");
    expect(names(porto)).toEqual([["Impar Studios", "The Gallery", "Airbnb loft"]]);
    expect(plan.looseStays).toEqual([]);
    // Ranked together: one comparison for those nights, whichever site each came from.
    const d = decideTrip([booking, gallery, airbnb, funchal], makeContext(trip(), [booking, gallery, airbnb, funchal])).get("stay@2026-10-07_2026-10-10")!;
    expect(d.options.map((o) => o.item.name).sort()).toEqual(["Airbnb loft", "Impar Studios", "The Gallery"]);
  });

  it("keeps an undated stay aside when its city has more than one open stretch (which nights is unclear)", () => {
    const early = stay("Early", "2026-10-07", "2026-10-09");
    const late = stay("Late", "2026-10-12", "2026-10-14");
    const middle = stay("Madeira", "2026-10-09", "2026-10-12", "booked", "Funchal");
    const undated = item("Airbnb loft", { provider: "Airbnb" });
    const plan = buildPlan(trip({ confirmedDates: { start: "2026-10-07", end: "2026-10-14" } }), [early, late, middle, undated]);
    expect(plan.looseStays.map((g) => g.items.map((i) => i.name))).toEqual([["Airbnb loft"]]);
  });

  it("closes a booked flight leg's alternatives but not other legs", () => {
    const plan = buildPlan(trip(), [
      flight("SAS A", "IST", "CPH", "2026-10-07", "booked"),
      flight("SAS B", "IST", "CPH", "2026-10-07"),
      flight("TAP 1", "CPH", "OPO", "2026-10-07"),
      flight("TAP 2", "CPH", "OPO", "2026-10-07"),
    ]);
    expect(plan.closed.map((c) => [c.item.name, c.reason])).toEqual([["SAS B", "SAS A rezerve edildi"]]);
    expect(plan.groups.map((g) => [g.title, g.items.map((i) => i.name), g.booked?.name ?? null])).toEqual([
      ["7 Ekim · CPH → OPO", ["TAP 1", "TAP 2"], null],
      ["7 Ekim · IST → CPH", ["SAS A"], "SAS A"],
    ]);
    expect(liveGroups(plan).map((g) => g.key)).toEqual(["flight:cph-opo"]);
  });
});

describe("decisions follow the plan", () => {
  it("ranks only open needs, stays with overlapping nights together (per night), never booked or closed options", () => {
    const items = [
      stay("Jardim Stay", "2026-10-07", "2026-10-10"),
      stay("Casa Azul", "2026-10-07", "2026-10-10"),
      stay("Late Inn", "2026-10-08", "2026-10-10"),
      stay("FAA Rentals", "2026-10-10", "2026-10-14", "booked", "Funchal"),
      stay("Other Funchal", "2026-10-10", "2026-10-14", "saved", "Funchal"),
    ];
    const decisions = decideTrip(items, makeContext(trip(), items));
    expect([...decisions.keys()]).toEqual(["stay@2026-10-07_2026-10-10"]);
    const porto = decisions.get("stay@2026-10-07_2026-10-10")!;
    expect(porto.options.map((o) => o.item.name).sort()).toEqual(["Casa Azul", "Jardim Stay", "Late Inn"]);
    // Late Inn covers 2 of the 3 nights: its €200 counts as €100 a night, €300 over the three.
    const late = porto.options.find((o) => o.item.name === "Late Inn")!;
    expect(late.coverage).toMatchObject({ nights: 2, of: 3 });
    expect(late.parts.find((p) => p.criterion === "price")).toMatchObject({ value: 300, display: "€100/gece · 3 geceye göre €300" });
    expect(porto.options.find((o) => o.item.name === "Jardim Stay")!.coverage).toBeNull();
  });
});

describe("the same stay need, whatever the site or language", () => {
  const lisbonTrip = trip({ confirmedDates: { start: "2026-10-08", end: "2026-10-12" } });
  const geo = (lat: number, lng: number) => ({ lat, lng, source: "page" as const });

  it("names a city the same in every language", () => {
    expect(["Lisbon", "Lisboa", "Lizbon", " LISBOA "].map(cityKeyOf)).toEqual(["lizbon", "lizbon", "lizbon", "lizbon"]);
    expect(cityKeyOf("København")).toBe(cityKeyOf("Copenhagen"));
    expect(cityKeyOf("İstanbul")).toBe(cityKeyOf("Istanbul"));
    expect(cityKeyOf("Porto")).not.toBe(cityKeyOf("Lizbon"));
  });

  it("puts an Airbnb for overlapping nights in the same list as the hotels", () => {
    const items = [
      stay("Tesouro da Baixa", "2026-10-08", "2026-10-12", "saved", "Lizbon"),
      stay("Alfama Suites", "2026-10-08", "2026-10-12", "saved", "Lizbon"),
      { ...stay("Airbnb Loft", "2026-10-09", "2026-10-12", "saved", "Lisbon"), provider: "Airbnb" },
    ];
    const plan = buildPlan(lisbonTrip, items);
    expect(liveGroups(plan).map((g) => [g.key, g.items.map((i) => i.name)])).toEqual([
      ["stay@2026-10-08_2026-10-12", ["Tesouro da Baixa", "Alfama Suites", "Airbnb Loft"]],
    ]);
  });

  it("joins an undated Airbnb whose page says 'Lisbon' to the 'Lizbon' nights", () => {
    const items = [
      stay("Tesouro da Baixa", "2026-10-08", "2026-10-12", "saved", "Lizbon"),
      item("Airbnb Loft", { city: "Lisbon", needKey: "stay:lisbon", provider: "Airbnb" }),
    ];
    const plan = buildPlan(lisbonTrip, items);
    expect(plan.looseStays).toEqual([]);
    expect(liveGroups(plan)[0].items.map((i) => i.name)).toEqual(["Tesouro da Baixa", "Airbnb Loft"]);
  });

  it("treats places across the river as the same place, and other cities as another need", () => {
    const items = [
      { ...stay("Jardim Stay", "2026-10-08", "2026-10-12"), geo: geo(41.1455, -8.611) },
      { ...stay("Gaia Flat", "2026-10-08", "2026-10-11", "saved", "Vila Nova de Gaia"), geo: geo(41.1335, -8.6174) },
      { ...stay("Braga Inn", "2026-10-10", "2026-10-12", "saved", "Braga"), geo: geo(41.5454, -8.4265) },
    ];
    const plan = buildPlan(lisbonTrip, items);
    expect(liveGroups(plan).map((g) => g.items.map((i) => i.name).sort())).toEqual([["Gaia Flat", "Jardim Stay"], ["Braga Inn"]]);
  });
});

describe("edge cases the random-trip test found", () => {
  it("keeps a booking that lies inside another booking's nights on the board, with the clash noted", () => {
    const outer = stay("Outer Hotel", "2026-10-07", "2026-10-12", "booked");
    const inner = stay("Inner Flat", "2026-10-08", "2026-10-10", "booked");
    const plan = buildPlan(trip(), [outer, inner]);
    const block = plan.stayBlocks.find((b) => b.kind === "booked")!;
    expect(block.kind === "booked" && [block.item.name, ...(block.clashes ?? []).map((i) => i.name)]).toEqual(["Outer Hotel", "Inner Flat"]);
    expect(plan.notices[0].text).toMatch(/iki rezervasyon var: Outer Hotel ve Inner Flat/);
  });

  it("closes a stay said in the chat once a saved page is booked for those nights, and shows it only there", () => {
    const said = { ...stay("Konaklama · Porto", "2026-10-07", "2026-10-10", "booked"), origin: "chat" as const };
    const real = stay("Jardim Stay", "2026-10-07", "2026-10-10", "booked");
    const plan = buildPlan(trip(), [said, real]);
    expect(plan.stayBlocks.filter((b) => b.kind === "booked").map((b) => b.kind === "booked" && b.item.name)).toEqual(["Jardim Stay"]);
    expect(plan.closed.map((c) => [c.item.name, c.reason])).toEqual([["Konaklama · Porto", "Yerine Jardim Stay geldi"]]);
    expect(plan.notices).toEqual([]);
  });

  it("gives groups for the same nights in different places their own keys", () => {
    const plan = buildPlan(trip(), [
      stay("Funchal A", "2026-10-07", "2026-10-09", "saved", "Funchal"),
      stay("Funchal B", "2026-10-08", "2026-10-10", "saved", "Funchal"),
      stay("Braga C", "2026-10-07", "2026-10-10", "saved", "Braga"),
    ]);
    const keys = liveGroups(plan).map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["stay@2026-10-07_2026-10-10", "stay@2026-10-07_2026-10-10#braga"]);
  });
});


describe("plan: nights said apart in the chat", () => {
  const dates = trip({ confirmedDates: { start: "2026-10-07", end: "2026-10-11" } });
  const said = (start: string, end: string, at: number, city = "Porto") => ({
    ...stay(`Konaklama · ${city}`, start, end, "chosen", city), origin: "chat" as const, plannedKind: "stay" as const, createdAt: at, updatedAt: at,
  });
  const chosen = (name: string, start: string, end: string, at: number) => ({ ...stay(name, start, end, "chosen"), statusAt: at });
  const layout = (items: Item[]) =>
    buildPlan(dates, items).stayBlocks.map((b) => [b.kind, b.range.start, b.range.end, b.kind === "open" ? (b.slot?.name ?? null) : b.item.name]);

  // "7 bir gecelik başka bir otel koy", said after choosing a place for 7–11.
  it("opens those nights on their own, empty; the place chosen before keeps the rest", () => {
    const teras = chosen("Büyük TERAS", "2026-10-07", "2026-10-11", 10);
    const night = said("2026-10-07", "2026-10-08", 20);
    expect(layout([teras, night])).toEqual([
      ["open", "2026-10-07", "2026-10-08", "Konaklama · Porto"],
      ["chosen", "2026-10-08", "2026-10-11", "Büyük TERAS"],
    ]);
    const plan = buildPlan(dates, [teras, night]);
    expect(plan.stayBlocks[0].city).toBe("Porto");
    expect(plan.nights).toMatchObject({ chosen: 3, open: 1 });
    // A place saved for that night is an option there, not a choice.
    const impar = stay("Impar Studios", "2026-10-07", "2026-10-08");
    expect(names(buildPlan(dates, [teras, night, impar]).stayBlocks[0])).toEqual([["Impar Studios"]]);
    // Picked, it fills the night; the said stay has done its job.
    const picked = { ...impar, status: "chosen" as const, statusAt: 30 };
    expect(layout([teras, night, picked])).toEqual([
      ["chosen", "2026-10-07", "2026-10-08", "Impar Studios"],
      ["chosen", "2026-10-08", "2026-10-11", "Büyük TERAS"],
    ]);
    expect(buildPlan(dates, [teras, night, picked]).closed.map((c) => [c.item.name, c.reason])).toEqual([["Konaklama · Porto", "Yerine Impar Studios geldi"]]);
    // Choosing the first place again (after the night was said) takes the night back.
    expect(layout([{ ...teras, statusAt: 40 }, night])).toEqual([["chosen", "2026-10-07", "2026-10-11", "Büyük TERAS"]]);
  });

  it("a page chosen after the stay was said fills it, whatever its nights", () => {
    const funchal = said("2026-10-07", "2026-10-11", 10);
    expect(layout([funchal, chosen("Villa", "2026-10-07", "2026-10-11", 20)])).toEqual([["chosen", "2026-10-07", "2026-10-11", "Villa"]]);
    // For some of the nights: still one stay (as said), the nights it leaves marked to fill.
    const partly = buildPlan(dates, [funchal, chosen("Villa", "2026-10-07", "2026-10-09", 5)]);
    expect(partly.stayBlocks.map((b) => [b.kind, b.range.start, b.range.end, b.kind === "chosen" ? [b.item.name, b.gap] : null])).toEqual([
      ["chosen", "2026-10-07", "2026-10-11", ["Villa", [{ start: "2026-10-09", end: "2026-10-11" }]]],
    ]);
    expect(partly.nights).toMatchObject({ chosen: 2, open: 2 });
  });

  it("the latest choice takes the nights two choices share", () => {
    expect(layout([chosen("Loft", "2026-10-07", "2026-10-11", 10), chosen("Airport Inn", "2026-10-07", "2026-10-08", 20)])).toEqual([
      ["chosen", "2026-10-07", "2026-10-08", "Airport Inn"],
      ["chosen", "2026-10-08", "2026-10-11", "Loft"],
    ]);
  });
});

describe("a booking takes the place of the plan for the same thing (0.36.24, Emre's Porto boat)", () => {
  const act = (name: string, status: ItemStatus, day: string | null, over: Partial<Item> = {}) =>
    makeItem({ name, category: "activity", status, city: "Porto", needKey: `activity:${name}`, dates: { start: day, end: null, source: "page" }, ...over });
  it("the River Party Boat booked: the Douro boat tour planned that day leaves the plan, with the reason", () => {
    const booked = act("Douro River Party Boat", "booked", "2026-10-09");
    const planned = act("Douro nehri tekne turu", "chosen", "2026-10-09");
    const plan = buildPlan(trip(), [booked, planned]);
    expect(plan.closed.map((c) => [c.item.name, c.reason, c.by])).toEqual([["Douro nehri tekne turu", "Yerine Douro River Party Boat geldi", booked.id]]);
  });
  it("an idea for it with no day goes too; another kind or another day stays", () => {
    const booked = act("Douro River Party Boat", "booked", "2026-10-09");
    const idea = act("Rabelo boat cruise", "saved", null);
    const show = act("Fado show", "chosen", "2026-10-09");
    const later = act("Sunset sailing", "chosen", "2026-10-11");
    const plan = buildPlan(trip(), [booked, idea, show, later]);
    expect(plan.closed.map((c) => c.item.name)).toEqual(["Rabelo boat cruise"]);
  });
  it("two bookings both stay (nothing booked is taken away)", () => {
    const plan = buildPlan(trip(), [act("Douro River Party Boat", "booked", "2026-10-09"), act("Rabelo tekne turu", "booked", "2026-10-09")]);
    expect(plan.closed).toEqual([]);
  });
});

describe("per-person bookings don't close each other (kişiye özel rezervasyon)", () => {
  const fl = (id: string, who: string[] | undefined, status: ItemStatus) =>
    makeItem({ id, name: `${id} flight`, category: "flight", status, needKey: "flight:ist-opo", forWho: who, dates: { start: "2026-10-08", end: null, source: "page" }, flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: null, flightNumber: null, stops: 0 } });
  it("Emre's flight booked leaves Sabine's chosen one on the plan, a group of its own", () => {
    const plan = buildPlan(trip(), [fl("emre", ["Emre"], "booked"), fl("sabine", ["Sabine"], "chosen")]);
    expect(plan.closed).toEqual([]);
    const flights = plan.groups.filter((g) => g.category === "flight");
    expect(flights.map((g) => [g.items.map((i) => i.id), g.booked?.id ?? null])).toEqual([[["emre"], "emre"], [["sabine"], null]]);
  });
  it("one for everyone still closes like before; the same person's other option too", () => {
    expect(buildPlan(trip(), [fl("emre", ["Emre"], "booked"), fl("all", undefined, "saved")]).closed.map((c) => c.item.id)).toEqual(["all"]);
    expect(buildPlan(trip(), [fl("emre", ["Emre"], "booked"), fl("emre2", ["emre"], "saved")]).closed.map((c) => c.item.id)).toEqual(["emre2"]);
  });
  it("a booked boat for Emre doesn't take Sabine's boat off the plan", () => {
    const boat = (id: string, who: string[], status: ItemStatus) =>
      makeItem({ id, name: `Douro tekne turu ${id}`, category: "activity", city: "Porto", status, forWho: who, dates: { start: "2026-10-09", end: null, source: "page" } });
    expect(buildPlan(trip(), [boat("e", ["Emre"], "booked"), boat("s", ["Sabine"], "chosen")]).closed).toEqual([]);
  });
});
