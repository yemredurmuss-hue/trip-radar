// tests/chatChoices.test.ts: the taps under the last reply stay when only change lines follow it (the start's summary,
// then "5 değişiklik" as the trip is made): Emre 2026-10-31, "düğmeler çıkmadı". A person's message after it ends them.
import { describe, expect, it } from "vitest";
import { replyChoices } from "../src/lib/chatChoices";
import type { ChatMessage } from "../src/lib/types";

const m = (role: ChatMessage["role"], text: string, choices: string[] = [], over: Partial<ChatMessage> = {}): ChatMessage =>
  ({ id: text, tripId: "t", role, text, choices, content: null, createdAt: 1, ...over }) as ChatMessage;

describe("the last reply's taps", () => {
  it("stay under change lines", () => {
    expect(replyChoices([m("assistant", "Hangi gece?", ["İlk gece", "Son gece"]), m("event", "Kulübe eklendi"), m("event", "Uçuş eklendi")])).toEqual(["İlk gece", "Son gece"]);
  });
  it("end once the traveller writes", () => {
    expect(replyChoices([m("assistant", "Hangi gece?", ["İlk gece"]), m("user", "ilk gece")])).toEqual([]);
  });
  it("a web search's late line isn't a reply: the one before keeps its taps", () => {
    expect(replyChoices([m("assistant", "Hangi gece?", ["İlk gece"]), m("assistant", "Arama sonucu", [], { landed: true } as Partial<ChatMessage>)])).toEqual(["İlk gece"]);
  });
});
