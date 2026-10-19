// 0.39.4 (Emre: "kategoriye basmadan AI çalışsın"; the board fired its model calls all at once, a free Gemini key's 429):
// one line for every model call, at most two at a time: what's waited on, then the suggestions review, then the Bavul's list
// asked ahead, then the board's other AI jobs; the Bavul pulled to the front when Hazırlık opens. A 429's own retry waits inside its turn, as before.
import { ApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { geminiProvider, type GeminiClient } from "../src/lib/llm/gemini";
import { AI_PARALLEL, aiLine, promoteAi, queueAi, queuedProvider } from "../src/lib/llm/queue";

/** A call that ends when told: its name in `order` when it starts. */
function gate(order: string[], name: string) {
  let done!: (v: string) => void;
  const p = new Promise<string>((r) => (done = r));
  return { call: () => (order.push(name), p), end: () => done(name) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("the model's line", () => {
  it("runs at most two at a time; then what's waited on, the review, the Bavul made ahead, the rest, each in the order asked", async () => {
    const order: string[] = [];
    const [a, b, soon, bg, review, now] = ["a", "b", "soon", "bg", "review", "now"].map((n) => gate(order, n));
    const runs = [queueAi(a.call), queueAi(b.call), queueAi(soon.call), queueAi(bg.call, { priority: "ahead" }), queueAi(review.call, { priority: "review" }), queueAi(now.call, { priority: "now" })];
    await tick();
    expect(AI_PARALLEL).toBe(2);
    expect(order).toEqual(["a", "b"]);
    expect(aiLine()).toMatchObject({ running: 2, waiting: 4 });
    a.end();
    await tick();
    expect(order).toEqual(["a", "b", "now"]);
    b.end();
    await tick();
    expect(order).toEqual(["a", "b", "now", "review"]);
    now.end();
    await tick();
    expect(order).toEqual(["a", "b", "now", "review", "bg"]);
    review.end();
    await tick();
    expect(order.at(-1)).toBe("soon");
    bg.end();
    soon.end();
    expect(await Promise.all(runs)).toEqual(["a", "b", "soon", "bg", "review", "now"]);
    expect(aiLine()).toMatchObject({ running: 0, waiting: 0 });
  });
  it("a call asked ahead goes first once its category opens", async () => {
    const order: string[] = [];
    const [a, b, other, pack] = ["a", "b", "other", "pack"].map((n) => gate(order, n));
    const runs = [queueAi(a.call), queueAi(b.call), queueAi(pack.call, { priority: "ahead", key: "pack:t1:tr" }), queueAi(other.call, { priority: "review" })];
    await tick();
    expect(aiLine().keys).toEqual([undefined, "pack:t1:tr"]);
    expect(promoteAi("pack:t1:tr")).toBe(true);
    expect(aiLine().keys).toEqual(["pack:t1:tr", undefined]);
    expect(promoteAi("pack:none")).toBe(false);
    a.end();
    await tick();
    expect(order).toEqual(["a", "b", "pack"]);
    for (const g of [b, other, pack]) g.end();
    await tick();
    other.end();
    await Promise.all(runs);
  });
  it("an error comes back as it was, and frees its place", async () => {
    await expect(queueAi(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(queueAi(() => { throw new Error("sync"); })).rejects.toThrow("sync");
    expect(aiLine()).toMatchObject({ running: 0, waiting: 0 });
  });
  it("a provider's calls go through it; a 429 is still retried once inside its turn", async () => {
    const calls: GenerateContentParameters[] = [];
    const answers: (Error | Partial<GenerateContentResponse>)[] = [
      new ApiError({ message: "quota", status: 429 }),
      { candidates: [{ content: { role: "model", parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" }] } as unknown as Partial<GenerateContentResponse>,
    ];
    const client: GeminiClient = {
      models: {
        generateContent: (async (p: GenerateContentParameters) => {
          calls.push(p);
          const next = answers.shift()!;
          if (next instanceof Error) throw next;
          return next;
        }) as GeminiClient["models"]["generateContent"],
      },
    };
    const llm = queuedProvider(geminiProvider(client, "gemini-test", 0), { priority: "ahead" });
    expect(llm.id).toBe("gemini");
    expect(await llm.generateJson("s", "p", z.object({ ok: z.boolean() }))).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(llm.userContent(["x"])).toBeTruthy();
  });
});
