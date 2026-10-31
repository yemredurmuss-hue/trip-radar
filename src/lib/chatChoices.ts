// The taps under the chat's last reply (its quick answers): they stay while only change lines follow it (the start's
// summary, then "5 değişiklik" as the trip is made: Emre 2026-10-31, "düğmeler çıkmadı"), and end once the traveller
// writes. A web search's late line isn't a reply: the one before it keeps its taps. Pure.
import type { ChatMessage } from "./types";

export function replyChoices(messages: readonly ChatMessage[]): string[] {
  const last = messages.filter((m) => m.text.trim() !== "" && !m.landed && m.role !== "event").at(-1);
  return last?.role === "assistant" ? last.choices : [];
}
