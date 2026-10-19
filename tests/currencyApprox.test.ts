// D17 (H17): a price keeps its own money; converted into the trip's, the board says it with "≈" and keeps the page's
// own beside it (the card's price, the hero's budget); a money with no exchange rate known can't be picked; JPY can.
import { describe, expect, it } from "vitest";
import { cardFacts } from "../src/lib/cardFacts";
import { decideGroup, makeContext } from "../src/lib/decision";
import { canPick, CURRENCIES, CURRENCY_SIGN } from "../src/lib/displayCurrency";
import { buildPlan } from "../src/lib/plan";
import { budgetBar } from "../src/lib/progress";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const rates = { base: "EUR" as const, date: "2026-10-01", rates: { EUR: 1, JPY: 160, TRY: 40 } };
const trip: Trip = { id: "t1", title: "Japonya", confirmedDates: null, budget: null, currency: "JPY", heroImage: null, createdAt: 1, updatedAt: 1 };
const tour = (id: string, amount: number, currency: string) =>
  makeItem({ id, category: "activity", needKey: "activity:kyoto", name: id, city: "Kyoto", dates: { start: "2026-11-02", end: null, source: "page" }, price: { amount, currency, scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 } });

describe("D17: the converted price", () => {
  it("is said with \"≈\" in the trip's money, the page's own kept beside it; one already in it is plain", () => {
    const items = [tour("Fushimi", 50, "EUR"), tour("Nishiki", 4000, "JPY")];
    const ctx = makeContext(trip, items, { rates });
    const d = decideGroup(items, ctx);
    const euro = cardFacts(items[0], d, ctx).price!;
    expect(euro.text).toBe("≈¥8.000");
    expect(euro.source).toBe("€50");
    const yen = cardFacts(items[1], d, ctx).price!;
    expect(yen.text).toBe("¥4.000");
    expect(yen.source).toBeUndefined();
  });

  it("makes the hero's budget say \"≈\" once a sum was converted", () => {
    const items = [{ ...tour("Fushimi", 50, "EUR"), status: "booked" as const }];
    const ctx = makeContext(trip, items, { rates });
    expect(budgetBar(buildPlan(trip, items), items, ctx, undefined)).toMatchObject({ currency: "JPY", booked: 8000, converted: true });
    const own = [{ ...tour("Nishiki", 4000, "JPY"), status: "booked" as const }];
    expect(budgetBar(buildPlan(trip, own), own, makeContext(trip, own, { rates }), undefined).converted).toBe(false);
  });
});

describe("D17: the money picker", () => {
  it("offers JPY; a money can be picked once its rate is known (or it's the one picked)", () => {
    expect(CURRENCIES).toContain("JPY");
    expect(CURRENCY_SIGN.JPY).toBe("¥");
    expect(canPick("JPY", rates, null)).toBe(true);
    expect(canPick("GBP", rates, null)).toBe(false);
    expect(canPick("EUR", rates, null)).toBe(true);
    expect(canPick("JPY", null, null)).toBe(false);
    expect(canPick("JPY", null, "JPY")).toBe(true);
  });
});
