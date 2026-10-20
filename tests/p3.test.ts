// P3: money and bookings (the UX test's F28, F30, F36).
import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { prepTasks, type PrepInput } from "../src/lib/prepDays";
import { soloTicket } from "../src/lib/decision";
import { ticketPrices } from "../src/lib/cardTicket";
import { fieldPlaceholder } from "../src/lib/inlineEdit";
import type { Item } from "../src/lib/types";

beforeEach(() => setLang("tr"));
const item = (over: Partial<Item>): Item =>
  ({
    id: "x", tripId: "t", name: "Vincci Bonjardim", category: "stay", status: "booked", url: "https://www.booking.com/hotel/pt/vincci.html",
    guests: { adults: null, children: null, rooms: null }, price: { amount: null, currency: "EUR", scope: "unknown", taxesIncluded: "unknown", source: "page", observedAt: 0 },
    cancellation: { summary: null, freeUntil: null, source: "none" }, dates: { start: null, end: null, source: "none" }, ...over,
  }) as Item;
const input = (items: Item[]): PrepInput => ({ chores: [], items, trip: {}, range: null, passport: null, countries: [], today: "2026-10-20" });

describe("P3", () => {
  it("F30: a booking switched for another is a chore to cancel on its site, by its free-cancel day", () => {
    const old = item({ status: "dismissed", dismissedFrom: "booked", cancelledAt: 1, cancelPending: true, cancellation: { summary: null, freeUntil: "2026-11-13", source: "page" } });
    const [t] = prepTasks(input([old]));
    expect(t).toMatchObject({ key: "cancel:x", title: "Vincci Bonjardim rezervasyonunu iptal et", day: { date: "2026-11-13", rel: "by" }, tick: "cancel", official: old.url });
    expect(prepTasks(input([{ ...old, cancelPending: undefined }]))).toEqual([]);
  });
  it("F28: a booking with no price asks what was paid", () => {
    expect(fieldPlaceholder("price", item({}))).toBe("Ne kadar ödedin?");
    expect(fieldPlaceholder("price", item({ status: "chosen" }))).toBe("Fiyat ekle");
  });
  it("F36: one adult's fare on a trip of two is one person's", () => {
    const klm = item({ category: "flight", name: "KLM", guests: { adults: 1, children: null, rooms: null }, price: { amount: 210, currency: "EUR", scope: "total", taxesIncluded: "unknown", source: "page", observedAt: 0 } });
    expect(soloTicket(klm, 2)).toBe(true);
    expect(soloTicket(klm, 1)).toBe(false);
    expect(soloTicket({ ...klm, forWho: ["Sabine"] }, 2)).toBe(false);
    expect(ticketPrices(klm, undefined, 2)).toEqual({ each: "€210", total: "€420" });
  });
});
