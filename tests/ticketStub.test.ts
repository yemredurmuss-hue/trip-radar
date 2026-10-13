// A flight ticket's stub and warnings (plan v46, F2): what each stage says, per person from the real passenger count, the
// booking code only on the flight's day, the "Uçuşa N gün · bilet alınmadı" warning, the estimate only from three real offers,
// "Aradığımız: direkt" only when the trip says it, the leg a flight option draws. Nothing is guessed.
import { afterEach, describe, expect, it } from "vitest";
import { flightLeg, flightWants, ticketPrices, ticketStub, ticketWarn } from "../src/lib/cardTicket";
import { estimatedRange } from "../src/lib/estRange";
import { setLang } from "../src/lib/i18n";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

afterEach(() => setLang("tr"));

const price = (amount: number | null, scope: Item["price"]["scope"] = "per_person") => ({ amount, currency: "EUR", scope, taxesIncluded: "unknown" as const, source: "page" as const, observedAt: 1 });
const flight = (over: Partial<Item> = {}, f: Partial<NonNullable<Item["flight"]>> = {}) =>
  makeItem({
    category: "flight",
    price: price(980),
    guests: { adults: 2, children: null, rooms: null },
    dates: { start: "2026-10-14", end: null, source: "page" },
    flight: { from: "LIS", to: "IST", departure: "2026-10-14T19:40", arrival: "2026-10-15T01:35", carrier: "TAP", flightNumber: "TP1760", stops: 0, ...f },
    ...over,
  });

const stubOf = (look: Parameters<typeof ticketStub>[0]["look"], item: Item, today = "2026-10-05", people: number | null = null) =>
  ticketStub({ look, item, prices: ticketPrices(item, undefined, people), people, today });

describe("the stub says the stage and only what is real", () => {
  it("the five looks and the searching one have their words", () => {
    const item = flight();
    expect(["search", "searching", "draft", "chosen", "booked", "arranged"].map((l) => stubOf(l as never, item).word)).toEqual(["Arıyoruz", "Aranıyor", "Önerimiz", "Seçildi", "Bilet alındı", "Ayarlandı"]);
  });
  it("English words too", () => {
    setLang("en");
    expect(["search", "searching", "draft", "chosen", "booked", "arranged"].map((l) => stubOf(l as never, flight()).word)).toEqual(["Searching", "Searching now", "Our pick", "Chosen", "Ticket bought", "Arranged"]);
  });
  it("a chosen flight for two: what one pays large, how many go and the whole sum small", () => {
    expect(stubOf("chosen", flight())).toMatchObject({ big: "€980", bigKind: "each", lines: ["kişi başı", "2 kişi · €1.960"], code: null });
  });
  it("the passenger count is the record's own, else the trip's, never a fixed two", () => {
    const total = flight({ price: price(300, "total"), guests: { adults: null, children: null, rooms: null } });
    expect(stubOf("chosen", total, "2026-10-05", 3)).toMatchObject({ big: "€100", lines: ["kişi başı", "3 kişi · €300"] });
    expect(stubOf("chosen", total, "2026-10-05", 1)).toMatchObject({ big: "€300", bigKind: "total", lines: ["toplam"] });
    expect(stubOf("chosen", flight({ price: price(300, "total"), guests: { adults: 2, children: null, rooms: null } }), "2026-10-05", 3)).toMatchObject({ big: "€150", lines: ["kişi başı", "2 kişi · €300"] });
  });
  it("a price whose scope is unknown falls back to the compared price as written; no price, nothing", () => {
    const unknown = flight({ price: price(980, "unknown") });
    expect(ticketStub({ look: "chosen", item: unknown, prices: ticketPrices(unknown), fallback: { text: "€1.960", label: "toplam" }, today: "2026-10-05" })).toMatchObject({ big: "€1.960", lines: ["toplam"] });
    const none = flight({ price: price(null) });
    expect(ticketStub({ look: "chosen", item: none, prices: ticketPrices(none), today: "2026-10-05" })).toMatchObject({ big: null, bigKind: null, lines: [] });
  });
});

describe("the booking code waits for the flight's day", () => {
  const booked = flight({ status: "booked", bookingRef: "ABC123" });
  it("nine days off: the price, no code", () => {
    expect(stubOf("booked", booked, "2026-10-05")).toMatchObject({ code: null, big: "€980", bigKind: "each" });
  });
  it("the day before: still none", () => {
    expect(stubOf("booked", booked, "2026-10-13").code).toBeNull();
  });
  it("on the day and after: the code, beside the price", () => {
    expect(stubOf("booked", booked, "2026-10-14")).toMatchObject({ code: "ABC123", big: "€980" });
    expect(stubOf("booked", booked, "2026-10-15").code).toBe("ABC123");
  });
  it("no code on the record, none shown; only a booked ticket has one", () => {
    expect(stubOf("booked", flight({ status: "booked" }), "2026-10-14").code).toBeNull();
    expect(stubOf("chosen", flight({ bookingRef: "ABC123" }), "2026-10-14").code).toBeNull();
  });
  it("a flight with no day known shows its code (nothing to wait for)", () => {
    const undated = flight({ status: "booked", bookingRef: "ABC123", dates: { start: null, end: null, source: "page" } }, { departure: null, arrival: null });
    expect(stubOf("booked", undated).code).toBe("ABC123");
  });
});

describe("an empty ticket's stub: an estimate only from three real prices", () => {
  const opts = (...amounts: number[]) => amounts.map((a) => flight({ status: "saved", price: price(a) }));
  it("two prices: no estimate, the real lowest price stays", () => {
    const two = opts(850, 1000);
    expect(estimatedRange(two)).toBeNull();
    expect(ticketStub({ look: "search", prices: null, estimate: estimatedRange(two), from: "€850", today: "2026-10-05" })).toMatchObject({ big: "€850'den", bigKind: "from" });
  });
  it("three prices: the range, per person, without a capsule's words", () => {
    const stub = ticketStub({ look: "search", prices: null, estimate: estimatedRange(opts(850, 920, 1000)), from: "€850", today: "2026-10-05" });
    expect(stub).toMatchObject({ bigKind: "estimate", lines: ["tahmini · kişi başı"] });
    expect(stub.big).toMatch(/850.*1\.000/);
  });
  it("nothing known: only the word", () => {
    expect(ticketStub({ look: "searching", prices: null, today: "2026-10-05" })).toEqual({ word: "Aranıyor", big: null, bigKind: null, lines: [], code: null });
  });
});

describe("the warning under a chosen flight that isn't bought", () => {
  const chosen = (departure: string) => flight({ status: "chosen", dates: { start: departure, end: null, source: "page" } }, { departure: `${departure}T10:00` });
  it("within 14 days it is amber: 'Uçuşa N gün · bilet alınmadı'", () => {
    expect(ticketWarn(chosen("2026-10-17"), "2026-10-05", "chosen")).toEqual({ tone: "amber", text: "Uçuşa 12 gün · bilet alınmadı" });
    expect(ticketWarn(chosen("2026-10-19"), "2026-10-05", "chosen")).toEqual({ tone: "amber", text: "Uçuşa 14 gün · bilet alınmadı" });
  });
  it("further off it is still said, plain", () => {
    expect(ticketWarn(chosen("2026-10-20"), "2026-10-05", "chosen")).toEqual({ tone: "plain", text: "Uçuşa 15 gün · bilet alınmadı" });
  });
  it("on the day: 'Uçuş bugün'; our pick says it too", () => {
    expect(ticketWarn(chosen("2026-10-05"), "2026-10-05", "chosen")?.text).toBe("Uçuş bugün · bilet alınmadı");
    expect(ticketWarn(chosen("2026-10-08"), "2026-10-05", "draft")?.text).toBe("Uçuşa 3 gün · bilet alınmadı");
  });
  it("never for what is bought, arranged or searched, nor once the day has begun or when no day is known", () => {
    for (const look of ["booked", "arranged", "search", "searching"] as const) expect(ticketWarn(chosen("2026-10-08"), "2026-10-05", look)).toBeNull();
    expect(ticketWarn(chosen("2026-10-01"), "2026-10-05", "chosen")).toBeNull();
    expect(ticketWarn(flight({ status: "chosen", dates: { start: null, end: null, source: "page" } }, { departure: null }), "2026-10-05", "chosen")).toBeNull();
  });
  it("in English", () => {
    setLang("en");
    expect(ticketWarn(chosen("2026-10-06"), "2026-10-05", "chosen")?.text).toBe("1 day to the flight · no ticket yet");
    expect(ticketWarn(chosen("2026-10-08"), "2026-10-05", "chosen")?.text).toBe("3 days to the flight · no ticket yet");
  });
});

describe("what we look for", () => {
  it("'direkt' only from a firm requirement or the traveller's own words", () => {
    expect(flightWants({ requirements: [{ kind: "direct_flight" }] })).toEqual(["direkt"]);
    expect(flightWants({ requirements: [] }, ["Direkt uçuş olsun"])).toEqual(["direkt"]);
    expect(flightWants({}, ["sakin semt"])).toEqual([]);
    expect(flightWants({ requirements: [{ kind: "free_cancellation" }] })).toEqual([]);
  });
  it("in English", () => {
    setLang("en");
    expect(flightWants({ requirements: [{ kind: "direct_flight" }] })).toEqual(["direct"]);
  });
});

describe("a flight option's leg", () => {
  it("hours, codes, how long, stops, and the day it lands (+1)", () => {
    const item = flight({ metrics: { ...makeItem().metrics!, durationMinutes: 295 } });
    expect(flightLeg(item)).toEqual({ dep: "19:40", arr: "01:35", plus: 1, from: "LIS", to: "IST", duration: "4 sa 55 dk", stops: { text: "Direkt", direct: true } });
  });
  it("a stop, and nothing where the record doesn't say (no stop place is invented)", () => {
    expect(flightLeg(flight({}, { stops: 1 })).stops).toEqual({ text: "1 aktarma", direct: false });
    const bare = flightLeg(flight({}, { stops: null, departure: null, arrival: null }));
    expect(bare).toMatchObject({ dep: null, arr: null, plus: null, duration: null, stops: null });
  });
});
