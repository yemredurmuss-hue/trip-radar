// 0.39.1 (Emre's Bali trip, Sabin ile, romantik, doğa; Canggu): Yapılacaklar ve restoranlar' AI suggestions with Google
// Maps' own photo, rating and page (the offers function's kind=place, SerpApi's google_maps search), the Wikipedia photo
// when the function doesn't answer with places (not deployed yet), and the review asked by what the trip is for: who goes,
// the budget and real places found on Maps for its kinds of place. Every answer here is made up; nothing is asked out.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mapsPhoto, mapsPlaceUrl, PLACE_MAX, placeSearchOk, serpPlaces } from "../supabase/functions/offers/shape";
import { SuggestCard } from "../src/app/plan/v82/KCard";
import { placeRatingLine, suggestionCard } from "../src/lib/collectionCards";
import type { LlmProvider } from "../src/lib/llm";
import { makeLiveSource, type MapsPlace, PLACE_SEARCH_MAX, placeQueryOf, placeSearches } from "../src/lib/offerSources";
import { findPlace, knownPlace, mapsIdeas, samePlace, stayTown, withPlacePhoto } from "../src/lib/placeSuggest";
import { memoryKV } from "../src/lib/share/store";
import { reviewPrompt, reviewSystem, runReview, tripTaste, withMapsPlaces } from "../src/lib/suggestReview";
import { checkSuggestionInput, suggestedItem } from "../src/lib/suggestions";
import type { Suggestion, Trip } from "../src/lib/types";

const suggestion = (title: string, place: string, section = "todo"): Suggestion =>
  checkSuggestionInput({ section, kind: "add", title, why: "Canggu'ya yakın ve planda yok.", template: section, city: "Canggu", start: "", end: "", place }, "ai", 1) as Suggestion;

// Trimmed from the shape of SerpApi's google_maps answer (type=search).
const tanahLot = {
  title: "Tanah Lot",
  place_id: "ChIJx9Lr6tQ30i0RkP1gD2o",
  data_id: "0x2dd237d4eaebd2c7:0x9d4b",
  address: "Beraban, Kediri, Tabanan Regency, Bali",
  rating: 4.6,
  reviews: 61234,
  type: "Hindu temple",
  thumbnail: "https://lh5.googleusercontent.com/p/AF1QipN=w122-h92-k-no",
  gps_coordinates: { latitude: -8.6212, longitude: 115.0868 },
};
const listBody = {
  search_metadata: { status: "Success" },
  local_results: [
    { title: "La Brisa", place_id: "p1", rating: 4.5, reviews: 9821, type: "Restaurant", thumbnail: "https://lh5.googleusercontent.com/p/a=w80-h106-k-no", gps_coordinates: { latitude: -8.65, longitude: 115.12 } },
    { title: "Mason", place_id: "p2", rating: 4.7, reviews: 2210, thumbnail: "http://insecure/x.jpg" },
    { title: "No id here", rating: 4.9 },
    { title: "  ", place_id: "p3" },
    { title: "Shady Shack", place_id: "p4", address: "Jl. Tanah Barak No.57, Canggu" },
  ],
};

describe("the offers function's places (SerpApi google_maps, made-up answers)", () => {
  it("takes Maps' list in its order, only with a name and a place id, what Maps said and nothing else", () => {
    const list = serpPlaces(listBody, 7);
    expect(list.map((p) => p.name)).toEqual(["La Brisa", "Mason", "Shady Shack"]);
    expect(list[0]).toEqual({
      id: "p1",
      dataId: null,
      name: "La Brisa",
      address: null,
      rating: 4.5,
      reviews: 9821,
      photo: "https://lh5.googleusercontent.com/p/a=w480-h360-k-no",
      geo: { lat: -8.65, lng: 115.12 },
      type: "Restaurant",
      url: "https://www.google.com/maps/search/?api=1&query=La%20Brisa&query_place_id=p1",
      source: "Google Maps",
      fetchedAt: 7,
    });
    // An http photo isn't shown; no rating, reviews or place: null, never made up.
    expect(list[1].photo).toBeNull();
    expect(list[2]).toMatchObject({ rating: null, reviews: null, photo: null, geo: null, address: "Jl. Tanah Barak No.57, Canggu" });
  });
  it("a search by a place's name that Maps found as one place is that place", () => {
    const [p] = serpPlaces({ place_results: tanahLot }, 1);
    expect(p).toMatchObject({ id: tanahLot.place_id, dataId: tanahLot.data_id, name: "Tanah Lot", rating: 4.6, reviews: 61234, geo: { lat: -8.6212, lng: 115.0868 } });
    expect(p.url).toBe(mapsPlaceUrl("Tanah Lot", tanahLot.place_id));
  });
  it("is none for no answer (no key, over the day's cap) or an empty one; at most a few", () => {
    expect(serpPlaces(null, 1)).toEqual([]);
    expect(serpPlaces({ error: "Google hasn't returned any results" }, 1)).toEqual([]);
    const many = { local_results: Array.from({ length: 20 }, (_, i) => ({ title: `P${i}`, place_id: `id${i}` })) };
    expect(serpPlaces(many, 1)).toHaveLength(PLACE_MAX);
  });
  it("searches only plain words, and sizes Google's own photos for a card", () => {
    expect(placeSearchOk(" Tanah Lot Temple,  Tabanan ")).toBe("Tanah Lot Temple, Tabanan");
    expect(placeSearchOk("romantic restaurants in Canggu")).toBe("romantic restaurants in Canggu");
    expect(placeSearchOk("<script>")).toBeNull();
    expect(placeSearchOk("x".repeat(101))).toBeNull();
    expect(mapsPhoto("https://serpapi.com/searches/abc/images/1.jpeg")).toBe("https://serpapi.com/searches/abc/images/1.jpeg");
    expect(mapsPhoto(undefined)).toBeNull();
  });
});

describe("the live source's place search", () => {
  const answer = (body: unknown, asked: string[]) =>
    (async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify(body));
    }) as unknown as typeof fetch;

  it("asks kind=place with the words and the language, and keeps the answer", async () => {
    expect(placeQueryOf("Tanah Lot Temple, Tabanan", "en")).toBe("kind=place&q=Tanah+Lot+Temple%2C+Tabanan&lang=en");
    expect(placeQueryOf("a<b", "en")).toBeNull();
    const asked: string[] = [];
    const src = makeLiveSource({ kv: memoryKV(), fetcher: answer({ offers: [], places: serpPlaces(listBody, 1) }, asked), server: "https://x" });
    expect((await src.places("romantic restaurants in Canggu")).map((p) => p.name)).toEqual(["La Brisa", "Mason", "Shady Shack"]);
    await src.places("romantic restaurants in Canggu");
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatch(/^https:\/\/x\/functions\/v1\/offers\?kind=place&q=romantic\+restaurants\+in\+Canggu&lang=/);
  });
  it("is none from a function without places (not deployed yet: it says 'ask', or answers offers only)", async () => {
    const old = makeLiveSource({ kv: memoryKV(), fetcher: (async () => new Response(JSON.stringify({ error: "ask" }), { status: 400 })) as unknown as typeof fetch, server: "https://x" });
    expect(await old.places("Tanah Lot Temple, Tabanan")).toEqual([]);
    const bare = makeLiveSource({ kv: memoryKV(), fetcher: answer({ offers: [] }, []), server: "https://x" });
    expect(await bare.places("Tanah Lot Temple, Tabanan")).toEqual([]);
  });
});

describe("a suggested place's card: Google Maps first, else Wikipedia", () => {
  const maps = serpPlaces({ place_results: tanahLot }, 1);
  const wikiPage = {
    type: "standard",
    coordinates: { lat: -8.62, lon: 115.09 },
    thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Echo.jpg/330px-Echo.jpg" },
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Echo_Beach" } },
  };

  it("takes Maps' photo, rating, reviews and own page; Wikipedia isn't asked", async () => {
    const s = suggestion("Tanah Lot Tapınağı", "Tanah Lot Temple, Tabanan");
    const searched: string[] = [];
    const wiki = vi.fn(async () => null);
    const found = await findPlace(s, { places: async (q) => (searched.push(q), maps), fetchJson: wiki });
    expect(searched).toEqual(["Tanah Lot Temple, Tabanan"]);
    expect(wiki).not.toHaveBeenCalled();
    expect(found).toEqual({
      photo: { url: "https://lh5.googleusercontent.com/p/AF1QipN=w480-h360-k-no", page: maps[0].url },
      credit: "Google Maps",
      rating: 4.6,
      reviews: 61234,
      map: maps[0].url,
    });
    // The card shows them: the rating and reviews before the why, "Haritada aç" on Maps' own page.
    expect(knownPlace(s)).toEqual(found);
    const html = renderToStaticMarkup(<SuggestCard card={suggestionCard(s, "todo")} onPut={() => {}} onDismiss={() => {}} />);
    expect(placeRatingLine("Canggu'ya yakın ve planda yok.", 4.6, 61234)).toBe("★ 4,6 · 61.234 yorum · Canggu'ya yakın ve planda yok.");
    expect(placeRatingLine("Neden", null, 120)).toBe("Neden");
    expect(html).toContain("★ 4,6 · 61.234 yorum · Canggu");
    expect(html).toContain(`href="${maps[0].url.replace(/&/g, "&amp;")}"`);
    expect(html).toContain("Fotoğraf: Google Haritalar");
    // Put on the plan, the record keeps the photo and the place's own page.
    const item = suggestedItem(withPlacePhoto(s, found!.photo!.url, found!.map), "t1", "i1", 1)!;
    expect(item).toMatchObject({ url: maps[0].url, imageUrl: found!.photo!.url });
  });

  it("the function without places (not deployed): today's Wikipedia photo, no rating, the card's Maps search", async () => {
    const s = suggestion("Echo Beach", "Echo Beach, Canggu");
    const src = makeLiveSource({ kv: memoryKV(), fetcher: (async () => new Response(JSON.stringify({ offers: [] }))) as unknown as typeof fetch, server: "https://x" });
    const wikiAsked: string[] = [];
    const found = await findPlace(s, { places: src.places, fetchJson: async (url) => (wikiAsked.push(url), url.includes("Echo_Beach") ? wikiPage : null) });
    expect(wikiAsked[0]).toContain("/page/summary/Echo_Beach");
    expect(found).toEqual({
      photo: { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Echo.jpg/480px-Echo.jpg", page: "https://en.wikipedia.org/wiki/Echo_Beach" },
      credit: "Wikipedia",
      rating: null,
      reviews: null,
      map: null,
    });
    const card = suggestionCard(s, "todo");
    const html = renderToStaticMarkup(<SuggestCard card={card} onPut={() => {}} onDismiss={() => {}} />);
    expect(html).not.toContain("★");
    expect(html).toContain("Fotoğraf: Wikipedia");
    expect(html).toContain(`href="${card.map!.replace(/&/g, "&amp;")}"`);
  });

  it("another place Maps answered with isn't taken for this one; nothing anywhere: the drawing", async () => {
    const s = suggestion("Warung Bu Mi", "Warung Bu Mi, Canggu", "food");
    expect(samePlace(s, "Warung Bu Mi")).toBe(true);
    expect(samePlace(s, "Warung Made")).toBe(false);
    expect(samePlace(suggestion("Tanah Lot Tapınağı", "Tanah Lot Temple, Tabanan"), "Pura Tanah Lot")).toBe(true);
    const other: MapsPlace[] = serpPlaces({ local_results: [{ title: "Warung Made", place_id: "wm", rating: 4.2, reviews: 10 }] }, 1);
    expect(await findPlace(s, { places: async () => other, fetchJson: async () => null })).toBeNull();
  });

  it("a place the trip's kinds of place found needs no search of its own", async () => {
    const trip: Pick<Trip, "intent" | "style" | "travellers"> = { style: { key: "k", ids: ["romantic", "nature"] }, travellers: { names: ["Sabin"] } };
    const searched: string[] = [];
    const ideas = await mapsIdeas(trip, "Canggu", async (q) => (searched.push(q), q.startsWith("romantic") ? serpPlaces(listBody, 1) : []));
    expect(searched).toEqual(["romantic restaurants in Canggu", "waterfalls near Canggu"]);
    // Only the kinds Maps had places for go to the review.
    expect(ideas).toEqual({ "romantic restaurants in Canggu": ["La Brisa", "Mason", "Shady Shack"] });
    const s = suggestion("La Brisa", "La Brisa, Canggu", "food");
    const places = vi.fn(async () => [] as MapsPlace[]);
    expect(await findPlace(s, { places, fetchJson: async () => null })).toMatchObject({ rating: 4.5, reviews: 9821, map: "https://www.google.com/maps/search/?api=1&query=La%20Brisa&query_place_id=p1", credit: "Google Maps" });
    expect(places).not.toHaveBeenCalled();
  });
});

describe("what the trip is for, as Maps searches (placeSearches)", () => {
  it("Sabin ile, romantik, doğa in Canggu: romantic restaurants and waterfalls, two at most", () => {
    expect(placeSearches({ style: { key: "k", ids: ["romantic", "nature"] }, travellers: { names: ["Sabin"] } }, "Canggu")).toEqual(["romantic restaurants in Canggu", "waterfalls near Canggu"]);
    expect(PLACE_SEARCH_MAX).toBe(2);
    // The trip's kind first (a surf trip: surf spots), then its style; children: family friendly places.
    expect(placeSearches({ intent: { playbook: "custom", label: "Sörf tatili" }, style: { key: "k", ids: ["beach", "nature"] } }, "Ahangama")).toEqual(["surf spots in Ahangama", "beaches in Ahangama"]);
    expect(placeSearches({ intent: { playbook: "honeymoon" } }, "Ubud")).toEqual(["romantic restaurants in Ubud"]);
    expect(placeSearches({ travellers: { names: [], count: 3, children: 1 } }, "Porto")).toEqual(["family friendly restaurants in Porto"]);
    // A trip that says nothing of what it's for asks nothing (no quota spent).
    expect(placeSearches({ style: { key: "k", ids: ["city"] } }, "Lisbon")).toEqual([]);
    expect(placeSearches(null, "Lisbon")).toEqual([]);
    expect(placeSearches({ style: { key: "k", ids: ["romantic"] } }, " ")).toEqual([]);
  });
  it("in the town with the most nights", () => {
    expect(stayTown([{ city: "Mengwi", nights: 3 }, { city: "Canggu", nights: 12 }, { city: "Mengwi", nights: 4 }, { city: null, nights: 9 }], "Bali")).toBe("Canggu");
    expect(stayTown([], "Bali")).toBe("Bali");
    expect(stayTown([], null)).toBeNull();
  });
});

describe("the review knows who goes, the budget and real places", () => {
  const bali = (over: Partial<Trip> = {}): Trip => ({
    id: "t1",
    title: "Bali Gezisi",
    confirmedDates: { start: "2026-12-10", end: "2027-01-10" },
    budget: { amount: 4000, currency: "EUR", ceiling: 5000 },
    travellers: { names: ["Sabin"] },
    style: { key: "k", ids: ["romantic", "nature"] },
    heroImage: null,
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });
  const promptOf = (trip: Trip) =>
    reviewPrompt({ mains: [{ name: "Canggu", members: ["Canggu"] }], nights: { canggu: 31 }, range: trip.confirmedDates, items: [], sectionOf: () => "stay", suggestions: [], travellers: 2, ...tripTaste(trip) });

  it("the prompt says with whom (Sabin), the children and the budget, only as the trip says them", () => {
    expect(tripTaste(bali())).toEqual({ kind: null, style: ["Romantik", "Doğa"], with: ["Sabin"], budget: { amount: 4000, currency: "EUR", ceiling: 5000 } });
    const data = JSON.parse(promptOf(bali()).split("\n")[1]);
    expect(data).toMatchObject({ travellers: 2, style: ["Romantik", "Doğa"], with: ["Sabin"], children: 0, budget: { amount: 4000, currency: "EUR", ceiling: 5000 } });
    expect(JSON.parse(promptOf(bali({ budget: null, travellers: { names: ["Sabin"], count: 3, children: 1 } })).split("\n")[1])).toMatchObject({ with: ["Sabin"], children: 1, budget: null });
    // Nothing said: none made up.
    expect(JSON.parse(promptOf(bali({ budget: null, travellers: undefined })).split("\n")[1])).toMatchObject({ with: [], children: 0, budget: null });
  });
  it("the rules ask the suggestions to fit who goes and the budget, and to pick from Maps' places", () => {
    const tr = reviewSystem();
    expect(tr).toContain("Kimle gidildiği (\"with\"");
    expect(tr).toContain("Bütçenin rakamını yazma");
    expect(tr).toContain("<maps_places> varsa");
    expect(withMapsPlaces("p", {})).toBe("p");
    expect(withMapsPlaces("p", { "romantic restaurants in Canggu": ["La Brisa"] })).toBe('p\n<maps_places>\n{"romantic restaurants in Canggu":["La Brisa"]}\n</maps_places>');
  });
  it("Maps' places are asked once the review is claimed, and go to the model after the plan", async () => {
    let trip = bali();
    const save = async (change: (t: Trip) => Trip) => {
      trip = change(trip);
    };
    let sent = "";
    const provider = async () => ({ generateJson: async (_s: string, prompt: string) => ((sent = prompt), { suggestions: [] }) }) as unknown as LlmProvider;
    const places = vi.fn(async () => ({ "romantic restaurants in Canggu": ["La Brisa", "Mason"] }));
    expect(await runReview({ key: "k1", prompt: promptOf(trip), save, now: 5, provider, places })).toBe("done");
    expect(places).toHaveBeenCalledTimes(1);
    expect(sent).toMatch(/^<suggest_review>/);
    expect(sent).toContain('<maps_places>\n{"romantic restaurants in Canggu":["La Brisa","Mason"]}\n</maps_places>');
    // Not claimed (done already for this key): Maps isn't asked.
    expect(await runReview({ key: "k1", prompt: "p", save, now: 6, provider, places })).toBe("skipped");
    expect(places).toHaveBeenCalledTimes(1);
    // Maps failing leaves the prompt as it is.
    trip = { ...trip, suggestReview: null };
    expect(await runReview({ key: "k2", prompt: "p", save, now: 7, provider, places: async () => Promise.reject(new Error("offline")) })).toBe("done");
    expect(sent).toBe("p");
  });
});
