// Karar Masası, getirme anları (lib/bring.ts): what is brought to a row goes to its need, and once read the row says where
// it stands, only from what is known.
import { describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import type { OptionVM } from "../src/lib/intents";
import { arrivedOption, bringKey, deckVerdict } from "../src/lib/bring";

setLang("tr");

const opt = (id: string, amount: number | null, stops: number | null, over: Partial<OptionVM> = {}, createdAt = 1): OptionVM =>
  ({
    id,
    ours: false,
    item: { id, createdAt, price: { amount, currency: amount == null ? null : "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 }, flight: stops == null ? null : { stops } },
    ...over,
  }) as unknown as OptionVM;

describe("bringKey", () => {
  it("a flight's way and day, as an offer added from its box", () => {
    expect(bringKey({ kind: "flight", head: { route: { from: "Bangkok", to: "İstanbul" }, date: "2027-04-02" } } as never)).toBe("flight:bangkok:istanbul:2027-04-02");
    expect(bringKey({ kind: "stay", head: { route: null, date: "2027-04-02" } } as never)).toBeNull();
  });
});

describe("arrivedOption", () => {
  it("the one not in the deck before, the newest first", () => {
    const deck = [opt("a", 300, 0), opt("b", 200, 1, {}, 5), opt("c", 250, 0, {}, 9)];
    expect(arrivedOption(new Set(["a"]), deck)?.id).toBe("c");
    expect(arrivedOption(new Set(["a", "b", "c"]), deck)).toBeNull();
  });
});

describe("deckVerdict", () => {
  const ours = opt("ours", 326, 0, { ours: true });
  it("its price against our pick's and its stops when they differ", () => {
    expect(deckVerdict(opt("p", 412, 1), [ours, opt("p", 412, 1)])).toBe("Önerimizden €86 pahalı ve aktarmalı.");
    expect(deckVerdict(opt("e", 288, 1), [ours, opt("e", 288, 1)])).toBe("Önerimizden €38 ucuz ve aktarmalı.");
    expect(deckVerdict(opt("s", 326, 0), [ours, opt("s", 326, 0)])).toBe("Önerimizle aynı fiyat.");
  });
  it("leading now: it says so", () => {
    expect(deckVerdict(opt("e", 288, 1, { ours: true }), [opt("e", 288, 1, { ours: true }), opt("t", 326, 0)])).toBe("Artık önerimiz bu.");
  });
  it("nothing known, nothing said; no pick: set beside the deck's first", () => {
    expect(deckVerdict(opt("x", null, null), [ours, opt("x", null, null)])).toBeNull();
    expect(deckVerdict(opt("x", 300, 0), [opt("first", 250, 0), opt("x", 300, 0)])).toBe("İlk sıradakinden €50 pahalı.");
    expect(deckVerdict(opt("x", 300, 0), [opt("x", 300, 0)])).toBeNull();
  });
});

describe("flightSearchOf: a flight search's way and day from its address", () => {
  it("Skyscanner, Kayak, Kiwi, our own Google Flights", async () => {
    const { flightSearchOf } = await import("../src/lib/url");
    expect(flightSearchOf("https://www.skyscanner.com.tr/transport/flights/bkk/ist/270402/?adultsv2=2")).toMatchObject({ from: "BKK", to: "IST", day: "2027-04-02" });
    expect(flightSearchOf("https://www.kayak.com/flights/BKK-IST/2027-04-02/2adults")).toMatchObject({ from: "BKK", to: "IST", day: "2027-04-02" });
    expect(flightSearchOf("https://www.kiwi.com/tr/search/results/bangkok-thailand/istanbul-turkey/2027-04-02/no-return")).toMatchObject({ from: "Bangkok", to: "İstanbul", day: "2027-04-02", provider: "Kiwi.com" });
    expect(flightSearchOf("https://www.google.com/travel/flights?q=Flights%20from%20BKK%20to%20IST%20on%202027-04-02%20one%20way")).toMatchObject({ from: "BKK", to: "IST", day: "2027-04-02" });
    expect(flightSearchOf("https://www.google.com/travel/flights?tfs=CBwQAhoeEgoy")).toBeNull();
    expect(flightSearchOf("https://www.booking.com/hotel/th/x.html")).toBeNull();
  });
});

describe("planFlightFor: the plan's row a flight search is for", () => {
  it("the trip whose flights go that way on that day (a day either side), the most of them", async () => {
    const { planFlightFor } = await import("../src/lib/bring");
    const fl = (id: string, tripId: string, from: string, to: string, day: string, status = "saved") =>
      ({ id, tripId, category: "flight", status, flight: { from, to, departure: `${day}T10:00` }, dates: { start: day } }) as never;
    const items = [fl("a", "th", "BKK", "IST", "2027-04-02"), fl("b", "th", "Bangkok", "İstanbul", "2027-04-03"), fl("c", "jp", "BKK", "IST", "2027-04-02"), fl("d", "th", "BKK", "IST", "2027-04-09"), fl("e", "th", "BKK", "IST", "2027-04-02", "dismissed"), fl("f", "th", "IST", "BKK", "2027-04-02")];
    const p = planFlightFor(items, { from: "BKK", to: "IST", day: "2027-04-02" });
    expect(p).toMatchObject({ tripId: "th", ids: ["a", "b"], day: "2027-04-02" });
    // (its ends compared as the plan compares cities: plan.cityKeyOf folds case and the dotless ı)
    expect(p?.forNeed.replace(/ı/g, "i")).toBe("flight:bangkok:istanbul:2027-04-02");
    expect(planFlightFor(items, { from: "HKT", to: "BKK", day: "2027-03-31" })).toBeNull();
  });
});
