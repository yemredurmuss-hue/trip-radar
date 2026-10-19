// The hero's mosaic (lib/heroMosaic.ts, v82 aşama 1, row 14): the places on the plan as tiles, from different cities
// first; then what was saved, the cities, the trip's moments and a drawing; never a photo that isn't there, never the
// cover's twice, never more drawings than photos; credits only when known (C7).
import { describe, expect, it } from "vitest";
import { linksOf, momentsOf, mosaicOf, placesOfIntents, shownTiles, type MosaicCity, type MosaicPlace } from "../src/lib/heroMosaic";
import type { IntentVM } from "../src/lib/intents";
import { cityKeyOf } from "../src/lib/plan";
import { momentPhotoKeys } from "../src/lib/startTrip";
import type { PhotoCredit } from "../src/lib/types";

const wiki: PhotoCredit = { by: null, source: "wikipedia", authorUrl: null, photoPage: null };
const city = (name: string, image: string | null, nights = "3 gece"): MosaicCity => ({ name, image, credit: image ? wiki : null, nights });
const place = (key: string, cityName: string, image: string | null, booked = false): MosaicPlace => ({ key, name: key, city: cityName, image, credit: null, booked });

describe("mosaicOf", () => {
  it("has no cover photo and no tiles with no photo at all: the cover alone", () => {
    const m = mosaicOf({ cities: [city("Porto", null), city("Lizbon", null)], places: [place("Douro", "Porto", null)] });
    expect(m).toEqual({ cover: null, tiles: [], kind: null });
  });

  it("covers with the first city's photo, the places on the plan first, then the other cities", () => {
    const m = mosaicOf({ cities: [city("Tokyo", "t.jpg"), city("Kyoto", "k.jpg", "4 gece"), city("Hakone", "h.jpg"), city("Osaka", "o.jpg")], places: [place("Shibuya Sky", "Tokyo", "s.jpg")] });
    expect(m.cover).toEqual({ image: "t.jpg", credit: wiki });
    expect(m.kind).toBe("city");
    expect(m.tiles.map((t) => [t.from, t.name, t.sub])).toEqual([["place", "Shibuya Sky", "Tokyo"], ["city", "Kyoto", "4 gece"], ["city", "Hakone", "3 gece"], ["city", "Osaka", "3 gece"]]);
  });

  it("row 14: with no place's photo the tiles fill by the order (saved links, cities, moments, a drawing), none empty", () => {
    const m = mosaicOf({
      cities: [city("Porto", "p.jpg"), city("Lizbon", "l.jpg"), city("Sintra", null, "1 gece")],
      places: [place("Douro", "Porto", null)],
      links: [place("Casa", "Porto", "c.jpg"), place("Tram 28", "Lizbon", "t.jpg"), place("No photo", "Lizbon", null)],
      moments: [{ name: "Yerel lezzetler", image: "f.jpg", credit: null }],
    });
    expect(m.tiles.map((t) => [t.from, t.name])).toEqual([["link", "Casa"], ["link", "Tram 28"], ["city", "Lizbon"], ["moment", "Yerel lezzetler"]]);
    expect(m.tiles.every((t) => t.image)).toBe(true);
    // Six wanted, five photos: the drawing of the city with no photo rounds the grid off (never a hole, never empty).
    const six = mosaicOf({
      cities: [city("Porto", "p.jpg"), city("Lizbon", "l.jpg"), city("Sintra", null, "1 gece")],
      places: [place("A", "Porto", "1.jpg"), place("B", "Lizbon", "2.jpg"), place("C", "Porto", "3.jpg")],
      moments: [{ name: "Gün batımı", image: "g.jpg", credit: null }],
    });
    expect(six.tiles.map((t) => [t.from, t.name, t.image])).toEqual([
      ["place", "A", "1.jpg"], ["place", "B", "2.jpg"], ["place", "C", "3.jpg"], ["city", "Lizbon", "l.jpg"], ["moment", "Gün batımı", "g.jpg"], ["art", "Sintra", null],
    ]);
  });

  it("never draws more drawings than photos, nor a drawing alone", () => {
    expect(mosaicOf({ cities: [city("Porto", "p.jpg"), city("Lizbon", null), city("Sintra", null)], places: [] }).tiles).toEqual([]);
    const one = mosaicOf({ cities: [city("Porto", "p.jpg"), city("Lizbon", "l.jpg"), city("Sintra", null), city("Évora", null)], places: [] });
    expect(one.tiles.map((t) => t.from)).toEqual(["city", "art"]);
    // A photo that fails to load takes its drawing with it.
    expect(shownTiles(one.tiles, new Set(["l.jpg"]))).toEqual([]);
  });

  it("never shows the cover's photo again (the trip's one picture standing for every city)", () => {
    const m = mosaicOf({ cities: [city("Porto", "p.jpg"), city("Lizbon", "p.jpg")], places: [] });
    expect(m.tiles).toEqual([]);
    expect(m.kind).toBeNull();
  });

  it("tiles six places, a city's second only after every city's first, booked first", () => {
    const places = [
      place("Ramen", "Tokyo", "r.jpg"),
      place("Shibuya Sky", "Tokyo", "s.jpg", true),
      place("Fushimi Inari", "Kyoto", "f.jpg"),
      place("Arashiyama", "Kyoto", "a.jpg"),
      place("Gora Kadan", "Hakone", "g.jpg", true),
      place("Dotonbori", "Osaka", "d.jpg"),
      place("Tsukiji", "Tokyo", "x.jpg"),
    ];
    const m = mosaicOf({ cities: [city("Tokyo", "t.jpg")], places });
    expect(m.kind).toBe("place");
    expect(m.tiles.map((t) => t.name)).toEqual(["Shibuya Sky", "Gora Kadan", "Fushimi Inari", "Dotonbori", "Ramen", "Arashiyama"]);
    expect(m.tiles[0]).toMatchObject({ key: "place:Shibuya Sky", sub: "Tokyo", image: "s.jpg", credit: null });
  });

  it("takes four of five (no hole in the grid) and skips places with no photo or the same photo twice", () => {
    const places = [place("A", "X", "1.jpg"), place("B", "Y", "2.jpg"), place("C", "Z", "3.jpg"), place("D", "W", "4.jpg"), place("E", "V", "5.jpg"), place("F", "V", null), place("G", "U", "1.jpg")];
    const m = mosaicOf({ cities: [], places });
    expect(m.cover).toBeNull();
    expect(m.tiles.map((t) => t.name)).toEqual(["A", "B", "C", "D"]);
  });

  it("takes the places first and the cities after them while few places have photos", () => {
    const m = mosaicOf({ cities: [city("Porto", "p.jpg"), city("Lizbon", "l.jpg")], places: [place("A", "Porto", "1.jpg"), place("B", "Porto", "2.jpg"), place("C", "Lizbon", "3.jpg")] });
    expect(m.kind).toBe("place");
    expect(m.tiles.map((t) => t.name)).toEqual(["A", "C", "B", "Lizbon"]);
  });
});

describe("placesOfIntents", () => {
  const vm = (over: Partial<IntentVM>): IntentVM => ({ section: "activity", frame: "collection", status: "chosen", chosen: null, planned: [], head: { city: "Porto" }, ...over }) as IntentVM;
  const option = (id: string, image: string | null, status: "chosen" | "booked" = "chosen") => ({ id, title: id, image, item: { city: "Porto", status } });
  it("takes a row's planned cards and a stay chosen or booked, nothing else", () => {
    const intents = [
      vm({ planned: [option("Douro", "d.jpg", "booked"), option("Lello", null)] as never }),
      vm({ section: "stay", frame: "stay", status: "booked", chosen: option("Lisboa Loft", "l.jpg") as never, head: { city: "Lizbon" } as never }),
      vm({ section: "stay", frame: "stay", status: "suggested", chosen: option("Jardim", "j.jpg") as never }),
      vm({ section: "flight", frame: "ticket", status: "booked", chosen: option("TK", "t.jpg") as never }),
    ];
    const out = placesOfIntents(intents, (img) => (img === "d.jpg" ? wiki : null));
    expect(out.map((p) => [p.name, p.city, p.image, p.booked, p.credit])).toEqual([
      ["Douro", "Porto", "d.jpg", true, wiki],
      ["Lello", "Porto", null, false, null],
      ["Lisboa Loft", "Lizbon", "l.jpg", true, null],
    ]);
  });
});

describe("the mosaic's other sources", () => {
  it("links: what was saved with a photo, places only (a stay, a tour, a meal), not what is on the plan", () => {
    const item = (id: string, category: string, status = "saved", imageUrl: string | null = `${id}.jpg`) => ({ id, name: id, city: "Porto", imageUrl, status, category });
    const out = linksOf([item("casa", "stay"), item("tour", "activity"), item("tk", "flight"), item("esim", "esim"), item("chosen", "stay", "chosen"), item("gone", "food", "dismissed"), item("bare", "food", "saved", null)], () => null);
    expect(out.map((p) => p.name)).toEqual(["casa", "tour"]);
  });
  it("moments: the start's scenes kept among the cities' photos, by their words in either language", () => {
    const out = momentsOf({ porto: "p.jpg", "romantik akşam": "r.jpg", "local food": "f.jpg" }, [{ key: "romantik akşam", name: "Romantik akşam" }, { key: "local food", name: "Yerel lezzetler" }, { key: "doğa", name: "Doğa" }], () => null);
    expect(out).toEqual([{ name: "Romantik akşam", image: "r.jpg", credit: null }, { name: "Yerel lezzetler", image: "f.jpg", credit: null }]);
  });
  it("finds a moment kept by the start in either language (Generating.keepPhotos: cityKeyOf of its words)", () => {
    const keys = momentPhotoKeys();
    expect(keys).toContainEqual({ key: cityKeyOf("Romantik akşam"), name: "Romantik akşam" });
    expect(keys).toContainEqual({ key: cityKeyOf("A romantic evening"), name: "Romantik akşam" });
  });
});
