import { describe, expect, it } from "vitest";
import { chipName, isPutButton } from "../src/app/putFly";

describe("Plana koy: the flying chip", () => {
  it("knows the button by its words, in either language, with or without its +", () => {
    for (const t of ["Plana koy", "+ Plana koy", " + Add to plan ", "add to plan", "Plana ekle", "+ Plana ekle", "+ Add to the plan", "Add to the plan"]) expect(isPutButton(t)).toBe(true);
    for (const t of ["Plan'da gör →", "✓ Seçili", "Seç", "Plana koymayalım", "Plana eklenir"]) expect(isPutButton(t)).toBe(false);
  });
  it("carries the card's first line, cut to fit", () => {
    expect(chipName("Jardim Stay\nPorto · €285")).toBe("Jardim Stay");
    expect(chipName("\n  \nCasa Azul")).toBe("Casa Azul");
    expect(chipName("Hotel Infante Sagres Porto Ribeira Historic Centre", 20)).toBe("Hotel Infante Sagre…");
    expect(chipName("")).toBe("");
  });
});
