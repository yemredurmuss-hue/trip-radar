// 0.39.15 (Emre: "plana alınca mini açıklama kayboluyor yapılacakların"): a suggested place put on the plan keeps what its
// card said (its why, its rating and reviews), and one put there before keeps saying its why from its suggestion.
import { describe, expect, it } from "vitest";
import { collectionRow } from "../src/lib/collectionCards";
import { withPlacePhoto } from "../src/lib/placeSuggest";
import { suggestedItem } from "../src/lib/suggestions";
import type { Item, Suggestion } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const sugg = (over: Partial<Suggestion> = {}): Suggestion =>
  ({ key: "todo:tokyo:rikugien", kind: "add", section: "todo", template: "todo", title: "Rikugien Bahçesi", why: "Geleneksel Japon bahçesi, parkta yürüyüş", payload: { city: "Tokyo" }, createdAt: 1, state: "open", ...over }) as Suggestion;

describe("a suggested place put on the plan", () => {
  it("keeps its why as the record's words, and the rating and reviews its card showed", () => {
    const s = withPlacePhoto(sugg(), "https://lh3.googleusercontent.com/r", "https://maps.google.com/?cid=1", { rating: 4.4, reviews: 10746 });
    const item = suggestedItem(s, "t1", "i1", 1)!;
    expect(item.summary).toBe("Geleneksel Japon bahçesi, parkta yürüyüş");
    expect(item.rating).toEqual({ value: 4.4, scale: 5, count: 10746, source: "url" });
    expect(item).toMatchObject({ imageUrl: "https://lh3.googleusercontent.com/r", url: "https://maps.google.com/?cid=1" });
  });
  it("a Google sight's rating (no reviews) goes too; no rating, none made up", () => {
    expect(suggestedItem(sugg({ payload: { city: "Tokyo", rating: 4.6, from: "google" } }), "t1", "i1", 1)!.rating).toEqual({ value: 4.6, scale: 5, count: null, source: "url" });
    expect(suggestedItem(sugg(), "t1", "i1", 1)!.rating.value).toBeNull();
    expect(withPlacePhoto(sugg(), null, null, { rating: null, reviews: null })).toEqual(sugg());
  });
  it("one put on the plan before says its suggestion's why on its card, by its name; its own words win", () => {
    const item = makeItem({ id: "p1", name: "Rikugien Bahçesi", category: "activity", plannedKind: "todo", booking: "none", needKey: "activity:Rikugien", city: "Tokyo", status: "chosen", summary: "" });
    const vm = { section: "todo" as const, itemIds: ["p1"], planned: [{ id: "p1", item }] as never, wanted: [], suggestions: [] };
    const byId = new Map<string, Item>([["p1", item]]);
    const said = [sugg({ state: "added", payload: { city: "Tokyo", rating: 4.4, from: "google" } })];
    expect(collectionRow(vm, byId, { trip: { intent: null } as never, people: 2, said }).plan[0].line).toBe("Geleneksel Japon bahçesi, parkta yürüyüş · Doğa · ★ 4,4");
    expect(collectionRow(vm, byId, { trip: { intent: null } as never, people: 2 }).plan[0].line).not.toMatch(/Geleneksel/);
    const own = { ...item, summary: "Sabah erken" };
    expect(collectionRow(vm, new Map([["p1", own]]), { trip: { intent: null } as never, people: 2, said }).plan[0].line).toMatch(/^Sabah erken/);
  });
});
