// The AI offers' row under an empty card (spec 2026-10-06-bos-kartlar-design.md, revision 2), with a fake source:
// closed at first, remembered per section, a new count never opens it, only real offers, never drawn while no
// source is connected.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmptyEnvContext } from "../src/app/cards/emptyEnv";
import { OfferRow, OfferRowView } from "../src/app/cards/OfferRow";
import {
  MAX_OFFERS,
  NO_SOURCE,
  offerItem,
  offersOpenKey,
  readOffersOpen,
  shownOffers,
  toggled,
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
  const noop = () => {};
  it("closed: the count line only, never the cards", () => {
    const html = renderToStaticMarkup(<OfferRowView offers={[offer(), offer({ id: "o2" })]} open={false} onToggle={noop} onAdd={noop} onLess={noop} />);
    expect(html).toContain("Senin için 2 öneri");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("ek-offer-list");
  });
  it("open: the option card's layout on purple: photo, name, Öneri, rating, nights, price, why, Seçeneklere ekle, ×", () => {
    const html = renderToStaticMarkup(<OfferRowView offers={[offer()]} open onToggle={noop} onAdd={noop} onLess={noop} />);
    for (const part of ["Senin için 1 öneri", 'aria-expanded="true"', 'src="https://img.example.com/a.jpg"', "Alaya Ubud", "Öneri", "★ 8,9", "12 gece", "Booking", "€943", "Seçtiğin semtte, €15 daha ucuz", "Seçeneklere ekle", "Alaya Ubud: bunun gibileri gösterme"]) {
      expect(html).toContain(part);
    }
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("no offers: nothing", () => {
    expect(renderToStaticMarkup(<OfferRowView offers={[]} open onToggle={noop} onAdd={noop} onLess={noop} />)).toBe("");
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
