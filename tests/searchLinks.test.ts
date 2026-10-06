// Where to look next (0.35.11): a one-way flight offers the way home; Etkinlikler a GetYourGuide search per
// city; a booking with no file says "Belge eksik".
import { describe, expect, it } from "vitest";
import { needsDoc } from "../src/lib/docs";
import { activitySearches, returnFlightSearch } from "../src/lib/searchLinks";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const flight = (from: string, to: string, day: string, status: Item["status"] = "booked") =>
  makeItem({ name: `${from}-${to}`, category: "flight", status, dates: { start: day, end: null, source: "page" }, flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 } });
const plan = {
  range: { start: "2026-10-08", end: "2026-10-14" },
  stayBlocks: [{ city: "Porto" }, { city: "Lizbon" }, { city: "Porto" }],
} as never;

describe("Dönüş bileti ara", () => {
  it("one way: from the trip's last city home, on its last day", () => {
    const link = returnFlightSearch([flight("IST", "OPO", "2026-10-08")], plan)!;
    expect(link.label).toBe("Dönüş bileti ara · Porto → İstanbul");
    expect(decodeURIComponent(link.url)).toBe("https://www.google.com/travel/flights?q=Flights from Porto to İstanbul on 2026-10-14 one way");
  });
  it("nothing when the way home is there, or no flight is decided yet", () => {
    expect(returnFlightSearch([flight("IST", "OPO", "2026-10-08"), flight("LIS", "IST", "2026-10-14", "chosen")], plan)).toBeNull();
    expect(returnFlightSearch([flight("IST", "OPO", "2026-10-08", "saved")], plan)).toBeNull();
    expect(returnFlightSearch([], plan)).toBeNull();
  });
  it("the way home booked while the way out is still being decided: no 'Lizbon → Lizbon'", () => {
    const lisbon = { range: { start: "2026-10-08", end: "2026-10-14" }, stayBlocks: [{ city: "Porto" }, { city: "Lizbon" }] } as never;
    expect(returnFlightSearch([flight("IST", "OPO", "2026-10-08", "saved"), flight("LIS", "IST", "2026-10-14")], lisbon)).toBeNull();
  });
});

describe("GetYourGuide per city", () => {
  it("each city once, in the trip's order", () => {
    expect(activitySearches(plan).map((s) => [s.label, s.url])).toEqual([
      ["Porto etkinliklerini ara", "https://www.getyourguide.com/s/?q=Porto"],
      ["Lizbon etkinliklerini ara", "https://www.getyourguide.com/s/?q=Lizbon"],
    ]);
  });
});

describe("Belge eksik", () => {
  it("a booking (a flight, a stay, a tour, insurance) wants its file; an idea, a table or a plan not booked doesn't", () => {
    expect(needsDoc(flight("IST", "OPO", "2026-10-08"))).toBe(true);
    expect(needsDoc(makeItem({ category: "stay", status: "booked" }))).toBe(true);
    expect(needsDoc(makeItem({ category: "stay", status: "chosen" }))).toBe(false);
    expect(needsDoc(makeItem({ category: "food", status: "booked", booking: "needed" }))).toBe(false);
    expect(needsDoc(makeItem({ category: "activity", status: "booked", booking: "none", plannedKind: "todo" }))).toBe(false);
  });
});
