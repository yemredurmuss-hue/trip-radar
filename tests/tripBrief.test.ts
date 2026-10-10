// tests/tripBrief.test.ts — the board chat never loses the trip (spec 2026-10-07-akilli-planlayici §D): the trip in a
// few words with every message, a web search that names the trip's place, and a slow search's answer written for the
// trip (the raw line when it can't be).
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { searchTiming, sendMessage, synthTiming } from "../src/lib/assistant";
import { db, listMessages } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import type { LlmProvider } from "../src/lib/llm/types";
import { acceptSynth, conceptState, groundQuery, synthPrompt, tripBrief } from "../src/lib/tripBrief";
import { planToSave } from "../src/lib/planned";
import type { Item, Trip } from "../src/lib/types";

const DAHAB: Trip = {
  id: "dh", title: "Dahab", confirmedDates: { start: "2026-11-12", end: "2026-11-19" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: ["Sabine"], count: 2 },
  intent: { playbook: "classic", label: "Dahab'da dalış ve karavan", musts: [{ id: "level", text: "İleri seviye dalgıç" }] },
};
const stay = (id: string, city: string, start: string, end: string, tripId = "dh"): Item =>
  planToSave({ kind: "stay", date: start, end_date: end, time: null, from: null, to: null, city, title: null, booked: false, note: null }, [], tripId, id, 1).item;
const ITEMS = [stay("s1", "Dahab", "2026-11-12", "2026-11-19")];

afterEach(() => {
  vi.unstubAllGlobals();
  setLang("tr");
  searchTiming.inlineMs = 8000;
  synthTiming.ms = 15_000;
});

describe("the trip in a few words", () => {
  it("says the route, the days, who, what it's for and what must hold", () => {
    const brief = tripBrief(DAHAB, ITEMS, "Emre");
    expect(brief).toContain("Rota: Dahab");
    expect(brief).toContain("Tarih: 12–19 Kasım");
    expect(brief).toContain("Kişi: 2 kişi (Emre, Sabine)");
    expect(brief).toContain("Konsept: Dahab'da dalış ve karavan");
    expect(brief).toContain("Şartlar: İleri seviye dalgıç");
    expect(brief.length).toBeLessThanOrEqual(400);
    expect(conceptState(DAHAB)).toEqual({ label: "Dahab'da dalış ve karavan", focus: null, musts: ["İleri seviye dalgıç"], avoid: null });
    expect(conceptState({ intent: null })).toBeNull();
  });
});

describe("a web search names the trip's place", () => {
  it("adds it when the query names no place", () => {
    expect(groundQuery("karavan kiralama", DAHAB, ITEMS)).toBe("karavan kiralama Dahab");
    expect(groundQuery("Karavan kiralama fiyatları", DAHAB, ITEMS)).toBe("Karavan kiralama fiyatları Dahab");
  });
  it("leaves it as it is when it names the trip's place or another one", () => {
    expect(groundQuery("Dahab'da karavan kiralama", DAHAB, ITEMS)).toBe("Dahab'da karavan kiralama");
    expect(groundQuery("Mısır vize kuralları", DAHAB, ITEMS)).toBe("Mısır vize kuralları");
    expect(groundQuery("Ozora Festival 2027 tarihleri", DAHAB, ITEMS)).toBe("Ozora Festival 2027 tarihleri");
    expect(groundQuery("Kahire müzeleri", DAHAB, ITEMS)).toBe("Kahire müzeleri");
  });
  it("adds nothing to a trip with no place yet", () => {
    expect(groundQuery("karavan kiralama", { ...DAHAB, intent: null }, [])).toBe("karavan kiralama");
  });
});

describe("a slow search, written for the trip", () => {
  function fakeClient(responses: Partial<Anthropic.Message>[]) {
    const calls: Anthropic.MessageCreateParams[] = [];
    const client = { messages: { create: async (p: Anthropic.MessageCreateParams) => (calls.push(structuredClone(p)), responses.shift() ?? Promise.reject(new Error("no more"))) } } as unknown as Anthropic;
    return { client, calls };
  }
  const search = (query: string): Partial<Anthropic.Message> => ({
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id: "w1", name: "web_search", input: { query, kind: "research", why: "kullanıcı istedi" }, caller: { type: "direct" } }] as Anthropic.ContentBlock[],
  });
  const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });
  const serve = (delayMs: number) => {
    const asked: { q: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (!String(url).endsWith("/functions/v1/web-search")) return new Response("{}", { status: 503 });
      asked.push(JSON.parse(String(init!.body)));
      await new Promise((r) => setTimeout(r, delayMs));
      return new Response(JSON.stringify({ answer: "Mısır'da karavan kiralama sınırlı; Sina'da birkaç yerel firma günlük 80-120 USD istiyor.", sources: [{ title: "example.com", url: "https://example.com/rv" }], kind: "research", cached: false, at: "2026-10-07T10:00:00Z" }), { status: 200 });
    });
    return asked;
  };
  const until = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 300 && !(await check()); i++) await new Promise((r) => setTimeout(r, 10));
  };
  async function seed(id: string) {
    const d = await db();
    await d.put("trips", { ...DAHAB, id });
    await d.put("items", stay(`${id}-s1`, "Dahab", "2026-11-12", "2026-11-19", id));
  }

  it("searches with the trip's place, gives the brief with the message, and lands the answer tied to the trip", async () => {
    await seed("dh1");
    searchTiming.inlineMs = 20;
    const asked = serve(200);
    const { client, calls } = fakeClient([search("karavan kiralama"), done("Bakıyorum, sonuç birazdan burada.")]);
    const synth: string[] = [];
    const llm: LlmProvider = {
      ...anthropicProvider(client, "claude-opus-5"),
      generateJson: (async (_system: string, prompt: string) => (synth.push(prompt), { text: "Dahab'da 12–19 Kasım için karavan seçeneği az: Sina'daki birkaç yerel firma günlük 80-120 USD istiyor; iki kişi için önceden sormak iyi olur." })) as LlmProvider["generateJson"],
    };
    await sendMessage("dh1", "karavan kiralama araştır", llm);
    expect(JSON.stringify(calls[0].messages.at(-1))).toContain("<trip_brief>Rota: Dahab");
    const landed = async () => (await listMessages("dh1")).find((m) => m.landed);
    await until(async () => Boolean(await landed()));
    const line = (await landed())!;
    expect(asked[0].q).toBe("karavan kiralama Dahab");
    expect(line.text).toBe("Dahab'da 12–19 Kasım için karavan seçeneği az: Sina'daki birkaç yerel firma günlük 80-120 USD istiyor; iki kişi için önceden sormak iyi olur.\n\nKaynak: [example.com](https://example.com/rv)");
    // The synthesis read the web result first, then the trip, then the question.
    expect(synth[0].indexOf("<web_result>")).toBeLessThan(synth[0].indexOf("<trip_brief>"));
    expect(synth[0]).toContain("Kullanıcının sorusu: karavan kiralama araştır");
  });

  it("lands the raw line when the synthesis fails", async () => {
    await seed("dh2");
    searchTiming.inlineMs = 20;
    serve(200);
    // Another question (the first one's answer is kept and would come at once).
    const { client } = fakeClient([search("karavan fiyatları"), done("Bakıyorum.")]);
    const llm: LlmProvider = { ...anthropicProvider(client, "claude-opus-5"), generateJson: (async () => { throw new Error("down"); }) as LlmProvider["generateJson"] };
    await sendMessage("dh2", "karavan kiralama araştır", llm);
    const landed = async () => (await listMessages("dh2")).find((m) => m.landed);
    await until(async () => Boolean(await landed()));
    expect((await landed())!.text).toBe("Mısır'da karavan kiralama sınırlı; Sina'da birkaç yerel firma günlük 80-120 USD istiyor.\n\nKaynak: [example.com](https://example.com/rv)");
  });

  it("keeps only an answer that holds", () => {
    expect(acceptSynth({ text: "kısa" })).toBeNull();
    expect(acceptSynth({ text: "<trip_brief>sızmış bir şey burada var</trip_brief>" })).toBeNull();
    expect(acceptSynth({ text: "Dahab'da karavan seçeneği az, önceden sor." })).toBe("Dahab'da karavan seçeneği az, önceden sor.");
    expect(synthPrompt({ brief: "Rota: Dahab", question: "karavan?", label: "[web]", answer: "x" })).toMatch(/^<web_result>/);
  });
});
