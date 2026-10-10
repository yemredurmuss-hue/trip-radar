// Claude provider (paid). Personal build: the key lives only in this browser's extension storage.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildPrompt, extractionSchema, extractionSystem, imagePart, today } from "../extract";
import { L } from "../i18n";
import type { ZodType } from "zod";
import type { ChatMessage } from "../types";
import { fitsStrict, schemaLoad, strictTools } from "./schemaBudget";
import type { CallOptions, ChatStep, LlmProvider, ToolResult, ToolSpec } from "./types";

/** Haiku 4.5 rejects the effort parameter; the other offered models accept it. */
function outputEffort(model: string, effort: "low" | "medium") {
  return model.startsWith("claude-haiku") ? {} : { effort };
}

export function anthropicProvider(client: Anthropic, model: string): LlmProvider {
  return {
    id: "anthropic",

    async extract(capture, facts, trips) {
      const content: Anthropic.ContentBlockParam[] = [];
      if (capture.screenshot) {
        const { mediaType, data } = imagePart(capture.screenshot);
        content.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
      }
      content.push({ type: "text", text: buildPrompt(capture, facts, trips, today()) });

      return structured(client, model, extractionSystem(), content, extractionSchema(), "low", L("Model bu sayfayı işlemeyi reddetti.", "The model declined to process this page."));
    },

    async generateJson(system, prompt, schema, files = [], opts = {}) {
      const content: Anthropic.ContentBlockParam[] = [
        ...files.map((f): Anthropic.ContentBlockParam =>
          f.mimeType === "application/pdf"
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
            : { type: "image", source: { type: "base64", media_type: f.mimeType, data: f.data } },
        ),
        { type: "text", text: prompt },
      ];
      return structured(client, model, system, content, schema, "medium", L("Model bu analizi yapmayı reddetti.", "The model declined to do this analysis."), opts);
    },

    async chatStep(history: ChatMessage[], system: string, tools: ToolSpec[], opts: CallOptions = {}): Promise<ChatStep | null> {
      const effort = outputEffort(model, "medium");
      const strictAll = strictTools(tools.map((t) => t.schema));
      const ask = (strict: boolean[]) => client.messages.create({
        model,
        max_tokens: 16000,
        system,
        tools: tools.map((t, i) => ({
          name: t.name,
          description: t.description,
          ...(strict[i] ? { strict: true } : {}),
          input_schema: t.schema as Anthropic.Tool.InputSchema,
        })),
        messages: history.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
        cache_control: { type: "ephemeral" },
        ...("effort" in effort ? { output_config: effort } : {}),
      }, opts.signal ? { signal: opts.signal } : undefined);
      // Past the API's grammar limit (counted more strictly than schemaBudget's estimate): asked again with no strict tool.
      const response = await ask(strictAll).catch((error) => {
        if (tooLarge(error)) return ask(strictAll.map(() => false));
        throw error;
      });
      // An empty assistant turn would make every later request invalid, so it is never stored.
      if (response.content.length === 0) return null;
      return {
        content: response.content,
        text: response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim(),
        calls: response.content
          .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
          .map((b) => ({ id: b.id, name: b.name, input: b.input })),
        refused: response.stop_reason === "refusal",
      };
    },

    userContent: (texts) => texts.map((text) => ({ type: "text", text })),

    assistantContent: (text) => [{ type: "text", text }],

    toolResultContent: (results: ToolResult[]) =>
      results.map(
        (r): Anthropic.ToolResultBlockParam => ({
          type: "tool_result",
          tool_use_id: r.call.id,
          content: r.content,
          ...(r.isError ? { is_error: true } : {}),
        }),
      ),
  };
}

/** The JSON object in a reply, without a code fence or surrounding words. */
export function jsonText(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text.trim();
}

/**
 * One call whose answer must match the schema. Small schemas use constrained decoding; a schema past
 * the strict limits (the page extraction has dozens of nullable fields) is asked for by instruction
 * and validated here, with one retry that shows the model what was wrong.
 */
const tooLarge = (error: unknown) => error instanceof Anthropic.BadRequestError && /grammar is too large|too complex/i.test(String(error.message));

async function structured<T>(
  client: Anthropic,
  model: string,
  system: string,
  content: Anthropic.ContentBlockParam[],
  schema: ZodType<T>,
  effort: "low" | "medium",
  refusal: string,
  opts: CallOptions = {},
): Promise<T> {
  // The SDK's own request options: an abort, and how many retries (its default when unset).
  const request = { ...(opts.signal ? { signal: opts.signal } : {}), ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}) };
  const format = zodOutputFormat(schema as any);
  if (fitsStrict(schemaLoad(format.schema))) {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content }],
      output_config: { format, ...outputEffort(model, effort) },
    }, request).catch((error) => {
      if (tooLarge(error)) return null;
      throw error;
    });
    if (response) {
      if (response.stop_reason === "refusal") throw new Error(refusal);
      if (!response.parsed_output) throw new Error(L("Model geçerli bir yanıt döndürmedi.", "The model didn't return a valid answer."));
      return response.parsed_output as T;
    }
  }

  const instruction =
    L(
      "Yanıtın yalnız şu JSON şemasına uyan tek bir JSON nesnesi olsun; başka metin ya da kod bloğu yazma. Bilinmeyen alanlara null ver.\n",
      "Answer with a single JSON object matching this JSON schema and nothing else: no other text, no code block. Use null for unknown fields.\n",
    ) + JSON.stringify(format.schema);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: [...content, { type: "text", text: instruction }] }];
  const outputConfig = outputEffort(model, effort);
  for (let attempt = 0; ; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages,
      ...("effort" in outputConfig ? { output_config: outputConfig } : {}),
    }, request);
    if (response.stop_reason === "refusal") throw new Error(refusal);
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    try {
      return format.parse(jsonText(text)) as T;
    } catch (error) {
      if (attempt >= 1 || response.stop_reason === "max_tokens") {
        throw new Error(L("Model geçerli bir yanıt döndürmedi.", "The model didn't return a valid answer."));
      }
      messages.push(
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: L(
            `Bu yanıt şemaya uymadı: ${error instanceof Error ? error.message.slice(0, 600) : String(error)}\nYalnız düzeltilmiş JSON nesnesini ver.`,
            `That answer didn't match the schema: ${error instanceof Error ? error.message.slice(0, 600) : String(error)}\nGive only the corrected JSON object.`,
          ),
        },
      );
    }
  }
}

export function describeAnthropicError(error: unknown): string | null {
  if (error instanceof Anthropic.AuthenticationError) {
    return L("Claude API anahtarı geçersiz. Ayarlardan kontrol et.", "The Claude API key isn't valid. Check it in Settings.");
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return L("Bu Claude API anahtarının bu modele erişimi yok.", "This Claude API key has no access to this model.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return L("Claude hız sınırına takıldı; birazdan tekrar dene.", "Claude hit its rate limit; try again in a moment.");
  }
  if (error instanceof Anthropic.BadRequestError) return L(`Claude isteği reddetti: ${error.message}`, `Claude rejected the request: ${error.message}`);
  if (error instanceof Anthropic.APIConnectionError) {
    return L("Claude API'ye bağlanılamadı. İnternetini kontrol et.", "Couldn't reach the Claude API. Check your internet connection.");
  }
  if (error instanceof Anthropic.APIError) return L(`Claude API hatası (${error.status}): ${error.message}`, `Claude API error (${error.status}): ${error.message}`);
  return null;
}
