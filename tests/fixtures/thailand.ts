// The approved drawings' trip as records (onay paketi 2026-10-21, docs/mockups/paket-ucus-konaklama): "10 Günlük Tayland Doğa
// Gezisi", 24 March – 2 April 2027, two people. Stays: Bangkok 24–27 booked, Chiang Mai 27–30 chosen, the night of the 30th
// open (the morning flight to Bangkok), Bangkok 31 March – 2 April still to find. Flights: İstanbul → Bangkok chosen with its
// page, Bangkok → Chiang Mai bought, Chiang Mai → Bangkok not looked for, Bangkok → İstanbul three options (our pick among
// them). Getting around: a scooter rented in Chiang Mai (chosen), the transfer to the airport on the last day (booked), the
// train to Ayutthaya, and the airport taxis said as ways (Yerinde).
import { EMPTY_METRICS } from "../../src/lib/items";
import type { Item, Trip } from "../../src/lib/types";
import { makeItem } from "./makeItem";

export const THAILAND_TODAY = "2026-10-21";

const eur = (amount: number | null, scope: Item["price"]["scope"] = "total"): Item["price"] => ({ amount, currency: "EUR", scope, taxesIncluded: "yes", source: "page", observedAt: 1 });
const two = { adults: 2, children: null, rooms: 1 };
const day = (d: string) => ({ start: d, end: null, source: "page" as const });

let n = 0;
const id = (p: string) => `th-${p}-${++n}`;

function flight(from: string, to: string, departure: string, arrival: string, status: Item["status"], over: Partial<Item> = {}): Item {
  return makeItem({
    id: id("f"), tripId: "th", name: `${from} → ${to}`, category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), city: null, status, guests: two, price: eur(600),
    dates: day(departure.slice(0, 10)), flight: { from, to, departure, arrival, carrier: null, flightNumber: null, stops: 0 }, ...over,
  });
}
function stay(name: string, city: string, start: string, end: string, status: Item["status"], over: Partial<Item> = {}): Item {
  return makeItem({ id: id("s"), tripId: "th", name, category: "stay", city, countryCode: "TH", needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "url" }, guests: two, price: eur(200), status, ...over });
}
function ride(name: string, kind: Item["plannedKind"], from: string, to: string, at: string, status: Item["status"], over: Partial<Item> = {}): Item {
  return makeItem({
    id: id("r"), tripId: "th", name, category: "transport", plannedKind: kind, countryCode: "TH", needKey: `transport:${from}-${to}`.toLowerCase(), city: to, status, guests: two, price: eur(40),
    dates: day(at.slice(0, 10)), flight: { from, to, departure: at, arrival: null, carrier: null, flightNumber: null, stops: 0 }, ...over,
  });
}

/** `gap`: the last stay is in Ayutthaya, so the open night of the 30th stands alone between two stays (the rail's empty night). */
export function thailand(opts: { gap?: boolean } = {}): { trip: Trip; items: Item[]; by: Record<string, Item> } {
  const last = opts.gap ? "Ayutthaya" : "Bangkok";
  const trip: Trip = {
    id: "th", title: "10 Günlük Tayland Doğa Gezisi", confirmedDates: { start: "2027-03-24", end: "2027-04-02" }, budget: { amount: 4000, currency: "EUR" }, heroImage: null, createdAt: 1, updatedAt: 1,
    travellers: { names: [], count: 2 },
    // The ways said on the airport legs, nothing to book (Yerinde): a taxi in, a taxi to Don Mueang, the metro on the 30th.
    legs: {
      "2027-03-24:arrival:bangkok": { mode: "taxi", booked: false, note: null, updatedAt: 1 },
      "2027-03-27:departure:bangkok": { mode: "taxi", booked: false, note: null, updatedAt: 1 },
      "2027-03-27:arrival:chiang-mai": { mode: "taxi", booked: false, note: null, updatedAt: 1 },
      "2027-03-30:arrival:bangkok": { mode: "metro", booked: false, note: null, updatedAt: 1 },
    },
  };
  const by: Record<string, Item> = {
    out: flight("IST", "BKK", "2027-03-23T00:35", "2027-03-23T17:05", "chosen", {
      name: "Air Arabia G9", provider: "Skyscanner", url: "https://www.skyscanner.com.tr/transport/flights/ist/bkk/270323/", price: eur(552),
      flight: { from: "IST", to: "BKK", departure: "2027-03-23T00:35", arrival: "2027-03-23T17:05", carrier: "Air Arabia", flightNumber: "G9 216", stops: 1 },
    }),
    cnx: flight("DMK", "CNX", "2027-03-27T20:20", "2027-03-27T21:35", "booked", {
      name: "Thai AirAsia FD3436", provider: "AirAsia", bookingRef: "K7T2QX", price: eur(76),
      flight: { from: "DMK", to: "CNX", departure: "2027-03-27T20:20", arrival: "2027-03-27T21:35", carrier: "Thai AirAsia", flightNumber: "FD3436", stops: 0 },
    }),
    back: flight("CNX", "BKK", "2027-03-30T08:00", "2027-03-30T09:15", "saved", { name: "Chiang Mai → Bangkok", price: eur(null), origin: "chat", flight: { from: "CNX", to: "BKK", departure: "2027-03-30", arrival: null, carrier: null, flightNumber: null, stops: 0 } }),
    tk69: flight("BKK", "IST", "2027-04-02T15:15", "2027-04-02T22:30", "saved", {
      name: "Turkish Airlines TK69", provider: "Turkish Airlines", url: "https://www.turkishairlines.com/", price: eur(652),
      flight: { from: "BKK", to: "IST", departure: "2027-04-02T15:15", arrival: "2027-04-02T22:30", carrier: "Turkish Airlines", flightNumber: "TK69", stops: 0 },
    }),
    qr: flight("BKK", "IST", "2027-04-02T02:10", "2027-04-02T13:40", "saved", {
      name: "Qatar Airways QR837", provider: "Kiwi.com", price: eur(708),
      flight: { from: "BKK", to: "IST", departure: "2027-04-02T02:10", arrival: "2027-04-02T13:40", carrier: "Qatar Airways", flightNumber: "QR837", stops: 1 },
    }),
    pc: flight("BKK", "IST", "2027-04-02T23:50", "2027-04-03T07:20", "saved", {
      name: "Pegasus PC1171", provider: "Kiwi.com", price: eur(824),
      flight: { from: "BKK", to: "IST", departure: "2027-04-02T23:50", arrival: "2027-04-03T07:20", carrier: "Pegasus", flightNumber: "PC1171", stops: 1 },
    }),
    riva: stay("Riva Surya Bangkok", "Bangkok", "2027-03-24", "2027-03-27", "booked", {
      provider: "Booking.com", url: "https://www.booking.com/hotel/th/riva-surya-bangkok.html", bookingRef: "4418.223.671", price: eur(210),
      rating: { value: 8.7, scale: 10, count: 2210, source: "page" }, location: { address: "23 Phra Arthit Rd, Bangkok", area: "Phra Arthit", approximate: false },
    }),
    rimping: stay("Rimping Village", "Chiang Mai", "2027-03-27", "2027-03-30", "chosen", {
      provider: "Booking.com", url: "https://www.booking.com/hotel/th/rimping-village.html", price: eur(192),
      rating: { value: 8.6, scale: 10, count: 1240, source: "page" }, location: { address: null, area: "Tha Phae", approximate: false },
      cancellation: { summary: "Ücretsiz iptal 20 Mar'a kadar", freeUntil: "2027-03-20", source: "page" },
    }),
    tamarind: stay("Tamarind Village", "Chiang Mai", "2027-03-27", "2027-03-30", "saved", { provider: "Agoda", price: eur(264), rating: { value: 9.1, scale: 10, count: 860, source: "page" } }),
    amari: stay("Amari Bangkok", last, "2027-03-31", "2027-04-02", "saved", { provider: "Agoda", url: "https://www.agoda.com/amari-bangkok/hotel/bangkok-th.html", price: eur(142), rating: { value: 9, scale: 10, count: 1800, source: "page" } }),
    novotel: stay("Novotel Suvarnabhumi", last, "2027-03-31", "2027-04-02", "saved", { provider: "Booking.com", url: "https://www.booking.com/hotel/th/novotel-suvarnabhumi.html", price: eur(192), rating: { value: 8.4, scale: 10, count: 5200, source: "page" } }),
    moto: makeItem({
      id: id("m"), tripId: "th", name: "Honda Click 125 · Cat Motors", category: "transport", plannedKind: "moto_rental", countryCode: "TH", needKey: "transport:chiang-mai-moto", city: "Chiang Mai",
      status: "chosen", provider: "BikesBooking", url: "https://bikesbooking.com/en/chiang-mai", guests: two, price: eur(24), dates: { start: "2027-03-28", end: "2027-03-30", source: "page" },
    }),
    transferOut: ride("Klook transfer · Amari Bangkok → BKK", "transfer", "Bangkok", "BKK", "2027-04-02T11:30", "booked", { provider: "Klook", bookingRef: "KLK-55120", price: eur(24) }),
    train: ride("Bangkok → Ayutthaya", "train", "Bangkok", "Ayutthaya", "2027-04-01", "saved", { price: eur(null), origin: "chat" }),
  };
  const items = Object.values(by).map((i) => ({ ...i, metrics: i.metrics ?? EMPTY_METRICS }));
  return { trip, items, by };
}
