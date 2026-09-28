import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { getSettings } from "../db";
import { anthropicProvider, describeAnthropicError } from "./anthropic";
import { describeGeminiError, geminiProvider } from "./gemini";
import { MissingKeyError, type LlmProvider } from "./types";

export { MissingKeyError } from "./types";
export type { LlmProvider, ProviderId } from "./types";

/** Provider chosen in settings. Personal build: keys stay in this browser and calls go direct. */
export async function getProvider(): Promise<LlmProvider> {
  const s = await getSettings();
  if (s.provider === "gemini") {
    if (!s.geminiKey) throw new MissingKeyError();
    return geminiProvider(new GoogleGenAI({ apiKey: s.geminiKey }), s.geminiModel);
  }
  if (!s.apiKey) throw new MissingKeyError();
  return anthropicProvider(new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true }), s.model);
}

/** Turkish, user-facing message for any failure during a model call. */
export function describeError(error: unknown): string {
  if (error instanceof MissingKeyError) return error.message;
  return (
    describeGeminiError(error) ??
    describeAnthropicError(error) ??
    (error instanceof TypeError && /fetch/i.test(error.message)
      ? "API'ye bağlanılamadı. İnternetini kontrol et."
      : error instanceof Error
        ? error.message
        : String(error))
  );
}
