import { describe, expect, it, vi } from "vitest";
import { foldName, matchSight, sightRating, sightSuggestion, validSights, type Sight } from "../src/lib/citySights";
import { collectionRow, suggestionCard } from "../src/lib/collectionCards";
import { makeLiveSource } from "../src/lib/offerSources";
import { makeItem } from "./fixtures/makeItem";

// Trimmed from Google's real Top Sights for "Porto gezilecek yerler" (19 Oct 2026).
const sights: Sight[] = [
  { title: "Luís I Bridge", rating: 4.8, photo: "https://lh3.googleusercontent.com/a" },
  { title: "Clérigos Kilisesi", rating: 4.6, photo: "https://lh3.googleusercontent.com/b" },
  { title: "Livraria Lello", rating: 4.3, photo: "https://lh3.googleusercontent.com/c" },
  { title: "Bolhão Market", rating: 4.5, photo: null },
];

describe("a city's sights from Google (spec 2026-10-19 SerpApi, item 3)", () => {
  it("keeps what the server sent when well-formed", () => {
    expect(validSights([{ title: "A", rating: 4.2, photo: "https://x" }, { title: "" }, { title: "B", rating: 7, photo: "http://y" }])).toEqual([
      { title: "A", rating: 4.2, photo: "https://x" },
      { title: "B", rating: null, photo: null },
    ]);
    expect(validSights("x")).toEqual([]);
  });
  it("finds the sight an idea is about by its name, never by a shared word", () => {
    expect(foldName("Clérigos Kilisesi")).toBe("clerigos kilisesi");
    expect(matchSight(["Livraria Lello"], sights)?.title).toBe("Livraria Lello");
    expect(matchSight(["Livraria Lello Kitapçısı"], sights)?.title).toBe("Livraria Lello");
    expect(matchSight(["Clerigos Kilisesi"], sights)?.rating).toBe(4.6);
    expect(matchSight(["Porto"], sights)).toBeNull();
    expect(matchSight(["Clérigos Kulesi"], sights)).toBeNull();
  });
  it("turns a sight into a Google idea with its photo and rating on the card", () => {
    const s = sightSuggestion("Porto", sights[1], 1);
    expect(s).toMatchObject({ key: "sight:porto:clerigos-kilisesi", section: "todo", template: "todo", source: "rule", payload: { city: "Porto", place: "Clérigos Kilisesi, Porto", from: "google", rating: 4.6 } });
    const card = suggestionCard(s, "todo");
    expect(card).toMatchObject({ family: "place", photo: "https://lh3.googleusercontent.com/b", badge: { text: "Google" }, rating: "★ 4,6", tag: "Gezilecek" });
    expect(sightRating(null)).toBeNull();
  });
  it("fills a city's places to see up to three, none already there", () => {
    const majestic = makeItem({ id: "m", category: "food", name: "Majestic Café", status: "saved" });
    const lello = makeItem({ id: "l", category: "activity", name: "Livraria Lello", status: "saved" });
    const vm = { section: "todo" as const, itemIds: ["m", "l"], planned: [], wanted: [], suggestions: [] };
    const byId = new Map([["m", majestic], ["l", lello]]);
    const row = collectionRow(vm, byId, { trip: { intent: null } as never, people: 2, ctx: undefined, sights: sights.map((s) => sightSuggestion("Porto", s, 1)) } as never);
    // Lello is saved already (one place to see), so two of Google's come, Lello not again.
    const google = row.ideas.filter((c) => c.badge?.text === "Google").map((c) => c.title);
    expect(google).toEqual(["Luís I Bridge", "Clérigos Kilisesi"]);
    expect(collectionRow({ ...vm, section: "activity" as never }, byId, { trip: { intent: null } as never, people: 2, ctx: undefined, sights: sights.map((s) => sightSuggestion("Porto", s, 1)) } as never).ideas.some((c) => c.badge?.text === "Google")).toBe(false);
  });
  it("asks the offers function once per city and keeps the answer 30 days", async () => {
    const store = new Map<string, unknown>();
    const kv = { get: async <T,>(k: string) => store.get(k) as T | undefined, set: async (k: string, v: unknown) => void store.set(k, v) };
    const fetcher = vi.fn(async (_url: string) => new Response(JSON.stringify({ sights })));
    let now = 1_000;
    const src = makeLiveSource({ kv: kv as never, fetcher: fetcher as never, now: () => now, server: "https://x.supabase.co" });
    const [a] = await Promise.all([src.sights("Porto"), src.sights("Porto")]);
    expect(a).toHaveLength(4);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe("https://x.supabase.co/functions/v1/offers?kind=sights&city=Porto&lang=tr");
    now += 29 * 864e5;
    await src.sights("Porto");
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 2 * 864e5;
    await src.sights("Porto");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
