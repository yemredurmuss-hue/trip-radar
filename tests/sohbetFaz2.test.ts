// Sohbet Faz 2 (2026-10-24, docs/arastirma/2026-10-24-sohbet-ajan-plani.md): every message carries <recent>, the files
// just sent and what each became, and the records the last answer changed, so the next message's "this", "its price",
// "delete it" go to the right record. Emre: "önce ekran görüntüsü atıp sonra onun hakkında bir şey söylediğimde benimle
// iletişim kurabilmeli", "art ardına gönderdiğim mesajlar farklı farklı tepkiler vererek değil".
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { focusOf, recentBlock, RECENT_MS } from "../src/lib/chatContext";
import { db, listMessages } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { plannedInput, plannedItem } from "../src/lib/planned";
import type { Capture, Trip } from "../src/lib/types";

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
const said = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] }) as Partial<Anthropic.Message>;
/** The <recent> block of the last user message a model call got. */
const recentOf = (call: Anthropic.MessageCreateParams): any => {
  const last = call.messages.at(-1)!;
  const text = (Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }]).map((b: any) => b.text ?? "").join("\n");
  const m = text.match(/<recent>([\s\S]*?)<\/recent>/);
  return m ? JSON.parse(m[1]) : null;
};
const trip = (id: string): Trip => ({ id, title: "Portekiz", confirmedDates: { start: "2026-10-07", end: "2026-10-21" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 });

describe("recentBlock", () => {
  it("the files newest first, an old one out, the focus records by id; nothing to say, nothing sent", () => {
    const now = 10 * RECENT_MS;
    const uber = plannedItem(plannedInput({ kind: "taxi", title: "Uber Yolculukları", city: "Tüm gezi" }), "t", "uber", 1);
    const block = JSON.parse(recentBlock([
      { file: "eski.pdf", at: now - RECENT_MS - 1, became: null },
      { file: "bilet.pdf", at: now - 60_000, became: null, doc: "ticket" },
      { file: "ekran görüntüsü", at: now - 1000, became: null },
    ], [uber], now)!);
    expect(block.files.map((f: { file: string }) => f.file)).toEqual(["ekran görüntüsü", "bilet.pdf"]);
    expect(block.focus.map((l: { id: string; name: string }) => [l.id, l.name])).toEqual([["uber", "Uber Yolculukları"]]);
    expect(recentBlock([], [], now)).toBeNull();
    expect(focusOf(["uber", "gone"], [uber]).map((i) => i.id)).toEqual(["uber"]);
  });
});

describe("<recent> with every message", () => {
  it("what the last answer changed is the next message's focus: 'onu sil' points at it", async () => {
    await (await db()).put("trips", trip("f1"));
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "p1", name: "plan_item", caller: { type: "direct" }, input: { kind: "taxi", title: "Uber Yolculukları", date: null, end_date: null, time: null, from: null, to: null, city: "Tüm gezi", booked: false, note: null, replaces: null, item_id: null } }] as Anthropic.ContentBlock[],
      },
      said("Uber Yolculukları tüm gezi için Ulaşım'da."),
      said("Hangisini kaldırayım?"),
    ]);
    await sendMessage("f1", "genel uber yolculukları koy", anthropicProvider(client, "claude-opus-5"));
    const answer = (await listMessages("f1")).findLast((m) => m.role === "assistant" && m.text.trim())!;
    expect(answer.touched?.length).toBe(1);
    await sendMessage("f1", "onu sil", anthropicProvider(client, "claude-opus-5"));
    const recent = recentOf(calls[2]);
    expect(recent.focus.map((l: { id: string; name: string; kind: string }) => [l.id, l.name, l.kind])).toEqual([[answer.touched![0], "Uber Yolculukları", "taxi"]]);
  });

  it("a screenshot read into a record is the newest file the next message is about", async () => {
    const d = await db();
    await d.put("trips", trip("f2"));
    const now = Date.now();
    const capture = { id: "c1", kind: "image", url: null, title: null, pageText: "", viewportText: "", selection: "", jsonLd: [], meta: {}, screenshot: "data:image/jpeg;base64,AAAA", capturedAt: now - 30_000, status: "done", error: null, itemId: "shot", fromTripId: "f2" } as Capture;
    await d.put("captures", capture);
    const stay = { ...plannedItem(plannedInput({ kind: "stay", title: "Bonfim Konaklaması", city: "Porto", date: "2026-10-07", end_date: "2026-10-11" }), "f2", "shot", now - 20_000), origin: undefined, captureIds: ["c1"], status: "booked" as const, createdAt: now - 20_000 };
    await d.put("items", stay);
    const { client, calls } = fakeClient([said("Bonfim'in fiyatını bekliyorum.")]);
    await sendMessage("f2", "bunun fiyatı 420 euro", anthropicProvider(client, "claude-opus-5"));
    const recent = recentOf(calls[0]);
    expect(recent.files[0]).toMatchObject({ file: "ekran görüntüsü", became: { id: "shot", name: "Bonfim Konaklaması", kind: "stay" } });
  });
});
