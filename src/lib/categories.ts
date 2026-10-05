// The Plan by category (spec 0.34, docs/superpowers/specs/2026-10-05-034-kategoriler-design.md): every
// block and record of the trip goes in exactly one of seven sections — Uçuş, Konaklama, Ulaşım, Etkinlikler,
// Yapılacak şeyler, Restoranlar, Diğer — and inside a section in date order (then time), the undated last by
// city. The blocks themselves are the ones the plan's front always had (timeline.ts board): this only sorts
// them into sections and says where each stands, for the header's bar and its "3/4" (settled of all), and lists
// what's out of the way (ruled out, closed by a booking, "Gerek yok") at the end of its own section. Pure:
// derived on every render, nothing stored but which sections the traveller opened.
import { cityOfAirport } from "./airports";
import { isIdea, needsBooking } from "./booking";
import { legTransportMode, TICKET_MODES, transportMode } from "./cardKinds";
import { L } from "./i18n";
import { nNights } from "./i18nText";
import { shortDay } from "./ideas";
import { formatDateRange, isoDate } from "./items";
import { legItem, legShortTitle, type Leg } from "./legs";
import { cityKeyOf, departureDay, sameCity, type DateRange, type OptionGroup, type Plan } from "./plan";
import { hiddenNights, nightsKey, toBook, type Timeline, type TimelineEntry } from "./timeline";
import { isInsurance, itemText } from "./travelKinds";
import type { Item } from "./types";

export type SectionId = "flight" | "stay" | "transport" | "activity" | "todo" | "food" | "other";
export const SECTION_ORDER: readonly SectionId[] = ["flight", "stay", "transport", "activity", "todo", "food", "other"];

/** Where a block stands: settled, chosen but not bought, options to pick from, nothing yet, an idea with no day. */
export type EntryState = "done" | "book" | "decide" | "empty" | "unscheduled";

/** What a section entry draws: a block of the plan's front, options with no block, or one record. */
export type CatPiece =
  | { kind: "entry"; entry: TimelineEntry }
  | { kind: "group"; group: OptionGroup; subtitle: string | null }
  /** `siblings`: the options it's compared with; `settled`: drawn as decided (chosen or booked). */
  | { kind: "item"; item: Item; siblings: Item[]; settled: boolean };

/** An entry in one line (kategoriler-v2 .row): ring · name · city · date · time · price · status: the entry summed up in one line. */
export interface CollapsedRow {
  ring: "open" | "half" | "yes";
  name: string;
  meta: string;
  price: { amount: number; currency: string | null } | null;
  status: string;
  ok: boolean;
}

export interface CatEntry {
  /** Unique within the plan; the DOM id of its card wrapper comes from it. */
  key: string;
  section: SectionId;
  piece: CatPiece;
  date: string | null;
  time: string | null;
  city: string | null;
  /** The timeline entry it draws (the itinerary and the to-dos find it by this), else null. */
  domKey: string | null;
  /** What a to-do or the itinerary may point at: timeline entry keys, transfer keys, record ids. */
  entryKeys: string[];
  legKeys: string[];
  itemIds: string[];
  state: EntryState;
  /** Empty nights in it (a stay): the header says "2 gece boş". */
  nights: number;
  /** A ticket is bought for it (a flight, a train, a tour): "bilet yok", else "rezerve edilmedi". */
  ticket: boolean;
  row: CollapsedRow;
  /** Its place on the plan's front (ties within a day keep that order). */
  seq: number;
  /** When its first record was saved: the undated keep the order they were saved in. */
  created: number;
}

/** A day of a section's timeline (one date label over its cards), or an undated city ("Tarihsiz"). */
export interface DayGroup {
  key: string;
  date: string | null;
  city: string | null;
  entries: CatEntry[];
}

export interface CatSection {
  id: SectionId;
  entries: CatEntry[];
  days: DayGroup[];
  /** The header's pill: amber while something's left ("1 karar bekliyor"), green once all is done ("✓ 3 alındı"). */
  status: { text: string; tone: "wait" | "done" } | null;
  /**
   * How many of its entries are settled, for the header's "3/4": booked, bought, arranged, installed, or
   * planned where nothing needs booking (a taxi); a to-do done or on a day; a restaurant on a day or booked.
   */
  settled: number;
  /** First look: open while something's left, closed once all is done. */
  open: boolean;
  /** What belongs here but is out of the way (kategoriler-v4): behind "Gizlenenler · N göster" at the section's end. */
  hidden: HiddenThing[];
}

/**
 * Out of the plan, one tap from coming back: a record ruled out ("Ele"), an option a booking closed, a
 * transfer or nights said not needed ("Gerek yok"). `key` is unique across the plan.
 */
export type HiddenThing =
  | { kind: "dismissed"; key: string; section: SectionId; item: Item }
  | { kind: "closed"; key: string; section: SectionId; item: Item; reason: string }
  | { kind: "leg"; key: string; section: SectionId; leg: Leg }
  | { kind: "nights"; key: string; section: SectionId; range: DateRange; city: string | null };

const time = (iso: string | null | undefined): string | null => {
  const t = iso?.slice(11, 16) ?? null;
  return t && /^\d{2}:\d{2}$/.test(t) ? t : null;
};
const hhmm = (t: string | null | undefined): string | null => (t && /^\d{2}:\d{2}$/.test(t) ? t : null);
const decided = (i: Item) => i.status === "chosen" || i.status === "booked";

/** A record's section, by what it is: a flight, a place to stay, getting around, something to book or to do, a meal, insurance and internet. */
export function sectionOfItem(item: Item): SectionId {
  switch (item.category) {
    case "flight":
      return "flight";
    case "stay":
      return "stay";
    case "transport":
      return isInsurance(item) ? "other" : "transport";
    case "esim":
      return "other";
    case "food":
      return "food";
    case "activity":
      return needsBooking(item) ? "activity" : "todo";
    default:
      if (isInsurance(item) || /\besim\b|e-sim|sim kart/i.test(itemText(item))) return "other";
      return needsBooking(item) ? "activity" : "todo";
  }
}

/** A block of the plan's front: every flight under Uçuş (a missing one, a change of city by plane); transfers, trains, cars under Ulaşım. */
function sectionOfEntry(entry: TimelineEntry): SectionId {
  switch (entry.kind) {
    case "travel": {
      if (entry.travel) return entry.travel.group.category === "flight" ? "flight" : "transport";
      // A change of city with no ticket saved yet: Uçuş when it goes by plane (its card says "Uçuş"), else Ulaşım.
      if (entry.leg) return legByPlane(entry.leg) ? "flight" : "transport";
      return "flight";
    }
    case "stay":
      return "stay";
    case "event":
      return sectionOfItem(entry.item);
    case "leg":
      return legByPlane(entry.leg) ? "flight" : "transport";
    case "rental":
    case "day":
    case "plan":
      return "transport";
  }
}

/** Its card's kind is "Uçuş" (cardView.legCardView): the way picked, else what's settled for it. All flights are under Uçuş. */
function legByPlane(leg: Leg): boolean {
  const mode = legTransportMode(leg.choice?.mode ?? leg.mode);
  if (mode) return mode === "flight";
  const settled = legItem(leg);
  return Boolean(settled && transportMode(settled) === "flight");
}

/** As its card says it (cardView.legCardView): arranged is done; a change of city by ticket still to buy; planned is done. */
const LEG_TICKETS: readonly string[] = ["flight", "train", "bus", "ferry"];
const legBooked = (leg: Leg) => leg.status === "booked" || Boolean(leg.choice?.booked);
function legState(leg: Leg): EntryState {
  if (legBooked(leg)) return "done";
  if (leg.status === "options") return "decide";
  const mode = leg.choice?.mode ?? leg.mode;
  const planned = mode != null || leg.status === "chosen" || leg.status === "planned";
  if (!planned) return "empty";
  return leg.kind === "move" && mode != null && LEG_TICKETS.includes(mode) ? "book" : "done";
}

/** Booked (or an eSIM chosen and put in: "Kurdum") is done; chosen is still to buy; else options to pick from. */
const settledState = (items: Item[]): EntryState =>
  items.some((i) => i.status === "booked" || (i.status === "chosen" && i.installedAt)) ? "done" : items.some((i) => i.status === "chosen") ? "book" : "decide";

/** The eSIM put in ("Kurdum") is done like a booking. */
const itemState = (item: Item): EntryState => {
  if (isIdea(item)) return item.doneAt || isoDate(item.dates.start) ? "done" : "unscheduled";
  if (item.status === "booked" || (item.installedAt && decided(item))) return "done";
  if (item.status === "chosen") return needsBooking(item) ? "book" : "done";
  return "decide";
};

function entryState(entry: TimelineEntry): EntryState {
  switch (entry.kind) {
    case "travel": {
      const t = entry.travel;
      if (entry.leg?.choice?.booked) return "done";
      if (t) return t.settled ? (t.settled.status === "booked" ? "done" : "book") : "decide";
      return entry.leg ? legState(entry.leg) : "empty";
    }
    case "leg":
      return legState(entry.leg);
    case "stay": {
      const b = entry.block;
      if (b.kind === "booked") return "done";
      if (b.kind === "chosen") return "book";
      return b.groups.length ? "decide" : "empty";
    }
    case "event":
      return itemState(entry.item);
    case "rental":
      return settledState(entry.group.items);
    default:
      return "decide";
  }
}

/** Every record a block draws (its options, the stay booked and any clash, a said stay). */
function itemsOfEntry(entry: TimelineEntry): Item[] {
  switch (entry.kind) {
    case "travel":
      return entry.travel?.items ?? [];
    case "leg":
      return entry.leg.options;
    case "stay": {
      const b = entry.block;
      if (b.kind === "booked") return [b.item, ...(b.clashes ?? [])];
      return [...(b.kind === "chosen" ? [b.item] : []), ...b.groups.flatMap((g) => g.items), ...(b.slot ? [b.slot] : [])];
    }
    case "event":
      return [entry.item];
    case "rental":
      return entry.group.items;
    case "plan":
    case "day":
      return entry.items;
  }
}

const best = (items: Item[]): Item | null => items.find((i) => i.status === "booked") ?? items.find((i) => i.status === "chosen") ?? null;
const cheapest = (items: Item[]): Item | null =>
  [...items].filter((i) => i.price.amount != null).sort((a, b) => a.price.amount! - b.price.amount!)[0] ?? null;
/** The one that stands for a block's options in its row: the chosen, else the one its card shows first (best ranked, else cheapest). */
/** Each option's place in its decision, best first (the order its card shows them in). */
export type Ranking = ReadonlyMap<string, number>;
const lead = (items: Item[], rank: Ranking): Item | null =>
  best(items) ??
  [...items].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || (a.price.amount ?? Infinity) - (b.price.amount ?? Infinity))[0] ??
  null;
const priceOf = (items: Item[], rank: Ranking) => {
  const i = lead(items, rank);
  return i && i.price.amount != null ? { amount: i.price.amount, currency: i.price.currency } : null;
};
/** "İstanbul → Porto" from a flight's ends (airport codes read as their city). */
const routeOf = (i: Item | null | undefined): string | null => {
  const f = i?.flight;
  return f?.from && f.to ? `${cityOfAirport(f.from)} → ${cityOfAirport(f.to)}` : null;
};
const mostCommon = (values: (string | null)[]): string | null => {
  const counts = new Map<string, { value: string; n: number }>();
  for (const v of values) {
    const k = cityKeyOf(v);
    if (!k) continue;
    const c = counts.get(k) ?? { value: v!, n: 0 };
    c.n++;
    counts.set(k, c);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.value ?? null;
};

interface Where {
  date: string | null;
  time: string | null;
  city: string | null;
  /** A stretch (a stay, a rental): its dates in the closed row. */
  end?: string | null;
}

function whereOfEntry(entry: TimelineEntry, rank: Ranking): Where {
  switch (entry.kind) {
    case "travel": {
      const i = entry.travel ? (entry.travel.settled ?? lead(entry.travel.items, rank)) : null;
      const f = i?.flight;
      const city =
        entry.role === "departure"
          ? (entry.leg?.from.city ?? (f?.from ? cityOfAirport(f.from) : null))
          : (entry.leg?.to.city ?? (f?.to ? cityOfAirport(f.to) : null) ?? i?.city ?? null);
      return { date: entry.date, time: time(f?.departure) ?? (entry.leg ? hhmm(entry.leg.after) : null), city };
    }
    case "leg":
      return { date: entry.date, time: hhmm(entry.leg.before) ?? hhmm(entry.leg.after), city: entry.leg.to.city ?? entry.leg.from.city };
    case "stay":
      return { date: entry.block.range.start, time: null, city: entry.block.city, end: entry.block.range.end };
    case "event":
      return { date: entry.date, time: time(entry.item.flight?.departure), city: entry.item.city };
    case "rental":
      return { date: entry.date, time: null, city: entry.group.items[0]?.city ?? null, end: entry.end };
    default:
      return { date: entry.date, time: null, city: null };
  }
}

const whereOfItem = (item: Item): Where => ({ date: departureDay(item), time: time(item.flight?.departure), city: item.city });

function whereOfGroup(group: OptionGroup, rank: Ranking): Where {
  const days = group.items.map(departureDay).filter((d): d is string => Boolean(d)).sort();
  const first = lead(group.items, rank);
  const f = first?.flight;
  const city = group.category === "flight" ? (f?.to ? cityOfAirport(f.to) : null) : mostCommon(group.items.map((i) => i.city));
  if (group.category === "stay") return { date: group.range?.start ?? null, time: null, city, end: group.range?.end ?? null };
  if (group.category === "esim") return { date: null, time: null, city: null };
  return { date: days[0] ?? null, time: time(f?.departure), city };
}

function nameOf(piece: CatPiece, rank: Ranking): string {
  if (piece.kind === "item") return piece.item.name;
  if (piece.kind === "group") {
    const i = lead(piece.group.items, rank);
    return (piece.group.category === "flight" ? routeOf(i) : null) ?? i?.name ?? L("Seçenekler", "Options");
  }
  const e = piece.entry;
  switch (e.kind) {
    case "travel": {
      const i = e.travel ? (e.travel.settled ?? lead(e.travel.items, rank)) : null;
      // A change of city by its cities ("Porto → Lizbon"), not its stations; a flight by its airports' cities.
      if (e.leg) return legShortTitle(e.leg);
      if (i) return routeOf(i) ?? i.name;
      return e.role === "departure" ? L("Dönüş uçuşu", "Flight home") : L("Gidiş uçuşu", "Flight out");
    }
    case "leg":
      return legShortTitle(e.leg);
    case "stay": {
      const b = e.block;
      if (b.kind !== "open") return b.item.name;
      return b.slot?.name ?? (b.groups.length ? (b.city ? L(`${b.city} konaklaması`, `Stay in ${b.city}`) : L("Konaklama", "Stay")) : L("Konaklama yok", "No stay yet"));
    }
    case "event":
      return e.item.name;
    case "rental":
      return lead(e.group.items, rank)?.name ?? L("Araç kiralama", "Car rental");
    default:
      return e.items.map((i) => i.name).join(", ");
  }
}

/** A ticket is bought for a flight, a tour, a train, a bus, a ferry; a room, a table, a taxi is booked; insurance and an eSIM bought. */
function ticketOf(section: SectionId, items: Item[], leg: Leg | null): boolean {
  if (section === "flight" || section === "activity") return true;
  if (section !== "transport") return false;
  const ticketMode = (m: string | null | undefined) => (TICKET_MODES as readonly string[]).includes(m ?? "");
  return items.some((i) => ticketMode(transportMode(i))) || ticketMode(leg?.choice?.mode ?? leg?.mode);
}

const bookWord = (section: SectionId, ticket: boolean): string =>
  ticket ? L("Bilet yok", "No ticket") : section === "other" ? L("Satın alınmadı", "Not bought") : L("Rezerve edilmedi", "Not booked");

function rowStatus(section: SectionId, state: EntryState, items: Item[], options: number, ticket: boolean, leg: Leg | null): { status: string; ok: boolean } {
  switch (state) {
    case "done": {
      if (leg && legBooked(leg) && !items.some((i) => i.status === "booked")) return { status: ticket ? L("Alındı", "Booked") : L("Ayarlandı", "Arranged"), ok: true };
      if (section === "todo" || (section === "food" && items.every(isIdea))) {
        return { status: items.some((i) => i.doneAt) ? L("Yapıldı", "Done") : L("Güne eklendi", "On a day"), ok: true };
      }
      const booked = items.some((i) => i.status === "booked");
      if (!booked) return { status: items.some((i) => i.installedAt) ? L("Kuruldu", "Installed") : L("Planlandı", "Planned"), ok: true };
      return { status: section === "stay" || section === "food" ? L("Rezerve", "Booked") : L("Alındı", "Booked"), ok: true };
    }
    case "book":
      return { status: bookWord(section, ticket), ok: false };
    case "decide":
      return { status: options >= 2 ? L(`${options} seçenek`, `${options} options`) : L("Karar", "Decide"), ok: false };
    case "empty":
      return { status: section === "stay" ? L("Boş", "Empty") : section === "flight" ? L("Eklenmedi", "Not added") : L("Planlanmadı", "Not planned"), ok: false };
    case "unscheduled":
      return { status: L("Güne eklenmedi", "No day yet"), ok: false };
  }
}

const RING: Record<EntryState, CollapsedRow["ring"]> = { done: "yes", book: "half", decide: "open", empty: "open", unscheduled: "open" };

function metaOf(section: SectionId, where: Where, piece: CatPiece): string {
  const when = where.date
    ? where.end && where.end !== where.date
      ? formatDateRange(where.date, where.end)
      : shortDay(where.date)
    : section === "other"
      ? L("Tüm gezi", "Whole trip")
      : L("tarih yok", "no date");
  const extra = piece.kind === "entry" && piece.entry.kind === "stay" ? nNights(piece.entry.block.nights) : null;
  return [where.city, when, where.time, extra].filter(Boolean).join(" · ");
}

interface Draft {
  key: string;
  section: SectionId;
  piece: CatPiece;
  where: Where;
  domKey: string | null;
  entryKeys: string[];
  legKeys: string[];
  items: Item[];
  state: EntryState;
  nights: number;
}

function finish(d: Draft, seq: number, rank: Ranking): CatEntry {
  const options = new Set(d.items.map((i) => i.id)).size;
  const leg = d.piece.kind === "entry" ? (d.piece.entry.kind === "leg" ? d.piece.entry.leg : d.piece.entry.kind === "travel" ? d.piece.entry.leg : null) : null;
  const ticket = ticketOf(d.section, d.items, leg);
  const { status, ok } = rowStatus(d.section, d.state, d.items, options, ticket, leg);
  return {
    key: d.key,
    section: d.section,
    piece: d.piece,
    date: d.where.date,
    time: d.where.time,
    city: d.where.city,
    domKey: d.domKey,
    entryKeys: d.entryKeys,
    legKeys: d.legKeys,
    itemIds: [...new Set(d.items.map((i) => i.id))],
    state: d.state,
    nights: d.nights,
    ticket,
    row: { ring: RING[d.state], name: nameOf(d.piece, rank), meta: metaOf(d.section, d.where, d.piece), price: priceOf(d.items, rank), status, ok },
    seq,
    created: Math.min(...d.items.map((i) => i.createdAt), Number.MAX_SAFE_INTEGER),
  };
}

/** The plan's front in order: the blocks of each section of the board (a city's stays, then its days' blocks). */
function boardEntries(timeline: Timeline): TimelineEntry[] {
  return timeline.board.flatMap((s) => (s.kind === "travel" ? [s.entry] : s.kind === "city" ? [...s.stays, ...s.entries] : s.entries));
}

/** The city slept in on a date (the last day: the last city), for a day's label. */
export function cityOfNight(plan: Pick<Plan, "range" | "stayBlocks">, date: string): string | null {
  const block = plan.stayBlocks.find((b) => b.range.start <= date && date < b.range.end);
  if (block) return block.city;
  return plan.range && date === plan.range.end ? (plan.stayBlocks.at(-1)?.city ?? null) : null;
}

export interface CategorizeInput {
  plan: Plan;
  timeline: Timeline;
  items: Item[];
  /** The trip's transfers and what the traveller hid: a hidden transfer's options wait with it under Gizlenenler. */
  legs?: Leg[];
  hidden?: Set<string>;
  /** Each option's place in its decision (useDecisions), so a row names the option its card shows first. */
  rank?: Ranking;
}

/**
 * Every block and record of the trip in its section. The front's blocks first (as they always were drawn),
 * then what has no block: options with no day (another flight, a stay outside the dates, an eSIM), what
 * needs booking without a block of its own, and the ideas. A record already drawn is never drawn twice.
 */
export function categorize({ plan, timeline, items, legs = [], hidden = new Set(), rank = new Map() }: CategorizeInput): CatSection[] {
  const drafts: Draft[] = [];
  const drawn = new Set<string>();
  const closed = new Set(plan.closed.map((c) => c.item.id));
  const withHiddenLeg = new Set(legs.filter((l) => l.kind !== "move" && hidden.has(`leg:${l.key}`)).flatMap((l) => l.options.map((i) => i.id)));
  const mark = (list: Item[]) => list.forEach((i) => drawn.add(i.id));

  for (const entry of boardEntries(timeline)) {
    // Nights marked "Gerek yok" leave the plan; they wait under Gizlenenler with "Geri getir".
    if (entry.kind === "stay" && entry.skipped) continue;
    if (entry.kind === "plan" || entry.kind === "day") {
      // Plans for a city without a day: each record in its own section, as one decided card or its options.
      entry.items.forEach((item, n) => {
        if (drawn.has(item.id)) return;
        const siblings = entry.items.filter((x) => x.needKey === item.needKey);
        drafts.push({
          key: `${entry.key}:${item.id}`,
          section: sectionOfItem(item),
          piece: { kind: "item", item, siblings, settled: decided(item) },
          where: { ...whereOfItem(item), city: item.city ?? (entry.kind === "plan" ? entry.city : null) },
          domKey: n === 0 ? entry.key : null,
          entryKeys: [entry.key],
          legKeys: [],
          items: [item],
          state: itemState(item),
          nights: 0,
        });
        drawn.add(item.id);
      });
      continue;
    }
    const list = itemsOfEntry(entry);
    const state = entryState(entry);
    drafts.push({
      key: entry.key,
      section: sectionOfEntry(entry),
      piece: { kind: "entry", entry },
      where: whereOfEntry(entry, rank),
      domKey: entry.key,
      entryKeys: [entry.key],
      legKeys: entry.kind === "leg" ? [entry.leg.key] : entry.kind === "travel" && entry.leg ? [entry.leg.key] : [],
      items: list,
      state,
      nights: entry.kind === "stay" && state === "empty" ? entry.block.nights : 0,
    });
    mark(list);
  }

  // Options with no block: flights and transport the line didn't place, stays outside the dates (or all of
  // them without dates), eSIMs.
  const groups: { group: OptionGroup; subtitle: string | null }[] = [
    ...timeline.unplaced.map((g) => ({ group: g, subtitle: g.title })),
    ...plan.looseStays.map((g) => ({ group: g, subtitle: looseSubtitle(plan, g) })),
    ...plan.groups.filter((g) => g.category === "esim").map((g) => ({ group: g, subtitle: g.title })),
  ];
  for (const { group, subtitle } of groups) {
    const list = group.items.filter((i) => !drawn.has(i.id));
    if (!list.length) continue;
    const g = list.length === group.items.length ? group : { ...group, items: list };
    const sections = new Set(list.map(sectionOfItem));
    // A group is one need, so one section: insurance saved as transport goes with the rest of its need.
    const section = sections.size === 1 ? [...sections][0] : group.category === "stay" ? "stay" : group.category === "flight" ? "flight" : group.category === "esim" ? "other" : "transport";
    drafts.push({
      key: `group:${group.key}`,
      section,
      piece: { kind: "group", group: g, subtitle },
      where: whereOfGroup(g, rank),
      domKey: null,
      entryKeys: [],
      legKeys: [],
      items: list,
      state: settledState(list),
      nights: 0,
    });
    mark(list);
  }

  // What needs booking and has no block of its own (no day, or saved for a day and not chosen yet).
  const bookings = toBook(timeline).items;
  for (const item of bookings) {
    if (drawn.has(item.id)) continue;
    drafts.push(itemDraft(item, bookings.filter((x) => x.needKey === item.needKey && !drawn.has(x.id))));
    drawn.add(item.id);
  }

  // The ideas (no booking): to-dos and restaurants, on their day or waiting for one.
  for (const item of items) {
    if (drawn.has(item.id) || closed.has(item.id) || !isIdea(item)) continue;
    drafts.push(itemDraft(item, [item]));
    drawn.add(item.id);
  }

  // Anything else still live (a booking the line couldn't place anywhere): never lost, on its own.
  for (const item of items) {
    if (drawn.has(item.id) || closed.has(item.id) || item.status === "dismissed" || withHiddenLeg.has(item.id)) continue;
    drafts.push({ ...itemDraft(item, [item]), key: `loose:${item.id}` });
    drawn.add(item.id);
  }

  const entries = drafts.map((d, i) => finish(d, i, rank));
  const out = hiddenThings({ plan, timeline, items, legs, hidden });
  return SECTION_ORDER.map((id) => sectionOf(id, entries.filter((e) => e.section === id), plan, out.filter((h) => h.section === id)));
}

/**
 * Everything out of the way, each once, in the section it belongs to: closed options and ruled-out records
 * by what they are, a hidden transfer where its card would be (Ulaşım; Uçuş if by plane), nights under Konaklama.
 */
export function hiddenThings({ plan, timeline, items, legs = [], hidden = new Set() }: Pick<CategorizeInput, "plan" | "timeline" | "items" | "legs" | "hidden">): HiddenThing[] {
  const out: HiddenThing[] = [];
  const listed = new Set<string>();
  for (const { item, reason } of plan.closed) {
    if (listed.has(item.id)) continue;
    listed.add(item.id);
    out.push({ kind: "closed", key: `item:${item.id}`, section: sectionOfItem(item), item, reason });
  }
  for (const item of items) {
    if (item.status !== "dismissed" || listed.has(item.id)) continue;
    listed.add(item.id);
    out.push({ kind: "dismissed", key: `item:${item.id}`, section: sectionOfItem(item), item });
  }
  for (const leg of legs) {
    if (leg.kind === "move" || !hidden.has(`leg:${leg.key}`)) continue;
    out.push({ kind: "leg", key: `leg:${leg.key}`, section: legByPlane(leg) ? "flight" : "transport", leg });
  }
  for (const { range, city } of hiddenNights(timeline)) out.push({ kind: "nights", key: nightsKey(range), section: "stay", range, city });
  return out;
}

/** A record in its own right: an idea, a booking with no block. */
function itemDraft(item: Item, siblings: Item[]): Draft {
  return {
    key: `item:${item.id}`,
    section: sectionOfItem(item),
    piece: { kind: "item", item, siblings: siblings.length ? siblings : [item], settled: decided(item) },
    where: whereOfItem(item),
    domKey: null,
    entryKeys: [`event:${item.id}`],
    legKeys: [],
    items: [item],
    state: itemState(item),
    nights: 0,
  };
}

/** A stay that doesn't fit the trip's nights: "outside the trip dates" or "no dates chosen". */
function looseSubtitle(plan: Plan, g: OptionGroup): string {
  const title = g.title ?? "";
  if (plan.range) return `${title}${g.range ? L(" · gezi tarihleri dışında", " · outside the trip dates") : L(" · tarih seçilmemiş", " · no dates chosen")}`;
  return `${title}${g.range ? "" : L(" · tarih seçilmemiş", " · no dates chosen")}`;
}

/** Dated first, by date then time (ties keep the front's order); the undated last, by city in the trip's order. */
function sortEntries(entries: CatEntry[], plan: Plan): CatEntry[] {
  const cities: string[] = [];
  for (const b of plan.stayBlocks) if (b.city && !cities.some((c) => sameCity(c, b.city))) cities.push(b.city);
  const cityRank = (city: string | null) => {
    if (!city) return [2, ""] as const;
    const i = cities.findIndex((c) => sameCity(c, city));
    return i >= 0 ? ([0, String(i).padStart(4, "0")] as const) : ([1, cityKeyOf(city) ?? city] as const);
  };
  return [...entries].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.seq - b.seq;
    if (a.date || b.date) return a.date ? -1 : 1;
    const [ra, ka] = cityRank(a.city);
    const [rb, kb] = cityRank(b.city);
    // A to-do ticked off goes to the bottom of its city.
    return ra - rb || ka.localeCompare(kb) || Number(a.state === "done") - Number(b.state === "done") || a.created - b.created || a.row.name.localeCompare(b.row.name, "tr") || a.seq - b.seq;
  });
}

function daysOf(entries: CatEntry[], plan: Plan): DayGroup[] {
  const days: DayGroup[] = [];
  for (const e of entries) {
    const last = days.at(-1);
    if (e.date) {
      if (last?.date === e.date) last.entries.push(e);
      else days.push({ key: `day:${e.date}`, date: e.date, city: cityOfNight(plan, e.date) ?? e.city, entries: [e] });
    } else if (last && !last.date && (last.city === e.city || (last.city && e.city && sameCity(last.city, e.city)))) {
      last.entries.push(e);
    } else {
      days.push({ key: `none:${cityKeyOf(e.city) ?? "-"}`, date: null, city: e.city, entries: [e] });
    }
  }
  return days;
}

/** "1 karar bekliyor", "1 bilet yok · 3 karar", "2 gece boş", "2 güne eklenmedi"; "✓ 3 alındı" once all is done. */
export function sectionStatus(id: SectionId, entries: CatEntry[]): CatSection["status"] {
  if (!entries.length) return null;
  const n = (s: EntryState) => entries.filter((e) => e.state === s).length;
  const parts: string[] = [];
  const empty = n("empty");
  if (empty) {
    const nights = entries.reduce((s, e) => s + e.nights, 0);
    parts.push(
      id === "stay"
        ? L(`${nights} gece boş`, `${nights} night${nights === 1 ? "" : "s"} empty`)
        : id === "flight"
          ? L(`${empty} uçuş eklenmedi`, `${empty} flight${empty === 1 ? "" : "s"} not added`)
          : L(`${empty} planlanmadı`, `${empty} not planned`),
    );
  }
  const booking = entries.filter((e) => e.state === "book");
  if (booking.length) {
    const tickets = booking.filter((e) => e.ticket).length;
    const rest = booking.length - tickets;
    if (tickets) parts.push(L(`${tickets} bilet yok`, `${tickets} without a ticket`));
    if (rest) parts.push(id === "other" ? L(`${rest} satın alınmadı`, `${rest} not bought`) : L(`${rest} rezerve edilmedi`, `${rest} not booked`));
  }
  const decide = n("decide");
  const later = n("unscheduled");
  if (decide) parts.push(parts.length || later ? L(`${decide} karar`, `${decide} to decide`) : L(`${decide} karar bekliyor`, `${decide} to decide`));
  if (later) parts.push(L(`${later} güne eklenmedi`, `${later} without a day`));
  if (parts.length) return { text: parts.join(" · "), tone: "wait" };
  const done = entries.length;
  return {
    text: id === "todo" || id === "food" ? L(`✓ ${done} planlandı`, `✓ ${done} planned`) : L(`✓ ${done} alındı`, `✓ ${done} booked`),
    tone: "done",
  };
}

function sectionOf(id: SectionId, list: CatEntry[], plan: Plan, hidden: HiddenThing[]): CatSection {
  const entries = sortEntries(list, plan);
  const status = sectionStatus(id, entries);
  return { id, entries, days: daysOf(entries, plan), status, settled: entries.filter((e) => e.state === "done").length, open: status?.tone === "wait", hidden };
}

/** The section and entry that hold a to-do's target (a record, a transfer, a block), tried in that order; `dom`: its card's key. */
export function findInSections(
  sections: CatSection[],
  target: { item?: string; leg?: string; entry?: string },
): { section: SectionId; key: string; dom: string } | null {
  const all = sections.flatMap((s) => s.entries);
  const hit =
    (target.item && all.find((e) => e.itemIds.includes(target.item!))) ||
    (target.leg && all.find((e) => e.legKeys.includes(target.leg!))) ||
    (target.entry && (all.find((e) => e.entryKeys.includes(target.entry!)) ?? (target.entry.startsWith("event:") ? all.find((e) => e.itemIds.includes(target.entry!.slice(6))) : undefined)));
  return hit ? { section: hit.section, key: hit.key, dom: catDomKey(hit) } : null;
}

/** The DOM id of an entry's card wrapper: its block's (the itinerary and the to-dos look for it), else its own. */
export const catDomKey = (e: CatEntry): string => e.domKey ?? `cat:${e.key}`;

/** What the traveller opened or closed, per trip ({"food": false}); the rest follow the first look. */
export type OpenState = Partial<Record<SectionId, boolean>>;
