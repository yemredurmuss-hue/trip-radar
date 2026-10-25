// A stop's country for its tours (collectionCards.stopCountry): its stay's, else a record of the same town, else the trip's most common.
import { describe, expect, it } from "vitest";
import { stopCountry } from "../src/lib/collectionCards";
import { makeItem } from "./fixtures/makeItem";

describe("stopCountry", () => {
  it("a stop whose stay has no country: a record of the town says it, else the trip's most common", () => {
    const plan = { stayBlocks: [{ kind: "open", city: "Tromsø", slot: null } as never] };
    const items = [makeItem({ city: "Oslo", countryCode: "NO" }), makeItem({ city: "Bergen", countryCode: "NO" }), makeItem({ city: "Stockholm", countryCode: "SE" })];
    expect(stopCountry(plan, "Tromsø", items)).toBe("NO");
    expect(stopCountry(plan, "Stockholm", items)).toBe("SE");
    expect(stopCountry(plan, "Tromsø")).toBeNull();
  });
});
