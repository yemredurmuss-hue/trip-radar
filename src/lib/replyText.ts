// What of the model's reply reaches the screen. The trip state goes to the model inside <trip_state>…</trip_state>;
// a model that echoes its input (seen: the whole state as the reply to "gaula medeira var ulaşımda onu kaldır")
// must never put it, or any other scaffolding, in front of the traveller. Pure.
import { L } from "./i18n";

/** Blocks dropped with everything in them; an unclosed one runs to the end of the reply. */
const BLOCKS = ["trip_state", "system", "system-reminder", "tool_result", "tool_use", "function_results", "function_calls", "functionResponse", "functionCall"];
const BLOCK = new RegExp(`<(${BLOCKS.join("|")})(?=[\\s/>])[^>]*>[\\s\\S]*?(?:<\\/\\1\\s*>|$)`, "gi");
/** Stray tags left over (a closing tag alone, an invoke/parameter line). */
const TAG = new RegExp(`<\\/?(?:${[...BLOCKS, "invoke", "parameter"].join("|")})(?=[\\s/>])[^>]*>`, "gi");
/** The state's JSON without its tags: from `{"trip":{` on, nothing is for the traveller. */
const STATE_JSON = /\{\s*"trip"\s*:\s*\{/;

export interface CleanReply {
  text: string;
  /** Something was taken out. */
  leaked: boolean;
}

/** The reply without the trip state (closed or not), its bare JSON, or tool/system scaffolding. */
export function cleanReply(raw: string): CleanReply {
  let text = raw.replace(BLOCK, "").replace(TAG, "");
  const json = text.search(STATE_JSON);
  if (json >= 0) text = text.slice(0, json);
  text = text.replace(/\n{3,}/g, "\n\n").trim();
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
