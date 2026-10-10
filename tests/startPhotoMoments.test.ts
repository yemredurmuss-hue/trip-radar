// The start's photos (2026-10-09): the trip's moments beside its places (a couple's trip romantic, the styles said,
// the food), searched as the destination's scene, and the same photo never shown twice.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import { momentLabel, newStart, photoKeys, photoMoments, photoQuery, preparedPhotos, whereKey, withPhotos, type StartState } from "../src/lib/startTrip";

const bali = (patch: Partial<StartState> = {}): StartState => ({
  ...newStart("m1", "plan", 1),
  where: { place: "Bali", country: "Endonezya", code: "ID" },
  ...patch,
});

describe("the trip's moments", () => {
  it("a couple's luxury trip: luxury, then romantic, then the food", () => {
    const s = bali({ styles: ["luxury"], who: { kind: "partner", names: [] } as StartState["who"] });
    expect(photoMoments(s).map((m) => m.style)).toEqual(["luxury", "romantic", "food"]);
  });

  it("no style said: the food and the nature; two styles said, three at most", () => {
    expect(photoMoments(bali()).map((m) => m.style)).toEqual(["food", "nature"]);
    expect(photoMoments(bali({ styles: ["beach", "culture"] })).map((m) => m.style)).toEqual(["beach", "culture", "food"]);
  });

  it("an event shows itself, no moments", () => {
    expect(photoMoments(bali({ intent: { kind: "event", name: "Ozora", place: "Ozora", code: "HU" } as StartState["intent"] }))).toEqual([]);
  });

  it("searched as the destination's scene, its country's after it", () => {
    const q = photoQuery("moment:romantic", bali());
    expect(q.query).toBe("Bali romantic dinner");
    expect(q.alt).toEqual(["Indonesia romantic dinner"]);
  });

  it("the destination searched by its English name (Lizbon → Lisbon: the Turkish name found a 'travel the world' tile board)", () => {
    const lisbon = { where: { place: "Lizbon", country: "Portekiz", code: "PT" } };
    expect(photoQuery("Lizbon", lisbon)).toEqual({ query: "Lisbon", titles: [] });
    expect(photoQuery("Prag", { where: { place: "Prag", country: "Çekya", code: "CZ" } }).query).toBe("Prague");
  });

  it("said in the chat's language on its card", () => {
    expect(withLang("tr", () => momentLabel("moment:food"))).toBe("Yerel lezzetler");
    expect(withLang("en", () => momentLabel("moment:romantic"))).toBe("A romantic evening");
    expect(momentLabel("Bali")).toBeNull();
  });

  it("the places first, the moments after, seven at most", () => {
    const keys = photoKeys(bali({ styles: ["luxury"] }));
    expect(keys[0]).toBe("Bali");
    expect(keys.filter((k) => k.startsWith("moment:"))).toEqual(["moment:luxury", "moment:food", "moment:nature"]);
    expect(keys.length).toBeLessThanOrEqual(7);
  });

  it("the same photo found twice is shown once; a moment says so and carries its words", () => {
    let s = bali();
    s = withPhotos(s, whereKey(s)!, { Bali: "https://img.test/a.jpg", Endonezya: "https://img.test/a.jpg", "moment:food": "https://img.test/f.jpg" });
    const shown = withLang("tr", () => preparedPhotos(s));
    expect(shown).toEqual([
      { place: "Bali", url: "https://img.test/a.jpg" },
      { place: "Yerel lezzetler", url: "https://img.test/f.jpg", moment: true },
    ]);
  });
});

describe("one picture under two addresses", () => {
  it("shown once when only the tracking parameters differ", () => {
    let s = bali();
    s = withPhotos(s, whereKey(s)!, {
      Bali: "https://images.unsplash.com/photo-1?ixid=a&w=2400",
      Endonezya: "https://images.unsplash.com/photo-1?ixid=b&w=2400",
      "moment:food": "https://images.unsplash.com/photo-2?ixid=c&w=2400",
    });
    const shown = withLang("tr", () => preparedPhotos(s));
    expect(shown.map((x) => x.place)).toEqual(["Bali", "Yerel lezzetler"]);
  });
});
