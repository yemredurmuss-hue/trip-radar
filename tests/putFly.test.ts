import { describe, expect, it } from "vitest";
import { arrivedKey, chipLabel, chipName, isPutButton, slotTransform } from "../src/app/putFly";

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
  it("takes the Pano card's name, not its first line (the price)", () => {
    const pano = { innerText: "€9\nLivraria Lello\n+ Plana koy", closest: (sel: string) => (sel.includes(".pn-card") ? { getAttribute: () => "Livraria Lello" } : null) };
    expect(chipLabel(pano)).toBe("Livraria Lello");
    expect(chipLabel({ innerText: "Casa Azul\n€80" })).toBe("Casa Azul");
    expect(chipLabel(null)).toBe("+1");
  });
});

describe("Plana koy in a row of cards (E6): the card flies to its slot in Planında", () => {
  it("lays the card over its slot: its corner on the slot's, its size the slot's", () => {
    expect(slotTransform({ left: 100, top: 500, width: 209, height: 224 }, { left: 540, top: 236, width: 209, height: 224 })).toBe("translate(440px, -264px) scale(1, 1)");
    expect(slotTransform({ left: 0, top: 0, width: 200, height: 224 }, { left: 10, top: 20, width: 100, height: 112 })).toBe("translate(10px, 20px) scale(0.5, 0.5)");
  });
  it("finds the card that came into Planında", () => {
    expect(arrivedKey(["i:a", "i:b"], ["i:a", "i:c", "i:b"])).toBe("i:c");
    expect(arrivedKey(["i:a"], ["i:a"])).toBeNull();
  });
});
