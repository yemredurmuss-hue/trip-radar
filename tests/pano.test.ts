// The Pano (v11 phase 5, lib/pano.ts): what's on it, its tabs and state filter, the sort, the groups by need.
import { describe, expect, it } from "vitest";
import { inCat, inState, forYouOf, matchesQuery, needTitleOf, needWhenOf, panoCityRows, panoCounts, panoEntries, panoGroups, panoRows, sortEntries, withLoves } from "../src/lib/pano";
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

  it("groups a section by need, the one on the plan named, decisions waiting first (v30)", () => {
    const groups = panoGroups(entries.filter((e) => e.section === "stay" || e.section === "flight"));
    expect(groups.map((g) => [g.entries.length, g.chosen?.item.name ?? null])).toEqual([
      [1, null],
      [3, "Gion Machiya Evi"],
    ]);
  });
});

describe("a row's title and the rows of a tab (v30)", () => {
  const entries = panoEntries(items);
  const stays = entries.filter((e) => e.section === "stay");

  it("names a stay's row 'city · nights · records', a flight's 'route · records'", () => {
    expect(needTitleOf(stays[0].item, 3)).toBe("Kyoto · 5 gece · 3 kayıt");
    expect(needWhenOf(stays[0].item)).toBeTruthy();
    expect(needTitleOf(stays[0].item)).toMatch(/^Kyoto · /); // without a count: the card's need line, dates and all
    const flight = makeItem({ category: "flight", needKey: "flight:out", flight: { from: "IST", to: "OPO" } } as Partial<Item>);
    expect(needTitleOf(flight, 2)).toMatch(/ → .* · 2 kayıt$/);
  });

  const todo = (name: string, city: string | null, createdAt: number) => makeItem({ name, category: "food", city, status: "saved", booking: "none", needKey: `food:${name}`, createdAt } as Partial<Item>);
  const trip = panoEntries([
    stay("Porto otel", "saved", 100, 1, { city: "Porto", needKey: "stay:porto", dates: { start: "2027-04-01", end: "2027-04-04", source: "url" } }),
    stay("Lizbon otel", "saved", 100, 2, { city: "Lizbon", needKey: "stay:lizbon", dates: { start: "2027-04-04", end: "2027-04-07", source: "url" } }),
    todo("Lizbon kafe", "Lizbon", 3),
    todo("Porto kafe", "Porto", 4),
    todo("Porto pastane", "porto", 5),
    todo("Şehir dışı", null, 6),
    todo("Sintra", "Sintra", 7),
  ]);

  it("makes the things to do one row per city, in trip order, no decision, the ones without a city last", () => {
    const rows = panoRows(trip, "todo");
    expect(rows.every((r) => r.kind === "city")).toBe(true);
    expect(rows.map((r) => (r.kind === "city" ? [r.city, r.entries.length] : null))).toEqual([["Porto", 2], ["Lizbon", 1], ["Sintra", 1], [null, 1]]);
    expect(panoCityRows(trip.filter((e) => e.section === "todo"), []).length).toBe(4);
  });

  it("'Tümü' says the same as the tabs: needs to decide first, activities as needs too, then cities", () => {
    const act = (name: string, key: string) => makeItem({ name, category: "activity", city: "Porto", needKey: key, status: "saved", booking: "needed", createdAt: 9 } as Partial<Item>);
    const all = panoEntries([...trip.map((e) => e.item), act("Tur A", "activity:porto"), act("Tur B", "activity:porto")]);
    const kinds = panoRows(all, "all").map((r) => r.kind + (r.kind === "need" ? `:${r.group.entries.length}` : ""));
    expect(kinds).toEqual(["need:1", "need:1", "need:2", "city", "city", "city", "city"]);
    expect(panoRows(all, "activity").map((r) => r.kind)).toEqual(["need"]);
  });
});

describe("forYouOf (Senin için)", () => {
  const stays = panoEntries(items).filter((e) => e.section === "stay");
  it("says nothing without a leader, for one option, or for a booked need: never invented", () => {
    expect(forYouOf(stays, undefined, undefined)).toBeNull();
    expect(forYouOf(stays.slice(0, 1), undefined, undefined)).toBeNull();
    expect(forYouOf(stays.map((e) => ({ ...e, inPlan: "booked" as const })), undefined, undefined)).toBeNull();
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
