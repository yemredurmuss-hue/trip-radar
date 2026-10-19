import { describe, expect, it, vi } from "vitest";
import { offerCard } from "../src/lib/collectionCards";
import { makeLiveSource } from "../src/lib/offerSources";

const ev = (id: string, url = "https://www.eventbrite.com/e/1") => ({ id, kind: "activity", title: "Noite de poesia", photo: null, price: null, currency: "EUR", url, why: "23 Eki · 19:30", source: "eventbrite.com", fetchedAt: 1, meta: "Casa da Horta" });

describe("what's on in a city on the stay's days (spec 2026-10-19 SerpApi, item 8)", () => {
  it("asks the offers function once a day per city and days, keeping only real activities", async () => {
    const store = new Map<string, unknown>();
    const kv = { get: async <T,>(k: string) => store.get(k) as T | undefined, set: async (k: string, v: unknown) => void store.set(k, v) };
    const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify({ offers: [ev("e1"), ev("e2", "http://x"), { ...ev("e3"), kind: "stay" }] })));
    let now = 1_000;
    const src = makeLiveSource({ kv: kv as never, fetcher: fetcher as never, now: () => now, server: "https://x.supabase.co" });
    const [a] = await Promise.all([src.events("Porto", "2026-10-20", "2026-10-31"), src.events("Porto", "2026-10-20", "2026-10-31")]);
    expect(a.map((o) => o.id)).toEqual(["e1"]);
    expect(a[0]).toMatchObject({ why: "23 Eki · 19:30", meta: "Casa da Horta", source: "eventbrite.com" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe("https://x.supabase.co/functions/v1/offers?kind=events&city=Porto&start=2026-10-20&end=2026-10-31&lang=tr");
    now += 23 * 36e5;
    await src.events("Porto", "2026-10-20", "2026-10-31");
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 2 * 36e5;
    await src.events("Porto", "2026-10-20", "2026-10-31");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("says its day, hour and place on the tile, as it has no price", () => {
    expect(offerCard(ev("ev:2026-10-23:x") as never, 2).line).toBe("23 Eki · 19:30 · Casa da Horta");
    expect(offerCard({ ...ev("v1"), price: 60 } as never, 2).line).toBe("€30 kişi başı");
  });
});
