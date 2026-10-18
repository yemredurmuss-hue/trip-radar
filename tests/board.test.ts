// The options board (0.37): order, filters and the one badge each card may carry.
import { describe, expect, it } from "vitest";
import { boardBadges, boardOptions, otherDates } from "../src/lib/board";
import type { GroupDecision, OptionResult } from "../src/lib/decision";
import { makeItem } from "./fixtures/makeItem";

const opt = (name: string, over: { score?: number | null; price?: number | null; rating?: number | null; scale?: number; loc?: number | null; free?: boolean; out?: string | null } = {}): OptionResult =>
  ({
    item: makeItem({
      id: name,
      name,
      category: "stay",
      rating: { value: over.rating ?? null, scale: over.scale ?? 10, count: 100, source: "page" },
      cancellation: { summary: over.free ? "Ücretsiz iptal" : null, freeUntil: null, source: "page" },
    }),
    score: over.score ?? null,
    parts: [
      { criterion: "price", value: over.price ?? null, s: null },
      { criterion: "location", value: null, s: over.loc ?? null },
    ],
    excluded: over.out ?? null,
    eliminated: null,
  }) as unknown as OptionResult;

const decision = (options: OptionResult[], winner?: OptionResult) => ({ options, winner: winner ?? null }) as unknown as GroupDecision;
const names = (list: OptionResult[]) => list.map((o) => o.item.name);

describe("the board's order", () => {
  const a = opt("Jardim", { score: 85, price: 285, rating: 8.9, loc: 0.9, free: true });
  const b = opt("Casa Azul", { score: 67, price: 240, rating: 4.8, scale: 5, loc: 0.3 });
  const c = opt("Ribeira", { score: 88, price: 330, rating: 9.2, loc: 0.7 });
  const x = opt("Elendi", { score: 90, price: 100, out: "ücretsiz iptal yok" });
  const d = decision([a, b, c, x], a);

  it("Önerim: the engine's winner first, then by score; the ruled-out only when asked, last", () => {
    expect(names(boardOptions(d))).toEqual(["Jardim", "Ribeira", "Casa Azul"]);
    expect(names(boardOptions(d, { withOut: true }))).toEqual(["Jardim", "Ribeira", "Casa Azul", "Elendi"]);
  });
  it("by price (cheapest first), by rating on one scale (4,8/5 = 9,6), by location", () => {
    expect(names(boardOptions(d, { sort: "price" }))).toEqual(["Casa Azul", "Jardim", "Ribeira"]);
    expect(names(boardOptions(d, { sort: "rating" }))).toEqual(["Casa Azul", "Ribeira", "Jardim"]);
    expect(names(boardOptions(d, { sort: "location" }))).toEqual(["Jardim", "Ribeira", "Casa Azul"]);
  });
  it("Ücretsiz iptal keeps only those", () => {
    expect(names(boardOptions(d, { freeOnly: true }))).toEqual(["Jardim"]);
  });
});

describe("the badges", () => {
  const a = opt("Jardim", { score: 85, price: 285, rating: 8.9 });
  const b = opt("Casa Azul", { score: 67, price: 240, rating: 8.0 });
  const c = opt("Ribeira", { score: 50, price: 330, rating: 9.2 });
  it("one each, in order: Önerim, Favori, En ucuz, En yüksek puan", () => {
    const badges = boardBadges(decision([a, b, c], a), new Map([["Ribeira", 2]]));
    expect(Object.fromEntries(badges)).toEqual({ Jardim: "pick", Ribeira: "fav", "Casa Azul": "cheap" });
    expect(Object.fromEntries(boardBadges(decision([a, b, c], a)))).toEqual({ Jardim: "pick", "Casa Azul": "cheap", Ribeira: "top" });
  });
  it("nothing to beat, no badge: one option, or a tie", () => {
    expect(boardBadges(decision([a], a)).size).toBe(0);
    const twin = opt("Twin", { score: 60, price: 240, rating: 8.0 });
    expect(Object.fromEntries(boardBadges(decision([b, twin])))).toEqual({});
  });
});
describe("otherDates: a stay on other dates is still an option", () => {
  const stay = (name: string, start: string, end: string) =>
    ({ item: makeItem({ name, category: "stay", dates: { start, end, source: "page" } }), parts: [] }) as unknown as OptionResult;
  const a = stay("A", "2026-10-07", "2026-10-11");
  const b = stay("B", "2026-10-07", "2026-10-11");
  it("says nothing for the usual dates", () => {
    expect(otherDates(a, decision([a, b, stay("C", "2026-10-08", "2026-10-12")]))).toBeNull();
  });
  it("tells a moved stay apart: the whole stay a day late", () => {
    const c = stay("C", "2026-10-08", "2026-10-12");
    expect(otherDates(c, decision([a, b, c]))?.text).toMatch(/8–12 Ekim · 4 gece · 1 gün geç/);
  });
  it("and one end only: check-in a day early, out 5 days late", () => {
    const c = stay("C", "2026-10-06", "2026-10-16");
    expect(otherDates(c, decision([a, b, c]))?.text).toMatch(/giriş 1 gün erken, çıkış 5 gün geç/);
  });
});
