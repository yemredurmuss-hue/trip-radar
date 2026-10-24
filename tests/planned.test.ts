import { describe, expect, it } from "vitest";
import { ALL_PLANNED_KINDS, checkPlanned, fillPlanned, guardKind, plannedItem, PLANNED_KINDS, type PlannedInput } from "../src/lib/planned";
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
  it("the chat tool takes every way of travel and rental (2026-10-24: \"karavan dediğim halde araç kiralama\"); a meal and a note stay the add sheet's", () => {
    for (const k of ["minibus", "rv_rental", "moto_rental", "bike_rental"] as const) expect(PLANNED_KINDS).toContain(k);
    expect(checkPlanned(said({ kind: "minibus", to: "Sagres" }), PLANNED_KINDS)).toBeNull();
    expect(checkPlanned(said({ kind: "moto_rental" }), PLANNED_KINDS)).toMatch(/şehirde/);
    expect(PLANNED_KINDS).not.toContain("food");
    expect(checkPlanned(said({ kind: "note", title: "x" }), PLANNED_KINDS)).toMatch(/Bilinmeyen tür/);
  });
  it("a camper, a motorbike or a bike said as a car rental is that rental; a car stays a car", () => {
    expect(guardKind(said({ kind: "car_rental", title: "Madeira Karavan Kiralama (11-18 Ekim)", city: "Funchal" })).kind).toBe("rv_rental");
    expect(guardKind(said({ kind: "car_rental", title: "Scooter", city: "Lagos" })).kind).toBe("moto_rental");
    expect(guardKind(said({ kind: "car_rental", title: "Bisiklet kiralama", city: "Porto" })).kind).toBe("bike_rental");
    expect(guardKind(said({ kind: "car_rental", title: "Araç kiralama", city: "Porto" })).kind).toBe("car_rental");
    expect(plannedItem(guardKind(said({ kind: "car_rental", title: "Madeira Karavan", city: "Funchal", date: "2026-10-11", end_date: "2026-10-18" })), "t1", "rv", 1).plannedKind).toBe("rv_rental");
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

describe("a taxi named anew (Emre 2026-10-24: \"havalimanı olanı sil, Uber yolculukları koy\")", () => {
  it("the ends its generated name was made from go with that name; ends said again, or no new name, stay", () => {
    const before = plannedItem(said({ kind: "taxi", from: "Havalimanı", to: "Bonfim", date: "2026-10-07", time: "15:00" }), "t1", "x", 1);
    expect(before.name).toBe("Taksi · Havalimanı → Bonfim");
    const renamed = fillPlanned(said({ kind: "taxi", title: "Uber Yolculukları" }), before);
    expect([renamed.from, renamed.to, renamed.title, renamed.date, renamed.time]).toEqual([null, null, "Uber Yolculukları", "2026-10-07", "15:00"]);
    expect(fillPlanned(said({ kind: "taxi", title: "Uber", to: "Bonfim" }), before).from).toBe("Havalimanı");
    expect(fillPlanned(said({ kind: "taxi", time: "16:00" }), before).to).toBe("Bonfim");
    // A name of its own already: renaming it again keeps its ends (they were said, not made up).
    const own = plannedItem(said({ kind: "taxi", from: "Havalimanı", to: "Bonfim", date: "2026-10-07", title: "Gece taksisi" }), "t1", "y", 1);
    expect(fillPlanned(said({ kind: "taxi", title: "Uber gece" }), own).from).toBe("Havalimanı");
  });
});
