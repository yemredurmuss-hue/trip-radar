import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { dateBox, spanText } from "../src/lib/storyDates";

describe("dateBox", () => {
  beforeEach(() => setLang("tr"));
  it("reads the ISO day without a time zone moving it", () => {
    const b = dateBox("2027-04-01", "2027-04-01")!;
    expect(b.day).toBe(1);
    expect(b.dayNo).toBe(1);
    expect(b.iso).toBe("2027-04-01");
    expect(b.weekday.toLowerCase().startsWith("per")).toBe(true);
  });
  it("counts the trip's days from its first", () => {
    expect(dateBox("2027-04-16", "2027-04-01")!.dayNo).toBe(16);
  });
  it("has no day number without a first day", () => {
    expect(dateBox("2027-04-08", null)!.dayNo).toBeNull();
  });
  it("is null for something that isn't a day", () => {
    expect(dateBox(null, "2027-04-01")).toBeNull();
    expect(dateBox("yarın", "2027-04-01")).toBeNull();
  });
  it("takes the day of a date-time", () => {
    expect(dateBox("2027-04-06T10:00:00", "2027-04-01")!.dayNo).toBe(6);
  });
});

describe("spanText", () => {
  beforeEach(() => setLang("tr"));
  it("says dates, weekdays and trip days", () => {
    const t = spanText("2027-04-01", "2027-04-06", "2027-04-01");
    expect(t).toContain("1–6");
    expect(t).toContain("Gün 1–6");
  });
  it("names both months when the stretch crosses one", () => {
    expect(spanText("2027-03-30", "2027-04-02", "2027-03-30")).toContain("30 ");
  });
  it("is one day when there is no end", () => {
    expect(spanText("2027-04-01", null, "2027-04-01")).toContain("Gün 1");
    expect(spanText("2027-04-01", null, "2027-04-01")).not.toContain("–");
  });
  it("speaks English too", () => {
    setLang("en");
    expect(spanText("2027-04-01", "2027-04-06", "2027-04-01")).toContain("Day 1–6");
  });
});
