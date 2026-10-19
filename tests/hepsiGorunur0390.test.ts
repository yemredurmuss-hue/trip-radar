// 0.39.0, Emre: "Seçenekleri her durumda görebilmek, açabilmek gerekir." Past the box's three, none is dropped.
import { describe, expect, it } from "vitest";
import { otherOptions } from "../src/lib/intentFrame";
import type { OptionVM } from "../src/lib/intents";

const o = (id: string) => ({ id }) as unknown as OptionVM;
const vm = (status: string, options: string[], more: string[], chosen: string | null = null) =>
  ({ status, frame: "stay", options: options.map(o), more: more.map(o), chosen: chosen ? o(chosen) : null }) as never;

describe("every option can be seen in any state", () => {
  it("still deciding: the three stand in the box, the rest under it", () => {
    expect(otherOptions(vm("deciding", ["a", "b", "c"], ["d", "e"])).map((x) => x.id)).toEqual(["d", "e"]);
    expect(otherOptions(vm("searching", ["a"], [])).map((x) => x.id)).toEqual([]);
  });
  it("chosen, booked, arranged or included: every other one, the fourth and fifth too", () => {
    for (const s of ["chosen", "booked", "arranged", "included"]) {
      expect(otherOptions(vm(s, ["a", "b", "c"], ["d", "e"], "a")).map((x) => x.id)).toEqual(["b", "c", "d", "e"]);
    }
  });
  it("a row of cards keeps its own rows", () => {
    expect(otherOptions({ ...(vm("chosen", ["a", "b"], ["c"], "a") as object), frame: "collection" } as never)).toEqual([]);
  });
});
