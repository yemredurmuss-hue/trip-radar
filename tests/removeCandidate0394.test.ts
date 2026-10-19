// 0.39.4 (Emre: "eklediğim oteli çıkaramıyorum"): a box still to choose had only "Ben hallettim" and "Gerek yok" (all its
// nights) in its ⋯; now "Kaldır" deletes the one candidate with the board's Sil (and its Geri al). No new button on the card.
import { describe, expect, it, vi } from "vitest";
import { removeEntries } from "../src/app/plan/v82/removeEntries";
import { makeItem } from "./fixtures/makeItem";

const hotel = makeItem({ id: "h", category: "stay", name: "Clock Inn", status: "saved" });
const other = makeItem({ id: "o", category: "stay", name: "Queens Hotel", status: "saved" });
const byId = (...xs: ReturnType<typeof makeItem>[]) => new Map(xs.map((i) => [i.id, i]));

describe("Kaldır in a box still to choose", () => {
  it("one candidate: one 'Kaldır' that deletes only it", () => {
    const remove = vi.fn();
    const entries = removeEntries([{ item: hotel }], byId(hotel), remove);
    expect(entries.map((e) => [e.label, e.danger])).toEqual([["Kaldır", true]]);
    entries[0].run();
    expect(remove).toHaveBeenCalledWith(hotel);
  });
  it("several: each by name under a 'Kaldır' heading; the same one listed twice once", () => {
    const remove = vi.fn();
    const entries = removeEntries([{ item: hotel }, { item: other }, { item: hotel }], byId(hotel, other), remove);
    expect(entries.map((e) => [e.label, !!e.heading])).toEqual([["Kaldır", true], ["Clock Inn", false], ["Queens Hotel", false]]);
    entries[2].run();
    expect(remove).toHaveBeenCalledWith(other);
  });
  it("none for a chosen, booked or dismissed record, or an option that is no record on the trip", () => {
    const chosen = { ...hotel, status: "chosen" as const };
    const booked = { ...other, status: "booked" as const };
    const gone = makeItem({ id: "g", status: "dismissed" });
    expect(removeEntries([{ item: chosen }, { item: booked }, { item: gone }], byId(chosen, booked, gone), vi.fn())).toEqual([]);
    expect(removeEntries([{ item: makeItem({ id: "offer" }) }], byId(), vi.fn())).toEqual([]);
  });
});
