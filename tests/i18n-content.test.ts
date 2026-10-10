// English mode: every prompt asks the model to write in English, the schemas describe their fields in
// English, the tools keep their names, and the sample trip and the app's own labels read in English.
import "fake-indexeddb/auto";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";
import { analysisSchema, analysisSystem, AnalysisSchema, loadDecisions } from "../src/lib/analysis";
import { sendMessage, systemPrompt, tools, TOOLS } from "../src/lib/assistant";
import { db, listItems, listMessages } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { extractionSchema, extractionSystem, ExtractionSchema, type Extraction } from "../src/lib/extract";
import { formatDistance } from "../src/lib/geo";
import { setLang } from "../src/lib/i18n";
import { CATEGORY_LABELS, formatDateRange, formatPrice, rowLabel } from "../src/lib/items";
import { describeGeminiError, geminiProvider, type GeminiClient } from "../src/lib/llm/gemini";
import { fitsStrict, schemaLoad, strictTools } from "../src/lib/llm/schemaBudget";
import { MissingKeyError, type LlmProvider } from "../src/lib/llm/types";
import { readerSchema, readerSystem, ReaderSchema } from "../src/lib/reader";
import { amenityLabel, type Capture, type Item, type Trip } from "../src/lib/types";
import { isDemoTrip, uniqueTitle } from "../src/lib/trips";

afterEach(() => setLang("tr"));

const descriptions = (schema: z.ZodType) => JSON.stringify(z.toJSONSchema(schema));

describe("English prompts", () => {
  it("asks every model call to write in English, and nothing asks for Turkish", () => {
    setLang("en");
    for (const prompt of [extractionSystem(), readerSystem(), analysisSystem(), systemPrompt()]) {
      expect(prompt).toMatch(/in English/);
      expect(prompt).not.toMatch(/Türkçe/);
    }
    expect(readerSystem()).toContain("quotes stay exactly as on the page");
    expect(extractionSystem()).toContain("common English name");
    for (const schema of [extractionSchema(), readerSchema(), analysisSchema()]) {
      expect(descriptions(schema)).not.toMatch(/Türkçe/);
    }
    expect(descriptions(readerSchema())).toContain("Short and concrete, in English");
    expect(descriptions(extractionSchema())).toContain("One-line summary in English");
  });

  it("keeps the Turkish prompts in Turkish mode", () => {
    expect(readerSystem()).toContain("Türkçe yaz");
    expect(extractionSystem()).toContain("Türkçe yaz");
    expect(descriptions(readerSchema())).toContain("Türkçe");
    expect(tools()).toBe(TOOLS);
  });

  it("has the same schemas and tools in both languages, inside the strict limits", () => {
    const shape = (schema: z.ZodType) => JSON.stringify(z.toJSONSchema(schema), (k, v) => (k === "description" ? undefined : v));
    setLang("en");
    expect(shape(extractionSchema())).toBe(shape(ExtractionSchema));
    expect(shape(readerSchema())).toBe(shape(ReaderSchema));
    expect(shape(analysisSchema())).toBe(shape(AnalysisSchema));
    expect(fitsStrict(schemaLoad(zodOutputFormat(readerSchema()).schema))).toBe(true);
    expect(fitsStrict(schemaLoad(zodOutputFormat(analysisSchema()).schema))).toBe(true);

    const en = tools();
    expect(en.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    const inputs = (list: typeof en) => JSON.stringify(list.map((t) => t.schema), (k, v) => (k === "description" ? undefined : v));
    expect(inputs(en)).toBe(inputs(TOOLS));
    expect(strictTools(en.map((t) => t.schema))).toEqual(strictTools(TOOLS.map((t) => t.schema)));
    // No Turkish sentences left in any description (the amenity ids in the enums stay Turkish).
    const texts: string[] = [];
    JSON.stringify(en, (k, v) => (k === "description" && texts.push(v), v));
    expect(texts.length).toBeGreaterThan(30);
    for (const text of texts) expect(text).not.toMatch(/(^|\s)(ve|ya da|için|yalnız|değil|olarak|ise)(\s|$)/i);
  });
});

const capture: Capture = {
  id: "c1", kind: "extension", url: "https://www.booking.com/hotel/pt/jardim-stay.html", title: "Jardim Stay",
  pageText: "€ 285", viewportText: "", selection: "", jsonLd: [], meta: {},
  screenshot: null, capturedAt: 0, status: "pending", error: null, itemId: null,
};

const extraction: Extraction = {
  category: "stay", name: "Jardim Stay", provider: "Booking.com", summary: "Central", option_detail: null,
  city: "Porto", country: "Portugal", country_code: "PT", location: { address: null, area: null, approximate: false },
  dates: { start: null, end: null, source: "none" }, guests: { adults: null, children: null, rooms: null },
  price: { amount: 285, currency: "EUR", scope: "total", taxes_included: "unknown", source: "page", evidence: "€ 285" },
  cancellation: { summary: null, free_until: null, source: "none", evidence: null },
  rating: { value: null, scale: null, count: null, source: "none", evidence: null },
  flight: null, metrics: null, highlights: [], concerns: [], review_summary: null, image_url: null, missing: [],
  trip: { existing_trip_id: null, new_trip_title: "Portugal" }, need_key: "stay:porto",
};

describe("English model calls", () => {
  it("sends the English extraction instructions and schema to Gemini", async () => {
    setLang("en");
    const calls: GenerateContentParameters[] = [];
    const client: GeminiClient = {
      models: {
        generateContent: (async (params: GenerateContentParameters) => {
          calls.push(params);
          return { candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(extraction) }] }, finishReason: "STOP" }] } as unknown as GenerateContentResponse;
        }) as GeminiClient["models"]["generateContent"],
      },
    };
    await geminiProvider(client, "gemini-test", 0).extract(capture, {} as never, []);
    expect(calls[0].config?.systemInstruction).toBe(extractionSystem());
    expect(JSON.stringify(calls[0].config?.responseJsonSchema)).toContain("One-line summary in English");
  });

  it("gives the chat the English system prompt and tools, and stores English events", async () => {
    setLang("en");
    const d = await db();
    const trip: Trip = { id: "en1", title: "Portugal", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    await d.put("trips", trip);
    const seen: { system: string; tools: string[] }[] = [];
    const llm: LlmProvider = {
      id: "anthropic",
      extract: async () => extraction,
      generateJson: async () => ({}) as never,
      chatStep: async (_history, system, specs) => {
        seen.push({ system, tools: specs.map((t) => t.description) });
        return seen.length === 1
          ? { content: [], text: "Sure.", calls: [{ id: "x", name: "offer_choices", input: { options: ["Yes", "No"] } }], refused: false }
          : { content: [], text: "Done.", calls: [], refused: true };
      },
      userContent: (texts) => texts,
      assistantContent: (text) => [text],
      toolResultContent: (results) => results.map((r) => r.content),
    };
    await sendMessage("en1", "Somewhere quiet please", llm);
    expect(seen[0].system).toBe(systemPrompt());
    expect(seen[0].tools.join(" ")).toContain("quick-reply buttons");
    const messages = await listMessages("en1");
    expect(messages.find((m) => m.choices.length)?.choices).toEqual(["Yes", "No"]);
  });
});

describe("English sample trip", () => {
  it("is written in English, with its review kept for English", async () => {
    setLang("en");
    const id = await loadDemoTrip({ today: "2026-10-05" });
    const trip = (await (await db()).get("trips", id))!;
    expect(trip.title).toBe("Portugal (sample)");
    expect(isDemoTrip(trip)).toBe(true);
    const items = await listItems(id);
    const names = items.map((i) => i.name);
    expect(names).toContain("Douro boat tour");
    expect(names).toContain("TAP · Lisbon → Istanbul");
    const jardim = items.find((i) => i.name === "Jardim Stay")!;
    expect(jardim.highlights).toEqual(["Central location", "Quiet rooms", "Breakfast included"]);
    expect(jardim.cancellation.summary).toBe("Free cancellation until 5 Oct");
    const messages = await listMessages(id);
    expect(messages.map((m) => m.text).join(" ")).toContain("Jardim Stay stands out");

    const { decisions, ctx } = await loadDecisions(trip, items);
    const porto = [...decisions.values()].find((g) => g.options.some((o) => o.item.name === "Casa Azul"))!;
    expect(porto.analysis?.verdict).toMatch(/^Jardim Stay: close to/);
    const listing = ctx.listings.get([...ctx.listings.keys()].find((k) => ctx.listings.get(k)!.name === "Casa Azul")!)!;
    expect(listing.findings[0].text).toBe("Construction noise next door");
    expect(JSON.stringify({ items, messages, listings: [...ctx.listings.values()] })).not.toMatch(/(rezerve|yorum|gece|örnek|Lizbon)/);
  });

  it("asks again for an analysis written in the other language", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" }); // Turkish review stored
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const porto = (t: Awaited<ReturnType<typeof loadDecisions>>) =>
      [...t.decisions.values()].find((g) => g.options.some((o) => o.item.name === "Casa Azul"))!;
    expect(porto(await loadDecisions(trip, items)).analysis?.verdict).toMatch(/kaydettiğin/);
    setLang("en");
    expect(porto(await loadDecisions(trip, items)).analysis).toBeFalsy();
  });
});

describe("English labels", () => {
  const item = (over: Partial<Item>): Item =>
    ({
      id: "a", tripId: "t", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name: "Jardim", provider: null,
      summary: "Baixa", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: null, countryCode: null,
      location: { address: null, area: null, approximate: false }, dates: { start: "2026-10-08", end: "2026-10-11", source: "url" },
      guests: { adults: 2, children: null, rooms: 1 },
      price: { amount: 285, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: Date.now() },
      priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
      rating: { value: null, scale: null, count: null, source: "none" }, flight: null, highlights: [], concerns: [],
      reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1, ...over,
    }) as Item;

  it("reads in English", () => {
    setLang("en");
    expect(CATEGORY_LABELS.stay).toBe("Stays");
    expect(Object.keys(CATEGORY_LABELS)).toContain("flight");
    expect(rowLabel(item({ status: "booked" }), [])).toEqual({ text: "Booked", tone: "success" });
    const cheap = item({});
    expect(rowLabel(cheap, [cheap, item({ id: "b", price: { ...cheap.price, amount: 300 } })]).text).toBe("Cheapest");
    expect(formatDateRange("2026-10-08", "2026-10-11")).toBe("8–11 October");
    expect(formatPrice(1285, "EUR")).toBe("€1,285");
    expect(formatDistance(0.5)).toBe("8 min walk");
    expect(amenityLabel("mutfak")).toBe("kitchen");
    expect(uniqueTitle("Portugal", "2027-06-01", [{ title: "Portugal" } as Trip])).toBe("Portugal · June 2027");
    expect(new MissingKeyError().message).toMatch(/^No API key/);
    expect(describeGeminiError(new ApiError({ message: "quota", status: 429 }))).toMatch(/free quota/);
  });

  it("stays Turkish by default", () => {
    expect(CATEGORY_LABELS.stay).toBe("Konaklama");
    expect(formatDateRange("2026-10-08", "2026-10-11")).toBe("8–11 Ekim");
    expect(amenityLabel("mutfak")).toBe("mutfak");
  });
});
