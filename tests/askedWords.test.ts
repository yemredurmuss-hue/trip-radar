// tests/askedWords.test.ts: what the traveller asked for in a city ("Husky safari turu") is searched for first among its
// tours, so its own offers show on its card (omurga 2026-10-31, Emre: "Husky turunu önerisi olarak orada görmek isterdik").
import { describe, expect, it } from "vitest";
import { askedWords } from "../src/lib/offerSources";
import { makeItem } from "./fixtures/makeItem";

describe("what was asked for, as tour searches", () => {
  it("an activity asked for and not found yet: its name without the generic words", () => {
    const husky = makeItem({ category: "activity", name: "Husky safari turu", origin: "chat" });
    expect(askedWords([husky])).toEqual(["husky safari"]);
  });
  it("one with its own page, booked, dismissed or not an activity: nothing to look for", () => {
    expect(askedWords([
      makeItem({ category: "activity", name: "Aurora chase", url: "https://www.viator.com/x" }),
      makeItem({ category: "activity", name: "Kayak dersi", status: "booked" }),
      makeItem({ category: "activity", name: "Kar motosikleti", status: "dismissed" }),
      makeItem({ category: "food", name: "Balık lokantası" }),
    ])).toEqual([]);
  });
  it("each once, at most three", () => {
    const list = ["Husky safari", "Husky safari turu", "Balina izleme turu", "Ren geyiği kızağı", "Kar ayakkabısı yürüyüşü"].map((name) => makeItem({ category: "activity", name }));
    expect(askedWords(list)).toEqual(["husky safari", "balina izleme", "ren geyigi kizagi"]);
  });
});
