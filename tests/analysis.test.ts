import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { analysisPrompt, analyzeStale, loadDecisions, needsAnalysis, type AnalysisOutput } from "../src/lib/analysis";
import { db, listAnalyses } from "../src/lib/db";
import { withPriorities } from "../src/lib/decision";
import { EMPTY_METRICS } from "../src/lib/items";
import { MissingKeyError, type LlmProvider } from "../src/lib/llm";
import type { Item, Trip } from "../src/lib/types";

const trip: Trip = {
  id: "ta", title: "Portekiz", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1,
};

function stay(id: string, name: string, amount: number, rating: number, reviews: string): Item {
  return {
    id, tripId: "ta", captureIds: [], key: null, category: "stay", needKey: "stay:porto", name, provider: "Booking.com",
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: "2026-10-08", end: "2026-10-11", source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: "Ücretsiz iptal", freeUntil: null, source: "page" },
    rating: { value: rating, scale: 10, count: 400, source: "page" }, flight: null,
    metrics: { ...EMPTY_METRICS, cancellationType: "free" }, geo: null,
    highlights: [], concerns: [], reviewSummary: reviews, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
  };
}

/** Provider stub: answers generateJson with the given output (or throws), records prompts. */
function fakeProvider(answer: (prompt: string) => AnalysisOutput) {
  const prompts: string[] = [];
  const provider = {
    id: "gemini",
    async generateJson(_system: string, prompt: string) {
      prompts.push(prompt);
      return answer(prompt);
    },
  } as unknown as LlmProvider;
  return { provider, prompts };
}

const output = (over: Partial<AnalysisOutput> = {}): AnalysisOutput => ({
  verdict: "Jardim Stay öne çıkıyor ama Casa daha sessiz.",
  reasons: ["Puan 9,1 → yorumlar tutarlı"],
  tradeoffs: ["€45 daha pahalı"],
  risks: ["Hafta sonu gürültüsü"],
  question: "Geceleri geç mi döneceksiniz?",
  ai_scores: [
    { item_id: "a", score: 6, note: "gece gürültüsü" },
    { item_id: "b", score: 9, note: "sakin sokak" },
    { item_id: "ghost", score: 10, note: "yok böyle bir seçenek" },
  ],
  ...over,
});

async function seed() {
  const d = await db();
  await d.put("trips", trip);
  await d.put("items", stay("a", "Jardim Stay", 285, 9.1, "Konum harika, hafta sonu gece gürültüsü var."));
  await d.put("items", stay("b", "Casa Azul", 240, 8.8, "Sakin sokak, ev sahibi ilgili."));
}

describe("analysis", () => {
  it("analyses stale groups once, and the fresh analysis feeds the AI criterion", async () => {
    await seed();
    const { provider, prompts } = fakeProvider(() => output());
    await analyzeStale({ provider: async () => provider });
    expect(prompts).toHaveLength(1);
    // The model sees the engine's table and reviews, and the page text is data.
    expect(prompts[0]).toContain("<engine_result>");
    expect(prompts[0]).toContain("hafta sonu gece gürültüsü");

    const [stored] = await listAnalyses("ta");
    expect(stored.aiScores.map((s) => s.itemId)).toEqual(["a", "b"]); // unknown ids dropped

    const { decisions } = await loadDecisions(trip, [stay("a", "Jardim Stay", 285, 9.1, "Konum harika, hafta sonu gece gürültüsü var."), stay("b", "Casa Azul", 240, 8.8, "Sakin sokak, ev sahibi ilgili.")]);
    const d = decisions.get("stay:porto")!;
    expect(d.analysis?.verdict).toContain("Jardim");
    expect(d.criteria).toContain("ai");
    expect(needsAnalysis(d)).toBe(false);

    // Nothing changed → no second call.
    await analyzeStale({ provider: async () => provider });
    expect(prompts).toHaveLength(1);
  });

  it("treats the analysis as stale when priorities change, and records failures without retrying at once", async () => {
    const d = await db();
    const changed = withPriorities(trip, [{ criterion: "price", level: 4, category: "stay" }]);
    await d.put("trips", changed);
    const failing = fakeProvider(() => {
      throw new Error("Gemini kotası doldu");
    });
    await analyzeStale({ provider: async () => failing.provider });
    expect(failing.prompts).toHaveLength(1);

    const items = [stay("a", "Jardim Stay", 285, 9.1, "Konum harika, hafta sonu gece gürültüsü var."), stay("b", "Casa Azul", 240, 8.8, "Sakin sokak, ev sahibi ilgili.")];
    const { decisions } = await loadDecisions(changed, items);
    const group = decisions.get("stay:porto")!;
    expect(group.analysis).toBeNull();
    expect(group.criteria).not.toContain("ai"); // a stale or failed review never counts
    expect(group.analysisFailure?.error).toContain("kotası");
    expect(needsAnalysis(group)).toBe(false); // waits before retrying...
    expect(needsAnalysis(group, Date.now(), true)).toBe(true); // ...unless asked

    await analyzeStale({ provider: async () => failing.provider });
    expect(failing.prompts).toHaveLength(1);
  });

  it("does nothing without an API key", async () => {
    const d = await db();
    await d.put("trips", withPriorities(trip, [{ criterion: "rating", level: 0, category: null }]));
    await analyzeStale({
      provider: async () => {
        throw new MissingKeyError();
      },
    });
    const [stored] = await listAnalyses("ta");
    expect(stored.error).toContain("kotası"); // the earlier failure is untouched, no new record
  });

  it("builds a prompt with priorities, preferences and every option's table", async () => {
    const items = [stay("a", "Jardim Stay", 285, 9.1, "x"), stay("b", "Casa Azul", 240, 8.8, "y")];
    const { ctx, decisions } = await loadDecisions(trip, items);
    const prompt = analysisPrompt(trip, decisions.get("stay:porto")!, { ...ctx, preferences: ["Bebekle seyahat"] });
    expect(prompt).toContain('"Fiyat":"Önemli"');
    expect(prompt).toContain("Bebekle seyahat");
    expect(prompt).toContain('"id":"b"');
  });
});
