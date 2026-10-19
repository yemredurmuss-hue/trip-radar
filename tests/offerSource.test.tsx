// The AI offers' row under an empty card (spec 2026-10-06-bos-kartlar-design.md, revision 2), with a fake source:
// closed at first, remembered per section, a new count never opens it, only real offers, never drawn while no
// source is connected.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmptyEnvContext } from "../src/app/cards/emptyEnv";
import { OfferRow, OfferRowView, StayPicksView } from "../src/app/cards/OfferRow";
import type { StayCandidate } from "../src/lib/offerSources";
import { candidateOffer, pickCard, pickList, pickOnPlan, pickThree } from "../src/lib/stayPicks";
import { nearTexts } from "../src/lib/intents";
import {
  dealPrice,
  MAX_OFFERS,
  NO_SOURCE,
  offerItem,
  offersOpenKey,
  readOffersOpen,
  shownOffers,
  toggled,
  nearbyList,
  topicList,
  validOffers,
  withOffers,
  without,
  writeOffersOpen,
  type Need,
  type Offer,
  type SuggestionSource,
} from "../src/lib/offerSource";

const need: Need = { key: "stay:ubud:2026-12-10:2026-12-22", section: "stay", kind: "stay", city: "Ubud", start: "2026-12-10", end: "2026-12-22", adults: 2 };
const offer = (over: Partial<Offer> = {}): Offer => ({
  id: "o1", kind: "stay", title: "Alaya Ubud", photo: "https://img.example.com/a.jpg", rating: 8.9, price: 943, currency: "EUR", nights: 12,
  url: "https://www.booking.com/hotel/id/alaya.html", why: "Seçtiğin semtte, €15 daha ucuz", source: "Booking", fetchedAt: 5, ...over,
});

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

describe("only real offers", () => {
  it("keeps well-formed ones of the kind asked, at most three, each once", () => {
    const list = [offer(), offer({ id: "o2" }), offer({ id: "o1" }), offer({ id: "o3" }), offer({ id: "o4" })];
    expect(validOffers(list, need).map((o) => o.id)).toEqual(["o1", "o2", "o3"]);
    expect(MAX_OFFERS).toBe(3);
  });
  it("drops what isn't an offer: another kind, no https page, no name or source; a photo off https is left out", () => {
    const bad = [
      offer({ kind: "flight" }),
      offer({ id: "x1", url: "http://booking.com/x" }),
      offer({ id: "x2", url: "javascript:alert(1)" }),
      offer({ id: "x3", title: "  " }),
      offer({ id: "x4", source: "" }),
      null,
      "Alaya",
    ];
    expect(validOffers(bad, need)).toEqual([]);
    expect(validOffers([offer({ photo: "http://img/x.jpg", rating: -1, price: Number.NaN })], need)[0]).toMatchObject({ photo: null, rating: null, price: null });
    expect(validOffers("nope", need)).toEqual([]);
  });
});

describe("open or closed", () => {
  it("closed at first; remembered per trip and section; no storage is closed", () => {
    const store = memory();
    const key = offersOpenKey("t1", "stay");
    expect(key).toBe("trip-radar:offers-open:t1:stay");
    expect(readOffersOpen(key, store)).toBe(false);
    writeOffersOpen(key, true, store);
    expect(readOffersOpen(key, store)).toBe(true);
    expect(readOffersOpen(offersOpenKey("t1", "flight"), store)).toBe(false);
    expect(readOffersOpen(key, null)).toBe(false);
  });
  it("a storage that throws is ignored", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(readOffersOpen("k", broken)).toBe(false);
    expect(() => writeOffersOpen("k", true, broken)).not.toThrow();
  });
  it("new offers change the number, never open it; × and add take one away", () => {
    let s = { open: false, offers: [] as Offer[], gone: [] as string[] };
    s = withOffers(s, [offer(), offer({ id: "o2" })]);
    expect([s.open, shownOffers(s).length]).toEqual([false, 2]);
    s = withOffers(toggled(s), [offer(), offer({ id: "o2" }), offer({ id: "o3" })]);
    expect([s.open, shownOffers(s).length]).toEqual([true, 3]);
    s = without(without(s, "o2"), "o2");
    expect([s.gone, shownOffers(s).map((o) => o.id)]).toEqual([["o2"], ["o1", "o3"]]);
  });
});

describe("the row as drawn", () => {
  it("closed: the count line only, never the cards", () => {
    const html = renderToStaticMarkup(<OfferRowView offers={[offer(), offer({ id: "o2" })]} open={false} onToggle={noop} onAdd={noop} onLess={noop} />);
    expect(html).toContain("Senin için 2 öneri");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("ek-offer-list");
  });
  it("open, a stay (v3): photo, name, rating chip and area, the why; the deal by the night, the total under it, Ekle →, ×", () => {
    const html = renderToStaticMarkup(
      <OfferRowView offers={[offer({ area: "Ubud merkez · Monkey Forest'a 5 dk" })]} open adults={2} now={5 + 2 * 3_600_000} onToggle={noop} onAdd={noop} onLess={noop} />,
    );
    for (const part of [
      "Senin için 1 öneri", 'aria-expanded="true"', 'src="https://img.example.com/a.jpg"', "Alaya Ubud", '<span class="ek-of-rate">8,9</span>', "Ubud merkez · Monkey Forest&#x27;a 5 dk",
      "✨ Seçtiğin semtte, €15 daha ucuz", "Booking", 'title="Booking · 2 sa önce"', "€79", "/ gece", "12 gece · €943 toplam", "Ekle", "→", 'aria-label="Bunun gibileri gösterme"',
    ]) {
      expect(html).toContain(part);
    }
    expect(html).not.toContain("Öneri<");
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("the rating chip: a star for a 5-scale rating ('★ 4,7'), the bare number for a 10-scale one ('8,9')", () => {
    const html = renderToStaticMarkup(<OfferRowView offers={[offer({ rating: 4.7 }), offer({ id: "o2", rating: 8.9 }), offer({ id: "o3", rating: 5 })]} open onToggle={noop} onAdd={noop} onLess={noop} />);
    expect(html).toContain('<span class="ek-of-rate">★ 4,7</span>');
    expect(html).toContain('<span class="ek-of-rate">8,9</span>');
    expect(html).toContain('<span class="ek-of-rate">★ 5</span>');
  });
  it("open, a flight: carrier, hours and codes, how long, Direkt; the total for who goes", () => {
    const flight = offer({ id: "f1", kind: "flight", title: "TK 1951", carrier: "Turkish Airlines", depart: "07:40", arrive: "10:25", fromCode: "IST", toCode: "AMS", durationMinutes: 225, stops: 0, price: 312, nights: null, photo: null, source: "Google Flights" });
    const html = renderToStaticMarkup(<OfferRowView offers={[flight]} open adults={2} onToggle={noop} onAdd={noop} onLess={noop} />);
    for (const part of ["Turkish Airlines", "07:40", "IST", "10:25", "AMS", "3 sa 45 dk", "Direkt", "€312", "€156", "kişi başı · €312 toplam"]) expect(html).toContain(part);
    expect(html).not.toContain("/ gece");
    // No code given: an airline listed by its name has its logo by its code (0.38.7, Emre: "gerçek bir Turkish Airlines
    // uçuşuysa logosuyla gelmeli"); one we don't list keeps its initial, never a code made from its name (TU, SU, İB).
    expect(html).toContain('<img class="ek-of-air ek-of-logo" src="https://images.kiwi.com/airlines/64/TK.png"');
    const coded = renderToStaticMarkup(<OfferRowView offers={[{ ...flight, carrier: "Skyline Air", carrierCode: "SK" }]} open onToggle={noop} onAdd={noop} onLess={noop} />);
    expect(coded).toContain('src="https://images.kiwi.com/airlines/64/SK.png"');
    const unknown = renderToStaticMarkup(<OfferRowView offers={[{ ...flight, carrier: "indigo", source: "goindigo.in" }]} open onToggle={noop} onAdd={noop} onLess={noop} />);
    expect(unknown).toContain('<span class="ek-of-air" aria-hidden="true">I</span>');
    expect(unknown).not.toContain("İ");
    expect(unknown).not.toContain("<img");
  });
  it("a carrier code is kept only as two letters or digits; an added flight keeps its carrier, hours and codes", () => {
    const raw = { ...offer({ id: "f2", kind: "flight", title: "TK 1951", carrier: "Turkish Airlines", depart: "07:40", arrive: "10:25", fromCode: "IST", toCode: "AMS", stops: 0 }) };
    const flightNeed: Need = { key: "flight:ist:ams:2026-12-10", section: "flight", kind: "flight", from: "IST", to: "AMS", start: "2026-12-10", adults: 2 };
    expect(validOffers([{ ...raw, carrierCode: "TK" }], flightNeed)[0].carrierCode).toBe("TK");
    expect(validOffers([{ ...raw, carrierCode: "tk" }, { ...raw, id: "f3", carrierCode: "TKX" }], flightNeed).map((o) => o.carrierCode)).toEqual([null, null]);
    const item = offerItem(validOffers([raw], flightNeed)[0], flightNeed, "t1", "n1", 1);
    expect(item.flight).toMatchObject({ from: "IST", to: "AMS", departure: "2026-12-10T07:40", arrival: "2026-12-10T10:25", carrier: "Turkish Airlines", stops: 0 });
  });
  it("the deal's unit by kind: a stay by the night, a flight's total, an activity per people, an eSIM once", () => {
    expect(dealPrice({ kind: "stay", price: 896, nights: 7 }, 2)).toMatchObject({ amount: 128, perNight: true });
    expect(dealPrice({ kind: "stay", price: 896, nights: 7 }, 2)!.unit("€896")).toBe("7 gece · €896 toplam");
    expect(dealPrice({ kind: "flight", price: 312, nights: null }, 2)!.unit("€312")).toBe("2 kişi toplam");
    expect(dealPrice({ kind: "activity", price: 32, nights: null }, 2)!.unit("€32")).toBe("2 kişi");
    expect(dealPrice({ kind: "esim", price: 15, nights: null }, 2)!.unit("€15")).toBe("tek seferlik");
    expect(dealPrice({ kind: "stay", price: null, nights: 7 }, 2)).toBeNull();
  });
  it("no offers: nothing", () => {
    expect(renderToStaticMarkup(<OfferRowView offers={[]} open onToggle={noop} onAdd={noop} onLess={noop} />)).toBe("");
  });
});

const noop = () => {};

describe("a stay's three picks in the row", () => {
  const c = (id: string, over: Partial<StayCandidate> = {}): StayCandidate => ({
    id, name: id, rating: 4.6, reviews: 1240, photo: `https://img.example.com/${id}.jpg`, geo: null, area: "Resort", labels: [],
    url: `https://www.booking.com/${id}?aid=1`, nightly: 155, total: 620, nights: 4, priceRange: null, source: "Booking", currency: "EUR", fetchedAt: 1, ...over,
  });
  const picks = () =>
    pickList(pickThree([c("Komaneka"), c("Bucu View", { nightly: 40, total: 160, rating: 4.3, reviews: 380 }), c("Mandapa", { nightly: 209, total: 836, rating: 4.9, reviews: 640 })], { centre: null }));
  it("the plan's option cards (v82 OptionCompact): photo with its label, site, ★ rating · reviews, name to its page, the price by the night, Seç; no Favorile, no İncele", () => {
    const html = renderToStaticMarkup(<StayPicksView picks={picks()} open chosen={["Mandapa"]} onToggle={noop} onPick={noop} />);
    expect(html.match(/<article class="q-card q-opt z-oc/g)).toHaveLength(3);
    expect([...html.matchAll(/data-pick="(\w+)"/g)].map((m) => m[1])).toEqual(["best", "cheaper", "comfier"]);
    for (const part of [
      '<span class="q-src best">✨ Sana en uygun</span>', '<span class="q-src">Daha ekonomik</span>', '<span class="q-src">Daha konforlu</span>',
      'class="ph" src="https://img.example.com/Komaneka.jpg"', '<b class="q-rb star">★ 4,6</b><small>1.240 yorum</small>', "Booking.com",
      '<span class="q-pr" title="4 gece €620"><b>€155</b><small>/ gece</small></span>',
      'title="Bulduklarımın en ucuzu, ★4,3"', 'title="Gecelik €54 daha fazla ama ★4,9"', ">Seç<", ">Seçili<",
      'href="https://www.booking.com/Komaneka?aid=1"',
    ]) {
      expect(html).toContain(part);
    }
    expect(html).not.toMatch(/Favori|İncele|ek-pick-/);
  });
  it("closed: the count only; nothing to show: nothing at all", () => {
    const html = renderToStaticMarkup(<StayPicksView picks={picks()} open={false} chosen={[]} onToggle={noop} onPick={noop} />);
    expect(html).toContain("Senin için 3 öneri");
    expect(html).not.toContain("z-oc");
    expect(renderToStaticMarkup(<StayPicksView picks={[]} open chosen={[]} onToggle={noop} onPick={noop} />)).toBe("");
  });
  it("a hotel with only its usual range: said as typical, no price for the dates in its tooltip; none at all: no price, the drawing", () => {
    const only = pickList(pickThree([c("Range", { nightly: null, total: null, source: null, priceRange: { min: 120, max: 180 } })], { centre: null }));
    expect(pickCard(only[0].kind, only[0].pick)).toMatchObject({ price: { amount: "tipik €120–180", unit: "/ gece", title: "tarihli fiyat yok" }, brand: { label: "Booking.com" } });
    expect(renderToStaticMarkup(<StayPicksView picks={only} open chosen={[]} onToggle={noop} onPick={noop} />)).toContain("<b>tipik €120–180</b><small>/ gece</small>");
    const bare = [{ kind: "best" as const, pick: { cand: c("Bare", { nightly: null, total: null, photo: null, rating: null, reviews: null, source: "Hostelworld", url: "https://example.org/h" }), why: "" } }];
    expect(pickCard(bare[0].kind, bare[0].pick)).toMatchObject({ price: null, rating: null, image: null, brand: { label: "Hostelworld", color: null } });
    const html = renderToStaticMarkup(<StayPicksView picks={bare} open chosen={[]} onToggle={noop} onPick={noop} />);
    expect(html).toContain('<div class="z-op art"><img src="illus/otel.png"');
    expect(html).not.toMatch(/q-pr|q-rb|title=""/);
  });
  it("Seç saves the pick as an option of the need (then chooses it): its page, rating with reviews, the price for these nights", () => {
    const [{ kind, pick }] = picks();
    const item = offerItem(candidateOffer(pick.cand, kind, pick.why), need, "t1", "n1", 9);
    expect(item).toMatchObject({ status: "saved", name: "Komaneka", provider: "Booking", url: "https://www.booking.com/Komaneka?aid=1", rating: { value: 4.6, scale: 5, count: 1240 }, price: { amount: 620, currency: "EUR", scope: "total" } });
  });
  it("Seç on a pick already on the plan chooses that record (by its page), never a second copy; one taken off is added anew", () => {
    const [{ kind, pick }] = picks();
    const saved = offerItem(candidateOffer(pick.cand, kind, pick.why), need, "t1", "n1", 9);
    expect(pickOnPlan(pick.cand, [saved])?.id).toBe("n1");
    expect(pickOnPlan(pick.cand, [{ ...saved, status: "dismissed" }])).toBeUndefined();
    expect(pickOnPlan(picks()[1].pick.cand, [saved])).toBeUndefined();
  });
  it("a source with candidates: a stay's row waits for them (nothing drawn before), never the plain list", () => {
    const fake: SuggestionSource = { available: () => true, offers: vi.fn(async () => [offer()]), candidates: vi.fn(async () => []) };
    const html = renderToStaticMarkup(
      <EmptyEnvContext.Provider value={{ tripId: "t1", travellers: 2, esimCountries: [], offers: fake }}>
        <OfferRow need={need} />
      </EmptyEnvContext.Provider>,
    );
    expect(html).toBe("");
  });
});

describe("the row and its source", () => {
  const env = (offers: SuggestionSource) => ({ tripId: "t1", travellers: 2, esimCountries: [], offers });
  it("no source connected: never drawn, never asked", () => {
    const spy = vi.spyOn(NO_SOURCE, "offers");
    const html = renderToStaticMarkup(
      <EmptyEnvContext.Provider value={env(NO_SOURCE)}>
        <OfferRow need={need} />
      </EmptyEnvContext.Provider>,
    );
    expect(html).toBe("");
    expect(spy).not.toHaveBeenCalled();
    expect(NO_SOURCE.available()).toBe(false);
  });
  it("a fake source: nothing drawn until its offers come (no placeholder, no guess)", async () => {
    const fake: SuggestionSource = { available: () => true, offers: vi.fn(async () => [offer()]) };
    const html = renderToStaticMarkup(
      <EmptyEnvContext.Provider value={env(fake)}>
        <OfferRow need={need} />
      </EmptyEnvContext.Provider>,
    );
    expect(html).toBe("");
    expect(validOffers(await fake.offers(need), need)).toHaveLength(1);
  });
});

describe("Seçeneklere ekle", () => {
  it("a saved option of the need's kind, with its page, photo, rating and price as the source read them", () => {
    const item = offerItem(offer(), need, "t1", "new1", 100);
    expect(item).toMatchObject({
      id: "new1", tripId: "t1", category: "stay", status: "saved", name: "Alaya Ubud", city: "Ubud", provider: "Booking",
      url: "https://www.booking.com/hotel/id/alaya.html", imageUrl: "https://img.example.com/a.jpg", summary: "Seçtiğin semtte, €15 daha ucuz",
      dates: { start: "2026-12-10", end: "2026-12-22" }, guests: { adults: 2 },
      rating: { value: 8.9, scale: 10, source: "url" }, price: { amount: 943, currency: "EUR", scope: "total", source: "url", observedAt: 5 },
    });
    expect("origin" in item).toBe(false);
    const bare = offerItem(offer({ price: null, rating: null, photo: null }), need, "t1", "new2", 100);
    expect(bare.price).toMatchObject({ amount: null, currency: null, source: "none" });
    expect(bare.rating).toMatchObject({ value: null, source: "none" });
  });
});

describe("a stay's nearby places and review topics (Google Hotels, spec 2026-10-19 SerpApi)", () => {
  const nearby = [
    { name: "Church of Saint Francis", mode: "walk", minutes: 3, airport: false },
    { name: "Francisco de Sá Carneiro Havaalanı", mode: "transit", minutes: 43, airport: true },
  ];
  const topics = [{ topic: "Konum", up: true }, { topic: "Hizmet", up: true }, { topic: "Banyo", up: false }];
  it("keeps two well-formed places and three topics, nothing made up", () => {
    expect(nearbyList([...nearby, { name: "Üçüncü", mode: "walk", minutes: 9, airport: false }])).toEqual(nearby);
    expect(nearbyList([{ name: "Uçak", mode: "plane", minutes: 3 }, { name: "", mode: "walk", minutes: 3 }, { name: "X", mode: "walk", minutes: -1 }])).toEqual([]);
    expect(nearbyList("nope")).toEqual([]);
    expect(topicList([...topics, { topic: "Uyku", up: true }])).toEqual(topics);
    expect(topicList([{ topic: "Oda" }, { up: true }])).toEqual([]);
  });
  it("comes in with a stay's offer and onto the saved option", () => {
    const [o] = validOffers([{ ...offer(), nearby, topics }], need);
    expect(o).toMatchObject({ nearby, topics });
    const item = offerItem(o, need, "t1", "n1", 1);
    expect(item).toMatchObject({ nearby, reviewTopics: topics });
    expect(offerItem(offer(), need, "t1", "n2", 1)).not.toHaveProperty("nearby");
  });
  it("says them on the card's lines: on foot, then the airport", () => {
    expect(nearTexts({ nearby: nearby as never })).toEqual(["🚶 Church of Saint Francis · 3 dk yürüme", "✈ Havalimanı · 43 dk toplu taşıma"]);
    expect(nearTexts({ nearby: [{ name: "Ubud Art Market", mode: "taxi", minutes: 8, airport: false }, { name: "Ngurah Rai", mode: "taxi", minutes: 82, airport: true }] })).toEqual(["🚕 Ubud Art Market · 8 dk taksi", "✈ Havalimanı · 1 sa 22 dk taksi"]);
    expect(nearTexts({})).toEqual([]);
  });
});
