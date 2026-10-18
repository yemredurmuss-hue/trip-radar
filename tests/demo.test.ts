// The sample trip shows the transfers on its own: in from the airport, the train to Lisbon with its
// station transfers, and back to the airport with the hours between check-out and the flight.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { demoShift, loadDemoTrip, shiftDates } from "../src/lib/demo";
import { listingKeyOf } from "../src/lib/items";
import { buildLegs, legTiming } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { tripCardPhoto, tripCardPlaces } from "../src/lib/tripBrief";
import { makeItem } from "./fixtures/makeItem";

describe("demo trip", () => {
  it("has its transfers laid out", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" });
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

  it("is always ahead: every date moves so it starts three days after the day it's loaded", async () => {
    expect(demoShift("2026-10-05")).toBe(0);
    expect(demoShift("2026-10-07")).toBe(2);
    expect(demoShift("2027-01-30")).toBe(117);
    const id = await loadDemoTrip({ today: "2026-11-20" }); // 20 Nov + 3 = 23 Nov: 46 days on
    const d = await db();
    const trip = (await d.get("trips", id))!;
    expect(trip.confirmedDates).toEqual({ start: "2026-11-23", end: "2026-11-29" });
    const items = await listItems(id);
    const by = (name: string) => items.find((i) => i.name === name)!;
    const jardim = by("Jardim Stay");
    expect(jardim.dates).toMatchObject({ start: "2026-11-23", end: "2026-11-26" });
    expect(jardim.cancellation).toMatchObject({ summary: "20 Kas'a kadar ücretsiz iptal", freeUntil: "2026-11-20" });
    expect(jardim.url).toContain("checkin=2026-11-23&checkout=2026-11-26");
    const home = by("TAP · Lizbon → İstanbul");
    expect(home.summary).toBe("29 Kasım 19:40 · Direkt");
    expect(home.flight).toMatchObject({ departure: "2026-11-29T19:40", arrival: "2026-11-30T01:35" });
    expect(by("Douro tekne turu").flight?.departure).toBe("2026-11-24T16:00");
    // Undated ones stay undated; the reviews keep their age.
    expect(by("Livraria Lello").dates.start).toBeNull();
    const listing = await d.get("listings", listingKeyOf(jardim));
    expect(listing!.reviews.map((r) => r.date)).toEqual(["2026-10", "2026-10", "2026-09", "2026-09", "2026-08"]);
    expect(shiftDates("2026-10-05", 0)).toBe("2026-10-05");
  });

  it("is listed with the places it goes to, not the home the flight back lands in", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" });
    expect(tripCardPlaces(await listItems(id))).toEqual(["Porto", "Lizbon"]);
    // Only travel saved: the first one out names the place; the way back doesn't.
    const out = makeItem({ category: "flight", city: "Porto", dates: { start: "2026-10-08", end: null, source: "page" } });
    const back = makeItem({ category: "flight", city: "İstanbul", dates: { start: "2026-10-14", end: null, source: "page" } });
    const esim = makeItem({ category: "esim", city: "Portekiz" });
    expect(tripCardPlaces([back, out, esim])).toEqual(["Porto"]);
    expect(tripCardPlaces([esim])).toEqual([]);
  });
});

describe("a trip's card in the list", () => {
  it("shows the photo its board's hero shows, as stored; the gradient (null) without one", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" });
    const items = await listItems(id);
    expect(tripCardPhoto({ heroImage: null }, items)).toBe(items.find((i) => i.imageUrl)?.imageUrl ?? null);
    const porto = "https://images.unsplash.com/photo-porto";
    const lisbon = "https://images.unsplash.com/photo-lisbon";
    // The first place's city photo, as the hero shows it first; the trip's one picture comes after.
    expect(tripCardPhoto({ heroImage: "https://x/hero.jpg", cityImages: { lizbon: lisbon, porto } }, items)).toBe(porto);
    expect(tripCardPhoto({ heroImage: "https://x/hero.jpg", cityImages: { porto: null } }, items)).toBe("https://x/hero.jpg");
    // Madeira's photo, its places being Funchal: any city photo the trip keeps.
    const funchal = makeItem({ category: "stay", city: "Funchal" });
    expect(tripCardPhoto({ heroImage: null, cityImages: { madeira: "https://x/madeira.jpg" } }, [funchal])).toBe("https://x/madeira.jpg");
    expect(tripCardPhoto({ heroImage: null }, [funchal])).toBeNull();
  });
});
