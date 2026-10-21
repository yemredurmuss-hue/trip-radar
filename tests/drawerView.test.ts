// The options beside the plan (plan v13, spec 2026-10-21 K82–K83): which tab an option is in, its day, the order, and what
// decides between flights on different days.
import { describe, expect, it } from "vitest";
import { bagAll, compareMode, drawerList, optionDay, optionDays, optionTab, totalAmount, winners, pickReason } from "../src/lib/drawerView";
import type { OptionVM } from "../src/lib/intents";

let n = 0;
function opt(o: { day?: string; price?: number | null; scope?: "total" | "per_person" | "per_night"; mins?: number | null; stops?: number | null; bag?: boolean | null; ai?: boolean; score?: number | null; rating?: number | null; dist?: number | null }): OptionVM {
  n += 1;
  const item = {
    id: `i${n}`,
    name: `Seçenek ${n}`,
    dates: { start: o.day ?? "2027-01-15", end: null },
    price: { amount: o.price === undefined ? 100 : o.price, currency: "EUR", scope: o.scope ?? "total", taxesIncluded: "unknown", source: "page", observedAt: 0 },
    rating: { value: o.rating ?? null, scale: 10, count: null, source: "page" },
    flight: o.stops === undefined ? null : { from: "IST", to: "TOS", departure: null, arrival: null, stops: o.stops },
    metrics: { reviewAspects: [], amenities: [], cancellationType: "unknown", distanceToCenterKm: o.dist ?? null, durationMinutes: o.mins ?? null, checkedBagIncluded: o.bag ?? null, dataGb: null, unlimitedData: null, validityDays: null },
  };
  return {
    id: item.id,
    item: item as unknown as OptionVM["item"],
    title: item.name,
    brand: null,
    source: o.ai ? { kind: "ai" } : { kind: "link" },
    image: null,
    price: null,
    ticket: null,
    score: o.score ?? null,
    place: n,
    rating: null,
    where: null,
    cancel: null,
    checks: [],
    badges: [],
    ours: false,
    leg: null,
    carrier: null,
    current: false,
    near: [],
    topics: [],
  };
}

describe("drawerView", () => {
  it("puts an option in Kaydettiklerin or AI önerileri by who brought it", () => {
    expect(optionTab(opt({ ai: true }))).toBe("ai");
    expect(optionTab(opt({}))).toBe("mine");
  });

  it("reads an option's day from its start", () => {
    expect(optionDay(opt({ day: "2027-01-14T06:35" }))).toBe("2027-01-14");
  });

  it("filters by tab and by day and sorts by the asked order", () => {
    const a = opt({ day: "2027-01-14", price: 642, ai: true, score: 80 });
    const b = opt({ day: "2027-01-15", price: 504, score: 95 });
    const c = opt({ day: "2027-01-16", price: 447, score: 70 });
    expect(drawerList([a, b, c], "all", "all", "price").map((x) => x.id)).toEqual([c.id, b.id, a.id]);
    expect(drawerList([a, b, c], "all", "all", "fit").map((x) => x.id)).toEqual([b.id, a.id, c.id]);
    expect(drawerList([a, b, c], "mine", "all", "fit").map((x) => x.id)).toEqual([b.id, c.id]);
    expect(drawerList([a, b, c], "ai", "all", "fit").map((x) => x.id)).toEqual([a.id]);
    expect(drawerList([a, b, c], "all", "2027-01-15", "fit").map((x) => x.id)).toEqual([b.id]);
  });

  it("puts options with no price last when sorted by price", () => {
    const a = opt({ price: null });
    const b = opt({ price: 90 });
    expect(drawerList([a, b], "all", "all", "price").map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it("gives each day its cheapest total", () => {
    const days = optionDays([opt({ day: "2027-01-15", price: 504 }), opt({ day: "2027-01-15", price: 486 }), opt({ day: "2027-01-14", price: 564 })], 3);
    expect(days).toEqual([
      { day: "2027-01-14", cheapest: 564 },
      { day: "2027-01-15", cheapest: 486 },
    ]);
  });

  it("counts a per-person fare for everyone going", () => {
    expect(totalAmount(opt({ price: 168, scope: "per_person" }), 3)).toBe(504);
    expect(totalAmount(opt({ price: 672 }), 3)).toBe(672);
    expect(totalAmount(opt({ price: null }), 3)).toBeNull();
  });

  it("compares by what decides only for flights on more than one day", () => {
    const one = [opt({ day: "2027-01-15" }), opt({ day: "2027-01-15" })];
    const many = [opt({ day: "2027-01-15" }), opt({ day: "2027-01-16" })];
    expect(compareMode(many, "flight")).toBe(true);
    expect(compareMode(one, "flight")).toBe(false);
    expect(compareMode(many, "stay")).toBe(false);
    expect(compareMode([opt({ day: "2027-01-15" })], "flight")).toBe(false);
  });

  it("names the cheapest and the shortest, and the fewest stops only when one wins", () => {
    const a = opt({ price: 504, mins: 385, stops: 1 });
    const b = opt({ price: 447, mins: 465, stops: 1 });
    const c = opt({ price: 612, mins: null, stops: 1 });
    const w = winners([a, b, c], 1);
    expect(w.price).toBe(b.id);
    expect(w.mins).toBe(a.id);
    expect(w.stops).toBeUndefined();
    const d = opt({ price: 700, mins: 300, stops: 0 });
    expect(winners([a, b, c, d], 1).stops).toBe(d.id);
  });

  it("skips what isn't known when it names a winner", () => {
    const a = opt({ price: null, mins: null });
    const b = opt({ price: 300, mins: 200 });
    const w = winners([a, b], 1);
    expect(w.price).toBe(b.id);
    expect(w.mins).toBe(b.id);
    expect(winners([opt({ price: null, mins: null })], 1)).toEqual({});
  });

  it("says baggage once when every option has it", () => {
    expect(bagAll([opt({ bag: true }), opt({ bag: true })])).toBe(true);
    expect(bagAll([opt({ bag: true }), opt({ bag: false })])).toBe(false);
    expect(bagAll([opt({ bag: true }), opt({ bag: null })])).toBe(false);
  });
});

describe("pickReason", () => {
  it("keeps the pick's own reasons, not its name or the alternatives", () => {
    expect(pickReason("Önerim Jardim Stay: en sessiz; 2.'ye göre €45 daha ucuz, 5 Eki'ye kadar ücretsiz iptal ve daha konforlu. Tasarruf için 3. Casa Azul (1.'ye göre €45 daha ucuz).", "Jardim Stay")).toBe("En sessiz; 2.'ye göre €45 daha ucuz, 5 Eki'ye kadar ücretsiz iptal ve daha konforlu.");
  });
  it("keeps a thousands dot inside the reasons", () => {
    expect(pickReason("Önerim Loft: €1.200 fazlasına merkezde.", "Loft")).toBe("€1.200 fazlasına merkezde.");
  });
  it("says it fits best when the sentence has no reasons or names another", () => {
    expect(pickReason("Önerim Loft.", "Loft")).toBe("İsteklerine en çok bu uyuyor.");
    expect(pickReason("Önerim Başka: merkezde.", "Loft")).toBe("İsteklerine en çok bu uyuyor.");
    expect(pickReason(null, "Loft")).toBe("İsteklerine en çok bu uyuyor.");
  });
});

describe("totalAmount over the nights (review: per-night vs total)", () => {
  it("a nightly price counts the need's nights, so it sorts against a total for the stay", () => {
    const nightly = opt({ price: 90, scope: "per_night" });
    const whole = opt({ price: 400, scope: "total" });
    expect(totalAmount(nightly, 2, 5)).toBe(450);
    expect(drawerList([nightly, whole], "all", "all", "price", 2, 5).map((o) => o.id)).toEqual([whole.id, nightly.id]);
  });
  it("a nightly price with no nights known is not a total (unknown, sorted last)", () => {
    expect(totalAmount(opt({ price: 90, scope: "per_night" }), 2)).toBeNull();
  });
});

describe("winners ties (review)", () => {
  it("a tie on price or length crowns nobody, as stops", () => {
    const a = opt({ price: 100, mins: 300 });
    const b = opt({ price: 100, mins: 300 });
    expect(winners([a, b])).toEqual({});
  });
});

describe("pickReason in English and with abbreviations (review)", () => {
  it("does not cut at 'St. Moritz'", () => {
    expect(pickReason("Önerim Loft: St. Moritz'e 5 dk. Tasarruf için 2. Ev.", "Loft")).toBe("St. Moritz'e 5 dk.");
  });
});
