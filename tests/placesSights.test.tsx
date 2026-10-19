// The merge of 0.38.10's Google sights (citySights.ts) with 0.39.1's Google Maps places (placeSuggest.findPlace): one
// lookup per card, the same place never drawn twice, the rating drawn once. Every answer here is made up; nothing is
// asked out.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { serpPlaces } from "../supabase/functions/offers/shape";
import { SuggestCard } from "../src/app/plan/v82/KCard";
import { sightSuggestion, type Sight } from "../src/lib/citySights";
import { collectionRow, placePhotoCredit, suggestionCard } from "../src/lib/collectionCards";
import { findPlace } from "../src/lib/placeSuggest";
import { checkSuggestionInput } from "../src/lib/suggestions";
import type { Suggestion } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const idea = (title: string, place: string): Suggestion =>
  checkSuggestionInput({ section: "todo", kind: "add", title, why: "Şehrin simgesi.", template: "todo", city: "Porto", start: "", end: "", place }, "ai", 1) as Suggestion;

const sights: Sight[] = [
  { title: "Luís I Bridge", rating: 4.8, photo: "https://lh3.googleusercontent.com/a" },
  { title: "Livraria Lello", rating: 4.3, photo: "https://lh3.googleusercontent.com/c" },
  { title: "Bolhão Market", rating: 4.5, photo: null },
];

describe("a suggested place: Google Maps, the city's Google sights, then Wikipedia", () => {
  it("a place the city's sights list with a photo takes Google's photo and rating, and Maps isn't searched", async () => {
    const s = idea("Livraria Lello Kitapçısı", "Livraria Lello Kitapçısı, Porto");
    const places = vi.fn(async () => []);
    const wiki = vi.fn(async () => null);
    const found = await findPlace(s, { places, fetchJson: wiki, sights: async () => sights });
    expect(places).not.toHaveBeenCalled();
    expect(wiki).not.toHaveBeenCalled();
    expect(found).toEqual({ photo: { url: "https://lh3.googleusercontent.com/c", page: null }, credit: "Google", rating: 4.3, reviews: null, map: null, sight: true });
    // The card: Google's rating once, on the picture; the grey line is the why alone.
    const html = renderToStaticMarkup(<SuggestCard card={suggestionCard(s, "todo")} onPut={() => {}} onDismiss={() => {}} />);
    expect(html.match(/★ 4,3/g)).toHaveLength(1);
    expect(html).toContain('class="z-prate"');
    expect(html).toContain("Fotoğraf: Google");
  });

  it("Maps' place wins over a sight without a photo: its photo, rating and reviews, once, in the grey line", async () => {
    const s = idea("Bolhão Pazarı", "Bolhão Market, Porto");
    const maps = serpPlaces({ place_results: { title: "Bolhão Market", place_id: "bm", rating: 4.4, reviews: 3210, thumbnail: "https://lh5.googleusercontent.com/p/B=w122-h92-k-no" } }, 1);
    const found = await findPlace(s, { places: async () => maps, fetchJson: async () => null, sights: async () => sights });
    expect(found).toMatchObject({ credit: "Google Maps", rating: 4.4, reviews: 3210, map: maps[0].url });
    expect(found?.sight).toBeUndefined();
    const html = renderToStaticMarkup(<SuggestCard card={suggestionCard(s, "todo")} onPut={() => {}} onDismiss={() => {}} />);
    expect(html).toContain("★ 4,4 · 3.210 yorum");
    expect(html).not.toContain('class="z-prate"');
    expect(html.match(/★/g)).toHaveLength(1);
  });

  it("neither Maps nor a sight's photo: Wikipedia's photo with the sight's rating", async () => {
    const s = idea("Bolhão", "Bolhão Market Hall, Porto");
    const page = { type: "standard", coordinates: { lat: 41.1, lon: -8.6 }, thumbnail: { source: "https://upload.wikimedia.org/x/320px-B.jpg" }, content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/B" } } };
    const found = await findPlace(s, { places: async () => [], fetchJson: async () => page, sights: async () => sights });
    expect(found).toMatchObject({ credit: "Wikipedia", rating: 4.5, reviews: null, sight: true });
  });

  it("names the photo's source", () => {
    expect(placePhotoCredit("Google Maps")).toBe("Fotoğraf: Google Haritalar");
    expect(placePhotoCredit("Google")).toBe("Fotoğraf: Google");
    expect(placePhotoCredit("Wikipedia")).toBe("Fotoğraf: Wikipedia");
    expect(placePhotoCredit(null)).toBeUndefined();
  });
});

describe("Yapılacaklar' ideas: Google's sights fill in without repeating a place", () => {
  it("a sight an AI idea holds by name (its Maps name too) isn't drawn again; the row still stops at four", () => {
    const lello = idea("Livraria Lello Kitapçısı", "Livraria Lello Kitapçısı, Porto");
    const bridge = idea("Köprü yürüyüşü", "Luís I Bridge, Porto");
    const vm = { section: "todo" as const, itemIds: [], planned: [], wanted: [], suggestions: [lello, bridge] };
    const row = collectionRow(vm, new Map(), { trip: { intent: null } as never, people: 2, ctx: undefined, sights: sights.map((s) => sightSuggestion("Porto", s, 1)) } as never);
    const titles = row.ideas.map((c) => c.title);
    expect(titles.filter((t) => /Lello/.test(t))).toHaveLength(1);
    expect(titles.filter((t) => /Bridge|Köprü/.test(t))).toHaveLength(1);
    expect(row.ideas.filter((c) => c.badge?.text === "Google").map((c) => c.title)).toEqual(["Bolhão Market"]);
  });
  it("a record on the plan by the sight's name keeps it away", () => {
    const saved = makeItem({ id: "b", category: "activity", name: "Luís I Bridge", status: "saved" });
    const vm = { section: "todo" as const, itemIds: ["b"], planned: [], wanted: [], suggestions: [] };
    const row = collectionRow(vm, new Map([["b", saved]]), { trip: { intent: null } as never, people: 2, ctx: undefined, sights: sights.map((s) => sightSuggestion("Porto", s, 1)) } as never);
    expect(row.ideas.filter((c) => c.badge?.text === "Google").map((c) => c.title)).toEqual(["Livraria Lello", "Bolhão Market"]);
  });
});
