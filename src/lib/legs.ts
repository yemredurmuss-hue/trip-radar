// Getting from one place to the next: from the airport (or station) to the first bed, between
// cities, from one hotel to the next in the same city, and back to the airport. Derived from the plan
// on every render, like the plan itself, so it follows every change of dates, stays and flights. Only
// what the traveller decides for a transfer (how they'll go, that it's arranged, a note) is stored,
// on the trip, by leg key; the key names the day and the cities, not the hotels, so a plan survives
// switching hotels.
import { formatDateRange, listingKeyOf } from "./items";
import { addDays, arrivalDay, departureDay, sameCity, type Plan, type StayBlock } from "./plan";
import type { HouseRules, Item, LegChoice, LegMode, Listing, Trip } from "./types";

export type LegKind = "arrival" | "move" | "change" | "departure";
export type LegStatus = "booked" | "chosen" | "planned" | "options" | "empty";

export const MODE_LABELS: Record<LegMode, string> = {
  flight: "Uçak",
  train: "Tren",
  bus: "Otobüs",
  ferry: "Feribot",
  metro: "Metro",
  taxi: "Taksi",
  transfer: "Transfer",
  car: "Araba",
  walk: "Yürüyüş",
};

/** Modes that leave from a station: a move by one of them needs a transfer at both ends. */
const FROM_HUB: LegMode[] = ["flight", "train", "bus", "ferry"];
/** Modes one books ahead; the others (metro, a street taxi, walking, one's own car) only need planning. */
const BOOKABLE: LegMode[] = ["flight", "train", "ferry", "transfer"];
/** How early to be at the station: check-in and security for a flight, finding the platform for a train. */
const HUB_BUFFER: Record<string, number> = { flight: 120, train: 20, bus: 20, ferry: 30 };
/** Roughly how long getting between a stay and the airport or station takes, for timing notes only. */
const TRANSFER_MIN = 60;

export interface LegPoint {
  label: string;
  city: string | null;
  /** The stay at this end, once booked or chosen. */
  item: Item | null;
}

export interface Leg {
  key: string;
  kind: LegKind;
  date: string;
  /** Where it goes in the plan: before the stay block with this index (the number of blocks = after the last). */
  slot: number;
  from: LegPoint;
  to: LegPoint;
  /** Local times it has to fit: not before landing, and at the airport or station by. */
  after: string | null;
  before: string | null;
  /** Saved flights or transport for it (only the booked one once something is booked). */
  options: Item[];
  mode: LegMode | null;
  /** For a transfer to or from a station: how the trip on from there goes (a flight: the airport). */
  via: LegMode | null;
  status: LegStatus;
  statusText: string;
  choice: LegChoice | null;
  /** Things easy to miss: landing hours before check-in, a flight before the metro runs... */
  notes: string[];
}

// --- what's saved for getting there ---------------------------------------------------------------------

/** A trip between cities (or in and out of the trip): one flight need, or one intercity transport. */
interface Travel {
  items: Item[];
  settled: Item | null;
  mode: LegMode | null;
  day: string;
  arrives: string;
  used: boolean;
}

const LOCAL = /havaliman|airport|aeroporto|aeropuerto|a[ée]roport|flughafen|transfer|shuttle|servis|taksi|taxi|uber|bolt|cabify|pick ?up|karşılama/i;
const text = (i: Item) => [i.name, i.summary, i.optionDetail, i.provider].filter(Boolean).join(" ");

/** A transfer within a city (to or from the airport, a taxi...) rather than a trip between cities. */
export const isLocalTransfer = (i: Item) => i.category === "transport" && LOCAL.test(text(i));

function modeOf(i: Item): LegMode | null {
  if (i.category === "flight") return "flight";
  const t = text(i);
  if (/tren|train|comboio|rail|renfe|trenitalia|sncf|\bcp\b|alfa pendular|intercidades/i.test(t)) return "train";
  if (/feribot|ferry|ferri|vapur/i.test(t)) return "ferry";
  if (/otobüs|\bbus\b|flixbus|coach|autocarro|rede expressos|alsa/i.test(t)) return "bus";
  if (/metro|subway|u-bahn/i.test(t)) return "metro";
  if (/araç kiralama|rent a car|car rental|kiralık araç/i.test(t)) return "car";
  if (LOCAL.test(t)) return "transfer";
  return null;
}

const settledOf = (items: Item[]) => items.find((i) => i.status === "booked") ?? items.find((i) => i.status === "chosen") ?? null;

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function travelsOf(plan: Plan): Travel[] {
  const out: Travel[] = [];
  for (const g of plan.groups) {
    if (g.category !== "flight" && g.category !== "transport") continue;
    const items = g.items.filter((i) => !isLocalTransfer(i));
    // A transport "need" can hold trips on different days; each day is its own trip.
    const days = g.category === "flight" ? [null] : [...new Set(items.map(departureDay))];
    for (const d of days) {
      const list = d === null ? items : items.filter((i) => departureDay(i) === d);
      const settled = settledOf(list);
      const day = (settled && departureDay(settled)) ?? mostCommon(list.map(departureDay));
      const arrives = (settled && arrivalDay(settled)) ?? mostCommon(list.map(arrivalDay)) ?? day;
      if (!list.length || !day || !arrives) continue;
      out.push({ items: list, settled, mode: settled ? modeOf(settled) : mostCommon(list.map(modeOf)) as LegMode | null, day, arrives, used: false });
    }
  }
  return out;
}

const clock = (iso: string | null | undefined): string | null => {
  const t = iso?.slice(11, 16) ?? "";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
};
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
const fmtDay = (d: string) => formatDateRange(d, null);

const HUB_NAMES: Record<string, string> = { flight: "havalimanı", train: "gar", bus: "otogar", ferry: "iskele" };

/** "OPO havalimanı", "Porto Campanhã", "Porto gar"... from where the saved trip departs or lands. */
function hubLabel(t: Travel | null, end: "from" | "to", city: string | null, mode: LegMode | null): string {
  const item = t ? (t.settled ?? t.items[0]) : null;
  const place = item?.flight?.[end]?.trim() || null;
  const kind = mode && HUB_NAMES[mode];
  if (!kind) return end === "to" ? "Varış" : "Dönüş";
  if (place) {
    if (/^[A-Z]{3}$/.test(place)) return `${place} ${kind}`; // an airport code
    if (mode !== "flight" || /havaliman|airport|aeroporto|aeropuerto|a[ée]roport|flughafen/i.test(place)) return place;
    return `${place} havalimanı`;
  }
  return city ? `${city} ${kind}` : kind[0].toLocaleUpperCase("tr") + kind.slice(1);
}

// --- stays and their house rules -------------------------------------------------------------------------

const stayOf = (b: StayBlock): Item | null => (b.kind === "open" ? null : b.item);

function pointOf(b: StayBlock): LegPoint {
  const item = stayOf(b);
  return { label: item?.name ?? (b.city ? `${b.city} konaklaması` : "Konaklama"), city: b.city, item };
}

interface Times {
  checkIn: string;
  checkOut: string;
  /** Read on the page, not the usual defaults. */
  stated: { checkIn: boolean; checkOut: boolean };
  house: HouseRules | null;
}

function timesOf(item: Item | null, listings: Map<string, Listing>): Times {
  const house = item ? (listings.get(listingKeyOf(item))?.house ?? null) : null;
  return {
    checkIn: house?.checkInFrom ?? "15:00",
    checkOut: house?.checkOutUntil ?? "11:00",
    stated: { checkIn: Boolean(house?.checkInFrom), checkOut: Boolean(house?.checkOutUntil) },
    house,
  };
}

const said = (stated: boolean) => (stated ? "sayfada yazıyor" : "genelde");

// --- the legs ----------------------------------------------------------------------------------------------

const slug = (city: string | null) =>
  (city ?? "?")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9?]+/g, "-");

export const legKey = (date: string, kind: LegKind, from: string | null, to: string | null) =>
  kind === "move" ? `${date}:move:${slug(from)}>${slug(to)}` : `${date}:${kind}:${slug(kind === "departure" ? from : to)}`;

function status(options: Item[], choice: LegChoice | null, mode: LegMode | null): Pick<Leg, "status" | "statusText"> {
  const label = mode ? MODE_LABELS[mode] : null;
  if (options.some((i) => i.status === "booked")) return { status: "booked", statusText: "Rezerve ✓" };
  if (choice?.booked) return { status: "booked", statusText: label ? `${label} · ayarlandı ✓` : "Ayarlandı ✓" };
  if (options.some((i) => i.status === "chosen")) return { status: "chosen", statusText: "Seçildi · rezerve edilmedi" };
  if (choice?.mode && label) {
    return { status: "planned", statusText: BOOKABLE.includes(choice.mode) ? `${label} · rezerve edilmedi` : `${label} · planlandı` };
  }
  if (options.length) return { status: "options", statusText: `${options.length} seçenek` };
  return { status: "empty", statusText: "Boş" };
}

/** The saved option that settles a leg (booked, else chosen), for showing its name. */
export const legItem = (leg: Leg): Item | null => settledOf(leg.options);

/**
 * Every transfer the plan needs, in order: arriving (from the airport or station to the first stay),
 * each day the city changes (and, when that's by plane, train, bus or ferry, getting to and from the
 * station on both sides), each change of stay within a city, and leaving at the end. What's saved
 * fills them (a booked flight settles its move, a saved airport transfer is an option for that day's
 * arrival), else the traveller's own plan ("metroyla"), else they're open.
 */
export function buildLegs(plan: Plan, trip: Pick<Trip, "legs">, listings: Map<string, Listing> = new Map()): Leg[] {
  const blocks = plan.stayBlocks;
  if (!blocks.length) return [];
  const travels = travelsOf(plan);
  const locals = plan.groups.filter((g) => g.category === "transport").flatMap((g) => g.items.filter(isLocalTransfer));
  const takenLocals = new Set<string>();
  const choiceOf = (key: string) => trip.legs?.[key] ?? null;
  const legs: Leg[] = [];

  /** A transfer within one city, e.g. from the airport to the stay, with its saved options and notes. */
  const local = (
    kind: Exclude<LegKind, "move">,
    date: string,
    slot: number,
    from: LegPoint,
    to: LegPoint,
    times: { after?: string | null; before?: string | null },
    notes: string[],
    via: LegMode | null = null,
  ): Leg => {
    const city = kind === "departure" ? from.city : to.city;
    const key = legKey(date, kind, from.city, to.city);
    const options = locals.filter((i) => !takenLocals.has(i.id) && departureDay(i) === date && (!i.city || !city || sameCity(i.city, city)));
    options.forEach((i) => takenLocals.add(i.id));
    const choice = choiceOf(key);
    const settled = settledOf(options);
    const mode = (settled && modeOf(settled)) ?? choice?.mode ?? null;
    return {
      key, kind, date, slot, from, to,
      after: times.after ?? null,
      before: times.before ?? null,
      options: settled?.status === "booked" ? [settled] : options,
      mode, via, choice, notes,
      ...status(options, choice, mode),
    };
  };

  // Moves first, so a flight on a moving day is never taken for the way in or out.
  const middle = new Map<number, Leg[]>();
  for (let i = 0; i + 1 < blocks.length; i++) {
    const [a, b] = [blocks[i], blocks[i + 1]];
    const date = b.range.start;
    const [from, to] = [pointOf(a), pointOf(b)];
    const here: Leg[] = [];
    if (a.city && b.city && !sameCity(a.city, b.city)) {
      const travel = travels.find((t) => !t.used && (t.day === date || t.arrives === date)) ?? null;
      if (travel) travel.used = true;
      const key = legKey(date, "move", a.city, b.city);
      const choice = choiceOf(key);
      const options = travel?.items ?? [];
      const booked = options.find((x) => x.status === "booked");
      const mode = (booked && modeOf(booked)) ?? choice?.mode ?? travel?.mode ?? null;
      const settled = travel?.settled ?? null;
      const move: Leg = {
        key, kind: "move", date, slot: i + 1, from, to,
        after: clock(settled?.flight?.departure),
        before: clock(settled?.flight?.arrival),
        options: booked ? [booked] : options,
        mode, via: null, choice, notes: [],
        ...status(options, choice, mode),
      };
      if (mode && FROM_HUB.includes(mode)) {
        here.push(departing(from, date, i + 1, travel, mode, 0));
        here.push(move);
        // An overnight trip lands the next day: the transfer is then, and the first night there goes unused.
        const lands = travel?.settled ? travel.arrives : date;
        here.push(arriving(to, lands, i + 1, travel, mode, dayDiff(lands, b.range.start)));
      } else {
        here.push(move);
      }
    } else if (stayOf(a) && stayOf(b) && listingKeyOf(stayOf(a)!) !== listingKeyOf(stayOf(b)!)) {
      const [out, into] = [timesOf(stayOf(a), listings), timesOf(stayOf(b), listings)];
      const notes = [
        `Çıkış ${out.checkOut} (${said(out.stated.checkOut)}), yeni yerde giriş ${into.checkIn} (${said(into.stated.checkIn)}): arada bavulları ilk yerde bırakabilir misin sor.`,
      ];
      here.push(local("change", date, i + 1, from, to, {}, notes));
    }
    middle.set(i + 1, here);
  }

  // In and out: the travel landing closest to the first night, and leaving closest to the last morning.
  const first = blocks[0];
  const last = blocks.at(-1)!;
  const pick = (want: (t: Travel) => number) => {
    const free = travels.filter((t) => !t.used && Math.abs(want(t)) <= 1);
    const best = free.sort((x, y) => Math.abs(want(x)) - Math.abs(want(y)))[0] ?? null;
    if (best) best.used = true;
    return best;
  };
  const inbound = pick((t) => dayDiff(t.arrives, first.range.start));
  const outbound = pick((t) => dayDiff(t.day, last.range.end));

  legs.push(arriving(pointOf(first), inbound?.settled ? inbound.arrives : first.range.start, 0, inbound, inbound?.mode ?? null, inbound?.settled ? dayDiff(inbound.arrives, first.range.start) : 0));
  for (let i = 1; i < blocks.length; i++) legs.push(...(middle.get(i) ?? []));
  legs.push(departing(pointOf(last), outbound?.settled ? outbound.day : last.range.end, blocks.length, outbound, outbound?.mode ?? null, outbound?.settled ? dayDiff(outbound.day, last.range.end) : 0));
  return legs;

  // Hoisted helpers: they share the saved local transfers and choices above.

  /** From the airport or station (or wherever the traveller arrives) to a stay. `offset`: landing day minus the first night. */
  function arriving(to: LegPoint, date: string, slot: number, travel: Travel | null, mode: LegMode | null, offset: number): Leg {
    const settled = travel?.settled ?? null;
    const lands = settled?.flight?.arrival ? clock(settled.flight.arrival) : null;
    const hub = hubLabel(travel, "to", to.city, mode);
    const notes: string[] = [];
    const t = timesOf(to.item, listings);
    const firstNight = addDays(date, -offset);
    if (settled && offset < 0) {
      notes.push(`Varış ${fmtDay(date)} ama ilk gece ${fmtDay(firstNight)}: ${fmtDay(date)} gecesi için yer yok.`);
    } else if (settled && offset > 0) {
      notes.push(`İlk gece ${fmtDay(firstNight)} ama varış ${fmtDay(date)}: ${fmtDay(firstNight)} gecesi ${to.item ? "boşa ödeniyor" : "gerekmiyor olabilir"}.`);
    } else if (lands && minutes(lands) < 6 * 60) {
      notes.push(`Varış gece ${lands}; ilk gece ${fmtDay(date)}. Varışla giriş arasında yerin yok: ${fmtDay(addDays(date, -1))} gecesini de ekle ya da gece girişini sor.`);
    }
    // Check-in times matter only when the room becomes theirs that same day.
    if (lands && minutes(lands) >= 6 * 60 && offset === 0) {
      const ready = minutes(lands) + TRANSFER_MIN;
      if (minutes(t.checkIn) - ready >= 120) {
        notes.push(`Varış ${lands}, giriş en erken ${t.checkIn} (${said(t.stated.checkIn)}): bavulları erken bırakmayı ya da erken girişi sor.`);
      }
      const until = t.house?.checkInUntil ?? null;
      if (t.house?.selfCheckIn) {
        if (ready >= 21 * 60) notes.push(`Geç varış (${lands}) sorun değil: kendi kendine giriş var (sayfada yazıyor).`);
      } else if (until && ready > minutes(until)) {
        notes.push(`Giriş en geç ${until} (sayfada yazıyor), varış ${lands}: geç girişi önceden ayarla.`);
      } else if (ready >= 22 * 60) {
        notes.push(`Geç varış (${lands}): girişin nasıl olacağını önceden sor; bu saatte toplu taşıma seyrek olabilir.`);
      }
    }
    if (mode === "flight" && t.house?.airportShuttle) notes.push("Havalimanı servisi var (sayfada yazıyor); saatini ve ücretini sor.");
    return local("arrival", date, slot, { label: hub, city: to.city, item: null }, to, { after: lands }, notes, mode);
  }

  /** From a stay to the airport or station (or however the traveller leaves). `offset`: departure day minus the check-out day. */
  function departing(from: LegPoint, date: string, slot: number, travel: Travel | null, mode: LegMode | null, offset: number): Leg {
    const settled = travel?.settled ?? null;
    const leaves = clock(settled?.flight?.departure);
    const buffer = mode ? HUB_BUFFER[mode] : undefined;
    const by = leaves && buffer !== undefined ? hhmm(minutes(leaves) - buffer) : null;
    const hub = hubLabel(travel, "from", from.city, mode);
    const notes: string[] = [];
    const t = timesOf(from.item, listings);
    const checkout = addDays(date, -offset);
    if (settled && offset > 0 && !(leaves && minutes(leaves) < 6 * 60)) {
      notes.push(`Çıkış ${fmtDay(checkout)} ama gidiş ${fmtDay(date)}: ${fmtDay(checkout)} gecesi için yer yok.`);
    } else if (settled && offset > 0) {
      notes.push(`Gidiş gece ${leaves} (${fmtDay(date)}): çıkıştan sonraki akşamı ve geceyi nerede geçireceğini planla, bavul emaneti sor.`);
    } else if (settled && offset < 0) {
      notes.push(`Gidiş ${fmtDay(date)} ama son gece ${fmtDay(date)}: o gece ${from.item ? "boşa ödeniyor" : "gerekmiyor"}.`);
    }
    if (leaves && by && buffer) {
      const byMin = minutes(leaves) - buffer;
      if (byMin < 7 * 60 && offset === 0) {
        notes.push(
          `Gidiş ${leaves}: ${by} civarı ${mode === "flight" ? "havalimanında" : "istasyonda"} olmalısın; bu saatte metro ve otobüs çalışmıyor olabilir, taksi ya da transferi önceden ayarla.`,
        );
      }
      const gap = byMin - TRANSFER_MIN - minutes(t.checkOut);
      if (offset === 0 && gap >= 4 * 60) {
        const storage = t.house?.luggageStorage ? "bavul emaneti var (sayfada yazıyor)" : "bavul emaneti ya da geç çıkış sor";
        notes.push(`Çıkış ${t.checkOut} (${said(t.stated.checkOut)}), gidiş ${leaves}: arada ~${Math.round(gap / 60)} saat boşluk; ${storage}.`);
      }
    }
    if (mode === "flight" && t.house?.airportShuttle) notes.push("Havalimanı servisi var (sayfada yazıyor); saatini ve ücretini sor.");
    return local("departure", date, slot, from, { label: hub, city: from.city, item: null }, { before: by }, notes, mode);
  }
}

/** Short text for a leg ("7 Ekim · OPO havalimanı → Jardim Stay"). */
export function legTitle(leg: Leg): string {
  return `${fmtDay(leg.date)} · ${leg.from.label} → ${leg.to.label}`;
}

/** The leg's timing in words ("10:05 inişten sonra", "05:10'a kadar havalimanında"). */
export function legTiming(leg: Leg): string | null {
  if (leg.kind === "move") return leg.after && leg.before ? `${leg.after} → ${leg.before}` : null;
  if (leg.after) return `Varış ${leg.after}`;
  if (leg.before) return `En geç ${leg.before} ${leg.via === "flight" ? "havalimanında" : "istasyonda"}`;
  return null;
}

/** Modes that make sense for a leg: no flights across town, no metro between cities. */
export function modesFor(kind: LegKind): LegMode[] {
  return kind === "move"
    ? ["flight", "train", "bus", "ferry", "car", "transfer", "taxi"]
    : ["metro", "bus", "train", "taxi", "transfer", "car", "walk", "ferry"];
}

/** The trip with the traveller's plan for one leg changed (null clears it back to open). */
export function withLegChoice(trip: Trip, key: string, patch: Partial<Omit<LegChoice, "updatedAt">> | null, now = Date.now()): Trip {
  const legs = { ...(trip.legs ?? {}) };
  if (patch === null) delete legs[key];
  else {
    const before = legs[key] ?? { mode: null, booked: false, note: null, updatedAt: now };
    legs[key] = { ...before, ...patch, updatedAt: now };
  }
  return { ...trip, legs };
}
