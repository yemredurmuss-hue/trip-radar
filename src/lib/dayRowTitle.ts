// A line of the day in one standard (gün akışı satır standardı v2, docs/superpowers/specs/
// 2026-10-06-gun-akisi-satir-standardi-design.md): NE · HANGİSİ, then a grey line. NE is a word from a fixed
// list, picked here by the code (never by the AI): "Uçuş", "Check-in", "Havalimanı transferi", "Tekne turu",
// "Öğle yemeği", "Manzara"…; HANGİSİ only what's particular ("İstanbul → Kopenhag", "Taksi", "Douro nehri");
// the grey line the rest (airports, arrival, how long, what's left to do). The stored names never change. Pure.
import { airportName, cityOfAirport, knownAirport } from "./airports";
import { isIdea } from "./booking";
import { transportMode } from "./cardKinds";
import { L } from "./i18n";
import { count, hoursMinutes, lowerFirst, nDays, nNights, nOptions } from "./i18nText";
import { ideaKindOf, type IdeaKind } from "./ideaKinds";
import { metricsOf } from "./items";
import type { DayRow } from "./journey";
import { BOOKABLE, clockOf, legItem, type Leg } from "./legs";
import type { Item, LegMode } from "./types";

export interface RowTitle {
  /** NE: the fixed word for what it is, bold. */
  what: string;
  /** HANGİSİ: which one, only the particular ("" when there's nothing to add). */
  which: string;
  /** The grey line under it ("" when there's nothing). */
  detail: string;
}

/** "Uçuş · İstanbul → Kopenhag", or the word alone: a line's title as one text (its data-title, its label). */
export const titleText = (t: RowTitle): string => (t.which ? `${t.what} · ${t.which}` : t.what);

const join = (parts: (string | null | undefined | false)[]) => parts.filter((p): p is string => !!p && !!p.trim()).join(" · ");

// --- names -----------------------------------------------------------------------------------------

const CUTS = [" – ", " — ", " - ", " | ", " · ", ", "];

/**
 * A stay's or a place's name without its tail: cut at the first " – ", " - ", " | ", " · " or ", " that has at
 * least 3 characters before it ("Casa Verde – Yeni Tasarlanmış, havuzlu" → "Casa Verde"). Only for showing.
 */
export function simpleName(name: string): string {
  const text = name.trim();
  let at = -1;
  for (const sep of CUTS) {
    for (let i = text.indexOf(sep); i >= 0; i = text.indexOf(sep, i + 1)) {
      if (text.slice(0, i).trim().length >= 3) {
        if (at < 0 || i < at) at = i;
        break;
      }
    }
  }
  return at >= 0 ? text.slice(0, at).trim() : text;
}

const isCode = (text: string) => /^[A-Z]{3}$/.test(text);

/** A place as a traveller says it: an airport code we know as its city; an unknown code as the record's own city, else the code. */
export function placeName(text: string | null | undefined, fallback: string | null = null): string | null {
  const t = text?.trim();
  if (!t) return fallback;
  if (knownAirport(t)) return cityOfAirport(t);
  if (isCode(t)) return fallback ?? t;
  return t;
}

/** "IST → OPO" (or "→ Porto") with each end as its city. */
const routeOf = (text: string | null | undefined): string =>
  (text ?? "")
    .split(" → ")
    .map((p) => (p ? (placeName(p) ?? p) : p))
    .join(" → ")
    .trim();

// --- Turkish times with their suffix ("15:00'ten itibaren", "11:00'e kadar") -------------------------

const UNITS = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli"];
/** The last word of a time as it's said ("15:00" → "beş", "14:30" → "otuz"). */
function lastWord(time: string): string {
  const [h, m] = [Number(time.slice(0, 2)), Number(time.slice(3, 5))];
  const n = m > 0 ? m : h;
  if (n === 0) return UNITS[0];
  return n % 10 ? UNITS[n % 10] : TENS[Math.floor(n / 10)];
}
function harmony(time: string) {
  const word = lastWord(time);
  const vowel = [...word].reverse().find((c) => /[aıoueiöü]/.test(c)) ?? "e";
  return { front: /[eiöü]/.test(vowel), hard: /[fstkçşhp]$/.test(word), open: /[aıoueiöü]$/.test(word) };
}
/** "15:00'ten", "16:00'dan". */
export function fromTime(time: string): string {
  const h = harmony(time);
  return `${time}'${h.hard ? "t" : "d"}${h.front ? "e" : "a"}n`;
}
/** "11:00'e", "12:00'ye", "10:00'a". */
export function toTime(time: string): string {
  const h = harmony(time);
  return `${time}'${h.open ? "y" : ""}${h.front ? "e" : "a"}`;
}

// --- the fixed words ----------------------------------------------------------------------------------

const W = {
  flight: () => L("Uçuş", "Flight"),
  layover: () => L("Aktarma", "Layover"),
  airportTransfer: () => L("Havalimanı transferi", "Airport transfer"),
  transfer: () => L("Transfer", "Transfer"),
  train: () => L("Tren", "Train"),
  bus: () => L("Otobüs", "Bus"),
  ferry: () => L("Vapur", "Ferry"),
  carPickUp: () => L("Araç teslim alma", "Car pick-up"),
  carReturn: () => L("Araç iadesi", "Car return"),
  tour: () => L("Tur", "Tour"),
  boat: () => L("Tekne turu", "Boat tour"),
  museum: () => L("Müze", "Museum"),
  show: () => L("Gösteri", "Show"),
  event: () => L("Etkinlik", "Event"),
  meal: () => L("Yemek", "Meal"),
};

/** How one gets about, as the HANGİSİ of a transfer. */
const WAY: Record<LegMode, () => string> = {
  flight: () => L("Uçak", "Plane"),
  train: W.train,
  bus: W.bus,
  ferry: W.ferry,
  metro: () => L("Metro", "Metro"),
  taxi: () => L("Taksi", "Taxi"),
  transfer: () => L("Özel transfer", "Private transfer"),
  car: () => L("Araba", "Car"),
  walk: () => L("Yürüyerek", "On foot"),
};

const MEALS: Record<string, () => string> = {
  breakfast: () => L("Kahvaltı", "Breakfast"),
  lunch: () => L("Öğle yemeği", "Lunch"),
  dinner: () => L("Akşam yemeği", "Dinner"),
  coffee: () => L("Kahve", "Coffee"),
  sweet: () => L("Tatlı", "Dessert"),
  bar: () => L("Bar", "Drinks"),
};

/** An idea's kind in one word ("Pazar & alışveriş" is "Alışveriş" on a line). */
const IDEA_WORDS: Record<IdeaKind, () => string> = {
  view: () => L("Manzara", "View"),
  culture: () => L("Kültür", "Culture"),
  nature: () => L("Doğa", "Nature"),
  shop: () => L("Alışveriş", "Shopping"),
  walk: () => L("Gezinti", "Walk"),
  fun: () => L("Eğlence", "Fun"),
  coffee: MEALS.coffee,
  lunch: MEALS.lunch,
  dinner: MEALS.dinner,
  sweet: MEALS.sweet,
  bar: MEALS.bar,
};

const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

type Experience = "boat" | "show" | "museum" | "tour" | "event";
// First match wins: a boat tour is a boat tour before it's a tour.
const EXPERIENCE_WORDS: [Experience, RegExp][] = [
  ["boat", /tekne|\bboat|cruise|cruzeiro|\byat\b|yacht|yelken|\bsail|gulet|rabelo|catamaran|katamaran/],
  ["show", /gosteri|\bshow|konser|concert|tiyatro|theat|\bfado|opera|\bbale\b|ballet|performans|performance|musical|muzikal|flamenko|flamenco/],
  ["museum", /muze|museum|museu|museo|musee|galeri|gallery|galeria/],
  ["tour", /\btur\b|turu|\btour|rehberli|guided|mahzen|cellar|tadim|tasting|excursion|gezisi|safari/],
];
/** The words of each kind that the name needn't repeat, longest first. */
const LABEL_WORDS: Record<Experience, string[]> = {
  boat: ["tekne turu", "tekne gezisi", "boat tour", "boat trip", "river cruise", "cruise", "tekne"],
  show: ["gösterisi", "gösteri", "show"],
  museum: ["müzesi", "müze", "museum"],
  tour: ["guided tour", "walking tour", "turu", "tour", "tur"],
  event: ["etkinliği", "etkinlik", "event"],
};
const EXPERIENCE_LABEL: Record<Experience, () => string> = { boat: W.boat, show: W.show, museum: W.museum, tour: W.tour, event: W.event };

function experienceOf(item: Pick<Item, "name" | "optionDetail" | "summary">): Experience {
  const text = fold([item.name, item.optionDetail, item.summary].filter(Boolean).join(" "));
  return EXPERIENCE_WORDS.find(([, re]) => re.test(text))?.[0] ?? "event";
}

/**
 * The name without its kind's word ("Douro nehri tekne turu" → "Douro nehri", "Boat tour: Douro" → "Douro"): at
 * its end, or at its start before a separator. When what's left isn't a name (under 2 letters), the whole name.
 */
export function withoutWord(name: string, words: readonly string[]): string {
  const text = name.trim();
  const low = text.toLocaleLowerCase("tr");
  const meaningful = (rest: string) => {
    const r = rest.replace(/^[\s:\-–—·|,]+|[\s:\-–—·|,]+$/g, "");
    return r.length >= 2 && /\p{L}/u.test(r) ? r : null;
  };
  for (const w of words) {
    if (low.endsWith(` ${w}`)) {
      const rest = meaningful(text.slice(0, text.length - w.length));
      if (rest) return rest;
    }
    const lead = low.match(new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-–—·|]\\s*`));
    if (lead) {
      const rest = meaningful(text.slice(lead[0].length));
      if (rest) return rest;
    }
  }
  return text;
}

// --- what's left to do, at the end of the grey line ------------------------------------------------------

/** The row's own words of what's left ("bilet alınmadı", "2 seçenek · karar ver"); nothing once done. */
const left = (row: DayRow): string | null =>
  (row.state === "pending" || row.state === "decide" || row.state === "open") && row.status ? lowerFirst(row.status) : null;

function legLeft(leg: Leg): string | null {
  switch (leg.status) {
    case "booked":
      return null;
    case "chosen":
      return L("rezerve edilmedi", "not booked");
    case "planned":
      return leg.choice?.mode && BOOKABLE.includes(leg.choice.mode) && !leg.options.some((i) => i.origin === "chat") ? L("rezerve edilmedi", "not booked") : L("planlandı", "planned");
    case "options":
      return nOptions(leg.options.length);
    default:
      return L("planlanmadı", "not planned");
  }
}

const duration = (item: Item | null) => {
  const m = item ? metricsOf(item).durationMinutes : null;
  return m ? hoursMinutes(m) : null;
};

const area = (item: Item | null) => item?.location.area?.trim() || null;

// --- each kind ------------------------------------------------------------------------------------------

type Flight = NonNullable<Item["flight"]>;

/** "varış 12:35", "varış 01:35 (+1)" when it lands the next day. */
function arrives(f: Flight): string | null {
  const at = clockOf(f.arrival);
  if (!at) return null;
  const nextDay = f.arrival && f.departure && f.arrival.slice(0, 10) > f.departure.slice(0, 10);
  return L(`varış ${at}`, `arrives ${at}`) + (nextDay ? " (+1)" : "");
}

/** The trip's word by its way: Uçuş, Tren, Otobüs, Vapur; anything else (a taxi, a car) between cities is a transfer. */
function tripWord(mode: LegMode | "minibus" | null): string | null {
  switch (mode) {
    case "flight":
      return W.flight();
    case "train":
      return W.train();
    case "bus":
    case "minibus":
      return W.bus();
    case "ferry":
      return W.ferry();
    default:
      return null;
  }
}

/** A flight, a train, a bus or a ferry between two places (or a change of city by car or taxi). */
function tripTitle(row: DayRow): RowTitle {
  const e = row.entry?.kind === "travel" ? row.entry : null;
  const t = e?.travel ?? null;
  const item = t?.settled ?? (t?.items.length === 1 ? t.items[0] : null) ?? (row.item && (row.item.category === "flight" || row.item.category === "transport") ? row.item : null);
  const f = item?.flight ?? null;
  const said = item ? transportMode(item) : null;
  const mode = (item?.category === "flight" ? "flight" : null) ?? (said === "minibus" ? "minibus" : null) ?? t?.mode ?? e?.leg?.choice?.mode ?? e?.leg?.mode ?? (said && said in WAY ? (said as LegMode) : null) ?? (e && e.role !== "move" ? "flight" : null);
  const word = tripWord(mode);
  // A change of city by its two cities (the trip's own words: "Porto → Madeira"); else the airports' cities.
  const which =
    e?.role === "move" && e.leg
      ? `${e.leg.from.city ?? e.leg.from.label} → ${e.leg.to.city ?? e.leg.to.label}`
      : f?.from && f.to
        ? `${placeName(f.from)} → ${placeName(f.to, item?.city ?? null)}`
        : routeOf(e?.subtitle) || (item ? simpleName(item.name) : "");
  const status = left(row);
  if (mode === "flight") {
    const airports = f?.from && f.to ? `${airportName(f.from)} → ${airportName(f.to)}` : null;
    return { what: W.flight(), which, detail: join([airports, f && arrives(f), f?.flightNumber, status]) };
  }
  if (word) {
    // The stations when they say more than the cities; else who runs it ("CP Alfa Pendular", "FlixBus").
    const stations = f?.from && f.to && !isCode(f.from) && `${f.from} → ${f.to}` !== which ? `${f.from} → ${f.to}` : null;
    const operator = !stations && item ? simpleName(item.name) : null;
    return { what: word, which, detail: join([stations ?? (operator && !which.includes(operator) ? operator : null), f && arrives(f), duration(item), status]) };
  }
  // Between cities by car, taxi or a transfer: the transfer's word, the way in grey.
  const way = mode && mode in WAY ? WAY[mode as LegMode]() : null;
  return { what: W.transfer(), which, detail: join([way, item ? simpleName(item.name) : null, status]) };
}

/** A transfer within a city: to or from the airport (Havalimanı transferi), else Transfer; its way as HANGİSİ. */
function legTitle(row: DayRow, leg: Leg): RowTitle {
  const item = legItem(leg);
  const said = item ? transportMode(item) : null;
  const mode: LegMode | null = leg.mode ?? leg.choice?.mode ?? (said === "taxi" ? "taxi" : said && said in WAY ? (said as LegMode) : null);
  const airport = leg.via === "flight" || [leg.from.label, leg.to.label].some((l) => /havaliman|airport|aeroporto|aeropuerto/i.test(l));
  const hubWord = (first: boolean) => (first ? L("Havalimanı", "Airport") : L("havalimanı", "airport"));
  // The airport end in a word, the stay by its short name, a station by its own ("Porto Campanhã").
  const end = (p: Leg["from"], hub: boolean, first: boolean) => (hub && leg.via === "flight" ? hubWord(first) : simpleName(p.item?.name ?? p.label));
  const ends = `${end(leg.from, leg.kind === "arrival", true)} → ${end(leg.to, leg.kind === "departure", false)}`;
  return {
    what: airport ? W.airportTransfer() : W.transfer(),
    which: mode ? WAY[mode]() : "",
    detail: join([leg.kind === "move" ? `${leg.from.city ?? leg.from.label} → ${leg.to.city ?? leg.to.label}` : ends, duration(item), legLeft(leg)]),
  };
}

function stayTitle(row: DayRow, checkIn: boolean): RowTitle {
  const s = row.stay;
  const which = simpleName(s?.name ?? row.sub ?? "");
  if (!s) return { what: checkIn ? "Check-in" : "Check-out", which, detail: "" };
  const rule = s.rule ? (checkIn ? L(`${fromTime(s.rule)} itibaren`, `from ${s.rule}`) : L(`${toTime(s.rule)} kadar`, `until ${s.rule}`)) : null;
  return {
    what: checkIn ? "Check-in" : "Check-out",
    which,
    detail: join([rule, checkIn && s.nights > 0 ? nNights(s.nights) : null, s.placed ? null : L("yer seçilmedi", "no place chosen")]),
  };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

function rentalTitle(row: DayRow, returning: boolean): RowTitle {
  const r = row.rental!;
  const items = r.group.items;
  const lead = items.find((i) => i.status === "booked") ?? items.find((i) => i.status === "chosen") ?? null;
  const which = lead ? simpleName(lead.name) : items.length === 1 ? simpleName(items[0].name) : nOptions(items.length);
  const place = area(lead) ?? lead?.city ?? null;
  const days = r.end && r.end !== r.date ? daysBetween(r.date, r.end) : 0;
  return {
    what: returning ? W.carReturn() : W.carPickUp(),
    which,
    detail: join([place, !returning && days > 0 ? nDays(days) : null, returning ? null : left(row)]),
  };
}

/** A meal by its slot, else by its hour, else by the kind the traveller gave it, else "Yemek". */
function mealWord(item: Item, time: string | null): string {
  if (item.meal && MEALS[item.meal]) return MEALS[item.meal]();
  if (time) {
    const m = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    return (m < 11 * 60 ? MEALS.breakfast : m < 15 * 60 ? MEALS.lunch : m < 17 * 60 + 30 ? MEALS.coffee : MEALS.dinner)();
  }
  // A kind read from its words (a café, a bar, sweets); "dinner" with no words is only the default.
  const kind = ideaKindOf(item);
  if (kind && MEALS[kind] && (kind !== "dinner" || item.ideaKind === "dinner")) return MEALS[kind]();
  return W.meal();
}

function rating(item: Item): string | null {
  const { value, scale } = item.rating;
  if (value == null || (scale != null && scale !== 5)) return null;
  return `★ ${value.toLocaleString(L("tr-TR", "en-GB"), { maximumFractionDigits: 1 })}`;
}

function itemTitle(row: DayRow, item: Item): RowTitle {
  const time = row.time ?? row.freed ?? null;
  const done = item.doneAt ? L("yapıldı", "done") : null;
  if (item.category === "flight" || (item.category === "transport" && tripWord(transportMode(item) as LegMode | "minibus" | null))) return tripTitle(row);
  if (item.category === "stay") return { what: "Check-in", which: simpleName(item.name), detail: join([area(item), left(row)]) };
  if (item.category === "food") {
    return { what: mealWord(item, time), which: simpleName(item.name), detail: join([area(item), rating(item), done, left(row)]) };
  }
  if (item.category === "transport") {
    const said = transportMode(item);
    const way = said === "taxi" ? WAY.taxi() : said && said in WAY ? WAY[said as LegMode]() : simpleName(item.name);
    return { what: W.transfer(), which: way, detail: join([said ? simpleName(item.name) : null, left(row)]) };
  }
  // An idea (nothing to book): its kind from the idea pool.
  if (isIdea(item)) {
    const kind = ideaKindOf(item);
    return { what: kind ? IDEA_WORDS[kind]() : W.event(), which: simpleName(item.name), detail: join([area(item), done ?? L("fikir", "idea")]) };
  }
  const kind = experienceOf(item);
  const guests = item.guests.adults ? count(item.guests.adults + (item.guests.children ?? 0), "kişi", "person", "people") : null;
  const ticket = row.state === "pending" ? L("bilet alınmadı", "no ticket yet") : left(row);
  return {
    what: EXPERIENCE_LABEL[kind](),
    which: withoutWord(simpleName(item.name), LABEL_WORDS[kind]),
    detail: join([area(item), duration(item), guests, done ?? ticket]),
  };
}

/**
 * A line's title in the standard: NE (fixed word) · HANGİSİ (only what's particular) and its grey line. Every
 * kind of line in Liste and Kartlar is titled here; what isn't known is "Etkinlik" with its own name.
 */
export function rowTitle(row: DayRow): RowTitle {
  if (row.layover) {
    const where = placeName(row.layover.airport, row.layover.city) ?? row.layover.airport;
    return { what: W.layover(), which: `${where} · ${hoursMinutes(row.layover.minutes)}`, detail: "" };
  }
  if (row.key.endsWith(":checkin")) return stayTitle(row, true);
  if (row.key.endsWith(":checkout")) return stayTitle(row, false);
  if (row.rental) return rentalTitle(row, row.key.endsWith(":return"));
  if (row.kind === "travel") return tripTitle(row);
  if (row.leg) return legTitle(row, row.leg);
  if (row.item) return itemTitle(row, row.item);
  if (row.kind === "ideas") return { what: W.event(), which: row.title, detail: L("fikir", "idea") };
  return { what: W.event(), which: row.title.replace(/^✓\s*/, ""), detail: row.sub ?? "" };
}

// --- a connection between two flights ---------------------------------------------------------------------

function flightOf(row: DayRow): { flight: Flight; item: Item } | null {
  const e = row.entry?.kind === "travel" ? row.entry : null;
  const item = e ? (e.travel?.settled ?? (e.travel?.items.length === 1 ? e.travel.items[0] : null)) : row.item;
  return item?.category === "flight" && item.flight ? { flight: item.flight, item } : null;
}

const instant = (iso: string) => Date.parse(`${iso.slice(0, 16)}Z`);

/**
 * The day's lines with a quiet "Aktarma" line between two flights that connect: the first lands where the
 * second leaves from, and the second leaves within a day; how long between is worked out from the two.
 */
export function withLayovers(rows: DayRow[]): DayRow[] {
  const out: DayRow[] = [];
  rows.forEach((r, i) => {
    out.push(r);
    const a = flightOf(r);
    const b = rows[i + 1] ? flightOf(rows[i + 1]) : null;
    if (!a || !b || !a.flight.to || !a.flight.arrival || !b.flight.departure) return;
    if (a.flight.to.toUpperCase() !== b.flight.from?.toUpperCase()) return;
    const minutes = Math.round((instant(b.flight.departure) - instant(a.flight.arrival)) / 60_000);
    if (!(minutes > 0 && minutes < 24 * 60)) return;
    out.push({
      key: `layover:${r.key}`,
      kind: "info",
      time: clockOf(a.flight.arrival),
      estimated: false,
      hint: null,
      otherDay: null,
      title: W.layover(),
      sub: null,
      line: null,
      state: "info",
      status: "",
      notes: [],
      entry: null,
      leg: null,
      item: null,
      items: [],
      rental: null,
      stayKey: null,
      layover: { airport: a.flight.to, city: a.item.city, minutes },
    });
  });
  return out;
}
