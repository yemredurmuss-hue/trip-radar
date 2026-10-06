// The live offers source (src/lib/offerSources): what it asks the `offers` function for a need, what it keeps, and
// that a failure is simply no offers.
import { describe, expect, it } from "vitest";
import type { Need, Offer } from "../src/lib/offerSource";
import { makeLiveSource, queryOf, type StayCandidate } from "../src/lib/offerSources";
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
    expect(queryOf(flight, "tr", { prefer: "cheap", live: true })).toBe("kind=flight&from=IST&to=DPS&day=2026-11-10&adults=2&lang=tr&prefer=cheap&live=1");
  });

  it("asks an activity by its city, the days when known and the card's own words", () => {
    expect(queryOf({ key: "a", section: "activity", kind: "activity", city: "Ubud" }, "tr")).toBe("kind=activity&city=Ubud&adults=1&lang=tr");
    expect(queryOf({ key: "a", section: "activity", kind: "activity", city: "Porto", start: "2026-10-08", end: "2026-10-11", adults: 2, query: "Tekne turu" }, "en")).toBe(
      "kind=activity&city=Porto&adults=2&lang=en&start=2026-10-08&end=2026-10-11&q=Tekne+turu",
    );
    expect(queryOf({ key: "a", section: "activity", kind: "activity", city: " " }, "tr")).toBeNull();
  });

  it("asks an eSIM by its country's code and the trip's days", () => {
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: "pt", start: "2026-10-08", end: "2026-10-14" }, "tr")).toBe("kind=esim&country=PT&lang=tr&start=2026-10-08&end=2026-10-14");
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: "ID" }, "en")).toBe("kind=esim&country=ID&lang=en");
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: "Portugal" }, "tr")).toBeNull();
    expect(queryOf({ key: "e", section: "other", kind: "esim", country: null }, "tr")).toBeNull();
  });

  it("asks a way between two cities by their names and head-count", () => {
    const t: Need = { key: "t", section: "transport", kind: "transfer", from: "Lizbon", to: "Porto", start: "2026-10-08", adults: 2 };
    expect(queryOf(t, "tr")).toBe("kind=transfer&from=Lizbon&to=Porto&adults=2&lang=tr");
    expect(queryOf({ ...t, to: "lizbon" }, "tr")).toBeNull();
    expect(queryOf({ ...t, from: null }, "tr")).toBeNull();
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

  it("asks a stay's candidates apart, a flight's never", async () => {
    const calls: string[] = [];
    const cand = { id: "xo:a", name: "A" } as StayCandidate;
    const fetcher = (async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => ({ offers: [offer("a")], candidates: [cand] }) } as Response;
    }) as unknown as typeof fetch;
    const src = makeLiveSource({ kv: memoryKV(), fetcher, server: "https://srv" });
    expect(await src.candidates(stay)).toEqual([cand]);
    expect(calls[0].endsWith("&candidates=1")).toBe(true);
    expect(await src.candidates(flight)).toEqual([]);
    expect(calls).toHaveLength(1);
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
