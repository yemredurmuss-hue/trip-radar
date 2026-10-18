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
  it("says only what's most pressing, in one clause", () => {
    expect(statusSentence({ decide: 3, book: 1, plan: 4, deadline: 2 }, { flightsDone: false, waitingCity: "Porto" }))
      .toBe("3 karar ve 1 rezervasyon bekliyor.");
    expect(statusSentence({ decide: 3, book: 1, plan: 0, deadline: 0 }, { flightsDone: true, waitingCity: null }))
      .toBe("Uçuşlar hazır, 3 karar ve 1 rezervasyon bekliyor.");
    expect(statusSentence({ decide: 3, book: 0, plan: 4, deadline: 0 }, { flightsDone: false, waitingCity: "Porto" }))
      .toBe("3 karar bekliyor.");
    expect(statusSentence({ decide: 0, book: 1, plan: 4, deadline: 2 }, { flightsDone: false, waitingCity: null }))
      .toBe("1 rezervasyon bekliyor.");
    expect(statusSentence({ decide: 0, book: 0, plan: 2, deadline: 1 }, { flightsDone: true, waitingCity: null }))
      .toBe("Uçuşlar hazır, 3 iş bekliyor.");
  });
  it("only says everything's set when nothing is waiting", () => {
    expect(statusSentence({ decide: 0, book: 0, plan: 2, deadline: 1 }, { flightsDone: false, waitingCity: null })).not.toBe("Her şey hazır.");
    expect(statusSentence({ decide: 0, book: 0, plan: 0, deadline: 0 }, { flightsDone: false, waitingCity: null })).toBe("Her şey hazır.");
  });
  it("uses the right locative for the city", () => {
    expect(statusSentence({ decide: 1, book: 0, plan: 0, deadline: 0 }, { flightsDone: false, waitingCity: "Paris" }))
      .toBe("Paris'te bir karar bekliyor.");
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
