// The trip in the order it happens, for the sample trip and the edge cases: what's missing gets a
// slot to fill, and nothing saved falls off the board.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline, flightSearchUrl } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";

const titles = (t: ReturnType<typeof buildTimeline>) =>
  t.entries.map((e) => (e.kind === "leg" ? `  ${e.leg.from.label} → ${e.leg.to.label}` : `${e.title}${"subtitle" in e && e.subtitle ? ` | ${e.subtitle}` : ""}`));

describe("timeline", () => {
  it("lays out the sample trip from the flight in to the flight home", async () => {
    const id = await loadDemoTrip();
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const { ctx } = await loadDecisions(trip, items);
    const plan = buildPlan(trip, items);
    const timeline = buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items);
    expect(titles(timeline)).toEqual([
      "8 Ekim · Uçuş | IST → OPO",
      "  OPO havalimanı → Porto konaklaması",
      "8–11 Ekim · Konaklama | Porto · 3 gece",
      "9 Ekim · Etkinlik",
      "  Porto konaklaması → Porto Campanhã",
      "11 Ekim · Şehir değişimi | Porto → Lizbon",
      "  Lisboa Santa Apolónia → Lisboa Loft",
      "11–14 Ekim · Konaklama | Lizbon · 3 gece",
      "  Lisboa Loft → LIS havalimanı",
      "14 Ekim · Dönüş | LIS → IST",
    ]);
    const day = timeline.entries.find((e) => e.kind === "day")!;
    expect(day.kind === "day" && day.items.map((i) => i.name)).toEqual(["Douro tekne turu"]);
    const move = timeline.entries.find((e) => e.kind === "travel" && e.role === "move")!;
    expect(move.kind === "travel" && move.travel?.items.map((i) => i.name)).toEqual(["CP Alfa Pendular · Porto → Lizbon"]);
    expect(timeline.unplaced).toEqual([]);
    expect(timeline.undated.map((i) => i.name).sort()).toEqual(["Livraria Lello", "Majestic Café", "Serralves Müzesi", "Tiyatro"]);
  });

  it("leaves a slot to fill when nothing gets the traveller there or home, unless they said how", () => {
    const trip: Trip = { id: "t", title: "Porto", confirmedDates: { start: "2026-10-07", end: "2026-10-10" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const stay: Item = {
      id: "s", tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name: "Jardim Stay", provider: null, summary: "", optionDetail: null,
      url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT", location: { address: null, area: null, approximate: false },
      dates: { start: "2026-10-07", end: "2026-10-10", source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
      price: { amount: 200, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 }, priceHistory: [],
      cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
      metrics: EMPTY_METRICS, geo: null, highlights: [], concerns: [], reviewSummary: null, missing: [], status: "booked", statusNote: null, createdAt: 1, updatedAt: 1,
    };
    const plan = buildPlan(trip, [stay]);
    const open = buildTimeline(plan, buildLegs(plan, trip), [stay]);
    const arrival = open.entries[0];
    expect(arrival).toMatchObject({ kind: "travel", role: "arrival", title: "7 Ekim · Varış", subtitle: "→ Porto", travel: null });
    expect(arrival.kind === "travel" && arrival.searchUrl).toBe(flightSearchUrl("to", "Porto", "2026-10-07", null));
    expect(open.entries.at(-1)).toMatchObject({ kind: "travel", role: "departure", title: "10 Ekim · Dönüş", subtitle: "Porto →" });
    // "Arabayla geliyoruz": no flight slot for the way in.
    const driving = { ...trip, legs: { "2026-10-07:arrival:porto": { mode: "car" as const, booked: false, note: null, updatedAt: 1 } } };
    const t = buildTimeline(plan, buildLegs(plan, driving), [stay]);
    expect(t.entries[0].kind).toBe("leg");
  });

  it("searches flights in plain words, with home when the saved flights tell it", () => {
    expect(decodeURIComponent(flightSearchUrl("from", "Lizbon", "2026-10-14", "IST")!)).toBe(
      "https://www.google.com/travel/flights?q=Flights from Lizbon to IST on 2026-10-14",
    );
  });
});
