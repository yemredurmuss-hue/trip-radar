// What of the model's reply reaches the screen. The trip state goes to the model inside <trip_state>…</trip_state>;
// a model that echoes its input (seen: the whole state as the reply to "gaula medeira var ulaşımda onu kaldır")
// must never put it, or any other scaffolding, in front of the traveller. Pure.
import { L } from "./i18n";

/** Scaffolding blocks: dropped with everything in them when closed. */
const BLOCKS = ["trip_state", "system", "system-reminder", "tool_result", "tool_use", "function_results", "function_calls", "functionResponse", "functionCall"];
const NAMES = BLOCKS.join("|");
const CLOSED = new RegExp(`<(${NAMES})(?=[\\s/>])[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi");
/** The trip state left open runs to the end: nothing after `<trip_state>` is for the traveller. */
const OPEN_STATE = /<trip_state(?=[\s/>])[^>]*>[\s\S]*$/i;
/** Any other block left open counts as scaffolding only at the very start of the reply. */
const OPEN_AT_START = new RegExp(`^\\s*<(?:${NAMES})(?=[\\s/>])[^>]*>[\\s\\S]*$`, "i");
/** Stray tags left over (a closing tag alone, an invoke/parameter line): the tag goes, the words around it stay. */
const TAG = new RegExp(`<\\/?(?:${NAMES}|invoke|parameter)(?=[\\s/>])[^>]*>`, "gi");
/** The state's JSON without its tags. */
const STATE_JSON = /\{\s*"trip"\s*:\s*\{/;

/**
 * Whether the text from here on is the state blob: long and JSON-shaped (many `"key":` pairs), or JSON that
 * parses. A sentence quoting `{"trip": {` stays.
 */
function stateBlob(rest: string): boolean {
  if (rest.length >= 200 && (rest.match(/"[\w-]+"\s*:/g)?.length ?? 0) >= 6) return true;
  try {
    const parsed = JSON.parse(rest.trim());
    return Boolean(parsed && typeof parsed === "object" && "trip" in parsed);
  } catch {
    return false;
  }
}

export interface CleanReply {
  text: string;
  /** Something was taken out. */
  leaked: boolean;
}

/** The reply without the trip state (closed or not), its bare JSON, or tool/system scaffolding. */
export function cleanReply(raw: string): CleanReply {
  let text = raw.replace(CLOSED, "").replace(OPEN_STATE, "").replace(OPEN_AT_START, "").replace(TAG, "");
  const json = text.search(STATE_JSON);
  if (json >= 0 && stateBlob(text.slice(json))) text = text.slice(0, json);
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, leaked: text !== raw.trim() };
}

/** Said when nothing of a reply is left to show. */
export const replyFallback = () => L("Bunu yapamadım, bir daha dener misin?", "I couldn't do that. Could you try again?");

/** An assistant message as the chat shows it: cleaned, or the fallback when nothing is left of it. */
export function shownReply(raw: string): string {
  if (!raw.trim()) return raw;
  const { text } = cleanReply(raw);
  return text || replyFallback();
}

/**
 * A provider's stored assistant turn with its text cleaned the same way (Claude's text blocks, Gemini's text
 * parts), so the echoed state doesn't stay in the history the model reads next time. Tool calls and thoughts
 * stay as they are (their signatures must replay). `empty`: no block is left.
 */
export function cleanContent(content: unknown): { content: unknown; empty: boolean } {
  if (!Array.isArray(content)) return { content, empty: false };
  const out: unknown[] = [];
  for (const block of content) {
    const b = block as { type?: unknown; text?: unknown; thought?: unknown } | null;
    const isText = Boolean(b && typeof b.text === "string" && (b.type === undefined || b.type === "text") && b.thought !== true);
    if (!isText) {
      out.push(block);
      continue;
    }
    const text = cleanReply(b!.text as string).text;
    if (text) out.push({ ...b, text });
  }
  return { content: out, empty: out.length === 0 };
}
