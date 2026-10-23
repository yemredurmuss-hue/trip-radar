import "fake-indexeddb/auto";
// Fiyat izleme (lib/priceWatch.ts, 0.40.6): the same flight or hotel only; a drop worth saying; the old price kept.
import { describe, expect, it } from "vitest";
import { plannedItem } from "../src/lib/planned";
import type { Offer } from "../src/lib/offerSource";
import { priceDrop, sameOffer, watchable, watchNeed, withPrice } from "../src/lib/priceWatch";
import type { Item } from "../src/lib/types";

const price = (amount: number, at = 1) => ({ amount, currency: "EUR", scope: "total" as const, taxesIncluded: "unknown" as const, source: "url" as const, observedAt: at });
const flight = (): Item => ({
  ...plannedItem({ kind: "flight", date: "2026-12-10", end_date: null, time: "07:10", from: "IST", to: "OPO", city: null, title: "Pegasus PC 1201", booked: false, note: null }, "t", "f1", 1),
  status: "chosen",
  flight: { from: "IST", to: "OPO", departure: "2026-12-10T07:10", arrival: "2026-12-10T10:05", carrier: "Pegasus", flightNumber: "PC 1201", stops: 0 },
  price: price(340),
});
const stay = (): Item => ({ ...plannedItem({ kind: "stay", date: "2026-12-10", end_date: "2026-12-13", time: null, from: null, to: null, city: "Porto", title: "Jardim Stay", booked: false, note: null }, "t", "s1", 1), status: "chosen", url: "https://www.booking.com/hotel/pt/jardim.html?aid=1", price: price(270) });
const offer = (o: Partial<Offer>): Offer => ({ id: "o", kind: "flight", title: "x", price: 300, currency: "EUR", url: "https://x.example", why: "", source: "Kiwi", fetchedAt: 2, ...o }) as Offer;

describe("watchable and its need", () => {
  it("on the plan, not bought, priced, ahead", () => {
    expect(watchable(flight(), "2026-11-01")).toBe(true);
    expect(watchable({ ...flight(), status: "booked" }, "2026-11-01")).toBe(false);
    expect(watchable(flight(), "2026-12-11")).toBe(false);
    expect(watchable(stay(), "2026-11-01")).toBe(true);
    expect(watchNeed(flight(), 2)).toMatchObject({ kind: "flight", fromCode: "IST", toCode: "OPO", start: "2026-12-10", adults: 2 });
    expect(watchNeed(stay(), 2)).toMatchObject({ kind: "stay", city: "Porto", start: "2026-12-10", end: "2026-12-13" });
  });
});

describe("sameOffer: never another flight or hotel", () => {
  it("a flight by its hour and its airline", () => {
    expect(sameOffer(flight(), offer({ depart: "07:10", carrierCode: "PC" }))).toBe(true);
    expect(sameOffer(flight(), offer({ depart: "07:10", carrierCode: "TP" }))).toBe(false);
    expect(sameOffer(flight(), offer({ depart: "09:40", carrierCode: "PC" }))).toBe(false);
  });
  it("a hotel by its page or its name", () => {
    expect(sameOffer(stay(), offer({ kind: "stay", title: "Other", url: "https://booking.com/hotel/pt/jardim.html" }))).toBe(true);
    expect(sameOffer(stay(), offer({ kind: "stay", title: "Jardim Stay", url: "https://www.agoda.com/x" }))).toBe(true);
    expect(sameOffer(stay(), offer({ kind: "stay", title: "Casa Azul", url: "https://www.agoda.com/y" }))).toBe(false);
  });
});

describe("priceDrop and withPrice", () => {
  it("a drop of €5 and 3% at least, the same currency and kind of price", () => {
    expect(priceDrop(price(340), price(300))).toEqual({ was: 340, now: 300, save: 40, currency: "EUR" });
    expect(priceDrop(price(340), price(337))).toBeNull();
    expect(priceDrop(price(340), { ...price(300), currency: "USD" })).toBeNull();
    expect(priceDrop(price(340), { ...price(300), scope: "per_person" })).toBeNull();
  });
  it("the old price kept in the history (the drawer's 'Dün €340 idi')", () => {
    const next = withPrice(flight(), price(300, 5));
    expect(next.price.amount).toBe(300);
    expect(next.priceHistory.map((h) => h.amount)).toEqual([340, 300]);
  });
});

describe("checkPrices: the daily look, the same flight found cheaper", () => {
  it("written on the record with its old price kept; another flight or a dearer one says nothing", async () => {
    const { db } = await import("../src/lib/db");
    const { checkPrices } = await import("../src/lib/priceWatchWorker");
    const d = await db();
    await d.put("trips", { id: "t", title: "Portekiz", confirmedDates: { start: "2026-12-10", end: "2026-12-20" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 } as never);
    await d.put("items", flight());
    const source = {
      available: () => true,
      offers: async () => [],
      candidates: async () => [],
      find: async () => [offer({ id: "a", depart: "09:40", carrierCode: "TP", price: 200 }), offer({ id: "b", depart: "07:10", carrierCode: "PC", price: 300 })],
    };
    const drops = await checkPrices(source as never, Date.parse("2026-11-01T09:00:00Z"));
    expect(drops).toBe(1);
    const after = (await d.get("items", "f1"))!;
    expect(after.price.amount).toBe(300);
    expect(after.priceHistory.map((h) => h.amount)).toEqual([340, 300]);
    expect(await checkPrices({ ...source, find: async () => [offer({ id: "b", depart: "07:10", carrierCode: "PC", price: 320 })] } as never, Date.parse("2026-11-02T09:00:00Z"))).toBe(0);
  });
});
