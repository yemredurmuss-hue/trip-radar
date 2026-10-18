// The v83 prototype's two trips as records (docs/mockups/plan-v83-turler, z83_jp.py and z83_oz.py), and the board built
// from them the way TripPanel builds it (its decisions, its stageCtx, the v82 categories and intents): Japonya 1–16 Nisan
// (Tokyo, Kyoto, Hakone, Osaka; the flight out leaves late on 1 April and lands on the 2nd) and the Ozora festival.
import { decideTrip, makeContext } from "../../src/lib/decision";
import { isEmptyRecord } from "../../src/lib/emptyCards";
import { categorize } from "../../src/lib/categories";
import { collectionsOf, type Collection, type IntentInput, type IntentVM } from "../../src/lib/intents";
import { EMPTY_METRICS } from "../../src/lib/items";
import { buildLegs, type Leg } from "../../src/lib/legs";
import { buildPlan, type Plan } from "../../src/lib/plan";
import { isPlaceholder } from "../../src/lib/startTrip";
import { buildTimeline, type Timeline } from "../../src/lib/timeline";
import type { Item, Suggestion, Trip } from "../../src/lib/types";
import { makeItem } from "./makeItem";

const eur = (amount: number | null, scope: Item["price"]["scope"] = "total"): Item["price"] => ({ amount, currency: "EUR", scope, taxesIncluded: "yes", source: "page", observedAt: 1 });
const two = { adults: 2, children: null, rooms: 1 };
const metrics = (over: Partial<NonNullable<Item["metrics"]>>) => ({ ...EMPTY_METRICS, ...over });
const day = (d: string) => ({ start: d, end: null, source: "page" as const });

let n = 0;
const id = (p: string) => `${p}-${++n}`;

export function flight(from: string, to: string, departure: string, arrival: string, status: Item["status"], over: Partial<Item> = {}): Item {
  return makeItem({
    id: id("f"), tripId: "jp", name: `${from} → ${to}`, category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), city: null, status, guests: two, price: eur(800),
    dates: day(departure.slice(0, 10)), flight: { from, to, departure, arrival, carrier: null, flightNumber: null, stops: 0 }, ...over,
  });
}
export function stay(name: string, city: string, start: string, end: string, status: Item["status"], over: Partial<Item> = {}): Item {
  return makeItem({ id: id("s"), tripId: "jp", name, category: "stay", city, needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "url" }, guests: two, price: eur(600), status, ...over });
}
export function ride(name: string, kind: Item["plannedKind"], from: string, to: string, at: string, status: Item["status"], over: Partial<Item> = {}): Item {
  return makeItem({
    id: id("r"), tripId: "jp", name, category: "transport", plannedKind: kind, needKey: `transport:${from}-${to}`.toLowerCase(), city: to, status, guests: two, price: eur(100),
    dates: day(at.slice(0, 10)), flight: { from, to, departure: at, arrival: null, carrier: null, flightNumber: null, stops: 0 }, ...over,
  });
}
/** Something to book or do on a day (its hour, as the cards keep it, in `flight.departure`), or with no day. */
export function thing(name: string, category: Item["category"], city: string, at: string | null, status: Item["status"], over: Partial<Item> = {}): Item {
  return makeItem({
    id: id("a"), tripId: "jp", name, category, needKey: `${category}:${name}`.toLowerCase(), city, status, guests: two, price: eur(null),
    dates: at ? day(at.slice(0, 10)) : { start: null, end: null, source: "none" }, flight: at && at.length > 10 ? { from: null, to: null, departure: at, arrival: null, carrier: null, flightNumber: null, stops: 0 } : null,
    ...over,
  });
}
export function chore(name: string, over: Partial<Item> = {}): Item {
  return makeItem({ id: id("p"), tripId: "jp", name, category: "other", plannedKind: "prep", needKey: `prep:${name}`.toLowerCase(), status: "chosen", ...over });
}

export const JAPAN_TODAY = "2026-10-18";

/**
 * Japonya as the prototype's "Plan ilerledi": the flight out still to pick (two options), Tokyo chosen, Kyoto three
 * ryokans (our pick among them), Hakone and the train there booked, Osaka still to find; Tokyo's and Kyoto's events and
 * places, the eSIM bought. `during`: what is booked by the 6th of April (the prototype's "Gezi sırasında" scenario).
 */
export function japan(opts: { during?: boolean } = {}): { trip: Trip; items: Item[]; by: Record<string, Item> } {
  const during = Boolean(opts.during);
  const trip: Trip = {
    id: "jp", title: "Japonya turu", confirmedDates: { start: "2027-04-01", end: "2027-04-16" }, budget: { amount: 8000, currency: "EUR" }, heroImage: null, createdAt: 1, updatedAt: 1,
    travellers: { names: [], count: 2 },
    cityImages: { tokyo: "photos/shibuya.jpg", kyoto: "photos/inari.jpg", hakone: "photos/onsen.jpg", osaka: "photos/dotonbori.jpg" },
  };
  const by: Record<string, Item> = {
    // The way in leaves İstanbul late on 1 April and lands in Tokyo on the 2nd: the first night is on the plane (D14).
    tk52: flight("IST", "HND", "2027-04-01T23:55", "2027-04-02T18:40", during ? "booked" : "saved", {
      name: "Turkish Airlines TK52", provider: "Turkish Airlines", url: "https://www.turkishairlines.com/", price: eur(1580),
      flight: { from: "IST", to: "HND", departure: "2027-04-01T23:55", arrival: "2027-04-02T18:40", carrier: "Turkish Airlines", flightNumber: "TK52", stops: 0 },
      ...(during ? { bookingRef: "TK8Q2L" } : {}),
    }),
    qr: flight("IST", "HND", "2027-04-01T20:10", "2027-04-02T20:55", "saved", {
      name: "Qatar Airways QR240", provider: "Qatar Airways", price: eur(1320),
      flight: { from: "IST", to: "HND", departure: "2027-04-01T20:10", arrival: "2027-04-02T20:55", carrier: "Qatar Airways", flightNumber: "QR240", stops: 1 },
    }),
    pickup: ride("Otelin servisi", "transfer", "HND", "Hyatt Centric Ginza", "2027-04-02T19:45", "chosen", { noBooking: 1, arranged: true, city: "Tokyo", price: eur(null) }),
    hyatt: stay("Hyatt Centric Ginza", "Tokyo", "2027-04-02", "2027-04-05", during ? "booked" : "chosen", {
      provider: "Booking.com", url: "https://www.booking.com/hotel/jp/hyatt-centric-ginza.html", price: eur(639), rating: { value: 9, scale: 10, count: 1204, source: "page" },
      location: { address: "6-6-7 Ginza, Chuo, Tokyo", area: "Ginza", approximate: false },
      ...(during ? { bookingRef: "BK-20417" } : {}),
    }),
    teamlab: thing("teamLab Planets", "activity", "Tokyo", "2027-04-03T10:00", during ? "booked" : "chosen", { provider: "Klook", price: eur(36, "per_person"), ...(during ? { bookingRef: "KL-55120" } : {}) }),
    shibuya: thing("Shibuya Sky", "activity", "Tokyo", "2027-04-04T17:20", "booked", { provider: "Klook", bookingRef: "KL-90231", price: eur(90) }),
    tsukiji: thing("Tsukiji balık pazarı turu", "activity", "Tokyo", null, "saved", { provider: "GetYourGuide", price: eur(65, "per_person"), addedBy: "ai" }),
    sumo: thing("Sumo antrenmanı", "activity", "Tokyo", null, "saved", { provider: "Viator", price: eur(80, "per_person"), addedBy: "ai" }),
    ichiran: thing("Ichiran Ramen", "food", "Tokyo", "2027-04-03", "chosen"),
    meiji: thing("Meiji Jingu", "activity", "Tokyo", null, "chosen", { plannedKind: "todo", booking: "none" }),
    nozomi: ride("JR Shinkansen Nozomi · Tokyo → Kyoto", "train", "Tokyo", "Kyoto", "2027-04-05T09:00", during ? "booked" : "saved", {
      provider: "JR", price: eur(104, "per_person"), metrics: metrics({ durationMinutes: 135 }), ...(during ? { bookingRef: "JR-30871" } : {}),
    }),
    hikari: ride("JR Shinkansen Hikari · Tokyo → Kyoto", "train", "Tokyo", "Kyoto", "2027-04-05T09:30", "saved", { provider: "JR", price: eur(95, "per_person"), metrics: metrics({ durationMinutes: 160 }) }),
    hatanaka: stay("Gion Hatanaka", "Kyoto", "2027-04-05", "2027-04-09", during ? "booked" : "saved", {
      provider: "Booking.com", url: "https://www.booking.com/hotel/jp/gion-hatanaka.html", price: eur(720), rating: { value: 9.3, scale: 10, count: 512, source: "page" },
      location: { address: null, area: "Gion", approximate: false }, summary: "ryokan, kahvaltı dahil", host: { name: "Gion Hatanaka", url: "mailto:info@hatanaka.example" },
      ...(during ? { bookingRef: "GH-5531" } : {}),
    }),
    motonago: stay("Ryokan Motonago", "Kyoto", "2027-04-05", "2027-04-09", "saved", { provider: "Booking.com", price: eur(800), rating: { value: 9.1, scale: 10, count: 300, source: "page" } }),
    celestine: stay("Hotel The Celestine", "Kyoto", "2027-04-05", "2027-04-09", "saved", { provider: "Booking.com", price: eur(650), rating: { value: 8.8, scale: 10, count: 900, source: "page" } }),
    inari: thing("Fushimi Inari gün doğumu", "activity", "Kyoto", "2027-04-06T06:00", "booked", { provider: "Viator", bookingRef: "VI-77310", price: eur(76) }),
    kiyomizu: thing("Kiyomizu-dera gece ışıkları", "activity", "Kyoto", null, "saved", { provider: "Klook", price: eur(12, "per_person"), addedBy: "ai" }),
    nishiki: thing("Nishiki pazarı", "activity", "Kyoto", "2027-04-06T12:30", "chosen", { plannedKind: "todo", booking: "none", summary: "öğle yemeği", location: { address: "Nishiki Market, Kyoto", area: "Nakagyo", approximate: false } }),
    karyo: thing("Gion Karyo", "food", "Kyoto", "2027-04-06T19:30", "booked", { provider: "TableCheck", bookingRef: "TC-4471", booking: "needed" }),
    romancecar: ride("Odakyu Romancecar · Kyoto → Hakone", "train", "Kyoto", "Hakone", "2027-04-09T08:30", "booked", { provider: "Odakyu", bookingRef: "OD-7721", price: eur(120) }),
    goraKadan: stay("Gora Kadan", "Hakone", "2027-04-09", "2027-04-12", "booked", { provider: "Booking.com", bookingRef: "GK-48213", price: eur(900), location: { address: "Gora 1300, Hakone", area: "Gora", approximate: false } }),
    osakaTrain: ride("JR Shinkansen Hikari · Odawara → Osaka", "train", "Hakone", "Osaka", "2027-04-12T09:00", during ? "booked" : "chosen", { provider: "JR", price: eur(98, "per_person"), ...(during ? { bookingRef: "JR-55120" } : {}) }),
    // By the 6th of April Osaka has its hotel too (the prototype's flight-day scenario checks out of it).
    ...(during ? { cross: stay("Cross Hotel Osaka", "Osaka", "2027-04-12", "2027-04-16", "booked", { provider: "Booking.com", bookingRef: "CR-1180", price: eur(512), location: { address: "2-5-15 Shinsaibashi-suji, Osaka", area: "Namba", approximate: false } }) } : {}),
    tk49: flight("KIX", "IST", "2027-04-16T11:00", "2027-04-16T17:40", "booked", {
      name: "Turkish Airlines TK49", provider: "Turkish Airlines", bookingRef: "K7T2QX", price: eur(1580),
      flight: { from: "KIX", to: "IST", departure: "2027-04-16T11:00", arrival: "2027-04-16T17:40", carrier: "Turkish Airlines", flightNumber: "TK49", stops: 0 },
    }),
    airalo: makeItem({ id: id("e"), tripId: "jp", name: "Airalo Japonya 10 GB", category: "esim", needKey: "esim:jp", country: "Japonya", countryCode: "JP", status: "booked", provider: "Airalo", bookingRef: "AIR-5520", price: eur(9) }),
    vjw: chore("Visit Japan Web'e kaydol", { doneAt: 1 }),
    yen: chore("Yen bozdur", { dates: day("2027-03-31") }),
    jrpass: chore("Japan Rail Pass al", { dates: day("2027-04-05") }),
  };
  const items = Object.values(by).map((i) => (i.countryCode || i.category === "flight" ? i : { ...i, countryCode: "JP" }));
  return { trip, items, by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, items.find((i) => i.id === v.id)!])) };
}

/** The rule's insurance suggestion, as the board gets it while nothing on the plan is a policy (C16). */
export const INSURANCE: Suggestion = {
  key: "rule:insurance", section: "other", kind: "add", title: "Seyahat sağlık sigortası", why: "Yurt dışına çıkıyorsun; planda seyahat sağlık sigortası yok.", source: "rule", template: "insurance", createdAt: 1, state: "open",
};

export const OZORA_TODAY = "2026-10-18";

/** The Ozora festival: a night in Budapest, the festival's camp covered by the ticket, the festival bus there and back. */
export function ozora(): { trip: Trip; items: Item[]; by: Record<string, Item> } {
  const trip: Trip = {
    id: "oz", title: "Ozora festivali", confirmedDates: { start: "2027-07-26", end: "2027-08-02" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
    travellers: { names: [], count: 2 }, intent: { playbook: "festival" },
  };
  const own = (i: Item): Item => ({ ...i, tripId: "oz", countryCode: i.category === "flight" ? null : "HU" });
  const by: Record<string, Item> = {
    pc: own(flight("IST", "BUD", "2027-07-26T07:10", "2027-07-26T08:05", "saved", { name: "Pegasus PC1171", provider: "Pegasus", price: eur(190) })),
    tk: own(flight("IST", "BUD", "2027-07-26T09:40", "2027-07-26T10:35", "saved", { name: "Turkish Airlines TK1035", provider: "Turkish Airlines", price: eur(260) })),
    back: own(flight("BUD", "IST", "2027-08-02T18:30", "2027-08-02T21:20", "saved", { name: "Turkish Airlines TK1038", provider: "Turkish Airlines", price: eur(240) })),
    budStay: own(stay("Hotel Moments", "Budapeşte", "2027-07-26", "2027-07-27", "saved", { provider: "Booking.com", price: eur(140) })),
    budStay2: own(stay("Hotel Clark", "Budapeşte", "2027-07-26", "2027-07-27", "saved", { provider: "Booking.com", price: eur(170) })),
    camp: own(stay("Çadır kampı", "Ozora", "2027-07-27", "2027-08-02", "chosen", { noBooking: 1, metrics: metrics({ stayKind: "camp" }), price: eur(null) })),
    ticket: own(thing("Ozora Festival bileti", "activity", "Ozora", "2027-07-27T12:00", "booked", { provider: "Ozora", bookingRef: "OZ-26-81442", price: eur(490) })),
    busThere: own(ride("Festival otobüsü · Budapeşte → Ozora", "bus", "Budapeşte", "Ozora", "2027-07-27T09:00", "saved", { provider: "Ozora Shuttle", price: eur(35, "per_person") })),
    busBack: own(ride("Festival otobüsü · dönüş", "bus", "Ozora", "Budapeşte", "2027-08-02T12:00", "saved", { provider: "Ozora Shuttle", price: eur(35, "per_person"), addedBy: "ai" })),
    visa: own(chore("Vize randevusu al", { dates: day("2027-07-11") })),
    forint: own(chore("Forint bozdur", { dates: day("2027-07-25") })),
  };
  const items = Object.values(by);
  return { trip, items, by };
}

export interface Board {
  trip: Trip;
  items: Item[];
  plan: Plan;
  legs: Leg[];
  timeline: Timeline;
  input: IntentInput;
  collections: Collection[];
  intents: IntentVM[];
}

/** The board as TripPanel builds it: its decisions, its stageCtx, the categories and the v82 intents on them. */
export function boardOf(trip: Trip, items: Item[], today: string, extra: Partial<IntentInput> = {}): Board {
  const ctx = makeContext(trip, items, { today });
  const decisions = decideTrip(items, ctx);
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, hidden, today, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today, decisions, ctx, ...extra };
  const collections = collectionsOf(input);
  return { trip, items, plan, legs, timeline, input, collections, intents: collections.flatMap((c) => c.intents) };
}
