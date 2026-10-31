// tests/startFold.test.ts: the start's interview, moved into the trip's chat, is marked so the board folds it under one
// line; the spine said back is the first thing seen (omurga 2026-10-31, Emre: "yukarıdakiler kafa karıştırıyor").
import { describe, expect, it } from "vitest";
import { historyRows } from "../src/lib/startTrip";

describe("the interview in the trip's chat", () => {
  it("every turn of it is marked as the start's; the closing summary is not", () => {
    const rows = historyRows(
      [
        { role: "user", text: "Tromsø'ya kuzey ışıkları", at: 1 },
        { role: "assistant", text: "Ne zaman?", at: 2 },
        { role: "user", text: "Şubat", at: 3 },
      ] as never,
      "🇳🇴 **İlk planın hazır: Tromsø.**",
      "gemini",
      "t1",
    );
    expect(rows.slice(0, -1).every((r) => r.start === true)).toBe(true);
    expect(rows.at(-1)!.start).toBeUndefined();
    expect(rows.at(-1)!.text).toContain("İlk planın hazır");
    expect(rows.at(-1)!.choices).toEqual([]);
  });

  it("the summary's question comes with its answers to tap", () => {
    const rows = historyRows([{ role: "user", text: "Tromsø", at: 1 }] as never, "Soru?", "gemini", "t1", ["İlk gece", "Son gece"]);
    expect(rows.at(-1)!.choices).toEqual(["İlk gece", "Son gece"]);
  });
});
