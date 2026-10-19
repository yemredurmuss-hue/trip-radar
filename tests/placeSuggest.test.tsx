// Yapılacaklar ve restoranlar' AI suggestions as places (0.38.7, Emre's Bali trip, Canggu): a name that reads as a
// name, the place on Google Maps, its own photo (its Wikipedia page's), and the record put on the plan with all three.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SuggestCard } from "../src/app/plan/v82/KCard";
import { suggestionCard } from "../src/lib/collectionCards";
import { cleanPlaceTitle, findPlacePhoto, photoNames, placeMapsUrl, placeQuery, withPlacePhoto } from "../src/lib/placeSuggest";
import { acceptReview, reviewSystem, ReviewSchema } from "../src/lib/suggestReview";
import { checkSuggestionInput, suggestedItem } from "../src/lib/suggestions";
import type { Suggestion } from "../src/lib/types";

const raw = (over: Record<string, string> = {}) => ({
  section: "todo",
  kind: "add",
  title: "Tanah Lot Tapınağı",
  why: "Canggu'ya yakın ve gün batımında deniz üstünde görünür.",
  template: "todo",
  city: "Canggu",
  start: "",
  end: "",
  place: "Tanah Lot Temple, Tabanan",
  ...over,
});
const checked = (over: Record<string, string> = {}) => checkSuggestionInput(raw(over), "ai", 1) as Suggestion;

describe("a suggested place's name", () => {
  it("drops a case ending a sentence left on it, and a word cut by the ellipsis", () => {
    expect(cleanPlaceTitle("Tanah Lot Tapınağı'nın")).toBe("Tanah Lot Tapınağı");
    expect(cleanPlaceTitle("Uluwatu'da")).toBe("Uluwatu");
    expect(cleanPlaceTitle("Echo Beach’ya")).toBe("Echo Beach");
    expect(cleanPlaceTitle("Batu Bolong'dan")).toBe("Batu Bolong");
    expect(cleanPlaceTitle("Yerel warung'da nas…")).toBe("Yerel warung");
    expect(cleanPlaceTitle("Warung Bu Mi ve")).toBe("Warung Bu Mi");
    expect(cleanPlaceTitle("Tanah Lot Tapınağı, ")).toBe("Tanah Lot Tapınağı");
    // A name is left as it is, an English possessive too; nothing left keeps the title.
    expect(cleanPlaceTitle("Warung Bu Mi")).toBe("Warung Bu Mi");
    expect(cleanPlaceTitle("Mama's Kitchen")).toBe("Mama's Kitchen");
    expect(cleanPlaceTitle("…")).toBe("…");
  });
  it("is cleaned where it's checked too (the review's and the chat's), and the place to search is kept", () => {
    const s = checked({ title: "Tanah Lot Tapınağı'nın" });
    expect(s.title).toBe("Tanah Lot Tapınağı");
    expect(s.payload).toMatchObject({ city: "Canggu", title: "Tanah Lot Tapınağı", place: "Tanah Lot Temple, Tabanan" });
    // A backbone suggestion has no place.
    const car = checkSuggestionInput(raw({ section: "transport", template: "car", title: "Scooter kiralama", place: "x" }), "ai", 1) as Suggestion;
    expect(car.payload?.place).toBeUndefined();
    // No price or time hides in the place either.
    expect(typeof checkSuggestionInput(raw({ place: "Warung 25.000 IDR" }), "ai", 1)).toBe("string");
  });
  it("the review asks for a real place's own name and a place to search on Maps; an answer without one still passes", () => {
    const tr = reviewSystem();
    expect(tr).toContain("title gerçek bir yerin kendi adıdır");
    expect(tr).toContain("Tanah Lot Tapınağı'nın");
    expect(tr).toContain("place: Haritalar'da aranacak tam ad ve kasaba");
    const answer = ReviewSchema.parse({ suggestions: [{ ...raw(), place: undefined }, raw({ title: "Warung Bu Mi", section: "food", template: "food", place: "Warung Bu Mi, Canggu" })] });
    const { added } = acceptReview(answer, [], 1);
    expect(added.map((s) => [s.title, s.payload?.place ?? null])).toEqual([
      ["Tanah Lot Tapınağı", null],
      ["Warung Bu Mi", "Warung Bu Mi, Canggu"],
    ]);
  });
});

describe("a suggested place on the map", () => {
  it("is searched on Google Maps by its place, else its name and city", () => {
    expect(placeMapsUrl(checked())).toBe("https://www.google.com/maps/search/?api=1&query=Tanah%20Lot%20Temple%2C%20Tabanan");
    const stored: Suggestion = { ...checked(), title: "Tanah Lot Tapınağı'nın", payload: { city: "Canggu", title: "Tanah Lot Tapınağı'nın" } };
    expect(placeQuery(stored)).toBe("Tanah Lot Tapınağı, Canggu");
  });
  it("its card says the name cleanly, links to the map, and shows the drawing until a photo is found", () => {
    const stored: Suggestion = { ...checked(), title: "Tanah Lot Tapınağı'nın", payload: { city: "Canggu", title: "Tanah Lot Tapınağı'nın" } };
    const card = suggestionCard(stored, "todo");
    expect(card).toMatchObject({ title: "Tanah Lot Tapınağı", family: "place", map: "https://www.google.com/maps/search/?api=1&query=Tanah%20Lot%20Tap%C4%B1na%C4%9F%C4%B1%2C%20Canggu" });
    const html = renderToStaticMarkup(<SuggestCard card={card} onPut={() => undefined} onDismiss={() => undefined} />);
    expect(html).toContain('href="https://www.google.com/maps/search/?api=1&amp;query=Tanah%20Lot%20Tap%C4%B1na%C4%9F%C4%B1%2C%20Canggu"');
    expect(html).toContain("Haritada aç");
    expect(html).toContain("z-kplace");
    expect(html).toContain('src="illus/yapilacak.png"');
    expect(html).not.toContain("Tapınağı&#x27;nın");
  });
});

describe("a suggested place's photo", () => {
  const page = (over: object = {}) => ({
    type: "standard",
    coordinates: { lat: -8.62, lon: 115.09 },
    thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tanah_Lot.jpg/330px-Tanah_Lot.jpg" },
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Tanah_Lot" } },
    ...over,
  });
  it("is the place's own Wikipedia page's, by its place's name first, at the card's size", async () => {
    const asked: string[] = [];
    const fetcher = async (url: string) => {
      asked.push(url);
      return url === "https://en.wikipedia.org/api/rest_v1/page/summary/Tanah_Lot_Temple" ? page() : null;
    };
    const s = checked();
    expect(photoNames(s)).toEqual(["Tanah Lot Temple", "Tanah Lot Tapınağı"]);
    expect(await findPlacePhoto(photoNames(s), fetcher)).toEqual({
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tanah_Lot.jpg/480px-Tanah_Lot.jpg",
      page: "https://en.wikipedia.org/wiki/Tanah_Lot",
    });
    // The board's language's Wikipedia first, then the other.
    expect(asked).toEqual(["https://tr.wikipedia.org/api/rest_v1/page/summary/Tanah_Lot_Temple", "https://en.wikipedia.org/api/rest_v1/page/summary/Tanah_Lot_Temple"]);
    // Asked once: the second card with the same names reads the answer.
    await findPlacePhoto(photoNames(s), fetcher);
    expect(asked).toHaveLength(2);
  });
  it("is none for a page that isn't a place's (no coordinates: a song, a dish), a map or a page that isn't there", async () => {
    const fetcher = async (url: string) =>
      url.includes("Echo_Beach") ? page({ coordinates: undefined }) : url.includes("Nasi") ? page({ type: "disambiguation" }) : url.includes("Pura") ? page({ thumbnail: { source: "https://u/Bali_locator_map.png" } }) : null;
    expect(await findPlacePhoto(["Echo Beach"], fetcher)).toBeNull();
    expect(await findPlacePhoto(["Nasi campur"], fetcher)).toBeNull();
    expect(await findPlacePhoto(["Pura Batu Bolong"], fetcher)).toBeNull();
    expect(await findPlacePhoto(["Warung Bu Mi"], fetcher)).toBeNull();
  });
  it("a request that got no answer isn't remembered as none", async () => {
    let online = false;
    const fetcher = async () => {
      if (!online) throw new TypeError("Failed to fetch");
      return page();
    };
    expect(await findPlacePhoto(["Pantai Batu Bolong"], fetcher)).toBeNull();
    online = true;
    expect(await findPlacePhoto(["Pantai Batu Bolong"], fetcher)).not.toBeNull();
  });
});

describe("a suggested place put on the plan", () => {
  it("is a record named as the place, in its city, with its Maps link and the photo its card found", () => {
    const stored: Suggestion = { ...checked(), title: "Tanah Lot Tapınağı'nın", payload: { city: "Canggu", title: "Tanah Lot Tapınağı'nın", place: "Tanah Lot Temple, Tabanan" } };
    const item = suggestedItem(withPlacePhoto(stored, "https://upload.wikimedia.org/x/480px-Tanah_Lot.jpg"), "t1", "i1", 1)!;
    expect(item).toMatchObject({
      name: "Tanah Lot Tapınağı",
      city: "Canggu",
      url: "https://www.google.com/maps/search/?api=1&query=Tanah%20Lot%20Temple%2C%20Tabanan",
      imageUrl: "https://upload.wikimedia.org/x/480px-Tanah_Lot.jpg",
      booking: "none",
    });
    const food = suggestedItem(checked({ section: "food", template: "food", title: "Warung Bu Mi", place: "" }), "t1", "i2", 1)!;
    expect(food).toMatchObject({ name: "Warung Bu Mi", city: "Canggu", url: "https://www.google.com/maps/search/?api=1&query=Warung%20Bu%20Mi%2C%20Canggu", imageUrl: null });
  });
});
