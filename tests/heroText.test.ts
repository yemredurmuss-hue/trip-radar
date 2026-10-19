import { describe, expect, it } from "vitest";
import { acceptMood, moodKey } from "../src/lib/heroText";

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
