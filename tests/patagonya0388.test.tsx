// 0.38.8 (U3): Emre's Patagonya (İstanbul → Buenos Aires, then Ushuaia and El Calafate, home). "Uçuş kartı yine yeni ekledi,
// omurganın dışında; öneri buraya yeni olarak geldi, halbuki orada update olması lazımdı. Üçüncü bir uçuş olarak ekledi":
// an offer said by its airports' codes (AEP → USH) was a box of its own, as the table named no city for them. The table
// knows them now, and an offer added for a box is bound to it (forNeed): a code no table knows ("XXX") still lands there.
// "Bileti al'ın yanında o logo işareti gelmiyor; o yuvarlak şeyin logo olması lazım": the button's mark is the airline's logo.
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { addOffer, chooseItem, fillOffer } from "../src/app/actions";
import { CardEnvContext, type CardEnv } from "../src/app/cards/PlanCard";
import { FrameTicket } from "../src/app/plan/v82/FrameTicket";
import { V82EnvContext, type V82Env } from "../src/app/plan/v82/v82Env";
import { airportCityOf, countryOfAirport } from "../src/lib/airports";
import { categorize } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { journeyChapters } from "../src/lib/journeyChapters";
import { setLang } from "../src/lib/i18n";
import { collectionsOf, type IntentInput, type IntentVM } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import type { Need, Offer } from "../src/lib/offerSource";
import { buildPlan, flightNeeds } from "../src/lib/plan";
import { plannedItem, type PlannedInput } from "../src/lib/planned";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";

setLang("tr");
const TODAY = "2026-10-19";

const plan = (tripId: string, id: string, over: Partial<PlannedInput>): Item =>
  plannedItem({ kind: "flight", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...over }, tripId, id, 1);

/** The trip as the start leaves it: three stays, the way out, two flights inside Argentina and the way home, all places. */
async function create(): Promise<Trip> {
  const id = `pat-${Math.random()}`;
  const trip: Trip = { id, title: "Patagonya", confirmedDates: { start: "2026-12-01", end: "2026-12-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, travellers: { names: [], count: 2 } };
  const items = [
    plan(id, "f-out", { date: "2026-12-01", from: "İstanbul", to: "Buenos Aires", city: "Buenos Aires" }),
    plan(id, "f-ush", { date: "2026-12-05", from: "Buenos Aires", to: "Ushuaia", city: "Ushuaia" }),
    plan(id, "f-fte", { date: "2026-12-09", from: "Ushuaia", to: "El Calafate", city: "El Calafate" }),
    plan(id, "f-home", { date: "2026-12-14", from: "El Calafate", to: "İstanbul", city: "İstanbul" }),
    plan(id, "s-bue", { kind: "stay", date: "2026-12-01", end_date: "2026-12-05", city: "Buenos Aires" }),
    plan(id, "s-ush", { kind: "stay", date: "2026-12-05", end_date: "2026-12-09", city: "Ushuaia" }),
    plan(id, "s-fte", { kind: "stay", date: "2026-12-09", end_date: "2026-12-14", city: "El Calafate" }),
  ];
  const d = await db();
  await d.put("trips", trip);
  for (const i of items) await d.put("items", { ...i, countryCode: i.category === "stay" ? "AR" : null });
  return trip;
}

function inputOf(trip: Trip, items: Item[]) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const p = buildPlan(trip, items);
  const legs = buildLegs(p, trip);
  const timeline = buildTimeline(p, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: false, empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan: p, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan: p, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx };
  return { input, timeline };
}
const flights = (trip: Trip, items: Item[]): IntentVM[] => collectionsOf(inputOf(trip, items).input).find((c) => c.section.id === "flight")?.intents ?? [];

// The need a box asks with (intentFrame.offerNeed): its route's cities and its day.
const need = (from: string, to: string, start: string, fromCode: string, toCode: string): Need => ({
  key: `flight:${from.toLocaleLowerCase("tr")}:${to.toLocaleLowerCase("tr")}:${start}`, section: "flight", kind: "flight", from, to, start, adults: 2, fromCode, toCode,
});
const offer = (id: string, carrier: string, fromCode: string, toCode: string): Offer => ({
  id, kind: "flight", title: carrier, url: `https://www.aviasales.com/search/${fromCode}${toCode}?${id}`, why: "", source: "Aviasales", fetchedAt: 1, price: 300, currency: "EUR",
  carrier, depart: "08:10", arrive: "11:45", fromCode, toCode, stops: 0,
});

const NEEDS = {
  out: need("İstanbul", "Buenos Aires", "2026-12-01", "IST", "EZE"),
  ush: need("Buenos Aires", "Ushuaia", "2026-12-05", "AEP", "USH"),
  fte: need("Ushuaia", "El Calafate", "2026-12-09", "USH", "FTE"),
  home: need("El Calafate", "İstanbul", "2026-12-14", "FTE", "IST"),
};

/** Two or three offers per box, said by the source's codes. */
async function addAll(trip: Trip) {
  const t = trip.id;
  return {
    out: [await addOffer(t, offer("o1", "Turkish Airlines", "IST", "EZE"), NEEDS.out), await addOffer(t, offer("o2", "Qatar Airways", "IST", "EZE"), NEEDS.out)],
    ush: [
      await addOffer(t, offer("u1", "Aerolíneas Argentinas", "AEP", "USH"), NEEDS.ush),
      await addOffer(t, offer("u2", "Flybondi", "AEP", "USH"), NEEDS.ush),
      await addOffer(t, offer("u3", "JetSMART", "EZE", "USH"), NEEDS.ush),
    ],
    fte: [await addOffer(t, offer("c1", "Aerolíneas Argentinas", "USH", "FTE"), NEEDS.fte), await addOffer(t, offer("c2", "LATAM", "USH", "FTE"), NEEDS.fte)],
    home: [await addOffer(t, offer("h1", "Turkish Airlines", "FTE", "IST"), NEEDS.home), await addOffer(t, offer("h2", "LATAM", "FTE", "IST"), NEEDS.home)],
  };
}

const ids = (list: Item[]) => list.map((i) => i.id).sort();
const box = (intents: IntentVM[], placeholder: string) => intents.find((i) => i.itemIds.includes(placeholder));
const optionIds = (vm: IntentVM | undefined) => (vm?.options ?? []).map((o) => o.id).sort();

describe("Emre's Patagonya: each flight one box, the offers its options", () => {
  it("Argentina's and Chile's airports name their cities", () => {
    expect(airportCityOf("AEP")).toBe("Buenos Aires");
    expect(airportCityOf("EZE")).toBe("Buenos Aires");
    expect(airportCityOf("Aeroparque")).toBe("Buenos Aires");
    expect(airportCityOf("USH")).toBe("Ushuaia");
    expect(airportCityOf("FTE")).toBe("El Calafate");
    expect(airportCityOf("BRC")).toBe("Bariloche");
    expect(airportCityOf("PUQ")).toBe("Punta Arenas");
    expect(airportCityOf("PNT")).toBe("Puerto Natales");
    expect(airportCityOf("SCL")).toBe("Santiago");
    expect(countryOfAirport("USH")).toBe("AR");
    expect(countryOfAirport("PUQ")).toBe("CL");
    expect(airportCityOf("XXX")).toBeNull();
  });

  it("two or three offers per box by their codes: still four boxes, each offer under its own", async () => {
    const trip = await create();
    const before = flights(trip, await listItems(trip.id));
    expect(before).toHaveLength(4);
    const added = await addAll(trip);
    const after = flights(trip, await listItems(trip.id));
    expect(after).toHaveLength(4);
    expect(after.map((i) => i.key).sort()).toEqual(before.map((i) => i.key).sort());
    // Each box holds its placeholder and its own offers, nothing of another way (the way out and home, the flights inside).
    expect(optionIds(box(after, "f-out"))).toEqual(expect.arrayContaining(ids(added.out)));
    expect(optionIds(box(after, "f-ush"))).toEqual(expect.arrayContaining(ids(added.ush)));
    expect(optionIds(box(after, "f-fte"))).toEqual(expect.arrayContaining(ids(added.fte)));
    expect(optionIds(box(after, "f-home"))).toEqual(expect.arrayContaining(ids(added.home)));
    const all = after.flatMap((i) => i.itemIds);
    expect(all.length).toBe(new Set(all).size);
  });

  it("an airport no table knows (XXX), bound by the box it was added from: the same box, no new one", async () => {
    const trip = await create();
    const odd = await addOffer(trip.id, offer("x1", "Aerolíneas Argentinas", "XXX", "USH"), NEEDS.ush);
    expect(odd.forNeed).toBe(NEEDS.ush.key);
    const items = await listItems(trip.id);
    const after = flights(trip, items);
    expect(after).toHaveLength(4);
    expect(box(after, "f-ush")?.itemIds).toContain(odd.id);
    // Without the bond it would be a box of its own (what 0.38.7 did with AEP → USH).
    const loose = items.map(({ forNeed: _bond, ...i }) => i);
    expect(flights(trip, loose)).toHaveLength(5);
    // The need groups say it too.
    const byNeed = new Map<string, Item[]>();
    for (const i of items.filter((x) => x.category === "flight")) byNeed.set(i.needKey, [...(byNeed.get(i.needKey) ?? []), i]);
    expect(flightNeeds(byNeed)).toHaveLength(4);
  });

  it("a bond to a need said nowhere else (a region) leaves the offer its own ends", async () => {
    const trip = await create();
    const region = await addOffer(trip.id, offer("r1", "Aerolíneas Argentinas", "AEP", "USH"), { ...NEEDS.ush, key: "flight:buenos aires:patagonya:2026-12-05", to: "Patagonya" });
    const after = flights(trip, await listItems(trip.id));
    expect(after).toHaveLength(4);
    expect(box(after, "f-ush")?.itemIds).toContain(region.id);
  });

  it("Seç on the box's place (fillOffer) with an unknown code, then more offers: one box", async () => {
    const trip = await create();
    const items = await listItems(trip.id);
    const filled = await fillOffer(items.find((i) => i.id === "f-ush")!, offer("x1", "Flybondi", "XXX", "USH"), NEEDS.ush);
    const more = await addOffer(trip.id, offer("u1", "Aerolíneas Argentinas", "AEP", "USH"), NEEDS.ush);
    const after = flights(trip, await listItems(trip.id));
    expect(after).toHaveLength(4);
    expect(box(after, "f-ush")?.itemIds).toEqual(expect.arrayContaining([filled.id, more.id]));
  });

  it("Bileti al: the chosen Turkish Airlines' round mark is its logo", async () => {
    const trip = await create();
    const added = await addAll(trip);
    await chooseItem(added.out[0], (await listItems(trip.id)).filter((i) => i.category === "flight"));
    const items = await listItems(trip.id);
    const out = box(flights(trip, items), added.out[0].id)!;
    expect(out.status).toBe("chosen");
    const env = { trip, focus: null, setFocus: () => {} } as unknown as CardEnv;
    const v82 = { byId: new Map(items.map((i) => [i.id, i])), selfAt: { adults: 2, countries: ["AR"] } } as unknown as V82Env;
    const on = { take: () => {}, got: () => {}, change: null, openDoc: null, addDoc: () => {}, ask: null, edit: () => {}, unarrange: null };
    const html = renderToStaticMarkup(
      <CardEnvContext.Provider value={env}>
        <V82EnvContext.Provider value={v82}>
          <FrameTicket vm={out} form="chosen" art="illus/ucus.png" page={added.out[0].url} links={[]} hints={[]} info={null} detail={null} quiet={false} on={on} onCover={null} ways={null} onReset={null} onLegGot={null} />
        </V82EnvContext.Provider>
      </CardEnvContext.Provider>,
    );
    const cta = html.slice(html.indexOf('class="q-cta"'));
    const button = cta.slice(0, cta.indexOf("</a>"));
    expect(button).toContain("Bileti al");
    expect(button).toContain('class="q-logo sm q-air" src="logos/airlines/TK.png"');
    // The journey's step for it: its "Satın al" carries the airline (its logo), not the site's letter.
    const { input, timeline } = inputOf(trip, items);
    const steps = journeyChapters({ input, timeline, collections: collectionsOf(input) }).chapters.flatMap((c) => c.steps);
    const step = steps.find((s) => s.action?.kind === "book" && s.action.itemId === added.out[0].id);
    expect(step?.action).toMatchObject({ airline: "TK", brand: { label: "Aviasales" } });
  });
});
