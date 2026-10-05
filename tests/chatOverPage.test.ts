// What the chat says about a saved page's option stands over the page (0.35.5 hero fix): the campervan said to be
// in Madeira, not Gaula, stayed Gaula's because the chat had no way to say a place, and a price or a day said in the
// chat was written on the record, where the page saved again put its own back.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { detailsOverPage, sendMessage } from "../src/lib/assistant";
import { db, listItems, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { processPending, saveSnapshot, type Deps } from "../src/lib/process";
import { correctionOf, saidEdits, withEdits } from "../src/lib/userEdits";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const van: Extraction = {
  category: "stay",
  name: "Renault Campervan 'Bawhee'",
  provider: "Indie Campers",
  summary: "Campervan for two",
  option_detail: null,
  city: "Gaula",
  country: "Portekiz",
  country_code: "PT",
  location: { address: "Gaula, Madeira, Portugal", area: null, approximate: false },
  dates: { start: "2026-10-11", end: "2026-10-18", source: "page" },
  guests: { adults: 2, children: null, rooms: null },
  price: { amount: 900, currency: "EUR", scope: "total", taxes_included: "yes", source: "page", evidence: "€ 900" },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null },
  rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null,
  metrics: null,
  highlights: [],
  concerns: [],
  review_summary: null,
  image_url: null,
  missing: [],
  trip: { existing_trip_id: null, new_trip_title: "Porto ve Madeira Gezisi" },
  need_key: "stay:gaula",
};

const snapshot = (url: string, text: string) => ({ url, title: "t", pageText: text, viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] });

function fakeClient(responses: Partial<Anthropic.Message>[]) {
  const client = {
    messages: {
      create: async () => {
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        return next;
      },
    },
  } as unknown as Anthropic;
  return client;
}

const tool = (id: string, name: string, input: Record<string, unknown>) => ({ type: "tool_use", id, name, caller: { type: "direct" }, input });

describe("what the chat says over a saved page", () => {
  it("keeps the city, the day and the price said in the chat when the page is saved again", async () => {
    const deps: Deps = { extract: async (_c, _f, trips) => ({ ...van, trip: { existing_trip_id: trips[0]?.id ?? null, new_trip_title: trips[0] ? null : van.trip.new_trip_title } }), heroImage: async () => null, geocode: async () => null };
    const url = "https://www.indiecampers.com/campervans/bawhee";
    await saveSnapshot(snapshot(url, "Renault Campervan Bawhee, Gaula € 900"), null);
    await processPending(deps);
    const trip = (await listTrips())[0];
    const [saved] = await listItems(trip.id);
    expect(saved.city).toBe("Gaula");

    const details = { item_id: saved.id, date: null, end_date: "2026-10-19", departure_time: null, arrival_time: null, arrival_date: null, from: null, to: null, city: "Madeira" };
    await sendMessage(
      trip.id,
      "Karavan Gaula değil Madeira; 19'unda bırakıyoruz, 950 euro ödedik",
      anthropicProvider(
        fakeClient([
          { stop_reason: "tool_use", content: [tool("c1", "set_details", details), tool("c2", "set_price", { item_id: saved.id, amount: 950, currency: "EUR", scope: "total" })] as Anthropic.ContentBlock[] },
          { stop_reason: "end_turn", content: [{ type: "text", text: "Karavanı Madeira'ya taşıdım.", citations: null }] as Anthropic.ContentBlock[] },
        ]),
        "claude-opus-5",
      ),
    );
    const said = withEdits((await listItems(trip.id))[0]);
    expect([said.city, said.dates.end, said.price.amount]).toEqual(["Madeira", "2026-10-19", 950]);

    // The page saved again (the same link, read again): the page's values go under the corrections, not over them.
    await saveSnapshot(snapshot(url, "Renault Campervan Bawhee, Gaula € 900"), null);
    await processPending(deps);
    const items = await listItems(trip.id);
    expect(items).toHaveLength(1);
    const after = withEdits(items[0]);
    expect([after.city, after.dates.end, after.price.amount]).toEqual(["Madeira", "2026-10-19", 950]);
    // The page's own value is still there, for "sayfadaki: Gaula · geri al".
    expect(items[0].city).toBe("Gaula");
    expect(correctionOf(after, "city")).toBe("Gaula");
    // No plan said twice, nothing deleted.
    expect(items[0].captureIds).toHaveLength(2);
    expect((await (await db()).getAll("items")).filter((i) => i.origin === "chat")).toEqual([]);
  });
});

describe("saidEdits and detailsOverPage", () => {
  const page = (over: Partial<Item> = {}): Item => makeItem({ captureIds: ["c1"], city: "Gaula", ...over });
  it("writes what was said as corrections; the page's own value needs none", () => {
    expect(saidEdits(page(), { city: "Madeira", start: null })).toEqual({ city: "Madeira" });
    expect(saidEdits(page({ userEdits: { city: "Madeira" } }), { city: "Gaula" })).toEqual({});
    const priced = page({ price: { amount: 900, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 } });
    expect(saidEdits(priced, { price: 950, currency: "EUR" })).toEqual({ price: 950 });
    expect(saidEdits(priced, { price: 900, currency: "USD" })).toEqual({ price: 900, currency: "USD" });
    expect(saidEdits(priced, { price: 900, currency: "EUR" })).toEqual({});
  });
  it("moves a ticket read from a page to the day said, keeping its arrival the next morning", () => {
    const ticket = page({
      category: "flight", city: "Funchal", dates: { start: null, end: null, source: "none" },
      flight: { from: "OPO", to: "FNC", departure: null, arrival: "00:45", carrier: "Ryanair", flightNumber: null, stops: 0 },
    });
    const moved = detailsOverPage(ticket, { date: "2026-10-12", end_date: null, departure_time: "22:40", arrival_time: null, arrival_date: null, from: null, to: null }, null) as Item;
    expect(moved.userEdits).toEqual({ start: "2026-10-12", time: "22:40" });
    expect(withEdits(moved).flight).toMatchObject({ departure: "2026-10-12T22:40", arrival: "2026-10-13T00:45" });
    // A dated ticket moved two days: the arrival said lands on the new day, not two days later.
    const dated = page({ category: "flight", dates: { start: "2026-10-10", end: null, source: "page" }, flight: { from: "OPO", to: "FNC", departure: "2026-10-10T08:00", arrival: "2026-10-10T09:50", carrier: null, flightNumber: null, stops: 0 } });
    const later = detailsOverPage(dated, { date: "2026-10-12", end_date: null, departure_time: null, arrival_time: "10:30", arrival_date: null, from: null, to: null }, null) as Item;
    expect(withEdits(later).flight).toMatchObject({ departure: "2026-10-12T08:00", arrival: "2026-10-12T10:30" });
    expect(detailsOverPage(dated, { date: "12 Ekim", end_date: null, departure_time: null, arrival_time: null, arrival_date: null, from: null, to: null }, null)).toContain("YYYY");
  });
});
