// A tour's × (0.44.2): kept among the trip's suggestions as said not needed, never shown back as a suggestion itself.
import { describe, expect, it } from "vitest";
import { offerHidden, offerKey } from "../src/lib/collectionCards";
import { shownSuggestions } from "../src/lib/suggestions";

describe("offerHidden", () => {
  it("a rule-kind suggestion under the offer's key; open again (Geri getir), still never a suggestion card", () => {
    const s = offerHidden({ id: "viator:123", title: "Ubud yemek kursu" });
    expect(s.key).toBe(offerKey({ id: "viator:123" }));
    expect(s.key).toBe("offer:viator:123");
    expect(shownSuggestions([{ ...s, state: "dismissed" }], [])).toEqual([]);
    expect(shownSuggestions([{ ...s, state: "open" }], [])).toEqual([]);
  });
});
