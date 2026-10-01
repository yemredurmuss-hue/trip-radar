// A booking confirmation (the page after paying, or its screenshot) books the place and reshapes the
// plan at once: 4 nights here and 3 there, or 7 nights in one place instead of what was planned.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listItems, listMessages, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem } from "../src/lib/planned";
import { processPending, saveImage, type Deps } from "../src/lib/process";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";

const confirmation = (over: Partial<Extraction>): Extraction => ({
  category: "stay",
  name: "Casa da Ribeira",
  provider: "Airbnb",
  summary: "Rezervasyon onaylandı",
  option_detail: null,
  city: "Porto",
  country: "Portekiz",
  country_code: "PT",
  location: { address: null, area: null, approximate: false },
  dates: { start: "2026-10-07", end: "2026-10-11", source: "screenshot" },
  guests: { adults: 2, children: null, rooms: null },
  price: { amount: 420, currency: "EUR", scope: "total", taxes_included: "yes", source: "screenshot", evidence: null },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null },
  rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null,
  metrics: null,
  highlights: [],
  concerns: [],
  review_summary: null,
  image_url: null,
  missing: [],
  trip: { existing_trip_id: "t1", new_trip_title: null },
  need_key: "stay:porto",
  booked: true,
  booking_reference: "HMX4K2P9",
  booking_quote: "Rezervasyonunuz onaylandı",
  ...over,
});

const trip: Trip = { id: "t1", title: "Porto ve Madeira", confirmedDates: { start: "2026-10-07", end: "2026-10-14" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const chosenStay = (name: string, city: string, start: string, end: string): Item =>
  plannedItem({ kind: "stay", date: start, end_date: end, time: null, from: null, to: null, city, title: name, booked: false, note: null }, "t1", `plan-${city}`, 1);

async function saveConfirmation(extraction: Extraction) {
  const deps: Deps = { extract: async () => extraction, heroImage: async () => null, geocode: async () => null };
  await saveImage("data:image/jpeg;base64,AAAA");
  await processPending(deps);
}

const outline = (items: Item[], t: Trip) => {
  const plan = buildPlan(t, items);
  const timeline = buildTimeline(plan, buildLegs(plan, t), items);
  return {
    plan,
    blocks: plan.stayBlocks.map((b) => `${b.kind} ${b.city} ${b.range.start}–${b.range.end}${b.kind === "open" ? "" : ` ${b.item.name}`}`),
    moves: timeline.entries.filter((e) => e.kind === "travel" && e.role === "move").map((e) => (e.kind === "travel" ? e.subtitle : "")),
  };
};

describe("booking confirmations", () => {
  it("books what the screenshot confirms and says so", async () => {
    const d = await db();
    await d.put("trips", trip);
    for (const i of [chosenStay("Porto evi", "Porto", "2026-10-07", "2026-10-10"), chosenStay("Madeira evi", "Madeira", "2026-10-10", "2026-10-14")]) await d.put("items", i);

    // 4 nights in Porto, then 3 in Madeira: two confirmations, and the plan follows them.
    await saveConfirmation(confirmation({}));
    await saveConfirmation(confirmation({ name: "Funchal Loft", city: "Funchal", dates: { start: "2026-10-11", end: "2026-10-14", source: "screenshot" }, need_key: "stay:funchal" }));
    const items = await listItems("t1");
    expect(items.filter((i) => i.status === "booked").map((i) => i.name).sort()).toEqual(["Casa da Ribeira", "Funchal Loft"]);
    const { blocks, plan } = outline(items, (await listTrips())[0]);
    expect(blocks).toEqual(["booked Porto 2026-10-07–2026-10-11 Casa da Ribeira", "booked Funchal 2026-10-11–2026-10-14 Funchal Loft"]);
    // The plans said before give way to what was booked.
    expect(plan.closed.map((c) => c.item.name).sort()).toEqual(["Madeira evi", "Porto evi"]);
    expect((await listMessages("t1")).map((m) => m.text).join("\n")).toContain("✓ Casa da Ribeira rezerve edildi · 7–11 Ekim (onaydan); plan buna göre güncellendi");
  });

  it("reshapes the plan when the booking differs from it: 7 nights in one place", () => {
    const porto = chosenStay("Porto evi", "Porto", "2026-10-07", "2026-10-10");
    const madeira = chosenStay("Madeira evi", "Madeira", "2026-10-10", "2026-10-14");
    const before = outline([porto, madeira], trip);
    expect(before.moves).toEqual(["Porto → Madeira"]);
    const lisbon: Item = {
      ...porto, id: "b1", origin: undefined, plannedKind: undefined, name: "Alfama Suites", city: "Lizbon", needKey: "stay:lizbon",
      dates: { start: "2026-10-07", end: "2026-10-14", source: "page" }, status: "booked", metrics: EMPTY_METRICS,
    };
    const after = outline([porto, madeira, lisbon], trip);
    expect(after.blocks).toEqual(["booked Lizbon 2026-10-07–2026-10-14 Alfama Suites"]);
    expect(after.moves).toEqual([]); // one place: no change of city left
    expect(after.plan.closed.map((c) => c.item.name).sort()).toEqual(["Madeira evi", "Porto evi"]);
  });

  it("widens the trip to a booking that runs past the planned dates", () => {
    const longer: Item = { ...chosenStay("x", "Porto", "2026-10-07", "2026-10-16"), id: "b2", status: "booked", origin: undefined, plannedKind: undefined, name: "Longer stay" };
    const { plan } = outline([longer], trip);
    expect(plan.range).toEqual({ start: "2026-10-07", end: "2026-10-16" });
  });
});
