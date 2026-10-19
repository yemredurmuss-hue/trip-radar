// 0.38.9 (T1): Emre's İstanbul → Mısır. The start made "İstanbul → Mısır", "Mısır → İstanbul" and "Konaklama · Mısır";
// then the place turned out Şarm El-Şeyh: the offers came for IST → SSH and hotels in Şarm, each a box of its own. The
// way out and home are slots (from home at the start, to home at the end) whatever the end says, a hotel in Şarm is an
// option of the stay said for Mısır, and the start's places take Şarm once the trip names it.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { addOffer } from "../src/app/actions";
import { airportCityOf, countryCodeNamed, countryOfCity } from "../src/lib/airports";
import { categorize } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { setLang } from "../src/lib/i18n";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import { offerItem, type Need, type Offer } from "../src/lib/offerSource";
import { buildPlan } from "../src/lib/plan";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { applyAnswer, applyText, creationOf, isPlaceholder, narrowPlaceholders, newStart, parseStartText, type StartState } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";

setLang("tr");
const TODAY = "2026-10-19";

async function create(dated = true): Promise<Trip> {
  const line = dated ? "Mısır'a 1 hafta gitmek istiyorum" : "Mısır'a gitmek istiyorum";
  let s: StartState = newStart(`s-${Math.random()}`, "plan", 1, "tr");
  s = { ...s, messages: [{ role: "user", text: line, at: 1 }] };
  s = applyText(s, line, parseStartText(line, TODAY, "where"), 2, "where").state;
  s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
  if (dated) s = applyAnswer(s, { q: "start", date: "2026-12-01", approx: false }, 4);
  s = applyAnswer(s, { q: "want", styles: ["romantic"], budget: null }, 5);
  for (const step of stepsFor(s, creationOf(s)!)) {
    const { tripId } = await runStep(step.id, s, { provider: "gemini" });
    if (step.id === "trip") s = { ...s, tripId };
  }
  return (await (await db()).get("trips", s.tripId!))!;
}

const flightNeed = (from: string, to: string, start: string, fromCode: string, toCode: string): Need => ({
  key: `flight:${from}:${to}:${start}`, section: "flight", kind: "flight", from, to, start, adults: 1, fromCode, toCode,
});
const flightOffer = (id: string, fromCode: string, toCode: string): Offer => ({
  id, kind: "flight", title: "Pegasus", url: `https://www.aviasales.com/search/${id}`, why: "", source: "Aviasales", fetchedAt: 1, carrier: "Pegasus", fromCode, toCode, depart: "08:00", arrive: "10:00",
});
const stayNeed: Need = { key: "stay:2026-12-01_2026-12-08:sarm", section: "stay", kind: "stay", city: "Şarm El-Şeyh", start: "2026-12-01", end: "2026-12-08", adults: 1 };
const hotel = (id: string): Offer => ({ id, kind: "stay", title: `Otel ${id}`, url: `https://www.booking.com/hotel/eg/${id}.html`, why: "", source: "Booking", fetchedAt: 1, price: 500, currency: "EUR", nights: 7 });

/** What came for Şarm: two flights there (the chat's, the row's), one home, two hotels. */
const offers: [Offer, Need][] = [
  [flightOffer("ist", "IST", "SSH"), flightNeed("İstanbul", "Şarm El-Şeyh", "2026-12-01", "IST", "SSH")],
  [flightOffer("saw", "SAW", "SSH"), flightNeed("İstanbul", "SSH", "2026-12-01", "SAW", "SSH")],
  [flightOffer("home", "SSH", "IST"), flightNeed("Şarm El-Şeyh", "İstanbul", "2026-12-08", "SSH", "IST")],
  [hotel("h1"), stayNeed],
  [hotel("h2"), { ...stayNeed, city: "Sharm El Sheikh" }],
];

/** The offers saved as they are, the start's places left as made (the plan's reading alone). */
async function saveRaw(trip: Trip, list = offers): Promise<Item[]> {
  const d = await db();
  for (const [o, n] of list) await d.put("items", { ...offerItem(o, n, trip.id, `${trip.id}-${o.id}`, Date.now()), forNeed: n.key });
  return listItems(trip.id);
}

function boxes(trip: Trip, items: Item[]) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx };
  const of = (id: string) => collectionsOf(input).find((c) => c.section.id === id)?.intents ?? [];
  return { plan, flights: of("flight"), stays: of("stay") };
}

describe("Emre's Mısır: the way out, home and the stay by slot, not by name", () => {
  it("an airport's city in Turkish is the airport's; a country by its name; a city's country by its airport", () => {
    expect(airportCityOf("Şarm El-Şeyh")).toBe("Sharm El Sheikh");
    expect(airportCityOf("SSH")).toBe("Sharm El Sheikh");
    expect(airportCityOf("Canggu")).toBeNull();
    expect(countryCodeNamed("Mısır")).toBe("EG");
    expect(countryCodeNamed("Egypt")).toBe("EG");
    expect(countryCodeNamed("Şarm El-Şeyh")).toBeNull();
    expect(countryOfCity("Şarm El-Şeyh")).toBe("EG");
    expect(countryOfCity("SSH")).toBe("EG");
  });

  it("before the start's places take Şarm: one box out, one home, one stay; the offers are their options", async () => {
    const trip = await create();
    const items = await saveRaw(trip);
    const { plan, flights, stays } = boxes(trip, items);
    const flightGroups = plan.groups.filter((g) => g.category === "flight");
    expect(flightGroups).toHaveLength(2);
    expect(flightGroups[0].items.map((i) => i.id).sort()).toEqual(expect.arrayContaining([`${trip.id}-ist`, `${trip.id}-saw`]));
    expect(flightGroups[1].items.map((i) => i.id)).toContain(`${trip.id}-home`);
    expect(flights).toHaveLength(2);
    expect(flights.map((f) => f.options.length)).toEqual([2, 1]);
    expect(stays).toHaveLength(1);
    expect(stays[0].options.map((o) => o.id).sort()).toEqual([`${trip.id}-h1`, `${trip.id}-h2`]);
  });

  it("an undated start: the hotels in Şarm are options of the stay said for Mısır, no box of their own", async () => {
    const trip = await create(false);
    const items = await saveRaw(trip);
    const { plan, stays } = boxes(trip, items);
    expect(plan.looseStays).toHaveLength(0);
    expect(stays).toHaveLength(1);
    expect(stays[0].options.map((o) => o.id).sort()).toEqual([`${trip.id}-h1`, `${trip.id}-h2`]);
  });

  it("the offers added: the start's places become İstanbul → Şarm El-Şeyh, still places to fill", async () => {
    const trip0 = await create();
    for (const [o, n] of offers) await addOffer(trip0.id, o, n);
    const trip = (await (await db()).get("trips", trip0.id))!;
    const items = await listItems(trip.id);
    const made = items.filter((i) => isPlaceholder(trip, i));
    expect(made.map((i) => i.name).sort()).toEqual(["Konaklama · Şarm El-Şeyh", "Uçuş · Şarm El-Şeyh → İstanbul", "Uçuş · İstanbul → Şarm El-Şeyh"].sort());
    const { flights, stays } = boxes(trip, items);
    expect(flights.map((f) => f.head.name)).toEqual(["İstanbul → Şarm El-Şeyh", "Şarm El-Şeyh → İstanbul"]);
    expect(flights.map((f) => f.options.length)).toEqual([2, 1]);
    expect(stays.map((s) => [s.head.name, s.options.length])).toEqual([["Şarm El-Şeyh", 2]]);
  });

  it("a flight inside the trip keeps its own way; a country with two cities named stays as it is; own records never change", async () => {
    const trip = await create();
    const inner: [Offer, Need] = [flightOffer("cai", "SSH", "CAI"), flightNeed("Şarm El-Şeyh", "Kahire", "2026-12-04", "SSH", "CAI")];
    const items = await saveRaw(trip, [...offers, inner]);
    const groups = buildPlan(trip, items).groups.filter((g) => g.category === "flight");
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.items.some((i) => i.id === `${trip.id}-cai`))!.items).toHaveLength(1);
    // Şarm and Kahire: nothing narrows.
    expect(narrowPlaceholders(trip, items).items).toHaveLength(0);
    // Şarm only: the start's three places change, the offers don't.
    const one = narrowPlaceholders(trip, items.filter((i) => i.id !== `${trip.id}-cai`));
    expect(one.items).toHaveLength(3);
    expect(one.items.every((i) => trip.startGuide!.placeholders![i.id] != null)).toBe(true);
  });
});
