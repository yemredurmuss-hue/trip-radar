// A town's airport from Travelpayouts' public data (offers kind=airport, 2026-10-25): Burning Man's Reno and a desert
// trip's Merzouga had no code in the extension's table and their flights were never looked for. And a page's own
// picture (kind=pageimage): a festival's official site's og:image, read only from a public https page.
import { describe, expect, it } from "vitest";
import { airportByName, airportNear, flyData, pageImageOf, pageUrlOk } from "../supabase/functions/offers/shape";

const data = flyData(
  [
    { code: "RNO", name: "Reno", name_translations: { en: "Reno" }, country_code: "US", coordinates: { lat: 39.53, lon: -119.81 }, has_flightable_airport: true },
    { code: "RAK", name: "Marrakech", name_translations: { en: "Marrakech" }, country_code: "MA", coordinates: { lat: 31.63, lon: -7.98 }, has_flightable_airport: true },
    { code: "ERH", name: "Errachidia", country_code: "MA", coordinates: { lat: 31.93, lon: -4.43 }, has_flightable_airport: true },
    { code: "XXX", name: "Nowhere", country_code: "MA", coordinates: { lat: 30, lon: -5 }, has_flightable_airport: false },
  ],
  [
    { code: "RNO", city_code: "RNO", country_code: "US", iata_type: "airport", flightable: true, coordinates: { lat: 39.5, lon: -119.78 } },
    { code: "RAK", city_code: "RAK", country_code: "MA", iata_type: "airport", flightable: true, coordinates: { lat: 31.6, lon: -8.03 } },
    { code: "ERH", city_code: "ERH", country_code: "MA", iata_type: "airport", flightable: true, coordinates: { lat: 31.95, lon: -4.4 } },
    { code: "ZZZ", city_code: "ZZZ", country_code: "MA", iata_type: "airport", flightable: false, coordinates: { lat: 31.1, lon: -4.0 } },
  ],
);

describe("a town's airport", () => {
  it("by its name in the towns with flights, accents and case aside, in its country when said", () => {
    expect(airportByName("Reno", null, data)).toEqual({ code: "RNO", city: "RNO" });
    expect(airportByName("marrakech", "ma", data)).toEqual({ code: "RAK", city: "RAK" });
    // (a town of that name elsewhere is never taken for it)
    expect(airportByName("Reno", "IT", data)).toBeNull();
    expect(airportByName("Nowhere", null, data)).toBeNull();
  });
  it("else the nearest airport with flights to where the town is (Merzouga → Errachidia), never one without flights or too far", () => {
    expect(airportNear({ lat: 31.08, lon: -4.01 }, data)).toMatchObject({ code: "ERH" });
    expect(airportNear({ lat: 0, lon: 0 }, data)).toBeNull();
  });
});

describe("a page's own picture", () => {
  it("only a public https page by its name", () => {
    expect(pageUrlOk("https://burningman.org/")).toBe("https://burningman.org/");
    for (const bad of ["http://burningman.org/", "https://127.0.0.1/", "https://localhost/", "https://intranet/", "https://x.internal/", "https://burningman.org:8443/", "https://u:p@burningman.org/", "https://abc.supabase.co/functions/v1/x", "ftp://a.org/", null])
      expect(pageUrlOk(bad)).toBeNull();
  });
  it("its og:image (secure first), else twitter:image, made whole against the page; nothing else", () => {
    const html = `<head><meta name="twitter:image" content="https://cdn.x.org/t.jpg"><meta property="og:image" content="/img/cover.jpg?a=1&amp;b=2"></head>`;
    expect(pageImageOf(html, "https://burningman.org/")).toBe("https://burningman.org/img/cover.jpg?a=1&b=2");
    expect(pageImageOf(`<meta content="https://cdn.x.org/t.jpg" name="twitter:image">`, "https://a.org/")).toBe("https://cdn.x.org/t.jpg");
    expect(pageImageOf(`<meta property="og:image" content="http://a.org/plain.jpg">`, "https://a.org/")).toBeNull();
    expect(pageImageOf("<html></html>", "https://a.org/")).toBeNull();
  });
});
