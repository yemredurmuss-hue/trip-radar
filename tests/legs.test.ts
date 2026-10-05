// Transfers derived from the plan: in from the airport, between cities (with station transfers when
// by plane or train), hotel changes, and out; filled from saved items, the traveller's own plan and
// the house rules read on the stays' pages.
import { describe, expect, it } from "vitest";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs, legTiming } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { plannedItem } from "../src/lib/planned";
import type { HouseRules, Item, ItemStatus, LegChoice, Listing, Trip } from "../src/lib/types";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t", title: "Porto ve Lizbon", confirmedDates: { start: "2026-10-07", end: "2026-10-14" }, budget: null, heroImage: null,
  createdAt: 1, updatedAt: 1, ...over,
});

let seq = 0;
function item(name: string, over: Partial<Item> = {}): Item {
  return {
    id: `l${++seq}`, tripId: "t", captureIds: [], key: `test:${name}`, category: "stay", needKey: "stay:porto", name, provider: null,
    summary: "", optionDetail: null, url: null, imageUrl: null, city: "Porto", country: "Portekiz", countryCode: "PT",
    location: { address: null, area: null, approximate: false },
    dates: { start: null, end: null, source: "url" }, guests: { adults: 2, children: null, rooms: 1 },
    price: { amount: 200, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 },
    priceHistory: [], cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" }, flight: null, metrics: EMPTY_METRICS, geo: null,
    highlights: [], concerns: [], reviewSummary: null, missing: [], status: "saved", statusNote: null, createdAt: 1, updatedAt: 1,
    ...over,
  };
}
const stay = (name: string, start: string, end: string, status: ItemStatus = "saved", city = "Porto") =>
  item(name, { dates: { start, end, source: "url" }, status, city, needKey: `stay:${city.toLowerCase()}` });
const flight = (name: string, from: string, to: string, dep: string, arr: string, status: ItemStatus = "saved") =>
  item(name, {
    category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), key: null,
    dates: { start: dep.slice(0, 10), end: null, source: "page" },
    flight: { from, to, departure: dep, arrival: arr, carrier: null, flightNumber: null, stops: 0 },
    status,
  });
const transport = (name: string, day: string, city: string, status: ItemStatus = "saved") =>
  item(name, { category: "transport", needKey: `transport:${city.toLowerCase()}`, city, dates: { start: day, end: null, source: "page" }, status });

const legsOf = (items: Item[], over: Partial<Trip> = {}, listings = new Map<string, Listing>()) => {
  const t = trip(over);
  return buildLegs(buildPlan(t, items), t, listings);
};
const brief = (legs: ReturnType<typeof legsOf>) => legs.map((l) => `${l.date} ${l.kind}: ${l.from.label} → ${l.to.label} [${l.statusText}]`);

const listingWith = (key: string, house: Partial<HouseRules>): Listing => ({
  key, name: key, reviews: [], reviewTotal: null, findings: [], readCaptureIds: [], readAt: 1, dropped: 0, error: null, errorAt: null, updatedAt: 1,
  house: { checkInFrom: null, checkInUntil: null, checkOutUntil: null, selfCheckIn: null, luggageStorage: null, airportShuttle: null, quotes: ["x"], ...house },
});

describe("legs: every transfer the plan needs", () => {
  it("puts a taxi said in the chat on that day's transfer, as a taxi", () => {
    const taxi = plannedItem({ kind: "taxi", date: "2026-10-14", end_date: null, time: null, from: "Otel", to: "Havalimanı", city: null, title: null, booked: false, note: null }, "t", "taxi", 1);
    const legs = legsOf([stay("Jardim Stay", "2026-10-07", "2026-10-14", "booked"), taxi]);
    const out = legs.find((l) => l.kind === "departure")!;
    expect(out.options.map((i) => i.id)).toEqual(["taxi"]);
    expect(out.mode).toBe("taxi");
    expect(legs.filter((l) => l.kind !== "departure").every((l) => !l.options.length)).toBe(true);
  });

  it("opens the airport transfer, the move between cities (with both station transfers) and the way out", () => {
    const legs = legsOf([
      flight("Pegasus", "IST", "OPO", "2026-10-07T07:10", "2026-10-07T10:05", "booked"),
      stay("Jardim Stay", "2026-10-07", "2026-10-10", "booked"),
      stay("Lisboa Loft", "2026-10-10", "2026-10-14", "chosen", "Lizbon"),
      flight("TAP", "LIS", "IST", "2026-10-14T19:40", "2026-10-15T01:10", "booked"),
      flight("TAP OPO-LIS", "OPO", "LIS", "2026-10-10T13:00", "2026-10-10T14:00"),
      flight("Ryanair OPO-LIS", "OPO", "LIS", "2026-10-10T08:00", "2026-10-10T09:00"),
    ]);
    expect(brief(legs)).toEqual([
      "2026-10-07 arrival: OPO havalimanı → Jardim Stay [Boş]",
      "2026-10-10 departure: Jardim Stay → OPO havalimanı [Boş]",
      "2026-10-10 move: Jardim Stay → Lisboa Loft [2 seçenek]",
      "2026-10-10 arrival: LIS havalimanı → Lisboa Loft [Boş]",
      "2026-10-14 departure: Lisboa Loft → LIS havalimanı [Boş]",
    ]);
    expect(legs.map((l) => l.slot)).toEqual([0, 1, 1, 1, 2]);
    expect(legTiming(legs[0])).toBe("Varış 10:05");
    expect(legTiming(legs[4])).toBe("En geç 16:40 havalimanında");
    expect(legs[0].key).toBe("2026-10-07:arrival:porto");
    expect(legs[2].key).toBe("2026-10-10:move:porto>lizbon");
  });

  it("marks what the traveller said: metro is planned, a transfer they arranged is done", () => {
    const items = [
      stay("Jardim Stay", "2026-10-07", "2026-10-10", "booked"),
      stay("Lisboa Loft", "2026-10-10", "2026-10-14", "booked", "Lizbon"),
    ];
    const legs: Record<string, LegChoice> = {
      "2026-10-07:arrival:porto": { mode: "metro", booked: false, note: null, updatedAt: 1 },
      "2026-10-10:move:porto>lizbon": { mode: "train", booked: false, note: null, updatedAt: 1 },
      "2026-10-10:arrival:lizbon": { mode: "transfer", booked: true, note: "Otel servisi", updatedAt: 1 },
    };
    expect(brief(legsOf(items, { legs }))).toEqual([
      "2026-10-07 arrival: Varış → Jardim Stay [Metro · planlandı]",
      "2026-10-10 departure: Jardim Stay → Porto gar [Boş]",
      "2026-10-10 move: Jardim Stay → Lisboa Loft [Tren · rezerve edilmedi]",
      "2026-10-10 arrival: Lizbon gar → Lisboa Loft [Transfer · ayarlandı ✓]",
      "2026-10-14 departure: Lisboa Loft → Dönüş [Boş]",
    ]);
    // By car there's no station at either end.
    const byCar = legsOf(items, { legs: { "2026-10-10:move:porto>lizbon": { mode: "car", booked: false, note: null, updatedAt: 1 } } });
    expect(byCar.map((l) => l.kind)).toEqual(["arrival", "move", "departure"]);
  });

  it("uses saved transport: a booked airport transfer settles the arrival, a train settles the move", () => {
    const legs = legsOf([
      flight("Pegasus", "IST", "OPO", "2026-10-07T07:10", "2026-10-07T10:05", "booked"),
      transport("Welcome Pickups havalimanı transferi", "2026-10-07", "Porto", "booked"),
      stay("Jardim Stay", "2026-10-07", "2026-10-10", "booked"),
      stay("Lisboa Loft", "2026-10-10", "2026-10-14", "booked", "Lizbon"),
      transport("CP Alfa Pendular Porto – Lisboa", "2026-10-10", "Porto", "booked"),
    ]);
    const [arrival, , move] = legs;
    expect(arrival.statusText).toBe("Rezerve ✓");
    expect(arrival.mode).toBe("transfer");
    expect(move.statusText).toBe("Rezerve ✓");
    expect(move.mode).toBe("train");
    expect(brief(legs).map((l) => l.split(" [")[0])).toEqual([
      "2026-10-07 arrival: OPO havalimanı → Jardim Stay",
      "2026-10-10 departure: Jardim Stay → Porto gar",
      "2026-10-10 move: Jardim Stay → Lisboa Loft",
      "2026-10-10 arrival: Lizbon gar → Lisboa Loft",
      "2026-10-14 departure: Lisboa Loft → Dönüş",
    ]);
  });

  it("opens a hotel change within a city, and none while the next nights are still open", () => {
    const change = legsOf([stay("Jardim Stay", "2026-10-07", "2026-10-10", "booked"), stay("Ribeira Rooms", "2026-10-10", "2026-10-14", "chosen")]);
    expect(change[1].kind).toBe("change");
    expect(change[1].key).toBe("2026-10-10:change:porto");
    expect(change[1].notes[0]).toMatch(/Çıkış 11:00 \(genelde\), yeni yerde giriş 15:00 \(genelde\)/);
    const open = legsOf([stay("Jardim Stay", "2026-10-07", "2026-10-10", "booked"), stay("Ribeira Rooms", "2026-10-10", "2026-10-14")]);
    expect(open.map((l) => l.kind)).toEqual(["arrival", "departure"]);
  });

  it("notes the small things: early landing, late arrival, an early flight, hours to fill after check-out", () => {
    const jardim = stay("Jardim Stay", "2026-10-07", "2026-10-14", "booked");
    const early = legsOf([flight("Pegasus", "IST", "OPO", "2026-10-07T07:10", "2026-10-07T10:05", "booked"), jardim, flight("TAP", "OPO", "IST", "2026-10-14T06:30", "2026-10-14T11:00", "booked")]);
    expect(early[0].notes).toEqual(["Varış 10:05, giriş en erken 15:00 (genelde): bavulları erken bırakmayı ya da erken girişi sor."]);
    expect(early[1].notes).toEqual([
      "Gidiş 06:30: 03:30 civarı havalimanında olmalısın; bu saatte metro ve otobüs çalışmıyor olabilir, taksi ya da transferi önceden ayarla.",
    ]);

    // Read on the page: check-in until 22:00, luggage storage.
    const house = new Map([["test:Jardim Stay", listingWith("test:Jardim Stay", { checkInFrom: "14:00", checkInUntil: "22:00", checkOutUntil: "10:00", luggageStorage: true })]]);
    const late = legsOf([flight("Pegasus", "IST", "OPO", "2026-10-07T20:10", "2026-10-07T23:05", "booked"), jardim, flight("TAP", "OPO", "IST", "2026-10-14T20:30", "2026-10-15T01:00", "booked")], {}, house);
    expect(late[0].notes).toEqual(["Giriş en geç 22:00 (sayfada yazıyor), varış 23:05: geç girişi önceden ayarla."]);
    expect(late[1].notes).toEqual(["Çıkış 10:00 (sayfada yazıyor), gidiş 20:30: arada ~7 saat boşluk; bavul emaneti var (sayfada yazıyor)."]);

    // Self check-in makes a late arrival fine.
    const self = new Map([["test:Jardim Stay", listingWith("test:Jardim Stay", { selfCheckIn: true })]]);
    expect(legsOf([flight("Pegasus", "IST", "OPO", "2026-10-07T20:10", "2026-10-07T23:05", "booked"), jardim], {}, self)[0].notes).toEqual([
      "Geç varış (23:05) sorun değil: kendi kendine giriş var (sayfada yazıyor).",
    ]);
  });

  it("catches nights that don't line up with the flights", () => {
    // Lands at 01:30 on the 7th, first night is the 7th: nowhere to sleep until check-in.
    const night = legsOf([flight("Night", "IST", "OPO", "2026-10-06T22:30", "2026-10-07T01:30", "booked"), stay("Jardim Stay", "2026-10-07", "2026-10-14", "booked")]);
    expect(night[0].notes[0]).toBe("Varış gece 01:30; ilk gece 7 Ekim. Varışla giriş arasında yerin yok: 6 Ekim gecesini de ekle ya da gece girişini sor.");
    // Lands a day after the first night: that night is paid for nothing.
    const late = legsOf([flight("Late", "IST", "OPO", "2026-10-08T09:00", "2026-10-08T12:00", "booked"), stay("Jardim Stay", "2026-10-07", "2026-10-14", "booked")]);
    expect(late[0].date).toBe("2026-10-08");
    expect(late[0].notes[0]).toBe("İlk gece 7 Ekim ama varış 8 Ekim: 7 Ekim gecesi boşa ödeniyor.");
    expect(late[0].notes).toHaveLength(1); // the room is already theirs: check-in times don't matter
    // Lands the day before the first night: nowhere to stay that night.
    const early = legsOf([flight("Early", "IST", "OPO", "2026-10-06T09:00", "2026-10-06T12:00", "booked"), stay("Jardim Stay", "2026-10-07", "2026-10-14", "booked")]);
    expect(early[0].notes).toEqual(["Varış 6 Ekim ama ilk gece 7 Ekim: 6 Ekim gecesi için yer yok."]);
    // Flies home the day after check-out: a night without a bed.
    const after = legsOf([stay("Jardim Stay", "2026-10-07", "2026-10-14", "booked"), flight("TAP", "OPO", "IST", "2026-10-15T12:00", "2026-10-15T17:00", "booked")]);
    expect(after.at(-1)!.notes[0]).toBe("Çıkış 14 Ekim ama gidiş 15 Ekim: 14 Ekim gecesi için yer yok.");
  });

  it("has no legs without nights", () => {
    expect(legsOf([], { confirmedDates: null })).toEqual([]);
  });

  it("dates the transfers by the flights' day even before one is chosen", () => {
    const legs = legsOf([
      stay("Jardim Stay", "2026-10-07", "2026-10-14", "booked"),
      flight("A", "OPO", "IST", "2026-10-13T18:00", "2026-10-13T23:00"),
      flight("B", "OPO", "IST", "2026-10-13T20:00", "2026-10-14T01:00"),
    ]);
    expect(legs.at(-1)!.date).toBe("2026-10-13");
  });
});

