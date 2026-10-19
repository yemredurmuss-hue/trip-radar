// The chat's drawer under 860 px (v83 "860 px altı", A7): shut, it is a handle that says "Asistan" and the last thing said
// in a few words, so the plan keeps the screen and the conversation is a tap away. That line: the last thing said (the
// assistant's or the traveller's), its markdown and links read as words, on one line, cut at a word. Pure.
import { shownReply } from "./replyText";
import type { ChatMessage } from "./types";

/** How long the handle's line is at most (the prototype's 64 characters). */
export const PEEK_MAX = 64;

/** A reply's words as read: **bold** and [site](https://…) as their text, every break a space. */
export function plainWords(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]\n]{1,80})\]\(https:\/\/[^\s)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cut at `max` characters, at the last word that fits, with "…". */
export function cutWords(text: string, max = PEEK_MAX): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max / 2 ? head.slice(0, space) : head).replace(/[\s,.;:·–-]+$/, "")}…`;
}

/** The handle's line: the last thing said in the chat; null in a chat with nothing said yet. */
export function chatPeek(messages: readonly ChatMessage[], max = PEEK_MAX): string | null {
  // A web search's late line isn't a reply (the one before it is what was said); a change line isn't said by anyone.
  const last = messages.filter((m) => m.text.trim() !== "" && (m.role === "user" || (m.role === "assistant" && !m.landed))).at(-1);
  if (!last) return null;
  const words = plainWords(last.role === "assistant" ? shownReply(last.text) : last.text);
  return words ? cutWords(words, max) : null;
}
