import { describe, expect, it } from "vitest";
import { acceptMood, moodKey, statusSentence } from "../src/lib/heroText";

describe("status sentence", () => {
  it("says what's done and what's waiting, from the counts", () => {
    expect(statusSentence({ decide: 1, book: 0, plan: 0, deadline: 0 }, { flightsDone: true, waitingCity: "Madeira" }))
      .toBe("Uçuşlar hazır, Madeira'da bir karar bekliyor.");
    expect(statusSentence({ decide: 0, book: 2, plan: 0, deadline: 0 }, { flightsDone: false, waitingCity: null }))
      .toBe("2 rezervasyon bekliyor.");
    expect(statusSentence({ decide: 0, book: 0, plan: 0, deadline: 0 }, { flightsDone: true, waitingCity: null }))
      .toBe("Her şey hazır.");
  });
});

describe("mood line", () => {
  it("accepts a short sentence without numbers", () => {
    expect(acceptMood("Şarap mahzenli dar sokaklardan Atlantik'e bakan yeşil uçurumlara.")).toBe(true);
  });
  it("rejects numbers, long text and empty", () => {
    expect(acceptMood("12 gün boyunca Porto")).toBe(false);
    expect(acceptMood("a".repeat(121))).toBe(false);
    expect(acceptMood("  ")).toBe(false);
  });
  it("is keyed by the cities, in order", () => {
    expect(moodKey(["Porto", "Madeira"])).toBe("porto|madeira");
  });
});
