// What the ticket frame draws in its parts (plan v82 "niyet kutusu standardı" bilet ailesi; v83 "Diğer türler" and "Uçuş
// günü"; v82 geçişi aşama 3b): the words read off an intent's ticket view (ticketView.ts) and its options (intents.ts). The
// carrier's mark (its colour and two letters), the middle's two words (the length and the stops, a pass's days and area,
// a rental's days), a connecting flight's stubs (D7), the side column's price and its small note, the booked frame's words
// by the way of travel ("Bilet alındı", "PNR", "E-bilet aç"), the check-in page from 48 hours before (F2), an option row's
// carrier, hours and bag (Skyscanner's row), and the ways a change of city nobody planned can go (C15). Nothing is guessed
// (C19): a part with nothing known is null and isn't drawn. Pure; the frame (app/plan/v82/FrameTicket) only draws it.
import { airlineCode, airlineColor } from "./airlines";
import { regionTownOf } from "./destinations";
import type { CardKind } from "./cardKinds";
import { L } from "./i18n";
import { lowerFirst, nDays } from "./i18nText";
import { shortDay } from "./ideas";
import { selfSearches, type SelfSearch, type SelfSearchAt } from "./intentFrame";
import type { IntentVM, OptionSource, OptionVM } from "./intents";
import { pickProviders } from "./providers";
import { BRANDS, transferLinks } from "./searchLinks";
import { formatDateRange, isoDate } from "./items";
import { bagChip, type TicketCarrier, type TicketChip, type TicketEnd, type TicketMode, type TicketVM } from "./ticketView";
import { isHiddenLeg, type Leg } from "./legs";
import type { Item, LegMode, Trip } from "./types";

/** A carrier's mark as the frame draws it: its colour and one or two letters; an airline known by its code, its logo too. */
export interface CarrierMark {
  color: string;
  letter: string;
  /** The airline's IATA code (airlines.ts), when its flight number or its name says it: its logo is drawn, the letters if it won't load. */
  code?: string;
}

/** The colours a carrier with none of its own gets, always the same one for the same name. */
const PALETTE = ["#5b45e0", "#c8102e", "#0b7a3b", "#1e5aa8", "#b23c00", "#0e8fb0", "#7a4bb3", "#475467"];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * The carrier's mark: the brand's colour (else one picked by its name) and its letters: the airline's code in the flight
 * number ("TK 52" → "TK") or by its name ("Turkish Airlines" → "TK", red), a short operator's name as it is ("JR", "CP"),
 * else its initials ("Odakyu" → "O"). A way with no operator known has none (the frame draws the kind's picture instead).
 */
export function carrierMark(carrier: Pick<TicketCarrier, "brand" | "name"> | null, item: Pick<Item, "flight"> | null = null): CarrierMark | null {
  const label = (carrier?.brand?.label ?? carrier?.name ?? "").trim();
  const code = airlineCode(carrier ? label || carrier.name : null, item?.flight?.flightNumber);
  if (!carrier || (!carrier.brand && !code)) return null;
  const words = label.split(/[\s·+/-]+/).filter(Boolean);
  const letters = code ?? (label.length <= 3 ? label : words.length > 1 && words[1].length > 2 ? `${words[0][0]}${words[1][0]}` : [...label][0] ?? "");
  const color = airlineColor(code) ?? carrier.brand?.color ?? PALETTE[hash(label.toLocaleLowerCase("tr")) % PALETTE.length];
  return { color, letter: letters.toLocaleUpperCase("tr"), ...(code ? { code } : {}) };
}

/** The middle of the ticket: what's above the drawing, what's under it (its tone: no change green, a change amber). */
export interface TicketMid {
  top: string | null;
  bottom: string | null;
  tone: "ok" | "warn" | null;
}

/** "Direkt" on a flight, "aktarmasız" on anything else; a change as it's counted ("1 aktarma"). */
function stopsWord(stops: TicketVM["stops"], mode: TicketMode): { text: string; tone: "ok" | "warn" } | null {
  if (!stops) return null;
  if (stops.direct) return { text: mode === "flight" ? L("direkt", "direct") : L("aktarmasız", "no change"), tone: "ok" };
  return { text: lowerFirst(stops.text), tone: "warn" };
}

export function ticketMid(t: TicketVM): TicketMid {
  if (t.pass) return { top: t.pass.days ? nDays(t.pass.days) : null, bottom: t.pass.area ? L(`tüm ${t.pass.area}`, `all of ${t.pass.area}`) : null, tone: "ok" };
  if (t.rental) return { top: t.rental.days ? nDays(t.rental.days) : null, bottom: L("kendin sür", "self-drive"), tone: "ok" };
  const stops = stopsWord(t.stops, t.mode);
  // A connection says where it changes ("1 aktarma · Doha").
  const at = t.legs.length > 1 ? (t.legs[0].to?.city ?? null) : null;
  return { top: t.duration, bottom: stops ? [stops.text, at].filter(Boolean).join(" · ") : null, tone: stops?.tone ?? null };
}

/** The ends a rental is drawn with: where it's picked up and on which day, how long, when it goes back. */
function rentalEnds(t: TicketVM): { from: TicketEnd | null; to: TicketEnd | null } {
  const r = t.rental!;
  // The day it's picked up is the carrier line's; the end says where.
  const from: TicketEnd | null = t.from ? { city: t.from.city, place: r.pick && r.pick !== t.from.city ? r.pick : null, time: null, plus: null } : null;
  const to: TicketEnd | null = r.back ? { city: r.back, place: L("iade", "return"), time: null, plus: null } : null;
  return { from, to };
}

/**
 * A pass's ends: its own (where it starts, on which day; the area it holds in, until when), not the change of city it
 * sits in (Hakone Free Pass is Odawara → Hakone on a Tokyo → Hakone day).
 */
function passEnds(t: TicketVM, item: Item | null, start: string | null, end: string | null): { from: TicketEnd | null; to: TicketEnd | null } {
  const begins = item?.flight?.from?.trim() || t.from?.city || null;
  const holds = t.pass?.area ?? t.to?.city ?? null;
  const from: TicketEnd | null = begins ? { city: begins, place: start ? shortDay(start) : null, time: null, plus: null } : null;
  const to: TicketEnd | null = holds ? { city: holds, place: end ? L(`${shortDay(end)} sonuna kadar`, `until the end of ${shortDay(end)}`) : null, time: null, plus: null } : null;
  return { from, to };
}

/** One stub of a connecting ticket in a line: its number, where and when it leaves and lands ("QR3 · IST 01:55 → DOH 06:00"). */
export interface TicketStub {
  itemId: string;
  text: string;
}

/** Everything the ticket's left part draws, in words. */
export interface TicketFace {
  mode: TicketMode;
  /** The carrier's mark; null: the kind's picture (a way with no operator known). */
  mark: CarrierMark | null;
  /** The carrier line's bold part and its small one ("Turkish Airlines" · "TK49 · 16 Nisan"). */
  name: string;
  sub: string | null;
  from: TicketEnd | null;
  to: TicketEnd | null;
  mid: TicketMid;
  /** The line under the route (the bag, the platform, what a pass covers, where it leaves from). */
  chips: TicketChip[];
  /** D7: a connecting flight's legs, one stub each (none for one leg). */
  stubs: TicketStub[];
  /** The side column's small line once it's bought: the seats. */
  note: string | null;
}

const NUMBER = /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/;

/**
 * The ticket's left part for an intent (its `ticket`), or null outside the ticket family. With nothing chosen the carrier
 * line is the intent's own word and day; the seats a booked one has go to the side column's note, the rest stay chips.
 */
export function ticketFace(vm: Pick<IntentVM, "ticket" | "head" | "kind" | "status" | "chosen">, item: Item | null = vm.chosen?.item ?? null): TicketFace | null {
  const t = vm.ticket;
  if (!t) return null;
  const booked = vm.status === "booked";
  const day = vm.head.date ? shortDay(vm.head.date) : null;
  const carrier = t.carrier;
  const start = item ? isoDate(item.dates.start) : null;
  const end = item ? isoDate(item.dates.end) : null;
  const ends = t.rental ? rentalEnds(t) : t.pass ? passEnds(t, item, start, end) : { from: t.from, to: t.to };
  const seat = booked ? (t.chips.find((c) => c.kind === "seat") ?? null) : null;
  const stubs: TicketStub[] =
    t.legs.length > 1
      ? t.legs.map((l) => {
          const number = l.carrier?.sub?.split(" · ")[0] ?? null;
          const at = (e: TicketEnd | null) => (e ? [e.place ?? e.city, e.time].filter(Boolean).join(" ") : null);
          return { itemId: l.itemId, text: [number && NUMBER.test(number) ? number : null, [at(l.from), at(l.to)].filter(Boolean).join(" → ")].filter(Boolean).join(" · ") };
        })
      : [];
  return {
    mode: t.mode,
    mark: carrierMark(carrier, item),
    name: carrier?.name ?? vm.chosen?.title ?? vm.head.kindWord ?? vm.head.name,
    sub: carrier ? carrier.sub : day,
    from: ends.from,
    to: ends.to,
    mid: ticketMid(t),
    // A connection's line holds its two stubs; what each leg carries is in its details.
    chips: stubs.length ? [] : t.chips.filter((c) => c !== seat),
    stubs,
    note: seat?.text ?? null,
  };
}

/**
 * The ends of a record still being filled in (a bus just added, its from typed, its to not yet): its own words and hour,
 * so what was typed stays where it was typed (C2). Null ends where it says nothing.
 */
export function ownEnds(item: Pick<Item, "flight"> | null): { from: TicketEnd | null; to: TicketEnd | null } {
  const f = item?.flight;
  const end = (place: string | null | undefined, at: string | null | undefined): TicketEnd | null =>
    place?.trim() ? { city: place.trim(), place: null, time: at?.match(/T(\d{2}:\d{2})/)?.[1] ?? null, plus: null } : null;
  return { from: end(f?.from, f?.departure), to: end(f?.to, null) };
}

/**
 * The side column's price for a ticket: what one pays, large, and how many go with the whole sum ("kişi başı · 2 kişi
 * €1.810"); a rented car is one price for everyone.
 */
export function ticketPrice(o: Pick<OptionVM, "ticket" | "price" | "item">, mode: TicketMode | null = null): { big: string; small: string | null } | null {
  const t = o.ticket;
  const n = o.item.guests.adults;
  if (t && mode === "car") return { big: t.total, small: L("toplam", "in all") };
  if (t?.each) return { big: t.each, small: n && n > 1 ? L(`kişi başı · ${n} kişi ${t.total}`, `per person · ${n} people ${t.total}`) : L(`kişi başı · toplam ${t.total}`, `per person · ${t.total} in all`) };
  if (t) return { big: t.total, small: L("toplam", "in all") };
  return o.price ? { big: o.price.text, small: o.price.label } : null;
}

/** A chosen one's main button: a car is booked, anything else's ticket bought (intentFrame.bookWord). */
export const ticketBookWord = (mode: TicketMode): string => (mode === "car" ? L("Rezerve et", "Book") : L("Bileti al", "Get the ticket"));

/** The booked frame's first line by the way of travel: a ticket is bought, a pass is had, a car is booked. */
export function ticketBookedWord(mode: TicketMode): string {
  if (mode === "pass") return L("Alındı", "Bought");
  if (mode === "car") return L("Rezerve edildi", "Booked");
  return L("Bilet alındı", "Ticket bought");
}

/** The booking's code label as a ticket says it: a flight's PNR, a ticket's, a pass's; a car's booking. */
export function ticketCodeLabel(mode: TicketMode, label: string): string {
  if (mode === "flight") return label;
  if (mode === "pass") return "Pass";
  if (mode === "car") return L("Rezervasyon", "Booking");
  return L("Bilet", "Ticket");
}

/** What a ticket's file is called, to open and to add: a flight's e-ticket, a pass, a car's booking, anything else a ticket. */
export function ticketDocWord(mode: TicketMode): { open: string; add: string } {
  switch (mode) {
    case "flight":
      return { open: L("E-bilet aç", "Open the e-ticket"), add: L("Bileti ekle", "Add the ticket") };
    case "pass":
      return { open: L("Pass'i aç", "Open the pass"), add: L("Pass'i ekle", "Add the pass") };
    case "car":
      return { open: L("Onayı aç", "Open the confirmation"), add: L("Onayı ekle", "Add the confirmation") };
    default:
      return { open: L("Bileti aç", "Open the ticket"), add: L("Bileti ekle", "Add the ticket") };
  }
}

/** A comparison site's page is no airline's: its check-in isn't there. */
const META_SEARCH = /skyscanner|google\.[a-z.]+\/(travel|flights)|kayak\.|momondo|kiwi\.com|expedia|trip\.com|enuygun|ucuzabilet/i;

/**
 * F2: the page a booked flight's "Online check-in" opens: the airline's own page it was saved from, else a search for the
 * airline's check-in (no table of airlines' pages is kept: nothing is guessed). Null for no airline known.
 */
export function checkinUrl(item: Pick<Item, "url" | "provider" | "flight">): string | null {
  const url = item.url?.trim() ?? "";
  if (/^https?:\/\//i.test(url) && !META_SEARCH.test(url)) return url;
  const airline = item.flight?.carrier?.trim() || item.provider?.trim() || null;
  if (!airline) return null;
  return `https://www.google.com/search?q=${encodeURIComponent(`${airline} online check-in`)}`;
}

/** C15: one way a change of city can go, with its drawing (static/illus) and its word. */
export interface WayChoice {
  mode: LegMode;
  art: string;
  label: string;
}

const WAYS: readonly { mode: LegMode; art: string; label: () => string }[] = [
  { mode: "metro", art: "tren", label: () => L("Metro", "Metro") },
  { mode: "train", art: "tren", label: () => L("Tren", "Train") },
  { mode: "bus", art: "otobus", label: () => L("Otobüs", "Bus") },
  { mode: "car", art: "arac-kiralama", label: () => L("Araba", "Car") },
  { mode: "flight", art: "ucus", label: () => L("Uçak", "Plane") },
  { mode: "taxi", art: "taksi-transfer", label: () => L("Taksi", "Taxi") },
  { mode: "transfer", art: "minibus", label: () => L("Transfer", "Shuttle") },
];

/** The ways an intent offers (IntentVM.modes), in the design's order; "Ben hallettim" is drawn after them. */
/** The ways drawn, in the order the intent gives them (a change of city's: Tren, Otobüs, Araba, Uçak; a transfer's: Metro, Otobüs, Tren, Taksi, Transfer). */
export const wayChoices = (modes: readonly LegMode[]): WayChoice[] =>
  modes.flatMap((mode) => {
    const w = WAYS.find((x) => x.mode === mode);
    return w ? [{ mode, art: w.art, label: w.label() }] : [];
  });

/** A transfer's end as a map would find it: the stay's name in its city, the airport by its words (never its bare code). */
function placeOf(end: TicketEnd | null, city: string | null): string | null {
  if (!end) return null;
  if (end.full) return end.full;
  const named = end.place && !/^[A-Z]{3}$/.test(end.place) ? end.place : null;
  const at = named ?? end.city;
  return named && city && !at.toLocaleLowerCase("tr").includes(city.toLocaleLowerCase("tr")) ? `${at}, ${city}` : at;
}

/**
 * "Kendin ara" for an intent: a transfer nobody planned its Uber and directions (its old card's, searchLinks.transferLinks),
 * a change of city nobody planned the sites that compare every way (Rome2rio, the country's rail), anything else its kind's
 * (intentFrame.selfSearches).
 */
export function waySearches(vm: Pick<IntentVM, "kind" | "head" | "options" | "chosen" | "modes" | "ticket" | "people">, given: SelfSearchAt, item: Pick<Item, "guests"> | null = null): SelfSearch[] {
  // A ticket of some of the trip's people (kişiye özel: Sabine's own flight) is looked for for them.
  const n = vm.people ?? item?.guests.adults ?? null;
  const at = n ? { ...given, adults: n } : given;
  // (a taxi or a transfer with its ends known is a ride too: its Uber and the directions)
  if (!vm.modes.length && vm.kind !== "taxi") return selfSearches(vm, at);
  if (vm.modes.length && !vm.modes.includes("taxi")) return selfSearches({ ...vm, kind: "train" }, at);
  const from = placeOf(vm.ticket?.from ?? null, vm.head.city);
  const to = placeOf(vm.ticket?.to ?? null, vm.head.city);
  return transferLinks({ from, to }).map((l) => ({ id: l.brand, name: BRANDS[l.brand].name, color: BRANDS[l.brand].color, letter: BRANDS[l.brand].letter, url: l.url }));
}

/** Önerimiz on the road from an airport in another city (IntentVM.wayPicks): one way, its drawing and words, and its search. */
export interface WayPick {
  mode: LegMode;
  art: string;
  label: string;
  /** Where it is looked up: the country's own rail site, else the map's directions; a ride's app. Null with no end to look for. */
  site: SelfSearch | null;
}

const PICK_WORDS: Partial<Record<LegMode, () => string>> = {
  train: () => L("Tren", "Train"),
  taxi: () => L("Taksi ya da özel transfer", "Taxi or private transfer"),
};

/** Google Maps' directions between two places by public transport (`maps/dir/?api=1&origin&destination&travelmode=transit`). */
function transitSearch(from: string | null, to: string | null): SelfSearch | null {
  if (!to) return null;
  const q = new URLSearchParams({ api: "1", ...(from ? { origin: from } : {}), destination: to, travelmode: "transit" });
  return { id: "maps", name: L("Google Haritalar", "Google Maps"), color: BRANDS.maps.color, letter: BRANDS.maps.letter, url: `https://www.google.com/maps/dir/?${q}` };
}

/** Islands and countries with no passenger train between the places a traveller goes: only those known for sure. */
const NO_RAIL_REGIONS = ["bali", "lombok", "phuket", "koh samui", "koh phangan", "koh tao", "zanzibar", "madeira", "azores"];
const NO_RAIL_COUNTRIES = ["MV", "MT", "CY", "IS"];

function noRail(places: (string | null | undefined)[], countries: readonly string[] | string | null | undefined): boolean {
  const codes = Array.isArray(countries) ? countries : countries ? [countries as string] : [];
  if (codes.length && codes.every((c) => NO_RAIL_COUNTRIES.includes(c))) return true;
  return places.some((p) => {
    if (!p) return false;
    const name = p.toLocaleLowerCase("tr").trim();
    const region = regionTownOf(p)?.region.toLocaleLowerCase("tr") ?? null;
    return NO_RAIL_REGIONS.includes(name) || (region != null && NO_RAIL_REGIONS.includes(region));
  });
}

/**
 * Önerimiz's rows for an intent (only one with `wayPicks`, in its order: intents.wayPickOrder): the train with the trip's
 * country's own rail site when the register has one (JR in Japan), else public transport on the map's directions; a taxi
 * or a private transfer with Uber (searchLinks.transferLinks), else the map's directions. No length, hour or price: none is
 * known (C19).
 */
export function wayPicks(vm: Pick<IntentVM, "wayPicks" | "ticket" | "head">, at: Pick<SelfSearchAt, "countries">): WayPick[] {
  if (!vm.wayPicks?.length) return [];
  const from = placeOf(vm.ticket?.from ?? null, vm.head.city);
  const to = placeOf(vm.ticket?.to ?? null, vm.head.city);
  const rail = pickProviders("train", { country: at.countries }).find((p) => p.countries !== "global") ?? null;
  // A place known to have no passenger rail (Bali, 0.39.1): public transport there, never a train made up. Anywhere else a
  // train stays one (Sri Lanka's coast line, Kolombo → Ahangama, 0.38.4), on the country's rail site or the map's directions.
  const railless = noRail([from, to, vm.head.city], at.countries);
  return vm.wayPicks.flatMap((asked): WayPick[] => {
    const mode: LegMode = asked === "train" && railless ? "bus" : asked;
    const words = asked === "train" && railless ? () => L("Toplu taşıma", "Public transport") : PICK_WORDS[mode];
    const way = wayChoices([mode])[0];
    if (!words || !way) return [];
    let site: SelfSearch | null = null;
    if (asked === "train") {
      const url = rail?.search({ from, to }) ?? null;
      site = rail && url ? { id: rail.id, name: rail.name(), color: rail.logo.color, letter: rail.logo.letter, url } : transitSearch(from, to);
    } else {
      const l = transferLinks({ from, to })[0] ?? null;
      site = l ? { id: l.brand, name: BRANDS[l.brand].name, color: BRANDS[l.brand].color, letter: BRANDS[l.brand].letter, url: l.url } : null;
    }
    return [{ mode, art: way.art, label: words(), site }];
  });
}

/**
 * The ride apps the plan suggests (0.39.1, Emre: "Uber kullan dediği öneride Uber indirme önerisi verebilir"): Uber, once a way
 * to or from the airport or the station is a taxi or a private transfer (Önerimiz's "Taksi ya da özel transfer" looks for it on
 * Uber, wayPicks). Only the app the plan links to: no table of which country uses which app is kept.
 */
export function rideApps(legs: readonly Leg[], trip: Pick<Trip, "hidden">): string[] {
  const ride = legs.some((l) => {
    if ((l.kind !== "arrival" && l.kind !== "departure") || isHiddenLeg(l, trip.hidden)) return false;
    const mode = l.choice?.mode ?? l.mode;
    return mode === "taxi" || mode === "transfer";
  });
  return ride ? [BRANDS.uber.name] : [];
}

// --- an option row (Karar bekliyor on a flight, a train, a bus) -----------------------------------------------------

/** Who put an option on the board, as the row's small round mark: the AI's spark, the traveller's link, a person's initial. */
export function rowWho(source: OptionSource | null): { tone: "ai" | "link" | "p"; text: string; title: string } | null {
  if (!source) return null;
  if (source.kind === "ai") return { tone: "ai", text: "✨", title: L("AI önerisi", "AI pick") };
  if (source.kind === "link") return { tone: "link", text: "", title: L("Senin linkin", "Your link") };
  return { tone: "p", text: [...source.name.trim()][0]?.toLocaleUpperCase("tr") ?? "", title: L(`${source.name} ekledi`, `Added by ${source.name}`) };
}

export interface RowFace {
  mark: CarrierMark | null;
  /** Bold: the airline or the service ("Turkish Airlines", "Nozomi"); small: the number or the operator and class. */
  name: string;
  sub: string | null;
  dep: string | null;
  arr: string | null;
  plus: number | null;
  /** Under each hour: the airport's code or the station. */
  from: string | null;
  to: string | null;
  duration: string | null;
  stops: { text: string; tone: "ok" | "warn" } | null;
  /** "1 bagaj dahil", when the page says it. */
  bag: string | null;
  /** The row's price as one figure (what one pays, else the total) and the whole in its tip. */
  price: { text: string; title: string | null } | null;
  /** The ribbons: our pick first, then En hızlı / En ucuz. */
  ribs: { tone: "best" | "tag"; text: string }[];
}

/** An option as Skyscanner's row says it: the carrier, the hours with the ends under them, the length and stops, the price and bag. */
export function rowFace(o: OptionVM, kind: CardKind): RowFace {
  const item = o.item;
  const leg = o.leg;
  const carrier = o.carrier;
  const mode: TicketMode = kind === "flight" ? "flight" : "train";
  // The day is the intent's, said once in its head: the row's small line keeps the number or the operator and class.
  const day = isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);
  const date = day ? formatDateRange(day, null) : null;
  const sub = kind === "flight" ? (item.flight?.flightNumber?.trim() || null) : (carrier?.sub?.split(" · ").filter((p) => p !== date).join(" · ") || null);
  const t = o.ticket;
  const price = t?.each ? { text: t.each, title: L(`kişi başı · toplam ${t.total}`, `per person · ${t.total} in all`) } : t ? { text: t.total, title: L("toplam", "in all") } : o.price ? { text: o.price.text, title: o.price.label } : null;
  const badge = (b: OptionVM["badges"][number]) => (b === "fastest" ? L("En hızlı", "Fastest") : L("En ucuz", "Cheapest"));
  return {
    mark: carrierMark(carrier, item),
    name: carrier?.name ?? o.title,
    sub,
    dep: leg?.dep ?? null,
    arr: leg?.arr ?? null,
    plus: leg?.plus ?? null,
    from: leg?.from ?? null,
    to: leg?.to ?? null,
    duration: leg?.duration ?? null,
    stops: stopsWord(leg?.stops ?? null, mode),
    bag: bagChip(item)?.text ?? null,
    price,
    ribs: [...(o.ours ? [{ tone: "best" as const, text: `✨ ${L("Önerimiz", "Our pick")}` }] : o.yours ? [{ tone: "tag" as const, text: L("Senin kaydın", "Your save") }] : []), ...o.badges.map((b) => ({ tone: "tag" as const, text: badge(b) }))],
  };
}
