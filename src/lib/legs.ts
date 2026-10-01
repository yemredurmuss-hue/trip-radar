// Getting from one place to the next: from the airport (or station) to the first bed, between
// cities, from one hotel to the next in the same city, and back to the airport. Derived from the plan
// on every render, like the plan itself, so it follows every change of dates, stays and flights. Only
// what the traveller decides for a transfer (how they'll go, that it's arranged, a note) is stored,
// on the trip, by leg key; the key names the day and the cities, not the hotels, so a plan survives
// switching hotels.
import { L } from "./i18n";
import { capitalize, liveLabels, nOptions } from "./i18nText";
import { formatDateRange, listingKeyOf } from "./items";
import { addDays, arrivalDay, cityKeyOf, departureDay, knownPlace, placeKeyOf, sameCity, type OptionGroup, type Plan, type StayBlock } from "./plan";
import { isLocalTransfer, isRental, itemText, LOCAL, RENTAL } from "./travelKinds";
import type { HouseRules, Item, LegChoice, LegMode, Listing, Trip } from "./types";

export type LegKind = "arrival" | "move" | "change" | "departure";
export type LegStatus = "booked" | "chosen" | "planned" | "options" | "empty";

export const MODE_LABELS: Readonly<Record<LegMode, string>> = liveLabels({
  flight: ["Uçak", "Flight"],
  train: ["Tren", "Train"],
  bus: ["Otobüs", "Bus"],
  ferry: ["Feribot", "Ferry"],
  metro: ["Metro", "Metro"],
  taxi: ["Taksi", "Taxi"],
  transfer: ["Transfer", "Transfer"],
  car: ["Araba", "Car"],
  walk: ["Yürüyüş", "Walk"],
});

/** Modes that leave from a station: a move by one of them needs a transfer at both ends. */
const FROM_HUB: LegMode[] = ["flight", "train", "bus", "ferry"];
/** Modes one books ahead; the others (metro, a street taxi, walking, one's own car) only need planning. */
/** Ways that are a reservation of their own (a ticket, a car booked to wait for you); the rest you just take. */
export const BOOKABLE: LegMode[] = ["flight", "train", "ferry", "transfer", "taxi"];
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
  /** The flight or train this leg connects to (arriving, leaving, or the move itself). */
  travel: Travel | null;
  status: LegStatus;
  statusText: string;
  choice: LegChoice | null;
  /** Things easy to miss: landing hours before check-in, a flight before the metro runs... */
  notes: string[];
}

// --- what's saved for getting there ---------------------------------------------------------------------

/** A trip between cities (or in and out of the trip): one flight need, or one intercity transport. */
export interface Travel {
  /** The saved need it comes from (its decision is found by this group's key). */
  group: OptionGroup;
  /** Its options (for a transport need: the ones on this day). */
  items: Item[];
  settled: Item | null;
  mode: LegMode | null;
  day: string;
  arrives: string;
  used: boolean;
}

const text = itemText;
export { isLocalTransfer, isRental };

function modeOf(i: Item): LegMode | null {
  if (i.category === "flight") return "flight";
  if (i.plannedKind === "taxi") return "taxi";
  const t = text(i);
  if (/tren|train|comboio|rail|renfe|trenitalia|sncf|\bcp\b|alfa pendular|intercidades/i.test(t)) return "train";
  if (/feribot|ferry|ferri|vapur/i.test(t)) return "ferry";
  if (/otobüs|\bbus\b|flixbus|coach|autocarro|rede expressos|alsa/i.test(t)) return "bus";
  if (/metro|subway|u-bahn/i.test(t)) return "metro";
  if (RENTAL.test(t)) return "car";
  if (LOCAL.test(t)) return "transfer";
  return null;
}

const settledOf = (items: Item[]) => items.find((i) => i.status === "booked") ?? items.find((i) => i.status === "chosen") ?? null;

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** The trips between places the plan's saved flights and transport make (not transfers within a city, nor rentals). */
export function travelsOf(plan: Plan): Travel[] {
  const out: Travel[] = [];
  for (const g of plan.groups) {
    if (g.category !== "flight" && g.category !== "transport") continue;
    const items = g.items.filter((i) => !isLocalTransfer(i) && !isRental(i));
    // A transport "need" can hold trips on different days; each day is its own trip.
    const days = g.category === "flight" ? [null] : [...new Set(items.map(departureDay))];
    for (const d of days) {
      const list = d === null ? items : items.filter((i) => departureDay(i) === d);
      const settled = settledOf(list);
      const day = (settled && departureDay(settled)) ?? mostCommon(list.map(departureDay));
      const arrives = (settled && arrivalDay(settled)) ?? mostCommon(list.map(arrivalDay)) ?? day;
      if (!list.length || !day || !arrives) continue;
      out.push({ group: g, items: list, settled, mode: settled ? modeOf(settled) : mostCommon(list.map(modeOf)) as LegMode | null, day, arrives, used: false });
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

const HUB_NAMES: Readonly<Partial<Record<string, string>>> = liveLabels({
  flight: ["havalimanı", "airport"],
  train: ["gar", "station"],
  bus: ["otogar", "bus station"],
  ferry: ["iskele", "ferry port"],
});

/** "OPO havalimanı", "Porto Campanhã", "Porto gar"... from where the saved trip departs or lands. */
function hubLabel(t: Travel | null, end: "from" | "to", city: string | null, mode: LegMode | null): string {
  const item = t ? (t.settled ?? t.items[0]) : null;
  const place = item?.flight?.[end]?.trim() || null;
  const kind = mode && HUB_NAMES[mode];
  if (!kind) return end === "to" ? L("Varış", "Arrival") : L("Dönüş", "Return");
  if (place) {
    if (/^[A-Z]{3}$/.test(place)) return `${place} ${kind}`; // an airport code
    if (mode !== "flight" || /havaliman|airport|aeroporto|aeropuerto|a[ée]roport|flughafen/i.test(place)) return place;
    return `${place} ${HUB_NAMES.flight}`;
  }
  return city ? `${city} ${kind}` : capitalize(kind);
}

// --- stays and their house rules -------------------------------------------------------------------------

const stayOf = (b: StayBlock): Item | null => (b.kind === "open" ? null : b.item);

function pointOf(b: StayBlock): LegPoint {
  const item = stayOf(b);
  return { label: item?.name ?? (b.city ? L(`${b.city} konaklaması`, `${b.city} stay`) : L("Konaklama", "Stay")), city: b.city, item };
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

const said = (stated: boolean) => (stated ? ON_PAGE() : L("genelde", "usually"));
/** "(sayfada yazıyor)": a fact the stay's page states. */
const ON_PAGE = () => L("sayfada yazıyor", "on the page");

const SHUTTLE = () => L("Havalimanı servisi var (sayfada yazıyor); saatini ve ücretini sor.", "There's an airport shuttle (on the page); ask for its times and price.");

/** A stay's check-in and check-out hours, and whether its page says them (otherwise the usual 15:00 / 11:00). */
export function stayTimes(item: Item | null, listings: Map<string, Listing> | undefined) {
  const t = timesOf(item, listings ?? new Map());
  return { checkIn: t.checkIn, checkOut: t.checkOut, stated: t.stated };
}

/** "10:05" from "2026-10-08T10:05"; minutes since midnight and back. */
export const clockOf = (iso: string | null | undefined) => clock(iso);
export const addMinutes = (time: string, add: number) => hhmm(minutes(time) + add);
export const laterOf = (a: string, b: string) => (minutes(a) >= minutes(b) ? a : b);
export const minutesOf = (time: string) => minutes(time);

// --- the legs ----------------------------------------------------------------------------------------------

const slug = (city: string | null) =>
  (city ?? "?")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9?]+/g, "-");

const placeSlug = (city: string | null) => slug(cityKeyOf(city));

/**
 * A transfer's key, for the traveller's plan for it. It follows the stays' dates and the cities (by
 * key: "Lisbon" and "Lizbon" are one), so picking a different flight doesn't lose "metroyla".
 */
export const legKey = (date: string, kind: LegKind, from: string | null, to: string | null) =>
  kind === "move" ? `${date}:move:${placeSlug(from)}>${placeSlug(to)}` : `${date}:${kind}:${placeSlug(kind === "departure" ? from : to)}`;

/** Keys before 0.13.1 (the city as written, the leg's own date): plans saved under them still count. */
const legacyKey = (date: string, kind: LegKind, from: string | null, to: string | null) =>
  kind === "move" ? `${date}:move:${slug(from)}>${slug(to)}` : `${date}:${kind}:${slug(kind === "departure" ? from : to)}`;

function status(options: Item[], choice: LegChoice | null, mode: LegMode | null): Pick<Leg, "status" | "statusText"> {
  const label = mode ? MODE_LABELS[mode] : null;
  if (options.some((i) => i.status === "booked")) return { status: "booked", statusText: L("Rezerve ✓", "Booked ✓") };
  if (choice?.booked) return { status: "booked", statusText: label ? `${label} · ${L("ayarlandı", "arranged")} ✓` : L("Ayarlandı ✓", "Arranged ✓") };
  const chosen = options.find((i) => i.status === "chosen");
  // Said in the chat ("11'ine taksi"): planned, like any plan said there.
  if (chosen?.origin === "chat") return { status: "planned", statusText: label ? `${label} · ${L("planlanıyor", "planning")}` : L("Planlanıyor", "Planning") };
  if (chosen) return { status: "chosen", statusText: L("Seçildi · rezerve edilmedi", "Chosen · not booked") };
  if (choice?.mode && label) {
    return { status: "planned", statusText: `${label} · ${BOOKABLE.includes(choice.mode) ? L("rezerve edilmedi", "not booked") : L("planlandı", "planned")}` };
  }
  if (options.length) return { status: "options", statusText: nOptions(options.length) };
  return { status: "empty", statusText: L("Boş", "Open") };
}

/** Where a trip leaves from and goes to, as city keys (its settled option's, else what its options mostly say). */
export function endsOf(t: Travel): { from: string | null; to: string | null } {
  const list = t.settled ? [t.settled] : t.items;
  return {
    from: mostCommon(list.map((i) => placeKeyOf(i.flight?.from))),
    to: mostCommon(list.map((i) => placeKeyOf(i.flight?.to ?? (i.category === "transport" ? null : i.city)))),
  };
}

/**
 * How well a trip fits going from one city to another (null: either): -1 when it's known to go
 * elsewhere or the other way, else one point per end that matches.
 */
function directionScore(t: Travel, from: string | null, to: string | null): number {
  const ends = endsOf(t);
  const [want, wantTo] = [cityKeyOf(from), cityKeyOf(to)];
  const matches = (end: string | null, city: string | null) => Boolean(end && city && end === city);
  const elsewhere = (end: string | null, city: string | null) => Boolean(end && city && end !== city && knownPlace(end) && knownPlace(city));
  if (matches(ends.from, wantTo) || matches(ends.to, want)) return -1; // the other way round
  if (elsewhere(ends.from, want) || elsewhere(ends.to, wantTo)) return -1;
  return Number(matches(ends.from, want)) + Number(matches(ends.to, wantTo));
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
    travel: Travel | null = null,
    keyDate = date,
  ): Leg => {
    const city = kind === "departure" ? from.city : to.city;
    const key = legKey(keyDate, kind, from.city, to.city);
    const options = locals.filter((i) => !takenLocals.has(i.id) && departureDay(i) === date && (!i.city || !city || sameCity(i.city, city)));
    options.forEach((i) => takenLocals.add(i.id));
    const choice = choiceOf(key) ?? choiceOf(legacyKey(date, kind, from.city, to.city));
    const settled = settledOf(options);
    const mode = (settled && modeOf(settled)) ?? choice?.mode ?? null;
    return {
      key, kind, date, slot, from, to,
      after: times.after ?? null,
      before: times.before ?? null,
      options: settled?.status === "booked" ? [settled] : options,
      mode, via, travel, choice, notes,
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
      // That day's trip from a to b; one known to go elsewhere (or the other way) isn't this move.
      const fits = travels
        .filter((t) => !t.used && (t.day === date || t.arrives === date))
        .map((t) => ({ t, score: directionScore(t, a.city, b.city) }))
        .filter((x) => x.score >= 0)
        .sort((x, y) => y.score - x.score);
      const travel = fits[0]?.t ?? null;
      if (travel) travel.used = true;
      const key = legKey(date, "move", a.city, b.city);
      const choice = choiceOf(key) ?? choiceOf(legacyKey(date, "move", a.city, b.city));
      const options = travel?.items ?? [];
      const booked = options.find((x) => x.status === "booked");
      const mode = (booked && modeOf(booked)) ?? choice?.mode ?? travel?.mode ?? null;
      const settled = travel?.settled ?? null;
      const move: Leg = {
        key, kind: "move", date, slot: i + 1, from, to,
        after: clock(settled?.flight?.departure),
        before: clock(settled?.flight?.arrival),
        options: booked ? [booked] : options,
        mode, via: null, travel, choice, notes: [],
        ...status(options, choice, mode),
      };
      if (mode && FROM_HUB.includes(mode)) {
        // An overnight trip can leave the evening before: the transfer to the station is then.
        const leaves = travel?.settled ? travel.day : date;
        here.push(departing(from, leaves, i + 1, travel, mode, dayDiff(leaves, a.range.end), date));
        here.push(move);
        // An overnight trip lands the next day: the transfer is then, and the first night there goes unused.
        const lands = travel?.settled ? travel.arrives : date;
        here.push(arriving(to, lands, i + 1, travel, mode, dayDiff(lands, b.range.start), date));
      } else {
        here.push(move);
      }
    } else if (stayOf(a) && stayOf(b) && listingKeyOf(stayOf(a)!) !== listingKeyOf(stayOf(b)!)) {
      const [out, into] = [timesOf(stayOf(a), listings), timesOf(stayOf(b), listings)];
      const notes = [
        L(
          `Çıkış ${out.checkOut} (${said(out.stated.checkOut)}), yeni yerde giriş ${into.checkIn} (${said(into.stated.checkIn)}): arada bavulları ilk yerde bırakabilir misin sor.`,
          `Check-out ${out.checkOut} (${said(out.stated.checkOut)}), check-in at the new place ${into.checkIn} (${said(into.stated.checkIn)}): ask whether you can leave your bags at the first place in between.`,
        ),
      ];
      here.push(local("change", date, i + 1, from, to, {}, notes));
    }
    middle.set(i + 1, here);
  }

  // In and out: the travel landing closest to the first night, and leaving closest to the last morning.
  const first = blocks[0];
  const last = blocks.at(-1)!;
  // In: landing up to three days before the first night (or the day after); out: leaving from the
  // day before the last morning to three days after. The closest wins.
  // A trip known to leave the first place isn't the way in (nor one arriving at the last place the way
  // out); one known to go the right way is preferred over one that doesn't say.
  const pick = (want: (t: Travel) => number, from: number, to: number, fit: (t: Travel) => number) => {
    const free = travels.filter((t) => !t.used && want(t) >= from && want(t) <= to && fit(t) >= 0);
    const best = free.sort((x, y) => fit(y) - fit(x) || Math.abs(want(x)) - Math.abs(want(y)))[0] ?? null;
    if (best) best.used = true;
    return best;
  };
  const inbound = pick((t) => dayDiff(t.arrives, first.range.start), -3, 1, (t) => directionScore(t, null, first.city));
  const outbound = pick((t) => dayDiff(t.day, last.range.end), -1, 3, (t) => directionScore(t, last.city, null));

  // The transfers are on the flights' days (the options' common day until one is chosen), so the board
  // never shows "Transfer 18 Ekim" next to "Dönüş 17 Ekim". The timing notes need a chosen flight.
  legs.push(
    arriving(pointOf(first), inbound ? inbound.arrives : first.range.start, 0, inbound, inbound?.mode ?? null, inbound?.settled ? dayDiff(inbound.arrives, first.range.start) : 0, first.range.start),
  );
  for (let i = 1; i < blocks.length; i++) legs.push(...(middle.get(i) ?? []));
  legs.push(
    departing(pointOf(last), outbound ? outbound.day : last.range.end, blocks.length, outbound, outbound?.mode ?? null, outbound?.settled ? dayDiff(outbound.day, last.range.end) : 0, last.range.end),
  );
  return legs;

  // Hoisted helpers: they share the saved local transfers and choices above.

  /** From the airport or station (or wherever the traveller arrives) to a stay. `offset`: landing day minus the first night. */
  function arriving(to: LegPoint, date: string, slot: number, travel: Travel | null, mode: LegMode | null, offset: number, keyDate: string): Leg {
    const settled = travel?.settled ?? null;
    const lands = settled?.flight?.arrival ? clock(settled.flight.arrival) : null;
    const hub = hubLabel(travel, "to", to.city, mode);
    const notes: string[] = [];
    const t = timesOf(to.item, listings);
    const firstNight = addDays(date, -offset);
    if (settled && offset < 0) {
      notes.push(
        L(
          `Varış ${fmtDay(date)} ama ilk gece ${fmtDay(firstNight)}: ${fmtDay(date)} gecesi için yer yok.`,
          `You arrive ${fmtDay(date)} but the first night is ${fmtDay(firstNight)}: nowhere to stay the night of ${fmtDay(date)}.`,
        ),
      );
    } else if (settled && offset > 0) {
      notes.push(
        L(
          `İlk gece ${fmtDay(firstNight)} ama varış ${fmtDay(date)}: ${fmtDay(firstNight)} gecesi ${to.item ? "boşa ödeniyor" : "gerekmiyor olabilir"}.`,
          `The first night is ${fmtDay(firstNight)} but you arrive ${fmtDay(date)}: the night of ${fmtDay(firstNight)} ${to.item ? "is paid for nothing" : "may not be needed"}.`,
        ),
      );
    } else if (lands && minutes(lands) < 6 * 60) {
      notes.push(
        L(
          `Varış gece ${lands}; ilk gece ${fmtDay(date)}. Varışla giriş arasında yerin yok: ${fmtDay(addDays(date, -1))} gecesini de ekle ya da gece girişini sor.`,
          `You land at ${lands} at night; the first night is ${fmtDay(date)}. Nowhere to stay between landing and check-in: add the night of ${fmtDay(addDays(date, -1))} or ask about a night check-in.`,
        ),
      );
    }
    // Check-in times matter only when the room becomes theirs that same day.
    if (lands && minutes(lands) >= 6 * 60 && offset === 0) {
      const ready = minutes(lands) + TRANSFER_MIN;
      if (minutes(t.checkIn) - ready >= 120) {
        notes.push(
          L(
            `Varış ${lands}, giriş en erken ${t.checkIn} (${said(t.stated.checkIn)}): bavulları erken bırakmayı ya da erken girişi sor.`,
            `You land at ${lands}, check-in from ${t.checkIn} (${said(t.stated.checkIn)}): ask about dropping your bags early or an early check-in.`,
          ),
        );
      }
      const until = t.house?.checkInUntil ?? null;
      if (t.house?.selfCheckIn) {
        if (ready >= 21 * 60) notes.push(L(`Geç varış (${lands}) sorun değil: kendi kendine giriş var (sayfada yazıyor).`, `Arriving late (${lands}) is fine: there's self check-in (on the page).`));
      } else if (until && ready > minutes(until)) {
        notes.push(L(`Giriş en geç ${until} (sayfada yazıyor), varış ${lands}: geç girişi önceden ayarla.`, `Check-in until ${until} (on the page), you land at ${lands}: arrange a late check-in ahead.`));
      } else if (ready >= 22 * 60) {
        notes.push(
          L(
            `Geç varış (${lands}): girişin nasıl olacağını önceden sor; bu saatte toplu taşıma seyrek olabilir.`,
            `Late arrival (${lands}): ask ahead how check-in works; public transport may be sparse at that hour.`,
          ),
        );
      }
    }
    if (mode === "flight" && t.house?.airportShuttle) notes.push(SHUTTLE());
    return local("arrival", date, slot, { label: hub, city: to.city, item: null }, to, { after: lands }, notes, mode, travel, keyDate);
  }

  /** From a stay to the airport or station (or however the traveller leaves). `offset`: departure day minus the check-out day. */
  function departing(from: LegPoint, date: string, slot: number, travel: Travel | null, mode: LegMode | null, offset: number, keyDate: string): Leg {
    const settled = travel?.settled ?? null;
    const leaves = clock(settled?.flight?.departure);
    const buffer = mode ? HUB_BUFFER[mode] : undefined;
    const by = leaves && buffer !== undefined ? hhmm(minutes(leaves) - buffer) : null;
    const hub = hubLabel(travel, "from", from.city, mode);
    const notes: string[] = [];
    const t = timesOf(from.item, listings);
    const checkout = addDays(date, -offset);
    if (settled && offset > 0 && !(leaves && minutes(leaves) < 6 * 60)) {
      notes.push(
        L(
          `Çıkış ${fmtDay(checkout)} ama gidiş ${fmtDay(date)}: ${fmtDay(checkout)} gecesi için yer yok.`,
          `Check-out ${fmtDay(checkout)} but you leave ${fmtDay(date)}: nowhere to stay the night of ${fmtDay(checkout)}.`,
        ),
      );
    } else if (settled && offset > 0) {
      notes.push(
        L(
          `Gidiş gece ${leaves} (${fmtDay(date)}): çıkıştan sonraki akşamı ve geceyi nerede geçireceğini planla, bavul emaneti sor.`,
          `You leave at ${leaves} at night (${fmtDay(date)}): plan where to spend the evening and night after check-out, and ask about luggage storage.`,
        ),
      );
    } else if (settled && offset < 0) {
      notes.push(
        L(
          `Gidiş ${fmtDay(date)} ama son gece ${fmtDay(date)}: o gece ${from.item ? "boşa ödeniyor" : "gerekmiyor"}.`,
          `You leave ${fmtDay(date)} but the last night is ${fmtDay(date)}: that night ${from.item ? "is paid for nothing" : "isn't needed"}.`,
        ),
      );
    } else if (settled && offset === 0 && leaves && minutes(leaves) < 6 * 60) {
      notes.push(
        L(
          `Gidiş gece ${leaves}: ${fmtDay(addDays(date, -1))} gecesinin yalnız birkaç saati kullanılır; o akşam yola çıkmayı ya da havalimanına yakın kalmayı düşün.`,
          `You leave at ${leaves} at night: only a few hours of the night of ${fmtDay(addDays(date, -1))} get used; think about setting off that evening or staying near the airport.`,
        ),
      );
    }
    if (leaves && by && buffer) {
      const byMin = minutes(leaves) - buffer;
      if (byMin < 7 * 60 && offset === 0) {
        notes.push(
          L(
            `Gidiş ${leaves}: ${by} civarı ${mode === "flight" ? "havalimanında" : "istasyonda"} olmalısın; bu saatte metro ve otobüs çalışmıyor olabilir, taksi ya da transferi önceden ayarla.`,
            `Leaving ${leaves}: be at the ${mode === "flight" ? "airport" : "station"} around ${by}; the metro and buses may not run at that hour, so book a taxi or transfer ahead.`,
          ),
        );
      }
      const gap = byMin - TRANSFER_MIN - minutes(t.checkOut);
      if (offset === 0 && gap >= 4 * 60) {
        const storage = t.house?.luggageStorage
          ? L("bavul emaneti var (sayfada yazıyor)", "there's luggage storage (on the page)")
          : L("bavul emaneti ya da geç çıkış sor", "ask about luggage storage or a late check-out");
        const hours = Math.round(gap / 60);
        notes.push(
          L(
            `Çıkış ${t.checkOut} (${said(t.stated.checkOut)}), gidiş ${leaves}: arada ~${hours} saat boşluk; ${storage}.`,
            `Check-out ${t.checkOut} (${said(t.stated.checkOut)}), leaving ${leaves}: ~${hours} hours in between; ${storage}.`,
          ),
        );
      }
    }
    if (mode === "flight" && t.house?.airportShuttle) notes.push(SHUTTLE());
    return local("departure", date, slot, from, { label: hub, city: from.city, item: null }, { before: by }, notes, mode, travel, keyDate);
  }
}

/** Short text for a leg ("7 Ekim · OPO havalimanı → Jardim Stay"). */
export function legTitle(leg: Leg): string {
  return `${fmtDay(leg.date)} · ${leg.from.label} → ${leg.to.label}`;
}

/** The leg's timing in words ("10:05 inişten sonra", "05:10'a kadar havalimanında"). */
const STAY_WORDS: Readonly<Partial<Record<string, string>>> = liveLabels({
  apartment: ["Daire", "Apartment"],
  house: ["Ev", "House"],
  hostel: ["Hostel", "Hostel"],
  guesthouse: ["Pansiyon", "Guesthouse"],
});
const stayWord = (p: LegPoint) => STAY_WORDS[p.item?.metrics?.stayKind ?? ""] ?? L("Otel", "Hotel");

/**
 * A transfer in a few words, like a ticket: "Havalimanı → Otel", "Daire → Gar", "Otel değişimi". The
 * names (OPO, the stay's name) go under it; the notes open with it.
 */
export function legShortTitle(leg: Leg): string {
  if (leg.kind === "move") return `${leg.from.city ?? leg.from.label} → ${leg.to.city ?? leg.to.label}`;
  if (leg.kind === "change") return L(`${stayWord(leg.from)} değişimi`, `${stayWord(leg.from)} change`);
  const word = leg.via && HUB_NAMES[leg.via];
  const hub = word ? capitalize(word) : leg.kind === "arrival" ? leg.from.label : leg.to.label;
  return leg.kind === "arrival" ? `${hub} → ${stayWord(leg.to)}` : `${stayWord(leg.from)} → ${hub}`;
}

export function legTiming(leg: Leg): string | null {
  if (leg.kind === "move") return leg.after && leg.before ? `${leg.after} → ${leg.before}` : null;
  if (leg.after) return `${L("Varış", "Arrives")} ${leg.after}`;
  if (leg.before) {
    const flight = leg.via === "flight";
    return L(`En geç ${leg.before} ${flight ? "havalimanında" : "istasyonda"}`, `At the ${flight ? "airport" : "station"} by ${leg.before}`);
  }
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
