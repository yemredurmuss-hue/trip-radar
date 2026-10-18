// Claude refuses a request whose strict schemas compile past its grammar limit (400 "The compiled grammar is too
// large"), counted more strictly than schemaBudget's estimate: the start chat's reading with the playbook and the
// board chat's tools both hit it (2026-10-09). The reading then asks by instruction, the chat with no strict tool.
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { anthropicProvider } from "../src/lib/llm/anthropic";

const tooLarge = () =>
  new Anthropic.BadRequestError(
    400,
    { type: "error", error: { type: "invalid_request_error", message: "The compiled grammar is too large, which would cause performance issues." } },
    "400 The compiled grammar is too large, which would cause performance issues.",
    new Headers(),
  );

describe("Claude past its grammar limit", () => {
  it("a structured answer is asked again by instruction", async () => {
    const created: any[] = [];
    const client = {
      messages: {
        parse: async () => {
          throw tooLarge();
        },
        create: async (params: any) => {
          created.push(params);
          return { stop_reason: "end_turn", content: [{ type: "text", text: '{"city":"Lizbon"}' }] };
        },
      },
    } as unknown as Anthropic;
    const out = await anthropicProvider(client, "claude-sonnet-5-5").generateJson("sys", "Lizbon'a gideceğim", z.object({ city: z.string() }));
    expect(out).toEqual({ city: "Lizbon" });
    expect(created).toHaveLength(1);
    expect(created[0].output_config?.format).toBeUndefined();
  });

  it("the chat is asked again with no strict tool", async () => {
    const created: any[] = [];
    const client = {
      messages: {
        create: async (params: any) => {
          created.push(params);
          if (created.length === 1) throw tooLarge();
          return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "plan_item", input: {} }] };
        },
      },
    } as unknown as Anthropic;
    const tool = { name: "plan_item", description: "d", schema: { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false } };
    const step = await anthropicProvider(client, "claude-sonnet-5-5").chatStep([], "sys", [tool]);
    expect(step?.calls.map((c) => c.name)).toEqual(["plan_item"]);
    expect(created).toHaveLength(2);
    expect(created[0].tools[0].strict).toBe(true);
    expect(created[1].tools[0].strict).toBeUndefined();
  });

  it("any other error is not retried", async () => {
    let n = 0;
    const client = {
      messages: {
        create: async () => {
          n++;
          throw new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: "bad" } }, "400 bad", new Headers());
        },
      },
    } as unknown as Anthropic;
    await expect(anthropicProvider(client, "claude-sonnet-5-5").chatStep([], "sys", [])).rejects.toThrow("bad");
    expect(n).toBe(1);
  });
});
