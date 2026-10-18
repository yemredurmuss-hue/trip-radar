import { describe, expect, it } from "vitest";
import { amazonLink } from "../src/lib/prepBuy";

describe("amazonLink (Hazırlık's Amazon ↗)", () => {
  it("searches a thing to buy, without the verb", () => {
    expect(amazonLink("A tipi priz adaptörü")).toMatch(/^https:\/\/www\.amazon\.com(\.tr)?\/s\?k=A%20tipi%20priz%20adapt%C3%B6r%C3%BC$/);
    expect(amazonLink("Powerbank al")).toMatch(/s\?k=Powerbank$/);
    expect(amazonLink("Kolay çıkan rahat ayakkabı")).not.toBeNull();
  });
  it("leaves a chore that isn't a thing, or names its shop", () => {
    expect(amazonLink("Nakit yen")).toBeNull();
    expect(amazonLink("Vize başvurusu")).toBeNull();
    expect(amazonLink("Decathlon'dan yağmurluk al")).toBeNull();
  });
});
