// The hero's mosaic (lib/heroMosaic.ts, v82 aşama 1): the places on the plan as tiles, from different cities first;
// a new backbone's cities instead (C19); never a photo that isn't there, never the cover's twice; credits only when known (C7).
import { describe, expect, it } from "vitest";
import { mosaicOf, placesOfIntents, type MosaicCity, type MosaicPlace } from "../src/lib/heroMosaic";
import type { IntentVM } from "../src/lib/intents";
import type { PhotoCredit } from "../src/lib/types";

const wiki: PhotoCredit = { by: null, source: "wikipedia", authorUrl: null, photoPage: null };
const city = (name: string, image: string | null, nights = "3 gece"): MosaicCity => ({ name, image, credit: image ? wiki : null, nights });
const place = (key: string, cityName: string, image: string | null, booked = false): MosaicPlace => ({ key, name: key, city: cityName, image, credit: null, booked });

describe("mosaicOf", () => {
  it("has no cover photo and no tiles with no photo at all: the cover alone", () => {
    const m = mosaicOf({ cities: [city("Porto", null), city("Lizbon", null)], places: [place("Douro", "Porto", null)] });
    expect(m).toEqual({ cover: null, tiles: [], kind: null });
  });

  it("covers with the first city's photo and tiles the other cities when few places are on the plan", () => {
    const m = mosaicOf({ cities: [city("Tokyo", "t.jpg"), city("Kyoto", "k.jpg", "4 gece"), city("Hakone", "h.jpg"), city("Osaka", "o.jpg")], places: [place("Shibuya Sky", "Tokyo", "s.jpg")] });
    expect(m.cover).toEqual({ image: "t.jpg", credit: wiki });
    expect(m.kind).toBe("city");
    expect(m.tiles.map((t) => [t.name, t.sub])).toEqual([["Kyoto", "4 gece"], ["Hakone", "3 gece"], ["Osaka", "3 gece"]]);
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

  it("keeps to the cities while fewer than four places have photos", () => {
    const m = mosaicOf({ cities: [city("Porto", "p.jpg"), city("Lizbon", "l.jpg")], places: [place("A", "Porto", "1.jpg"), place("B", "Porto", "2.jpg"), place("C", "Lizbon", "3.jpg")] });
    expect(m.kind).toBe("city");
    expect(m.tiles.map((t) => t.name)).toEqual(["Lizbon"]);
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
