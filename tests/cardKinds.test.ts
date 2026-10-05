// tests/cardKinds.test.ts
import { describe, expect, it } from "vitest";
import { cardKind, cardKindColor, cardKindLabel, legModeByItem, transportMode } from "../src/lib/cardKinds";
import type { Leg } from "../src/lib/legs";
import type { Item } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const t = (name: string, over: Partial<Item> = {}) => makeItem({ category: "transport", name, ...over });

describe("which way of travel a card is", () => {
  it.each([
    ["CP Alfa Pendular · Porto → Lizbon", "train"],
    ["FlixBus Lizbon → Lagos", "bus"],
    ["Dolmuş Lagos → Sagres", "minibus"],
    ["Porto Santo Line feribot", "ferry"],
    ["Havalimanı transferi", "taxi"],
    ["Rentalcars · Funchal", "car"],
    ["Scooter kiralama Funchal", "moto"],
    ["Indie Campers karavan", "rv"],
    ["Bisiklet kiralama Porto", "bike"],
  ])("%s → %s (from its words)", (name, mode) => expect(transportMode(t(name))).toBe(mode));

  it("the planned kind comes first, then the transfer's chosen way, then the flight category", () => {
    expect(transportMode(t("Herhangi bir şey", { plannedKind: "ferry" }), "train")).toBe("ferry");
    expect(transportMode(t("Plan"), "train")).toBe("train");
    expect(transportMode(t("Plan"), "transfer")).toBe("taxi");
    expect(transportMode(makeItem({ category: "flight", name: "Pegasus" }))).toBe("flight");
  });
  it("metro, walking or nothing said: unknown", () => {
    expect(transportMode(t("Plan · Madeira"), "metro")).toBeNull();
    expect(cardKind(t("Plan · Madeira"))).toBe("transport");
  });
  it("a car rented for days without a word that says so is still a car", () => {
    expect(transportMode(t("Funchal", { dates: { start: "2026-10-12", end: "2026-10-15", source: "page" } }))).toBe("car");
  });
});

describe("card kinds beyond travel", () => {
  it("by category, insurance and notes by what they are", () => {
    expect(cardKind(makeItem({ category: "activity" }))).toBe("activity");
    expect(cardKind(makeItem({ category: "esim" }))).toBe("esim");
    expect(cardKind(makeItem({ category: "food" }))).toBe("food");
    expect(cardKind(makeItem({ category: "stay" }))).toBe("stay");
    expect(cardKind(makeItem({ category: "other", name: "Seyahat sağlık sigortası" }))).toBe("insurance");
    expect(cardKind(makeItem({ category: "transport", name: "Allianz seyahat sigortası" }))).toBe("insurance");
    expect(cardKind(makeItem({ category: "other", name: "Airalo eSIM Portekiz" }))).toBe("esim");
    expect(cardKind(makeItem({ category: "other", name: "Vize randevusu", plannedKind: "note" }))).toBe("note");
    expect(cardKind(makeItem({ category: "other", name: "Lounge" }))).toBe("other");
  });
  it("colours and names from the approved mockups", () => {
    expect(["flight", "train", "bus", "minibus", "ferry", "taxi", "car", "moto", "rv", "bike", "transport"].map((k) => cardKindColor(k as never))).toEqual([
      "#6a4fe0", "#2563c9", "#d9480f", "#e8890c", "#0e8fb0", "#d29a00", "#475467", "#c0256b", "#8a6534", "#5d8a1c", "#6e6e73",
    ]);
    expect([cardKindColor("activity"), cardKindColor("esim"), cardKindColor("insurance")]).toEqual(["#a8336f", "#3b6fd1", "#0f8a6a"]);
    expect(cardKindLabel("taxi")).toBe("Taksi · transfer");
    expect(cardKindLabel("transport")).toBe("Ulaşım");
  });
});

describe("the way chosen for a transfer, per record", () => {
  it("reaches the transfer's options and its trip", () => {
    const a = t("A");
    const b = t("B");
    const leg = { choice: { mode: "train", booked: false, note: null, updatedAt: 1 }, options: [a], travel: { items: [b] } } as unknown as Leg;
    const none = { choice: null, options: [t("C")], travel: null } as unknown as Leg;
    expect([...legModeByItem([leg, none])]).toEqual([[a.id, "train"], [b.id, "train"]]);
  });
});
