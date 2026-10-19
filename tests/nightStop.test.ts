import { describe, expect, it } from "vitest";
import { nightStopOf, offerItem, validOffers, type Need } from "../src/lib/offerSource";
import { nightChip } from "../src/lib/ticketView";

const need: Need = { key: "flight:IST:OPO:2026-11-12", section: "flight", kind: "flight", from: "IST", to: "OPO", start: "2026-11-12", adults: 1 };
const raw = {
  id: "f1", kind: "flight", title: "Pegasus", price: 300, currency: "EUR", url: "https://www.kiwi.com/x", why: "", source: "Kiwi.com", fetchedAt: 1,
  carrier: "Pegasus", carrierCode: "PC", depart: "21:40", arrive: "10:05", fromCode: "IST", toCode: "OPO", durationMinutes: 805, stops: 1,
  nightStop: { at: "MAD", minutes: 420, from: "00:55", to: "07:55" },
};

describe("a night change of plane on the ticket (spec 2026-10-19 SerpApi, item 6)", () => {
  it("keeps a well-formed one from the source, nothing made up", () => {
    expect(nightStopOf(raw.nightStop)).toEqual(raw.nightStop);
    expect(nightStopOf({ ...raw.nightStop, at: "Madrid" })).toBeNull();
    expect(nightStopOf({ ...raw.nightStop, minutes: 30 })).toBeNull();
    expect(nightStopOf({ ...raw.nightStop, from: "1:55" })).toBeNull();
    expect(nightStopOf(null)).toBeNull();
  });
  it("comes in with a flight's offer and onto the saved option", () => {
    const [o] = validOffers([raw], need);
    expect(o.nightStop).toEqual(raw.nightStop);
    expect(offerItem(o, need, "t1", "n1", 1).nightStop).toEqual(raw.nightStop);
    const [plain] = validOffers([{ ...raw, nightStop: undefined }], need);
    expect(offerItem(plain, need, "t1", "n2", 1)).not.toHaveProperty("nightStop");
  });
  it("says where, how long and from when to when, the city named", () => {
    expect(nightChip({ nightStop: raw.nightStop })).toEqual({ kind: "night", text: "Gece aktarması · Madrid'de 7 sa (00:55–07:55)" });
    expect(nightChip({ nightStop: { at: "DOH", minutes: 210, from: "22:40", to: "02:10" } })?.text).toBe("Gece aktarması · Doha'da 3 sa 30 dk (22:40–02:10)");
    expect(nightChip({})).toBeNull();
  });
});
