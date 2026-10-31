// tests/answerWants.test.ts: an answer given on the board (the Bavul's "Nasıl konaklayacaksın? · Çadır") reaches the
// trip's intent, so Tercihler and every model read it (omurga 2026-10-31, Emre: "çadır dedim ama tercihlere işlenmedi").
import { describe, expect, it } from "vitest";
import { withAnswer } from "../src/lib/travelWants";

describe("an answer on the board", () => {
  it("is kept as said, and a kind of stay in it is a stay asked for", () => {
    const w = withAnswer({ company: "solo" }, "Nasıl konaklayacaksın?", "Çadır");
    expect(w).toEqual({ company: "solo", stays: ["camp"], said: ["Nasıl konaklayacaksın? → Çadır"] });
  });
  it("a new answer to the same question replaces the old one", () => {
    const w = withAnswer(withAnswer(null, "Nasıl konaklayacaksın?", "Otel"), "Nasıl konaklayacaksın?", "Çadır");
    expect(w?.said).toEqual(["Nasıl konaklayacaksın? → Çadır"]);
  });
  it("taken back: its line goes", () => {
    const w = withAnswer(withAnswer(null, "Çamaşır yıkayacak mısın?", "Evet"), "Çamaşır yıkayacak mısın?", null);
    expect(w?.said ?? []).toEqual([]);
  });
});
