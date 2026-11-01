// tests/strictRoom.test.ts: the API's grammar limit is counted more strictly than schemaBudget's estimate (Tur 22d: the chat's
// tools had grown past it, every turn's first request came back 400). Too large: half as many strict tools, and the next
// requests start from what fitted, never paying the 400 again.
import Anthropic from "@anthropic-ai/sdk";
import { expect, it } from "vitest";
import { anthropicProvider } from "../src/lib/llm/anthropic";

const tool = (name: string) => ({ name, description: name, schema: { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false } });

it("too large: half the strict tools, remembered for the next request", async () => {
  const sent: number[] = [];
  const client = {
    messages: {
      create: async (p: Anthropic.MessageCreateParams) => {
        const strict = (p.tools ?? []).filter((t) => (t as { strict?: boolean }).strict).length;
        sent.push(strict);
        if (strict > 4) throw new Anthropic.BadRequestError(400, { error: { message: "The compiled grammar is too large" } }, "The compiled grammar is too large, which would cause performance issues.", new Headers());
        return { content: [{ type: "text", text: "ok", citations: null }], stop_reason: "end_turn" } as unknown as Anthropic.Message;
      },
    },
  } as unknown as Anthropic;
  const llm = anthropicProvider(client, "claude-sonnet-5-5");
  const tools = Array.from({ length: 8 }, (_, i) => tool(`t${i}`));
  await llm.chatStep([{ role: "user", content: "hi" }] as never, "s", tools as never);
  await llm.chatStep([{ role: "user", content: "hi" }] as never, "s", tools as never);
  expect(sent).toEqual([8, 4, 4]);
});
