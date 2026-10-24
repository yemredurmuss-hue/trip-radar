// A ride the traveller named with no road ("Uber Yolculukları", priced in one) stands on the Plan by its name (2026-10-24,
// Emre: "Uber yolculukları koy dedim, havaalanı koydu; onu sil Uber yolculukları koy dedim, chat koydum dedi ama ulaşımda
// bir şey çıkmadı"): never closed into the day's transfer page, never hidden behind the day's first taxi, and a taxi named
// anew loses the road its old, generated name was made from.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { bookedUpdate } from "../src/lib/chatBooking";
import { planToSave, plannedItem, type PlannedInput } from "../src/lib/planned";
import { rowView } from "../src/lib/rowView";
import type { Item } from "../src/lib/types";
import { boardOf, japan, JAPAN_TODAY } from "./fixtures/v82Trips";

const taxi = (over: Partial<PlannedInput>): PlannedInput => ({
  kind: "taxi", date: "2027-04-02", end_date: null, time: "10:00", from: null, to: null, city: "Tokyo", title: null, booked: false, note: null, ...over,
});
const rowOf = (extra: Item[], id: string) => {
  const { trip, items } = japan();
  const vm = boardOf(trip, [...items, ...extra], JAPAN_TODAY).intents.find((v) => v.itemIds?.includes(id) || v.chosen?.id === id);
  return vm ? rowView(vm) : null;
};

describe("named rides on the Plan", () => {
  it("rides named with no road, beside the day's hotel transfer (a page): their own row, by their name", () => {
    const { trip } = japan();
    const uber = plannedItem(taxi({ title: "Uber Yolculukları" }), trip.id, "uber", 1);
    const r = rowOf([uber], "uber");
    expect(r?.title).toBe("Uber Yolculukları");
    expect(r?.line.map((p) => p.text)).toEqual(["2 Nisan"]);
  });

  it("two taxis said the same day: the second is its own row, not hidden behind the first", () => {
    const { trip } = japan();
    const airport = plannedItem(taxi({ from: "HND", to: "Otel", time: "15:00" }), trip.id, "airport", 1);
    const uber = plannedItem(taxi({ title: "Uber Yolculukları" }), trip.id, "uber", 2);
    expect(rowOf([airport, uber], "uber")?.title).toBe("Uber Yolculukları");
  });

  it("the airport taxi named Uber Yolculukları: the same record, its old road gone, the row by its new name", () => {
    const { trip } = japan();
    const airport = plannedItem(taxi({ from: "Havalimanı", to: "Bonfim", time: "15:00" }), trip.id, "airport", 1);
    expect(airport.name).toBe("Taksi · Havalimanı → Bonfim");
    const { item, same } = planToSave(taxi({ title: "Uber Yolculukları", time: null, city: null }), [airport], trip.id, "new-id", 2);
    expect(same?.id).toBe("airport");
    expect(item).toMatchObject({ id: "airport", name: "Uber Yolculukları" });
    expect(item.flight?.from ?? null).toBeNull();
    expect(rowOf([item], "airport")?.title).toBe("Uber Yolculukları");
  });

  it("named anew by its id (the chat's update): the same, its road gone and said so; a name of its own keeps its road", () => {
    const { trip } = japan();
    const airport = plannedItem(taxi({ from: "Havalimanı", to: "Bonfim", time: "15:00" }), trip.id, "airport", 1);
    const up = bookedUpdate(airport, taxi({ title: "Uber Yolculukları", time: null }), { provider: null, price: null, currency: null }, [airport], 2);
    if (typeof up === "string") throw new Error(up);
    expect(up.item.name).toBe("Uber Yolculukları");
    expect([up.item.flight?.from ?? null, up.item.flight?.to ?? null]).toEqual([null, null]);
    expect(up.fields).toContain("route");
    const own = plannedItem(taxi({ from: "Havalimanı", to: "Bonfim", title: "Gece taksisi" }), trip.id, "own", 1);
    const kept = bookedUpdate(own, taxi({ title: "Uber gece", time: null }), { provider: null, price: null, currency: null }, [own], 2);
    if (typeof kept === "string") throw new Error(kept);
    expect(kept.item.flight?.from).toBe("Havalimanı");
  });
});
