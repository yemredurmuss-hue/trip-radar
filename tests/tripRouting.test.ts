// The owner's report (2026-10-06): "Nusa Penida 2Day 1Night With Accomodation", a Bali tour from Tripadvisor,
// landed in "Porto ve Madeira Gezisi" on 8 Oct; a humanoid-robots article was saved into it too. A capture's
// place is checked against the trip it goes into (placeCheck.ts), and a page that isn't travel is asked about.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, listItems, listMessages, listTrips } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { placeFit, routeCapture } from "../src/lib/placeCheck";
import { processPending, saveImage, savePastedLink, saveSnapshot, type Deps } from "../src/lib/process";
import { answerHeld, undoMove } from "../src/lib/routing";
import { chooseTrip, profileTrips } from "../src/lib/trips";
import type { Item, Trip } from "../src/lib/types";

const base: Extraction = {
  category: "activity", name: "x", provider: "Tripadvisor", summary: "", option_detail: null, city: null, country: null, country_code: null,
  location: { address: null, area: null, approximate: false },
  dates: { start: null, end: null, source: "none" },
  guests: { adults: null, children: null, rooms: null },
  price: { amount: null, currency: null, scope: "unknown", taxes_included: "unknown", source: "none", evidence: null },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null },
  rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null, metrics: null, highlights: [], concerns: [], review_summary: null, image_url: null, missing: [],
  trip: { existing_trip_id: null, new_trip_title: null }, need_key: "activity:x",
};

/** The page as the model read it: Denpasar, Indonesia, the date picker's 8 October, the open trip suggested. */
const nusaPenida = (trips: Trip[], over: Partial<Extraction> = {}): Extraction => ({
  ...base,
  name: "Nusa Penida 2Day 1Night With Accomodation",
  city: "Denpasar", country: "Endonezya", country_code: "ID",
  dates: { start: "2026-10-08", end: null, source: "page" },
  guests: { adults: 2, children: null, rooms: null },
  price: { amount: 73, currency: "USD", scope: "per_person", taxes_included: "unknown", source: "page", evidence: "US$73" },
  rating: { value: 5, scale: 5, count: 4, source: "page", evidence: "5.0" },
  trip: { existing_trip_id: trips.find((t) => t.title.startsWith("Porto"))?.id ?? null, new_trip_title: "Bali" },
  need_key: "activity:denpasar",
  ...over,
});

const NUSA = "https://www.tripadvisor.com/AttractionProductReview-g297694-d12345-Nusa_Penida_2Day_1Night.html";

let pages: Record<string, (trips: Trip[]) => Extraction> = {};
const deps: Deps = {
  extract: async (capture, _facts, trips) => {
    const key = Object.keys(pages).find((k) => (capture.url ?? capture.pageText ?? "").includes(k) || capture.pageText.includes(k));
    if (!key) throw new Error(`no page for ${capture.url}`);
    return pages[key](trips);
  },
  heroImage: async () => null,
  geocode: async () => null,
};

const trip = (id: string, title: string, updatedAt = 1): Trip => ({ id, title, confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt });
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

async function reset() {
  const d = await db();
  for (const store of ["trips", "items", "captures", "messages", "docs"] as const) await d.clear(store);
  pages = {};
}

/** The owner's Portugal trip: Porto, then Madeira (Funchal), 8–22 October. */
async function portugalTrip(): Promise<Trip> {
  const d = await db();
  const pt = trip("pt", "Porto ve Madeira Gezisi", 5);
  await d.put("trips", pt);
  await d.put("items", item("pt", { name: "Jardim Stay", city: "Porto", country: "Portekiz", countryCode: "PT", dates: { start: "2026-10-08", end: "2026-10-15", source: "url" } }));
  await d.put("items", item("pt", { name: "Casa Verde", city: "Funchal", country: "Portekiz", countryCode: "PT", dates: { start: "2026-10-15", end: "2026-10-22", source: "url" } }));
  return pt;
}

/** A Bali trip in January (far from the date picker's 8 October). */
async function baliTrip(): Promise<Trip> {
  const d = await db();
  const bali = trip("bali", "Bali", 1);
  await d.put("trips", bali);
  await d.put("items", item("bali", { name: "Ubud Villa", city: "Ubud", country: "Endonezya", countryCode: "ID", dates: { start: "2027-01-10", end: "2027-01-20", source: "url" } }));
  return bali;
}

const names = async (tripId: string) => (await listItems(tripId)).map((i) => i.name);
const events = async (tripId: string) => (await listMessages(tripId)).filter((m) => m.role === "event");

beforeEach(reset);

describe("a Bali activity handed to the Portugal trip", () => {
  it("goes to the Bali trip when there is one, and the Portugal trip says so (board drop)", async () => {
    await portugalTrip();
    await baliTrip();
    pages = { Nusa_Penida: nusaPenida };
    await savePastedLink(NUSA, "pt");
    await processPending(deps);

    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
    expect(await names("bali")).toContain("Nusa Penida 2Day 1Night With Accomodation");
    const note = (await events("pt")).find((m) => m.routing?.kind === "moved");
    expect(note?.text).toMatch(/Nusa Penida 2Day 1Night With Accomodation Bali gezine eklendi/);
    expect(note?.routing).toMatchObject({ kind: "moved", fromTripId: "pt", toTripId: "bali", far: true, merged: false });
    expect((await events("bali")).some((m) => /✓ Nusa Penida .* kaydedildi → Etkinlikler · Denpasar/.test(m.text))).toBe(true);
  });

  it("goes to the Bali trip from the chat as well", async () => {
    await portugalTrip();
    await baliTrip();
    pages = { Nusa_Penida: nusaPenida };
    await savePastedLink(NUSA, undefined, "pt");
    await processPending(deps);
    expect(await names("bali")).toContain("Nusa Penida 2Day 1Night With Accomodation");
    expect((await events("pt")).some((m) => m.routing?.kind === "moved")).toBe(true);
  });

  it("from the toolbar, its own trip wins over the dates its page's date picker gave (the reported case)", async () => {
    await portugalTrip();
    await baliTrip();
    pages = { "nusa-page": nusaPenida };
    await saveSnapshot({ url: NUSA, title: "Nusa Penida", pageText: "nusa-page", viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] }, null);
    await processPending(deps);
    expect(await names("pt")).not.toContain("Nusa Penida 2Day 1Night With Accomodation");
    expect(await names("bali")).toContain("Nusa Penida 2Day 1Night With Accomodation");
  });

  it("Geri al puts it in the trip it was handed to, on none of its days", async () => {
    await portugalTrip();
    await baliTrip();
    pages = { Nusa_Penida: nusaPenida };
    await savePastedLink(NUSA, "pt");
    await processPending(deps);
    const note = (await events("pt")).find((m) => m.routing?.kind === "moved")!;
    await undoMove(note.id);
    const back = (await listItems("pt")).find((i) => i.name.startsWith("Nusa Penida"))!;
    expect(back.dates.start).toBeNull();
    expect(await names("bali")).toEqual(["Ubud Villa"]);
    expect((await (await db()).get("messages", note.id))?.routing).toMatchObject({ kind: "moved" });
    expect(((await (await db()).get("messages", note.id))?.routing as { undoneAt?: number }).undoneAt).toBeTypeOf("number");
  });

  it("asks when there is no Bali trip: nothing is added, no trip is made", async () => {
    await portugalTrip();
    pages = { Nusa_Penida: nusaPenida };
    const capture = await savePastedLink(NUSA, "pt");
    await processPending(deps);

    expect((await listTrips()).map((t) => t.id)).toEqual(["pt"]);
    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
    const ask = (await events("pt")).find((m) => m.routing?.kind === "ask")!;
    expect(ask.text).toBe("Nusa Penida 2Day 1Night With Accomodation: bu yer Endonezya'da, gezin Portekiz'de. Nereye ekleyeyim?");
    expect(ask.routing).toMatchObject({ kind: "ask", reason: "place", newTitle: "Bali", captureId: capture.id });
    const held = (await (await db()).get("captures", capture.id))!;
    expect(held.status).toBe("done");
    expect(held.itemId).toBeNull();

    // "Yeni gezi: Bali": a new trip with it, its dates kept.
    const tripId = await answerHeld(capture.id, "new");
    const bali = (await listTrips()).find((t) => t.id === tripId)!;
    expect(bali.title).toBe("Bali");
    const [made] = await listItems(bali.id);
    expect(made.name).toMatch(/^Nusa Penida/);
    expect(made.dates.start).toBe("2026-10-08");
    expect((await (await db()).get("messages", ask.id))?.routing).toMatchObject({ answer: "new", answeredTripId: bali.id });
  });

  it("'Bu geziye yine de ekle' adds it to the Portugal trip, on none of its days", async () => {
    await portugalTrip();
    pages = { Nusa_Penida: nusaPenida };
    const capture = await savePastedLink(NUSA, "pt");
    await processPending(deps);
    expect(await answerHeld(capture.id, "here")).toBe("pt");
    const added = (await listItems("pt")).find((i) => i.name.startsWith("Nusa Penida"))!;
    expect(added.dates).toEqual({ start: null, end: null, source: "none" });
  });

  it("'Ekleme' adds nothing", async () => {
    await portugalTrip();
    pages = { Nusa_Penida: nusaPenida };
    const capture = await savePastedLink(NUSA, "pt");
    await processPending(deps);
    expect(await answerHeld(capture.id, "skip")).toBeNull();
    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
    expect((await (await db()).get("captures", capture.id))?.held?.answer).toBe("skip");
  });

  it("from the toolbar with no Bali trip, it opens its own trip instead of joining Portugal by date", async () => {
    await portugalTrip();
    pages = { "nusa-page": nusaPenida };
    await saveSnapshot({ url: NUSA, title: "Nusa Penida", pageText: "nusa-page", viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] }, null);
    await processPending(deps);
    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
    const other = (await listTrips()).find((t) => t.id !== "pt")!;
    expect(other.title).toBe("Bali");
  });
});

describe("what still goes in", () => {
  it("a trip in Portugal and Spain takes Sevilla", async () => {
    const d = await db();
    await portugalTrip();
    await d.put("items", item("pt", { name: "Triana Flat", city: "Sevilla", country: "İspanya", countryCode: "ES", dates: { start: "2026-10-22", end: "2026-10-24", source: "url" } }));
    pages = { alcazar: () => ({ ...base, name: "Real Alcázar", city: "Sevilla", country: "İspanya", country_code: "ES", dates: { start: "2026-10-23", end: null, source: "page" } }) };
    await savePastedLink("https://www.getyourguide.com/sevilla/alcazar", "pt");
    await processPending(deps);
    expect(await names("pt")).toContain("Real Alcázar");
  });

  it("a Portugal-only trip takes a country near it (Spain) as one journey, with its dates", async () => {
    await portugalTrip();
    pages = { alcazar: () => ({ ...base, name: "Real Alcázar", city: "Sevilla", country: "İspanya", country_code: "ES", dates: { start: "2026-10-21", end: null, source: "page" } }) };
    await savePastedLink("https://www.getyourguide.com/sevilla/alcazar", "pt");
    await processPending(deps);
    const added = (await listItems("pt")).find((i) => i.name === "Real Alcázar")!;
    expect(added.dates.start).toBe("2026-10-21");
  });

  it("a trip with no places yet takes anything (and takes its place from it)", async () => {
    const d = await db();
    await d.put("trips", trip("empty", "Yeni gezi"));
    pages = { Nusa_Penida: nusaPenida };
    await savePastedLink(NUSA, "empty");
    await processPending(deps);
    expect(await names("empty")).toEqual(["Nusa Penida 2Day 1Night With Accomodation"]);
  });

  it("a place on Madeira (Funchal) goes into the Porto and Madeira trip", async () => {
    await portugalTrip();
    pages = { levada: () => ({ ...base, name: "Levada do Caldeirão Verde", city: "Funchal", country: "Portekiz", country_code: "PT" }) };
    await savePastedLink("https://www.getyourguide.com/funchal/levada", undefined, "pt");
    await processPending(deps);
    expect(await names("pt")).toContain("Levada do Caldeirão Verde");
    expect((await events("pt")).some((m) => m.routing)).toBe(false);
  });

  it("a shared trip's capture from the other computer goes where its sender put it", async () => {
    const d = await db();
    await portugalTrip();
    await baliTrip();
    pages = { Nusa_Penida: nusaPenida };
    const capture = await savePastedLink(NUSA, "pt");
    await d.put("captures", { ...capture, sharedAt: Date.now(), sharedBy: "Sabine" });
    await processPending(deps);
    expect(await names("pt")).toContain("Nusa Penida 2Day 1Night With Accomodation");
  });

  it("a page whose place isn't known goes in as before", async () => {
    await portugalTrip();
    pages = { unknown: () => ({ ...base, name: "Some tour", category: "activity", price: { ...base.price, amount: 40, currency: "EUR" } }) };
    await savePastedLink("https://example.com/unknown", "pt");
    await processPending(deps);
    expect(await names("pt")).toContain("Some tour");
  });
});

describe("a place found later", () => {
  it("a record whose country comes with a later save of the same page moves to the trip of its place", async () => {
    await portugalTrip();
    await baliTrip();
    // First read: the page's country wasn't found; handed to the Portugal trip, it goes in (unknown place).
    pages = { Nusa_Penida: () => ({ ...nusaPenida([]), country: null, country_code: null, city: null, dates: { start: null, end: null, source: "none" } }) };
    await savePastedLink(NUSA, "pt");
    await processPending(deps);
    expect(await names("pt")).toContain("Nusa Penida 2Day 1Night With Accomodation");

    // Saved again from the toolbar: now it's Indonesia. The same record moves; the Portugal trip says so.
    pages = { Nusa_Penida: (trips) => nusaPenida(trips, { dates: { start: null, end: null, source: "none" } }) };
    await savePastedLink(NUSA);
    await processPending(deps);
    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
    expect(await names("bali")).toContain("Nusa Penida 2Day 1Night With Accomodation");
    expect((await events("pt")).some((m) => m.routing?.kind === "moved" && m.routing.toTripId === "bali")).toBe(true);
  });

  it("with no trip of its place, it leaves the plan and the trip asks", async () => {
    await portugalTrip();
    pages = { Nusa_Penida: () => ({ ...nusaPenida([]), country: null, country_code: null, city: null }) };
    await savePastedLink(NUSA, "pt");
    await processPending(deps);
    pages = { Nusa_Penida: (trips) => nusaPenida(trips) };
    await savePastedLink(NUSA);
    await processPending(deps);
    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
    expect((await events("pt")).some((m) => m.routing?.kind === "ask")).toBe(true);
  });
});

describe("a page that isn't travel", () => {
  const robots = () => ({ ...base, category: "other" as const, name: "Realbotix Echo Humanoid Robots", country: "ABD", country_code: "US", travel: false });

  it("is not added: the trip asks first (toolbar save)", async () => {
    await portugalTrip();
    pages = { robots };
    const capture = await saveSnapshot({ url: "https://realbotix.com/echo", title: "Realbotix", pageText: "robots", viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] }, null);
    await processPending(deps);
    expect((await listTrips()).map((t) => t.id)).toEqual(["pt"]);
    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
    const ask = (await events("pt")).find((m) => m.routing?.kind === "ask")!;
    expect(ask.text).toBe("Realbotix Echo Humanoid Robots: bu sayfa bir gezi planına benzemiyor. Yine de eklensin mi?");
    expect(await answerHeld(capture.id, "here")).toBe("pt");
    expect(await names("pt")).toContain("Realbotix Echo Humanoid Robots");
  });

  it("an answer from before the travel field: 'other' with nothing of a trip in it is asked about too", async () => {
    await portugalTrip();
    pages = { robots: () => ({ ...base, category: "other", name: "Realbotix Echo Humanoid Robots" }) };
    await savePastedLink("https://realbotix.com/robots", undefined, "pt");
    await processPending(deps);
    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
    expect((await events("pt")).find((m) => m.routing?.kind === "ask")?.routing).toMatchObject({ reason: "travel" });
  });

  it("a screenshot dropped on the board is checked the same way", async () => {
    await portugalTrip();
    pages = { "": robots };
    await saveImage("data:image/jpeg;base64,AAAA", "pt");
    await processPending(deps);
    expect(await names("pt")).toEqual(["Jardim Stay", "Casa Verde"]);
  });
});

describe("chooseTrip and the place check, alone", () => {
  const profiles = profileTrips([trip("pt", "Portekiz")], [item("pt", { countryCode: "PT", dates: { start: "2026-10-08", end: "2026-10-22", source: "url" } })]);
  const signal = { countryCode: "ID", country: "Endonezya", start: "2026-10-08", end: null, suggestedTripId: "pt", suggestedTitle: "Bali" };

  it("a far country never joins a trip because its dates touch it", () => {
    expect(chooseTrip(signal, profiles)).toEqual({ newTitle: "Bali" });
    expect(chooseTrip({ ...signal, countryCode: "ES", country: "İspanya" }, profiles)).toEqual({ tripId: "pt" });
  });

  it("fits: in, near, far, unknown", () => {
    expect(placeFit(["PT"], new Set(["PT", "ES"]))).toBe("in");
    expect(placeFit(["ES"], new Set(["PT"]))).toBe("near");
    expect(placeFit(["ID"], new Set(["PT"]))).toBe("far");
    expect(placeFit(["TR"], new Set(["PT"]))).toBe("far");
    expect(placeFit([], new Set(["PT"]))).toBe("unknown");
    expect(placeFit(["ID"], new Set())).toBe("unknown");
  });

  it("a flight home lands at home but leaves from the trip: it fits", () => {
    const items = [item("pt", { countryCode: "PT", city: "Porto" })];
    const home = item("pt", { id: "f", category: "flight", countryCode: "TR", flight: { from: "OPO", to: "IST", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } });
    expect(routeCapture({ item: home, merged: false, newTrip: false, anchorId: "pt", travel: true, trips: [trip("pt", "Portekiz")], items })).toEqual({ kind: "keep" });
  });
});
