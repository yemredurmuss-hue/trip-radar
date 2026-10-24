// An Etkinlik idea said in words (0.40.5): looked for by its words; not found, its card's own searches.
import { describe, expect, it } from "vitest";
import { ideaSearches, wordIdea } from "../src/lib/ideas";

const idea = { category: "activity", url: null, imageUrl: null, origin: "chat", addedBy: undefined, status: "saved" } as const;
describe("wordIdea", () => {
  it("an idea the chat or the start said, with no page or photo", () => {
    expect(wordIdea(idea)).toBe(true);
    expect(wordIdea({ ...idea, origin: undefined, addedBy: "ai" })).toBe(true);
  });
  it("never a tour with its page, a photo, the traveller's own, a booked one, a stay", () => {
    expect(wordIdea({ ...idea, url: "https://www.viator.com/x" })).toBe(false);
    expect(wordIdea({ ...idea, imageUrl: "https://img/x.jpg" })).toBe(false);
    expect(wordIdea({ ...idea, origin: undefined })).toBe(false);
    expect(wordIdea({ ...idea, status: "booked" })).toBe(false);
    expect(wordIdea({ ...idea, category: "stay" })).toBe(false);
  });
  it("the searches: its words and its city on GetYourGuide and Viator", () => {
    const [g, v] = ideaSearches("Couple spa", "Ubud");
    expect(g.url).toBe("https://www.getyourguide.com/s/?q=Couple%20spa%20Ubud");
    expect(v.url).toBe("https://www.viator.com/searchResults/all?text=Couple%20spa%20Ubud");
  });
});
