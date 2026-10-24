// Sohbet Faz 0 (2026-10-24, docs/arastirma/2026-10-24-sohbet-ajan-plani.md), Emre's own words as cases: "genel uber
// yolculukları diyor ama plana A noktası B noktası getiriyor", "karavan dediğim halde araç kiralama ekliyor", "11-18 ekim
// 7 gün olduğu halde 8 gün hesaplamış". Also the row's "Araç kiralama kiralama".
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { checkPlanned, guardKind, plannedInput, plannedItem, PLANNED_KINDS } from "../src/lib/planned";
import { rowView } from "../src/lib/rowView";
import type { Item } from "../src/lib/types";
import { boardOf, japan, JAPAN_TODAY } from "./fixtures/v82Trips";

const rowOf = (extra: Item[], id: string) => {
  const { trip, items } = japan();
  const vm = boardOf(trip, [...items, ...extra], JAPAN_TODAY).intents.find((v) => v.itemIds?.includes(id) || v.chosen?.id === id);
  return vm ? rowView(vm) : null;
};

describe("rides for the whole trip", () => {
  it("'Tüm gezi', 'genel' and a place to itself are no road", () => {
    expect(plannedInput({ kind: "taxi", title: "Uber Yolculukları", from: "Tüm gezi", to: "Tüm gezi" })).toMatchObject({ from: null, to: null, city: null });
    expect(plannedInput({ kind: "taxi", title: "Uber", from: "genel", to: "Whole trip", city: "tüm sezon" })).toMatchObject({ from: null, to: null, city: null });
    expect(plannedInput({ kind: "taxi", title: "Uber", from: "Porto", to: "Porto", date: "2026-10-07" })).toMatchObject({ from: null, to: null, city: "Porto" });
    // A real road stays.
    expect(plannedInput({ kind: "taxi", from: "Havalimanı", to: "Bonfim", date: "2026-10-07" })).toMatchObject({ from: "Havalimanı", to: "Bonfim" });
  });
  it("a ride with no day and no road needs its name, then it is the whole trip's line", () => {
    expect(checkPlanned(plannedInput({ kind: "taxi", title: "Uber Yolculukları" }), PLANNED_KINDS)).toBeNull();
    expect(checkPlanned(plannedInput({ kind: "taxi" }), PLANNED_KINDS)).toMatch(/ad \(title\)/);
    expect(checkPlanned(plannedInput({ kind: "taxi", from: "Otel", to: "Havalimanı" }), PLANNED_KINDS)).toMatch(/gününü/);
  });
  it("on the Plan: by its name, 'Tüm gezi' under it, no made-up road", () => {
    const { trip } = japan();
    const uber = plannedItem(plannedInput({ kind: "taxi", title: "Uber Yolculukları", from: "Tüm gezi", to: "Tüm gezi" }), trip.id, "uber", 1);
    const r = rowOf([uber], "uber");
    expect(r?.title).toBe("Uber Yolculukları");
    expect(r?.line.map((p) => p.text)).toEqual(["Tüm gezi"]);
  });
});

describe("a camper is a camper, its days are 7", () => {
  it("said as a car rental with the camper's name: a camper on the Plan", () => {
    const { trip } = japan();
    const said = guardKind(plannedInput({ kind: "car_rental", title: "Madeira Karavan Kiralama (11-18 Ekim)", city: "Tokyo", date: "2027-04-03", end_date: "2027-04-10" }));
    expect(said.kind).toBe("rv_rental");
    const rv = plannedItem(said, trip.id, "rv", 1);
    expect(rv.plannedKind).toBe("rv_rental");
    const r = rowOf([rv], "rv");
    expect(r?.lead).toMatch(/^Karavan kiralama · 7 gün$/);
  });
  it("a car rental's row: 'Araç kiralama · 7 gün', the word once", () => {
    const { trip } = japan();
    const car = plannedItem(plannedInput({ kind: "car_rental", title: "Porto araç kiralama", city: "Tokyo", date: "2027-04-03", end_date: "2027-04-10" }), trip.id, "car", 1);
    expect(rowOf([car], "car")?.lead).toBe("Araç kiralama · 7 gün");
  });
});
