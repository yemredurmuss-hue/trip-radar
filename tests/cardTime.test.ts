import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { warnsOnCard, cancelLineOf, checkInNote, checkInTimeOf, daysToStart, showBookingRef } from "../src/lib/cardTime";

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
  it("waits until the flight's day", () => {
    expect(showBookingRef(flight("2027-04-01T01:55"), "2027-03-01")).toBe(false);
    expect(showBookingRef(flight("2027-04-01T01:55"), "2027-03-29")).toBe(false);
    expect(showBookingRef(flight("2027-04-01T01:55"), "2027-03-31")).toBe(false); // the day before: still "Rezerve · toplam"
  });
  it("shows on the day and after", () => {
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
  it("green while far, amber within 14 days, orange-red within 7 with the days left, red on the last day", () => {
    const at = (today: string) => cancelLineOf(cancel({ cancellation: { summary: null, freeUntil: "2027-03-20", source: "page" } }), today);
    expect(at("2027-03-05")?.tone).toBe("ok"); // 15
    expect(at("2027-03-06")).toMatchObject({ tone: "soon", text: "Ücretsiz iptal · 20 Mart'e kadar" }); // 14
    expect(at("2027-03-13")).toMatchObject({ tone: "near", text: "İptale 7 gün · son gün 20 Mart" }); // 7
    expect(at("2027-03-17")).toMatchObject({ tone: "near", text: "İptale 3 gün · son gün 20 Mart" });
    expect(at("2027-03-20")).toEqual({ tone: "red", text: "İptal bugün biter" });
  });
  it("says it in English too", () => {
    setLang("en");
    expect(cancelLineOf(cancel({ cancellation: { summary: null, freeUntil: "2027-03-20", source: "page" } }), "2027-03-17")?.text).toMatch(/^3 days to cancel · last day /);
    expect(cancelLineOf(cancel({ cancellation: { summary: null, freeUntil: "2027-03-20", source: "page" } }), "2027-03-20")?.text).toBe("Cancellation ends today");
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

describe("checkInNote", () => {
  beforeEach(() => setLang("tr"));
  const booked = (start: string, end: string | null = null) => ({ status: "booked", flight: null, dates: { start, end } }) as never;
  const house = { checkInFrom: "15:00" };
  it("stays quiet more than 2 days before the stay", () => {
    expect(checkInNote(booked("2027-04-08"), "2027-04-05", house)).toBeNull(); // 3 days
  });
  it("speaks from 2 days before: the check-in time the record knows", () => {
    expect(checkInNote(booked("2027-04-08"), "2027-04-06", house)).toBe("Giriş saati 15:00"); // 2
    expect(checkInNote(booked("2027-04-08", "2027-04-11"), "2027-04-08", house)).toBe("Giriş saati 15:00"); // the day
  });
  it("never invents a time", () => {
    expect(checkInNote(booked("2027-04-08"), "2027-04-07", null)).toBeNull();
    expect(checkInNote(booked("2027-04-08"), "2027-04-07", { checkInFrom: null })).toBeNull();
  });
  it("is for a booking only, and ends with the stay", () => {
    expect(checkInNote({ status: "chosen", flight: null, dates: { start: "2027-04-08", end: null } } as never, "2027-04-07", house)).toBeNull();
    expect(checkInNote(booked("2027-04-08", "2027-04-10"), "2027-04-12", house)).toBeNull();
  });
  it("reads a time on the first night when the page gave none", () => {
    expect(checkInTimeOf({ dates: { start: "2027-04-08T14:30", end: null } } as never, null)).toBe("14:30");
    expect(checkInTimeOf({ dates: { start: "2027-04-08", end: null } } as never, { checkInFrom: "from 3 pm" })).toBeNull();
  });
});

describe("warnsOnCard (F3 plain stay card)", () => {
  it("keeps the fact and the near dates on the card; a far-off free cancellation waits in the balloon", () => {
    const at = (until: string) => cancelLineOf(cancel({ cancellation: { summary: null, freeUntil: until, source: "page" } }), "2027-03-01")!;
    expect(warnsOnCard(at("2027-03-01"))).toBe(true);
    expect(warnsOnCard(at("2027-03-05"))).toBe(true);
    expect(warnsOnCard(at("2027-03-30"))).toBe(false);
    expect(warnsOnCard(cancelLineOf(cancel({ cancellation: { summary: "Non-refundable", freeUntil: null, source: "page" } }), "2027-03-01")!)).toBe(true);
  });
});
