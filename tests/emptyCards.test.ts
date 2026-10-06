// Boş kartlar (spec 2026-10-06-bos-kartlar-design.md): which needs are drawn as the approved card made plain.
import { describe, expect, it } from "vitest";
import { activityGaps, bareChatFlight, isEmptyLeg, isEmptyRecord, needKey } from "../src/lib/emptyCards";
import type { Leg } from "../src/lib/legs";
import { placeholderPrint } from "../src/lib/startTrip";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const flight = (over: Partial<Item> = {}) =>
  makeItem({ category: "flight", status: "chosen", origin: "chat", name: "Uçuş · Denpasar", dates: { start: "2026-12-10", end: null, source: "unverified" },
    flight: { from: "İstanbul", to: "Denpasar", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null }, ...over });
const stay = (over: Partial<Item> = {}) =>
  makeItem({ category: "stay", status: "chosen", origin: "chat", name: "Konaklama · Ubud", city: "Ubud", dates: { start: "2026-12-10", end: "2026-12-22", source: "unverified" }, ...over });
const made = (...items: Item[]): Pick<Trip, "startGuide"> => ({ startGuide: { createdAt: 1, placeholders: Object.fromEntries(items.map((i) => [i.id, placeholderPrint(i)])) } });

describe("records with nothing chosen yet", () => {
  it("a flight or stay the start made room for is empty until the traveller changes it", () => {
    const f = flight();
    const s = stay();
    const trip = made(f, s);
    expect([isEmptyRecord(trip, f), isEmptyRecord(trip, s)]).toEqual([true, true]);
    // Changed (another day, booked): the start's print no longer matches, or it's booked: the full card.
    expect(isEmptyRecord(trip, { ...s, dates: { ...s.dates, end: "2026-12-20" } })).toBe(false);
    expect(isEmptyRecord(trip, { ...s, status: "booked" })).toBe(false);
  });
  it("a file on it (a ticket's PDF) or a booking makes it a full card", () => {
    const f = flight();
    const trip = made(f);
    expect(isEmptyRecord(trip, f, 0)).toBe(true);
    expect(isEmptyRecord(trip, f, 1)).toBe(false);
    expect(isEmptyRecord(trip, { ...f, status: "booked" })).toBe(false);
  });
  it("a flight said in the chat with no hour, number, carrier, price or page is empty; any of them makes it chosen", () => {
    const f = flight({ id: "said" });
    expect([bareChatFlight(f), isEmptyRecord({ startGuide: null }, f)]).toEqual([true, true]);
    expect(bareChatFlight({ ...f, flight: { ...f.flight!, departure: "2026-12-10T07:40" } })).toBe(false);
    expect(bareChatFlight({ ...f, flight: { ...f.flight!, flightNumber: "TK66" } })).toBe(false);
    expect(bareChatFlight({ ...f, flight: { ...f.flight!, carrier: "THY" } })).toBe(false);
    expect(bareChatFlight({ ...f, price: { ...f.price, amount: 312 } })).toBe(false);
    expect(bareChatFlight({ ...f, url: "https://example.com/f" })).toBe(false);
    // Saved from a page (not the chat), or only an option: never empty.
    expect(bareChatFlight({ ...f, origin: undefined })).toBe(false);
    expect(bareChatFlight({ ...f, status: "saved" })).toBe(false);
  });
  it("a stay said in the chat is empty only as the start's placeholder; other kinds never", () => {
    expect(isEmptyRecord({ startGuide: null }, stay())).toBe(false);
    const car = makeItem({ category: "transport", status: "chosen", origin: "chat" });
    expect(isEmptyRecord(made(car), car)).toBe(false);
  });
});

const leg = (over: Partial<Leg> = {}): Leg => ({
  key: "2026-12-10:arrival", kind: "arrival", date: "2026-12-10", slot: 0,
  from: { label: "Denpasar havalimanı", city: "Denpasar", item: null }, to: { label: "Konaklama", city: "Ubud", item: null },
  after: null, before: null, options: [], mode: null, via: "flight", travel: null, status: "empty", statusText: "", choice: null, notes: [],
  ...over,
});

describe("transfers with no plan", () => {
  it("nothing said, nothing saved: empty", () => expect(isEmptyLeg(leg())).toBe(true));
  it("a way said, arranged, booked, options saved or a record of its own: the full card", () => {
    expect(isEmptyLeg(leg({ choice: { mode: "metro", booked: false, note: null, updatedAt: 1 } }))).toBe(false);
    expect(isEmptyLeg(leg({ mode: "taxi" }))).toBe(false);
    expect(isEmptyLeg(leg({ status: "planned" }))).toBe(false);
    expect(isEmptyLeg(leg({ status: "booked" }))).toBe(false);
    expect(isEmptyLeg(leg({ status: "options", options: [makeItem()] }))).toBe(false);
    expect(isEmptyLeg(leg({ options: [makeItem({ status: "booked" })] }))).toBe(false);
  });
});

describe("Etkinlikler: a card per city with nothing booked there", () => {
  const block = (city: string | null, start: string, end: string) => ({ city, range: { start, end } }) as never;
  const plan = { stayBlocks: [block("Ubud", "2026-12-10", "2026-12-22"), block("Canggu", "2026-12-22", "2027-01-01"), block("Ubud", "2027-01-01", "2027-01-05"), block(null, "2027-01-05", "2027-01-06")] };
  it("each city once, in the trip's order, over all its nights", () => {
    expect(activityGaps(plan, [])).toEqual([
      { city: "Ubud", range: { start: "2026-12-10", end: "2027-01-05" } },
      { city: "Canggu", range: { start: "2026-12-22", end: "2027-01-01" } },
    ]);
  });
  it("a city with an activity there has none; a ruled-out one or an idea doesn't count", () => {
    const tour = makeItem({ category: "activity", city: "Ubud", status: "saved", price: { amount: 40, currency: "EUR", scope: "total", taxesIncluded: "unknown", source: "page", observedAt: 1 } });
    expect(activityGaps(plan, [tour]).map((g) => g.city)).toEqual(["Canggu"]);
    expect(activityGaps(plan, [{ ...tour, status: "dismissed" }]).map((g) => g.city)).toEqual(["Ubud", "Canggu"]);
    const idea = makeItem({ category: "activity", city: "Canggu", booking: "none", plannedKind: "todo" });
    expect(activityGaps(plan, [idea]).map((g) => g.city)).toEqual(["Ubud", "Canggu"]);
  });
  it("no stays, no cards", () => expect(activityGaps({ stayBlocks: [] }, [])).toEqual([]));
});

describe("need keys", () => {
  it("stable, lower-cased, empty parts kept in place", () => {
    expect(needKey("flight", null, "Denpasar", "2026-12-10")).toBe("flight::denpasar:2026-12-10");
    expect(needKey("stay", " Ubud ", "2026-12-10")).toBe("stay:ubud:2026-12-10");
  });
});
