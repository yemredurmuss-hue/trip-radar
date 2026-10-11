import { describe, expect, it } from "vitest";
import { fileNameOf } from "../src/app/PrintPlan";

describe("PDF file name", () => {
  it("keeps the trip's title and drops what a file name can't hold", () => {
    expect(fileNameOf("Portekiz (örnek) · 8–14 Ekim · Trip Radar")).toBe("Portekiz (örnek) · 8–14 Ekim · Trip Radar.pdf");
    expect(fileNameOf('Bali: "kış"/yaz?  gezisi')).toBe("Bali kış yaz gezisi.pdf");
  });
});
