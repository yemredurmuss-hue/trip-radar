// tests/specialStayNeed.test.ts: a stay of its own ("Cam tavanlı kulübe") asks the stays' search for itself in words, so
// real options can come on its card; when none come, the card stays for the traveller to search (omurga 2026-10-31).
import { describe, expect, it } from "vitest";
import { offerNeed } from "../src/lib/intentFrame";

const head = (over: Record<string, unknown> = {}) => ({ name: "Tromsø", route: null, parts: [], kindWord: null, word: null, wants: [], image: null, city: "Tromsø", date: "2027-02-12", nights: 1, ...over });
const at = { adults: 2, children: null, rooms: null, countries: ["NO"], countryNames: [], stay: "hotels" };

describe("a stay's search words", () => {
  it("a stay of its own searches its own name", () => {
    const need = offerNeed({ kind: "stay", head: head({ name: "Cam tavanlı kulübe (1 gece)", word: "Kulübe" }) } as never, at as never);
    expect(need?.stay).toBe("Cam tavanlı kulübe");
  });
  it("a hotel said by name in the chat is no stay of its own: the trip's wish", () => {
    expect(offerNeed({ kind: "stay", head: head({ name: "Casa Alfama" }) } as never, at as never)?.stay).toBe("hotels");
  });
  it("an ordinary stay keeps the trip's wish", () => {
    expect(offerNeed({ kind: "stay", head: head() } as never, at as never)?.stay).toBe("hotels");
    expect(offerNeed({ kind: "stay", head: head({ name: "Konaklama · Tromsø" }) } as never, at as never)?.stay).toBe("hotels");
    expect(offerNeed({ kind: "stay", head: head({ name: "Tromsø konaklaması" }) } as never, at as never)?.stay).toBe("hotels");
  });
});
