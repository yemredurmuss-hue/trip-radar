import { describe, expect, it } from "vitest";
import { locative } from "../src/lib/i18nText";

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
