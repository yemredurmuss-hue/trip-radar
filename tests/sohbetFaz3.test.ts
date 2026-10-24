// Sohbet Faz 3 (2026-10-24, docs/arastirma/2026-10-24-sohbet-ajan-plani.md): a switch of provider (Gemini's quota gone,
// Claude took over) keeps the conversation, as plain words; Gemini reads one board, the newest, not every old copy.
import { describe, expect, it } from "vitest";
import { modelHistory, withLatestState } from "../src/lib/modelHistory";
import type { ChatMessage } from "../src/lib/types";

const msg = (id: string, role: ChatMessage["role"], text: string, provider: "gemini" | "anthropic", content: unknown = { raw: text }): ChatMessage => ({
  id, tripId: "t", role, content, text, choices: [], provider, createdAt: Number(id.replace(/\D/g, "")) || 0,
});
const stub = (id: "gemini" | "anthropic") => ({
  id,
  userContent: (texts: string[]) => ({ as: id, user: texts.join("\n") }),
  assistantContent: (text: string) => ({ as: id, assistant: text }),
});

describe("modelHistory", () => {
  it("Gemini's words before Claude took over come along as text turns, alternating, ending with an answer", () => {
    const all = [
      msg("m1", "user", "genel uber yolculukları koy", "gemini"),
      msg("m2", "assistant", "", "gemini"), // a step's hidden words
      msg("m3", "user", "", "gemini"), // its tool results
      msg("m4", "assistant", "Uber Yolculukları tüm gezi için eklendi.", "gemini"),
      msg("m5", "event", "Uber Yolculukları eklendi", "gemini"),
      msg("m6", "user", "onu 300 euro yap", "anthropic"),
    ];
    const own = [all[5]];
    const h = modelHistory(all, own, stub("anthropic"));
    expect(h.map((m) => [m.role, m.provider])).toEqual([["user", "anthropic"], ["assistant", "anthropic"], ["user", "anthropic"]]);
    expect(h[0].content).toEqual({ as: "anthropic", user: "genel uber yolculukları koy" });
    expect(h[1].content).toEqual({ as: "anthropic", assistant: "Uber Yolculukları tüm gezi için eklendi." });
    expect(h[2]).toBe(own[0]);
  });

  it("nothing from before a reset; a dangling question of the traveller's is left out (the run must alternate)", () => {
    const all = [
      msg("m1", "user", "eski konu", "gemini"),
      msg("m2", "assistant", "eski cevap", "gemini"),
      { ...msg("m3", "event", "Yeni sohbet", "gemini"), resetsContext: true },
      msg("m4", "user", "yarım kalan soru", "gemini"),
      msg("m5", "user", "yeni", "anthropic"),
    ];
    expect(modelHistory(all, [all[4]], stub("anthropic")).map((m) => m.id)).toEqual(["m5"]);
  });

  it("Gemini: only the newest <trip_state> in full; Claude's history only grows (its cache)", () => {
    const state = (n: number) => [{ text: `<trip_state>{"n":${n}}</trip_state>` }, { text: "<trip_brief>x</trip_brief>" }];
    const own = [msg("m1", "user", "a", "gemini", state(1)), msg("m2", "assistant", "b", "gemini"), msg("m3", "user", "c", "gemini", state(2))];
    const g = modelHistory(own, own, stub("gemini"));
    expect(JSON.stringify(g[0].content)).toContain("older board");
    expect(JSON.stringify(g[2].content)).toContain('{\\"n\\":2}');
    const a = modelHistory(own, own, stub("anthropic"));
    expect(a[0]).toBe(own[0]);
    // The stored messages are untouched.
    expect(JSON.stringify(own[0].content)).toContain('{\\"n\\":1}');
    expect(withLatestState(own)[2]).toBe(own[2]);
  });
});
