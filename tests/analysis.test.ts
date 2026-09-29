import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { analysisPrompt, analyzeStale, loadDecisions, needsAnalysis, type AnalysisOutput } from "../src/lib/analysis";
import { db, listAnalyses } from "../src/lib/db";
import { withPriorities } from "../src/lib/decision";
import { EMPTY_METRICS } from "../src/lib/items";
import type { Listing } from "../src/lib/types";
import { MissingKeyError, type LlmProvider } from "../src/lib/llm";
import type { Item, Trip } from "../src/lib/types";

const STAY = "stay@2026-10-08_2026-10-11"; // stays are compared by exact nights

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
  eliminations: [],
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
    const d = decisions.get(STAY)!;
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
    const group = decisions.get(STAY)!;
    expect(group.analysis).toBeNull();
    expect(group.criteria).not.toContain("ai"); // a stale or failed review never counts
    expect(group.analysisFailure?.error).toContain("kotası");
    // The failure didn't wipe the last good advice: it stays, marked as made for earlier inputs.
    expect(group.staleAnalysis?.verdict).toContain("Jardim");
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
    const prompt = analysisPrompt(trip, decisions.get(STAY)!, { ...ctx, preferences: ["Bebekle seyahat"] });
    expect(prompt).toContain('"Fiyat":"Önemli"');
    expect(prompt).toContain("Bebekle seyahat");
    expect(prompt).toContain('"id":"b"');
  });
});

describe("eliminations", () => {
  const TODAY = new Date().toISOString().slice(0, 10);
  const month = TODAY.slice(0, 7);
  const listing = (key: string, findings: Listing["findings"], reviews: Listing["reviews"] = []): Listing => ({
    key, name: key, reviews, reviewTotal: null, findings, readCaptureIds: ["c"], readAt: 1, dropped: 0, error: null, errorAt: null, updatedAt: 1,
  });
  const construction = {
    id: "condition:negative:x1", text: "Yan binada inşaat gürültüsü", polarity: "negative" as const, topic: "condition" as const,
    source: "reviews" as const, severity: "high" as const, reviewIds: ["r1", "r2"], quotes: [], verified: true,
  };

  async function setup(findings: Listing["findings"], acceptedFindings?: string[]) {
    const d = await db();
    const t: Trip = { ...trip, id: "te", acceptedFindings };
    await d.put("trips", t);
    const a = { ...stay("ea", "Jardim Stay", 285, 8.6, "Konum iyi"), tripId: "te" };
    const b = { ...stay("eb", "Casa Azul", 240, 9.3, "Geniş"), tripId: "te" };
    await d.put("items", a);
    await d.put("items", b);
    await d.put(
      "listings",
      listing("item:ea", [
        { id: "noise:positive:q", text: "Sessiz sokak", polarity: "positive", topic: "noise", source: "description", severity: "low", reviewIds: [], quotes: ["quiet street"], verified: true },
      ]),
    );
    await d.put(
      "listings",
      listing("item:eb", findings, [
        { id: "r1", text: "Construction next door every morning", date: month, captureId: "c" },
        { id: "r2", text: "Very noisy building work", date: month, captureId: "c" },
      ]),
    );
    return { t, items: [a, b] };
  }

  it("rules an option out only with verified, recent findings, and never for what the traveller accepted", async () => {
    const { t, items } = await setup([construction]);
    const before = (await loadDecisions(t, items)).decisions.get(STAY)!;
    expect(before.options[0].item.name).toBe("Casa Azul"); // cheaper and better rated on the numbers
    expect(before.criteria).toContain("details"); // ...and its findings are part of the score

    const { provider, prompts } = fakeProvider(() =>
      output({
        verdict: "Jardim Stay, çünkü Casa Azul'da inşaat var.",
        ai_scores: [],
        eliminations: [{ item_id: "eb", reason: "Yan binada inşaat; sessizlik istiyorsun.", finding_ids: [construction.id, "made-up"] }],
      }),
    );
    await analyzeStale({ provider: async () => provider });
    expect(prompts.at(-1)).toContain("Yan binada inşaat gürültüsü");
    expect(prompts.at(-1)).toContain('"count":2');

    const after = (await loadDecisions(t, items)).decisions.get(STAY)!;
    const casa = after.options.find((o) => o.item.id === "eb")!;
    expect(casa.eliminated?.reason).toBe("Yan binada inşaat; sessizlik istiyorsun");
    expect(after.winner?.item.name).toBe("Jardim Stay");
    expect(after.summary).toContain("Casa Azul elendi");

    // New options change the inputs; the elimination still rests on the same findings, so it holds.
    const extra = { ...stay("ec", "Ribeira Rooms", 330, 9.0, ""), tripId: "te" };
    const later = (await loadDecisions(t, [...items, extra])).decisions.get(STAY)!;
    expect(later.analysis).toBeNull();
    expect(later.options.find((o) => o.item.id === "eb")!.eliminated).not.toBeNull();

    // "Sorun değil": the same finding no longer rules it out.
    const accepted = { ...t, acceptedFindings: ["item:eb#condition:negative"] };
    const fine = (await loadDecisions(accepted, items)).decisions.get(STAY)!;
    expect(fine.options.find((o) => o.item.id === "eb")!.eliminated).toBeNull();
    expect(fine.checks).toEqual([]);
  });

  it("shows an elimination the evidence doesn't back as something to check, not a verdict", async () => {
    const unverified = { ...construction, id: "condition:negative:x2", reviewIds: [], verified: false };
    const { t, items } = await setup([unverified]);
    const { provider } = fakeProvider(() =>
      output({ ai_scores: [], eliminations: [{ item_id: "eb", reason: "İnşaat var", finding_ids: [unverified.id] }] }),
    );
    await analyzeStale({ provider: async () => provider });
    const d = (await loadDecisions(t, items)).decisions.get(STAY)!;
    expect(d.options.find((o) => o.item.id === "eb")!.eliminated).toBeNull();
    expect(d.checks).toEqual([{ itemId: "eb", reason: "İnşaat var" }]);
  });
});
