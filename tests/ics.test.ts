// "Takvime ekle" (lib/ics.ts, Kaçırdıklarımız: iptal son günü): the stay's nights all day, the free-cancel day with a
// reminder three days before, a ticket at its hour; nothing without a day.
import { describe, expect, it } from "vitest";
import { bookingIcs, icsName } from "../src/lib/ics";
import { thailand } from "./fixtures/thailand";

const NOW = Date.parse("2026-10-21T12:00:00Z");

describe("bookingIcs", () => {
  const { by } = thailand();
  it("a stay: its nights all day, its free-cancel day with an alarm 3 days before", () => {
    const ics = bookingIcs({ ...by.rimping, bookingRef: "4418, A" }, NOW)!;
    expect(ics).toContain("DTSTART;VALUE=DATE:20270327\r\nDTEND;VALUE=DATE:20270330");
    expect(ics).toContain("SUMMARY:Rimping Village · 4418\\, A");
    expect(ics).toContain("SUMMARY:Ücretsiz iptalin son günü: Rimping Village");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270320");
    expect(ics).toContain("TRIGGER:-P3D");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
  it("a flight at its hour; no free-cancel day, no second event", () => {
    const ics = bookingIcs(by.cnx, NOW)!;
    expect(ics).toContain("DTSTART:20270327T202000\r\nDTEND:20270327T213500");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
  it("a passed free-cancel day isn't remembered; no day, no file", () => {
    expect(bookingIcs(by.rimping, Date.parse("2027-03-25T12:00:00Z"))!.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(bookingIcs({ ...by.rimping, dates: { start: null, end: null, source: "none" } }, NOW)).toBeNull();
    expect(icsName({ name: "A/B: Hotel" })).toBe("A B Hotel.ics");
  });
});
