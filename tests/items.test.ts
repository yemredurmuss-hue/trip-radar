import { describe, expect, it } from "vitest";
import { amountInQuote, classify, parseLocaleNumber, quoteFound } from "../src/lib/evidence";
import type { Extraction } from "../src/lib/extract";
import { buildItem, findDuplicate, groupItems, mergeItem, routeUrl, rowLabel } from "../src/lib/items";
import type { Capture } from "../src/lib/types";
import { parseUrl } from "../src/lib/url";

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    id: crypto.randomUUID(),
    kind: "extension",
    url: "https://www.booking.com/hotel/pt/jardim-stay.html?checkin=2026-10-08&checkout=2026-10-11&group_adults=2",
    title: "Jardim Stay",
    pageText: "Jardim Stay\nTotal price € 285\nFree cancellation before 5 October 2026\nScored 8.9 · 1.204 reviews",
    viewportText: "",
    selection: "",
    jsonLd: [],
    meta: {},
    screenshot: null,
    capturedAt: 0,
    status: "pending",
    error: null,
    itemId: null,
    ...overrides,
  };
}

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    category: "stay",
    name: "Jardim Stay",
    provider: "Booking.com",
    summary: "Ribeira'ya 10 dk",
    option_detail: "Deluxe Double",
    city: "Porto",
    country: "Portekiz",
    country_code: "PT",
    location: { address: "Rua X 1, Porto", area: "Baixa", approximate: false },
    dates: { start: "2026-10-08", end: "2026-10-11", source: "page" },
    guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: 285, currency: "EUR", scope: "total", taxes_included: "yes", source: "page", evidence: "Total price € 285" },
    cancellation: { summary: "5 Eki'ye kadar ücretsiz iptal", free_until: "2026-10-05", source: "page", evidence: "Free cancellation before 5 October 2026" },
    rating: { value: 8.9, scale: 10, count: 1204, source: "page", evidence: "Scored 8.9" },
    flight: null,
    metrics: null,
    highlights: ["Merkezi"],
    concerns: [],
    review_summary: null,
    image_url: null,
    missing: [],
    trip: { existing_trip_id: null, new_trip_title: "Portekiz" },
    need_key: "stay:porto",
    ...overrides,
  };
}

describe("evidence", () => {
  it("finds quotes regardless of case and whitespace", () => {
    expect(quoteFound("total  PRICE € 285", "Total price € 285")).toBe(true);
    expect(quoteFound("€ 300", "Total price € 285")).toBe(false);
  });

  it("checks the amount against the quote digits", () => {
    expect(amountInQuote(1234, "€ 1.234")).toBe(true);
    expect(amountInQuote(155.25, "155,25 €")).toBe(true);
    expect(amountInQuote(240, "€ 285")).toBe(false);
  });

  it("reads page numbers the way they are written", () => {
    expect(parseLocaleNumber("21.228")).toBe(21228);
    expect(parseLocaleNumber("21,228")).toBe(21228);
    expect(parseLocaleNumber("1.234,56")).toBe(1234.56);
    expect(parseLocaleNumber("1,234.56")).toBe(1234.56);
    expect(parseLocaleNumber("8,9")).toBe(8.9);
    expect(parseLocaleNumber("155.25")).toBe(155.25);
    expect(parseLocaleNumber("21 228")).toBe(21228);
  });

  it("accepts a reformatted quote when the value itself is on the page", () => {
    // Booking shows "TL 21.228"; the model quoted it as "₺21.228".
    expect(classify("page", "₺21.228", "Toplam fiyat\nTL 21.228\nVergiler dahil", 21228)).toBe("page");
    // A bare number elsewhere on the page (e.g. review count) is not a price.
    expect(classify("page", "₺1.204", "Scored 8.9 · 1.204 reviews", 1204)).toBe("unverified");
    // Ratings need no currency.
    expect(classify("page", "Puan 8,9", "Fabulous 8,9 Konum", 8.9, "rating")).toBe("page");
    // Seen only in the screenshot, but also on the page → verified.
    expect(classify("screenshot", null, "€ 285 total", 285)).toBe("page");
    // Cancellation reworded but all its words are on the page.
    expect(classify("page", "free cancellation before October 5", "Free cancellation · before 5 October 2026", null)).toBe("page");
  });

  it("marks invented quotes as unverified", () => {
    expect(classify("page", "Price € 199", "Total price € 285", 199)).toBe("unverified");
    expect(classify("page", "Total price € 285", "Total price € 285", 199)).toBe("unverified");
    expect(classify("page", "Total price € 285", "Total price € 285", 285)).toBe("page");
    expect(classify("screenshot", null, "", 285)).toBe("screenshot");
  });
});

describe("buildItem", () => {
  it("prefers URL dates and verifies quoted facts", () => {
    const c = capture();
    const item = buildItem(extraction({ dates: { start: "2026-10-09", end: null, source: "page" } }), c, parseUrl(c.url!), "t1", 1000);
    expect(item.key).toBe("booking:pt/jardim-stay");
    expect(item.dates).toEqual({ start: "2026-10-08", end: "2026-10-11", source: "url" });
    expect(item.price.source).toBe("page");
    expect(item.cancellation.source).toBe("page");
    expect(item.rating.source).toBe("page");
    expect(item.priceHistory).toEqual([{ amount: 285, currency: "EUR", observedAt: 1000 }]);
  });

  it("flags a price the page does not contain", () => {
    const c = capture();
    const x = extraction({ price: { ...extraction().price, amount: 199, evidence: "€ 199" } });
    expect(buildItem(x, c, parseUrl(c.url!), "t1").price.source).toBe("unverified");
  });

  it("keys flights by flight number, not by the search URL", () => {
    const c = capture({ url: "https://www.google.com/travel/flights?tfs=abc" });
    const x = extraction({
      category: "flight",
      flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: null, carrier: "TK", flight_number: "TK 1451", stops: 0 },
    });
    expect(buildItem(x, c, parseUrl(c.url!), "t1").key).toBe("flight:TK1451:2026-10-08");
    expect(buildItem(extraction({ category: "flight" }), c, parseUrl(c.url!), "t1").key).toBeNull();
  });
});

describe("whether it needs booking, as the page says", () => {
  it("yes → needed, no → none, unknown → left to its kind", () => {
    const c = capture();
    expect(buildItem(extraction({ category: "activity", needs_booking: "yes" }), c, parseUrl(c.url!), "t1").booking).toBe("needed");
    expect(buildItem(extraction({ category: "activity", needs_booking: "no" }), c, parseUrl(c.url!), "t1").booking).toBe("none");
    expect(buildItem(extraction({ category: "activity", needs_booking: "unknown" }), c, parseUrl(c.url!), "t1").booking).toBeUndefined();
    expect(buildItem(extraction({ category: "activity" }), c, parseUrl(c.url!), "t1").booking).toBeUndefined();
  });
  it("a re-read keeps what was set before (the traveller may have moved it)", () => {
    const c = capture();
    const first = { ...buildItem(extraction({ category: "activity", needs_booking: "no" }), c, parseUrl(c.url!), "t1", 1000), booking: "needed" as const };
    const again = buildItem(extraction({ category: "activity", needs_booking: "no" }), c, parseUrl(c.url!), "t1", 2000);
    expect(mergeItem(first, again).booking).toBe("needed");
    const unsaid = { ...first, booking: undefined };
    expect(mergeItem(unsaid, again).booking).toBe("none");
    // An older record already chosen (on the Plan) isn't sent to Fikirler by a re-read.
    expect(mergeItem({ ...unsaid, status: "chosen" }, again).booking).toBeUndefined();
    expect(mergeItem({ ...unsaid, status: "chosen" }, { ...again, booking: "needed" }).booking).toBe("needed");
  });
});

describe("dedupe and merge", () => {
  it("merges a re-capture of the same listing and keeps the user's decision", () => {
    const c1 = capture();
    const first = { ...buildItem(extraction(), c1, parseUrl(c1.url!), "t1", 1000), status: "chosen" as const };
    const c2 = capture({ pageText: "Total price € 270" });
    const second = buildItem(
      extraction({ price: { ...extraction().price, amount: 270, evidence: "Total price € 270" }, rating: { ...extraction().rating, value: null } }),
      c2,
      parseUrl(c2.url!),
      "t2",
      2000,
    );
    expect(findDuplicate([first], second)?.item.id).toBe(first.id);
    const merged = mergeItem(first, second);
    expect(merged.status).toBe("chosen");
    expect(merged.tripId).toBe("t1");
    expect(merged.price.amount).toBe(270);
    expect(merged.priceHistory.map((p) => p.amount)).toEqual([285, 270]);
    expect(merged.rating.value).toBe(8.9); // new capture had no rating, old one is kept
    expect(merged.captureIds).toHaveLength(2);
  });

  it("matches screenshot-only items by name inside the same trip", () => {
    const c = capture({ url: null });
    const a = buildItem(extraction(), c, parseUrl(""), "t1");
    const b = buildItem(extraction({ name: "jardim  stay" }), c, parseUrl(""), "t1");
    expect(findDuplicate([a], b)?.item.id).toBe(a.id);
    expect(findDuplicate([a], { ...b, tripId: "t2" })).toBeUndefined();
  });

  it("keeps the same place for other dates or another room as a separate offer", () => {
    const c1 = capture();
    const first = buildItem(extraction(), c1, parseUrl(c1.url!), "t1", 1000);
    const c2 = capture({ url: "https://www.booking.com/hotel/pt/jardim-stay.html?checkin=2026-10-11&checkout=2026-10-14&group_adults=2" });
    const later = buildItem(extraction(), c2, parseUrl(c2.url!), "t1", 2000);
    expect(later.key).toBe(first.key);
    expect(findDuplicate([first], later)).toBeUndefined();

    const suite = buildItem(extraction({ option_detail: "Junior Suite" }), c1, parseUrl(c1.url!), "t1", 3000);
    expect(findDuplicate([first], suite)).toBeUndefined();
    // Same nights, same room: a re-save refreshes the offer.
    expect(findDuplicate([first, later], buildItem(extraction(), c1, parseUrl(c1.url!), "t1", 4000))?.item.id).toBe(first.id);
  });

  it("lets a dateless save refresh the place without touching the offer's nights and price", () => {
    const c1 = capture();
    const offer = { ...buildItem(extraction(), c1, parseUrl(c1.url!), "t1", 1000), status: "chosen" as const };
    const c2 = capture({ url: "https://www.booking.com/hotel/pt/jardim-stay.html", pageText: "Jardim Stay from € 80 per night" });
    const browse = buildItem(
      extraction({
        dates: { start: null, end: null, source: "none" },
        price: { ...extraction().price, amount: 80, scope: "per_night", evidence: "€ 80 per night" },
        rating: { ...extraction().rating, value: 9.0, evidence: null, source: "none" },
        option_detail: null,
      }),
      c2,
      parseUrl(c2.url!),
      "t1",
      2000,
    );
    const match = findDuplicate([offer], browse);
    expect(match).toEqual({ item: offer, placeOnly: true });
    const merged = mergeItem(match!.item, browse, true);
    expect(merged.price.amount).toBe(285);
    expect(merged.dates.start).toBe("2026-10-08");
    expect(merged.status).toBe("chosen");
    expect(merged.captureIds).toHaveLength(2);
  });
});

describe("labels and groups", () => {
  const now = 10 * 24 * 3600e3;
  const make = (name: string, amount: number | null, overrides: Partial<Extraction> = {}) => {
    const c = capture({ pageText: `${name} € ${amount}`, url: null });
    return buildItem(
      extraction({ name, price: { ...extraction().price, amount, evidence: amount == null ? null : `€ ${amount}` }, ...overrides }),
      c,
      parseUrl(""),
      "t1",
      now,
    );
  };

  it("labels the cheapest comparable option and warns about gaps", () => {
    const a = make("Jardim Stay", 285);
    const b = make("Casa Azul", 240);
    const c = make("Ribeira Rooms", null);
    const d = make("Late Hostel", 200, { dates: { start: "2026-10-09", end: "2026-10-12", source: "page" } });
    const group = [a, b, c, d];
    expect(rowLabel(b, group, now).text).toBe("En ekonomik");
    expect(rowLabel(c, group, now).text).toBe("Fiyat yok");
    expect(rowLabel(d, group, now).text).toBe("Farklı tarih");
    expect(rowLabel({ ...a, status: "chosen" }, group, now).text).toBe("Seçildi");
    expect(rowLabel(b, group, now + 4 * 24 * 3600e3).text).toBe("Fiyat 4 gün önce");
  });

  it("groups stays by need and titles them with city and nights", () => {
    const sections = groupItems([make("A", 1), make("B", 2), { ...make("C", 3), status: "dismissed" }]);
    expect(sections).toHaveLength(1);
    expect(sections[0].groups[0].title).toBe("Porto · 3 gece");
    expect(sections[0].groups[0].items.map((i) => i.name)).toEqual(["A", "B"]);
  });

  it("builds a Google Maps route through chosen places", () => {
    const a = { ...make("A", 1), status: "chosen" as const };
    const b = { ...make("B", 2, { category: "activity", location: { address: null, area: null, approximate: false } }), status: "chosen" as const };
    const url = routeUrl([a, b, make("C", 3)])!;
    expect(url).toContain("google.com/maps/dir/");
    const params = new URL(url).searchParams;
    expect(params.get("origin")).toBe("Rua X 1, Porto");
    expect(params.get("destination")).toBe("B, Porto");
    expect(params.has("waypoints")).toBe(false); // the unchosen C is left out
  });
});
