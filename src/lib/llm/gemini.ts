// Gemini provider (free tier available from Google AI Studio). Note: on the unpaid tier Google may use
// prompts and responses to improve its products, including human review.
import { ApiError, GoogleGenAI, type Content, type GenerateContentResponse, type Part } from "@google/genai";
import { z } from "zod";
import { buildPrompt, extractionSchema, extractionSystem, imagePart, today } from "../extract";
import { L, lang } from "../i18n";
import type { ChatMessage } from "../types";
import type { ChatStep, LlmProvider, ToolResult, ToolSpec } from "./types";

function jsonSchemaFor(zodSchema: z.ZodType): Record<string, unknown> {
  const schema = z.toJSONSchema(zodSchema) as Record<string, unknown>;
  delete schema.$schema; // not in Gemini's supported JSON Schema subset
  return schema;
}

/** The extraction schema as JSON Schema, once per language. */
const extractionJsonSchemas = new Map<string, Record<string, unknown>>();
function extractionJsonSchema(): Record<string, unknown> {
  const key = lang();
  if (!extractionJsonSchemas.has(key)) extractionJsonSchemas.set(key, jsonSchemaFor(extractionSchema()));
  return extractionJsonSchemas.get(key)!;
}

/** Minimal slice of the SDK client used here (lets tests pass a fake). */
export interface GeminiClient {
  models: { generateContent: GoogleGenAI["models"]["generateContent"] };
}

const RETRY_AFTER_MS = 20_000;

/** Rate limits (429) and "model overloaded" (5xx) are usually gone after a short wait: retry once. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function withRetry<T>(call: () => Promise<T>, waitMs = RETRY_AFTER_MS): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof ApiError) || !RETRYABLE.has(error.status)) throw error;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return call();
  }
}

function answerParts(response: GenerateContentResponse): Part[] {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  if (parts.length === 0 && response.promptFeedback?.blockReason) {
    const reason = response.promptFeedback.blockReason;
    throw new Error(L(`Gemini bu içeriği işlemedi (${reason}).`, `Gemini didn't process this content (${reason}).`));
  }
  return parts;
}

const visibleText = (parts: Part[]) =>
  parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

/** Gemini expects alternating roles; merge neighbours (e.g. tool results followed by a new question). */
export function toContents(history: ChatMessage[]): Content[] {
  const contents: Content[] = [];
  for (const message of history) {
    const role = message.role === "assistant" ? "model" : "user";
    const parts = message.content as Part[];
    const last = contents.at(-1);
    if (last?.role === role) last.parts = [...(last.parts ?? []), ...parts];
    else contents.push({ role, parts: [...parts] });
  }
  return contents;
}

const SYNTHETIC_ID = "gemini-call-";

export function geminiProvider(client: GeminiClient, model: string, retryWaitMs = RETRY_AFTER_MS): LlmProvider {
  return {
    id: "gemini",

    async extract(capture, facts, trips) {
      const parts: Part[] = [];
      if (capture.screenshot) {
        const { mediaType, data } = imagePart(capture.screenshot);
        parts.push({ inlineData: { mimeType: mediaType, data } });
      }
      parts.push({ text: buildPrompt(capture, facts, trips, today()) });

      const response = await withRetry(
        () =>
          client.models.generateContent({
            model,
            contents: [{ role: "user", parts }],
            config: {
              systemInstruction: extractionSystem(),
              responseMimeType: "application/json",
              responseJsonSchema: extractionJsonSchema(),
            },
          }),
        retryWaitMs,
      );
      const text = visibleText(answerParts(response));
      if (!text) throw new Error(L("Gemini boş yanıt döndürdü.", "Gemini returned an empty answer."));
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(L("Gemini geçerli JSON döndürmedi.", "Gemini didn't return valid JSON."));
      }
      const parsed = extractionSchema().safeParse(json);
      if (!parsed.success) throw new Error(L("Gemini yanıtı beklenen formatta değil.", "Gemini's answer isn't in the expected format."));
      return parsed.data;
    },

    async generateJson(system, prompt, schema, files = []) {
      const parts: Part[] = [...files.map((f): Part => ({ inlineData: { mimeType: f.mimeType, data: f.data } })), { text: prompt }];
      const response = await withRetry(
        () =>
          client.models.generateContent({
            model,
            contents: [{ role: "user", parts }],
            config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: jsonSchemaFor(schema) },
          }),
        retryWaitMs,
      );
      const text = visibleText(answerParts(response));
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(L("Gemini geçerli JSON döndürmedi.", "Gemini didn't return valid JSON."));
      }
      const parsed = schema.safeParse(json);
      if (!parsed.success) throw new Error(L("Gemini analizi beklenen formatta değil.", "Gemini's analysis isn't in the expected format."));
      return parsed.data;
    },

    async chatStep(history: ChatMessage[], system: string, tools: ToolSpec[]): Promise<ChatStep | null> {
      const response = await withRetry(
        () =>
          client.models.generateContent({
            model,
            contents: toContents(history),
            config: {
              systemInstruction: system,
              tools: [
                {
                  functionDeclarations: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parametersJsonSchema: t.schema,
                  })),
                },
              ],
            },
          }),
        retryWaitMs,
      );
      const parts = answerParts(response);
      if (parts.length === 0) return null;
      const finish = response.candidates?.[0]?.finishReason;
      return {
        content: parts, // stored as-is so thought signatures replay with the function calls
        text: visibleText(parts),
        calls: parts
          .filter((p) => p.functionCall)
          .map((p, i) => ({
            id: p.functionCall!.id ?? `${SYNTHETIC_ID}${i}`,
            name: p.functionCall!.name ?? "",
            input: p.functionCall!.args ?? {},
          })),
        refused: finish === "SAFETY" || finish === "PROHIBITED_CONTENT",
      };
    },

    userContent: (texts) => texts.map((text): Part => ({ text })),

    assistantContent: (text) => [{ text } satisfies Part],

    toolResultContent: (results: ToolResult[]) =>
      results.map(
        (r): Part => ({
          functionResponse: {
            ...(r.call.id.startsWith(SYNTHETIC_ID) ? {} : { id: r.call.id }),
            name: r.call.name,
            response: r.isError ? { error: r.content } : { result: r.content },
          },
        }),
      ),
  };
}

/** Text-generation Gemini models available to this key, best free-tier default first. */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  const pager = await new GoogleGenAI({ apiKey }).models.list();
  const ids: string[] = [];
  for await (const m of pager) {
    // Keep models that can generate text; if the capability list is missing, don't drop them.
    if (m.name && (!m.supportedActions || m.supportedActions.includes("generateContent"))) {
      ids.push(m.name.replace(/^models\//, ""));
    }
  }
  const usable = ids.filter((id) => id.startsWith("gemini") && !/(image|tts|audio|live|embed|robotics|computer)/.test(id));
  const rank = (id: string) =>
    /^gemini-3(\.\d)?-flash(-preview)?$/.test(id) ? 0 : /^gemini-3(\.\d)?-flash-lite/.test(id) ? 1 : /flash/.test(id) ? 2 : 3;
  return usable.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function describeGeminiError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const message = error.message ?? "";
  if (error.status === 400 && /api key/i.test(message)) {
    return L("Gemini API anahtarı geçersiz. Ayarlardan kontrol et.", "The Gemini API key isn't valid. Check it in Settings.");
  }
  if (error.status === 403) return L("Bu Gemini anahtarının bu modele erişimi yok.", "This Gemini key has no access to this model.");
  if (error.status === 404) {
    return L(
      "Gemini modeli bulunamadı. Ayarlar'da 'Modelleri getir' ile güncel modeli seç.",
      "Gemini model not found. In Settings, use 'Fetch models' to pick a current one.",
    );
  }
  if (error.status === 429) {
    return L(
      "Gemini ücretsiz kotası doldu (dakikalık ya da günlük). Biraz bekleyip 'Tekrar dene'ye bas.",
      "Gemini's free quota is used up (per minute or per day). Wait a little, then press 'Try again'.",
    );
  }
  if (error.status >= 500) {
    return L(
      "Gemini şu an meşgul ya da geçici bir sorun var. Biraz sonra 'Tekrar dene'ye bas.",
      "Gemini is busy or having a temporary problem. Press 'Try again' in a little while.",
    );
  }
  return L(`Gemini hatası (${error.status}): ${message.slice(0, 200)}`, `Gemini error (${error.status}): ${message.slice(0, 200)}`);
}
