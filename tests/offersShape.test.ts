// The offers function's rules (supabase/functions/offers/shape.ts): what may be asked, the sources' answers picked
// and turned into offers. Answers below are trimmed from real ones (İstanbul → Bali, Ubud, 6 Oct 2026).
import { describe, expect, it } from "vitest";
import {
  adultsOf, airportCodeOk, arrivalClock, askableDay, bookingSearch, cheapest, flightOffer, geoFromTypeahead, localClock, maxOf,
  aviasalesSearch, durationWords, pickActivities, viatorDestination, nightsBetween, pickCandidates, pickCheapFlights, pickCheapStays, pickFlights, pickLiveStays, pickStays, placeOk, preferOf, seenAt, serpFlights,
  serpStays, serpMinutes, nearbyOf, topicsOf, candidateOffer, priceInsightOf, logInsight, topSights, nightStop, dayFares, airbnbOffer, airbnbCandidate, cityEvents, eventDay, stayCandidate, stayOffer, airaloPacks, airaloPlace, pickEsims, csvRows, omioPage, omioRoutes, pickTransfers, placeKey, omioName, ucusFlights, type OmioRoute, type AviaFlight, type EsimPack,
  type OfferOut, type XoHotel,
} from "../supabase/functions/offers/shape";
import serpHotels from "./fixtures/serp/google-hotels-2026-10-19.json";
import serpFlight from "./fixtures/serp/google-flights-ist-opo-2026-10-19.json";
import serpSights from "./fixtures/serp/google-top-sights-porto-2026-10-19.json";
import serpAirbnb from "./fixtures/serp/airbnb-lisbon-2026-10-19.json";
import serpEvents from "./fixtures/serp/google-events-porto-2026-10-19.json";

const now = new Date("2026-10-06T18:00:00Z");
const link = (d: string) => `/search/IST1911DPS1?t=TK&search_date=${d}&expected_price=521`;
const fl = (o: Partial<AviaFlight>): AviaFlight => ({
  origin_airport: "IST", destination_airport: "DPS", airline: "TK", flight_number: "66", departure_at: "2026-11-19T02:25:00+03:00",
  transfers: 1, duration_to: 1000, price: 400, link: link("05102026"), ...o,
});

describe("what may be asked", () => {
  it("takes a day from today to a year ahead", () => {
    expect(askableDay("2026-11-10", now)).toBe("2026-11-10");
    expect(askableDay("2026-10-06", now)).toBe("2026-10-06");
    expect(askableDay("2026-10-05", now)).toBeNull();
    expect(askableDay("2027-12-01", now)).toBeNull();
    expect(askableDay("10.11.2026", now)).toBeNull();
  });
  it("takes three-letter codes, head-counts 1–9 and plain place names", () => {
    expect(airportCodeOk("dps")).toBe("DPS");
    expect(airportCodeOk("Bali")).toBeNull();
    expect(adultsOf("2")).toBe(2);
    expect(adultsOf("40")).toBe(1);
    expect(adultsOf(null)).toBe(1);
    expect(placeOk("  Ubud ")).toBe("Ubud");
    expect(placeOk("İstanbul")).toBe("İstanbul");
    expect(placeOk("a<script>")).toBeNull();
    expect(nightsBetween("2026-11-12", "2026-11-16")).toBe(4);
  });
});

describe("flights", () => {
  it("reads the clocks: leaving as the airport shows it, landing in the destination's zone", () => {
    expect(localClock("2026-11-19T02:25:00+03:00")).toBe("02:25");
    // 02:25 in İstanbul (23:25 UTC) + 12 h 40 min = 12:05 UTC = 20:05 in Bali (UTC+8)
    expect(arrivalClock("2026-11-19T02:25:00+03:00", 760, "Asia/Makassar")).toBe("20:05");
    expect(arrivalClock("2026-11-19T02:25:00+03:00", 760, null)).toBeNull();
    expect(arrivalClock("2026-11-19T02:25:00+03:00", 760, "Not/AZone")).toBeNull();
  });

  it("says when the price was seen, from the link's search day", () => {
    expect(new Date(seenAt(link("02102026"), now.getTime())).toISOString().slice(0, 10)).toBe("2026-10-02");
    expect(seenAt("/search/x", 123)).toBe(123);
  });

  const cheap = fl({ airline: "D7", flight_number: "605", price: 300, transfers: 1, duration_to: 1300 });
  const mid = fl({ airline: "EY", flight_number: "542", price: 350, transfers: 1, duration_to: 905 });
  const quick = fl({ airline: "QR", flight_number: "1", price: 450, transfers: 1, duration_to: 700 });
  const direct = fl({ airline: "TK", flight_number: "66", price: 521, transfers: 0, duration_to: 760 });

  it("offers the cheapest, then a direct one, then the quickest when it's an hour quicker than both", () => {
    const picked = pickFlights([cheap, mid, quick], [direct], "tr");
    expect(picked.map((p) => p.f.airline)).toEqual(["D7", "TK", "QR"]);
    expect(picked[0].why).toBe("En ucuz seçenek");
    expect(picked[1].why).toBe("Direkt · en ucuzdan €221 fazla");
    // two going: the card's prices are both theirs, so is the difference
    expect(pickFlights([cheap, mid, quick], [direct], "tr", 2)[1].why).toBe("Direkt · en ucuzdan €442 fazla");
    expect(picked[2].why).toBe("En kısa yolculuk · 1 sa daha kısa");
  });

  it("offers no quickest slower than the direct one already offered; without a direct, the quickest against the cheapest", () => {
    expect(pickFlights([cheap, mid], [direct], "tr").map((p) => p.f.airline)).toEqual(["D7", "TK"]);
    const picked = pickFlights([cheap, mid], [], "tr");
    expect(picked.map((p) => p.f.airline)).toEqual(["D7", "EY"]);
    expect(picked[1].why).toBe("En kısa yolculuk · 6 sa 35 dk daha kısa");
  });

  it("says so when the cheapest is direct, and offers nothing twice nor anything broken", () => {
    const direct = fl({ price: 300, transfers: 0, duration_to: 760 });
    const picked = pickFlights([direct, fl({ price: 0 }), fl({ link: undefined })], [direct], "en");
    expect(picked).toHaveLength(1);
    expect(picked[0].why).toBe("The cheapest, and direct");
    expect(pickFlights([], [], "tr")).toEqual([]);
  });

  it("makes the offer: name, the clocks, price for everyone going, the page and its source", () => {
    const o = flightOffer({ f: fl({ transfers: 0, duration_to: 760, price: 521 }), why: "x" }, { adults: 2, now: now.getTime(), airline: (c) => (c === "TK" ? "Turkish Airlines" : null), zone: () => "Asia/Makassar" });
    expect(o).toMatchObject({ kind: "flight", title: "Turkish Airlines", carrierCode: "TK", depart: "02:25", arrive: "20:05", fromCode: "IST", toCode: "DPS", durationMinutes: 760, stops: 0, price: 1042, currency: "EUR", source: "Aviasales" });
    expect(o.url.startsWith("https://www.aviasales.com/search/")).toBe(true);
    const unknown = flightOffer({ f: fl({}), why: "x" }, { adults: 1, now: now.getTime(), airline: () => null, zone: () => null });
    expect(unknown.title).toBe("TK");
    expect(unknown.arrive).toBeNull();
  });
});

describe("stays", () => {
  const h = (o: Partial<XoHotel>): XoHotel => ({ name: "Goya Boutique Resort", key: "g297701-d9454181", accommodation_type: "Resort", url: "https://www.tripadvisor.com/Hotel_Review-g297701-d9454181.html", review_summary: { rating: 4.9, count: 150 }, price_ranges: { minimum: 156, maximum: 325 }, image: "https://dynamic-media-cdn.tripadvisor.com/x.jpg", merchandising_labels: [], ...o });

  it("picks the best value first, then the best liked with enough reviews, then the least dear well liked", () => {
    const list = [
      h({ key: "a", name: "A" }),
      h({ key: "b", name: "B", review_summary: { rating: 4.7, count: 3640 }, price_ranges: { minimum: 123 } }),
      h({ key: "c", name: "C", review_summary: { rating: 4.8, count: 2100 }, price_ranges: { minimum: 213 } }),
      h({ key: "d", name: "D", review_summary: { rating: 4.4, count: 300 }, price_ranges: { minimum: 69 } }),
      h({ key: "e", name: "E", review_summary: { rating: 4.0, count: 900 }, price_ranges: { minimum: 30 } }),
    ];
    const picked = pickStays(list, "tr");
    expect(picked.map((p) => p.h.key)).toEqual(["a", "c", "d"]);
    expect(picked[1].why).toBe("2.100 yorumla en beğenilenlerden");
    expect(pickStays([h({ review_summary: { rating: 0 } })], "tr")).toEqual([]);
  });

  const ctx = { lang: "tr" as const, nights: 4, now: now.getTime(), search: (x: XoHotel) => bookingSearch(x.name!, "Ubud", "2026-11-12", "2026-11-16", 2) };

  it("prices on Booking (its page opens on the hotel) and says when another platform is cheaper", () => {
    const o = stayOffer({ h: h({ merchandising_labels: ["Breakfast included"] }), why: "En iyisi" }, [
      { code: "BookingCom", name: "Booking.com", rate: 157 }, { code: "CtripTA", name: "Trip.com", rate: 140 }, { code: "Agoda", name: "Agoda.com", rate: 145 },
    ], ctx)!;
    expect(o).toMatchObject({ kind: "stay", title: "Goya Boutique Resort", rating: 4.9, price: 628, nights: 4, source: "Booking", area: "Resort", meta: "150 yorum · Kahvaltı dahil" });
    expect(o.why).toBe("En iyisi · Trip.com'da gecelik €140");
    expect(o.url).toContain("booking.com/searchresults.html?ss=Goya+Boutique+Resort%2C+Ubud&checkin=2026-11-12&checkout=2026-11-16&group_adults=2");
  });

  it("without Booking takes the cheapest on Tripadvisor's page; without any price, offers nothing", () => {
    const o = stayOffer({ h: h({}), why: "En iyisi" }, [{ code: "Agoda", name: "Agoda.com", rate: 145 }, { code: "Vio", name: "Vio.com", rate: 147 }], ctx)!;
    expect(o).toMatchObject({ source: "Agoda.com", price: 580, why: "En iyisi" });
    expect(o.url).toContain("tripadvisor.com");
    expect(stayOffer({ h: h({}), why: "x" }, [], ctx)).toBeNull();
    const own = stayOffer({ h: h({}), why: "x" }, [{ code: "BookingCom", name: "Booking.com", rate: 160 }, { code: "Official", name: "Official Site", rate: 143 }], ctx)!;
    expect(own.why).toBe("x · otelin kendi sitesinde gecelik €143");
    expect(stayOffer({ h: h({}), why: "x" }, [{ code: "Agoda", name: "Agoda.com", rate: 145 }], { ...ctx, nights: 0 })).toBeNull();
  });

  it("reads a city's id from Tripadvisor's typeahead, skipping hotels", () => {
    const body = { data: [
      { trackingItems: { dataType: "LOCATION", placeType: "ACCOMMODATION", locationId: 307574 } },
      { trackingItems: { dataType: "LOCATION", placeType: "MUNICIPALITY", locationId: 297701 } },
    ] };
    expect(geoFromTypeahead(body)).toBe("297701");
    expect(geoFromTypeahead({ data: [] })).toBeNull();
    expect(geoFromTypeahead(null)).toBeNull();
  });
});

describe("cheaper ones (the chat's \"daha ucuz\")", () => {
  it("reads the ask: cheap or not, a ceiling or none", () => {
    expect(preferOf("cheap")).toBe("cheap");
    expect(preferOf("x")).toBeNull();
    expect(maxOf("120")).toBe(120);
    expect(maxOf("")).toBeNull();
    expect(maxOf("-3")).toBeNull();
    expect(maxOf(null)).toBeNull();
  });

  it("flights: the three cheapest under the ceiling, each said against the first, for everyone going", () => {
    const f = (airline: string, price: number, transfers = 1): AviaFlight => ({ airline, flight_number: "1", departure_at: `2026-11-10T0${price % 9}:00:00+03:00`, price, transfers, link: "/search/x", duration_to: 600 });
    const picked = pickCheapFlights([f("A", 300), f("B", 320, 0), f("C", 500), f("D", 280), f("D", 280)], "tr", 2, 400);
    expect(picked.map((p) => p.f.airline)).toEqual(["D", "A", "B"]);
    expect(picked.map((p) => p.why)).toEqual(["Bulunanların en ucuzu", "En ucuzdan €40 fazla", "En ucuzdan €80 fazla · direkt"]);
    expect(pickCheapFlights([f("A", 300)], "tr", 1, 100)).toEqual([]);
  });

  const h = (key: string, rating: number, count: number, min: number): XoHotel => ({ name: key, key, review_summary: { rating, count }, price_ranges: { minimum: min } });
  it("stays: well liked ones by their least price, under the ceiling, five to price", () => {
    const list = [h("a", 4.5, 300, 90), h("b", 3.5, 900, 20), h("c", 4.2, 60, 40), h("d", 4.8, 20, 30), h("e", 4.1, 80, 55), h("f", 4.6, 500, 70), h("g", 4.4, 100, 65), h("i", 4.3, 90, 140)];
    expect(pickCheapStays(list).map((x) => x.key)).toEqual(["c", "e", "g", "f", "a"]);
    expect(pickCheapStays(list, 60).map((x) => x.key)).toEqual(["c", "e"]);
  });

  it("keeps the three cheapest priced by the night under the ceiling, the platforms' note kept", () => {
    const o = (id: string, price: number, why = ""): OfferOut => ({ id, kind: "stay", title: id, price, nights: 3, currency: "EUR", url: "https://x", why, source: "Booking", fetchedAt: 0, rating: 4.5 });
    const kept = cheapest([o("a", 300), o("b", 180, " · Trip.com'da gecelik €55"), o("c", 240), o("d", 600)], "tr", 90);
    expect(kept.map((k) => k.id)).toEqual(["b", "c"]);
    expect(kept.map((k) => k.why)).toEqual(["Bulduklarımın en ucuzu · Trip.com'da gecelik €55", "Gecelik €20 daha fazla"]);
  });
});

describe("a stay's candidates (up to six, from the one list)", () => {
  const h = (key: string, rating: number, count: number, min: number, over: Partial<XoHotel> = {}): XoHotel => ({ name: key.toUpperCase(), key, review_summary: { rating, count }, price_ranges: { minimum: min, maximum: min * 2 }, ...over });
  const list = [h("a", 4.6, 900, 120), h("b", 4.9, 2000, 200), h("c", 4.4, 150, 60), h("d", 4.8, 400, 300), h("e", 4.1, 80, 45), h("f", 4.7, 1200, 90), h("g", 3.6, 5000, 20), h("x", 0, 0, 0)];

  it("the priced first, then the cheapest and the best liked by turns, none twice, six at most", () => {
    const keys = pickCandidates(list, ["a", "b", "c"]).map((x) => x.key);
    expect(keys.slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(keys).toHaveLength(6);
    expect(new Set(keys).size).toBe(6);
    // the cheapest well liked (e 45, f 90) and the best liked (d 4.8) come next; g (3.6) and x (no rating) don't
    expect(keys).toContain("e");
    expect(keys).toContain("d");
    expect(keys).not.toContain("x");
    expect(pickCandidates(list.slice(0, 2), ["a"]).map((x) => x.key)).toEqual(["a", "b"]);
  });

  it("carries what the sources said; a hotel not priced has its usual range only, nothing guessed", () => {
    const ctx = { lang: "tr" as const, nights: 3, now: 5, url: "https://www.booking.com/searchresults.html?ss=A" };
    const offer = { id: "xo:a", kind: "stay" as const, title: "A", price: 360, currency: "EUR", nights: 3, url: "https://tp.media/r?a", why: "", source: "Booking", fetchedAt: 9 };
    const priced = stayCandidate(h("a", 4.6, 900, 120, { geo: { latitude: -8.5, longitude: 115.2 }, accommodation_type: "Resort", merchandising_labels: ["Breakfast included", "Unknown"] }), offer, ctx);
    expect(priced).toMatchObject({ id: "xo:a", name: "A", rating: 4.6, reviews: 900, geo: { lat: -8.5, lng: 115.2 }, area: "Resort", labels: ["Kahvaltı dahil"], url: "https://tp.media/r?a", nightly: 120, total: 360, nights: 3, priceRange: { min: 120, max: 240 }, source: "Booking", fetchedAt: 9 });
    const range = stayCandidate(h("c", 4.4, 150, 60), null, ctx);
    expect(range).toMatchObject({ nightly: null, total: null, source: null, geo: null, photo: null, url: ctx.url, priceRange: { min: 60, max: 120 }, fetchedAt: 5 });
    expect(stayCandidate(h("z", 4.2, 10, 0), null, ctx).priceRange).toBeNull();
  });
});

describe("live (SerpApi)", () => {
  // Trimmed from a real answer: Madeira → İstanbul, 21 Oct 2026, two people.
  const google = {
    best_flights: [
      {
        flights: [
          { departure_airport: { id: "FNC", time: "2026-10-21 19:40" }, arrival_airport: { id: "BUD", time: "2026-10-22 01:20" }, airline: "Wizz Air", flight_number: "W6 2498", duration: 280 },
          { departure_airport: { id: "BUD", time: "2026-10-22 05:30" }, arrival_airport: { id: "IST", time: "2026-10-22 08:45" }, airline: "Wizz Air", flight_number: "W6 2429", duration: 135 },
        ],
        total_duration: 665,
        price: 520,
      },
    ],
    other_flights: [{ flights: [{ departure_airport: { id: "FNC" }, flight_number: "TP 1" }], price: 600 }, { flights: [], price: 1 }],
  };

  it("reads Google Flights as flights per person, clocks as the airports show them, the page Aviasales' search", () => {
    const list = serpFlights(google, 2, "FNC", "IST", "2026-10-21");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ airline: "W6", flight_number: "2498", departure_at: "2026-10-21T19:40", arrive_local: "08:45", transfers: 1, duration_to: 665, price: 260, source: "Google Flights", link: "/search/FNC2110IST2" });
    const offer = flightOffer({ f: list[0], why: "x" }, { adults: 2, now: 1, airline: () => "Wizz Air", zone: () => null });
    expect(offer).toMatchObject({ depart: "19:40", arrive: "08:45", price: 520, source: "Google Flights", stops: 1 });
    expect(offer.url).toBe("https://www.aviasales.com/search/FNC2110IST2");
    expect(aviasalesSearch("IST", "DPS", "2026-11-10", 1)).toBe("/search/IST1011DPS1");
    expect(serpFlights(null, 1, "A", "B", "2026-01-01")).toEqual([]);
  });

  it("reads the shared flight search: Kiwi's keep their page, Google's go to Aviasales, the Google check under the price", () => {
    // Trimmed from a real answer (Hetzner /ucus/ara): Sabiha Gökçen → Kuala Lumpur, 6 Dec 2026, two people, euros.
    const body = {
      results: [
        { price: 520, currency: "EUR", source: "kiwi", link: "https://kiwi.com/u/abc", google_check: { status: "same_ticket", price: 580 },
          outbound: { from: "SAW", to: "KUL", depart: "2026-12-06T17:20", arrive: "2026-12-07T08:45", duration_min: 625, stops: 0,
            carriers: [{ code: "D7" }], segments: [{ flight: "D7605", carrier: "D7" }] } },
        { price: 700, currency: "EUR", source: "kiwi", link: "https://kiwi.com/u/def", google_check: { status: "not_single_ticket" },
          outbound: { from: "SAW", to: "KUL", depart: "2026-12-06T06:30", arrive: "2026-12-07T06:00", duration_min: 1290, stops: 1,
            carriers: [{ code: "PC" }, { code: "MH" }], segments: [{ flight: "PC1", carrier: "PC" }, { flight: "MH2", carrier: "MH" }] } },
        { price: 760, currency: "EUR", source: "google", link: "https://www.google.com/travel/flights/booking?tfs=x", google_check: null,
          outbound: { from: "SAW", to: "KUL", depart: "2026-12-06T23:10", arrive: "2026-12-07T19:55", duration_min: 1065, stops: 1,
            carriers: [{ code: "G9" }], segments: [{ flight: "G91", carrier: "G9" }] } },
        { price: 9, currency: "TRY", source: "kiwi", outbound: { depart: "2026-12-06T00:00", carriers: [{ code: "XX" }] } },
        { price: 0, currency: "EUR", source: "kiwi", outbound: { depart: "2026-12-06T00:00", carriers: [{ code: "XX" }] } },
      ],
    };
    const list = ucusFlights(body, 2, "SAW", "KUL", "2026-12-06", "tr");
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ airline: "D7", flight_number: "605", departure_at: "2026-12-06T17:20", arrive_local: "08:45", transfers: 0, duration_to: 625, price: 260, source: "Kiwi.com", url: "https://kiwi.com/u/abc", note: "Google'da da €580", link: "/search/SAW0612KUL2" });
    expect(list[1].note).toBe("Ayrı biletler");
    expect(list[2]).toMatchObject({ source: "Google Flights", price: 380 });
    expect(list[2].url).toBeUndefined();
    expect(ucusFlights(body, 1, "SAW", "KUL", "2026-12-06", "en")[1].note).toBe("Separate tickets");
    const kiwi = flightOffer({ f: list[0], why: "x" }, { adults: 2, now: 1, airline: () => "AirAsia X", zone: () => null });
    expect(kiwi).toMatchObject({ url: "https://kiwi.com/u/abc", meta: "Google'da da €580", price: 520, source: "Kiwi.com", arrive: "08:45", stops: 0 });
    const google = flightOffer({ f: list[2], why: "x" }, { adults: 2, now: 1, airline: () => null, zone: () => null });
    expect(google.url).toBe("https://www.aviasales.com/search/SAW0612KUL2");
    expect(google).not.toHaveProperty("meta");
    expect(ucusFlights(null, 1, "A", "B", "2026-01-01", "tr")).toEqual([]);
  });

  it("reads Google Hotels as priced hotels and picks three, each for its own reason", () => {
    const body = { properties: [
      { name: "Alaya Resort Ubud", overall_rating: 4.7, reviews: 4075, rate_per_night: { extracted_lowest: 115 }, total_rate: { extracted_lowest: 461 }, gps_coordinates: { latitude: -8.5, longitude: 115.26 }, images: [{ thumbnail: "https://lh3/x.jpg" }] },
      { name: "Adiwana Bisma", overall_rating: 4.9, reviews: 1492, rate_per_night: { extracted_lowest: 125 }, total_rate: { extracted_lowest: 502 } },
      { name: "The Lokha Ubud", overall_rating: 4.6, reviews: 1535, rate_per_night: { extracted_lowest: 79 } },
      { name: "No price", overall_rating: 4.9, reviews: 10 },
      { name: "No rating", rate_per_night: { extracted_lowest: 20 } },
    ] };
    const list = serpStays(body, { lang: "tr", nights: 4, now: 7, search: (n) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(n)}` });
    expect(list.map((c) => c.name)).toEqual(["Alaya Resort Ubud", "Adiwana Bisma", "The Lokha Ubud"]);
    expect(list[0]).toMatchObject({ rating: 4.7, reviews: 4075, nightly: 115, total: 461, nights: 4, geo: { lat: -8.5, lng: 115.26 }, photo: "https://lh3/x.jpg", source: "Google Hotels" });
    expect(list[2]).toMatchObject({ nightly: 79, total: 316 });
    const picks = pickLiveStays(list, "tr");
    expect(picks.map((o) => [o.title, o.why])).toEqual([
      ["Alaya Resort Ubud", "Google Hotels'ta öne çıkan"],
      ["Adiwana Bisma", "En beğenilenlerden"],
      ["The Lokha Ubud", "İyi puanlılar içinde en uygunu"],
    ]);
    expect(picks[0]).toMatchObject({ kind: "stay", price: 461, nights: 4, meta: "4.075 yorum" });
  });
});

describe("activities (Viator)", () => {
  // Trimmed from a real answer: Ubud, 12–16 Nov 2026.
  const vi = (code: string, rating: number, reviews: number, price: number, over: Record<string, unknown> = {}) => ({
    productCode: code, title: `Tour ${code}`, reviews: { combinedAverageRating: rating, totalReviews: reviews }, pricing: { summary: { fromPrice: price }, currency: "EUR" },
    productUrl: `https://www.viator.com/tours/Ubud/x/d5467-${code}?mcid=42383&pid=P00324133&medium=api`, duration: { fixedDurationInMinutes: 180 },
    images: [{ isCover: true, variants: [{ width: 100, url: "https://media/100.jpg" }, { width: 480, url: "https://media/480.jpg" }, { width: 720, url: "https://media/720.jpg" }] }],
    flags: ["FREE_CANCELLATION"], ...over,
  });

  it("reads the city's destination id", () => {
    expect(viatorDestination({ destinations: { results: [{ id: 5467, name: "Ubud" }] } })).toBe("5467");
    expect(viatorDestination({})).toBeNull();
  });

  it("says how long as Viator does", () => {
    expect(durationWords({ fixedDurationInMinutes: 180 }, "tr")).toBe("3 sa");
    expect(durationWords({ fixedDurationInMinutes: 90 }, "tr")).toBe("1,5 sa");
    expect(durationWords({ variableDurationFromMinutes: 480, variableDurationToMinutes: 600 }, "tr")).toBe("8–10 sa");
    expect(durationWords({ fixedDurationInMinutes: 45 }, "en")).toBe("45 min");
    expect(durationWords(undefined, "tr")).toBeNull();
  });

  it("picks Viator's first, the best liked, the least dear well liked; price for everyone going; its own page", () => {
    const list = [vi("A", 4.6688525, 120, 30), vi("B", 5, 703, 68.1, { flags: ["LIKELY_TO_SELL_OUT"] }), vi("C", 4.8, 90, 20.48), vi("D", 3.9, 5000, 5), vi("E", 4.9, 300, 0)];
    const picks = pickActivities(list, "tr", 2, 9);
    expect(picks.map((o) => [o.id, o.why])).toEqual([
      ["vi:A", "Viator'da öne çıkan"],
      ["vi:B", "En beğenilenlerden · hızlı tükeniyor"],
      ["vi:C", "İyi puanlılar içinde en uygunu"],
    ]);
    expect(picks[1]).toMatchObject({ kind: "activity", rating: 5, reviews: 703, price: 136, source: "Viator", area: "3 sa", meta: "703 yorum", photo: "https://media/480.jpg" });
    expect(picks[2].meta).toBe("90 yorum · Ücretsiz iptal");
    expect(picks[0].rating).toBe(4.7);
    expect(picks[0].url).toContain("pid=P00324133");
    expect(pickActivities([], "tr", 1, 0)).toEqual([]);
  });

  it("asked for cheaper ones: the three cheapest well liked", () => {
    const list = [vi("A", 4.6, 120, 30), vi("B", 5, 703, 68), vi("C", 4.8, 90, 20), vi("D", 4.1, 80, 5)];
    expect(pickActivities(list, "tr", 1, 0, true).map((o) => o.id)).toEqual(["vi:C", "vi:A", "vi:B"]);
  });
});

describe("eSIMs (Airalo's feed)", () => {
  const item = (title: string, price: string, link: string) =>
    `<item><g:id>1</g:id><g:title><![CDATA[${title}]]></g:title><g:price>${price}</g:price><g:link>${link}</g:link></item>`;
  const feed = `<?xml version="1.0"?><rss><channel>${[
    item("5 GB Portugal travel eSIM valid for 7 days", "7.50 USD", "https://www.airalo.com/portugal-esim/fofo-in-7days-5gb?currency=USD"),
    item("Israel travel eSIM | 5 GB, 50 mins of local calls, 50 SMS valid for 30 days", "21.00 USD", "https://www.airalo.com/israel-esim/a-30days-5gb"),
    item("Guam travel eSIM | Unlimited GB, unlimited mins of local calls, unlimited SMS valid for 15 days", "30 USD", "https://www.airalo.com/guam-esim/b"),
    item("Europe regional eSIM 10GB", "20 USD", "https://www.airalo.com/europe"),
    item("1 GB Portugal travel eSIM valid for 7 days", "0 USD", "https://www.airalo.com/free"),
    item("2 GB Portugal travel eSIM valid for 7 days", "5 USD", "http://www.airalo.com/insecure"),
  ].join("")}</channel></rss>`;

  it("reads both title shapes, and nothing else", () => {
    const packs = airaloPacks(feed);
    expect(packs).toEqual([
      { place: "Portugal", gb: 5, days: 7, calls: false, price: 7.5, currency: "USD", link: "https://www.airalo.com/portugal-esim/fofo-in-7days-5gb?currency=USD" },
      { place: "Israel", gb: 5, days: 30, calls: true, price: 21, currency: "USD", link: "https://www.airalo.com/israel-esim/a-30days-5gb" },
      { place: "Guam", gb: null, days: 15, calls: true, price: 30, currency: "USD", link: "https://www.airalo.com/guam-esim/b" },
    ]);
  });

  it("names a country as Airalo does", () => {
    expect(airaloPlace("pt")).toBe("Portugal");
    expect(airaloPlace("TR")).toBe("Turkey");
    expect(airaloPlace("US")).toBe("United States");
    expect(airaloPlace("Portugal")).toBeNull();
  });

  const pack = (gb: number | null, days: number, price: number, calls = false): EsimPack => ({
    place: "Portugal", gb, days, calls, price, currency: "USD", link: `https://www.airalo.com/portugal-esim/p-${days}days-${gb ?? "u"}gb`,
  });
  const packs = [pack(1, 7, 4.5), pack(3, 7, 8), pack(5, 15, 13), pack(10, 30, 20), pack(20, 30, 34), pack(null, 30, 60, true), pack(5, 7, 9.5)];

  it("three that last the trip: the cheapest with enough data, the most per dollar, plenty", () => {
    const got = pickEsims(packs, 10, "tr", 1);
    expect(got.map((o) => [o.title, o.price, o.why])).toEqual([
      ["Portugal 5 GB", 13, "10 günlük gezine yeten en uygun paket"],
      ["Portugal 20 GB", 34, "Gigabayt başına en uygun"],
      ["Portugal Sınırsız", 60, "Bol internet"],
    ]);
    expect(got[0]).toMatchObject({ kind: "esim", source: "Airalo", currency: "USD", area: "15 gün · 5 GB", meta: null, url: "https://www.airalo.com/portugal-esim/p-15days-5gb" });
    expect(got[2].meta).toBe("Yerel arama ve SMS dahil");
    expect(got[0].id).toBe("ai:portugal-esim/p-15days-5gb");
  });

  it("goes up in price, plenty kept within reach of the first", () => {
    const pt = [pack(5, 15, 8), pack(20, 15, 18.5), pack(50, 30, 35), pack(100, 30, 80)];
    expect(pickEsims(pt, 8, "tr", 1).map((o) => [o.title, o.why])).toEqual([
      ["Portugal 5 GB", "8 günlük gezine yeten en uygun paket"],
      ["Portugal 20 GB", "Gigabayt başına en uygun"],
      ["Portugal 50 GB", "Bol internet"],
    ]);
  });

  it("a short trip gets the short ones; a trip longer than any package the longest", () => {
    expect(pickEsims(packs, 5, "en", 1)[0]).toMatchObject({ title: "Portugal 3 GB", price: 8, why: "The cheapest that lasts your 5 days" });
    expect(pickEsims(packs, 60, "tr", 1).every((o) => o.area?.startsWith("30 gün"))).toBe(true);
    expect(pickEsims([], 7, "tr", 1)).toEqual([]);
  });
});

describe("between cities (Omio's feed)", () => {
  it("reads a CSV with quotes, commas and line breaks inside", () => {
    expect(csvRows('a,b,c\r\n1,"x, ""y""\nz",3\n')).toEqual([["a", "b", "c"], ["1", 'x, "y"\nz', "3"]]);
  });

  it("puts the English names with the German file's euros, by route", () => {
    const en = [
      "route_id,title,description,origin_name,destination_name,origin_position_id,destination_position_id,train_min_duration,bus_min_duration,flight_min_duration,ferry_min_duration,train_min_price,bus_min_price,flight_min_price,ferry_min_price",
      '1_2,Lisbon - Porto,"Train, bus or flight",Lisbon,Porto,1,2,178,195,60,,8.5,3.2,40,',
      "3_4,Nowhere - There,x,Nowhere,There,3,4,10,,,,,,,",
    ].join("\n");
    const de = ["route_id,origin_name,destination_name,train_min_price,bus_min_price,flight_min_price,ferry_min_price", "1_2,Lissabon,Porto,10.00,3.95,46.43,", "3_4,Nirgendwo,Dort,,,,"].join("\n");
    expect(omioRoutes(en, de)).toEqual({
      "lisbon|porto": { from: "Lisbon", to: "Porto", fromId: "1", toId: "2", ways: { train: [10, 178], bus: [3.95, 195], flight: [46.43, 60] } },
    });
    expect(placeKey(" Zürich  Hbf ")).toBe("zurich hbf");
    expect([omioName("Floransa"), omioName("budapeşte"), omioName("BÜKREŞ"), omioName("Porto")]).toEqual(["Florence", "Budapest", "Bucharest", "Porto"]);
  });

  const route: OmioRoute = { from: "Lisbon", to: "Porto", fromId: "372432", toId: "373108", ways: { train: [10, 178], bus: [3.95, 195], flight: [46.43, 60] } };

  it("the cheapest, the quickest, another; for everyone going, as a starting price", () => {
    const got = pickTransfers(route, 2, "tr", 5);
    expect(got.map((o) => [o.title, o.price, o.why, o.durationMinutes])).toEqual([
      ["Otobüs · Lisbon → Porto", 8, "En ucuz yol · başlangıç fiyatı", 195],
      ["Tren · Lisbon → Porto", 20, "Bir başka yol · başlangıç fiyatı", 178],
      ["Uçak · Lisbon → Porto", 93, "En hızlı yol · başlangıç fiyatı", 60],
    ]);
    expect(got[0]).toMatchObject({ kind: "transfer", source: "Omio", currency: "EUR", fetchedAt: 5, via: "Otobüs", url: omioPage(route) });
    expect(omioPage(route)).toBe(`https://www.omio.com/lps/?id=${btoa("connection_page_nt.com.372432.373108")}`);
  });

  it("one way that's both cheapest and quickest says so", () => {
    const got = pickTransfers({ ...route, ways: { train: [9, 100], bus: [12, 200] } }, 1, "en", 5);
    expect(got.map((o) => o.why)).toEqual(["The cheapest and quickest way · starting price", "Another way · starting price"]);
  });
});

describe("Google Hotels: the nearest place, the airport and what reviews say (spec 2026-10-19 SerpApi)", () => {
  // Trimmed from real answers: Porto and Ubud, 12–15 Nov 2026, gl=tr hl=tr.
  const search = (n: string) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(n)}`;
  it("reads Google's durations in Turkish and English", () => {
    expect(serpMinutes("3 dk.")).toBe(3);
    expect(serpMinutes("1 sa. 15 dk.")).toBe(75);
    expect(serpMinutes("8 min")).toBe(8);
    expect(serpMinutes("1 hr 22 min")).toBe(82);
    expect(serpMinutes("2 sa.")).toBe(120);
    expect(serpMinutes("yakında")).toBeNull();
    expect(serpMinutes(undefined)).toBeNull();
  });
  it("keeps the nearest place on foot (else by taxi) and the airport, public transport first", () => {
    const [palacio, central, acta] = serpHotels["otel-porto"].properties;
    expect(nearbyOf(palacio.nearby_places)).toEqual([
      { name: "San Remo Restaurante", mode: "walk", minutes: 5, airport: false },
      { name: "Francisco de Sá Carneiro Havaalanı", mode: "transit", minutes: 32, airport: true },
    ]);
    expect(nearbyOf(central.nearby_places)[0]).toEqual({ name: "Mercado Ferreira Borges", mode: "walk", minutes: 1, airport: false });
    expect(nearbyOf(acta.nearby_places).map((n) => [n.name, n.mode, n.minutes])).toEqual([["Moreda", "walk", 7], ["Francisco de Sá Carneiro Havaalanı", "transit", 36]]);
    // Nothing near on foot, a short taxi instead; a place over 15 minutes isn't "near".
    expect(nearbyOf([{ name: "Ubud Art Market", transportations: [{ type: "Taxi", duration: "8 dk." }] }, { name: "Tanah Lot", transportations: [{ type: "Walking", duration: "1 sa. 10 dk." }] }]))
      .toEqual([{ name: "Ubud Art Market", mode: "taxi", minutes: 8, airport: false }]);
    expect(nearbyOf(undefined)).toEqual([]);
  });
  it("names two praised topics and one faulted, the most talked about first, never 'Property'", () => {
    const [palacio, central, acta] = serpHotels["otel-porto"].properties;
    expect(topicsOf(palacio.reviews_breakdown)).toEqual([{ topic: "Hizmet", up: true }, { topic: "Bar", up: true }]);
    expect(topicsOf(central.reviews_breakdown)).toEqual([{ topic: "Konum", up: true }, { topic: "Hizmet", up: true }, { topic: "Banyo", up: false }]);
    expect(topicsOf(acta.reviews_breakdown)).toEqual([{ topic: "Hizmet", up: true }, { topic: "Konum", up: true }, { topic: "Klima", up: false }]);
    expect(topicsOf([{ name: "Kahvaltı", description: "Breakfast", total_mentioned: 6, positive: 6, negative: 0 }])).toEqual([]);
  });
  it("carries them on the candidates and onto the offers", () => {
    const list = serpStays(serpHotels["otel-porto"], { lang: "tr", nights: 3, now: 7, search });
    expect(list[1]).toMatchObject({ name: "The Central House Porto Ribeira", photo: expect.stringMatching(/^https:/), topics: [{ topic: "Konum", up: true }, { topic: "Hizmet", up: true }, { topic: "Banyo", up: false }] });
    expect(list.every((c) => c.nearby?.some((n) => n.airport))).toBe(true);
    const offer = candidateOffer(list[1], "", "tr");
    expect(offer.nearby).toHaveLength(2);
    expect(offer.topics).toHaveLength(3);
    const ubud = serpStays(serpHotels["otel-ubud"], { lang: "tr", nights: 3, now: 7, search });
    expect(ubud[0].nearby?.find((n) => n.airport)).toMatchObject({ mode: "transit", minutes: 148 });
  });
});

describe("a flight's fare judged: Google's price insights, else our own record (spec 2026-10-19 SerpApi, 2 and 4)", () => {
  it("reads Google's usual range, today's lowest and its level, and a day-by-day history in ms", () => {
    // Real: IST→OPO 12 Nov 2026, one person, asked 19 Oct.
    const i = priceInsightOf(serpFlight)!;
    expect(i).toMatchObject({ low: 110, high: 200, lowest: 202, level: "high", source: "google", currency: "EUR" });
    expect(i.history).toHaveLength(62);
    expect(i.history[0]).toEqual([1787086800000, 147]);
    expect(i.history.at(-1)).toEqual([1792357200000, 202]);
  });
  it("keeps what's well-formed and gives up when there is nothing to judge with", () => {
    expect(priceInsightOf({ price_insights: { typical_price_range: [200, 110], price_level: "LOW" } })).toMatchObject({ low: 110, high: 200, level: "low", history: [] });
    expect(priceInsightOf({ price_insights: { price_history: [[1, 100]] } })).toBeNull();
    expect(priceInsightOf({ price_insights: { price_history: [[1, 100], [2, 90], ["x", 3]] } })?.history).toEqual([[1000, 100], [2000, 90]]);
    expect(priceInsightOf({})).toBeNull();
    expect(priceInsightOf(null)).toBeNull();
  });
  it("makes our own record a history: a day's lowest, five days at least", () => {
    const rows = ["2026-10-01T08:00:00Z", "2026-10-01T15:00:00Z", "2026-10-02T09:00:00Z", "2026-10-04T09:00:00Z", "2026-10-06T09:00:00Z", "2026-10-09T09:00:00Z"]
      .map((seen_at, i) => ({ seen_at, price: [120, 110, 118, 105, 99, 101][i] }));
    const i = logInsight(rows)!;
    expect(i).toMatchObject({ low: null, high: null, level: null, source: "log" });
    expect(i.history.map(([, p]) => p)).toEqual([110, 118, 105, 99, 101]);
    expect(logInsight(rows.slice(0, 4))).toBeNull();
  });
});

describe("a city's sights: Google's Top Sights (spec 2026-10-19 SerpApi, item 3)", () => {
  it("keeps the name, the rating out of 5 and an https photo; not the broken review count", () => {
    // Real: "Porto gezilecek yerler", hl=tr, 19 Oct 2026.
    const list = topSights(serpSights);
    expect(list).toHaveLength(8);
    expect(list[0]).toEqual({ title: "Luís I Bridge", rating: 4.8, photo: expect.stringMatching(/^https:\/\/lh3\.googleusercontent\.com\//) });
    expect(list.map((s) => s.title)).toContain("Clérigos Kilisesi");
    expect(Object.keys(list[0])).not.toContain("reviews");
  });
  it("drops what has no name, a rating out of range and an http photo; each name once", () => {
    expect(topSights({ top_sights: { sights: [{ title: "  " }, { title: "A", rating: 9, thumbnail: "http://x" }, { title: "a" }] } })).toEqual([{ title: "A", rating: null, photo: null }]);
    expect(topSights({})).toEqual([]);
    expect(topSights(null)).toEqual([]);
  });
});

describe("a night change of plane (spec 2026-10-19 SerpApi, item 6)", () => {
  it("is three hours or more on the ground with some of it between midnight and six there", () => {
    expect(nightStop([{ at: "MAD", land: "2026-11-13T00:55", leave: "2026-11-13T07:55" }])).toEqual({ at: "MAD", minutes: 420, from: "00:55", to: "07:55" });
    // Landing the evening before, leaving after midnight.
    expect(nightStop([{ at: "DOH", land: "2026-11-12T22:40", leave: "2026-11-13T02:10" }])).toEqual({ at: "DOH", minutes: 210, from: "22:40", to: "02:10" });
    // Long but in the day; at night but short; the first night one of two.
    expect(nightStop([{ at: "AMS", land: "2026-11-12T09:00", leave: "2026-11-12T15:00" }])).toBeNull();
    expect(nightStop([{ at: "AMS", land: "2026-11-12T01:00", leave: "2026-11-12T02:30" }])).toBeNull();
    expect(nightStop([{ at: "CPH", land: "2026-11-12T10:00", leave: "2026-11-12T11:00" }, { at: "AMS", land: "2026-11-12T23:30", leave: "2026-11-13T06:30" }])?.at).toBe("AMS");
    expect(nightStop([{ at: "X", land: "?", leave: "2026-11-12T03:00" }])).toBeNull();
    expect(nightStop(undefined)).toBeNull();
  });
  it("reads the changes from the flight search's legs and Google's, and says it on the offer", () => {
    const body = { results: [{ price: 300, currency: "EUR", source: "kiwi", link: "https://www.kiwi.com/x", outbound: {
      from: "IST", to: "OPO", depart: "2026-11-12T21:40", arrive: "2026-11-13T10:05", stops: 1, duration_min: 805, carriers: [{ code: "PC" }],
      segments: [{ flight: "PC1234", carrier: "PC", from: "IST", to: "MAD", depart: "2026-11-12T21:40", arrive: "2026-11-13T00:55" }, { flight: "IB111", carrier: "IB", from: "MAD", to: "OPO", depart: "2026-11-13T07:55", arrive: "2026-11-13T10:05" }],
    } }] };
    const [f] = ucusFlights(body, 1, "IST", "OPO", "2026-11-12", "tr");
    expect(f.stopovers).toEqual([{ at: "MAD", land: "2026-11-13T00:55", leave: "2026-11-13T07:55" }]);
    const offer = flightOffer({ f, why: "" }, { adults: 1, now: 1, airline: () => "Pegasus", zone: () => null });
    expect(offer.nightStop).toEqual({ at: "MAD", minutes: 420, from: "00:55", to: "07:55" });
    const g = serpFlights({ best_flights: [{ price: 250, total_duration: 800, flights: [
      { departure_airport: { id: "IST", time: "2026-11-12 21:40" }, arrival_airport: { id: "MAD", time: "2026-11-13 00:55" }, flight_number: "PC 1234" },
      { departure_airport: { id: "MAD", time: "2026-11-13 07:55" }, arrival_airport: { id: "OPO", time: "2026-11-13 10:05" }, flight_number: "IB 111" },
    ] }] }, 1, "IST", "OPO", "2026-11-12");
    expect(nightStop(g[0].stopovers)?.minutes).toBe(420);
    expect(flightOffer({ f: { ...f, stopovers: undefined }, why: "" }, { adults: 1, now: 1, airline: () => null, zone: () => null })).not.toHaveProperty("nightStop");
  });
});

describe("a route's fares by day: the flight search for the day ±3 (spec 2026-10-19 SerpApi, item 5)", () => {
  it("keeps each day's cheapest in euros, in day order, inside the window", () => {
    const r = (depart: string, price: number, currency = "EUR") => ({ price, currency, source: "kiwi", outbound: { depart } });
    const body = { results: [r("2026-11-12T21:40", 120), r("2026-11-12T07:10", 98), r("2026-11-09T06:00", 140), r("2026-11-15T10:00", 87.6), r("2026-11-16T10:00", 50), r("2026-11-13T10:00", 70, "TRY"), { price: 1, currency: "EUR" }] };
    expect(dayFares(body, "2026-11-12")).toEqual([{ day: "2026-11-09", price: 140 }, { day: "2026-11-12", price: 98 }, { day: "2026-11-15", price: 88 }]);
    expect(dayFares(null, "2026-11-12")).toEqual([]);
  });
});

describe("a home on Airbnb (spec 2026-10-19 SerpApi, item 7)", () => {
  it("takes the best liked listing, a guest favourite first, its total for the nights and Airbnb's own page", () => {
    // Real: Lisbon, 12–15 Nov 2026, two people.
    const o = airbnbOffer(serpAirbnb, { lang: "tr", nights: 3, now: 7 })!;
    expect(o).toMatchObject({ kind: "stay", source: "Airbnb", currency: "EUR", nights: 3, why: "Airbnb'de misafir favorisi", meta: expect.stringMatching(/^Misafir favorisi · .* yorum$/) });
    expect(o.url).toMatch(/^https:\/\/www\.airbnb\.com\/rooms\//);
    expect(o.rating).toBeGreaterThanOrEqual(4.7);
    expect(o.price).toBeGreaterThan(100);
    expect(o.area).not.toMatch(/ in /);
    // The same listing among the stay's candidates, its night's price from the total.
    expect(airbnbCandidate(o)).toMatchObject({ id: o.id, source: "Airbnb", total: o.price, nights: 3, nightly: Math.round(o.price! / 3), url: o.url });
    expect(airbnbCandidate(o).labels).toContain("apartment");
  });
  it("gives nothing when no listing is liked enough", () => {
    const l = { name: "X", link: "https://www.airbnb.com/rooms/1", rating: 4.5, reviews: 300, extracted_price: 200 };
    expect(airbnbOffer({ organic_results: [l, { ...l, rating: 4.9, reviews: 5 }] }, { lang: "tr", nights: 3, now: 1 })).toBeNull();
    expect(airbnbOffer({ organic_results: [{ ...l, rating: 4.8, link: "https://evil.example/rooms/1" }] }, { lang: "tr", nights: 3, now: 1 })).toBeNull();
    expect(airbnbOffer(null, { lang: "tr", nights: 3, now: 1 })).toBeNull();
  });
});

describe("what's on in a city on the trip's days (spec 2026-10-19 SerpApi, item 8)", () => {
  it("reads Google's month and day as the next such day", () => {
    expect(eventDay("Oct 23", "2026-10-19")).toBe("2026-10-23");
    expect(eventDay("Jan 5", "2026-10-19")).toBe("2027-01-05");
    expect(eventDay("Oct 19", "2026-10-19")).toBe("2026-10-19");
    expect(eventDay("Free Entry", "2026-10-19")).toBeNull();
  });
  it("keeps the stay's days, leaves nights out out, the tickets' page and the hour", () => {
    // Real: "Events in Porto", 19 Oct 2026: of eight, six are pub crawls, parties and Halloween nights.
    const list = cityEvents(serpEvents, { start: "2026-10-20", end: "2026-10-31", today: "2026-10-19", lang: "tr", now: 1 });
    expect(list.map((o) => o.title)).toEqual(["NOITE DE POESIA / POETRY NIGHT", "Lendas do Porto - Experiência imersiva e metaverso"]);
    expect(list[0]).toMatchObject({ kind: "activity", price: null, why: "23 Eki · 19:30", meta: "Casa da Horta - Associação Cultural", source: "eventbrite.com", url: expect.stringMatching(/^https:\/\/www\.eventbrite\.com\//) });
    expect(cityEvents(serpEvents, { start: "2026-11-01", end: "2026-11-05", today: "2026-10-19", lang: "tr", now: 1 })).toEqual([]);
    expect(cityEvents(null, { start: "2026-10-20", end: "2026-10-31", today: "2026-10-19", lang: "tr", now: 1 })).toEqual([]);
  });
});
