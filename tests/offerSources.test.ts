// The live offers source (src/lib/offerSources): what it asks the `offers` function for a need, what it keeps, and
// that a failure is simply no offers.
import { describe, expect, it } from "vitest";
import type { Need, Offer } from "../src/lib/offerSource";
import { makeLiveSource, queryOf } from "../src/lib/offerSources";
import { memoryKV } from "../src/lib/share/store";

const flight: Need = { key: "f", section: "flight", kind: "flight", from: "İstanbul", to: "Denpasar", start: "2026-11-10", adults: 2 };
const stay: Need = { key: "s", section: "stay", kind: "stay", city: "Ubud", country: "ID", start: "2026-11-12", end: "2026-11-16", adults: 2 };
const offer = (id: string): Offer => ({ id, kind: "stay", title: "Maya Ubud", url: "https://tp.media/r?x", why: "", source: "Booking", fetchedAt: 1, price: 836 });

describe("the question for a need", () => {
  it("asks a flight by its airports (the codes given, else the table's) and day", () => {
    expect(queryOf(flight, "tr")).toBe("kind=flight&from=IST&to=DPS&day=2026-11-10&adults=2&lang=tr");
    expect(queryOf({ ...flight, fromCode: "SAW" }, "en")).toContain("from=SAW");
    expect(queryOf({ ...flight, to: "Bilinmeyenköy" }, "tr")).toBeNull();
    expect(queryOf({ ...flight, start: null }, "tr")).toBeNull();
  });

  it("asks a stay by its place, its country by name, its nights and head-count", () => {
    expect(queryOf(stay, "tr")).toBe("kind=stay&city=Ubud&start=2026-11-12&end=2026-11-16&adults=2&lang=tr&country=Indonesia");
    expect(queryOf({ ...stay, country: null }, "tr")).not.toContain("country");
    expect(queryOf({ ...stay, end: "2026-11-12" }, "tr")).toBeNull();
    expect(queryOf({ ...stay, city: " " }, "tr")).toBeNull();
  });

  it("narrows when the chat asks for cheaper ones or a ceiling", () => {
    expect(queryOf(stay, "tr", { prefer: "cheap", max: 80.4 })).toBe("kind=stay&city=Ubud&start=2026-11-12&end=2026-11-16&adults=2&lang=tr&country=Indonesia&prefer=cheap&max=80");
    expect(queryOf(flight, "tr", { prefer: null, max: 0 })).toBe("kind=flight&from=IST&to=DPS&day=2026-11-10&adults=2&lang=tr");
  });

  it("asks nothing for kinds with no source yet", () => {
    expect(queryOf({ key: "a", section: "activity", kind: "activity", city: "Ubud" }, "tr")).toBeNull();
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: "ID" }, "tr")).toBeNull();
  });
});

describe("asking", () => {
  const answer = (offers: Offer[], ok = true) => {
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(url);
      return { ok, json: async () => ({ offers }) } as Response;
    }) as unknown as typeof fetch;
    return { calls, fetcher };
  };

  it("asks the server once, keeps the answer for hours, asks again after", async () => {
    const kv = memoryKV();
    let t = 1_000_000;
    const { calls, fetcher } = answer([offer("a")]);
    const src = makeLiveSource({ kv, fetcher, now: () => t, server: "https://srv" });
    expect(await src.offers(stay)).toHaveLength(1);
    expect(calls[0]).toBe("https://srv/functions/v1/offers?kind=stay&city=Ubud&start=2026-11-12&end=2026-11-16&adults=2&lang=tr&country=Indonesia");
    await src.offers(stay);
    expect(calls).toHaveLength(1);
    t += 7 * 36e5;
    await src.offers(stay);
    expect(calls).toHaveLength(2);
  });

  it("the chat's find asks the narrowed question, apart from the cards' own", async () => {
    const { calls, fetcher } = answer([offer("a")]);
    const src = makeLiveSource({ kv: memoryKV(), fetcher, server: "https://srv" });
    await src.offers(stay);
    await src.find(stay, { prefer: "cheap" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("prefer=cheap");
  });

  it("two cards asking the same at once make one call", async () => {
    const { calls, fetcher } = answer([offer("a")]);
    const src = makeLiveSource({ kv: memoryKV(), fetcher, server: "https://srv" });
    await Promise.all([src.offers(stay), src.offers({ ...stay, key: "other" })]);
    expect(calls).toHaveLength(1);
  });

  it("a failing or unconfigured server is no offers; a need it can't search asks nothing", async () => {
    const down = answer([], false);
    expect(await makeLiveSource({ kv: memoryKV(), fetcher: down.fetcher }).offers(stay)).toEqual([]);
    const thrown = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await makeLiveSource({ kv: memoryKV(), fetcher: thrown }).offers(stay)).toEqual([]);
    const idle = answer([offer("a")]);
    expect(await makeLiveSource({ kv: memoryKV(), fetcher: idle.fetcher }).offers({ ...stay, city: null })).toEqual([]);
    expect(idle.calls).toHaveLength(0);
  });
});
