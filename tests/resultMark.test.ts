import { describe, expect, it } from "vitest";
import { printOf, resultPage, resultPrint, sameResult } from "../src/lib/resultMark";

const flight = (airline: string, price: string, extra = "") => `${airline} 07:40 IST 1 sa 25 dk Direkt 09:05 ATH ${extra} ${price} Seç`;
const hotel = (name: string, area: string, price: string, extra = "") =>
  `${name} ${area}, Porto Haritada göster 1,2 km merkezden Çok iyi 8,6 1.234 yorum ${extra} 2 gece, 2 yetişkin ${price} Vergiler ve masraflar dahil Müsaitliği gör`;

describe("a saved result known again (tek Kaydet v3)", () => {
  it("a flight is the same flight when only its price changed, or a seat note came", () => {
    const saved = resultPrint(flight("Pegasus", "€86"));
    expect(sameResult(saved, resultPrint(flight("Pegasus", "€82")))).toBe(true);
    expect(sameResult(saved, resultPrint(flight("Pegasus", "€82", "Son 2 koltuk")))).toBe(true);
  });

  it("another airline at the same times, or other times, is another flight", () => {
    const saved = resultPrint(flight("Pegasus", "€86"));
    expect(sameResult(saved, resultPrint(flight("AJet", "€86")))).toBe(false);
    expect(sameResult(saved, resultPrint(flight("Pegasus", "€86").replace("09:05", "09:15")))).toBe(false);
  });

  it("a hotel is known by its heading; two hotels on one street are two", () => {
    const saved = resultPrint(hotel("Casa do Jardim", "Ribeira", "€245"), "Casa do Jardim");
    expect(sameResult(saved, resultPrint(hotel("Casa do Jardim", "Ribeira", "€219", "Son 1 oda kaldı Ücretsiz iptal"), "Casa do Jardim"))).toBe(true);
    expect(sameResult(saved, resultPrint(hotel("Hotel Lisboa", "Ribeira", "€245"), "Hotel Lisboa"))).toBe(false);
  });

  it("without headings, a near twin is not taken for it", () => {
    const a = resultPrint(hotel("Lisboa", "Ribeira", "€245"));
    expect(sameResult(a, resultPrint(hotel("Porto", "Ribeira", "€245")))).toBe(false);
  });

  it("a price that looks like a time is not one; ratings and counts are not words", () => {
    const p = resultPrint("Otel 12.50 € 8,6 puan 1.234 yorum");
    expect(p.t).toBe("");
    expect(p.w).toEqual(["otel", "puan", "yorum"]);
  });

  it("the page: hash and ad trackers dropped, the search itself kept", () => {
    expect(resultPage("https://www.skyscanner.com.tr/transport/flights/ath/ist/270512/?adults=1&utm_source=x#top")).toBe(
      "https://www.skyscanner.com.tr/transport/flights/ath/ist/270512/?adults=1",
    );
    expect(resultPage("https://www.google.com/travel/flights/search?tfs=AAA")).not.toBe(resultPage("https://www.google.com/travel/flights/search?tfs=BBB"));
    expect(resultPage("chrome://extensions")).toBeNull();
  });

  it("a print from the page keeps only its shape", () => {
    expect(printOf({ n: "a", t: "07:40", w: ["x", 3, "y"] })).toEqual({ n: "a", t: "07:40", w: ["x", "y"] });
    expect(printOf({ n: 1 })).toBeNull();
  });
});
