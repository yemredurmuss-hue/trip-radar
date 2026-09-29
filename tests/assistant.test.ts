import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { currentSession, resetConversation, sendMessage } from "../src/lib/assistant";
import { db, listItems, listMessages, listPreferences } from "../src/lib/db";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import type { Item, Trip } from "../src/lib/types";

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

async function seed(): Promise<{ trip: Trip; items: Item[] }> {
  const d = await db();
  const trip: Trip = { id: "t1", title: "Portekiz", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  await d.put("trips", trip);
  const item = (id: string, name: string, amount: number): Item => ({
    id, tripId: "t1", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name, provider: null,
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: "2026-10-08", end: "2026-10-11", source: "url" },
    guests: { adults: 2, children: null, rooms: 1 },
    price: { amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null, highlights: [], concerns: [],
    reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
  });
  const items = [item("a", "Jardim Stay", 285), item("b", "Casa Azul", 240)];
  for (const i of items) await d.put("items", i);
  return { trip, items };
}

describe("assistant", () => {
  it("runs tools, stores choices, and only resends trip state when it changed", async () => {
    await seed();
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "Jardim Stay iyi bir denge. Planına alalım mı?", citations: null },
          { type: "tool_use", id: "tu1", name: "set_priorities", input: { changes: [{ criterion: "location", level: "cok_onemli", category: "stay" }, { criterion: "price", level: "onemli", category: null }], wanted_amenities: ["mutfak", "havuz"] }, caller: { type: "direct" } },
          { type: "tool_use", id: "tu2", name: "save_preference", input: { text: "Merkezi konum önemli", scope: "trip" }, caller: { type: "direct" } },
          { type: "tool_use", id: "tu3", name: "offer_choices", input: { options: ["Evet, ekleyelim", "Diğerlerini konuşalım", "fazla"] }, caller: { type: "direct" } },
        ] as Anthropic.ContentBlock[],
      },
      { stop_reason: "end_turn", content: [] },
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "tu4", name: "update_items", input: { changes: [{ item_id: "a", status: "chosen", note: null }, { item_id: "zzz", status: "dismissed", note: null }] }, caller: { type: "direct" } },
        ] as Anthropic.ContentBlock[],
      },
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "tu5", name: "update_items", input: { changes: [{ item_id: "a", status: "chosen", note: null }] }, caller: { type: "direct" } },
        ] as Anthropic.ContentBlock[],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Ekledim.", citations: null }] as Anthropic.ContentBlock[] },
    ]);

    await sendMessage("t1", "Merkezi olsun ama bütçeyi aşmayalım.", anthropicProvider(client, "claude-opus-5"));

    let items = await listItems("t1");
    const trip = (await (await db()).get("trips", "t1"))!;
    expect(trip.categoryPriorities?.stay?.location).toBe(4);
    expect(trip.priorities?.price).toBe(3);
    expect(trip.wantedAmenities).toEqual(["mutfak", "havuz"]);
    // The tool answers with the recomputed decision so the model can explain what changed.
    const priorityResult = (calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(priorityResult.is_error).toBeFalsy();
    expect(String(priorityResult.content)).toContain('"group":"stay@2026-10-08_2026-10-11"');
    expect(String(priorityResult.content)).toContain("Çok önemli");
    expect((await listPreferences("t1")).map((p) => p.text)).toEqual(["Merkezi konum önemli"]);

    let messages = await listMessages("t1");
    const assistantTurn = messages.find((m) => m.role === "assistant")!;
    expect(assistantTurn.choices).toEqual(["Evet, ekleyelim", "Diğerlerini konuşalım"]);
    // The empty end_turn response was not stored.
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);

    // Second message: the state changed (priorities), so it is sent again.
    await sendMessage("t1", "Evet, ekleyelim", anthropicProvider(client, "claude-opus-5"));
    const lastUserTurn = calls[2].messages.at(-1)!;
    expect(JSON.stringify(lastUserTurn.content)).toContain("trip_state");
    // Unknown id is reported back as an error and nothing is changed by that call.
    const errorResult = (calls[3].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(errorResult.is_error).toBe(true);
    items = await listItems("t1");
    expect(items.find((i) => i.id === "a")!.status).toBe("chosen");

    // History sent to the API alternates correctly and is append-only.
    for (let i = 1; i < calls.length; i++) {
      const prev = calls[i - 1].messages;
      expect(calls[i].messages.slice(0, prev.length)).toEqual(prev.slice(0, Math.min(prev.length, calls[i].messages.length)));
    }
    messages = await listMessages("t1");
    expect(messages.at(-1)!.text).toBe("Ekledim.");
  });

  it("records hard requirements from the chat and rejects malformed ones", async () => {
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "r1", name: "set_requirements", input: { requirements: [{ kind: "amenity", amenity: "mutfak", minutes: null }, { kind: "free_cancellation", amenity: null, minutes: null }] }, caller: { type: "direct" } },
          { type: "tool_use", id: "r2", name: "set_requirements", input: { requirements: [{ kind: "amenity", amenity: "jakuzi", minutes: null }] }, caller: { type: "direct" } },
        ] as Anthropic.ContentBlock[],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Not aldım: mutfak şart.", citations: null }] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("t1", "Mutfak şart, iadesiz de olmasın.", anthropicProvider(client, "claude-opus-5"));
    const trip = (await (await db()).get("trips", "t1"))!;
    expect(trip.requirements).toEqual([{ kind: "amenity", amenity: "mutfak" }, { kind: "free_cancellation" }]);
    const [ok, bad] = calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    expect(String(ok.content)).toContain('"requirements":["mutfak","ücretsiz iptal"]');
    expect(bad.is_error).toBe(true);
    // The model sees how it understood the traveller.
    expect(JSON.stringify(calls[0].messages.at(-1)!.content)).toContain('\\"intent\\"');
  });

  it("does not resend an unchanged state and starts fresh after a reset", async () => {
    const ok = { stop_reason: "end_turn", content: [{ type: "text", text: "Tamam.", citations: null }] } as Partial<Anthropic.Message>;
    const { client, calls } = fakeClient([ok, ok, ok]);
    // The previous test's last tool call changed the state, so the first message carries it...
    await sendMessage("t1", "Bir şey sorayım", anthropicProvider(client, "claude-opus-5"));
    expect(JSON.stringify(calls[0].messages.at(-1)!.content)).toContain("trip_state");
    // ...and a follow-up with nothing changed does not.
    await sendMessage("t1", "Bir şey daha", anthropicProvider(client, "claude-opus-5"));
    expect(JSON.stringify(calls[1].messages.at(-1)!.content)).not.toContain("trip_state");

    await resetConversation("t1");
    expect(currentSession(await listMessages("t1"), "anthropic")).toHaveLength(0);
    await sendMessage("t1", "Yeniden başlayalım", anthropicProvider(client, "claude-opus-5"));
    expect(calls[2].messages).toHaveLength(1);
    expect(JSON.stringify(calls[2].messages[0].content)).toContain("trip_state");
  });

  it("searches a saved page for a detail the reading didn't cover, and shows the reading's pros and cons", async () => {
    const d = await db();
    await d.put("captures", {
      id: "cap-b", kind: "extension", url: "https://www.airbnb.com/rooms/9", title: "Casa Azul",
      pageText: "Casa Azul\nWhat this place offers\nKitchen · Washer\nNot included: TV\nCheck-in after 15:00",
      viewportText: "", selection: "", jsonLd: [], meta: {}, screenshot: null, capturedAt: 1, status: "done", error: null, itemId: "b",
    });
    const casa = (await d.get("items", "b"))!;
    await d.put("items", { ...casa, captureIds: ["cap-b"], key: "airbnb:9" });
    await d.put("listings", {
      key: "airbnb:9", name: "Casa Azul", reviewTotal: 96, readCaptureIds: ["cap-b"], readAt: 1, dropped: 0, error: null, errorAt: null, updatedAt: 1,
      reviews: [{ id: "r1", text: "Great Italian restaurant next door", date: "2026-09", captureId: "cap-b" }],
      findings: [
        { id: "nearby:positive:1", text: "Yanında çok iyi bir İtalyan restoranı", polarity: "positive", topic: "nearby", source: "reviews", severity: "medium", reviewIds: ["r1"], quotes: [], verified: true },
      ],
    });
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "s1", name: "search_page", input: { item_id: "b", words: ["TV", "televizyon"] }, caller: { type: "direct" } },
          { type: "tool_use", id: "s2", name: "search_page", input: { item_id: "b", words: ["havuz", "pool"] }, caller: { type: "direct" } },
        ] as Anthropic.ContentBlock[],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Sayfada 'Not included: TV' yazıyor.", citations: null }] as Anthropic.ContentBlock[] },
    ]);
    await sendMessage("t1", "Casa Azul'da TV var mı?", anthropicProvider(client, "claude-opus-5"));
    const state = JSON.stringify(calls[0].messages.at(-1)!.content);
    expect(state).toContain("Yanında çok iyi bir İtalyan restoranı (1 yorum · en yenisi Eyl 2026)");
    expect(state).toContain("1 yorum incelendi (sitede 96)");
    const [tv, pool] = calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    expect(String(tv.content)).toContain("Not included: TV");
    expect(String(pool.content)).toContain("Kaydedilen sayfada geçmiyor");
  });
});
