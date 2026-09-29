// A day on the move as steps in the order they happen: check-out, the transfer to the airport or
// station, the flight or train (and any connection), the transfer on, check-in. Each step says when,
// where it stands and what it is, in a few words; the full card opens under it. Times come from the
// records or are worked out from them, and a worked-out or usual time is marked ("~15:00 genelde"). Pure.
import { formatDateRange, metricsOf } from "./items";
import { addMinutes, clockOf, laterOf, legShortTitle, minutesOf, MODE_LABELS, stayTimes, type Leg } from "./legs";
import type { StayBlock } from "./plan";
import type { Journey, TimelineEntry, TimelineSection } from "./timeline";
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
    status: leg.status === "empty" ? "Planlanmadı" : leg.status === "options" ? `${leg.options.length} seçenek` : leg.mode && standing === "planned" ? `${MODE_LABELS[leg.mode]} · planlandı` : leg.statusText,
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
