// P10: the UX test's last open ones (F11, F49, F61, F63).
import { beforeEach, describe, expect, it } from "vitest";
import { setLang } from "../src/lib/i18n";
import { joinSameStops, withNextStep } from "../src/lib/startTrip";
import { tourWords } from "../src/lib/offerSources";
import { tooLowForATour } from "../src/lib/items";
import type { Trip } from "../src/lib/types";

beforeEach(() => setLang("tr"));

describe("P10", () => {
  it("F11: the ready line says the hero's next step, not its own first one", () => {
    const ready = "7 Günlük Porto Gezisi hazır: 6 gece, 2 durak. Önce uçuşu bul, sonra Porto konaklamasını seçelim. Her adımda buradayım.";
    expect(withNextStep(ready, "Sıradaki: vize durumun")).toBe("7 Günlük Porto Gezisi hazır: 6 gece, 2 durak. Sıradaki: vize durumun. Her adımda buradayım.");
    expect(withNextStep(ready, null)).toBe(ready);
  });

  it("F61: two stops of one city in a row are one", () => {
    const r = joinSameStops({ stops: [{ city: "Ubud", nights: 4 }, { city: "Ubud", nights: 3 }, { city: "Uluwatu", nights: 7 }] });
    expect(r.stops.map((x) => [x.city, x.nights])).toEqual([["Ubud", 7], ["Uluwatu", 7]]);
  });

  it("F63: a honeymoon's tours are romantic ones", () => {
    expect(tourWords({ intent: { playbook: "honeymoon", name: "Bali", label: null } } as unknown as Trip)).toContain("romantic");
  });

  it("F49: a tour at €3 is a misread price, a museum at €3 is not", () => {
    const x = (name: string, amount = 3, currency = "EUR") => ({ category: "activity", name, price: { amount, currency } }) as unknown as Parameters<typeof tooLowForATour>[0];
    expect(tooLowForATour(x("Budapest Downtown Guided Segway Tour"))).toBe(true);
    expect(tooLowForATour(x("Hungarian National Museum"))).toBe(false);
    expect(tooLowForATour(x("Danube boat tour", 35))).toBe(false);
    expect(tooLowForATour(x("Boğaz turu", 3, "TRY"))).toBe(false);
  });
});
