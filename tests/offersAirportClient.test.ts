// The extension's side of offers kind=airport and kind=pageimage (2026-10-25): a town's airport asked once and kept, then
// known to the flights' needs; a page's picture the same way; the server's failure is never kept.
import { describe, expect, it } from "vitest";
import { makeLiveSource } from "../src/lib/offerSources";
import { airportCode, learnAirport } from "../src/lib/searchLinks";

const memoryKV = () => {
  const m = new Map<string, unknown>();
  return { get: async <T,>(k: string) => (m.get(k) as T) ?? null, set: async (k: string, v: unknown) => void m.set(k, v) };
};

describe("a town's airport from the server", () => {
  it("asked once, kept, and answered from what was kept", async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string) => (asked.push(url), new Response(JSON.stringify({ airport: { code: "RNO", city: "RNO" } })))) as unknown as typeof fetch;
    const kv = memoryKV();
    const source = makeLiveSource({ kv, fetcher, server: "https://srv" });
    expect(await source.airport("Reno", "us")).toBe("RNO");
    expect(asked[0]).toMatch(/kind=airport&q=Reno&cc=US/);
    expect(await makeLiveSource({ kv, fetcher, server: "https://srv" }).airport("Reno", "us")).toBe("RNO");
    expect(asked).toHaveLength(1);
  });
  it("none found, or the server failing: null, and asked again next time", async () => {
    let n = 0;
    const fetcher = (async () => (n++, new Response(JSON.stringify({ error: "failed" }), { status: 502 }))) as unknown as typeof fetch;
    const source = makeLiveSource({ kv: memoryKV(), fetcher, server: "https://srv" });
    expect(await source.airport("Merzouga", "MA")).toBeNull();
    expect(await source.airport("Merzouga", "MA")).toBeNull();
    expect(n).toBe(2);
  });
  it("a learned airport is the town's code for the flights' needs", () => {
    expect(airportCode("Merzouga")).toBeNull();
    learnAirport("Merzouga", "ERH");
    expect(airportCode("Merzouga")).toBe("ERH");
    learnAirport("Nowhere", "not a code");
    expect(airportCode("Nowhere")).toBeNull();
  });
  it("a page's picture: only an https address", async () => {
    const fetcher = (async (url: string) => new Response(JSON.stringify({ image: url.includes("good") ? "https://cdn.x.org/a.jpg" : "http://x.org/a.jpg" }))) as unknown as typeof fetch;
    const source = makeLiveSource({ kv: memoryKV(), fetcher, server: "https://srv" });
    expect(await source.pageImage("https://good.org/")).toBe("https://cdn.x.org/a.jpg");
    expect(await source.pageImage("https://bad.org/")).toBeNull();
  });
});
