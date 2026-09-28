import Anthropic from "@anthropic-ai/sdk";
import { getSettings } from "./db";

export class MissingKeyError extends Error {
  constructor() {
    super("API anahtarı yok. Panoda ⚙ Ayarlar'dan ekle.");
  }
}

/**
 * Personal build: the key is stored only in this browser's extension storage and calls go straight
 * to the API. A shared/product version must move these calls behind its own server.
 */
export async function getClient(): Promise<{ client: Anthropic; model: string }> {
  const { apiKey, model } = await getSettings();
  if (!apiKey) throw new MissingKeyError();
  return { client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }), model };
}

/** Turkish, user-facing message for any failure during a model call. */
export function describeError(error: unknown): string {
  if (error instanceof MissingKeyError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) return "API anahtarı geçersiz. Ayarlardan kontrol et.";
  if (error instanceof Anthropic.PermissionDeniedError) return "Bu API anahtarının bu modele erişimi yok.";
  if (error instanceof Anthropic.RateLimitError) return "Hız sınırına takıldı; birazdan tekrar dene.";
  if (error instanceof Anthropic.BadRequestError) return `İstek reddedildi: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return "API'ye bağlanılamadı. İnternetini kontrol et.";
  if (error instanceof Anthropic.APIError) return `API hatası (${error.status}): ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
