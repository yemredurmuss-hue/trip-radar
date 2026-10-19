// The ticket frame's words (lib/ticketFrame.ts, v82 geçişi aşama 3b, izlenebilirlik 88–99, 108): the carrier's mark, the
// middle of the ticket (a flight's stops, a pass's days, a rental's), the ends a pass and a rental are drawn with, a
// connecting flight's stubs (D7), the side column's price, the booked words by the way of travel, the check-in page (F2),
// C15's ways, and an option row as Skyscanner's says it. Also the view model's pieces the frame reads: a ticket's ends named
// by the plan's cities, the leg an empty change of city is said on, the category the covering box is in.
import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { setLang, withLang } from "../src/lib/i18n";
import { collectionsOf, type IntentInput, type OptionVM } from "../src/lib/intents";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { isPlaceholder } from "../src/lib/startTrip";
import { carrierMark, checkinUrl, rowFace, rowWho, ticketBookedWord, ticketBookWord, ticketCodeLabel, ticketDocWord, ticketFace, ticketMid, ticketPrice, wayChoices, waySearches } from "../src/lib/ticketFrame";
import { ticketViewOf } from "../src/lib/ticketView";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, LegMode, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-18";
setLang("tr");

const japan: Trip = { id: "jp", title: "Japonya", confirmedDates: { start: "2027-04-01", end: "2027-04-08" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, travellers: { names: [], count: 2 } };
const eur = (amount: number | null): Item["price"] => ({ amount, currency: "EUR", scope: "total", taxesIncluded: "yes", source: "page", observedAt: 1 });
const two = { adults: 2, children: null, rooms: 1 };
const fly = (id: string, from: string, to: string, dep: string, arr: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    id, name: `${from}-${to}`, category: "flight", needKey: `flight:${to}`.toLowerCase(), city: to, status, dates: { start: dep.slice(0, 10), end: null, source: "page" }, guests: two, price: eur(800),
    flight: { from, to, departure: dep, arrival: arr, carrier: "Qatar Airways", flightNumber: `QR ${id.length}0`, stops: 0 }, ...over,
  });
const sleep = (id: string, city: string, start: string, end: string, status: Item["status"]) =>
  makeItem({ id, name: `Otel ${city}`, category: "stay", city, needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "url" }, guests: two, price: eur(600), status });
const ride = (id: string, name: string, kind: Item["plannedKind"], from: string, to: string, day: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    id, name, category: "transport", plannedKind: kind, needKey: `transport:${from}-${to}`.toLowerCase(), city: to, status, guests: two, price: eur(100), dates: { start: day, end: null, source: "page" },
    flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T11:00`, carrier: null, flightNumber: null, stops: 0 }, ...over,
  });
const stays = [sleep("t", "Tokyo", "2027-04-01", "2027-04-04", "booked"), sleep("h", "Hakone", "2027-04-04", "2027-04-07", "booked"), sleep("o", "Osaka", "2027-04-07", "2027-04-08", "booked")];

function board(trip: Trip, items: Item[], extra: Partial<IntentInput> = {}) {
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, hidden, today: TODAY, stageCtx });
  const all = collectionsOf({ trip, plan, sections, items, today: TODAY, ...extra });
  return { all, intents: all.flatMap((c) => c.intents) };
}
const boxOf = (items: Item[], id: string, trip = japan) => board(trip, items).intents.find((i) => i.itemIds.includes(id))!;

describe("the carrier's mark", () => {
  it("the airline's code from the flight number, a short operator as it is, else its initials; the same colour for the same name", () => {
    expect(carrierMark({ brand: { label: "Turkish Airlines", color: "#c8102e" }, name: "Turkish Airlines" }, { flight: { flightNumber: "TK 52" } as Item["flight"] })).toEqual({ color: "#c8102e", letter: "TK" });
    expect(carrierMark({ brand: { label: "JR", color: "#2a7a46" }, name: "Nozomi" })).toEqual({ color: "#2a7a46", letter: "JR" });
    expect(carrierMark({ brand: { label: "Odakyu", color: null }, name: "Hakone Free Pass" })?.letter).toBe("O");
    expect(carrierMark({ brand: { label: "Ozora Shuttle", color: null }, name: "Festival otobüsü" })?.letter).toBe("OS");
    const a = carrierMark({ brand: { label: "Pegasus", color: null }, name: "Pegasus" });
    expect(a?.color).toBe(carrierMark({ brand: { label: "pegasus", color: null }, name: "x" })?.color);
    // A way with no operator known draws the kind's picture instead (null).
    expect(carrierMark({ brand: null, name: "Ashi Gölü vapuru" })).toBeNull();
    expect(carrierMark(null)).toBeNull();
  });
});

describe("the ticket's left part (ticketFace)", () => {
  it("a train: the operator's mark, the service bold, JR · Shinkansen small; the seats go to the side column once bought, the platform stays a chip", () => {
    const train = ride("nozomi", "Shinkansen Nozomi · Tokyo → Hakone", "train", "Tokyo İst.", "Odawara", "2027-04-04", "booked", { provider: "JR", statusNote: "Vagon 8 · koltuk 4D, 4E · peron 14", bookingRef: "JR-30871" });
    const box = boxOf([...stays, train], "nozomi");
    const face = ticketFace(box)!;
    expect(face).toMatchObject({ mode: "train", mark: { letter: "JR" }, name: "Nozomi", sub: "JR · Shinkansen · 4 Nisan", note: "Vagon 8 · 4D, 4E" });
    expect(face.chips).toEqual([{ kind: "platform", text: "Peron 14" }]);
    expect(face.mid).toEqual({ top: null, bottom: "aktarmasız", tone: "ok" });
    expect(face.from).toMatchObject({ city: "Tokyo", place: "Tokyo İst.", time: "09:00" });
  });

  it("a pass: its days and area in the middle, where it starts and until when it holds at its ends", () => {
    const pass = ride("pass", "Hakone Free Pass", "train", "Odawara", "Hakone", "2027-04-04", "booked", { city: "Hakone", provider: "Odakyu", dates: { start: "2027-04-04", end: "2027-04-06", source: "page" }, price: eur(76) });
    const face = ticketFace(boxOf([...stays, pass], "pass"))!;
    expect(face.mode).toBe("pass");
    expect(face.mid).toEqual({ top: "3 gün", bottom: "tüm Hakone", tone: "ok" });
    expect(face.from).toMatchObject({ city: "Odawara", place: "4 Nis", time: null });
    expect(face.to).toMatchObject({ city: "Hakone", place: "6 Nis sonuna kadar" });
  });

  it("a rented car: where it's picked up, how many days, when it goes back (alış yeri · n gün · iade); one price for everyone", () => {
    const car = ride("car", "Araç kiralama", "car_rental", "Kyoto", "Kyoto", "2027-04-04", "chosen", { city: "Kyoto", dates: { start: "2027-04-04", end: "2027-04-07", source: "page" }, location: { address: null, area: "Kyoto İst.", approximate: false }, price: eur(240) });
    const box = boxOf([...stays, car], "car");
    const face = ticketFace(box)!;
    expect(face.mode).toBe("car");
    expect(face.from).toMatchObject({ city: "Kyoto", place: "Kyoto İst.", time: null });
    expect(face.mid).toEqual({ top: "3 gün", bottom: "kendin sür", tone: "ok" });
    expect(face.to).toMatchObject({ city: "7 Nisan", place: "iade" });
    expect(ticketPrice(box.chosen!, "car")).toEqual({ big: "€240", small: "toplam" });
    expect(ticketBookWord("car")).toBe("Rezerve et");
  });

  it("D7: a connecting flight's two stubs, one per leg, its change of plane in the middle; no chip beside them", () => {
    const items = [
      fly("ab", "IST", "DOH", "2027-04-01T01:55", "2027-04-01T06:00", "booked", { bookingRef: "QX7K2L", metrics: { ...EMPTY_METRICS, durationMinutes: 245, checkedBagIncluded: true } }),
      fly("bcd", "DOH", "HND", "2027-04-01T08:00", "2027-04-01T23:30", "booked", { bookingRef: "QX7K2L", metrics: { ...EMPTY_METRICS, durationMinutes: 570 } }),
      ...stays,
    ];
    const face = ticketFace(boxOf(items, "ab"))!;
    expect(face.stubs).toEqual([
      { itemId: "ab", text: "QR 20 · IST 01:55 → DOH 06:00" },
      { itemId: "bcd", text: "QR 30 · DOH 08:00 → HND 23:30" },
    ]);
    expect(face.mid).toEqual({ top: "15 sa 35 dk", bottom: "1 aktarma · Doha", tone: "warn" });
    expect(face.chips).toEqual([]);
    expect(face.from?.city).toBe("İstanbul");
  });

  it("nothing chosen yet: the two ends only, nothing in the middle but the drawing", () => {
    const box = board(japan, stays).intents.find((i) => i.section === "transport")!;
    const face = ticketFace(box)!;
    expect(face).toMatchObject({ mark: null, from: { city: "Tokyo", time: null }, to: { city: "Hakone" }, mid: { top: null, bottom: null }, stubs: [], chips: [] });
  });

  it("outside the ticket family there is none", () => {
    expect(ticketFace(board(japan, stays).intents.find((i) => i.section === "stay")!)).toBeNull();
  });
});

describe("the ticket's words", () => {
  it("a train's ends are named by the plan's cities, the stations under them (one leg: both ends)", () => {
    const train = ride("cp", "CP Alfa Pendular · Porto → Lizbon", "train", "Porto Campanhã", "Lisboa Santa Apolónia", "2027-04-04", "saved", { provider: "CP" });
    const t = ticketViewOf([train], { kind: "train", leg: null, route: null, ends: { from: "Porto", to: "Lizbon" }, now: new Date("2027-04-01T12:00:00Z") });
    expect(t.from).toMatchObject({ city: "Porto", place: "Porto Campanhã" });
    expect(t.to).toMatchObject({ city: "Lizbon", place: "Lisboa Santa Apolónia" });
  });

  it("booked, by the way of travel: Bilet alındı, a pass Alındı, a car Rezerve edildi; its code and its file named so", () => {
    expect([ticketBookedWord("flight"), ticketBookedWord("train"), ticketBookedWord("pass"), ticketBookedWord("car")]).toEqual(["Bilet alındı", "Bilet alındı", "Alındı", "Rezerve edildi"]);
    expect([ticketCodeLabel("flight", "PNR"), ticketCodeLabel("train", "Rezervasyon no"), ticketCodeLabel("pass", "Rezervasyon no")]).toEqual(["PNR", "Bilet", "Pass"]);
    expect(ticketDocWord("flight")).toEqual({ open: "E-bilet aç", add: "Bileti ekle" });
    expect(ticketDocWord("train").add).toBe("Bileti ekle");
    expect(ticketDocWord("pass").open).toBe("Pass'i aç");
    withLang("en", () => expect(ticketBookedWord("flight")).toBe("Ticket bought"));
  });

  it("what one pays and how many go; the total alone when the scope says no head count", () => {
    const o = { ticket: { each: "€905", total: "€1.810" }, price: null, item: makeItem({ guests: two }) } as unknown as OptionVM;
    expect(ticketPrice(o)).toEqual({ big: "€905", small: "kişi başı · 2 kişi €1.810" });
    expect(ticketPrice({ ...o, ticket: { each: null, total: "€120" } })).toEqual({ big: "€120", small: "toplam" });
    expect(ticketPrice({ ...o, ticket: null, price: { text: "€40", label: null } } as unknown as OptionVM)).toEqual({ big: "€40", small: null });
  });

  it("F2: the check-in opens the airline's own page it was saved from, else a search for the airline's check-in; never a comparison site", () => {
    const f = (over: Partial<Item>) => makeItem({ category: "flight", provider: "Turkish Airlines", flight: { from: "KIX", to: "IST", departure: null, arrival: null, carrier: "Turkish Airlines", flightNumber: "TK49", stops: 0 }, ...over });
    expect(checkinUrl(f({ url: "https://www.turkishairlines.com/tr-tr/" }))).toBe("https://www.turkishairlines.com/tr-tr/");
    expect(checkinUrl(f({ url: "https://www.skyscanner.net/transport/flights/kix/ist" }))).toBe("https://www.google.com/search?q=Turkish%20Airlines%20online%20check-in");
    expect(checkinUrl(makeItem({ category: "flight" }))).toBeNull();
  });

  it("C15: the ways in the order the intent gives them, each with its drawing", () => {
    expect(wayChoices(["train", "bus", "car", "flight"]).map((w) => [w.mode, w.art, w.label])).toEqual([
      ["train", "tren", "Tren"],
      ["bus", "otobus", "Otobüs"],
      ["car", "arac-kiralama", "Araba"],
      ["flight", "ucus", "Uçak"],
    ]);
    expect(wayChoices([])).toEqual([]);
  });

  it("a middle with nothing known says nothing", () => {
    const t = ticketViewOf([], { kind: "flight", leg: null, route: { from: "İstanbul", to: "Tokyo" }, now: new Date() });
    expect(ticketMid(t)).toEqual({ top: null, bottom: null, tone: null });
  });
});

describe("an option row (Skyscanner's)", () => {
  it("a flight: the airline and its number, the hours and the airports, the length and stops, the bag; our pick, then En hızlı and En ucuz", () => {
    const options = [
      fly("tk", "KIX", "IST", "2027-04-08T11:00", "2027-04-08T17:40", "saved", { price: eur(1810), flight: { from: "KIX", to: "IST", departure: "2027-04-08T11:00", arrival: "2027-04-08T17:40", carrier: "Turkish Airlines", flightNumber: "TK 49", stops: 0 }, metrics: { ...EMPTY_METRICS, durationMinutes: 760, checkedBagIncluded: true } }),
      fly("jl", "KIX", "IST", "2027-04-08T13:00", "2027-04-09T00:10", "saved", { price: eur(1500), flight: { from: "KIX", to: "IST", departure: "2027-04-08T13:00", arrival: "2027-04-09T00:10", carrier: "Japan Airlines", flightNumber: "JL 7051", stops: 1 }, metrics: { ...EMPTY_METRICS, durationMinutes: 970 } }),
    ];
    const home = boxOf([...stays, ...options], "tk");
    const tk = home.options.find((o) => o.id === "tk")!;
    const f = rowFace(tk, home.kind);
    expect(f).toMatchObject({ mark: { letter: "TK" }, name: "Turkish Airlines", sub: "TK 49", dep: "11:00", arr: "17:40", from: "KIX", to: "IST", duration: "12 sa 40 dk", stops: { text: "direkt", tone: "ok" }, bag: "1 bagaj dahil", price: { text: "€905" } });
    expect(f.ribs.map((r) => r.text)).toContain("En hızlı");
    const jl = rowFace(home.options.find((o) => o.id === "jl")!, home.kind);
    expect(jl).toMatchObject({ plus: 1, stops: { text: "1 aktarma", tone: "warn" }, bag: null });
  });

  it("a train: the service and its operator and class, never the day again", () => {
    const options = [
      ride("n", "Shinkansen Nozomi · Tokyo → Hakone", "train", "Tokyo İst.", "Odawara", "2027-04-04", "saved", { provider: "JR", metrics: { ...EMPTY_METRICS, durationMinutes: 35 } }),
      ride("k", "Shinkansen Kodama · Tokyo → Hakone", "train", "Tokyo İst.", "Odawara", "2027-04-04", "saved", { provider: "JR", price: eur(80), metrics: { ...EMPTY_METRICS, durationMinutes: 50 } }),
    ];
    const box = boxOf([...stays, ...options], "n");
    expect(rowFace(box.options.find((o) => o.id === "n")!, box.kind)).toMatchObject({ name: "Nozomi", sub: "JR · Shinkansen", stops: { text: "aktarmasız" } });
  });

  it("who put it there: the AI's spark, the traveller's link, a person's initial", () => {
    expect(rowWho({ kind: "ai" })).toMatchObject({ tone: "ai", text: "✨" });
    expect(rowWho({ kind: "link" })).toMatchObject({ tone: "link", title: "Senin linkin" });
    expect(rowWho({ kind: "person", name: "sabine" })).toMatchObject({ tone: "p", text: "S", title: "sabine ekledi" });
    expect(rowWho(null)).toBeNull();
  });
});

describe("what the frame says on the plan", () => {
  it("an empty change of city carries its leg (its ways and its Gerek yok are said on it)", () => {
    const box = board(japan, stays).intents.find((i) => i.section === "transport")!;
    expect(box.legKey).toEqual(expect.any(String));
    expect(box.modes).toEqual(["train", "bus", "car", "flight"]);
  });

  it("C15's searches: a change of city on the sites that compare every way; a transfer on Uber and the map's directions", () => {
    const at = { countries: ["JP"], countryNames: ["Japonya"], adults: 2 };
    const move = board(japan, stays).intents.find((i) => i.section === "transport")!;
    const compare = waySearches(move, at).map((l) => l.id);
    expect(compare.length).toBeGreaterThan(0);
    expect(compare).not.toContain("uber");
    // An airport transfer's ways have no plane across town; it is looked for where a ride is.
    const transfer = { ...move, kind: "taxi" as const, modes: ["metro", "bus", "train", "taxi", "transfer"] as LegMode[] };
    expect(wayChoices(transfer.modes).map((w) => w.label)).toEqual(["Metro", "Otobüs", "Tren", "Taksi", "Transfer"]);
    const ride = waySearches(transfer, at);
    expect(ride.map((l) => [l.id, l.name])).toEqual([["uber", "Uber"], ["maps", "Google Maps"]]);
    expect(decodeURIComponent(ride[1].url)).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=Tokyo&destination=Hakone/);
  });

  it("kişiye özel: someone's own ticket says it is for one, and is looked for for one", () => {
    const pair: Trip = { ...japan, travellers: { names: ["Sabine"], count: 2 } };
    const hers = fly("hers", "ALC", "HND", "2027-04-01T06:00", "2027-04-01T20:00", "saved", { forWho: ["Sabine"], guests: { adults: null, children: null, rooms: null } });
    const box = boxOf([...stays, hers], "hers", pair);
    expect(box.people).toBe(1);
    expect(box.head.parts).toContain("1 kişi");
    const links = waySearches(box, { countries: ["JP"], countryNames: ["Japonya"], adults: 2 });
    expect(links.find((l) => l.id === "skyscanner")?.url).toMatch(/adultsv2=1/);
    // Everyone's ticket says no count of its own.
    expect(boxOf([...stays, fly("ours", "IST", "HND", "2027-04-01T06:00", "2027-04-01T20:00", "saved")], "ours", pair).people).toBeUndefined();
  });

  it("Dahil goes to its cover's box in its category ('Pass'i aç')", () => {
    const pass = ride("pass", "Hakone Free Pass", "train", "Odawara", "Hakone", "2027-04-04", "booked", { city: "Hakone", provider: "Odakyu", dates: { start: "2027-04-04", end: "2027-04-06", source: "page" }, price: eur(76) });
    const boat = ride("boat", "Ashi Gölü vapuru", "ferry", "Togendai", "Moto-Hakone", "2027-04-05", "chosen", { city: "Hakone", price: eur(null), origin: "chat" });
    const box = boxOf([...stays, pass, boat], "boat");
    expect(box.status).toBe("included");
    expect(box.cover).toMatchObject({ open: "Pass'i aç", section: "transport", key: boxOf([...stays, pass, boat], "pass").key });
  });
});
