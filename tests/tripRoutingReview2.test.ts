// The re-review of trip routing (2026-10-06, scratchpad/review-tr/fix.probe.ts): each finding as a test.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, listItems, listMessages, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { placeFitOf } from "../src/lib/placeCheck";
import { processPending, savePastedLink, type Deps } from "../src/lib/process";
import { answerHeld, undoMove } from "../src/lib/routing";
import { strayItems } from "../src/lib/strays";
import { chooseTrip, profileTrips } from "../src/lib/trips";
import type { Item, Trip } from "../src/lib/types";

const base = {
  category: "activity", name: "x", provider: null, summary: "", option_detail: null, city: null, country: null, country_code: null,
  location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "none" },
  guests: { adults: null, children: null, rooms: null },
  price: { amount: null, currency: null, scope: "unknown", taxes_included: "unknown", source: "none", evidence: null },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null },
  rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null, metrics: null, highlights: [], concerns: [], review_summary: null, image_url: null, missing: [],
  trip: { existing_trip_id: null, new_trip_title: null }, need_key: "activity:x",
} as unknown as Extraction;

let pages: Record<string, () => Extraction> = {};
let home: string | null = null;
const deps: Deps = {
  extract: async (c) => pages[Object.keys(pages).find((k) => (c.url ?? "").includes(k))!](),
  heroImage: async () => null,
  geocode: async () => null,
  home: async () => home,
};
const trip = (id: string, title: string, updatedAt = 1): Trip => ({ id, title, confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt });
let n = 0;
const item = (tripId: string, over: Partial<Item>): Item =>
  ({
    id: `r${++n}`, tripId, captureIds: [], key: null, category: "stay", needKey: `stay:${n}`, name: `Item ${n}`, provider: null, summary: "", optionDetail: null,
    url: null, imageUrl: null, city: null, country: null, countryCode: null, location: { address: null, area: null, approximate: false },
    dates: { start: null, end: null, source: "none" }, guests: { adults: null, children: null, rooms: null },
    price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: 1 }, priceHistory: [],
    cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1, ...over,
  }) as Item;
const flightOut = (tripId: string) =>
  item(tripId, {
    category: "flight", needKey: "flight:ist-opo", name: "TK1759", countryCode: "PT", dates: { start: "2026-10-08", end: null, source: "page" },
    flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:00", arrival: null, carrier: null, flightNumber: null, stops: null },
  });
const istHotel = () => ({ ...base, category: "stay", name: "IST Airport Hotel", city: "İstanbul", country: "Türkiye", country_code: "TR", dates: { start: "2026-10-07", end: "2026-10-08", source: "url" } }) as unknown as Extraction;

beforeEach(async () => {
  const d = await db();
  for (const s of ["trips", "items", "captures", "messages", "docs", "trash", "trashData"] as const) await d.clear(s);
  pages = {};
  home = null;
});

describe("A: one old record never sets a small trip's country (P3, P3b)", () => {
  it("a flight to Porto and an old Bali tour: the trip is Portugal; the tour is flagged; a new Bali page goes to the Bali trip", async () => {
    const d = await db();
    await d.put("trips", trip("pt", "Ekim tatili", 5));
    await d.put("items", flightOut("pt"));
    await d.put("items", item("pt", { id: "old", category: "activity", needKey: "activity:old", name: "Nusa Penida tour", city: "Denpasar", countryCode: "ID", dates: { start: "2026-10-08", end: null, source: "page" } }));
    await d.put("trips", trip("bali", "Bali", 2));
    await d.put("items", item("bali", { name: "Ubud stay", city: "Ubud", countryCode: "ID", dates: { start: "2026-12-01", end: "2026-12-08", source: "url" } }));
    const items = await d.getAll("items");
    expect([...profileTrips([(await d.get("trips", "pt"))!], items)[0].countryCodes]).toEqual(["PT"]);
    expect(strayItems((await d.get("trips", "pt"))!, items).map((s) => s.item.name)).toEqual(["Nusa Penida tour"]);
    pages = { uluwatu: () => ({ ...base, name: "Uluwatu temple tour", city: "Bali", country: "Endonezya", country_code: "ID", dates: { start: "2026-10-09", end: null, source: "page" } }) as unknown as Extraction };
    await savePastedLink("https://x.com/uluwatu");
    await processPending(deps);
    expect((await listItems("pt")).map((i) => i.name)).not.toContain("Uluwatu temple tour");
    expect((await listItems("bali")).map((i) => i.name)).toContain("Uluwatu temple tour");
  });

  it("an undated Porto restaurant and a dated Bali tour, no flight: a tie flags nothing (no guess)", () => {
    const items = [
      item("pt", { category: "food", name: "Taberna Porto", city: "Porto", countryCode: "PT" }),
      item("pt", { category: "activity", name: "Nusa Penida tour", city: "Denpasar", countryCode: "ID", dates: { start: "2026-10-08", end: null, source: "page" } }),
    ];
    expect(strayItems(trip("pt", "Ekim tatili"), items)).toEqual([]);
    // ...with the flight to Porto, the tour is the odd one out.
    expect(strayItems(trip("pt", "Ekim tatili"), [...items, flightOut("pt")]).map((s) => s.item.name)).toEqual(["Nusa Penida tour"]);
  });
});

describe("B: home from the flights, and Geri al keeps the night before (P1)", () => {
  async function portoAndKapadokya(withOtherTripFlight: boolean) {
    const d = await db();
    await d.put("trips", trip("pt", "Porto Gezisi", 5));
    await d.put("items", item("pt", { name: "Jardim", city: "Porto", countryCode: "PT", dates: { start: "2026-10-08", end: "2026-10-15", source: "url" } }));
    await d.put("trips", trip("kap", "Kapadokya", 2));
    await d.put("items", item("kap", { name: "Göreme", city: "Göreme", countryCode: "TR", dates: { start: "2026-05-01", end: "2026-05-04", source: "url" } }));
    // Another trip's flight from İstanbul: home is Türkiye though no passport is set.
    if (withOtherTripFlight) {
      await d.put("trips", trip("rome", "Roma", 1));
      await d.put("items", { ...flightOut("rome"), countryCode: "IT", flight: { from: "IST", to: "FCO", departure: "2026-03-01T09:00", arrival: null, carrier: null, flightNumber: null, stops: null } });
    }
  }

  it("with no passport, home comes from the trips' flights: the airport hotel stays in Porto with its night", async () => {
    await portoAndKapadokya(true);
    pages = { ist: istHotel };
    await savePastedLink("https://booking.com/ist", undefined, "pt");
    await processPending(deps);
    expect((await listItems("pt")).find((i) => i.name === "IST Airport Hotel")?.dates.start).toBe("2026-10-07");
    expect((await listItems("kap")).map((i) => i.name)).toEqual(["Göreme"]);
  });

  it("with no home at all: not moved to the May Kapadokya trip (its own dates), asked; 'yine de ekle' keeps its night", async () => {
    await portoAndKapadokya(false);
    pages = { ist: istHotel };
    const capture = await savePastedLink("https://booking.com/ist", undefined, "pt");
    await processPending(deps);
    expect((await listItems("kap")).map((i) => i.name)).toEqual(["Göreme"]);
    expect((await listMessages("pt")).some((m) => m.routing?.kind === "ask")).toBe(true);
    await answerHeld(capture.id, "here");
    expect((await listItems("pt")).find((i) => i.name === "IST Airport Hotel")?.dates.start).toBe("2026-10-07");
  });

  it("Geri al restores the page's dates when they fall in the trip's, even when far, for the way there", async () => {
    const d = await db();
    await d.put("trips", trip("pt", "Porto Gezisi", 5));
    await d.put("items", item("pt", { name: "Jardim", city: "Porto", countryCode: "PT", dates: { start: "2026-10-08", end: "2026-10-15", source: "url" } }));
    await d.put("trips", trip("kap", "Kapadokya", 2));
    await d.put("items", item("kap", { name: "Göreme", city: "Göreme", countryCode: "TR", dates: { start: "2026-10-01", end: "2026-10-04", source: "url" } }));
    pages = { ist: istHotel };
    await savePastedLink("https://booking.com/ist", undefined, "pt");
    await processPending(deps);
    const moved = (await listMessages("pt")).find((m) => m.routing?.kind === "moved")!;
    await undoMove(moved.id);
    expect((await listItems("pt")).find((i) => i.name === "IST Airport Hotel")?.dates.start).toBe("2026-10-07");
  });
});

describe("C: a two-country journey of one stay each (P5)", () => {
  const ek = trip("ek2", "Doğu Afrika gezisi");
  const stays = () => [
    item("ek2", { name: "Cairo stay", city: "Kahire", countryCode: "EG", dates: { start: "2026-11-01", end: "2026-11-05", source: "url" } }),
    item("ek2", { name: "Nairobi stay", city: "Nairobi", countryCode: "KE", dates: { start: "2026-11-05", end: "2026-11-09", source: "url" } }),
  ];
  it("stays one after the other are both the trip's: nothing flagged", () => {
    expect(strayItems(ek, stays())).toEqual([]);
  });
  it("a Masai Mara page sent in its chat stays in it", async () => {
    const d = await db();
    await d.put("trips", ek);
    for (const i of stays()) await d.put("items", i);
    await d.put("trips", trip("other-ke", "Kenya 2025", 1));
    await d.put("items", item("other-ke", { name: "Mombasa", countryCode: "KE", dates: { start: "2025-02-01", end: "2025-02-05", source: "url" } }));
    pages = { safari: () => ({ ...base, name: "Masai Mara safari", city: "Narok", country: "Kenya", country_code: "KE", dates: { start: "2026-11-06", end: null, source: "page" } }) as unknown as Extraction };
    await savePastedLink("https://x.com/safari", undefined, "ek2");
    await processPending(deps);
    expect((await listItems("ek2")).map((i) => i.name)).toContain("Masai Mara safari");
  });
});

describe("D: a trip already over doesn't take a page by its place alone (P6)", () => {
  it("a May Lisbon trip doesn't absorb an October restaurant once May is past", () => {
    const profiles = profileTrips([trip("past", "Portekiz")], [item("past", { city: "Lizbon", countryCode: "PT", dates: { start: "2026-05-01", end: "2026-05-08", source: "url" } })]);
    const signal = { countryCode: "PT", country: "Portekiz", start: "2026-10-20", end: null, suggestedTripId: null, suggestedTitle: "Lizbon", softDates: true };
    expect(chooseTrip({ ...signal, today: "2026-10-06" }, profiles)).toEqual({ newTitle: "Lizbon" });
    expect(chooseTrip({ ...signal, today: "2026-04-01" }, profiles)).toEqual({ tripId: "past" });
  });
});

describe("E: home counts only for the way there", () => {
  it("a Kapadokya hotel sent in the Bali chat isn't the Bali trip's; the airport hotel, lounge and insurance are", async () => {
    const items = [item("bali", { name: "Ubud stay", countryCode: "ID" }), { ...flightOut("bali"), countryCode: "ID", flight: { from: "IST", to: "DPS", departure: "2026-12-01T01:00", arrival: null, carrier: null, flightNumber: null, stops: null } }];
    const trips = [trip("bali", "Bali")];
    const at = (over: Partial<Item>) => placeFitOf(item("bali", { countryCode: "TR", ...over }), "bali", trips, items, "TR");
    expect(at({ name: "Kapadokya Cave Hotel", city: "Göreme" })).toBe("far");
    expect(at({ name: "IST Airport Hotel", city: "Arnavutköy" })).toBe("in");
    expect(at({ name: "IGA Lounge", category: "other", city: "İstanbul" })).toBe("in");
    expect(at({ name: "Seyahat sağlık sigortası", category: "other" })).toBe("in");
    // A place in the very city the trip leaves from (a hotel in İstanbul the night before): its own too.
    expect(at({ name: "Pera Palace", city: "İstanbul" })).toBe("in");
    expect(await listTrips()).toEqual([]);
  });
});
