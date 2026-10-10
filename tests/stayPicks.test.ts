// "Üç akıllı konaklama önerisi": out of a stay's candidates, "Sana en uygun", "Daha ekonomik", "Daha konforlu";
// never a hotel twice, never a made-up one, and the one sentence of why says only what's known.
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import type { StayCandidate } from "../src/lib/offerSources";
import { plannedItem } from "../src/lib/planned";
import { centreOf, pickList, pickThree, picksContext, priceLine, type PickCtx, type Picks } from "../src/lib/stayPicks";
import type { Item, Trip } from "../src/lib/types";

afterEach(() => setLang("tr"));

const UBUD = { lat: -8.5069, lng: 115.2625 };
const cand = (id: string, over: Partial<StayCandidate> = {}): StayCandidate => ({
  id, name: id, rating: 4.5, reviews: 500, photo: `https://img.example.com/${id}.jpg`, geo: null, area: "Otel", labels: [],
  url: `https://www.booking.com/${id}`, nightly: null, total: null, nights: 4, priceRange: null, source: "Booking", currency: "EUR", fetchedAt: 1, ...over,
});
const priced = (id: string, nightly: number, rating: number | null, over: Partial<StayCandidate> = {}) => cand(id, { nightly, total: nightly * 4, rating, ...over });
// Ubud-like: €40 / 47 / 103 / 155 / 173 / 209 by the night.
const ubud = (): StayCandidate[] => [
  priced("Bucu View", 40, 4.3, { reviews: 380, geo: { lat: -8.52, lng: 115.27 } }),
  priced("Ubud Hostel", 47, 3.9, { reviews: 900, geo: { lat: -8.507, lng: 115.262 } }),
  priced("Alaya Resort", 103, 4.5, { reviews: 2100, geo: { lat: -8.509, lng: 115.263 } }),
  priced("Komaneka", 155, 4.6, { reviews: 1240, geo: { lat: -8.505, lng: 115.26 } }),
  priced("Maya Ubud", 173, 4.8, { reviews: 3000, geo: { lat: -8.51, lng: 115.275 } }),
  priced("Mandapa", 209, 4.9, { reviews: 640, geo: { lat: -8.48, lng: 115.25 } }),
];
const plain: PickCtx = { centre: null, trip: null };
const ids = (p: Picks) => ({ best: p.best?.cand.id ?? null, cheaper: p.cheaper?.cand.id ?? null, comfier: p.comfier?.cand.id ?? null });
const whys = (p: Picks) => pickList(p).map((x) => x.pick.why);
const distinctIds = (p: Picks) => {
  const list = pickList(p).map((x) => x.pick.cand.id);
  expect(new Set(list).size).toBe(list.length);
  return list;
};

describe("the three", () => {
  it("the Ubud spread: the cheapest rated 4+, the best rated, and a balanced one in between; three different hotels", () => {
    const p = pickThree(ubud(), plain);
    expect(ids(p).cheaper).toBe("Bucu View");
    expect(ids(p).comfier).toBe("Mandapa");
    expect(["Alaya Resort", "Komaneka", "Maya Ubud"]).toContain(ids(p).best);
    expect(distinctIds(p)).toHaveLength(3);
    expect(p.cheaper!.why).toBe("Bulduklarımın en ucuzu, ★4,3");
    expect(p.comfier!.why).toMatch(/^Gecelik €\d+ daha fazla ama ★4,9$/);
    const diff = 209 - p.best!.cand.nightly!;
    expect(p.comfier!.why).toBe(`Gecelik €${diff} daha fazla ama ★4,9`);
    expect(pickList(p).map((x) => x.kind)).toEqual(["best", "cheaper", "comfier"]);
  });

  it("never a 3.9 as the cheaper one, even when it's cheap; said honestly when a cheaper (lower rated) one exists", () => {
    const list = [priced("Cheap Bad", 30, 3.9), priced("Ok", 60, 4.2), priced("Mid", 90, 4.4), priced("Top", 150, 4.8)];
    const p = pickThree(list, plain);
    expect(ids(p).cheaper).toBe("Ok");
    expect(p.cheaper!.why).toBe("★4 ve üstünün en ucuzu, ★4,2");
  });

  it("Madeira with two hotels unpriced for the dates: never the cheaper pick; only their usual range is shown", () => {
    const list = [
      cand("Quinta Range", { rating: 4.7, reviews: 1500, priceRange: { min: 60, max: 90 } }),
      cand("Casa Range", { rating: 4.4, reviews: 300, priceRange: { min: 50, max: 70 } }),
      priced("Hotel do Carmo", 110, 4.2, { reviews: 800 }),
      priced("Pestana", 160, 4.5, { reviews: 2400 }),
      priced("Reid's", 380, 4.8, { reviews: 3100 }),
    ];
    const p = pickThree(list, plain);
    expect(p.cheaper!.cand.nightly).not.toBeNull();
    expect(ids(p).cheaper).toBe("Hotel do Carmo");
    expect(ids(p).comfier).toBe("Reid's");
    distinctIds(p);
    expect(priceLine(list[0])).toBe("tipik €60–90 / gece · tarihli fiyat yok");
    expect(priceLine(list[3])).toBe("€160 / gece · 4 gece €640");
  });

  it("only unpriced hotels: no cheaper card; the best rated one with a range is 'Daha konforlu'", () => {
    const list = [cand("A", { rating: 4.2, priceRange: { min: 50, max: 80 } }), cand("B", { rating: 4.8, priceRange: { min: 120, max: 180 } }), cand("C", { rating: 4.5 })];
    const p = pickThree(list, plain);
    expect(p.cheaper).toBeNull();
    expect(ids(p).comfier).toBe("B");
    expect(ids(p).best).not.toBe("B");
    distinctIds(p);
  });

  it("the same hotel told six times: one card; the copy priced for the dates is the one kept", () => {
    const same = [cand("xo:1", { name: "Alaya Ubud" }), priced("xo:1", 103, 4.5, { name: "Alaya Ubud" }), priced("xo:2", 103, 4.5, { name: "ALAYA  ubud" }), cand("xo:1", { name: "Alaya Ubud" })];
    const p = pickThree(same, plain);
    expect(pickList(p)).toHaveLength(1);
    expect(p.best!.cand.nightly).toBe(103);
  });

  it("one or two candidates: fewer cards, 'Sana en uygun' first, the other only when it really is cheaper or better rated", () => {
    expect(pickList(pickThree([], plain))).toHaveLength(0);
    const one = pickThree([priced("Solo", 90, 4.5)], plain);
    expect(ids(one)).toEqual({ best: "Solo", cheaper: null, comfier: null });
    const two = pickThree([priced("Dear", 200, 4.9, { reviews: 3000 }), priced("Cheap", 60, 4.3)], plain);
    expect(pickList(two)).toHaveLength(2);
    distinctIds(two);
    // The other is no cheaper and no better rated: one card only.
    const worse = pickThree([priced("Good", 80, 4.7, { reviews: 3000 }), priced("Worse", 120, 4.1, { reviews: 3000 })], plain);
    expect(ids(worse)).toEqual({ best: "Good", cheaper: null, comfier: null });
  });
});

describe("the trip's own data", () => {
  it("the price is weighed against the other hotels, never a share of the trip's budget: no word of budget", () => {
    for (const why of whys(pickThree(ubud(), plain))) expect(why).not.toMatch(/bütçe/);
    expect(pickThree(ubud(), plain).cheaper!.why).toBe("Bulduklarımın en ucuzu, ★4,3");
    // Even nearby, the best for you is rated 4 or more.
    expect(pickThree(ubud(), { ...plain, centre: UBUD }).best!.cand.rating).toBeGreaterThanOrEqual(4);
  });

  it("no place on the map: distance plays no part and is never said", () => {
    const noGeo = ubud().map((c) => ({ ...c, geo: null }));
    const p = pickThree(noGeo, { ...plain, centre: UBUD });
    for (const why of whys(p)) expect(why).not.toMatch(/km/);
    for (const why of whys(pickThree(ubud(), plain))) expect(why).not.toMatch(/km/);
    // With the trip's plans there on the map, the best says how far it is.
    const near = pickThree(ubud(), { ...plain, centre: UBUD });
    expect(near.best!.why).toMatch(/planının merkezine \d+(,\d)? km/);
  });

  it("the plans' middle: only the trip's own records there with a place on the map", () => {
    const at = (city: string, geo: { lat: number; lng: number } | null, id: string): Item => ({
      ...plannedItem({ kind: "activity", date: "2026-12-11", end_date: null, time: null, from: null, to: null, city, title: id, booked: false, note: null }, "t", id, 1),
      geo: geo ? { ...geo, source: "page" } : null,
    });
    const items = [at("Ubud", { lat: -8.5, lng: 115.26 }, "a"), at("Ubud", { lat: -8.52, lng: 115.28 }, "b"), at("Canggu", { lat: -8.65, lng: 115.13 }, "c"), at("Ubud", null, "d")];
    expect(centreOf(items, "Ubud")).toMatchObject({ lat: expect.closeTo(-8.51), lng: expect.closeTo(115.27) });
    expect(centreOf(items, "Seminyak")).toBeNull();
    expect(centreOf([at("Ubud", null, "x")], "Ubud")).toBeNull();
    const trip: Trip = { id: "t", title: "Bali", confirmedDates: { start: "2026-12-10", end: "2026-12-22" }, budget: { amount: 3000, currency: "EUR" }, heroImage: null, createdAt: 1, updatedAt: 1 };
    expect(picksContext({ city: "Ubud" }, trip, items)).toMatchObject({ centre: { lat: expect.closeTo(-8.51), lng: expect.closeTo(115.27) } });
  });

  it("a must the labels answer ('kahvaltı dahil'): weighed and said; with no label saying it, ignored, never guessed", () => {
    const must = { requirements: [{ kind: "amenity" as const, amenity: "kahvaltı dahil" as const }] };
    const base = pickThree(ubud(), plain);
    // Nobody's label says it: the same picks, and no word of breakfast.
    const unanswered = pickThree(ubud(), { ...plain, trip: must });
    expect(ids(unanswered)).toEqual(ids(base));
    for (const why of whys(unanswered)) expect(why).not.toMatch(/kahvaltı/i);
    // One's label says it: that one is the best for this trip, and the why says so.
    const other = ["Alaya Resort", "Komaneka", "Maya Ubud"].find((id) => id !== base.best!.cand.id)!;
    const labelled = ubud().map((c) => (c.id === other ? { ...c, labels: ["Kahvaltı dahil"] } : c));
    const p = pickThree(labelled, { ...plain, trip: must });
    expect(ids(p).best).toBe(other);
    expect(p.best!.why).toContain("kahvaltı dahil, istediğin gibi");
    // Without the must, the label is just a label: not weighed, not said.
    expect(ids(pickThree(labelled, plain))).toEqual(ids(base));
    for (const why of whys(pickThree(labelled, plain))) expect(why).not.toMatch(/kahvaltı/i);
  });

  it("a 'quiet' must: no label can say it, so it changes nothing", () => {
    const quiet = { requirements: [{ kind: "avoid" as const, topic: "noise" as const }] };
    expect(ids(pickThree(ubud(), { ...plain, trip: quiet }))).toEqual(ids(pickThree(ubud(), plain)));
    for (const why of whys(pickThree(ubud(), { ...plain, trip: quiet }))) expect(why).not.toMatch(/sessiz|gürültü/i);
  });
});

describe("the why: data only", () => {
  it("unknown rating, reviews, place and price are never claimed", () => {
    const bare = [
      cand("No Rating", { rating: null, reviews: null, nightly: 80, total: 320 }),
      cand("No Reviews", { rating: 4.4, reviews: null, nightly: 95, total: 380 }),
      cand("No Price", { rating: 4.9, reviews: null, priceRange: null }),
      cand("Range Only", { rating: 4.6, reviews: null, priceRange: { min: 100, max: 140 } }),
    ];
    const p = pickThree(bare, { ...plain, centre: UBUD });
    distinctIds(p);
    for (const { pick } of pickList(p)) {
      expect(pick.why).not.toMatch(/yorum|km|undefined|null|NaN/);
      if (pick.cand.rating == null) expect(pick.why).not.toContain("★");
      if (pick.cand.nightly == null) expect(pick.why).not.toMatch(/bütçe|€/);
    }
    // An unrated hotel among them: "the highest rating" is never said (it might be higher).
    for (const why of whys(p)) expect(why).not.toMatch(/en yüksek puan/i);
    expect(priceLine(bare[2])).toBe("tarihli fiyat yok");
  });

  it("the highest rating said only when it is the highest of them all, with its reviews", () => {
    const list = [priced("A", 50, 4.2, { reviews: 100 }), priced("B", 90, 4.8, { reviews: 1240 }), priced("C", 120, 4.5, { reviews: 400 })];
    const p = pickThree(list, plain);
    expect(ids(p).comfier).toBe("B");
    // B is cheaper than the best (C): no "more a night"; the rating said instead.
    expect(p.comfier!.why).toBe("En yüksek puan (★4,8 · 1.240 yorum)");
  });

  it("in English", () => {
    setLang("en");
    const p = pickThree(ubud(), plain);
    expect(p.cheaper!.why).toBe("The cheapest I found, ★4.3");
    expect(priceLine(ubud()[3])).toBe("€155 / night · 4 nights €620");
    expect(priceLine(cand("x", { priceRange: { min: 120, max: 180 } }))).toBe("typically €120–180 / night · no price for your dates");
  });
});
