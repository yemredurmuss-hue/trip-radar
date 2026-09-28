import { describe, expect, it } from "vitest";
import { parseUrl } from "../src/lib/url";

describe("parseUrl", () => {
  it("reads Booking hotel identity, dates and guests", () => {
    const f = parseUrl(
      "https://www.booking.com/hotel/pt/jardim-stay.en-gb.html?aid=1&checkin=2026-10-08&checkout=2026-10-11&group_adults=2&group_children=0&no_rooms=1&selected_currency=EUR&srpvid=abc",
    );
    expect(f).toMatchObject({
      provider: "Booking.com",
      key: "booking:pt/jardim-stay",
      checkIn: "2026-10-08",
      checkOut: "2026-10-11",
      adults: 2,
      children: 0,
      rooms: 1,
      currency: "EUR",
    });
  });

  it("reads legacy Booking date params", () => {
    const f = parseUrl(
      "https://www.booking.com/hotel/pt/casa-azul.html?checkin_year=2026&checkin_month=10&checkin_monthday=8&checkout_year=2026&checkout_month=10&checkout_monthday=11",
    );
    expect(f.checkIn).toBe("2026-10-08");
    expect(f.checkOut).toBe("2026-10-11");
  });

  it("treats Booking share links as unknown listing and dates", () => {
    const f = parseUrl("https://www.booking.com/Share-AbC123");
    expect(f.provider).toBe("Booking.com");
    expect(f.key).toBeNull();
    expect(f.checkIn).toBeNull();
  });

  it("reads Airbnb room id with long ids and both date spellings", () => {
    expect(
      parseUrl("https://www.airbnb.com.tr/rooms/1750924089167503383?check_in=2026-10-11&check_out=2026-10-14&adults=2"),
    ).toMatchObject({ provider: "Airbnb", key: "airbnb:1750924089167503383", checkIn: "2026-10-11", adults: 2 });
    expect(parseUrl("https://www.airbnb.com/rooms/plus/123?checkin=2026-10-11&checkout=2026-10-14")).toMatchObject({
      key: "airbnb:123",
      checkOut: "2026-10-14",
    });
  });

  it("reads Skyscanner and Kayak flight searches without treating them as a listing", () => {
    expect(parseUrl("https://www.skyscanner.com.tr/transport/flights/ista/opo/261008/261014/?adultsv2=2")).toMatchObject({
      provider: "Skyscanner",
      from: "ISTA",
      to: "OPO",
      checkIn: "2026-10-08",
      checkOut: "2026-10-14",
      adults: 2,
      key: null,
    });
    expect(parseUrl("https://www.kayak.com/flights/IST-OPO/2026-10-08/2026-10-14")).toMatchObject({
      from: "IST",
      to: "OPO",
      checkIn: "2026-10-08",
    });
  });

  it("strips tracking params from generic URLs but keeps identifying ones", () => {
    expect(parseUrl("https://www.example.com/tours/porto-boat/?utm_source=x").key).toBe("url:example.com/tours/porto-boat");
    expect(parseUrl("https://shop.example.com/item?id=42&ref=abc").key).toBe("url:shop.example.com/item?id=42");
  });

  it("rejects invalid dates and garbage URLs", () => {
    expect(parseUrl("https://www.booking.com/hotel/pt/x.html?checkin=2026-02-30").checkIn).toBeNull();
    expect(parseUrl("not a url").provider).toBeNull();
  });
});
