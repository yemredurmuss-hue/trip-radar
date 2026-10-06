// The offers function's rules (supabase/functions/offers/shape.ts): what may be asked, the sources' answers picked
// and turned into offers. Answers below are trimmed from real ones (İstanbul → Bali, Ubud, 6 Oct 2026).
import { describe, expect, it } from "vitest";
import {
  adultsOf, airportCodeOk, arrivalClock, askableDay, bookingSearch, cheapest, flightOffer, geoFromTypeahead, localClock, maxOf,
  nightsBetween, pickCandidates, pickCheapFlights, pickCheapStays, pickFlights, pickStays, placeOk, preferOf, seenAt, stayCandidate, stayOffer, type AviaFlight,
  type OfferOut, type XoHotel,
} from "../supabase/functions/offers/shape";

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
