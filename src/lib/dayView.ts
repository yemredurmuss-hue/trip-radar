// Gün gün's three ways to read the same days (plan v46, r-gungun): Kompakt (one row a day), Liste (the day's photo
// beside its lines) and Kartlar (the day's lines on a rail, its cards under them). The pieces they share, pure:
// the saved choice, the day's photo, a day that changes city as one journey (r-yolgunu), the day's reservation cards
// (r-gunrez).
import { dayPhoto, isPlanRow, type DayCard } from "./dayCards";
import type { DayRow } from "./journey";

export type DayMode = "compact" | "list" | "cards";
export const DAY_MODES: readonly DayMode[] = ["compact", "list", "cards"];

/** A saved choice read back; anything else is the default, the compact row. */
export const parseDayMode = (raw: string | null | undefined): DayMode => (DAY_MODES as readonly (string | null | undefined)[]).includes(raw) ? (raw as DayMode) : "compact";

/**
 * The day's photo: the page's own picture of its highlight (a tour's, a table's), else the city's photo the trip
 * already has; null when neither exists (the card then draws its faint illustration, never a made-up picture).
 */
export function dayPhotoUrl(card: DayCard, cityImage?: (city: string | null) => string | null): string | null {
  const spec = dayPhoto(card);
  if (spec && "url" in spec) return spec.url;
  return cityImage?.(card.city) ?? null;
}

/** What the day is about, for its faint illustration when it has no photo: the sea, the hills, or the town. */
export type Motif = "sea" | "hills" | "town";
export function motifOf(card: DayCard): Motif {
  const text = card.rows.map((r) => `${r.title} ${r.item?.name ?? ""} ${r.item?.summary ?? ""}`).join(" ");
  if (/tekne|boat|feribot|ferry|vapur|plaj|beach|sahil|deniz|\bsea\b|cruise|okyanus|ocean|kıyı|coast/i.test(text) || card.rows.some((r) => r.entry?.kind === "travel" && r.entry.leg?.mode === "ferry")) return "sea";
  if (/yürüyüş|hike|hiking|levada|dağ|mountain|orman|forest|park|bahçe|garden|seyir|viewpoint|miradouro|vadi|valley|şelale|waterfall/i.test(text)) return "hills";
  return "town";
}

/** A line of the way: the trip itself, a transfer, a check-in or check-out (a stay's line). */
const isJourneyRow = (r: DayRow) => r.kind === "travel" || r.kind === "leg" || (r.kind === "info" && !!r.stayKey) || !!r.layover || !!r.meeting;

/** A day that changes city as one journey: check-out and the transfer, the trip (a ticket), the transfer and check-in. */
export interface JourneyDay {
  /** Before the trip: check-out, the transfer to the station or airport. */
  before: DayRow[];
  /** From the first trip to the last (a layover between two flights stays between them). */
  body: DayRow[];
  /** After it: the transfer, check-in. */
  after: DayRow[];
  /** What the day has besides the journey (a tour, a table, the car), in its order. */
  rest: DayRow[];
}

/** The journey of a day, or null: only a day that changes city (the journey's "move") with a trip on it is one. `flow` is the day's lines in order. */
export function journeyDay(card: Pick<DayCard, "role">, flow: DayRow[]): JourneyDay | null {
  if (card.role !== "move") return null;
  const first = flow.findIndex((r) => r.kind === "travel");
  const last = flow.findLastIndex((r) => r.kind === "travel");
  if (first < 0) return null;
  const part = (from: number, to: number) => flow.slice(from, to).filter(isJourneyRow);
  return { before: part(0, first), body: flow.slice(first, last + 1), after: part(last + 1, flow.length), rest: flow.filter((r) => !isJourneyRow(r)) };
}

/** Every row of a journey day that the journey card shows. */
export const journeyRows = (j: JourneyDay): DayRow[] => [...j.before, ...j.body, ...j.after];

/**
 * The day's reservations: what has a card of its own to book or to settle (a flight, a trip, a transfer still to plan,
 * a tour, a table, the car), in the day's order. Check-ins, ideas and a transfer that is only a way (the metro) are
 * lines of the flow, not reservations.
 */
export const reservationRows = (flow: DayRow[]): DayRow[] =>
  flow.filter((r) => isPlanRow(r) && !r.layover && !r.meeting && (r.entry || r.leg || r.rental || r.item));

/** How many of the reservations are booked: "✓ hazır" when all are. */
export const reservationsReady = (rows: DayRow[]): { ready: number; total: number; all: boolean } => {
  const ready = rows.filter((r) => r.state === "done").length;
  return { ready, total: rows.length, all: rows.length > 0 && ready === rows.length };
};
