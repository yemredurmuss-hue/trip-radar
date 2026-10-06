// Web search: the extension's call (src/lib/webSearch.ts) and the server function's rules
// (supabase/functions/web-search/shape.ts).
import { describe, expect, it } from "vitest";
import { memoryKV } from "../src/lib/share/store";
import { siteName, TIMEOUT_MS, webSearch, type SearchCache, type WebSearchResult } from "../src/lib/webSearch";
import { dailyCap, freshDays, installIdOf, normalizeQuery, readEvent, searchPrompt, shapeAnswer, yearOf } from "../supabase/functions/web-search/shape";

function memCache(): SearchCache & { data: Map<string, { result: WebSearchResult; savedAt: number }> } {
  const data = new Map<string, { result: WebSearchResult; savedAt: number }>();
  return { data, get: async (k) => data.get(k), set: async (k, v) => void data.set(k, v) };
}
const answering = (body: unknown, status = 200) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { f, calls };
};

describe("webSearch (client)", () => {
  const ok = {
    answer: "Ozora Festival 2027: 26 Temmuz – 2 Ağustos, Dádpuszta, Macaristan.",
    sources: [{ title: "ozorafestival.eu", url: "https://ozorafestival.eu/tickets" }],
    kind: "event_dates",
    cached: false,
    at: "2026-10-06T10:00:00Z",
    event: { start: "2027-07-26", end: "2027-08-02", place: "Dádpuszta, Hungary", official_url: "https://ozorafestival.eu", confidence: "high" },
  };

  it("posts only the question (with the install id) and returns the answer with its sources; asked again, the cache answers", async () => {
    const { f, calls } = answering(ok);
    const cache = memCache();
    const kv = memoryKV();
    const r = await webSearch("Ozora 2027 tarihleri", { kind: "event_dates", year: 2027, fetch: f, cache, kv });
    expect(r).toMatchObject({ answer: ok.answer, kind: "event_dates", cached: false, sources: ok.sources, event: { start: "2027-07-26" } });
    expect(calls[0].url).toBe("https://zjkesdsbructiyflzqvq.supabase.co/functions/v1/web-search");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ q: "Ozora 2027 tarihleri", lang: "tr", kind: "event_dates", year: 2027 });
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.apikey).toMatch(/^sb_publishable_/);
    expect(headers["x-install-id"]).toMatch(/^[0-9a-f-]{36}$/);
    // The same id next time.
    expect(await kv.get("installId")).toBe(headers["x-install-id"]);

    const again = await webSearch("  ozora   2027 TARİHLERİ ", { kind: "event_dates", year: 2027, fetch: f, cache, kv });
    expect(again).toMatchObject({ answer: ok.answer, cached: true });
    expect(calls).toHaveLength(1);
  });

  it("an answer kept past its days is asked again", async () => {
    const { f, calls } = answering(ok);
    const cache = memCache();
    let t = Date.parse("2026-10-06T10:00:00Z");
    await webSearch("Ozora 2027", { kind: "fact", fetch: f, cache, kv: memoryKV(), now: () => t });
    t += 8 * 864e5; // a fact: 7 days
    await webSearch("Ozora 2027", { kind: "fact", fetch: f, cache, kv: memoryKV(), now: () => t });
    expect(calls).toHaveLength(2);
  });

  it("a timeout is retried once, silently, after a short pause; a second timeout gives up: reason timeout, nothing cached", async () => {
    let tries = 0;
    const hang = ((_url: string, init: RequestInit) => {
      tries++;
      return new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)));
    }) as unknown as typeof fetch;
    const cache = memCache();
    const r = await webSearch("feribot saatleri", { fetch: hang, cache, kv: memoryKV(), timeoutMs: 20, retryPauseMs: 5 });
    expect(r).toMatchObject({ answer: null, reason: "timeout", sources: [] });
    expect(tries).toBe(2);
    expect(cache.data.size).toBe(0);
  });

  it("a cold start that times out answers on the retry", async () => {
    let tries = 0;
    const coldThenWarm = (async (_url: string, init: RequestInit) => {
      if (++tries === 1) return new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)));
      return new Response(JSON.stringify(ok), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const r = await webSearch("Ozora 2027", { kind: "event_dates", fetch: coldThenWarm, cache: memCache(), kv: memoryKV(), timeoutMs: 20, retryPauseMs: 5 });
    expect(tries).toBe(2);
    expect(r).toMatchObject({ answer: ok.answer, sources: ok.sources });
  });

  it("waits 35 s for one try (a fresh search takes 10-30 s)", () => {
    expect(TIMEOUT_MS).toBe(35_000);
  });

  it("capped and not-configured say why, and aren't kept", async () => {
    const cache = memCache();
    const capped = await webSearch("x festival dates", { fetch: answering({ answer: null, reason: "capped" }).f, cache, kv: memoryKV() });
    expect(capped).toMatchObject({ answer: null, reason: "capped" });
    const notConfigured = await webSearch("x festival dates", { fetch: answering({ answer: null, reason: "not-configured" }).f, cache, kv: memoryKV() });
    expect(notConfigured).toMatchObject({ answer: null, reason: "not-configured" });
    // Not deployed yet: the same as no key.
    expect(await webSearch("x festival dates", { fetch: answering({}, 404).f, cache, kv: memoryKV() })).toMatchObject({ reason: "not-configured" });
    expect(cache.data.size).toBe(0);
  });

  it("offline is a network miss; 'nothing found' is kept for a day", async () => {
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await webSearch("x", { fetch: offline, cache: null, kv: memoryKV() })).toMatchObject({ reason: "error" }); // too short to ask
    expect(await webSearch("xy opening hours", { fetch: offline, cache: null, kv: memoryKV() })).toMatchObject({ answer: null, reason: "network" });
    const cache = memCache();
    await webSearch("an unknown fest", { fetch: answering({ answer: null, reason: "no-result", at: "2026-10-06T10:00:00Z" }).f, cache, kv: memoryKV() });
    expect([...cache.data.values()][0].result.reason).toBe("no-result");
  });

  it("the same search asked twice while on its way: one call, one answer", async () => {
    const { f, calls } = answering(ok);
    const cache = memCache();
    const [a, b] = await Promise.all([
      webSearch("Ozora 2027 twice", { kind: "fact", fetch: f, cache, kv: memoryKV() }),
      webSearch("  ozora 2027 TWICE", { kind: "fact", fetch: f, cache, kv: memoryKV() }),
    ]);
    expect(calls).toHaveLength(1);
    expect(a).toBe(b);
  });

  it("keeps only https sources", async () => {
    const r = await webSearch("mixed sources q", {
      fetch: answering({ ...ok, sources: [{ title: "a", url: "http://a.example/" }, { title: "b", url: "https://b.example/" }, { title: "c", url: "javascript:alert(1)" }] }).f,
      cache: memCache(),
      kv: memoryKV(),
    });
    expect(r.sources).toEqual([{ title: "b", url: "https://b.example/" }]);
  });

  it("names a source by its site", () => {
    expect(siteName({ title: "uefa.com", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc" })).toBe("uefa.com");
    expect(siteName({ title: "Tickets – Ozora", url: "https://www.ozorafestival.eu/tickets" })).toBe("ozorafestival.eu");
  });
});

describe("web-search function rules", () => {
  it("normalises the question and reads kind, year, cap and install id", () => {
    expect(normalizeQuery("  Ozora   Festival\n2027  ")).toBe("ozora festival 2027");
    expect(normalizeQuery("İstanbul TARİHLERİ")).toBe("istanbul tarihleri");
    expect(normalizeQuery("a".repeat(300))).toHaveLength(200);
    expect(yearOf(2027)).toBe(2027);
    expect(yearOf("2027")).toBe(2027);
    expect(yearOf(27)).toBe(0);
    expect(freshDays("event_dates", true)).toBe(30);
    expect(freshDays("fact", true)).toBe(7);
    expect(freshDays("research", true)).toBe(3);
    expect(freshDays("event_dates", false)).toBe(1);
    expect(dailyCap(undefined)).toBe(150);
    expect(dailyCap("40")).toBe(40);
    expect(dailyCap("-3")).toBe(150);
    expect(installIdOf("6F1C2B9A-1D2E-4F3A-9B8C-7D6E5F4A3B2C")).toBe("6f1c2b9a-1d2e-4f3a-9b8c-7d6e5f4a3b2c");
    expect(installIdOf("'; drop table")).toBeNull();
  });

  it("asks for the event block only for event dates, and says nothing about the person", () => {
    const p = searchPrompt("ozora 2027 dates", "event_dates", "tr", 2027, "2026-10-06");
    expect(p).toContain("answer in Turkish");
    expect(p).toContain('"official_url"');
    expect(p).toContain("Question: ozora 2027 dates");
    expect(searchPrompt("louvre opening hours", "fact", "en", 0, "2026-10-06")).not.toContain("```json");
  });

  it("reads the Interactions API answer: text, url_citation sources, the event block taken out", () => {
    const body = {
      steps: [
        { type: "google_search_call", arguments: { queries: ["Ozora 2027"] } },
        {
          type: "model_output",
          content: [
            {
              type: "text",
              text: 'Ozora 2027 26 Temmuz – 2 Ağustos arası.\n```json\n{"start":"2027-07-26","end":"2027-08-02","place":"Dádpuszta, Hungary","official_url":"https://ozorafestival.eu","confidence":"high"}\n```',
              annotations: [
                { type: "url_citation", url: "https://ozorafestival.eu/", title: "ozorafestival.eu", start_index: 0, end_index: 10 },
                { type: "url_citation", url: "https://ozorafestival.eu/", title: "ozorafestival.eu", start_index: 11, end_index: 20 },
              ],
            },
          ],
        },
      ],
    };
    const s = shapeAnswer(body);
    expect(s.answer).toBe("Ozora 2027 26 Temmuz – 2 Ağustos arası.");
    expect(s.sources).toEqual([{ title: "ozorafestival.eu", url: "https://ozorafestival.eu/" }]);
    expect(s.event).toEqual({ start: "2027-07-26", end: "2027-08-02", place: "Dádpuszta, Hungary", official_url: "https://ozorafestival.eu/", confidence: "high" });
  });

  it("reads generateContent's grounding metadata too; NOT_FOUND is no answer", () => {
    const gc = {
      candidates: [{ content: { parts: [{ text: "Açık: 09:00–18:00." }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/x", title: "louvre.fr" } }] } }],
    };
    expect(shapeAnswer(gc)).toMatchObject({ answer: "Açık: 09:00–18:00.", sources: [{ title: "louvre.fr" }] });
    expect(shapeAnswer({ steps: [{ type: "model_output", content: [{ type: "text", text: "NOT_FOUND" }] }] })).toEqual({ answer: null, sources: [], event: null });
  });

  it("never keeps a made-up shape of date", () => {
    expect(readEvent('```json\n{"start":"late July","end":null,"place":null,"official_url":"javascript:alert(1)","confidence":"sure"}\n```')).toBeNull();
    expect(readEvent('```json\n{"start":"2027-08-02","end":"2027-07-26","place":null,"official_url":null,"confidence":"low"}\n```')).toMatchObject({ start: "2027-08-02", end: null });
  });
});
