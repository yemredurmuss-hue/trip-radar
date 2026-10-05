import { describe, expect, it } from "vitest";
import { ALL_PLANNED_KINDS, checkPlanned, plannedItem, PLANNED_KINDS, type PlannedInput } from "../src/lib/planned";
import { isInsurance, isLocalTransfer, isRental, isTrip } from "../src/lib/travelKinds";
import { makeItem } from "./fixtures/makeItem";

const said = (over: Partial<PlannedInput>): PlannedInput => ({
  kind: "flight", date: null, end_date: null, time: null, from: null, to: null, city: null, title: null, booked: false, note: null, ...over,
});

describe("kinds made by the add sheet", () => {
  it("a motorbike, a camper and a bike are rentals in their city", () => {
    const moto = plannedItem(said({ kind: "moto_rental", city: "Funchal", date: "2026-10-12", end_date: "2026-10-15" }), "t1", "m", 1);
    expect(moto).toMatchObject({ category: "transport", name: "Motosiklet kiralama · Funchal", needKey: "transport:moto-funchal", plannedKind: "moto_rental" });
    expect(isRental(moto)).toBe(true);
    expect(isRental(plannedItem(said({ kind: "rv_rental", city: "Madeira" }), "t1", "r", 1))).toBe(true);
    expect(plannedItem(said({ kind: "bike_rental", city: "Porto" }), "t1", "b", 1).name).toBe("Bisiklet kiralama · Porto");
  });
  it("a minibus is a trip between places", () => {
    const m = plannedItem(said({ kind: "minibus", from: "Lagos", to: "Sagres", date: "2026-10-15", time: "09:00" }), "t1", "x", 1);
    expect(m).toMatchObject({ category: "transport", name: "Minibüs · Lagos → Sagres", flight: { from: "Lagos", to: "Sagres", departure: "2026-10-15T09:00" } });
    expect(isTrip(m)).toBe(true);
    expect(isLocalTransfer(m)).toBe(false);
  });
  it("insurance, a restaurant and a note", () => {
    const ins = plannedItem(said({ kind: "insurance", date: "2026-10-07" }), "t1", "i", 1);
    expect(ins).toMatchObject({ category: "other", name: "Seyahat sigortası" });
    expect(isInsurance(ins)).toBe(true);
    expect(plannedItem(said({ kind: "food", title: "Cantinho do Avillez", city: "Porto" }), "t1", "f", 1)).toMatchObject({ category: "food", name: "Cantinho do Avillez" });
    expect(plannedItem(said({ kind: "note", title: "Vize randevusu" }), "t1", "n", 1)).toMatchObject({ category: "other", plannedKind: "note" });
  });
  it("the chat tool still only takes its own kinds", () => {
    expect(PLANNED_KINDS).not.toContain("minibus");
    expect(checkPlanned(said({ kind: "minibus", to: "Sagres" }))).toMatch(/Bilinmeyen tür/);
    expect(checkPlanned(said({ kind: "minibus", to: "Sagres" }), ALL_PLANNED_KINDS)).toBeNull();
    expect(checkPlanned(said({ kind: "moto_rental" }), ALL_PLANNED_KINDS)).toMatch(/şehirde/);
  });
});

describe("a plan made by hand, still unfinished", () => {
  it("a trip with only where it leaves from reads 'Porto → ?', not a dangling arrow", () => {
    expect(plannedItem(said({ kind: "bus", from: "Porto" }), "t1", "b", 1).name).toBe("Otobüs · Porto → ?");
    expect(plannedItem(said({ kind: "bus", from: "Porto", to: "Lagos" }), "t1", "b", 1).name).toBe("Otobüs · Porto → Lagos");
    expect(plannedItem(said({ kind: "bus" }), "t1", "b", 1).name).toBe("Otobüs");
  });
  it("an edit on the card may leave out what the chat must say (where, which day); a wrong value is still refused", () => {
    const partial = { complete: false };
    expect(checkPlanned(said({ kind: "car_rental" }), ALL_PLANNED_KINDS, partial)).toBeNull();
    expect(checkPlanned(said({ kind: "bus" }), ALL_PLANNED_KINDS, partial)).toBeNull();
    expect(checkPlanned(said({ kind: "taxi" }), ALL_PLANNED_KINDS, partial)).toBeNull();
    expect(checkPlanned(said({ kind: "stay" }), ALL_PLANNED_KINDS, partial)).toBeNull();
    expect(checkPlanned(said({ kind: "bus", date: "13.10.2026" }), ALL_PLANNED_KINDS, partial)).toMatch(/YYYY-AA-GG/);
    expect(checkPlanned(said({ kind: "stay", date: "2026-10-10", end_date: "2026-10-09" }), ALL_PLANNED_KINDS, partial)).toMatch(/Bitiş tarihi geçersiz/);
    expect(checkPlanned(said({ kind: "bus", time: "25:00" }), ALL_PLANNED_KINDS, partial)).toMatch(/SS:DD/);
  });
});

describe("insurance from the words on a saved page", () => {
  it("knows a policy, not a lounge pass", () => {
    expect(isInsurance(makeItem({ category: "other", name: "Allianz seyahat sağlık sigortası" }))).toBe(true);
    expect(isInsurance(makeItem({ category: "other", name: "Lounge pass" }))).toBe(false);
    expect(isInsurance(makeItem({ category: "stay", name: "Hotel Seguro" }))).toBe(false);
  });
});
