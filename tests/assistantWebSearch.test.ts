// The board chat's web_search tool: it searches only when needed (the prompt's rule), at most twice for one
// message, ends the reply with "Kaynak: site" and its link, and says plainly when it can't search right now.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { landedText, MAX_SEARCHES, searchTiming, sendMessage, sourceLine, systemPrompt, tools, WEB_SEARCH_RULES_EN, WEB_SEARCH_RULES_TR, withSearchNotes } from "../src/lib/assistant";
import { chatStatusOf, onChatStatus, type ChatStatus } from "../src/lib/chatStatus";
import { db, listMessages } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
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
const searchCalls = (...queries: string[]): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: queries.map((query, n) => ({ type: "tool_use", id: `ws${n}`, name: "web_search", input: { query, kind: "event_dates", why: "tarih canlı bilgi" }, caller: { type: "direct" } })) as Anthropic.ContentBlock[],
});
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
const results = (call: Anthropic.MessageCreateParams) => call.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];

async function seed(id: string): Promise<void> {
  const trip: Trip = { id, title: "Macaristan", confirmedDates: { start: "2027-07-20", end: "2027-08-05" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
  await (await db()).put("trips", trip);
}
const server = (body: unknown, delayMs = 0) => {
  const asked: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (!String(url).endsWith("/functions/v1/web-search")) return new Response("{}", { status: 503 });
    asked.push(JSON.parse(String(init!.body)));
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  return asked;
};
const lastReply = async (tripId: string) => (await listMessages(tripId)).filter((m) => m.role === "assistant" && m.text.trim()).at(-1)!.text;

afterEach(() => {
  vi.unstubAllGlobals();
  setLang("tr");
  searchTiming.inlineMs = 8000;
});
const until = async (check: () => Promise<boolean>) => {
  for (let i = 0; i < 200 && !(await check()); i++) await new Promise((resolve) => setTimeout(resolve, 10));
};

describe("assistant: web_search", () => {
  it("'Ozora 2027 tarihlerini araştır' → one search; the reply ends with 'Kaynak:' and the link; the chat heard 'web'", async () => {
    await seed("ws1");
    const asked = server({
      answer: "Ozora 2027: 26 Temmuz – 2 Ağustos.",
      sources: [{ title: "ozorafestival.eu", url: "https://ozorafestival.eu/" }, { title: "Ozora – Wikipedia", url: "https://en.wikipedia.org/wiki/Ozora_Festival" }],
      kind: "event_dates",
      cached: false,
      at: "2026-10-06T10:00:00Z",
      event: { start: "2027-07-26", end: "2027-08-02", place: "Dádpuszta", official_url: "https://ozorafestival.eu/", confidence: "high" },
    });
    const statuses: ChatStatus[] = [];
    const stop = onChatStatus((tripId, s) => tripId === "ws1" && statuses.push(s));
    const { client, calls } = fakeClient([searchCalls("Ozora Festival 2027 dates"), done("Ozora 2027, 26 Temmuz – 2 Ağustos arası Dádpuszta'da.")]);
    await sendMessage("ws1", "Ozora 2027 tarihlerini araştır", anthropicProvider(client, "claude-opus-5"));
    stop();

    // Only the question went out, with its year.
    expect(asked).toEqual([{ q: "Ozora Festival 2027 dates", lang: "tr", kind: "event_dates", year: 2027 }]);
    expect(statuses).toEqual(["web", null]);
    const result = JSON.parse(String(results(calls[1])[0].content));
    expect(result).toMatchObject({ found: true, source_line: "Kaynak: [ozorafestival.eu](https://ozorafestival.eu/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Ozora_Festival)" });
    expect(await lastReply("ws1")).toBe(
      "Ozora 2027, 26 Temmuz – 2 Ağustos arası Dádpuszta'da.\n\nKaynak: [ozorafestival.eu](https://ozorafestival.eu/), [en.wikipedia.org](https://en.wikipedia.org/wiki/Ozora_Festival)",
    );
  });

  it("a reply that gives its own 'Kaynak:' line isn't given a second", () => {
    const turn = { searchSources: [{ title: "louvre.fr", url: "https://www.louvre.fr/" }], searchFound: true, searchDown: false };
    expect(withSearchNotes("09:00–18:00 açık.\nKaynak: [louvre.fr](https://www.louvre.fr/)", turn)).toBe("09:00–18:00 açık.\nKaynak: [louvre.fr](https://www.louvre.fr/)");
    expect(withSearchNotes("09:00–18:00 açık.", turn)).toBe("09:00–18:00 açık.\n\nKaynak: [louvre.fr](https://www.louvre.fr/)");
    expect(sourceLine([])).toBe("");
  });

  it("at most 2 searches for one message: the third isn't sent", async () => {
    await seed("ws2");
    const asked = server({ answer: "Feribot 08:00 ve 16:00.", sources: [{ title: "ferry.example", url: "https://ferry.example/" }], kind: "fact", cached: false, at: "2026-10-06T10:00:00Z" });
    const { client, calls } = fakeClient([searchCalls("ferry A timetable", "ferry B timetable", "ferry C timetable"), done("Feribot 08:00 ve 16:00.")]);
    await sendMessage("ws2", "feribot saatlerine bak", anthropicProvider(client, "claude-opus-5"));
    expect(asked).toHaveLength(MAX_SEARCHES);
    const third = JSON.parse(String(results(calls[1])[2].content));
    expect(third).toMatchObject({ found: false, limit: true });
  });

  it("not configured: the tool says so, and the reply says it can't search before it estimates", async () => {
    await seed("ws3");
    server({ answer: null, reason: "not-configured" });
    const { client, calls } = fakeClient([searchCalls("Ozora 2027 dates"), done("Genelde temmuz sonunda olur.")]);
    await sendMessage("ws3", "Ozora 2027 ne zaman?", anthropicProvider(client, "claude-opus-5"));
    const result = JSON.parse(String(results(calls[1])[0].content));
    expect(result).toMatchObject({ found: false, unavailable: "not-configured" });
    expect(result.note).toContain("şu an web'de arayamadığını");
    expect(await lastReply("ws3")).toBe("Şu an web'de arama yapamıyorum; aşağıdakiler genel bilgime dayanıyor, tahminidir.\n\nGenelde temmuz sonunda olur.");
  });

  it("capped, said by the model itself: nothing added twice; no 'Kaynak:' without a source", async () => {
    await seed("ws4");
    server({ answer: null, reason: "capped" });
    const { client } = fakeClient([searchCalls("Ozora 2027 dates"), done("Şu an web'de arayamıyorum; tahmini: temmuz sonu.")]);
    await sendMessage("ws4", "Ozora 2027 ne zaman?", anthropicProvider(client, "claude-opus-5"));
    expect(await lastReply("ws4")).toBe("Şu an web'de arayamıyorum; tahmini: temmuz sonu.");
  });

  it("a slow search goes on after the reply: the line stays, the traveller writes meanwhile, the result lands as its own line", async () => {
    await seed("ws5");
    searchTiming.inlineMs = 20;
    server({ answer: "Ozora 2027: 23 Temmuz – 3 Ağustos.", sources: [{ title: "ozorafestival.eu", url: "https://ozorafestival.eu/" }], kind: "event_dates", cached: false, at: "2026-10-06T10:00:00Z" }, 300);
    const statuses: ChatStatus[] = [];
    const stop = onChatStatus((tripId, s) => tripId === "ws5" && statuses.push(s));
    const { client, calls } = fakeClient([searchCalls("Ozora 2027 festival tarihleri"), done("Araştırıyorum, sonuç birazdan burada."), done("Rica ederim.")]);
    const llm = anthropicProvider(client, "claude-opus-5");
    await sendMessage("ws5", "Ozora 2027 tarihlerini araştır", llm);
    // The turn ended before the search: the tool said so, and the line is still on.
    expect(JSON.parse(String(results(calls[1])[0].content))).toMatchObject({ found: false, pending: true });
    expect(await lastReply("ws5")).toBe("Araştırıyorum, sonuç birazdan burada.");
    expect(chatStatusOf("ws5")).toBe("web");
    // Written meanwhile: answered, and told not to search the same thing again.
    await sendMessage("ws5", "teşekkürler", llm);
    expect(JSON.stringify(calls[2].messages.at(-1))).toContain("bir web araması hâlâ sürüyor");
    expect(await lastReply("ws5")).toBe("Rica ederim.");
    await until(async () => (await lastReply("ws5")).startsWith("Ozora 2027"));
    stop();
    expect(await lastReply("ws5")).toBe("Ozora 2027: 23 Temmuz – 3 Ağustos.\n\nKaynak: [ozorafestival.eu](https://ozorafestival.eu/)");
    expect(statuses).toEqual(["web", null]);
    expect(chatStatusOf("ws5")).toBeNull();
  });

  it("a search that couldn't finish says so honestly when it lands", () => {
    const miss = { answer: null, sources: [], kind: "fact" as const, cached: false, at: null };
    expect(landedText("Lello hours", { ...miss, reason: "timeout" })).toBe('"Lello hours" için web araması bitemedi (çok uzun sürdü). Biraz sonra yeniden sorabilirsin.');
    expect(landedText("Lello hours", { ...miss, reason: "capped" })).toContain("Şu an web'de arama yapamıyorum");
    expect(landedText("Lello hours", { ...miss, reason: "no-result" })).toContain("bir şey bulamadım");
  });

  it("the prompt's rule: only when needed, never general knowledge, 2 at most, sources, no made-up dates (TR and EN)", () => {
    expect(systemPrompt()).toContain(WEB_SEARCH_RULES_TR);
    for (const said of ["Yalnız gerçekten gerektiğinde ara", "Her mesajda arama.", "Genel bilgi, görüş ya da panoda (trip_state) zaten olan bir şey için asla arama.", "en fazla 2 arama", '"Kaynak: site adı"', "Asla tarih uydurma.", '"tahmini"', "plan_item, update_trip, suggest"]) {
      expect(WEB_SEARCH_RULES_TR).toContain(said);
    }
    expect(tools().map((t) => t.name)).toContain("web_search");
    setLang("en");
    expect(systemPrompt()).toContain(WEB_SEARCH_RULES_EN);
    for (const said of ["Search only when it's really needed", "Never search on every message.", "Never search for general knowledge", "At most 2 searches", '"Source: site name"', "Never make up dates.", '"estimated"']) {
      expect(WEB_SEARCH_RULES_EN).toContain(said);
    }
    expect(systemPrompt()).toContain("you don't look for options");
  });
});
