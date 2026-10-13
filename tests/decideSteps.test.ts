// "Sırayla karar ver": which decisions are open and in what order, the screen title and what the end screen says.
import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { buildSteps, isOpenDecision, outcomeText, stepKeys, stepTitle } from "../src/lib/decideSteps";
import { buildPlan, liveGroups } from "../src/lib/plan";

beforeAll(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-01T10:00:00Z") }));
afterAll(() => vi.useRealTimers());

async function demo() {
  const id = await loadDemoTrip({ today: "2026-10-05" });
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const result = await loadDecisions(trip, items);
  const steps = buildSteps(liveGroups(buildPlan(trip, items)), result.decisions, result.cards);
  return { steps };
}

describe("sırayla karar ver", () => {
  it("the sample trip's open stay decision is a step, with its need's title", async () => {
    const { steps } = await demo();
    const open = steps.filter((s) => isOpenDecision(s.decision));
    expect(open.length).toBeGreaterThan(0);
    const stay = open.find((s) => s.decision!.options.some((o) => o.item.name === "Jardim Stay"))!;
    expect(stay.title.startsWith("Konaklama")).toBe(true);
  });

  it("the decision on screen comes first, then the other open ones in the plan's order; a settled one is only there if it is the first", async () => {
    const { steps } = await demo();
    const open = steps.filter((s) => isOpenDecision(s.decision)).map((s) => s.key);
    const last = open[open.length - 1];
    const keys = stepKeys(steps, last);
    expect(keys[0]).toBe(last);
    expect(new Set(keys)).toEqual(new Set(open));
    const settled = steps.find((s) => !isOpenDecision(s.decision));
    if (settled) {
      expect(stepKeys(steps, settled.key)[0]).toBe(settled.key);
      expect(stepKeys(steps, open[0])).not.toContain(settled.key);
    }
  });

  it("nothing to decide when nothing is open and the window is on no known need", () => {
    expect(stepKeys([], "x")).toEqual([]);
  });

  it("the title counts from 1 and the end screen says what was done", () => {
    expect(stepTitle(0, 3, "Konaklama · Porto")).toBe("1 / 3 · Konaklama · Porto");
    expect(outcomeText({ decided: [{ key: "a", title: "A", name: "X" }, { key: "b", title: "B", name: "Y" }], later: [{ key: "c", title: "C" }] })).toBe("2 karar verildi. 1 karar sonraya kaldı.");
    expect(outcomeText({ decided: [], later: [] })).toBe("Bu turda karar verilmedi.");
  });
});
