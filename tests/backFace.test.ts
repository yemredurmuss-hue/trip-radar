// The back of a card: the two sections, three at most each, the one on the plan always shown, "Yeni" only when fresh and unseen.
import { afterEach, describe, expect, it } from "vitest";
import { BACK_CAP, FRESH_MS, isFresh, loadSeen, markSeen, splitBack, tagOf } from "../src/lib/backFace";
import { makeItem } from "./fixtures/makeItem";

const mine = (id: string, over = {}) => makeItem({ id, ...over });
const ai = (id: string, over = {}) => makeItem({ id, addedBy: "ai", ...over });

describe("splitBack", () => {
  it("puts everyone but the AI under 'Kaydettikleriniz' and the AI's under 'Önerimiz'", () => {
    const s = splitBack([mine("a"), ai("b"), mine("c", { addedBy: "Sabine" }), ai("d")]);
    expect(s.mine.map((i) => i.id)).toEqual(["a", "c"]);
    expect(s.ai.map((i) => i.id)).toEqual(["b", "d"]);
    expect(s.more).toBe(0);
  });
  it("shows three at most in each and counts what is left for the Board", () => {
    const s = splitBack([...["a", "b", "c", "d", "e"].map((id) => mine(id)), ...["f", "g", "h", "i"].map((id) => ai(id))]);
    expect(BACK_CAP).toBe(3);
    expect(s.mine).toHaveLength(3);
    expect(s.ai).toHaveLength(3);
    expect([s.mineTotal, s.aiTotal, s.more]).toEqual([5, 4, 3]);
  });
  it("keeps the option on the plan among those shown, even when it ranks low", () => {
    const s = splitBack([mine("a"), mine("b"), mine("c"), mine("d", { status: "chosen" })]);
    expect(s.mine.map((i) => i.id)).toEqual(["a", "b", "d"]);
    expect(s.more).toBe(1);
  });
  it("keeps the option the card shows as Önerimiz among those shown too", () => {
    const s = splitBack([mine("a"), mine("b"), mine("c"), mine("d")], "d");
    expect(s.mine.map((i) => i.id)).toEqual(["a", "b", "d"]);
  });
  it("is empty for a section without options", () => {
    const s = splitBack([ai("x")]);
    expect(s.mine).toEqual([]);
    expect(s.mineTotal).toBe(0);
  });
});

describe("isFresh and tagOf", () => {
  const now = 10 * FRESH_MS;
  it("is fresh for 48 hours, until seen, and never for the one on the plan", () => {
    const item = mine("a", { createdAt: now - FRESH_MS + 1000 });
    expect(isFresh(item, new Set(), now)).toBe(true);
    expect(isFresh(item, new Set(["a"]), now)).toBe(false);
    expect(isFresh(mine("b", { createdAt: now - FRESH_MS - 1 }), new Set(), now)).toBe(false);
    expect(isFresh(mine("c", { createdAt: now - 1000, status: "chosen" }), new Set(), now)).toBe(false);
  });
  it("words the corner: Seçili for the one on the plan, Yeni for a fresh one, else nothing", () => {
    expect(tagOf(mine("a", { status: "booked" }), true)).toBe("selected");
    expect(tagOf(mine("b"), true)).toBe("new");
    expect(tagOf(mine("c"), false)).toBeNull();
  });
  it("words the one the card shows as Önerimiz Kartta, before Yeni; the one on the plan stays Seçili", () => {
    expect(tagOf(mine("a"), true, true)).toBe("onCard");
    expect(tagOf(mine("b"), false, true)).toBe("onCard");
    expect(tagOf(mine("c", { status: "chosen" }), false, true)).toBe("selected");
  });
});

describe("seen ids", () => {
  const store = new Map<string, string>();
  const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  afterEach(() => {
    store.clear();
    Reflect.deleteProperty(globalThis, "localStorage");
  });
  it("remembers per trip, without duplicates", () => {
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    markSeen("t1", ["a", "b"]);
    markSeen("t1", ["b", "c"]);
    expect([...loadSeen("t1")]).toEqual(["a", "b", "c"]);
    expect(loadSeen("t2").size).toBe(0);
  });
  it("shrugs off blocked storage", () => {
    Object.defineProperty(globalThis, "localStorage", { value: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } }, configurable: true });
    expect(() => markSeen("t1", ["a"])).not.toThrow();
    expect(loadSeen("t1").size).toBe(0);
  });
});

import { hasSearched, markSearched, resetSearched } from "../src/app/cards/searching";
describe("'Sana uyan başka seçenek bulamadık' waits for a search", () => {
  it("is false until a search was started for that card (in memory)", () => {
    resetSearched();
    expect(hasSearched("k1")).toBe(false);
    markSearched("k1");
    expect(hasSearched("k1")).toBe(true);
    expect(hasSearched("k2")).toBe(false);
  });
});
