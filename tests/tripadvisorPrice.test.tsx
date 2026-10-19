// tests/tripadvisorPrice.test.tsx
// 0.39.0 (Emre: "Tripadvisor'dan gelen oteller fiyatları yazmıyor"): a hotel from the source's Tripadvisor list (Xotelo)
// says the price the offers function gave: one for these nights ("€95 / gece"), else Tripadvisor's usual range ("tipik
// €21–64 / gece", kept on the record once it's saved or chosen), else nothing made up, a small link to the site's page.
// The answers are fakes shaped by the function's own code (shape.ts); nothing is asked of a real service.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { stayCandidate, type OfferOut, type XoHotel } from "../supabase/functions/offers/shape";
import { ChatOffersView } from "../src/app/ChatOffers";
import { offerItem, type Need } from "../src/lib/offerSource";
import type { StayCandidate } from "../src/lib/offerSources";
import { candidateOffer, pickCard, pricePage, typicalNight } from "../src/lib/stayPicks";

const need: Need = { key: "stay:2026-11-24_2026-12-03:ahangama", section: "stay", kind: "stay", city: "Ahangama", start: "2026-11-24", end: "2026-12-03", adults: 2 };
const ctx = { lang: "tr" as const, nights: 9, now: 1, url: "https://www.booking.com/searchresults.html?ss=x" };
const hotel = (over: Partial<XoHotel> = {}): XoHotel => ({
  name: "Ahangama Surf Villa", key: "g1-d2", accommodation_type: "Hotel", url: "https://www.tripadvisor.com/Hotel_Review-g1-d2", review_summary: { rating: 4.6, count: 210 },
  image: "https://img.example.com/v.jpg", ...over,
});
// What the client reads back: the JSON the function replies with.
const wire = (c: StayCandidate | ReturnType<typeof stayCandidate>): StayCandidate => JSON.parse(JSON.stringify(c)) as StayCandidate;
const priced: OfferOut = { id: "xo:g1-d2", kind: "stay", title: "Ahangama Surf Villa", price: 855, currency: "EUR", nights: 9, url: "https://www.agoda.com/x", why: "", source: "Agoda.com", fetchedAt: 1 };

describe("a Tripadvisor hotel says the price the answer has", () => {
  it("a usual range only: 'tipik €21–64 / gece', on its card, in the chat and on the record it becomes", () => {
    const c = wire(stayCandidate(hotel({ price_ranges: { minimum: 21, maximum: 64 } }), null, ctx));
    expect(c.source).toBeNull();
    const card = pickCard("cheaper", { cand: c, why: "" });
    expect(card.price).toEqual({ amount: "tipik €21–64", unit: "/ gece", title: "tarihli fiyat yok" });
    expect(card.pricePage).toBeNull();
    const offer = candidateOffer(c, "cheaper", "");
    expect(offer.price).toBeNull();
    expect(offer.meta).toBe("tipik €21–64 / gece · tarihli fiyat yok");
    // Saved (chat "Ekle", the row's "Seç"): the range stays, never as its price.
    const item = offerItem(offer, need, "t", "i1", 1);
    expect(item.price.amount).toBeNull();
    expect(item.typicalNight).toEqual({ min: 21, max: 64 });
    expect(typicalNight(item.typicalNight)).toEqual({ amount: "tipik €21–64", unit: "/ gece", title: "tarihli fiyat yok" });
    const html = renderToStaticMarkup(<ChatOffersView offers={[offer]} need={need} added={[]} onAdd={() => {}} />);
    expect(html).toContain("tipik €21–64 / gece");
    expect(html).not.toContain("Fiyat Tripadvisor");
  });

  it("a price for these nights: '€95 / gece', and nothing typical kept", () => {
    const c = wire(stayCandidate(hotel({ price_ranges: { minimum: 21, maximum: 64 } }), priced, ctx));
    expect(c.nightly).toBe(95);
    const card = pickCard("best", { cand: c, why: "" });
    expect(card.price).toEqual({ amount: "€95", unit: "/ gece", title: "9 gece €855" });
    expect(card.pricePage).toBeNull();
    const item = offerItem(candidateOffer(c, "best", ""), need, "t", "i2", 1);
    expect(item.price.amount).toBe(855);
    expect(item.typicalNight).toBeUndefined();
  });

  it("no price at all: no amount made up, a small link to the site's page ('Fiyat Tripadvisor'da')", () => {
    const c = wire(stayCandidate(hotel(), null, { ...ctx, url: "https://www.tripadvisor.com/Hotel_Review-g1-d2" }));
    expect(c.priceRange).toBeNull();
    const card = pickCard("comfier", { cand: c, why: "" });
    expect(card.price).toBeNull();
    expect(card.pricePage).toEqual({ url: "https://www.tripadvisor.com/Hotel_Review-g1-d2", text: "Fiyat Tripadvisor'da" });
    const offer = candidateOffer(c, "comfier", "");
    const item = offerItem(offer, need, "t", "i3", 1);
    expect(item.typicalNight).toBeUndefined();
    const html = renderToStaticMarkup(<ChatOffersView offers={[offer]} need={need} added={[]} onAdd={() => {}} />);
    expect(html).toContain('href="https://www.tripadvisor.com/Hotel_Review-g1-d2"');
    expect(html).toContain("Fiyat Tripadvisor&#x27;da ↗");
    expect(html).not.toMatch(/€\d/);
  });

  it("the link names the site by its page or its source, and only an https page", () => {
    expect(pricePage("https://www.booking.com/searchresults.html?ss=x", null)?.text).toBe("Fiyat Booking.com'da");
    // A partner's link (its own redirect host): the source's name.
    expect(pricePage("https://tp.example/r?u=x", "Tripadvisor")?.text).toBe("Fiyat Tripadvisor'da");
    expect(pricePage("https://tp.example/r?u=x", null)?.text).toBe("Fiyat sayfasında");
    expect(pricePage("http://example.com/x", "Tripadvisor")).toBeNull();
    expect(pricePage(null, "Tripadvisor")).toBeNull();
  });
});
