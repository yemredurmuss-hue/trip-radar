// tests/userEdits.test.ts
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listMessages } from "../src/lib/db";
import { mergeItem } from "../src/lib/items";
import { buildPlan } from "../src/lib/plan";
import { clearUserEdit, correctionOf, editsAfter, saveUserEdit, withEdits, withoutEdits } from "../src/lib/userEdits";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const hotel = (over: Partial<Item> = {}) =>
  makeItem({
    category: "stay", name: "Jardim Stay", city: "Porto", provider: "Booking.com", status: "chosen", needKey: "stay:porto",
    dates: { start: "2026-10-08", end: "2026-10-11", source: "page" },
    price: { amount: 450, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    ...over,
  });
const flight = (over: Partial<Item> = {}) =>
  makeItem({
    category: "flight", name: "Pegasus · IST → OPO", status: "chosen",
    dates: { start: "2026-10-08", end: null, source: "page" },
    flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: "Pegasus", flightNumber: "PC1", stops: 0 },
    ...over,
  });

describe("a saved page's card corrected by hand", () => {
  it("nothing corrected: the very same record", () => {
    const h = hotel();
    expect(withEdits(h)).toBe(h);
  });
  it("shows the corrected name, city, nights and price; the page's values wait under them", () => {
    const h = withEdits(hotel({ userEdits: { name: "Jardim (bahçe odası)", start: "2026-10-09", price: 400, currency: "TRY" } }));
    expect(h).toMatchObject({ name: "Jardim (bahçe odası)", city: "Porto", dates: { start: "2026-10-09", end: "2026-10-11" }, price: { amount: 400, currency: "TRY", source: "user" } });
    expect(h.pageValues).toEqual({ name: "Jardim Stay", start: "2026-10-08", price: 450, currency: "EUR" });
    expect([correctionOf(h, "name"), correctionOf(h, "date"), correctionOf(h, "city")]).toEqual(["Jardim Stay", "8 Ekim", null]);
    expect(correctionOf(h, "price")).toMatch(/450/);
  });
  it("a trip moved a day lands a day later; its hour and its ends are the traveller's", () => {
    const f = withEdits(flight({ userEdits: { start: "2026-10-09", time: "08:00", to: "LIS" } }));
    expect(f.flight).toMatchObject({ from: "IST", to: "LIS", departure: "2026-10-09T08:00", arrival: "2026-10-09T10:05", carrier: "Pegasus" });
    expect(f.dates.start).toBe("2026-10-09");
  });
  it("the plan places the stay on the corrected nights", () => {
    const trip: Trip = { id: "t1", title: "Portekiz", confirmedDates: { start: "2026-10-08", end: "2026-10-12" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const plan = buildPlan(trip, [withEdits(hotel({ userEdits: { end: "2026-10-12" } }))]);
    expect(plan.stayBlocks.map((b) => [b.kind, b.range.start, b.range.end])).toEqual([["chosen", "2026-10-08", "2026-10-12"]]);
  });
});

describe("what a change on the card writes", () => {
  const h = () => withEdits(hotel());
  it("a value differing from the page is a correction; back to the page's value or emptied, it's gone", () => {
    expect(editsAfter(h(), { name: "Jardim bahçe" })).toEqual({ name: "Jardim bahçe" });
    const corrected = withEdits(hotel({ userEdits: { name: "Jardim bahçe" } }));
    expect(editsAfter(corrected, { name: "Jardim Stay" })).toEqual({});
    expect(editsAfter(corrected, { name: "" })).toEqual({});
    expect(editsAfter(h(), { name: "Jardim Stay" })).toBeNull();
  });
  it("a price in another currency keeps the currency; the page's currency isn't written", () => {
    expect(editsAfter(h(), { price: "400", currency: "EUR" })).toEqual({ price: 400 });
    expect(editsAfter(h(), { price: "13.500", currency: "TRY" })).toEqual({ price: 13500, currency: "TRY" });
    expect(editsAfter(h(), { price: "abc", currency: "EUR" })).toMatch(/Fiyat bir sayı olmalı/);
  });
  it("a stay's check-in moved keeps its nights; a check-out before check-in is refused", () => {
    expect(editsAfter(h(), { date: "2026-10-09" })).toEqual({ start: "2026-10-09", end: "2026-10-12" });
    expect(editsAfter(h(), { end: "2026-10-08" })).toMatch(/çıkış günü girişten sonra/);
    expect(editsAfter(h(), { date: "9 Ekim" })).toMatch(/YYYY-AA-GG/);
  });
});

describe("a page saved again", () => {
  it("updates what's under the corrections and keeps them", () => {
    const stored = hotel({ userEdits: { name: "Jardim bahçe", price: 400 } });
    const again = hotel({ id: "new", name: "Jardim Stay Porto", price: { amount: 480, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 2 } });
    const merged = mergeItem(stored, again);
    expect(merged.userEdits).toEqual({ name: "Jardim bahçe", price: 400 });
    expect(merged.name).toBe("Jardim Stay Porto");
    expect(withEdits(merged)).toMatchObject({ name: "Jardim bahçe", price: { amount: 400 }, pageValues: { name: "Jardim Stay Porto", price: 480 } });
    expect(mergeItem(stored, again, true).userEdits).toEqual({ name: "Jardim bahçe", price: 400 });
  });
});

describe("saving and taking back", () => {
  it("writes the correction (not the board's copy) and a line; geri al brings the page's value back", async () => {
    const stored = hotel({ id: "ue1", tripId: "t-ue" });
    await (await db()).put("items", stored);
    const corrected = await saveUserEdit(withEdits(stored), { name: "Jardim bahçe" });
    expect(corrected).toMatchObject({ name: "Jardim bahçe" });
    const raw = (await (await db()).get("items", "ue1"))!;
    expect(raw).toMatchObject({ name: "Jardim Stay", userEdits: { name: "Jardim bahçe" } });
    expect(raw.pageValues).toBeUndefined();
    await clearUserEdit(withEdits(raw), "name");
    const back = (await (await db()).get("items", "ue1"))!;
    expect(back.userEdits).toBeUndefined();
    expect(withEdits(back).name).toBe("Jardim Stay");
    expect((await listMessages("t-ue")).map((m) => m.text)).toEqual(["Jardim bahçe düzeltildi", "Jardim Stay: sayfadaki değere dönüldü"]);
  });
});

describe("a corrected price keeps the page's unit", () => {
  it("a flight priced per person stays per person; a stay per night stays per night", () => {
    const perPerson = flight({ price: { amount: 80, currency: "EUR", scope: "per_person", taxesIncluded: "yes", source: "page", observedAt: 1 }, userEdits: { price: 85 } });
    expect(withEdits(perPerson).price).toMatchObject({ amount: 85, scope: "per_person", source: "user" });
    const perNight = hotel({ price: { amount: 100, currency: "EUR", scope: "per_night", taxesIncluded: "yes", source: "page", observedAt: 1 }, userEdits: { price: 110 } });
    expect(withEdits(perNight).price).toMatchObject({ amount: 110, scope: "per_night" });
  });
  it("a page with no price: the amount typed is the total", () => {
    const none = hotel({ price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "page", observedAt: 1 }, userEdits: { price: 300, currency: "EUR" } });
    expect(withEdits(none).price).toMatchObject({ amount: 300, currency: "EUR", scope: "total" });
  });
});

describe("the chat setting a field the card corrected", () => {
  it("takes those corrections away and keeps the others", () => {
    const h = hotel({ userEdits: { name: "Jardim bahçe", price: 400, currency: "TRY", start: "2026-10-09" } });
    expect(withoutEdits(h, ["price", "currency"]).userEdits).toEqual({ name: "Jardim bahçe", start: "2026-10-09" });
    expect("userEdits" in withoutEdits(hotel({ userEdits: { price: 400 } }), ["price", "currency"])).toBe(false);
    const plain = hotel();
    expect(withoutEdits(plain, ["price"])).toBe(plain);
  });
});
