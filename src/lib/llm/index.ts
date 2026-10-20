import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { noteClaudeTakeover } from "../aiQuota";
import { getSettings } from "../db";
import { aiGate } from "../share/ai";
import { L } from "../i18n";
import { anthropicNeedsSettings, anthropicProvider, anthropicUnreached, describeAnthropicError } from "./anthropic";
import { describeGeminiError, geminiNeedsSettings, geminiProvider, geminiSpent, GeminiSpentError } from "./gemini";
import { queuedProvider, type AiCallOpts } from "./queue";
import { MissingKeyError, type LlmProvider } from "./types";

export { MissingKeyError } from "./types";
export { promoteAi, type AiCallOpts, type AiPriority } from "./queue";
export type { LlmProvider, ProviderId } from "./types";

/**
 * Provider chosen in settings: your own key (kept in this browser, calls go direct); else, when you were
 * invited, the inviter's AI gate (0.36: Gemini through their server, the invite's ticket as the key).
 */
export async function getProvider(opts: AiCallOpts = {}): Promise<LlmProvider> {
  return queuedProvider(await ownProvider(), opts);
}

/** The provider itself, its calls not in the line (getProvider puts them there: llm/queue.ts). */
async function ownProvider(): Promise<LlmProvider> {
  const s = await getSettings();
  if (s.provider === "gemini") {
    // 0.39.12 (Emre: "Claude otomatik devreye girsin"): with a Claude key too, Claude takes over once every Gemini model's
    // free requests for today are used up (the chat starts a fresh context with it, assistant.ts currentSession).
    const claude = s.apiKey ? () => (noteClaudeTakeover(s.model), anthropicProvider(new Anthropic({ apiKey: s.apiKey!, dangerouslyAllowBrowser: true }), s.model)) : null;
    if (claude && geminiSpent(s.geminiModel)) return claude();
    if (s.geminiKey) return withClaudeBackup(geminiProvider(new GoogleGenAI({ apiKey: s.geminiKey }), s.geminiModel), claude);
    const gate = await aiGate();
    if (!gate) throw new MissingKeyError();
    return geminiProvider(new GoogleGenAI({ apiKey: gate.ticket, httpOptions: { baseUrl: gate.baseUrl } }), s.geminiModel);
  }
  if (!s.apiKey) throw new MissingKeyError();
  return anthropicProvider(new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true }), s.model);
}

/**
 * The call that finds Gemini spent goes on with Claude at once where it is one call (a reading, a JSON answer: the start
 * chat, the reviews, the Bavul); a chat step fails once and the next one is Claude's (its history is the provider's own).
 */
export function withClaudeBackup(gemini: LlmProvider, claude: (() => LlmProvider) | null): LlmProvider {
  if (!claude) return gemini;
  const spent = (error: unknown) => error instanceof GeminiSpentError;
  return {
    ...gemini,
    extract: (capture, facts, trips) => gemini.extract(capture, facts, trips).catch((error) => (spent(error) ? claude().extract(capture, facts, trips) : Promise.reject(error))),
    generateJson: (system, prompt, schema, files, opts) =>
      gemini.generateJson(system, prompt, schema, files, opts).catch((error) => (spent(error) ? claude().generateJson(system, prompt, schema, files, opts) : Promise.reject(error))),
  };
}

/**
 * What the traveller can do about a failed model call: "settings" (no key, a bad key, no access, a model gone: fixed in Ayarlar),
 * "offline" (the request never got out), or null (anything else: the message says it). The chat's banner (Chat.tsx) reads it.
 */
export type ErrorKind = "settings" | "offline";
export function errorKind(error: unknown): ErrorKind | null {
  if (error instanceof MissingKeyError || anthropicNeedsSettings(error) || geminiNeedsSettings(error)) return "settings";
  if (anthropicUnreached(error) || (error instanceof TypeError && /fetch/i.test(error.message))) return "offline";
  return null;
}

/** User-facing message (in the current language) for any failure during a model call. */
export function describeError(error: unknown): string {
  if (error instanceof MissingKeyError) return error.message;
  return (
    describeGeminiError(error) ??
    describeAnthropicError(error) ??
    (error instanceof TypeError && /fetch/i.test(error.message)
      ? L("API'ye bağlanılamadı. İnternetini kontrol et.", "Couldn't reach the API. Check your internet connection.")
      : error instanceof Error
        ? error.message
        : String(error))
  );
}
