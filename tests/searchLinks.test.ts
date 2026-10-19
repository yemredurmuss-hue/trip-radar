// The branded searches (boş kartlar, "Kendin ara"); a booking with no file says "Belge eksik".
import { describe, expect, it } from "vitest";
import { needsDoc } from "../src/lib/docs";
import { activityLinks, airportCode, BRANDS, esimLinks, flightLinks, flightPlace, headCount, stayLinks, transferLinks } from "../src/lib/searchLinks";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const flight = (from: string, to: string, day: string, status: Item["status"] = "booked") =>
  makeItem({ name: `${from}-${to}`, category: "flight", status, dates: { start: day, end: null, source: "page" }, flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 } });

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
    expect(decodeURIComponent(links[0].url)).toBe("https://www.google.com/travel/flights?q=Flights from IST to AMS on 2026-12-10 one way");
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
  it("Google Flights gets codes, a country's main airport, a town as said; a word for no place yet is left out (0.39.4)", () => {
    const q = (from: string | null, to: string | null) => new URL(flightLinks({ from, to, date: "2026-12-10", adults: 2 })[0].url).searchParams.get("q");
    // Sri Lanka → India: the Turkish names sent Google to Explore without the day.
    expect(q("Kolombo", "Hindistan")).toBe("Flights from CMB to DEL on 2026-12-10 one way");
    expect(q("Sri Lanka", "India")).toBe("Flights from CMB to DEL on 2026-12-10 one way");
    expect(q("Kolombo Havalimanı", "OPO havalimanı")).toBe("Flights from CMB to OPO on 2026-12-10 one way");
    expect(q("Denpasar (DPS)", "Sabiha Gökçen")).toBe("Flights from DPS to SAW on 2026-12-10 one way");
    // A town with no airport: as said, Google finds its nearest ("Ahangama" → CMB); "Varış" is no place: that end is left out.
    expect(q("Ahangama", "Varış")).toBe("Flights from Ahangama on 2026-12-10 one way");
    expect(flightLinks({ from: "Dönüş", to: "Havalimanı", date: "2026-12-10", adults: 2 })).toEqual([]);
    // A country the airport table has no airport for: its English name.
    expect(q("IST", "Laos")).toBe("Flights from IST to Laos on 2026-12-10 one way");
    expect(flightPlace("Kolombo")).toBe("CMB");
  });
  it("one end known: Google Flights alone; neither: nothing", () => {
    expect(flightLinks({ from: "Porto", to: null, date: "2026-10-14", adults: 2 }).map((l) => decodeURIComponent(l.url))).toEqual([
      "https://www.google.com/travel/flights?q=Flights from OPO on 2026-10-14 one way",
    ]);
    expect(flightLinks({ from: " ", to: null, date: "2026-10-14", adults: 2 })).toEqual([]);
  });
  it("no day: only Google Flights, without one; no end: nothing", () => {
    const links = flightLinks({ from: "IST", to: "AMS", date: null, adults: 2 });
    expect(links.map((l) => l.brand)).toEqual(["gflights"]);
    expect(decodeURIComponent(links[0].url)).toBe("https://www.google.com/travel/flights?q=Flights from IST to AMS one way");
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
    // D12: the children who go and the rooms said.
    const [family, home] = stayLinks({ city: "Lizbon", checkin: "2026-12-10", checkout: "2026-12-17", adults: 4, children: 4, rooms: 2 });
    expect(family.url).toBe("https://www.booking.com/searchresults.html?ss=Lizbon&checkin=2026-12-10&checkout=2026-12-17&group_adults=4&group_children=4&no_rooms=2");
    expect(home.url).toBe("https://www.airbnb.com/s/Lizbon/homes?checkin=2026-12-10&checkout=2026-12-17&adults=4&children=4");
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
    expect([urls(esimLinks("HK"))[0], urls(esimLinks("MO"))[0], urls(esimLinks("MM"))[1]]).toEqual(["https://www.airalo.com/hong-kong-esim", "https://www.airalo.com/macau-esim", "https://esim.holafly.com/esim-myanmar/"]);
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
