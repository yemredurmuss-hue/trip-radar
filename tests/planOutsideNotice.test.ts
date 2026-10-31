// tests/planOutsideNotice.test.ts: a stay chosen outside the dates said still shows (the plan widens over it), but
// never quietly: one line says the trip now runs past its dates (omurga A3, 2026-10-31).
import { describe, expect, it } from "vitest";
import { buildPlan } from "../src/lib/plan";
import { stay, tripOf } from "./spine/fixture";

describe("a stay outside the dates said", () => {
  it("widens the plan and says so in one notice", () => {
    const osaka = stay("Osaka", "2026-04-11", "2026-04-13", { status: "chosen", name: "Osaka Inn" });
    const plan = buildPlan(tripOf(), [stay("Tokyo", "2026-04-01", "2026-04-11", { status: "booked" }), osaka]);
    expect(plan.range).toEqual({ start: "2026-04-01", end: "2026-04-13" });
    const notice = plan.notices.find((n) => n.text.includes("Osaka Inn"));
    expect(notice).toBeDefined();
    expect(notice!.text).toMatch(/dışında|outside/);
  });

  it("before the first day too", () => {
    const plan = buildPlan(tripOf(), [stay("Tokyo", "2026-03-30", "2026-04-02", { status: "booked", name: "Early Hotel" })]);
    expect(plan.notices.some((n) => n.text.includes("Early Hotel"))).toBe(true);
  });

  it("inside the dates, no notice", () => {
    expect(buildPlan(tripOf(), [stay("Tokyo", "2026-04-01", "2026-04-11", { status: "chosen" })]).notices).toEqual([]);
  });

  it("no dates said, nothing to be outside of", () => {
    expect(buildPlan(tripOf({ confirmedDates: null }), [stay("Tokyo", "2026-04-01", "2026-04-11", { status: "chosen" })]).notices).toEqual([]);
  });
});
