// tests/cardKinds.test.ts
import { describe, expect, it } from "vitest";
import { cardKind, cardKindColor, cardKindLabel, legEndsByItem, legModeByItem, transportMode } from "../src/lib/cardKinds";
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

  it("a flight first, then the planned kind, then the transfer's chosen way", () => {
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
  const choice = (mode: string) => ({ mode, booked: false, note: null, updatedAt: 1 });
  it("a change of city reaches its options and its trip", () => {
    const a = t("A");
    const b = t("B");
    const leg = { kind: "move", choice: choice("train"), options: [a], travel: { items: [b] } } as unknown as Leg;
    const none = { kind: "move", choice: null, options: [t("C")], travel: null } as unknown as Leg;
    expect([...legModeByItem([leg, none])]).toEqual([[a.id, "train"], [b.id, "train"]]);
  });
  it("a taxi to the hotel after landing: the taxi is a taxi, the flight stays a flight", () => {
    const flight = makeItem({ category: "flight", name: "Pegasus · direkt", flight: { from: "IST", to: "OPO", departure: "2026-10-08T07:10", arrival: "2026-10-08T10:05", carrier: null, flightNumber: null, stops: 0 } });
    const taxi = t("Havalimanı transferi");
    const arrival = { kind: "arrival", choice: choice("taxi"), options: [taxi], travel: { items: [flight] } } as unknown as Leg;
    const modes = legModeByItem([arrival]);
    expect([...modes]).toEqual([[taxi.id, "taxi"]]);
    expect(cardKind(flight, modes.get(flight.id) ?? null)).toBe("flight");
    // Even handed the transfer's way by mistake, a flight is a flight.
    expect(transportMode(flight, "taxi")).toBe("flight");
  });
  it("'Otel → Gar' by taxi: the train between the cities stays a train", () => {
    const train = t("CP Alfa Pendular · Porto → Lizbon", { flight: { from: "Porto Campanhã", to: "Lisboa Santa Apolónia", departure: "2026-10-11T09:30", arrival: null, carrier: null, flightNumber: null, stops: null } });
    const departing = { kind: "departure", choice: choice("taxi"), options: [], travel: { items: [train] } } as unknown as Leg;
    const move = { kind: "move", choice: null, options: [train], travel: { items: [train] } } as unknown as Leg;
    const modes = legModeByItem([departing, move]);
    expect(modes.has(train.id)).toBe(false);
    expect(cardKind(train, modes.get(train.id) ?? null)).toBe("train");
  });
});

describe("the cities a trip links on the plan", () => {
  it("a change of city both ends; the way in where it lands; the way home where it leaves", () => {
    const [a, b, c] = [t("A"), t("B"), t("C")];
    const p = (city: string) => ({ label: city, city, item: null });
    const legs = [
      { kind: "arrival", from: p("OPO"), to: p("Porto"), travel: { items: [a] } },
      { kind: "move", from: p("Porto"), to: p("Lizbon"), travel: { items: [b] } },
      { kind: "departure", from: p("Lizbon"), to: p("LIS"), travel: { items: [c] } },
      { kind: "change", from: p("Porto"), to: p("Porto"), travel: null },
    ] as unknown as Leg[];
    expect([...legEndsByItem(legs)]).toEqual([[a.id, { to: "Porto" }], [b.id, { from: "Porto", to: "Lizbon" }], [c.id, { from: "Lizbon" }]]);
  });
});
