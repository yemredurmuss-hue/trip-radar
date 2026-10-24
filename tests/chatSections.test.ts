// What a line to the chat is about, by category: their rows move while the chat works on it (lib/chatSections.ts).
import { describe, expect, it } from "vitest";
import { sectionsOfWords } from "../src/lib/chatSections";

describe("sectionsOfWords", () => {
  it("names the category the line asks for", () => {
    expect(sectionsOfWords("Uçuş ekle")).toEqual(["flight"]);
    expect(sectionsOfWords("Ubud'da otel bul")).toEqual(["stay"]);
    expect(sectionsOfWords("Çöl kampı ve deve turu için öneri bul")).toEqual(["stay", "activity"]);
    expect(sectionsOfWords("Marakeş'ten araç kiralama")).toEqual(["transport"]);
    expect(sectionsOfWords("eSIM lazım mı?")).toEqual(["other"]);
    expect(sectionsOfWords("Add a flight to Bali")).toEqual(["flight"]);
  });
  it("the whole plan: the backbone's categories", () => {
    expect(sectionsOfWords("Gezinin omurgasını oluştur")).toEqual(["flight", "stay", "transport", "activity"]);
    expect(sectionsOfWords("planı kur")).toEqual(["flight", "stay", "transport", "activity"]);
  });
  it("nothing named, nothing moves; look-alike words don't count", () => {
    expect(sectionsOfWords("teşekkürler")).toEqual([]);
    expect(sectionsOfWords("Hangisi daha iyi?")).toEqual([]);
    expect(sectionsOfWords("Türkiye'den kampanya var mı")).toEqual([]);
  });
});

describe("chatWork: what the row says while the chat works", () => {
  it("added, changed or looked for", async () => {
    const { chatWork } = await import("../src/lib/chatSections");
    expect(chatWork("Paris'e uçuş koy")).toBe("add");
    expect(chatWork("Uçuş ekle")).toBe("add");
    expect(chatWork("Paristen barcelonaya uçuşu 2 gün kaydır")).toBe("edit");
    expect(chatWork("oteli sil")).toBe("edit");
    expect(chatWork("Ubud'da daha ucuz otel bul")).toBe("search");
  });
});
