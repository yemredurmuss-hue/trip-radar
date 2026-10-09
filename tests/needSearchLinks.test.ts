import { describe, expect, it } from "vitest";
import { needSearchLinks } from "../src/lib/searchLinks";
import { makeItem } from "./fixtures/makeItem";

describe("needSearchLinks (v11 Kendin ara)", () => {
  it("a stay's searches carry its city and nights", () => {
    const links = needSearchLinks(makeItem({ category: "stay", city: "Porto", dates: { start: "2026-10-08", end: "2026-10-11" } } as never), 2);
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((l) => l.url.includes("Porto") && l.url.includes("2026-10-08"))).toBe(true);
  });
  it("a flight's searches carry its ends and day", () => {
    const links = needSearchLinks(makeItem({ category: "flight", flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: null, carrier: null, flightNumber: null, stops: 0 } } as never), 2);
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((l) => /IST/.test(l.url) && /OPO/.test(l.url))).toBe(true);
  });
  it("nothing for a kind with no searches", () => {
    expect(needSearchLinks(makeItem({ category: "other" } as never), 2)).toEqual([]);
  });
});
