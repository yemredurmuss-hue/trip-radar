import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { cancelLineOf, daysToStart, showBookingRef } from "../src/lib/cardTime";

const flight = (departure: string | null) => ({ flight: departure ? ({ departure } as never) : null, dates: { start: null, end: null } }) as never;
const stay = (start: string | null) => ({ flight: null, dates: { start, end: null } }) as never;
const cancel = (over: Record<string, unknown>) => ({ status: "chosen", cancellation: { summary: null, freeUntil: null, source: "page" }, refundNote: null, ...over }) as never;

describe("daysToStart", () => {
  it("counts from today to the flight's day", () => {
    expect(daysToStart(flight("2027-04-01T01:55"), "2027-03-20")).toBe(12);
  });
  it("takes a stay's first night when there is no flight", () => {
    expect(daysToStart(stay("2027-04-08"), "2027-04-06")).toBe(2);
  });
  it("is null with no day", () => {
    expect(daysToStart(stay(null), "2027-04-06")).toBeNull();
  });
});

describe("showBookingRef", () => {
  it("waits while the flight is far", () => {
    expect(showBookingRef(flight("2027-04-01T01:55"), "2027-03-01")).toBe(false);
    expect(showBookingRef(flight("2027-04-01T01:55"), "2027-03-29")).toBe(false);
  });
  it("shows from the day before, on the day and after", () => {
    expect(showBookingRef(flight("2027-04-01T01:55"), "2027-03-31")).toBe(true);
    expect(showBookingRef(flight("2027-04-01T01:55"), "2027-04-01")).toBe(true);
    expect(showBookingRef(flight("2027-04-01T01:55"), "2027-04-05")).toBe(true);
  });
  it("shows when no day is known", () => {
    expect(showBookingRef(flight(null), "2027-03-01")).toBe(true);
  });
});

describe("cancelLineOf", () => {
  beforeEach(() => setLang("tr"));
  it("says free cancellation until a date that hasn't passed", () => {
    const l = cancelLineOf(cancel({ cancellation: { summary: null, freeUntil: "2027-03-20", source: "page" } }), "2027-03-01");
    expect(l?.tone).toBe("ok");
    expect(l?.text).toContain("20");
  });
  it("is silent once the date has passed", () => {
    expect(cancelLineOf(cancel({ cancellation: { summary: null, freeUntil: "2027-03-20", source: "page" } }), "2027-03-25")).toBeNull();
  });
  it("says no refund when the page says so and gives no date", () => {
    expect(cancelLineOf(cancel({ cancellation: { summary: "İade yok", freeUntil: null, source: "page" } }), "2027-03-01")?.tone).toBe("no");
    expect(cancelLineOf(cancel({ refundNote: "Non-refundable rate" }), "2027-03-01")?.tone).toBe("no");
  });
  it("has no line for a booking (its alert speaks in the last two weeks)", () => {
    expect(cancelLineOf(cancel({ status: "booked", cancellation: { summary: null, freeUntil: "2027-03-20", source: "page" } }), "2027-03-01")).toBeNull();
  });
  it("is silent when nothing is known", () => {
    expect(cancelLineOf(cancel({}), "2027-03-01")).toBeNull();
  });
});
