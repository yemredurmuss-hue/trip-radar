// P4: every screen says the same (the UX test's F42): an undated stay chosen holds its city's open nights.
import { describe, expect, it } from "vitest";
import { heldStay, type StayBlock } from "../src/lib/plan";
import type { Item } from "../src/lib/types";

const stay = (id: string, status: Item["status"]) => ({ id, name: id, status, category: "stay" }) as Item;

describe("P4", () => {
  it("F42: open nights name the stay chosen or booked among their options, else none", () => {
    const open = (items: Item[]): StayBlock => ({
      kind: "open",
      range: { start: "2026-11-15", end: "2026-11-18" },
      nights: 3,
      city: "Porto",
      groups: [{ key: "g", category: "stay", title: "", items, range: null, booked: null }],
      searchUrl: "",
    });
    expect(heldStay(open([stay("a", "saved"), stay("Wine & Books", "chosen")]))?.name).toBe("Wine & Books");
    expect(heldStay(open([stay("b", "chosen"), stay("Vincci", "booked")]))?.name).toBe("Vincci");
    expect(heldStay(open([stay("a", "saved")]))).toBeNull();
  });
});
