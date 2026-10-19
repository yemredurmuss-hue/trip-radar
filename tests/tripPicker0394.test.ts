// 0.39.4 (Emre: "eklenti doğru geziye gitsin, iki Hindistan varsa sorsun"): saved from the toolbar with more than one trip
// it could be and nothing that says which, it's asked under the button (and in Bekleyen kayıtlar), never put in one by a
// guess; dates that fall in one trip's go there unasked; no trip of its place makes a new one, as before. The done line
// can move it to another trip.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, listItems, listMessages } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { processPending, saveSnapshot, savePastedLink, type Deps } from "../src/lib/process";
import { answerHeld, moveToTrip } from "../src/lib/routing";
import { chooseTrip, profileTrips } from "../src/lib/trips";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const trip = (id: string, title: string, updatedAt = 1): Trip => ({ id, title, confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt });
const stay = (tripId: string, start: string, end: string) =>
  makeItem({ id: `s-${tripId}`, tripId, category: "stay", name: `Otel ${tripId}`, city: "Delhi", country: "Hindistan", countryCode: "IN", dates: { start, end, source: "url" } });

const page = (dates: { start: string | null; end: string | null }): Extraction => ({
  category: "activity", name: "Taj Mahal turu", provider: "Viator", summary: "", option_detail: null, city: "Agra", country: "Hindistan", country_code: "IN",
  location: { address: null, area: null, approximate: false }, dates: { ...dates, source: dates.start ? "url" : "none" }, guests: { adults: null, children: null, rooms: null },
  price: { amount: null, currency: null, scope: "unknown", taxes_included: "unknown", source: "none", evidence: null },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null }, rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null, metrics: null, highlights: [], concerns: [], review_summary: null, image_url: null, missing: [],
  trip: { existing_trip_id: null, new_trip_title: "Hindistan" }, need_key: "activity:agra",
});

let answer: Extraction = page({ start: null, end: null });
const deps: Deps = { extract: async () => answer, heroImage: async () => null, geocode: async () => null, home: async () => "TR" };
const snapshot = (url: string) => ({ url, title: "Taj Mahal", pageText: "", viewportText: "", selection: "", jsonLd: [], meta: {}, coords: [] });

beforeEach(async () => {
  const d = await db();
  for (const s of ["trips", "items", "captures", "messages"] as const) await d.clear(s);
  await d.put("trips", trip("in1", "Hindistan · Kasım", 2));
  await d.put("trips", trip("in2", "Hindistan · Mart", 1));
  await d.put("items", stay("in1", "2026-11-05", "2026-11-15"));
  await d.put("items", stay("in2", "2027-03-01", "2027-03-12"));
});

describe("which trip, from the toolbar", () => {
  it("chooseTrip: two that could be it → both, the most likely first; dates in one → that one alone", async () => {
    const d = await db();
    const profiles = profileTrips(await d.getAll("trips"), await d.getAll("items"));
    const sig = { countryCode: "IN", country: "Hindistan", start: null, end: null, suggestedTripId: null, suggestedTitle: null };
    expect(chooseTrip(sig, profiles)).toEqual({ tripId: "in1", candidates: ["in1", "in2"] });
    expect(chooseTrip({ ...sig, start: "2027-03-03", end: "2027-03-04" }, profiles)).toEqual({ tripId: "in2" });
    expect(chooseTrip({ ...sig, countryCode: "LK", country: "Sri Lanka" }, profiles)).toEqual({ newTitle: "Sri Lanka" });
  });
  it("an undated page: held and asked (nothing added), answered with the trip picked", async () => {
    answer = page({ start: null, end: null });
    const c = await saveSnapshot(snapshot("https://www.viator.com/tours/Agra/Taj/d1"), null);
    await processPending(deps);
    const held = (await (await db()).get("captures", c.id))!.held!;
    expect([held.reason, held.candidates]).toEqual(["trip", ["in1", "in2"]]);
    expect((await listItems("in1")).length + (await listItems("in2")).length).toBe(2);
    const asked = (await listMessages("")).find((m) => m.routing?.kind === "ask");
    expect(asked?.routing).toMatchObject({ reason: "trip", candidates: ["in1", "in2"] });
    expect(await answerHeld(c.id, "there", "in2")).toBe("in2");
    expect((await listItems("in2")).map((i) => i.name)).toContain("Taj Mahal turu");
  });
  it("dates that fall in one trip's: there, unasked; a trip's chat isn't asked either", async () => {
    answer = page({ start: "2026-11-08", end: "2026-11-08" });
    await saveSnapshot(snapshot("https://www.viator.com/tours/Agra/Taj/d2"), null);
    await processPending(deps);
    expect((await listItems("in1")).map((i) => i.name)).toContain("Taj Mahal turu");
    answer = page({ start: null, end: null });
    await savePastedLink("https://www.viator.com/tours/Agra/Taj/d3", undefined, "in2");
    await processPending(deps);
    expect((await (await db()).getAll("captures")).some((c) => c.held?.reason === "trip")).toBe(false);
  });
  it("'Başka geziye taşı' moves the record, its dates only where they fall in that trip", async () => {
    const it0 = makeItem({ id: "x", tripId: "in1", name: "Taj Mahal turu", dates: { start: "2026-11-08", end: null, source: "url" } });
    await (await db()).put("items", it0);
    await moveToTrip("x", "in2");
    const moved = (await (await db()).get("items", "x"))!;
    expect([moved.tripId, moved.dates.start]).toEqual(["in2", null]);
    expect((await listMessages("in2")).some((m) => m.role === "event" && /taşındı/.test(m.text))).toBe(true);
  });
});
