// A day on the move as steps in the order they happen: check-out, the transfer to the airport or
// station, the flight or train (and any connection), the transfer on, check-in. Each step says when,
// where it stands and what it is, in a few words; the full card opens under it. Times come from the
// records or are worked out from them, and a worked-out or usual time is marked ("~15:00 genelde"). Pure.
import { formatDateRange, formatPrice, metricsOf } from "./items";
import { addMinutes, BOOKABLE, clockOf, laterOf, legShortTitle, minutesOf, MODE_LABELS, stayTimes, type Leg } from "./legs";
import type { StayBlock } from "./plan";
import type { Journey, RentalEntry, TimelineEntry, TimelineSection } from "./timeline";
import type { Item, LegMode, Listing } from "./types";

export type StepStanding = "booked" | "planned" | "open";

export interface JourneyStep {
  key: string;
  kind: "checkout" | "transfer" | "travel" | "checkin";
  /** Its day, when it isn't the journey's own (an overnight flight lands the next day). */
  otherDay: string | null;
  time: string | null;
  /** A usual or worked-out time, shown with "~". */
  estimated: boolean;
  /** Why that time: "en geç", "genelde", "iniş", "varıştan sonra". */
  hint: string | null;
  title: string;
  sub: string | null;
  standing: StepStanding;
  status: string;
  /** Things easy to miss (a transfer's notes): marked with ⓘ, read when it opens. */
  notes: string[];
  /** What opens under it: the travel or transfer entry; for a stay, its place in the city block. */
  entry: TimelineEntry | null;
  stayKey: string | null;
}

type JourneySection = Extract<TimelineSection, { kind: "journey" }>;

const TICKETED: LegMode[] = ["flight", "train", "bus", "ferry"];
const MODE_WORD: Partial<Record<LegMode, string>> = { flight: "Uçuş", train: "Tren", bus: "Otobüs", ferry: "Feribot", car: "Araba", taxi: "Taksi", transfer: "Transfer" };
const HUB_AT: Partial<Record<LegMode, string>> = { flight: "havalimanında", train: "garda", bus: "otogarda", ferry: "iskelede" };
const TRANSFER_MIN = 60;

const duration = (m: number | null) => (m ? `${Math.floor(m / 60) ? `${Math.floor(m / 60)} sa` : ""}${m % 60 ? ` ${m % 60} dk` : ""}`.trim() : null);

function stayItem(b: StayBlock): Item | null {
  return b.kind === "open" ? null : b.item;
}

function stayStanding(b: StayBlock): { standing: StepStanding; status: string } {
  if (b.kind === "booked") return { standing: "booked", status: "Rezerve" };
  if (b.kind === "chosen") return { standing: "planned", status: "Rezerve edilmedi" };
  return { standing: "open", status: b.groups.length ? "Karar ver" : "Planlanmadı" };
}

const stayKey = (b: StayBlock) => `stay:${b.range.start}`;

function checkout(j: Journey, b: StayBlock, listings: Map<string, Listing> | undefined): JourneyStep {
  const item = stayItem(b);
  const t = stayTimes(item, listings);
  return {
    key: `${j.key}:checkout`,
    kind: "checkout",
    otherDay: null,
    time: item ? t.checkOut : null,
    estimated: Boolean(item) && !t.stated.checkOut,
    hint: item ? (t.stated.checkOut ? "en geç" : "genelde") : null,
    title: "Check-out",
    sub: item?.name ?? `${b.city ?? "Konaklama"} · yer seçilmedi`,
    ...stayStanding(b),
    notes: [],
    entry: null,
    stayKey: stayKey(b),
  };
}

function checkin(j: Journey, b: StayBlock, landing: string | null, listings: Map<string, Listing> | undefined): JourneyStep {
  const item = stayItem(b);
  const t = stayTimes(item, listings);
  // Not before the room is ready, nor before getting there from the airport or station.
  const ready = landing ? addMinutes(landing, TRANSFER_MIN) : null;
  const pastMidnight = landing != null && minutesOf(landing) + TRANSFER_MIN >= 24 * 60;
  const later = item && ready && (pastMidnight || (laterOf(ready, t.checkIn) === ready && ready !== t.checkIn));
  return {
    key: `${j.key}:checkin`,
    kind: "checkin",
    otherDay: null,
    time: !item ? null : later ? ready : t.checkIn,
    estimated: Boolean(item) && (Boolean(later) || !t.stated.checkIn),
    hint: !item ? null : later ? "varıştan sonra" : t.stated.checkIn ? "en erken" : "genelde",
    title: "Check-in",
    sub: item?.name ?? `${b.city ?? "Konaklama"} · yer seçilmedi`,
    ...stayStanding(b),
    notes: [],
    entry: null,
    stayKey: stayKey(b),
  };
}

function travelStep(j: Journey, e: Extract<TimelineEntry, { kind: "travel" }>): JourneyStep {
  const t = e.travel;
  const item = t?.settled ?? (t?.items.length === 1 ? t.items[0] : null);
  const f = item?.flight ?? null;
  const mode = t?.mode ?? e.leg?.choice?.mode ?? e.leg?.mode ?? null;
  const word = (mode && MODE_WORD[mode]) ?? (e.role === "move" ? null : "Uçuş");
  const route =
    e.role === "move" && e.leg
      ? `${e.leg.from.city ?? e.leg.from.label} → ${e.leg.to.city ?? e.leg.to.label}`
      : f?.from && f.to
        ? `${f.from} → ${f.to}`
        : (e.subtitle ?? "");
  const dep = clockOf(f?.departure);
  const arr = clockOf(f?.arrival);
  const sub = item ? [item.name, dep && arr ? `${dep} → ${arr}` : null, duration(metricsOf(item).durationMinutes)].filter(Boolean).join(" · ") : null;
  const ticket = !mode || TICKETED.includes(mode);
  let standing: StepStanding = "open";
  let status: string;
  if (t?.settled) {
    standing = t.settled.status === "booked" ? "booked" : "planned";
    status = t.settled.status === "booked" ? (ticket ? "Bilet alındı" : "Rezerve") : ticket ? "Bilet alınmadı" : "Rezerve edilmedi";
  } else if (t?.items.length) {
    status = t.items.length === 1 ? "1 seçenek · seç" : `${t.items.length} seçenek · karar ver`;
  } else if (e.leg?.choice?.booked) {
    standing = "booked";
    status = ticket ? "Bilet alındı" : "Ayarlandı";
  } else if (e.leg?.choice?.mode) {
    standing = "planned";
    status = ticket ? "Bilet alınmadı" : "Planlandı";
  } else {
    status = e.role === "move" ? "Planlanmadı · nasıl?" : "Uçuş yok";
  }
  const day = f?.departure?.slice(0, 10) ?? e.date;
  return {
    key: e.key,
    kind: "travel",
    otherDay: day !== j.date ? day : null,
    time: dep,
    estimated: false,
    hint: null,
    title: [word, route].filter(Boolean).join(" "),
    sub,
    standing,
    status,
    notes: e.leg?.notes ?? [],
    entry: e,
    stayKey: null,
  };
}

function legStep(j: Journey, e: Extract<TimelineEntry, { kind: "leg" }>): JourneyStep {
  const leg: Leg = e.leg;
  const standing: StepStanding = leg.status === "booked" ? "booked" : leg.status === "planned" || leg.status === "chosen" ? "planned" : "open";
  const leaving = leg.kind === "departure";
  const at = leg.via ? HUB_AT[leg.via] : null;
  return {
    key: e.key,
    kind: "transfer",
    otherDay: leg.date !== j.date ? leg.date : null,
    time: leaving ? leg.before : leg.after,
    estimated: false,
    hint: leaving ? (leg.before ? `en geç ${at ?? "orada"}` : null) : leg.after ? "iniş" : null,
    title: legShortTitle(leg),
    sub: `${leg.from.label} → ${leg.to.label}`,
    standing,
    status: leg.status === "empty" ? "Planlanmadı" : leg.status === "options" ? `${leg.options.length} seçenek` : leg.statusText,
    notes: leg.notes,
    entry: e,
    stayKey: null,
  };
}

/** The steps of a day on the move, in order. */
export function journeySteps(section: JourneySection, listings?: Map<string, Listing>): JourneyStep[] {
  const j = section.journey;
  const steps: JourneyStep[] = [];
  if (j.out) steps.push(checkout(j, j.out, listings));
  for (const e of section.entries) {
    if (e.kind === "travel") steps.push(travelStep(j, e));
    else if (e.kind === "leg") steps.push(legStep(j, e));
  }
  if (j.in) {
    // Landing: the transfer's "after" (the flight's local arrival), else the last trip's arrival.
    const arriving = [...section.entries].reverse().find((e) => e.kind === "leg" && e.leg.kind === "arrival");
    const lastTrip = [...section.entries].reverse().find((e) => e.kind === "travel");
    const landing =
      (arriving?.kind === "leg" ? arriving.leg.after : null) ??
      (lastTrip?.kind === "travel" ? clockOf((lastTrip.travel?.settled ?? null)?.flight?.arrival) : null);
    steps.push(checkin(j, j.in, landing, listings));
  }
  return steps;
}

/** "4. gün · Cmt 10 Eki" or, off the trip's days, "Varış · 7 Ekim". */
export function journeyTitle(j: Journey): string {
  const word = j.role === "arrival" ? "Varış" : j.role === "departure" ? "Dönüş" : "Şehir değişimi";
  return j.dayNo ? `${j.dayNo}. gün` : `${word} · ${formatDateRange(j.date, null)}`;
}

/** How many of the steps are done (booked), for "2/5 hazır". */
export function stepsReady(steps: JourneyStep[]): number {
  return steps.filter((s) => s.standing === "booked").length;
}

// --- a day as rows ---------------------------------------------------------------------------------
//
// Every day reads the same way: its time on the left and, in order, what happens. Something with a
// booking of its own (a flight, a transfer, a tour, a table) is a card until it's booked, then folds
// into a line with a ✓; what's only information (check-in, picking up the car) is always a line. A
// hotel or a rented car spans days: its card is above, the days only say when you get in and out.

/** Booked, still to book, to pick from, nothing yet; or only information (nothing to book: metro, check-in). */
export type RowState = "done" | "pending" | "decide" | "open" | "info";

export interface DayRow {
  key: string;
  kind: "info" | "travel" | "leg" | "item" | "rental" | "ideas";
  time: string | null;
  estimated: boolean;
  hint: string | null;
  otherDay: string | null;
  title: string;
  sub: string | null;
  /** Its folded line once done: "Metro · planlandı", "TAP · 19:40 → 01:35", "€90 · rezerve". */
  line: string | null;
  state: RowState;
  status: string;
  notes: string[];
  /** The travel or transfer entry it shows (its place for the to-do strip). */
  entry: TimelineEntry | null;
  leg: Leg | null;
  item: Item | null;
  /** Ideas saved for the day, to pick from. */
  items: Item[];
  /** A car rented from this day: its card. */
  rental: RentalEntry | null;
  stayKey: string | null;
}

type DayEntry = Extract<TimelineEntry, { kind: "day" }>;

const row = (over: Partial<DayRow> & Pick<DayRow, "key" | "kind" | "title" | "state">): DayRow => ({
  time: null, estimated: false, hint: null, otherDay: null, sub: null, line: null, status: "", notes: [], entry: null, leg: null, item: null, items: [], rental: null, stayKey: null, ...over,
});

function legState(leg: Leg): RowState {
  switch (leg.status) {
    case "booked":
      return "done";
    case "chosen":
      return "pending";
    case "planned":
      // Metro, a walk, their own car: nothing to book, only how they'll go.
      return leg.choice?.mode && BOOKABLE.includes(leg.choice.mode) ? "pending" : "info";
    case "options":
      return "decide";
    default:
      return "open";
  }
}

function travelState(e: Extract<TimelineEntry, { kind: "travel" }>): RowState {
  const t = e.travel;
  if (t?.settled) return t.settled.status === "booked" ? "done" : "pending";
  if (t?.items.length) return "decide";
  const choice = e.leg?.choice;
  if (choice?.booked) return "done";
  if (choice?.mode) return BOOKABLE.includes(choice.mode) ? "pending" : "info";
  return "open";
}

function fromStep(st: JourneyStep): DayRow {
  const base = { key: st.key, time: st.time, estimated: st.estimated, hint: st.hint, otherDay: st.otherDay, title: st.title, sub: st.sub, status: st.status, notes: st.notes };
  if (st.kind === "checkout" || st.kind === "checkin") return row({ ...base, kind: "info", state: "info", stayKey: st.stayKey });
  if (st.entry?.kind === "leg") return row({ ...base, kind: "leg", state: legState(st.entry.leg), entry: st.entry, leg: st.entry.leg, line: legLine(st.entry.leg) });
  const e = st.entry as Extract<TimelineEntry, { kind: "travel" }>;
  const done = e.travel?.settled ?? null;
  const times = [clockOf(done?.flight?.departure), clockOf(done?.flight?.arrival)];
  const line = done ? [done.name, times[0] && times[1] ? `${times[0]} → ${times[1]}` : null].filter(Boolean).join(" · ") : e.leg?.choice?.mode ? `${MODE_LABELS[e.leg.choice.mode]} · ${e.leg.choice.booked ? (TICKETED.includes(e.leg.choice.mode) ? "bilet alındı" : "ayarlandı") : "planlandı"}` : null;
  return row({ ...base, kind: "travel", state: travelState(e), entry: e, line });
}

/** "Metro · planlandı", "Taksi · ayarlandı", "Rezerve": a done transfer in a few words. */
const legLine = (leg: Leg) => leg.statusText.replace(/\s*✓\s*$/, "") || null;

function legRow(leg: Leg): DayRow {
  const t = leg.kind === "departure" ? leg.before : leg.after;
  return row({
    key: `leg:${leg.key}`,
    kind: "leg",
    time: t,
    hint: t ? (leg.kind === "departure" ? "en geç" : "varış") : null,
    title: legShortTitle(leg),
    sub: `${leg.from.label} → ${leg.to.label}`,
    state: legState(leg),
    status: leg.statusText,
    notes: leg.notes,
    line: legLine(leg),
    leg,
  });
}

function itemRow(item: Item): DayRow {
  const time = clockOf(item.flight?.departure);
  const price = item.price.amount != null ? formatPrice(item.price.amount, item.price.currency) : null;
  return row({
    key: `item:${item.id}`,
    kind: "item",
    time,
    title: item.name,
    sub: [price, item.status === "booked" ? "rezerve" : null].filter(Boolean).join(" · ") || null,
    state: item.status === "booked" ? "done" : "pending",
    status: item.status === "booked" ? "Rezerve" : "Rezerve edilmedi",
    line: [price, "rezerve"].filter(Boolean).join(" · "),
    item,
  });
}

/** A car rented from this day is a card there (at its pick-up time); on the day it ends, "Araç iade" is a line. */
function rentalRows(date: string, rentals: RentalEntry[]): { start: DayRow[]; end: DayRow[] } {
  const start: DayRow[] = [];
  const end: DayRow[] = [];
  for (const r of rentals) {
    const items = r.group.items;
    const lead = items.find((i) => i.status === "booked") ?? items.find((i) => i.status === "chosen") ?? null;
    const name = lead?.name ?? (items.length === 1 ? items[0].name : `${items.length} seçenek`);
    if (r.date === date) {
      const state: RowState = lead?.status === "booked" ? "done" : lead ? "pending" : "decide";
      const status = state === "done" ? "Rezerve" : state === "pending" ? "Rezerve edilmedi" : `${items.length} seçenek`;
      start.push(row({ key: r.key, kind: "rental", state, status, title: "Araç kiralama", sub: name, time: clockOf(lead?.flight?.departure), rental: r }));
    }
    if (r.end === date && r.end !== r.date) {
      end.push(row({ key: `${r.key}:return`, kind: "info", state: "info", title: "Araç iade", sub: name, time: clockOf(lead?.flight?.arrival) }));
    }
  }
  return { start, end };
}

/** Puts a row with a time before the first later one; without a time, at the end. */
function place(rows: DayRow[], add: DayRow): void {
  if (add.time) {
    const at = rows.findIndex((r) => r.time != null && minutesOf(r.time) > minutesOf(add.time!));
    if (at >= 0) {
      rows.splice(at, 0, add);
      return;
    }
  }
  rows.push(add);
}

/**
 * The rows of a day, or of a day on the move: its steps (check-out, transfers, the flight, check-in),
 * what's decided that day in time order, the car's pick-up and return, and the ideas saved for it last.
 */
export function dayRows(input: { journey?: JourneySection; day?: DayEntry | null; rentals?: RentalEntry[]; listings?: Map<string, Listing> }): DayRow[] {
  const day = input.day ?? (input.journey?.entries.find((e): e is DayEntry => e.kind === "day") ?? null);
  const date = input.journey?.journey.date ?? day?.date ?? null;
  const rows: DayRow[] = input.journey ? journeySteps(input.journey, input.listings).map(fromStep) : (day?.legs ?? []).map(legRow);
  if (date) {
    const cars = rentalRows(date, input.rentals ?? []);
    // Without a time, the car is picked up first thing and returned last (on the way, after the steps).
    for (const r of cars.start) (r.time || input.journey ? place(rows, r) : rows.unshift(r));
    for (const r of cars.end) place(rows, r);
  }
  for (const item of day?.items ?? []) if (item.status === "chosen" || item.status === "booked") place(rows, itemRow(item));
  const ideas = (day?.items ?? []).filter((i) => i.status === "saved");
  if (ideas.length) rows.push(row({ key: `ideas:${date}`, kind: "ideas", state: "info", title: ideas.length === 1 ? ideas[0].name : `${ideas.length} fikir`, items: ideas }));
  return rows;
}

/** What's left to do on a day: to book, to pick, to plan. */
export const rowsLeft = (rows: DayRow[]) => rows.filter((r) => r.state === "pending" || r.state === "decide" || r.state === "open").length;

/** A folded day in a few words: "Douro tekne turu · 16:00", "3 plan, hepsi hazır". */
export function daySummary(rows: DayRow[]): string {
  // Bookings are what the day is about; information lines only speak when there's nothing else.
  const plans = rows.filter((r) => r.kind !== "ideas" && r.kind !== "info");
  const info = rows.filter((r) => r.kind === "info");
  const ideas = rows.find((r) => r.kind === "ideas");
  const left = rowsLeft(rows);
  const head =
    plans.length === 0
      ? info.map((r) => r.title).join(" · ")
      : plans.length === 1
        ? [plans[0].title, plans[0].time].filter(Boolean).join(" · ")
        : left
          ? `${plans.length} plan · ${left} iş kaldı`
          : `${plans.length} plan · hepsi hazır`;
  const more = ideas ? `${ideas.items.length} fikir` : "";
  return [head, more].filter(Boolean).join(" · ");
}
