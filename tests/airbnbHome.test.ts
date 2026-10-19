import { describe, expect, it } from "vitest";
import { offerNeed, wantsHome } from "../src/lib/intentFrame";
import { queryOf } from "../src/lib/offerSources";
import { makeItem } from "./fixtures/makeItem";

const flat = { item: makeItem({ category: "stay", metrics: { stayKind: "apartment" } as never }) };
const room = { item: makeItem({ category: "stay", metrics: { stayKind: "hotel_room" } as never }) };
const at = { countries: ["PT"], countryNames: ["Portekiz"], adults: 2 };

describe("a stay that wants a home: Airbnb is asked too (spec 2026-10-19 SerpApi, item 7)", () => {
  it("is a long stay, a big group, or one with a flat or a house among its options", () => {
    expect(wantsHome(21, 2, [])).toBe(true);
    expect(wantsHome(3, 5, [])).toBe(true);
    expect(wantsHome(3, 2, [room, flat])).toBe(true);
    expect(wantsHome(3, 2, [room])).toBe(false);
    expect(wantsHome(null, null, [])).toBe(false);
  });
  it("says so on the stay's question, and only then", () => {
    const vm = { kind: "stay" as const, head: { city: "Lizbon", date: "2026-11-12", nights: 3 } as never };
    const need = offerNeed({ ...vm, options: [flat] as never }, at)!;
    expect(need).toMatchObject({ kind: "stay", city: "Lizbon", home: true });
    expect(queryOf(need, "tr")).toContain("home=1");
    const plain = offerNeed({ ...vm, options: [room] as never }, at)!;
    expect(plain).not.toHaveProperty("home");
    expect(queryOf(plain, "tr")).not.toContain("home=");
  });
});
