import "fake-indexeddb/auto";
import { ApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";
import { AnalysisSchema } from "../src/lib/analysis";
import { currentSession, sendMessage } from "../src/lib/assistant";
import { db, listItems, listMessages } from "../src/lib/db";
import type { Extraction } from "../src/lib/extract";
import { describeGeminiError, geminiProvider, toContents, type GeminiClient } from "../src/lib/llm/gemini";
import type { Capture, ChatMessage, Item, Trip } from "../src/lib/types";

function fakeGemini(responses: (Partial<GenerateContentResponse> | Error)[]) {
  const calls: GenerateContentParameters[] = [];
  const client: GeminiClient = {
    models: {
      generateContent: (async (params: GenerateContentParameters) => {
        calls.push(structuredClone(params));
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        if (next instanceof Error) throw next;
        return next as GenerateContentResponse;
      }) as GeminiClient["models"]["generateContent"],
    },
  };
  return { client, calls };
}

const modelTurn = (parts: object[], finishReason = "STOP") =>
  ({ candidates: [{ content: { role: "model", parts }, finishReason }] }) as unknown as Partial<GenerateContentResponse>;

const capture: Capture = {
  id: "c1", kind: "extension", url: "https://www.booking.com/hotel/pt/jardim-stay.html", title: "Jardim Stay",
  pageText: "€ 285", viewportText: "", selection: "", jsonLd: [], meta: {},
  screenshot: "data:image/jpeg;base64,QUJD", capturedAt: 0, status: "pending", error: null, itemId: null,
};

const extraction: Extraction = {
  category: "stay", name: "Jardim Stay", provider: "Booking.com", summary: "Merkezi", option_detail: null,
  city: "Porto", country: "Portekiz", country_code: "PT", location: { address: null, area: null, approximate: false },
  dates: { start: null, end: null, source: "none" }, guests: { adults: null, children: null, rooms: null },
  price: { amount: 285, currency: "EUR", scope: "total", taxes_included: "unknown", source: "page", evidence: "€ 285" },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null },
  rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null, metrics: null, highlights: [], concerns: [], review_summary: null, image_url: null, missing: [],
  trip: { existing_trip_id: null, new_trip_title: "Portekiz" }, need_key: "stay:porto",
};

describe("gemini extraction", () => {
  it("sends the screenshot and a JSON schema, and validates the answer", async () => {
    const { client, calls } = fakeGemini([modelTurn([{ text: JSON.stringify(extraction) }])]);
    const result = await geminiProvider(client, "gemini-test", 0).extract(capture, {} as never, []);
    expect(result.name).toBe("Jardim Stay");

    const params = calls[0];
    const parts = (params.contents as { parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] }[])[0].parts;
    expect(parts[0].inlineData).toEqual({ mimeType: "image/jpeg", data: "QUJD" });
    expect(parts[1].text).toContain("<page_text>€ 285</page_text>");
    expect(params.config?.responseMimeType).toBe("application/json");
    const schema = params.config?.responseJsonSchema as Record<string, unknown>;
    expect(schema.$schema).toBeUndefined();
    expect((schema.required as string[]).includes("need_key")).toBe(true);
  });

  it("rejects answers that do not match the schema", async () => {
    const { client } = fakeGemini([modelTurn([{ text: '{"name":"x"}' }])]);
    await expect(geminiProvider(client, "gemini-test", 0).extract(capture, {} as never, [])).rejects.toThrow(
      "beklenen formatta değil",
    );
  });

  it("retries once on a rate limit", async () => {
    const { client, calls } = fakeGemini([
      new ApiError({ message: "quota", status: 429 }),
      modelTurn([{ text: JSON.stringify(extraction) }]),
    ]);
    await geminiProvider(client, "gemini-test", 0).extract(capture, {} as never, []);
    expect(calls).toHaveLength(2);
  });

  it("returns schema-checked JSON for the decision analysis", async () => {
    const answer = { verdict: "A öne çıkıyor.", reasons: [], tradeoffs: [], risks: [], question: null, ai_scores: [], eliminations: [] };
    const { client, calls } = fakeGemini([modelTurn([{ text: JSON.stringify(answer) }]), modelTurn([{ text: '{"verdict":1}' }])]);
    const gemini = geminiProvider(client, "gemini-test", 0);
    expect(await gemini.generateJson("sys", "prompt", AnalysisSchema)).toEqual(answer);
    expect(calls[0].config?.systemInstruction).toBe("sys");
    expect((calls[0].config?.responseJsonSchema as { required: string[] }).required).toContain("eliminations");
    await expect(gemini.generateJson("sys", "prompt", AnalysisSchema)).rejects.toThrow("beklenen formatta değil");
  });

  it("explains common API errors in Turkish", () => {
    expect(describeGeminiError(new ApiError({ message: "API key not valid", status: 400 }))).toContain("anahtarı geçersiz");
    expect(describeGeminiError(new ApiError({ message: "quota", status: 429 }))).toContain("kotası doldu");
    expect(describeGeminiError(new Error("x"))).toBeNull();
  });
});

describe("gemini chat", () => {
  async function seed() {
    const d = await db();
    const trip: Trip = { id: "g1", title: "Portekiz", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    await d.put("trips", trip);
    const item = { id: "a", tripId: "g1", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name: "Jardim Stay",
      provider: null, summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: null, countryCode: null,
      location: { address: null, area: null, approximate: false }, dates: { start: null, end: null, source: "none" },
      guests: { adults: null, children: null, rooms: null },
      price: { amount: 285, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
      priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
      rating: { value: null, scale: null, count: null, source: "none" }, flight: null, highlights: [], concerns: [],
      reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1 } as Item;
    await d.put("items", item);
  }

  it("runs function calls, replays thought signatures, and keeps roles alternating", async () => {
    await seed();
    const { client, calls } = fakeGemini([
      modelTurn([
        { text: "Jardim Stay iyi bir denge." },
        { functionCall: { id: "fc1", name: "update_items", args: { changes: [{ item_id: "a", status: "chosen", note: null }] } }, thoughtSignature: "sig-1" },
      ]),
      modelTurn([{ text: "Planına ekledim." }]),
    ]);

    await sendMessage("g1", "Jardim'i seçelim", geminiProvider(client, "gemini-test", 0));

    expect((await listItems("g1"))[0].status).toBe("chosen");
    const second = calls[1].contents as { role: string; parts: Record<string, any>[] }[];
    expect(second.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(second[1].parts[1].thoughtSignature).toBe("sig-1");
    expect(second[2].parts[0].functionResponse).toEqual({ id: "fc1", name: "update_items", response: { result: "ok" } });
    expect(calls[1].config?.tools?.[0]).toMatchObject({ functionDeclarations: expect.arrayContaining([expect.objectContaining({ name: "set_priorities" })]) });

    const messages = await listMessages("g1");
    expect(messages.filter((m) => m.role !== "event").every((m) => m.provider === "gemini")).toBe(true);
    expect(messages.at(-1)!.text).toBe("Planına ekledim.");
  });

  it("starts a fresh context when the provider changes", () => {
    const m = (role: ChatMessage["role"], provider?: "gemini" | "anthropic"): ChatMessage =>
      ({ id: Math.random().toString(), tripId: "x", role, content: [], text: "t", choices: [], createdAt: 0, provider });
    const history = [m("user"), m("assistant"), m("user", "gemini"), m("assistant", "gemini"), m("event")];
    expect(currentSession(history, "gemini")).toHaveLength(2);
    expect(currentSession(history, "anthropic")).toHaveLength(0);
    expect(currentSession(history.slice(0, 2), "anthropic")).toHaveLength(2);
  });

  it("merges consecutive user turns (e.g. after an interrupted tool loop)", () => {
    const m = (role: ChatMessage["role"], parts: object[]): ChatMessage =>
      ({ id: "i", tripId: "x", role, content: parts, text: "", choices: [], createdAt: 0, provider: "gemini" });
    const contents = toContents([m("user", [{ text: "a" }]), m("assistant", [{ text: "b" }]), m("user", [{ functionResponse: {} }]), m("user", [{ text: "c" }])]);
    expect(contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(contents[2].parts).toHaveLength(2);
  });
});
