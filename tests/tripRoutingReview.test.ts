// The review of trip routing (2026-10-06, probes in scratchpad/review-tr): each case as a test.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { countryDistanceKm, nearCountries } from "../src/lib/countryCenters";
import { db, listItems, listMessages, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { datesIn, placeFit, routeCapture } from "../src/lib/placeCheck";
import { processPending, savePastedLink, saveSnapshot, type Deps } from "../src/lib/process";
import { answerHeld } from "../src/lib/routing";
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
} as Extraction;

let pages: Record<string, () => Extraction> = {};
let home: string | null = null;
const deps: Deps = {
  extract: async (capture) => {
    const key = Object.keys(pages).find((k) => (capture.url ?? capture.pageText).includes(k));
    if (!key) throw new Error(`no page ${capture.url}`);
    return pages[key]();
  },
  heroImage: async () => null,
  geocode: async () => null,
  home: async () => home,
};
const trip = (id: string, title: string, over: Partial<Trip> = {}): Trip => ({ id, title, confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over });
let n = 0;
const item = (tripId: string, over: Partial<Item>): Item =>
  ({
    id: `i${++n}`, tripId, captureIds: [], key: null, category: "stay", needKey: "stay:x", name: `Item ${n}`, provider: null, summary: "", optionDetail: null,
    url: null, imageUrl: null, city: null, country: null, countryCode: null, location: { address: null, area: null, approximate: false },
    dates: { start: null, end: null, source: "none" }, guests: { adults: null, children: null, rooms: null },
    price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: 1 }, priceHistory: [],
    cancellation: { summary: null, freeUntil: null, source: "none" }, rating: { value: null, scale: null, count: null, source: "none" }, flight: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1, ...over,
  }) as Item;
const flight = (tripId: string, from: string, to: string, day: string) =>
  item(tripId, { category: "flight", countryCode: null, flight: { from, to, departure: `${day}T08:00`, arrival: null, carrier: null, flightNumber: null, stops: null }, dates: { start: day, end: null, source: "url" } });

beforeEach(async () => {
  const d = await db();
  for (const s of ["trips", "items", "captures", "messages", "docs", "trash", "trashData"] as const) await d.clear(s);
  pages = {};
  home = null;
});

/** Porto, 8–15 October, flying from İstanbul; a Kapadokya trip in May. */
async function portoAndKapadokya(withFlight: boolean) {
  const d = await db();
  await d.put("trips", trip("pt", "Porto Gezisi", { updatedAt: 5 }));
  await d.put("items", item("pt", { name: "Jardim", city: "Porto", countryCode: "PT", dates: { start: "2026-10-08", end: "2026-10-15", source: "url" } }));
  if (withFlight) await d.put("items", flight("pt", "IST", "OPO", "2026-10-08"));
  await d.put("trips", trip("kap", "Kapadokya", { updatedAt: 2 }));
  await d.put("items", item("kap", { name: "Göreme cave", city: "Göreme", countryCode: "TR", dates: { start: "2026-05-01", end: "2026-05-04", source: "url" } }));
}
const istHotel = () => ({ ...base, category: "stay", name: "IST Airport Hotel", city: "İstanbul", country: "Türkiye", country_code: "TR", dates: { start: "2026-10-07", end: "2026-10-08", source: "url" } }) as Extraction;

describe("#3 home and where the trip starts are the trip's own (probe A)", () => {
  it("an İstanbul airport hotel dropped on the Porto board stays there, its dates kept (the trip flies from İstanbul)", async () => {
    await portoAndKapadokya(true);
    pages = { ist: istHotel };
    await savePastedLink("https://booking.com/ist.html", "pt");
    await processPending(deps);
    expect((await listItems("pt")).find((i) => i.name === "IST Airport Hotel")?.dates.start).toBe("2026-10-07");
    expect((await listItems("kap")).map((i) => i.name)).toEqual(["Göreme cave"]);
  });

  it("the lounge and the insurance from the chat stay too, when home is set (no flight saved yet)", async () => {
    await portoAndKapadokya(false);
    home = "TR";
    pages = {
      lounge: () => ({ ...base, category: "other", name: "IGA Lounge", city: "İstanbul", country_code: "TR" }) as Extraction,
      insure: () => ({ ...base, category: "other", name: "Seyahat sigortası", country: "Türkiye", country_code: "TR", travel: true }) as Extraction,
    };
    await savePastedLink("https://iga.com/lounge", undefined, "pt");
    await savePastedLink("https://sigorta.com/insure", undefined, "pt");
    await processPending(deps);
    expect((await listItems("pt")).map((i) => i.name)).toEqual(expect.arrayContaining(["IGA Lounge", "Seyahat sigortası"]));
    expect((await listItems("kap")).map((i) => i.name)).toEqual(["Göreme cave"]);
  });

  it("the one-time check doesn't flag them either", () => {
    const items = [
      item("pt", { city: "Porto", countryCode: "PT" }),
      flight("pt", "IST", "OPO", "2026-10-08"),
      item("pt", { name: "IST hotel", city: "İstanbul", countryCode: "TR" }),
    ];
    expect(strayItems(trip("pt", "Porto Gezisi"), items)).toEqual([]);
    expect(strayItems(trip("pt", "Porto Gezisi"), [items[0], items[2]], "TR")).toEqual([]);
  });
});

describe("#2 a move never carries the page's dates into the trip it goes to", () => {
  const bali = trip("bali", "Bali");
  const ubud = item("bali", { countryCode: "ID", dates: { start: "2027-01-10", end: "2027-01-20", source: "url" } });
  it("dates in that trip's range are kept; outside dropped; booked or a trip with no dates keep them", () => {
    const inside = item("x", { dates: { start: "2027-01-12", end: null, source: "page" } });
    const outside = item("x", { dates: { start: "2026-10-08", end: null, source: "page" } });
    expect(datesIn(inside, bali, [ubud]).start).toBe("2027-01-12");
    expect(datesIn(outside, bali, [ubud])).toEqual({ start: null, end: null, source: "none" });
    expect(datesIn({ ...outside, status: "booked" }, bali, [ubud]).start).toBe("2026-10-08");
    expect(datesIn(outside, trip("empty", "Yeni"), []).start).toBe("2026-10-08");
  });
});

describe("#5 unknown and island codes", () => {
  it("every ISO code has a centre; Réunion is near Mauritius; a code nobody knows is 'unknown', never far", () => {
    for (const code of ["RE", "GP", "MQ", "LC", "AG", "SZ", "GM", "KN", "VC", "YT", "NC", "PF", "CV", "IC"]) expect(countryDistanceKm(code, "PT"), code).not.toBeNull();
    expect(nearCountries("MU", "RE")).toBe(true);
    expect(nearCountries("XX", "PT")).toBeNull();
    expect(placeFit(["XX"], new Set(["PT"]))).toBe("unknown");
    // ...and the date rule decides for it, as before.
    const profiles = profileTrips([trip("pt", "Portekiz")], [item("pt", { countryCode: "PT", dates: { start: "2026-10-08", end: "2026-10-15", source: "url" } })]);
    expect(chooseTrip({ countryCode: "XX", country: null, start: "2026-10-15", end: null, suggestedTripId: null, suggestedTitle: "X" }, profiles)).toEqual({ tripId: "pt" });
  });
});

describe("#6 journeys travelled together", () => {
  it("AU–NZ, AE–MV, ID–AU, US–CR, US–PR, JP–TH, ZA–MU are near; PT–TR and PT–ID still far", () => {
    for (const [a, b] of [["AU", "NZ"], ["AE", "MV"], ["ID", "AU"], ["US", "CR"], ["US", "PR"], ["JP", "TH"], ["ZA", "MU"]]) expect(nearCountries(a, b), `${a}-${b}`).toBe(true);
    expect(nearCountries("PT", "TR")).toBe(false);
    expect(nearCountries("PT", "ID")).toBe(false);
  });

  it("a New Zealand hotel sent in the 'Avustralya ve Yeni Zelanda' chat stays (its title names both)", () => {
    const au = trip("au", "Avustralya ve Yeni Zelanda");
    const items = [item("au", { city: "Sydney", countryCode: "AU" })];
    const nz = item("au", { id: "nz", city: "Queenstown", countryCode: "NZ" });
    expect(routeCapture({ item: nz, merged: false, newTrip: false, anchorId: "au", travel: true, trips: [au], items })).toEqual({ kind: "keep" });
  });

  it("the one-time check takes every country with places of its own: Japan+Thailand, a Caribbean cruise", () => {
    const jt = [item("jt", { countryCode: "JP" }), item("jt", { countryCode: "JP" }), item("jt", { countryCode: "TH" })];
    expect(strayItems(trip("jt", "Uzakdoğu turu"), jt)).toEqual([]);
    const cruise = ["US", "US", "AW", "PR", "LC"].map((c) => item("cr", { category: "activity", countryCode: c }));
    expect(strayItems(trip("cr", "Karayip kruvaziyeri"), cruise)).toEqual([]);
  });
});

describe("#7 a question with no trip to ask in", () => {
  it("is kept for the home ('Bekleyen kayıtlar'), and 'Yine de ekle' makes its trip", async () => {
    pages = { robots: () => ({ ...base, category: "other", name: "Realbotix Echo", country_code: "US", travel: false }) as Extraction };
    const capture = await saveSnapshot({ url: "https://realbotix.com/robots", title: "r", pageText: "robots", viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] }, null);
    await processPending(deps);
    expect(await listTrips()).toEqual([]);
    const [line] = await listMessages("");
    expect(line.routing).toMatchObject({ kind: "ask", reason: "travel", captureId: capture.id });
    const tripId = await answerHeld(capture.id, "here");
    expect((await listItems(tripId!)).map((i) => i.name)).toEqual(["Realbotix Echo"]);
    expect((await listMessages(""))[0].routing).toMatchObject({ answer: "here" });
  });
});

describe("probe C: a misplaced record never draws others into its trip", () => {
  it("an old key-less Bali record in the Porto trip doesn't pull a new Nusa Penida save into Porto", async () => {
    const d = await db();
    await d.put("trips", trip("pt", "Porto Gezisi", { updatedAt: 5 }));
    await d.put("items", item("pt", { name: "Jardim", city: "Porto", country: "Portekiz", countryCode: "PT", dates: { start: "2026-10-08", end: "2026-10-15", source: "url" } }));
    await d.put("items", item("pt", { id: "old", name: "Nusa Penida", category: "activity", city: "Denpasar", country: "Endonezya", countryCode: "ID", dates: { start: "2026-10-08", end: null, source: "page" } }));
    pages = { Nusa_Penida: () => ({ ...base, name: "Nusa Penida", city: "Denpasar", country: "Endonezya", country_code: "ID", dates: { start: "2026-10-08", end: null, source: "page" }, trip: { existing_trip_id: null, new_trip_title: "Bali" } }) as Extraction };
    await savePastedLink("https://www.tripadvisor.com/Nusa_Penida.html");
    await processPending(deps);
    expect((await listItems("pt")).map((i) => i.id)).toEqual(expect.arrayContaining(["old"]));
    expect(await listItems("pt")).toHaveLength(2);
    const bali = (await listTrips()).find((t) => t.id !== "pt")!;
    expect(bali.title).toBe("Bali");
    expect((await listItems(bali.id)).map((i) => i.name)).toEqual(["Nusa Penida"]);
    // ...and from the Porto chat it is asked about there, the old record untouched.
    await d.delete("trips", bali.id);
    for (const i of await listItems(bali.id)) await d.delete("items", i.id);
    await savePastedLink("https://www.tripadvisor.com/Nusa_Penida.html?again", undefined, "pt");
    await processPending(deps);
    expect(await listItems("pt")).toHaveLength(2);
    expect((await listMessages("pt")).some((m) => m.routing?.kind === "ask")).toBe(true);
  });
});

describe("#9 a page's own date respects the year", () => {
  it("a 2027 activity never joins a 2025 trip to the same country", () => {
    const profiles = profileTrips([trip("old", "Bali 2025")], [item("old", { countryCode: "ID", dates: { start: "2025-03-01", end: "2025-03-10", source: "url" } })]);
    const signal = { countryCode: "ID", country: "Endonezya", start: "2027-03-02", end: null, suggestedTripId: null, suggestedTitle: "Bali", softDates: true };
    expect(chooseTrip(signal, profiles)).toEqual({ newTitle: "Bali" });
    expect(chooseTrip({ ...signal, start: "2025-06-01" }, profiles)).toEqual({ tripId: "old" });
  });
});

describe("#10 two open boards never both ask", () => {
  it("the flag is claimed in IndexedDB before the line is posted", async () => {
    const d = await db();
    await d.put("trips", trip("pt", "Porto Gezisi"));
    await d.put("items", item("pt", { city: "Porto", countryCode: "PT" }));
    await d.put("items", item("pt", { name: "Bali swing", category: "activity", countryCode: "ID" }));
    // Two tabs: two copies of the module, each with its own in-page guard.
    vi.resetModules();
    const a = await import("../src/lib/strays");
    vi.resetModules();
    const b = await import("../src/lib/strays");
    await Promise.all([a.checkStraysOnce(), b.checkStraysOnce()]);
    expect((await listMessages("pt")).filter((m) => m.routing?.kind === "stray")).toHaveLength(1);
  });
});
