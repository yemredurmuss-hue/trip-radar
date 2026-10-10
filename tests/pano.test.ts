// The Pano (v11 phase 5, lib/pano.ts): what's on it, its tabs and state filter, the sort, the groups by need.
import { describe, expect, it } from "vitest";
import { inCat, inState, matchesQuery, panoCounts, panoEntries, panoGroups, sortEntries, withLoves } from "../src/lib/pano";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const price = (amount: number | null) => ({ amount, currency: amount == null ? null : "EUR", scope: "total" as const, taxesIncluded: "yes" as const, source: "page" as const, observedAt: 1 });
const stay = (name: string, status: Item["status"], amount: number | null, createdAt: number, over: Partial<Item> = {}) =>
  makeItem({ name, category: "stay", city: "Kyoto", needKey: "stay:kyoto", dates: { start: "2027-04-08", end: "2027-04-13", source: "url" }, status, price: price(amount), createdAt, ...over });

const items = [
  stay("Gion Machiya Evi", "chosen", 1050, 1, { likedBy: ["Emre", "Sabine"] }),
  stay("Higashiyama Inn", "saved", null, 2, { addedBy: "Sabine" }),
  stay("Kyoto Shijo Hotel", "saved", 900, 3, { addedBy: "ai", likedBy: ["Sabine"] }),
  makeItem({ name: "Pegasus", category: "flight", needKey: "flight:out", status: "saved", price: price(148), createdAt: 4 }),
  makeItem({ name: "Nishiki pazarı", category: "food", city: "Kyoto", status: "saved", booking: "none", createdAt: 5 }),
  makeItem({ name: "Elenen otel", category: "stay", city: "Kyoto", needKey: "stay:kyoto", status: "dismissed", createdAt: 6 }),
];

describe("the Pano", () => {
  const entries = panoEntries(items);

  it("holds every live link, each in the section the Plan draws it in; nothing ruled out", () => {
    expect(entries.map((e) => [e.item.name, e.section])).toEqual([
      ["Gion Machiya Evi", "stay"],
      ["Higashiyama Inn", "stay"],
      ["Kyoto Shijo Hotel", "stay"],
      ["Pegasus", "flight"],
      ["Nishiki pazarı", "todo"],
    ]);
  });

  it("knows what's on the plan and which needs are still open", () => {
    const of = (name: string) => entries.find((e) => e.item.name === name)!;
    expect(of("Gion Machiya Evi").inPlan).toBe("chosen");
    expect(of("Higashiyama Inn").open).toBe(false); // its need is decided (Gion is chosen)
    expect(of("Pegasus").open).toBe(true);
    expect(of("Nishiki pazarı").open).toBe(true); // an idea is its own need
    expect(entries.filter((e) => inState(e, "plan")).map((e) => e.item.name)).toEqual(["Gion Machiya Evi"]);
    expect(entries.filter((e) => inState(e, "open")).map((e) => e.item.name)).toEqual(["Pegasus", "Nishiki pazarı"]);
  });

  it("counts its tabs and states, Beğenilenler what anyone liked", () => {
    const { cats, states } = panoCounts(entries);
    expect([cats.all, cats.stay, cats.flight, cats.todo, cats.liked]).toEqual([5, 3, 1, 1, 2]);
    expect(states).toEqual({ all: 5, open: 2, plan: 1 });
    expect(entries.filter((e) => inCat(e, "liked")).map((e) => e.item.name)).toEqual(["Gion Machiya Evi", "Kyoto Shijo Hotel"]);
  });

  it("sorts: cheapest with no price last, most liked, newest first", () => {
    const stays = entries.filter((e) => e.section === "stay");
    expect(sortEntries(stays, "cheap").map((e) => e.item.name)).toEqual(["Kyoto Shijo Hotel", "Gion Machiya Evi", "Higashiyama Inn"]);
    expect(sortEntries(stays, "liked").map((e) => e.item.name)).toEqual(["Gion Machiya Evi", "Kyoto Shijo Hotel", "Higashiyama Inn"]);
    expect(sortEntries(stays, "new").map((e) => e.item.name)).toEqual(["Kyoto Shijo Hotel", "Higashiyama Inn", "Gion Machiya Evi"]);
  });

  it("groups a section by need, the one on the plan named, needs to compare first", () => {
    const groups = panoGroups(entries.filter((e) => e.section === "stay" || e.section === "flight"));
    expect(groups.map((g) => [g.entries.length, g.chosen?.item.name ?? null])).toEqual([
      [3, "Gion Machiya Evi"],
      [1, null],
    ]);
  });
});

describe("matchesQuery (Kayıtlarda ara)", () => {
  const entry = (over: Partial<Item>) => panoEntries([makeItem({ category: "stay", status: "saved", ...over } as never)])[0];
  it("finds a record by any of its words, case and Turkish dots ignored", () => {
    const e = entry({ name: "Jardim Stay", city: "Porto", provider: "Booking.com" } as Partial<Item>);
    expect(matchesQuery(e, "jardim")).toBe(true);
    expect(matchesQuery(e, "PORTO booking")).toBe(true);
    expect(matchesQuery(e, "lizbon")).toBe(false);
    expect(matchesQuery(e, "  ")).toBe(true);
  });
  it("folds ı/İ and accents", () => {
    const e = entry({ name: "Lisboa Loft", city: "Lizbon", location: { area: "Alfama" } } as unknown as Partial<Item>);
    expect(matchesQuery(e, "LİZBON")).toBe(true);
    expect(matchesQuery(e, "alfama loft")).toBe(true);
  });
});

describe("withLoves (a heart is the shared trip's Süper vote)", () => {
  const item = makeItem({ category: "stay", status: "saved", key: "booking:jardim", likedBy: ["Emre"] } as never);
  it("lays everyone's Süper votes over the record's likes, one face each", () => {
    const votes = [
      { itemKey: "booking:jardim", author: "Sabine", vote: 2 as const },
      { itemKey: "booking:jardim", author: "emre", vote: 2 as const },
      { itemKey: "booking:jardim", author: "Ali", vote: 1 as const },
      { itemKey: "booking:other", author: "Ali", vote: 2 as const },
    ];
    expect(withLoves(item, votes).likedBy).toEqual(["Emre", "Sabine"]);
  });
  it("the record unchanged with no Süper vote on it", () => {
    expect(withLoves(item, [])).toBe(item);
  });
});
