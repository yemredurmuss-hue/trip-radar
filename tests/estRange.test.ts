// A need's estimated price range: only from three or more real priced options.
import { describe, expect, it } from "vitest";
import { estimatedRange, rangeLabel } from "../src/lib/estRange";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const stay = (amount: number | null, over: Partial<Item> = {}): Item =>
  makeItem({ category: "stay", price: { amount, currency: "EUR", scope: "per_night", taxesIncluded: "yes", source: "page", observedAt: 1 }, ...over });

describe("estimatedRange", () => {
  it("is null with fewer than three priced options", () => {
    expect(estimatedRange([stay(240), stay(300)])).toBeNull();
    expect(estimatedRange([stay(240), stay(300), stay(null)])).toBeNull();
  });
  it("is the spread of three or more real prices", () => {
    const r = estimatedRange([stay(243), stay(300), stay(512)]);
    expect(r).toMatchObject({ lo: 240, hi: 520, n: 3, unit: "night", currency: "EUR" });
    expect(rangeLabel(r!)).toMatch(/240.*520/);
  });
  it("turns a stay's total into a night's price by its nights, and skips one it can't", () => {
    const total = (amount: number) => stay(amount, { price: { amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 }, dates: { start: "2026-10-08", end: "2026-10-10", source: "page" } });
    expect(estimatedRange([total(400), total(600), total(800)])).toMatchObject({ lo: 200, hi: 400 });
    const undated = stay(500, { price: { amount: 500, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 } });
    expect(estimatedRange([total(400), total(600), undated])).toBeNull();
    expect(estimatedRange([total(400), total(600), undated], 2)).toMatchObject({ n: 3 });
  });
  it("ignores ruled-out options and mixed currencies", () => {
    expect(estimatedRange([stay(100), stay(200), stay(300, { status: "dismissed" })])).toBeNull();
    const usd = stay(300, { price: { amount: 300, currency: "USD", scope: "per_night", taxesIncluded: "yes", source: "page", observedAt: 1 } });
    expect(estimatedRange([stay(100), stay(200), usd])).toBeNull();
  });
  it("speaks per person for per-person prices outside stays", () => {
    const esim = (amount: number) => makeItem({ category: "esim", price: { amount, currency: "EUR", scope: "per_person", taxesIncluded: "yes", source: "page", observedAt: 1 } });
    expect(estimatedRange([esim(20), esim(25), esim(30)])).toMatchObject({ lo: 20, hi: 30, unit: "person" });
  });
});
