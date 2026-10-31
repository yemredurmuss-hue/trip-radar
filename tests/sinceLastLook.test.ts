// tests/sinceLastLook.test.ts: opening a trip says in one line what happened since the last look (omurga B3).
import { afterEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { sinceLastLook, sinceLine } from "../src/lib/sinceLastLook";
import { makeItem } from "./fixtures/makeItem";

afterEach(() => setLang("tr"));

describe("since the last look", () => {
  const seen = 1000;
  it("counts cards added and decisions made since then", () => {
    const items = [
      makeItem({ createdAt: 1500 }),
      makeItem({ createdAt: 1600 }),
      makeItem({ createdAt: 500, status: "chosen", statusAt: 1200 }),
      makeItem({ createdAt: 500, updatedAt: 1800 }),
      makeItem({ createdAt: 1700, status: "dismissed" }),
    ];
    expect(sinceLastLook(items, seen)).toEqual({ added: 2, decided: 1 });
  });

  it("first visit or nothing new: no line", () => {
    expect(sinceLastLook([makeItem({ createdAt: 1500 })], null)).toBeNull();
    expect(sinceLastLook([makeItem({ createdAt: 500, updatedAt: 1500 })], seen)).toBeNull();
  });

  it("says it in one line, in both languages", () => {
    expect(sinceLine({ added: 2, decided: 1 })).toBe("Son baktığından beri: 2 kart eklendi, 1 karar verildi.");
    expect(sinceLine({ added: 1, decided: 0 })).toBe("Son baktığından beri: 1 kart eklendi.");
    setLang("en");
    expect(sinceLine({ added: 2, decided: 1 })).toBe("Since you last looked: 2 cards added, 1 decision made.");
    expect(sinceLine({ added: 0, decided: 1 })).toBe("Since you last looked: 1 decision made.");
  });
});
