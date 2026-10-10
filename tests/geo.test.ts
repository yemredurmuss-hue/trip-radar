// Free geocoding (Nominatim): at most one request a second, one request per place however often it's asked.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { geocode } from "../src/lib/geo";

afterEach(() => vi.unstubAllGlobals());

describe("geocode", () => {
  it("asks one place once and never more than once a second, even while answers are slow", async () => {
    const calls: { q: string; at: number }[] = [];
    const t0 = Date.now();
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push({ q: decodeURIComponent(url.split("q=")[1]), at: Date.now() - t0 });
      await new Promise((r) => setTimeout(r, 150));
      return { ok: true, json: async () => [{ lat: "1", lon: "2" }] };
    });
    // The board asks for each place it can't place, and asks again as it re-renders.
    const asked = ["Sintra", "Hallstatt", "Sintra", "Giethoorn", "Hallstatt", "sintra "].map((q) => geocode(q));
    const answers = await Promise.all(asked);
    expect(answers.every((a) => a?.lat === 1 && a.lng === 2)).toBe(true);
    expect(calls.map((c) => c.q)).toEqual(["Sintra", "Hallstatt", "Giethoorn"]);
    for (let i = 1; i < calls.length; i++) expect(calls[i].at - calls[i - 1].at).toBeGreaterThanOrEqual(1000);
    // Known now: from the cache, no request.
    await geocode("Giethoorn");
    expect(calls).toHaveLength(3);
  }, 10_000);
});
