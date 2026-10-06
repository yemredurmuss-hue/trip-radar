// Where to look next (0.35.11): a one-way flight offers the way home; Etkinlikler a GetYourGuide search per
// city; a booking with no file says "Belge eksik".
import { describe, expect, it } from "vitest";
import { needsDoc } from "../src/lib/docs";
import { activityLinks, activitySearches, airportCode, BRANDS, esimLinks, flightLinks, headCount, returnFlightSearch, stayLinks, transferLinks } from "../src/lib/searchLinks";
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

// Boş kartlar (spec 2026-10-06-bos-kartlar-design.md): the branded searches, prefilled, every value encoded.
const urls = (links: { url: string }[]) => links.map((l) => l.url);

describe("flight searches", () => {
  it("Google Flights, Skyscanner and Kayak with codes, the day and how many go", () => {
    const links = flightLinks({ from: "IST", to: "AMS", date: "2026-12-10", adults: 2 });
    expect(links.map((l) => l.brand)).toEqual(["gflights", "skyscanner", "kayak"]);
    expect(links.map((l) => l.label)).toEqual(["Google Flights", "Skyscanner", "Kayak"]);
    expect(decodeURIComponent(links[0].url)).toBe("https://www.google.com/travel/flights?q=Flights from İstanbul to Amsterdam on 2026-12-10 one way");
    expect(links[1].url).toBe("https://www.skyscanner.net/transport/flights/ist/ams/261210/?adultsv2=2&rtn=0");
    expect(links[2].url).toBe("https://www.kayak.com/flights/IST-AMS/2026-12-10/2adults");
  });
  it("a city the table knows gets its airport; one it doesn't leaves Skyscanner and Kayak out", () => {
    expect(urls(flightLinks({ from: "İstanbul", to: "Denpasar", date: "2026-12-10", adults: 2 })).slice(1)).toEqual([
      "https://www.skyscanner.net/transport/flights/ist/dps/261210/?adultsv2=2&rtn=0",
      "https://www.kayak.com/flights/IST-DPS/2026-12-10/2adults",
    ]);
    const unknown = flightLinks({ from: "İstanbul", to: "Ouarzazate", date: "2026-12-10", adults: 2 });
    expect(unknown.map((l) => l.brand)).toEqual(["gflights"]);
    expect(decodeURIComponent(unknown[0].url)).toContain("to Ouarzazate on 2026-12-10");
  });
  it("one end known: Google Flights alone; neither: nothing", () => {
    expect(flightLinks({ from: "Porto", to: null, date: "2026-10-14", adults: 2 }).map((l) => decodeURIComponent(l.url))).toEqual([
      "https://www.google.com/travel/flights?q=Flights from Porto on 2026-10-14 one way",
    ]);
    expect(flightLinks({ from: " ", to: null, date: "2026-10-14", adults: 2 })).toEqual([]);
  });
  it("no day: only Google Flights, without one; no end: nothing", () => {
    const links = flightLinks({ from: "IST", to: "AMS", date: null, adults: 2 });
    expect(links.map((l) => l.brand)).toEqual(["gflights"]);
    expect(decodeURIComponent(links[0].url)).toBe("https://www.google.com/travel/flights?q=Flights from İstanbul to Amsterdam one way");
    expect(flightLinks({ from: "IST", to: "AMS", date: "2026-13-40", adults: 2 }).map((l) => l.brand)).toEqual(["gflights"]);
    expect(flightLinks({ from: null, to: null, date: "2026-12-10", adults: 2 })).toEqual([]);
    expect(flightLinks({ from: "", to: "  ", date: "2026-12-10", adults: 2 })).toEqual([]);
  });
  it("how many go: none is one on Skyscanner and nothing on Kayak; more than nine is nine", () => {
    const [, sky, kayak] = flightLinks({ from: "IST", to: "AMS", date: "2026-12-10", adults: null });
    expect(sky.url).toContain("adultsv2=1");
    expect(kayak.url).toBe("https://www.kayak.com/flights/IST-AMS/2026-12-10");
    expect(flightLinks({ from: "IST", to: "AMS", date: "2026-12-10", adults: 14 })[2].url).toMatch(/\/9adults$/);
    expect([headCount(0), headCount(-1), headCount(NaN), headCount(2.7), headCount(null)]).toEqual([null, null, null, 2, null]);
  });
  it("words are encoded: nothing in a place name can add a parameter", () => {
    const [g] = flightLinks({ from: "A&b=c", to: "X?y#z", date: "2026-12-10", adults: 2 });
    expect(new URL(g.url).searchParams.get("q")).toBe("Flights from A&b=c to X?y#z on 2026-12-10 one way");
    expect([...new URL(g.url).searchParams.keys()]).toEqual(["q"]);
  });
  it("airport codes: a code as it is, a known city (either language), else null", () => {
    expect([airportCode("SAW"), airportCode("Lizbon"), airportCode("Lisbon"), airportCode("Bali"), airportCode("Xyz"), airportCode(""), airportCode(null)]).toEqual(["SAW", "LIS", "LIS", "DPS", null, null, null]);
  });
});

describe("stay searches", () => {
  it("Booking and Airbnb with the place, the nights and how many go", () => {
    const [booking, airbnb] = stayLinks({ city: "Amsterdam", checkin: "2026-12-10", checkout: "2026-12-17", adults: 2 });
    expect(booking).toEqual({ brand: "booking", label: "Booking", url: "https://www.booking.com/searchresults.html?ss=Amsterdam&checkin=2026-12-10&checkout=2026-12-17&group_adults=2&no_rooms=1" });
    expect(airbnb).toEqual({ brand: "airbnb", label: "Airbnb", url: "https://www.airbnb.com/s/Amsterdam/homes?checkin=2026-12-10&checkout=2026-12-17&adults=2" });
  });
  it("dates that don't make a stay are left out, a place with spaces or slashes is encoded, no place is nothing", () => {
    const [booking, airbnb] = stayLinks({ city: "São Paulo/Centro", checkin: "2026-12-17", checkout: "2026-12-10", adults: null });
    expect(booking.url).toBe("https://www.booking.com/searchresults.html?ss=S%C3%A3o+Paulo%2FCentro&no_rooms=1");
    expect(airbnb.url).toBe("https://www.airbnb.com/s/S%C3%A3o%20Paulo%2FCentro/homes");
    expect(stayLinks({ city: null, checkin: "2026-12-10", checkout: "2026-12-17", adults: 2 })).toEqual([]);
  });
});

describe("transfer searches", () => {
  it("Uber's universal link with both ends, and Google Maps directions said Yol tarifi", () => {
    const [uber, maps] = transferLinks({ from: "Denpasar Havalimanı", to: "Ubud" });
    expect(uber.url).toBe("https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=Denpasar%20Havaliman%C4%B1&dropoff[formatted_address]=Ubud");
    expect(maps).toEqual({ brand: "maps", label: "Yol tarifi", url: "https://www.google.com/maps/dir/?api=1&origin=Denpasar+Havaliman%C4%B1&destination=Ubud" });
  });
  it("no start: Uber picks you up where you are, the map starts from you; no end: nothing", () => {
    const [uber, maps] = transferLinks({ from: null, to: "Rua A & B" });
    expect(uber.url).toBe("https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=Rua%20A%20%26%20B");
    expect(maps.url).toBe("https://www.google.com/maps/dir/?api=1&destination=Rua+A+%26+B");
    expect(transferLinks({ from: "X", to: null })).toEqual([]);
  });
});

describe("activity and eSIM searches", () => {
  it("GetYourGuide, Viator and Klook by city", () => {
    expect(urls(activityLinks("Amsterdam"))).toEqual([
      "https://www.getyourguide.com/s/?q=Amsterdam",
      "https://www.viator.com/searchResults/all?text=Amsterdam",
      "https://www.klook.com/search/result/?query=Amsterdam",
    ]);
    expect(urls(activityLinks("Ponta Delgada"))[1]).toBe("https://www.viator.com/searchResults/all?text=Ponta%20Delgada");
    expect(activityLinks(" ")).toEqual([]);
  });
  it("Airalo and Holafly country pages; the sites' own names where they differ; nothing for no country", () => {
    expect(urls(esimLinks("NL"))).toEqual(["https://www.airalo.com/netherlands-esim", "https://esim.holafly.com/esim-netherlands/"]);
    expect(urls(esimLinks("id"))).toEqual(["https://www.airalo.com/indonesia-esim", "https://esim.holafly.com/esim-indonesia/"]);
    expect(urls(esimLinks("US"))).toEqual(["https://www.airalo.com/united-states-esim", "https://esim.holafly.com/esim-usa/"]);
    expect(urls(esimLinks("TR"))).toEqual(["https://www.airalo.com/turkey-esim", "https://esim.holafly.com/esim-turkey/"]);
    expect(urls(esimLinks("AE"))[0]).toBe("https://www.airalo.com/united-arab-emirates-esim");
    expect([esimLinks(null), esimLinks("Netherlands"), esimLinks("ZZ")]).toEqual([[], [], []]);
  });
  it("every brand has a name, a colour and one letter", () => {
    for (const b of Object.values(BRANDS)) {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(b.letter).toHaveLength(1);
    }
  });
});
