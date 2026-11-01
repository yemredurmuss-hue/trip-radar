// tests/stayTaken.test.ts: one stay per city per night (Tur 24, Emre's Maldives: the route's Malé night and the review's
// "Malé'de ilk gece otel" for the same night, two cards). A stay suggestion for a city's nights a stay already holds is
// never shown; the advisor's review can't open a second stay there either: it is told which one to use. (The traveller
// may ask for a night apart in the same city: the chat does it, assistant.test.)
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { expect, it } from "vitest";
import { reviewTiming, reviewTrip } from "../src/lib/assistant";
import { db, listItems } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { shownSuggestions } from "../src/lib/suggestions";
import type { Suggestion, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const male = makeItem({ id: "male", tripId: "mv", category: "stay", name: "Malé", city: "Malé", needKey: "stay:male", status: "chosen", dates: { start: "2027-02-01", end: "2027-02-02", source: "page" } });
const sugg = (key: string, city: string, start: string | null): Suggestion => ({ key, section: "stay", kind: "add", title: `${city}'de ilk gece otel`, why: "Geç varış.", source: "ai", payload: { city, start, end: null }, state: "open", createdAt: 1 } as Suggestion);

it("a stay suggestion for nights a stay already holds in that city is not shown; another city's or other nights' is", () => {
  const shown = shownSuggestions([sugg("a", "Malé", "2027-02-01"), sugg("b", "Maafushi", "2027-02-01"), sugg("c", "Malé", "2027-02-08")], [], [male]).map((s) => s.key);
  expect(shown).toEqual(["b", "c"]);
});

it("the advisor's review can't open a second stay for the same nights in the same city: it is told which one to use", async () => {
  reviewTiming.gapMs = 0;
  setLang("tr");
  const d = await db();
  await d.put("trips", { id: "mv", title: "Maldivler", confirmedDates: { start: "2027-02-01", end: "2027-02-09" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 } as Trip);
  await d.put("items", male);
  const sent: Anthropic.MessageCreateParams[] = [];
  const responses: Partial<Anthropic.Message>[] = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "p1", name: "plan_item", caller: { type: "direct" }, input: { kind: "stay", title: "Malé'de ilk gece otel", date: "2027-02-01", end_date: "2027-02-02", time: null, from: null, to: null, city: "Malé", booked: false, note: null, replaces: null, item_id: null, confirmed: false } }] as Anthropic.ContentBlock[] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Malé gecesi zaten planda.", citations: null }] as Anthropic.ContentBlock[] },
  ];
  const client = { messages: { create: async (p: Anthropic.MessageCreateParams) => (sent.push(structuredClone(p)), responses.shift()!) } } as unknown as Anthropic;
  await reviewTrip("mv", "Plan yeni kuruldu.", "first", anthropicProvider(client, "claude-opus-5"));
  const result = (sent[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
  expect(result.is_error).toBe(true);
  expect(String(result.content)).toContain("male");
  expect((await listItems("mv")).filter((i) => i.category === "stay")).toHaveLength(1);
});
