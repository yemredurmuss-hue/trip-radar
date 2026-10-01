// What the rest of the app needs from a model provider. Each provider stores chat turns in its own
// native format (ChatMessage.content) so history replays exactly, thinking/thought signatures included.
import type { ZodType } from "zod";
import { L } from "../i18n";
import type { Extraction } from "../extract";
import type { Capture, ChatMessage, Trip } from "../types";
import type { UrlFacts } from "../url";

export type ProviderId = "gemini" | "anthropic";

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema of the tool input (object). */
  schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export interface ToolResult {
  call: ToolCall;
  content: string;
  isError: boolean;
}

export interface ChatStep {
  /** Native assistant turn to store and replay. */
  content: unknown;
  text: string;
  calls: ToolCall[];
  refused: boolean;
}

export interface LlmProvider {
  id: ProviderId;
  extract(capture: Capture, facts: UrlFacts, trips: Trip[]): Promise<Extraction>;
  /** One structured-output call validated against the schema (used by the decision analysis). */
  generateJson<T>(system: string, prompt: string, schema: ZodType<T>): Promise<T>;
  /** One model call over the stored session. Null when the model returned nothing to store. */
  chatStep(history: ChatMessage[], system: string, tools: ToolSpec[]): Promise<ChatStep | null>;
  /** Native content for a user turn made of text blocks. */
  userContent(texts: string[]): unknown;
  /** Native content for the user turn that returns tool results. */
  toolResultContent(results: ToolResult[]): unknown;
}

export class MissingKeyError extends Error {
  constructor() {
    super(L("API anahtarı yok. Panoda ••• → Ayarlar'dan ekle.", "No API key. Add one on the board under ••• → Settings."));
  }
}
