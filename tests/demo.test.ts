// The sample trip shows the transfers on its own: in from the airport, the train to Lisbon with its
// station transfers, and back to the airport with the hours between check-out and the flight.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { loadDemoTrip } from "../src/lib/demo";
import { buildLegs, legTiming } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";

describe("demo trip", () => {
  it("has its transfers laid out", async () => {
    const id = await loadDemoTrip();
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const { ctx } = await loadDecisions(trip, items);
    const legs = buildLegs(buildPlan(trip, items), trip, ctx.listings);
    expect(legs.map((l) => `${l.date} ${l.from.label} → ${l.to.label} [${l.statusText}]`)).toEqual([
      "2026-10-08 OPO havalimanı → Porto konaklaması [Boş]",
      "2026-10-11 Porto konaklaması → Porto Campanhã [Boş]",
      "2026-10-11 Porto konaklaması → Lisboa Loft [1 seçenek]",
      "2026-10-11 Lisboa Santa Apolónia → Lisboa Loft [Boş]",
      "2026-10-14 Lisboa Loft → LIS havalimanı [Boş]",
    ]);
    const home = legs.at(-1)!;
    expect(legTiming(home)).toBe("İdeali 16:40, en geç 17:40 havalimanında"); // abroad: 3 h ideally, 2 h at least
    expect(home.notes).toEqual(["Çıkış 11:00 (genelde), gidiş 19:40: arada ~5 saat boşluk; bavul emaneti ya da geç çıkış sor."]);
  });
});
