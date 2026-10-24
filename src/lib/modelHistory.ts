// What the model is sent as history (Sohbet Faz 3, 2026-10-24, Emre: "art ardına gönderdiğim mesajlar farklı farklı tepkiler
// vererek değil"): the chat's own run with this provider as stored, and before it
// - what was said with the other provider (Gemini's quota gone, Claude took over, or back), as plain words: a switch kept
//   wiping the conversation, so the next answer knew nothing of the last ones;
// - only the newest <trip_state> in full (Gemini): the older copies, each the whole board, are shortened, so the model reads
//   one board, the current one, and not three that disagree. Claude keeps them: its prompt cache needs the history to only
//   grow at the end (assistant.test "only resends trip state"), and it is told to read the latest.
// The stored history is never changed: only what is sent. Pure.
import type { LlmProvider } from "./llm";
import type { ChatMessage } from "./types";

/** How many of the other provider's turns are carried over (the latest ones). */
export const CARRY_MAX = 12;
const STATE = /<trip_state>[\s\S]*?<\/trip_state>/g;
const OLD_STATE = "<trip_state>(older board; the current one is in the latest message)</trip_state>";

/**
 * `own`: the run written by this provider (assistant.ts currentSession). `all`: every message. The other provider's words
 * since the last reset and before `own` come first, as text turns that alternate and end with the assistant's.
 */
export function modelHistory(all: readonly ChatMessage[], own: readonly ChatMessage[], provider: Pick<LlmProvider, "id" | "userContent" | "assistantContent">): ChatMessage[] {
  const start = own.length ? all.indexOf(own[0]) : all.length;
  const reset = all.findLastIndex((m) => m.resetsContext);
  const before = all.slice(reset + 1, start < 0 ? all.length : start).filter((m) => (m.role === "user" || m.role === "assistant") && m.text.trim() !== "" && !m.landed);
  // Alternating, the same speaker's lines joined; it opens with the traveller's and closes with an answer.
  const turns: { role: "user" | "assistant"; text: string; m: ChatMessage }[] = [];
  for (const m of before) {
    const role = m.role as "user" | "assistant";
    const last = turns.at(-1);
    if (last && last.role === role) last.text = `${last.text}\n${m.text}`;
    else turns.push({ role, text: m.text, m });
  }
  while (turns[0] && turns[0].role !== "user") turns.shift();
  while (turns.length && turns.at(-1)!.role !== "assistant") turns.pop();
  const kept = turns.slice(-CARRY_MAX);
  while (kept[0] && kept[0].role !== "user") kept.shift();
  const carried: ChatMessage[] = kept.map((t) => ({
    ...t.m,
    provider: provider.id,
    stateHash: undefined,
    content: t.role === "user" ? provider.userContent([t.text]) : provider.assistantContent(t.text),
  }));
  const history = [...carried, ...own];
  return provider.id === "gemini" ? withLatestState(history) : history;
}

/** Every <trip_state> but the newest shortened, in what is sent (the stored messages are untouched). */
export function withLatestState(history: readonly ChatMessage[]): ChatMessage[] {
  const has = (m: ChatMessage) => m.role === "user" && JSON.stringify(m.content ?? "").includes("<trip_state>");
  const newest = history.findLastIndex(has);
  return history.map((m, i) => (i < newest && has(m) ? { ...m, content: shortened(m.content) } : m));
}

function shortened(value: unknown): unknown {
  if (typeof value === "string") return value.replace(STATE, OLD_STATE);
  if (Array.isArray(value)) return value.map(shortened);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shortened(v)]));
  return value;
}
