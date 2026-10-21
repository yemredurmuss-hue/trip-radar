// PNR on the card only on the travel day (plan-v29 show-when-needed; plan v13 Review Focus 5): the travel day is the
// departure's own, not the device's, so a laptop on Istanbul time still shows it an hour before a Tromsø departure.
import { describe, expect, it } from "vitest";
import { isTravelDay } from "../src/lib/ticketView";

const at = (s: string) => Date.parse(s);

describe("isTravelDay", () => {
  it("the departure's day on the device's calendar", () => {
    expect(isTravelDay("2027-01-14T08:10", "2027-01-14", "2027-01-14", at("2027-01-14T06:00:00"))).toBe(true);
  });
  it("Istanbul 00:30 on the 15th, Tromsø leaving 23:30 on the 14th (local): still its day", () => {
    expect(isTravelDay("2027-01-14T23:30", "2027-01-14", "2027-01-15", at("2027-01-15T00:30:00"))).toBe(true);
  });
  it("days before: not yet", () => {
    expect(isTravelDay("2027-01-14T08:10", "2027-01-14", "2027-01-11", at("2027-01-11T09:00:00"))).toBe(false);
  });
  it("two days after: no longer", () => {
    expect(isTravelDay("2027-01-14T08:10", "2027-01-14", "2027-01-16", at("2027-01-16T12:00:00"))).toBe(false);
  });
  it("no time known: the day alone", () => {
    expect(isTravelDay(null, "2027-01-14", "2027-01-14", at("2027-01-14T10:00:00"))).toBe(true);
    expect(isTravelDay(null, "2027-01-14", "2027-01-15", at("2027-01-15T00:30:00"))).toBe(false);
  });
});
