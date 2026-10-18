// The providers' one register (lib/providers.ts, v82 geçişi aşama 0): which sites a need shows and in what order — the
// traveller's own link's site, then the place's own, then the kind's defaults — and that it only wraps searchLinks,
// brands, affiliate and prepBuy (the same searches, colours, partner brands and things to buy).
import { describe, expect, it } from "vitest";
import { brandOf } from "../src/lib/brands";
import { withLang } from "../src/lib/i18n";
import { amazonLink } from "../src/lib/prepBuy";
import { amazonHost, pickProviders, providerById, providerLinks, providerOfLink, PROVIDERS, shopLinks, type ProviderKind } from "../src/lib/providers";
import { activityLinks, esimLinks, flightLinks, stayLinks } from "../src/lib/searchLinks";

const ids = (kind: ProviderKind, at: Parameters<typeof pickProviders>[1] = {}) => pickProviders(kind, at).map((p) => p.id);

describe("the register", () => {
  it("holds the sites of the v82 drawing, each with its mark, kinds and countries", () => {
    expect(PROVIDERS.map((p) => p.id).sort()).toEqual(
      ["agoda", "airalo", "airbnb", "amazon", "booking", "getyourguide", "gflights", "hepsiburada", "holafly", "jr", "klook", "rome2rio", "skyscanner", "trendyol", "viator"].sort(),
    );
    for (const p of PROVIDERS) {
      expect(p.kinds.length, p.id).toBeGreaterThan(0);
      expect(p.logo.letter, p.id).toMatch(/^\S{1,2}$/);
      expect(p.logo.color, p.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.countries === "global" || p.countries.length > 0, p.id).toBe(true);
    }
    expect(providerById("jr").countries).toEqual(["JP"]);
    expect(providerById("trendyol")).toMatchObject({ countries: ["TR"], serves: "home" });
    expect(withLang("tr", () => providerById("gflights").name())).toBe("Google Uçuşlar");
    expect(withLang("en", () => providerById("gflights").name())).toBe("Google Flights");
  });

  it("the partner flag and the label colour are affiliate.ts's and brands.ts's", () => {
    const partners = PROVIDERS.filter((p) => p.partner).map((p) => p.id).sort();
    expect(partners).toEqual(["agoda", "airalo", "booking", "getyourguide", "klook", "viator"]);
    expect(providerById("booking").chip).toBe(brandOf("Booking.com")!.color);
    expect(providerById("airbnb").chip).toBe(brandOf("Airbnb")!.color);
    expect(providerById("rome2rio").chip).toBeNull();
  });
});

describe("the order: the traveller's link, the place's own, the kind's defaults", () => {
  it("a stay: Booking.com and Airbnb; in Asia Agoda first", () => {
    expect(ids("stay", { country: "PT" })).toEqual(["booking", "airbnb", "agoda"]);
    expect(ids("stay", { country: "JP" })).toEqual(["agoda", "booking", "airbnb"]);
    expect(ids("stay")).toEqual(["booking", "airbnb", "agoda"]);
  });

  it("the site of the link the traveller sent comes first, wherever the trip goes", () => {
    expect(ids("stay", { country: "JP", link: "https://www.airbnb.co.uk/rooms/48213377" })).toEqual(["airbnb", "agoda", "booking"]);
    expect(ids("stay", { country: "PT", link: "https://www.booking.com/hotel/pt/jardim-stay.html" })).toEqual(["booking", "airbnb", "agoda"]);
    // A site the register doesn't know (a hotel's own) changes nothing; nor does a link of another kind's site.
    expect(ids("stay", { country: "JP", link: "https://www.hotel-gracery.jp/" })).toEqual(["agoda", "booking", "airbnb"]);
    expect(ids("stay", { country: "JP", link: "https://www.klook.com/activity/1" })).toEqual(["agoda", "booking", "airbnb"]);
    expect(providerOfLink("https://www.getyourguide.de/porto-l151/")?.id).toBe("getyourguide");
    expect(providerOfLink("not a link")).toBeNull();
  });

  it("a train: JR in Japan only, Rome2rio everywhere", () => {
    expect(ids("train", { country: "JP" })).toEqual(["jr", "rome2rio"]);
    expect(ids("train", { country: "IT" })).toEqual(["rome2rio"]);
    expect(ids("train", { country: ["IT", "JP"] })).toEqual(["jr", "rome2rio"]);
  });

  it("tours: Klook first in Asia; flights and eSIMs the same everywhere", () => {
    expect(ids("activity", { country: "JP" })).toEqual(["klook", "getyourguide", "viator"]);
    expect(ids("activity", { country: "PT" })).toEqual(["getyourguide", "viator", "klook"]);
    expect(ids("flight", { country: "JP" })).toEqual(["skyscanner", "gflights"]);
    expect(ids("esim", { country: "JP" })).toEqual(["airalo", "holafly"]);
  });

  it("a thing to buy goes by the traveller's own country: Trendyol and Hepsiburada from Turkey, else that country's Amazon", () => {
    expect(ids("shop", { home: "TR", country: "JP" })).toEqual(["trendyol", "hepsiburada", "amazon"]);
    expect(ids("shop", { home: "DE", country: "TR" })).toEqual(["amazon"]);
    expect(ids("shop")).toEqual(["amazon"]);
    expect(amazonHost("TR")).toBe("www.amazon.com.tr");
    expect(amazonHost("DE")).toBe("www.amazon.de");
    expect(amazonHost("PT")).toBe("www.amazon.com");
  });
});

describe("the searches are the existing ones", () => {
  const stay = { city: "Porto", start: "2026-10-08", end: "2026-10-11", adults: 2 };
  it("a stay's, a flight's, a tour's and an eSIM's come from searchLinks.ts as they are", () => {
    const [booking, airbnb] = stayLinks({ city: "Porto", checkin: "2026-10-08", checkout: "2026-10-11", adults: 2 });
    expect(providerById("booking").search(stay)).toBe(booking.url);
    expect(providerById("airbnb").search(stay)).toBe(airbnb.url);
    const flights = flightLinks({ from: "IST", to: "OPO", date: "2026-10-08", adults: 2 });
    expect(providerById("gflights").search({ from: "IST", to: "OPO", start: "2026-10-08", adults: 2 })).toBe(flights.find((l) => l.brand === "gflights")!.url);
    expect(providerById("skyscanner").search({ from: "IST", to: "OPO", start: "2026-10-08", adults: 2 })).toBe(flights.find((l) => l.brand === "skyscanner")!.url);
    // Skyscanner needs both airports and a day, as before: nothing half-filled.
    expect(providerById("skyscanner").search({ from: "IST", to: "Gaula" })).toBeNull();
    expect(providerById("klook").search({ city: "Kyoto" })).toBe(activityLinks("Kyoto").find((l) => l.brand === "klook")!.url);
    expect(providerById("airalo").search({ country: "JP" })).toBe(esimLinks("JP")[0].url);
    expect(providerById("holafly").search({ country: "JP" })).toBe(esimLinks("JP")[1].url);
  });

  it("the new sites' searches take what's known and leave out what can't be filled", () => {
    expect(providerById("agoda").search({ city: "Osaka", start: "2026-04-12", end: "2026-04-16", adults: 2 })).toBe(
      "https://www.agoda.com/search?textToSearch=Osaka&checkIn=2026-04-12&checkOut=2026-04-16&adults=2&rooms=1",
    );
    expect(providerById("agoda").search({ city: null })).toBeNull();
    expect(providerById("rome2rio").search({ from: "Tokyo", to: "Kyoto" })).toBe("https://www.rome2rio.com/map/Tokyo/Kyoto");
    expect(providerById("rome2rio").search({ from: "IST", to: "OPO" })).toBe("https://www.rome2rio.com/map/%C4%B0stanbul/Porto");
    expect(providerById("rome2rio").search({ from: "Tokyo" })).toBeNull();
    expect(providerById("trendyol").search({ query: "priz adaptörü" })).toBe("https://www.trendyol.com/sr?q=priz%20adapt%C3%B6r%C3%BC");
    expect(providerById("hepsiburada").search({ query: null })).toBeNull();
  });

  it("providerLinks: the picked sites' searches, those that can be filled", () => {
    const links = providerLinks("train", { country: "JP" }, { from: "Tokyo", to: "Kyoto" });
    expect(links.map((l) => l.provider.id)).toEqual(["jr", "rome2rio"]);
    expect(providerLinks("flight", {}, { from: "IST", to: "Gaula", start: "2026-10-08" }).map((l) => l.provider.id)).toEqual(["gflights"]);
  });

  it("Hazırlık's shops: only a thing to buy (prepBuy), with no country known the same Amazon search it opens today", () => {
    const amazon = shopLinks("A tipi priz adaptörü");
    expect(amazon.map((l) => l.provider.id)).toEqual(["amazon"]);
    expect(amazon[0].url).toBe(amazonLink("A tipi priz adaptörü"));
    expect(withLang("en", () => shopLinks("Powerbank al")[0].url)).toBe(withLang("en", () => amazonLink("Powerbank al")));
    expect(shopLinks("A tipi priz adaptörü", "TR").map((l) => l.url)).toEqual([
      "https://www.trendyol.com/sr?q=A%20tipi%20priz%20adapt%C3%B6r%C3%BC",
      "https://www.hepsiburada.com/ara?q=A%20tipi%20priz%20adapt%C3%B6r%C3%BC",
      "https://www.amazon.com.tr/s?k=A%20tipi%20priz%20adapt%C3%B6r%C3%BC",
    ]);
    expect(shopLinks("Yağmurluk", "DE")[0].url).toBe("https://www.amazon.de/s?k=Ya%C4%9Fmurluk");
    expect(shopLinks("Nakit yen", "TR")).toEqual([]);
    expect(shopLinks("Decathlon'dan yağmurluk al", "TR")).toEqual([]);
  });
});
