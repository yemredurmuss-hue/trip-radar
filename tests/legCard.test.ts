// tests/legCard.test.ts
import { describe, expect, it } from "vitest";
import { legCardView, legEnd, legMenuFor, stayPlatform } from "../src/lib/cardView";
import { EMPTY_METRICS } from "../src/lib/items";
import { makeItem } from "./fixtures/makeItem";
import type { Leg } from "../src/lib/legs";
import { plannedItem } from "../src/lib/planned";

const leg = (over: Partial<Leg> = {}): Leg => ({
  key: "2026-10-11:move:porto-lizbon", kind: "move", date: "2026-10-11", slot: 1,
  from: { label: "Porto", city: "Porto", item: null }, to: { label: "Lizbon", city: "Lizbon", item: null },
  after: null, before: null, options: [], mode: null, via: null, travel: null, status: "empty", statusText: "", choice: null, notes: [],
  ...over,
});
const choice = (mode: Leg["mode"], booked = false) => ({ mode, booked, note: null, updatedAt: 1 });
const state = (v: ReturnType<typeof legCardView>) => (v.foot.left.kind === "state" ? [v.foot.left.tone, v.foot.left.text, v.foot.left.sub] : ["nav"]);

describe("a transfer or a change of city as a card", () => {
  it("nothing planned: open ring, how will you go", () => {
    const v = legCardView(leg());
    expect([v.kind, v.label, v.ring, v.ariaLabel, v.searchUrl]).toEqual(["transport", "Şehir değişimi", "open", "Porto → Lizbon", null]);
    expect(state(v)).toEqual(["plain", "Planlanmadı", "nasıl geçeceksiniz?"]);
    expect([v.from, v.to]).toEqual([{ city: "Porto", sub: "11 Ekim", time: null }, { city: "Lizbon", sub: "11 Ekim", time: null }]);
  });
  it("by plane between cities: amber until the ticket, with a flight search", () => {
    const v = legCardView(leg({ choice: choice("flight"), status: "planned" }));
    expect([v.kind, v.label, v.ring]).toEqual(["flight", "Uçuş", "half"]);
    expect(state(v)).toEqual(["wait", "Planlanıyor", "bilet alınmadı"]);
    expect(v.foot.action).toEqual({ label: "Bileti aldım", does: "book" });
    expect(decodeURIComponent(v.searchUrl!)).toBe("https://www.google.com/travel/flights?q=Flights from Porto to Lizbon on 2026-10-11");
    const done = legCardView(leg({ choice: choice("flight", true), status: "booked" }));
    expect([done.ring, done.searchUrl]).toEqual(["done", null]);
    expect(state(done)).toEqual(["done", "Alındı", null]);
  });
  it("by metro from the airport: planned is done, no booking", () => {
    const v = legCardView(leg({ kind: "arrival", from: { label: "OPO havalimanı", city: "Porto", item: null }, to: { label: "Jardim Stay", city: "Porto", item: null }, choice: choice("metro"), status: "planned", after: "10:05" }));
    expect([v.kind, v.label, v.ring, v.middle]).toEqual(["transport", "Metro", "done", "Varış 10:05"]);
    expect(state(v)).toEqual(["done", "Planlandı", "rezervasyon gerekmez"]);
    // No way said for the hub (via null): its label as it is; nights with no place yet: "Konaklama", the city under it.
    expect([v.from, v.to]).toEqual([{ city: "OPO havalimanı", sub: null, time: null }, { city: "Konaklama", sub: "Porto", time: null }]);
  });
  it("a taxi said in the chat: its name on the strip", () => {
    const taxi = plannedItem({ kind: "taxi", date: "2026-10-14", end_date: null, time: null, from: "Otel", to: "Havalimanı", city: "Lizbon", title: null, booked: false, note: null }, "t1", "x1", 1);
    const v = legCardView(leg({ kind: "departure", options: [taxi], mode: "taxi", status: "planned" }));
    expect([v.kind, v.label, v.ring]).toEqual(["taxi", "Taksi · transfer", "done"]);
    expect(state(v)).toEqual(["done", "Planlandı", "Taksi · Otel → Havalimanı"]);
  });
  it("saved options, nothing chosen: pick one in the details", () => {
    expect(state(legCardView(leg({ kind: "arrival", status: "options", options: [plannedItem({ kind: "transfer", date: "2026-10-08", end_date: null, time: null, from: null, to: "Otel", city: "Porto", title: null, booked: false, note: null }, "t1", "x2", 1)].map((i) => ({ ...i, status: "saved" as const })) })))).toEqual(["wait", "1 seçenek", "birini seç"]);
  });
});

describe("a transfer card's menu", () => {
  it("Gerek yok (not for a change of city), Planı temizle once said, Sil for its own record", () => {
    expect(legMenuFor(leg())).toEqual([]);
    expect(legMenuFor(leg({ choice: choice("flight") }))).toEqual(["clear"]);
    const taxi = plannedItem({ kind: "taxi", date: "2026-10-08", end_date: null, time: null, from: "Havalimanı", to: "Otel", city: "Porto", title: null, booked: false, note: null }, "t1", "x9", 1);
    expect(legMenuFor(leg({ kind: "arrival", options: [taxi], choice: choice("taxi") }))).toEqual(["hide", "clear", "delete"]);
    expect(legMenuFor(leg({ kind: "arrival" }))).toEqual(["hide"]);
  });
});

describe("a transfer's ends, short (spec 0.33 §4)", () => {
  const stay = (over: Parameters<typeof makeItem>[0]) => makeItem({ category: "stay", city: "Porto", ...over });
  const jardim = stay({ name: "Jardim Stay · bahçeli çift kişilik oda", provider: "Booking.com", url: "https://www.booking.com/hotel/pt/jardim-stay.html" });
  const loft = stay({ name: "Ribeira loft, nehir manzaralı", provider: null, url: "https://www.airbnb.com/rooms/48213377" });
  const own = stay({ name: "Casa do Largo", provider: "casadolargo.pt", metrics: { ...EMPTY_METRICS, stayKind: "apartment" } });
  const flightIn = makeItem({ category: "flight", flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: null, flightNumber: null, stops: 0 } });
  const train = makeItem({ category: "transport", flight: { from: "Porto Campanhã", to: "Lisboa Santa Apolónia", departure: "2026-10-11T09:30", arrival: null, carrier: null, flightNumber: null, stops: null } });
  it("a stay: where it was booked, else what it is; its full name under it", () => {
    expect([stayPlatform(jardim), stayPlatform(loft), stayPlatform(own)]).toEqual(["Booking.com", "Airbnb", null]);
    const change = leg({ kind: "change", from: { label: loft.name, city: "Porto", item: loft }, to: { label: own.name, city: "Porto", item: own } });
    expect([legEnd(change, "from"), legEnd(change, "to")]).toEqual([
      { city: "Airbnb", sub: "Ribeira loft, nehir manzaralı", time: null },
      { city: "Daire", sub: "Casa do Largo", time: null },
    ]);
  });
  it("an airport: '<city> Havalimanı', the code under it; at a glance 'Porto Havalimanı → Booking.com'", () => {
    const arrival = leg({ kind: "arrival", via: "flight", travel: { items: [flightIn], settled: flightIn } as never, from: { label: "OPO havalimanı", city: "Porto", item: null }, to: { label: jardim.name, city: "Porto", item: jardim } });
    const v = legCardView(arrival);
    expect([v.from, v.to]).toEqual([
      { city: "Porto Havalimanı", sub: "OPO", time: null },
      { city: "Booking.com", sub: "Jardim Stay · bahçeli çift kişilik oda", time: null },
    ]);
    expect(v.ariaLabel).toBe("OPO havalimanı → Jardim Stay · bahçeli çift kişilik oda");
  });
  it("a station: '<city> Garı', the station's name under it", () => {
    const departure = leg({ kind: "departure", via: "train", travel: { items: [train], settled: train } as never, from: { label: jardim.name, city: "Porto", item: jardim }, to: { label: "Porto Campanhã", city: "Porto", item: null } });
    expect(legEnd(departure, "to")).toEqual({ city: "Porto Garı", sub: "Porto Campanhã", time: null });
  });
  it("in English too", async () => {
    const { setLang } = await import("../src/lib/i18n");
    setLang("en");
    try {
      const departure = leg({ kind: "departure", via: "flight", travel: { items: [flightIn], settled: flightIn } as never, from: { label: own.name, city: "Porto", item: own }, to: { label: "IST airport", city: "İstanbul", item: null } });
      expect([legEnd(departure, "from").city, legEnd(departure, "to")]).toEqual(["Apartment", { city: "Istanbul Airport", sub: "IST", time: null }]);
    } finally {
      setLang("tr");
    }
  });
});
