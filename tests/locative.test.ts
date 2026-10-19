import { describe, expect, it } from "vitest";
import { locative, lowerFirst } from "../src/lib/i18nText";

describe("locative", () => {
  it("picks the vowel and consonant form by spelling", () => {
    expect(locative("Madeira")).toBe("Madeira'da");
    expect(locative("Lizbon")).toBe("Lizbon'da");
    expect(locative("Paris")).toBe("Paris'te");
    expect(locative("Berlin")).toBe("Berlin'de");
    expect(locative("Bangkok")).toBe("Bangkok'ta");
    expect(locative("Zürih")).toBe("Zürih'te");
  });
  it("keeps accents as written and handles capitals", () => {
    expect(locative("Córdoba")).toBe("Córdoba'da");
    expect(locative("Cádiz")).toBe("Cádiz'de");
    expect(locative("IZMIR")).toBe("IZMIR'da");
  });
  it("leaves an empty name alone", () => {
    expect(locative("")).toBe("");
  });
});

describe("a search's site, in the locative (the box's \"Kendin ara\")", () => {
  it("Airbnb'de, Booking.com'da, Agoda'da", () => {
    expect(locative("Airbnb")).toBe("Airbnb'de");
    expect(locative("Booking.com")).toBe("Booking.com'da");
    expect(locative("Agoda")).toBe("Agoda'da");
  });
});

describe("lowerFirst", () => {
  it("lowers a word's first letter inside a sentence; an abbreviation keeps it (\"TV yok\", not \"tV yok\")", () => {
    expect(lowerFirst("Kahvaltı çok iyi")).toBe("kahvaltı çok iyi");
    expect(lowerFirst("TV yok")).toBe("TV yok");
    expect(lowerFirst("Wi-Fi zayıf")).toBe("Wi-Fi zayıf");
    expect(lowerFirst("AC yok")).toBe("AC yok");
    expect(lowerFirst("")).toBe("");
  });
});
