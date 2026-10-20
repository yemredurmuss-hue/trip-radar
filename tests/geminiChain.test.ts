// 0.39.12 (2026-10-20: the free key's 20 requests a day ran out mid start chat): a model's daily quota used up moves on to
// the same key's other flash models at once (no 20 s wait), the spent one skipped for hours; all spent, Claude takes over
// when its key is there (Emre: "Claude otomatik devreye girsin").
import { ApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { withClaudeBackup } from "../src/lib/llm";
import { GEMINI_FALLBACKS, GeminiSpentError, geminiProvider, geminiSpent, onModels, resetSpentModels, type GeminiClient } from "../src/lib/llm/gemini";
import type { LlmProvider } from "../src/lib/llm/types";

const daily = (model: string) => new ApiError({ message: `Quota exceeded for metric: generate_content_free_tier_requests, quotaId GenerateRequestsPerDayPerProjectPerModel-FreeTier, model: ${model}`, status: 429 });
const ok = (text: string) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] }) as unknown as GenerateContentResponse;

function fake(answer: (model: string) => GenerateContentResponse | Error) {
  const models: string[] = [];
  const client: GeminiClient = {
    models: {
      generateContent: (async (p: GenerateContentParameters) => {
        models.push(p.model);
        const r = answer(p.model);
        if (r instanceof Error) throw r;
        return r;
      }) as GeminiClient["models"]["generateContent"],
    },
  };
  return { client, models };
}
const Schema = z.object({ a: z.number() });

beforeEach(() => resetSpentModels());

describe("the model chain", () => {
  it("the chosen model's day used up: the next flash model at once, and it's remembered", async () => {
    const { client, models } = fake((m) => (m === "gemini-3-flash-preview" ? daily(m) : ok('{"a":1}')));
    const g = geminiProvider(client, "gemini-3-flash-preview", 20_000);
    expect(await g.generateJson("s", "p", Schema)).toEqual({ a: 1 });
    expect(models).toEqual(["gemini-3-flash-preview", GEMINI_FALLBACKS[0]]);
    await g.generateJson("s", "p", Schema);
    expect(models.at(-1)).toBe(GEMINI_FALLBACKS[0]);
    expect(models.filter((m) => m === "gemini-3-flash-preview")).toHaveLength(1);
  });
  it("a fallback this key doesn't have (404) is skipped; the chosen model's own 404 is said as before", async () => {
    const gone = (m: string) => new ApiError({ message: `models/${m} is not found`, status: 404 });
    const { client, models } = fake((m) => (m === "gemini-3-flash-preview" ? daily(m) : m === GEMINI_FALLBACKS[0] ? gone(m) : ok('{"a":2}')));
    expect(await geminiProvider(client, "gemini-3-flash-preview", 0).generateJson("s", "p", Schema)).toEqual({ a: 2 });
    expect(models.slice(0, 3)).toEqual(["gemini-3-flash-preview", GEMINI_FALLBACKS[0], GEMINI_FALLBACKS[1]]);
    resetSpentModels();
    await expect(onModels("x-model", () => Promise.reject(gone("x-model")))).rejects.toBeInstanceOf(ApiError);
  });
  it("all spent: one error that says so, and geminiSpent tells", async () => {
    await expect(onModels("gemini-3-flash-preview", (m) => Promise.reject(daily(m)))).rejects.toBeInstanceOf(GeminiSpentError);
    expect(geminiSpent("gemini-3-flash-preview")).toBe(true);
  });
  it("a short rate limit (no daily quota) still waits once on the same model", async () => {
    let n = 0;
    const { client, models } = fake((m) => (n++ === 0 ? new ApiError({ message: "Too many requests", status: 429 }) : ok('{"a":3}')));
    expect(await geminiProvider(client, "gemini-3-flash-preview", 0).generateJson("s", "p", Schema)).toEqual({ a: 3 });
    expect(models).toEqual(["gemini-3-flash-preview", "gemini-3-flash-preview"]);
  });
});

describe("the Claude backup", () => {
  const claude: LlmProvider = { id: "anthropic", generateJson: async () => ({ a: 9 }) } as unknown as LlmProvider;
  it("Gemini spent: the same call goes on with Claude", async () => {
    const gemini = { id: "gemini", generateJson: () => Promise.reject(new GeminiSpentError()) } as unknown as LlmProvider;
    expect(await withClaudeBackup(gemini, () => claude).generateJson("s", "p", Schema)).toEqual({ a: 9 });
  });
  it("any other failure is Gemini's own; without a Claude key nothing changes", async () => {
    const gemini = { id: "gemini", generateJson: () => Promise.reject(new Error("bad key")) } as unknown as LlmProvider;
    await expect(withClaudeBackup(gemini, () => claude).generateJson("s", "p", Schema)).rejects.toThrow("bad key");
    expect(withClaudeBackup(gemini, null)).toBe(gemini);
  });
});
