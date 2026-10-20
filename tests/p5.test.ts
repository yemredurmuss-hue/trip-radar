// P5: a save lands in the right place (the UX test's F13, F44, F69).
import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { pageLocality } from "../src/lib/items";
import { askWord, dative, tripNamedIn } from "../src/lib/startTrip";
import type { Item, Trip } from "../src/lib/types";

beforeEach(() => setLang("tr"));

describe("P5", () => {
  it("F13: the page's own address town, when it says one", () => {
    const hotel = JSON.stringify({ "@type": "Hotel", name: "Ribeira Douro Hotel", address: { "@type": "PostalAddress", addressLocality: "Porto", addressCountry: "PT" } });
    expect(pageLocality({ jsonLd: [hotel] })).toBe("Porto");
    expect(pageLocality({ jsonLd: ["not json", JSON.stringify({ "@graph": [{ "@type": "LodgingBusiness", address: { addressLocality: "Porto" } }] })] })).toBe("Porto");
    // Two different towns, or none: nothing said.
    expect(pageLocality({ jsonLd: [hotel, JSON.stringify({ address: { addressLocality: "Lisboa" } })] })).toBeNull();
    expect(pageLocality({ jsonLd: [] })).toBeNull();
  });

  it("F44/F69: a trip's theme words are no place; another trip isn't offered for them", () => {
    const trip = (id: string, title: string) => ({ id, title, updatedAt: 1 }) as Trip;
    const trips = [trip("p", "7 Günlük Porto Şehir Turu"), trip("b", "15 Günlük Bali Balayı")];
    const items: Item[] = [];
    expect(tripNamedIn("Ağustosta 4 arkadaş Sziget festivaline gidiyoruz, 7 günlük", trips, items)).toBeNull();
    expect(tripNamedIn("Ocakta Bansko kayağı 7 günlük", trips, items)).toBeNull();
    expect(tripNamedIn("Porto'da bir otel daha", trips, items)?.trip.id).toBe("p");
  });

  it("F69: the Turkish ending and its question word", () => {
    expect(dative("15 Günlük Bali Balayı")).toBe("15 Günlük Bali Balayı'na");
    expect(dative("7 Günlük Porto Şehir Turu")).toBe("7 Günlük Porto Şehir Turu'na");
    expect(askWord(dative("15 Günlük Bali Balayı"))).toBe("mı");
    expect(askWord(dative("Porto ve Madeira Gezisi"))).toBe("mi");
  });
});
