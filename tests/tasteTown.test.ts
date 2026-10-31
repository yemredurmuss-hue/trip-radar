// tests/tasteTown.test.ts: the asked-for tour ("husky") is searched where the town's own tours were found, under the name
// the source knows ("Tromso", not "Tromsø"): searched under the marked name it found nothing, so only the town's general
// tours showed (omurga 2026-10-31, Emre: "Husky turu kartı var ama önerileri gelmemiş").
import { describe, expect, it } from "vitest";
import { cityTours } from "../src/lib/offerSources";
import type { Need, Offer } from "../src/lib/offerSource";

const offer = (id: string, title: string): Offer => ({ id, kind: "activity", title, url: `https://x/${id}`, price: null, photo: null, source: "viator" } as unknown as Offer);
const source = {
  offers: async (n: Need): Promise<Offer[]> => {
    if (n.city !== "Tromso") return []; // the source knows the town only without its marks
    return n.query ? [offer("h1", "Husky Sledding Adventure")] : [offer("a1", "Northern Lights Chase"), offer("a2", "Aurora Minibus")];
  },
};

describe("the asked-for tour in a town with marks in its name", () => {
  it("is searched under the name that found the town's tours, and comes first", async () => {
    const need = { key: "activity|tromsø", section: "activity", kind: "activity", city: "Tromsø", start: "2027-02-15", end: "2027-02-20", adults: 2 } as unknown as Need;
    const list = await cityTours(source, need, "NO", [], ["husky"]);
    expect(list[0]?.title).toBe("Husky Sledding Adventure");
    expect(list.map((o) => o.title)).toContain("Northern Lights Chase");
  });
});
