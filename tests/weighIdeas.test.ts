// tests/weighIdeas.test.ts: ideas from elsewhere (omurga Tur 19, step 3): the chat weighs a blog's ideas with weigh_ideas;
// the takes are tried, never put on the plan before "Uygula"; the pool lands in Suggestions with its source; what the takes
// would do is counted (three on one day: a day too full).
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { expect, it } from "vitest";
import { sendMessage, systemPrompt } from "../src/lib/assistant";
import { db, listItems, listMessages } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import type { Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

function fakeClient(responses: Partial<Anthropic.Message>[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams) => {
        calls.push(structuredClone(params));
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        return next;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const call = (id: string, name: string, input: unknown): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input, caller: { type: "direct" } }] as Anthropic.ContentBlock[],
});
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const resultOf = (c: Anthropic.MessageCreateParams) => (c.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
const act = (title: string, date: string) => ({ kind: "activity", title, city: "Ubud", date, end_date: "", why: "balayı temposu, boş gün" });

it("a blog's ideas: three proposed for one day are counted too full, two left in Suggestions with their source, nothing on the plan yet", async () => {
  const d = await db();
  const trip: Trip = { id: "wi", title: "Bali Balayı", confirmedDates: { start: "2026-12-10", end: "2026-12-17" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  await d.put("trips", trip);
  await d.put("items", makeItem({ id: "wi-stay", tripId: "wi", category: "stay", name: "Ubud Villa", city: "Ubud", countryCode: "ID", needKey: "stay:ubud", status: "chosen", dates: { start: "2026-12-10", end: "2026-12-17", source: "page" } }));
  const weigh = {
    source: "blog",
    take: [act("Tegallalang pirinç tarlaları", "2026-12-12"), act("Maymun ormanı", "2026-12-12"), act("Ubud sarayı", "2026-12-12")],
    pool: [
      { section: "activity", title: "Campuhan sırt yürüyüşü", city: "Ubud", why: "sabah serinliğinde güzel" },
      { section: "food", title: "Locavore", city: "Ubud", why: "özel akşam yemeği" },
    ],
    skip: [{ title: "Mount Batur gün doğumu", why: "gece 2'de kalkış, balayı temposuna uymuyor" }],
    moves: [],
  };
  const { client, calls } = fakeClient([call("tu1", "weigh_ideas", weigh), done("Blogdan 6 fikir çıktı…")]);
  await sendMessage("wi", "Bu blog yazısındakilere göre Ubud günlerini planla: …", anthropicProvider(client, "claude-opus-5"));

  expect((calls[0].tools as Anthropic.Tool[]).find((t) => t.name === "weigh_ideas")!.strict).toBe(true);
  const result = JSON.parse(String(resultOf(calls[1]).content));
  expect(result).toMatchObject({ on_plan_yet: false, pooled: 2, nothing_changes: false });
  expect(result.effects.full_days).toEqual(["12 Aralık"]);
  // The card the code writes from the decision, before the model's words, with its taps.
  const reply = (await listMessages("wi")).filter((m) => m.role === "assistant").at(-1)!;
  expect(reply.text).toContain("**Plana koyduklarım** (henüz eklemedim):\n- Tegallalang pirinç tarlaları (Ubud, 12 Aralık): balayı temposu, boş gün");
  expect(reply.text).toContain("**Almadıklarım:**\n- Mount Batur gün doğumu: gece 2'de kalkış, balayı temposuna uymuyor\nKalan 2 fikir Öneriler'de duruyor.");
  expect(reply.text).toContain("**Dikkat:**\n- 12 Aralık çok doluyor (3 ya da daha fazla plan)");
  expect(reply.text.endsWith("Blogdan 6 fikir çıktı…")).toBe(true);
  expect(reply.choices).toEqual(["Uygula", "Vazgeç"]);
  // Nothing on the plan before "Uygula".
  expect((await listItems("wi")).map((i) => i.id)).toEqual(["wi-stay"]);
  // The pool is in Suggestions, its source said.
  const after = (await d.get("trips", "wi"))!;
  expect(after.suggestions?.map((s) => [s.title, s.why])).toEqual(
    expect.arrayContaining([
      ["Campuhan sırt yürüyüşü", "Kaynak: blog: sabah serinliğinde güzel"],
      ["Locavore", "Kaynak: blog: özel akşam yemeği"],
    ]),
  );
});

it("the chat is told to take charge of ideas from elsewhere and ask before applying", () => {
  const p = systemPrompt();
  for (const said of ["Kullanıcı dışarıdan bir fikir getirirse", "weigh_ideas", "Karar kartını", "15 öneriyle 10 günü doldurma"]) expect(p).toContain(said);
});
