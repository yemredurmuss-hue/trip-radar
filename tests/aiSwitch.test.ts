// T1 "Kota dolunca" (2026-10-20, F33–F34): when the chosen Gemini model's free requests for today are used up, the chain
// notes who answered instead (another flash model, Claude, or nobody) for the one line where saves land, and the line says it
// plainly. Fake 429s only: nothing here reaches Gemini or Claude.
import { ApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  modelName,
  nextQuotaReset,
  noteClaudeTakeover,
  noteGeminiFallback,
  noteGeminiSpent,
  setSwitchStore,
  switchShown,
  switchText,
  trWith,
  type AiSwitch,
  type SwitchStore,
} from "../src/lib/aiQuota";
import { setLang } from "../src/lib/i18n";
import { getProvider } from "../src/lib/llm";
import { GEMINI_FALLBACKS, GeminiSpentError, geminiProvider, onModels, resetSpentModels, type GeminiClient } from "../src/lib/llm/gemini";

const IST = "Europe/Istanbul";
const at = (iso: string) => Date.parse(iso);
const daily = (model: string) => new ApiError({ message: `Quota exceeded for metric: generate_content_free_tier_requests, quotaId GenerateRequestsPerDayPerProjectPerModel-FreeTier, model: ${model}`, status: 429 });

describe("the T1 line's words", () => {
  it("model names as said", () => {
    expect(modelName("gemini-3.8-flash")).toBe("Gemini 3.8 Flash");
    expect(modelName("gemini-3.5-flash-lite")).toBe("Gemini 3.5 Flash-Lite");
    expect(trWith("Gemini 3.8 Flash")).toBe("Gemini 3.8 Flash'la");
    expect(trWith("Gemini 3.5 Flash-Lite")).toBe("Gemini 3.5 Flash-Lite'la");
    expect(trWith("Gemini 3 Pro")).toBe("Gemini 3 Pro'yla");
  });
  const now = at("2026-10-20T12:00:00Z");
  const sw = (by: AiSwitch["by"], model: string): AiSwitch => ({ model, by, at: now, resetAt: nextQuotaReset(now) });

  it("a fallback model: neutral, says which and when the quota comes back", () => {
    const t = switchText(sw("gemini-fallback", "gemini-3.8-flash"), now, IST);
    expect([t.pill, t.text, t.reset, t.tone, t.addKey]).toEqual(["Model değişti", "Ücretsiz kotan dolduğu için Gemini 3.8 Flash'la devam ediyorum", "Kota yarın 10:00'da yenilenir", "warn", false]);
  });
  it("Claude took over: neutral, one sentence", () => {
    const t = switchText(sw("claude", "claude-sonnet-5-5"), now, IST);
    expect([t.text, t.reset, t.tone, t.addKey]).toEqual(["Gemini'nin bugünkü hakkı doldu, Claude'la devam ediyorum", null, "warn", false]);
  });
  it("nothing goes on: red, the time, and the way to a Claude key", () => {
    const t = switchText(sw("none", "gemini-3-flash-preview"), now, IST);
    expect([t.pill, t.text, t.reset, t.tone, t.addKey]).toEqual(["Kota doldu", "Gemini'nin bugünkü hakkı doldu", "Kota yarın 10:00'da yenilenir", "bad", true]);
  });
  it("in English", () => {
    setLang("en");
    try {
      expect(switchText(sw("gemini-fallback", "gemini-3.5-flash-lite"), now, IST).text).toBe("Your free quota ran out, so I'm going on with Gemini 3.5 Flash-Lite");
      expect(switchText(sw("none", "x"), now, IST).reset).toBe("Quota resets tomorrow at 10:00");
    } finally {
      setLang("tr");
    }
  });
  it("gone at the reset, or once closed", () => {
    const s = sw("gemini-fallback", "gemini-3.8-flash");
    expect(switchShown(s, now)).toBe(true);
    expect(switchShown(s, s.resetAt)).toBe(false);
    expect(switchShown({ ...s, dismissed: true }, now)).toBe(false);
    expect(switchShown(null, now)).toBe(false);
  });
});

/** chrome.storage.local's "aiSwitch" in memory, with every write counted. */
function memoryStore(claudeKey = false) {
  const state = { value: null as AiSwitch | null, writes: 0, claudeKey };
  const store: SwitchStore = {
    get: async () => state.value,
    set: async (v) => void ((state.value = v), state.writes++),
    hasClaudeKey: async () => state.claudeKey,
  };
  setSwitchStore(store);
  return state;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

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
const ok = (text: string) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] }) as unknown as GenerateContentResponse;
const Schema = z.object({ a: z.number() });

describe("who answered instead, noted for the line", () => {
  beforeEach(() => resetSpentModels());
  afterEach(() => {
    setSwitchStore(null);
    vi.unstubAllGlobals();
  });

  it("the chain answered with a fallback: noted once, with the reset after the chosen model was found spent", async () => {
    const state = memoryStore();
    const { client } = fake((m) => (m === "gemini-3-flash-preview" ? daily(m) : ok('{"a":1}')));
    const g = geminiProvider(client, "gemini-3-flash-preview", 0);
    const before = Date.now();
    await g.generateJson("s", "p", Schema);
    await g.generateJson("s", "p", Schema);
    await flush();
    expect(state.value).toMatchObject({ by: "gemini-fallback", model: GEMINI_FALLBACKS[0] });
    expect(state.value!.resetAt).toBe(nextQuotaReset(before));
    expect(state.writes).toBe(1); // the second answer, the same way: nothing written
  });

  it("the chosen model answering itself notes nothing", async () => {
    const state = memoryStore();
    const { client } = fake(() => ok('{"a":1}'));
    await geminiProvider(client, "gemini-3-flash-preview", 0).generateJson("s", "p", Schema);
    await flush();
    expect(state.value).toBeNull();
  });

  it("every model spent: red without a Claude key; with one, Claude says so itself", async () => {
    const state = memoryStore(false);
    await expect(onModels("gemini-3-flash-preview", (m) => Promise.reject(daily(m)))).rejects.toBeInstanceOf(GeminiSpentError);
    await flush();
    expect(state.value).toMatchObject({ by: "none", model: "gemini-3-flash-preview" });

    resetSpentModels();
    const keyed = memoryStore(true);
    await expect(onModels("gemini-3-flash-preview", (m) => Promise.reject(daily(m)))).rejects.toBeInstanceOf(GeminiSpentError);
    await flush();
    expect(keyed.value).toBeNull();
  });

  it("Claude takes over when every Gemini model is spent and its key is there (llm/index.ts)", async () => {
    const state = memoryStore(true);
    const settings = { provider: "gemini", geminiKey: "test-gemini", apiKey: "test-claude", model: "claude-sonnet-5-5", geminiModel: "gemini-3-flash-preview" };
    vi.stubGlobal("chrome", { storage: { local: { get: async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, settings[k as keyof typeof settings]])) } } });
    await expect(onModels("gemini-3-flash-preview", (m) => Promise.reject(daily(m)))).rejects.toBeInstanceOf(GeminiSpentError);
    const provider = await getProvider();
    expect(provider.id).toBe("anthropic"); // made, never called: no request leaves
    await flush();
    expect(state.value).toMatchObject({ by: "claude", model: "claude-sonnet-5-5" });
  });

  it("the same switch again keeps its ×; the next fallback model of the day keeps it too; a new kind shows again", async () => {
    const state = memoryStore();
    const now = at("2026-10-20T12:00:00Z");
    noteGeminiFallback("gemini-3.8-flash", now - 60_000, now);
    await flush();
    state.value = { ...state.value!, dismissed: true };
    setSwitchStore({ get: async () => state.value, set: async (v) => void ((state.value = v), state.writes++), hasClaudeKey: async () => false }); // another page
    noteGeminiFallback("gemini-3.8-flash", now - 60_000, now + 1000);
    await flush();
    expect(state.value!.dismissed).toBe(true);
    noteGeminiFallback("gemini-3.5-flash", now - 60_000, now + 2000);
    await flush();
    expect(state.value).toMatchObject({ model: "gemini-3.5-flash", dismissed: true });
    noteGeminiSpent("gemini-3-flash-preview", now + 3000);
    await flush();
    expect(state.value).toMatchObject({ by: "none" });
    expect(state.value!.dismissed).toBeUndefined();
    noteClaudeTakeover("claude-sonnet-5-5", now + 4000);
    await flush();
    expect(state.value).toMatchObject({ by: "claude" });
  });

  it("a fallback answering after the quota already came back (the chain still skips the model for its own hours) says nothing", async () => {
    const state = memoryStore();
    // Spent at 09:00 in Istanbul (23:00 in LA), answered by a fallback at 11:00: the requests came back at 10:00.
    noteGeminiFallback("gemini-3.8-flash", at("2026-10-21T06:00:00Z"), at("2026-10-21T08:00:00Z"));
    await flush();
    expect(state.value).toBeNull();
  });
});

describe("Claude goes on when Gemini says no for now (2026-10-25, 'kota dolunca Sonnet çalışsın')", () => {
  it("any 429 (not only one that says 'per day'), the gate's 402, a 5xx: the call goes on with Claude", async () => {
    const { withClaudeBackup } = await import("../src/lib/llm");
    const { isGeminiLimit } = await import("../src/lib/llm/gemini");
    const schema = z.object({ ok: z.boolean() });
    for (const status of [429, 402, 503]) {
      const err = new ApiError({ message: "You exceeded your current quota, please check your plan and billing details.", status });
      expect(isGeminiLimit(err)).toBe(true);
      const gemini = { generateJson: async () => { throw err; } } as never;
      const claude = () => ({ generateJson: async () => ({ ok: true }) }) as never;
      const both = withClaudeBackup(gemini, claude);
      expect(await both.generateJson("s", "p", schema)).toEqual({ ok: true });
    }
  });
  it("a bad request is not a limit: no Claude for it", async () => {
    const { isGeminiLimit } = await import("../src/lib/llm/gemini");
    expect(isGeminiLimit(new ApiError({ message: "bad", status: 400 }))).toBe(false);
  });
});
