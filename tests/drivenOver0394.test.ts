// 0.39.4 (Emre: araba kiralanan günlerde tren/otobüs öneriyor): "araba varsa tren önerme" was only the review prompt's
// words; now the code drops a train or bus suggestion whose day a rented car covers, whoever suggested it (the AI review,
// the chat), as covers.wayCoverOf counts those roads driven. A flight, a ferry or a day without a car still shows.
import { describe, expect, it } from "vitest";
import { carOnDay } from "../src/lib/covers";
import { coveringItems, drivenOver, isGroundWaySuggestion, shownSuggestions } from "../src/lib/suggestions";
import type { Suggestion } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const car = makeItem({ id: "car", category: "transport", plannedKind: "car_rental", name: "Araç kiralama · Kolombo", status: "chosen", dates: { start: "2026-12-12", end: "2026-12-18", source: "page" } });
const stay = makeItem({ id: "s", category: "stay", name: "Ella Lodge", dates: { start: "2026-12-10", end: "2026-12-24", source: "page" } });
const sug = (over: Partial<Suggestion>): Suggestion =>
  ({ key: `k-${Math.random()}`, section: "transport", kind: "add", title: "Kandy–Ella treni", why: "Manzaralı.", template: "train", source: "ai", state: "open", createdAt: 1, payload: { start: "2026-12-14", end: "" }, ...over }) as Suggestion;

describe("a train or bus on a day the car is driven", () => {
  it("is known by its template, or its words when it has none", () => {
    expect(isGroundWaySuggestion(sug({}))).toBe(true);
    expect(isGroundWaySuggestion(sug({ template: undefined, title: "Galle'ye otobüs" }))).toBe(true);
    expect(isGroundWaySuggestion(sug({ template: "ferry", title: "Feribot" }))).toBe(false);
    expect(isGroundWaySuggestion(sug({ kind: "warning", template: undefined }))).toBe(false);
  });
  it("is covered by the car on its days; not before it, not after it, not without one", () => {
    expect(carOnDay([car], "2026-12-14")?.id).toBe("car");
    expect(drivenOver(sug({}), [car, stay])?.id).toBe("car");
    expect(drivenOver(sug({ payload: { start: "2026-12-11", end: "" } } as Partial<Suggestion>), [car, stay])).toBeNull();
    expect(drivenOver(sug({ payload: { start: "2026-12-20", end: "" } } as Partial<Suggestion>), [car, stay])).toBeNull();
    expect(drivenOver(sug({}), [stay])).toBeNull();
    expect(drivenOver(sug({ payload: { start: "", end: "" } } as Partial<Suggestion>), [car, stay])).toBeNull();
    // A car taken off the plan covers nothing.
    expect(drivenOver(sug({}), [{ ...car, status: "dismissed" }, stay])).toBeNull();
  });
  it("a car put on with no last day runs to the trip's end", () => {
    const open = { ...car, dates: { start: "2026-12-10", end: null, source: "page" as const } };
    expect(drivenOver(sug({ payload: { start: "2026-12-22", end: "" } } as Partial<Suggestion>), [open, stay])?.id).toBe("car");
  });
  it("isn't shown on the board, and the chat's suggest hears 'already on the plan'", () => {
    const train = sug({ key: "train" });
    const ferry = sug({ key: "ferry", template: "ferry", title: "Feribot" });
    const later = sug({ key: "later", payload: { start: "2026-12-21", end: "" } } as Partial<Suggestion>);
    expect(shownSuggestions([train, ferry, later], [], [car, stay]).map((s) => s.key)).toEqual(["ferry", "later"]);
    expect(coveringItems(train, [car, stay]).map((i) => i.id)).toEqual(["car"]);
  });
});
