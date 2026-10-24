// Sohbet Faz 1 (2026-10-24, docs/arastirma/2026-10-24-sohbet-ajan-plani.md): the model reads back what each tool really
// did to the board (board_after) and puts right what is still wrong before it answers; what it wrote beside its tool
// calls ("Uber yolculuklarını ekledim", before anything was added) is never on screen; the answer after the results is.
// Emre's case: "Uber yolculuklarını koy" → "Havalimanı → Bonfim" stayed beside it.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { boardChange, withBoardChange } from "../src/lib/boardChange";
import { db, listItems, listMessages } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { plannedInput, plannedItem } from "../src/lib/planned";
import type { Trip } from "../src/lib/types";

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

const airport = () => plannedItem(plannedInput({ kind: "taxi", from: "Havalimanı", to: "Bonfim", city: "Porto", date: "2026-10-07", time: "15:00" }), "t9", "airport", 1);
const uber = () => plannedItem(plannedInput({ kind: "taxi", title: "Uber Yolculukları" }), "t9", "uber", 2);

describe("boardChange: what a tool really did", () => {
  it("added, changed and taken off, with what is on that part of the plan now", () => {
    const a = airport();
    const change = boardChange([a], [a, uber()])!;
    expect(change.added.map((l) => [l.name, l.kind, l.date, l.road])).toEqual([["Uber Yolculukları", "taxi", null, null]]);
    expect(change.now.map((l) => l.id)).toEqual(["airport", "uber"]);
    expect(boardChange([a, uber()], [uber()])!.removed.map((l) => l.road)).toEqual(["Havalimanı → Bonfim"]);
    expect(boardChange([a], [{ ...a, status: "dismissed" }])!.removed.map((l) => l.id)).toEqual(["airport"]);
    expect(boardChange([a], [{ ...a, name: "Uber" }])!.changed.map((l) => l.name)).toEqual(["Uber"]);
    expect(boardChange([a], [a])).toBeNull();
  });
  it("in the tool's own JSON when it is one; after a sentence otherwise", () => {
    const change = boardChange([], [uber()])!;
    expect(JSON.parse(withBoardChange('{"added":"Uber Yolculukları"}', change))).toMatchObject({ added: "Uber Yolculukları", board_after: { added: [{ id: "uber" }] } });
    expect(withBoardChange("Tamam", change)).toMatch(/^Tamam\n\{"board_after"/);
  });
});

describe("a turn: the board read back, the answer after it", () => {
  it("the model sees the airport taxi still there, takes it off, and only its last words are shown", async () => {
    const d = await db();
    const trip: Trip = { id: "t9", title: "Portekiz", confirmedDates: { start: "2026-10-07", end: "2026-10-21" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    await d.put("trips", trip);
    await d.put("items", airport());
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Uber yolculuklarını ekledim.", citations: null },
          { type: "tool_use", id: "p1", name: "plan_item", caller: { type: "direct" }, input: { kind: "taxi", title: "Uber Yolculukları", date: null, end_date: null, time: null, from: "Tüm gezi", to: "Tüm gezi", city: null, booked: false, note: null, replaces: null, item_id: null } },
        ] as Anthropic.ContentBlock[],
      },
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "r1", name: "remove_from_plan", caller: { type: "direct" }, input: { target_id: "airport" } }] as Anthropic.ContentBlock[],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Uber Yolculukları tüm gezi için Ulaşım'da; havalimanı taksisini kaldırdım.", citations: null }] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("t9", "havalimanı olanı sil, genel uber yolculukları koy", anthropicProvider(client, "claude-opus-5"));

    // The first tool's result carried the board as it was after it: the airport taxi still in `now`.
    const [first] = calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    const seen = JSON.parse(String(first.content));
    expect(seen.board_after.added.map((l: { name: string }) => l.name)).toEqual(["Uber Yolculukları"]);
    expect(seen.board_after.now.map((l: { id: string }) => l.id)).toContain("airport");
    expect(seen.board_after.added[0]).toMatchObject({ road: null, date: null });

    // The board: one general Uber line, the airport taxi off the plan.
    const live = (await listItems("t9")).filter((i) => i.status !== "dismissed");
    expect(live.filter((i) => i.plannedKind === "taxi").map((i) => i.name)).toEqual(["Uber Yolculukları"]);

    // On screen: only the answer after the results, never "ekledim" written before anything was added.
    const shown = (await listMessages("t9")).filter((m) => m.role === "assistant" && m.text.trim()).map((m) => m.text);
    expect(shown).toEqual(["Uber Yolculukları tüm gezi için Ulaşım'da; havalimanı taksisini kaldırdım."]);
  });

  it("a last step with nothing to say shows what the model wrote beside its tools, not an empty reply", async () => {
    const d = await db();
    await d.put("trips", { id: "t8", title: "X", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 } as Trip);
    const { client } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Uber Yolculukları'nı tüm gezi için ekliyorum.", citations: null },
          { type: "tool_use", id: "p1", name: "plan_item", caller: { type: "direct" }, input: { kind: "taxi", title: "Uber Yolculukları", date: null, end_date: null, time: null, from: null, to: null, city: null, booked: false, note: null, replaces: null, item_id: null } },
        ] as Anthropic.ContentBlock[],
      },
      { stop_reason: "end_turn", content: [] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("t8", "genel uber yolculukları koy", anthropicProvider(client, "claude-opus-5"));
    const shown = (await listMessages("t8")).filter((m) => m.role === "assistant" && m.text.trim()).map((m) => m.text);
    expect(shown).toEqual(["Uber Yolculukları'nı tüm gezi için ekliyorum."]);
  });
});

describe("the code's own line when the model writes nothing (Sohbet Faz 4, the real-model eval's fado case)", () => {
  it("summaryLine: what was added, updated and removed, by name; null when nothing changed", async () => {
    const { summaryLine } = await import("../src/lib/boardChange");
    const a = airport();
    const added = boardChange([a], [a, uber()])!;
    const gone = boardChange([a, uber()], [uber()])!;
    expect(summaryLine([added, gone])).toBe("Eklendi: Uber Yolculukları · Kaldırıldı: Taksi · Havalimanı → Bonfim");
    expect(summaryLine([])).toBeNull();
  });

  it("a turn that changed the board and said nothing: the line is on screen, never a silent chat", async () => {
    const d = await db();
    await d.put("trips", { id: "t7", title: "X", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 } as Trip);
    const { client } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "p1", name: "plan_item", caller: { type: "direct" }, input: { kind: "activity", title: "Fado gösterisi", date: null, end_date: null, time: null, from: null, to: null, city: "Porto", booked: false, note: null, replaces: null, item_id: null } }] as Anthropic.ContentBlock[],
      },
      { stop_reason: "end_turn", content: [] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("t7", "Porto'da bir fado gösterisi fikri ekle", anthropicProvider(client, "claude-opus-5"));
    const shown = (await listMessages("t7")).filter((m) => m.role === "assistant" && m.text.trim()).map((m) => m.text);
    expect(shown).toEqual(["Eklendi: Fado gösterisi"]);
  });
});
