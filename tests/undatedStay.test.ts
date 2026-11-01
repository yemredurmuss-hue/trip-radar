// tests/undatedStay.test.ts: an option saved with no dates goes to the stay card it is for (Tur 24, Emre's Maldives: the
// water villa saved from Airbnb, its city unread, never joined "Su üstü villa"). Its city first; else, in its country or
// with no place read, the longest stay still to fill; with stops in several countries and nothing read, it waits loose.
import { expect, it } from "vitest";
import { buildPlan } from "../src/lib/plan";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const trip: Trip = { id: "mv", title: "Maldivler", confirmedDates: { start: "2027-02-01", end: "2027-02-09" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const slot = (id: string, city: string, code: string, start: string, end: string) =>
  makeItem({ id, tripId: "mv", category: "stay", name: city, city, countryCode: code, needKey: `stay:${id}`, status: "chosen", placeholder: true, dates: { start, end, source: "page" } } as Partial<Item>);
const villa = (extra: Partial<Item> = {}) => makeItem({ id: "villa", tripId: "mv", category: "stay", name: "Water Villa with Private Pool & Floating Breakfast", status: "saved", city: null, country: null, countryCode: null, dates: { start: null, end: null, source: "page" }, ...extra } as Partial<Item>);
const where = (items: Item[]) => {
  const plan = buildPlan(trip, items);
  const b = plan.stayBlocks.find((x) => x.kind !== "booked" && x.groups.some((g) => g.items.some((i) => i.id === "villa")));
  return b ? b.city : plan.looseStays.some((g) => g.items.some((i) => i.id === "villa")) ? "loose" : null;
};

it("no city, no dates: the longest stay still to fill (the 7-night resort, never Malé's 1 night)", () => {
  expect(where([slot("male", "Malé", "MV", "2027-02-01", "2027-02-02"), slot("resort", "Baa Atolü", "MV", "2027-02-02", "2027-02-09"), villa()])).toBe("Baa Atolü");
});

it("its country read, its town not: the longest stay in that country", () => {
  expect(where([slot("male", "Malé", "MV", "2027-02-01", "2027-02-02"), slot("resort", "Baa Atolü", "MV", "2027-02-02", "2027-02-09"), villa({ city: "Maafushi", countryCode: "MV" })])).toBe("Baa Atolü");
});

it("stops in two countries and nothing read: it waits loose (never a guess)", () => {
  expect(where([slot("bkk", "Bangkok", "TH", "2027-02-01", "2027-02-05"), slot("lp", "Luang Prabang", "LA", "2027-02-05", "2027-02-09"), villa()])).toBe("loose");
});
