// A Claude key tried before it's kept (Settings, 2026-10-25, Emre: "Sonnet seçtiğimde çalışıp çalışmadığını nasıl anlayacağım?").
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { checkClaudeKey, describeAnthropicError } from "../src/lib/llm/anthropic";

const client = (retrieve: (id: string) => Promise<unknown>) => ({ models: { retrieve } }) as unknown as Pick<Anthropic, "models">;

describe("checkClaudeKey", () => {
  it("asks for the chosen model's own page and gives back its name", async () => {
    let asked = "";
    const name = await checkClaudeKey("sk-ant-x", "claude-sonnet-5-5", client(async (id) => ((asked = id), { id, display_name: "Claude Sonnet 5.5" })));
    expect(asked).toBe("claude-sonnet-5-5");
    expect(name).toBe("Claude Sonnet 5.5");
  });
  it("no display name: the model's id", async () => {
    expect(await checkClaudeKey("sk-ant-x", "claude-haiku-5-5", client(async (id) => ({ id })))).toBe("claude-haiku-5-5");
  });
  it("a wrong key throws, and the error reads as a wrong key", async () => {
    const wrong = new Anthropic.AuthenticationError(401, { error: { message: "invalid x-api-key" } }, "invalid x-api-key", new Headers());
    const error = await checkClaudeKey("sk-ant-bad", "claude-sonnet-5-5", client(async () => Promise.reject(wrong))).catch((e) => e);
    expect(describeAnthropicError(error)).toMatch(/geçersiz|isn't valid/);
  });
});
