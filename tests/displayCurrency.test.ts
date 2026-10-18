// The traveller's own currency (displayCurrency.ts, 2026-10-09): prices compared in it when the trip has no budget
// currency of its own; the trip's own still wins; none chosen, as before.
import { afterEach, describe, expect, it } from "vitest";
import { makeContext } from "../src/lib/decision";
import { setDisplayCurrency } from "../src/lib/displayCurrency";
import type { Trip } from "../src/lib/types";

const trip = (patch: Partial<Trip> = {}): Trip => ({ id: "t", title: "T", confirmedDates: null, heroImage: null, createdAt: 0, updatedAt: 0, ...patch }) as Trip;
afterEach(() => setDisplayCurrency(null));

describe("the chosen currency", () => {
  it("none chosen: EUR as before", () => {
    expect(makeContext(trip(), []).currency).toBe("EUR");
  });
  it("chosen: prices compared in it", () => {
    setDisplayCurrency("TRY");
    expect(makeContext(trip(), []).currency).toBe("TRY");
  });
  it("the trip's budget currency still wins", () => {
    setDisplayCurrency("TRY");
    expect(makeContext(trip({ budget: { amount: 3000, currency: "USD" } }), []).currency).toBe("USD");
  });
});
