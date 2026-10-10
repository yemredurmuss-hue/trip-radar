import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "../db";
import { aiGate } from "../share/ai";
import { L } from "../i18n";
import { anthropicProvider, describeAnthropicError } from "./anthropic";
import { describeGeminiError, geminiProvider } from "./gemini";
import { MissingKeyError, type LlmProvider } from "./types";

export { MissingKeyError } from "./types";
export type { LlmProvider, ProviderId } from "./types";

/**
 * Provider chosen in settings: your own key (kept in this browser, calls go direct); else, when you were
 * invited, the inviter's AI gate (0.36: Gemini through their server, the invite's ticket as the key).
 */
export async function getProvider(): Promise<LlmProvider> {
  const s = await getSettings();
  if (s.provider === "gemini") {
    if (s.geminiKey) return geminiProvider(new GoogleGenAI({ apiKey: s.geminiKey }), s.geminiModel);
    const gate = await aiGate();
    if (!gate) throw new MissingKeyError();
    return geminiProvider(new GoogleGenAI({ apiKey: gate.ticket, httpOptions: { baseUrl: gate.baseUrl } }), s.geminiModel);
  }
  if (!s.apiKey) throw new MissingKeyError();
  return anthropicProvider(new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true }), s.model);
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
