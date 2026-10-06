// A model that refuses the reading with the playbook's part (its schema too big for the grammar) never costs the
// reading: the same message is read again without it, and the playbook isn't asked for again on this page.
import { afterEach, describe, expect, it, vi } from "vitest";

const calls: { system: string; hasPlan: boolean }[] = [];
vi.mock("../src/lib/llm", () => ({
  getProvider: async () => ({
    generateJson: async (system: string, _prompt: string, schema: { shape?: Record<string, unknown> }) => {
      const hasPlan = Boolean(schema.shape && "plan" in schema.shape);
      calls.push({ system, hasPlan });
      if (hasPlan) throw new Error("400 schema too complex");
      return {
        destination: "Lizbon", destination_country: "Portekiz", destination_country_code: "PT", origin: "", companions: "", names: [], start_date: "", start_month: 0,
        duration_days: 0, duration_months: 0, styles: [], budget: "", reply: { text: "Lizbon güzel bir seçim.", question: "" },
      };
    },
  }),
}));

import { readAndReply, resetPlanRefused } from "../src/app/start/model";

afterEach(() => (resetPlanRefused(), (calls.length = 0)));

describe("the reading without the playbook's part", () => {
  it("reads again without it once refused, then asks without it", async () => {
    const a = { text: "Lizbon", today: "2026-10-07", pending: null, next: null, known: "", lang: "tr" as const };
    const first = await readAndReply(a);
    expect(first?.read.where?.place).toBe("Lizbon");
    expect(calls.map((c) => c.hasPlan)).toEqual([true, false]);
    expect(calls[1].system).not.toContain("plan: bu geziye özel kalıp");
    await readAndReply(a);
    expect(calls.map((c) => c.hasPlan)).toEqual([true, false, false]);
  });
});
