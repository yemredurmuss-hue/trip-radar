// Plans the traveller states in the chat, with or without a link: "7 Ekim'de İstanbul'dan Porto'ya
// uçuyoruz", "11 Ekim'de Madeira'ya uçakla geçeriz", "Madeira'da araba kiralarız". Each becomes an item
// on the board straight away, on its day and in its place, planned until they say it's booked. When a
// saved page for the same need is chosen or booked, it takes the plan's place (see plan.ts). Pure.
import { EMPTY_METRICS, isoDate } from "./items";
import { cityKeyOf } from "./plan";
import type { Category, Item } from "./types";

export const PLANNED_KINDS = ["flight", "train", "bus", "ferry", "transfer", "car_rental", "stay", "activity", "other"] as const;
export type PlannedKind = (typeof PLANNED_KINDS)[number];

export interface PlannedInput {
  kind: PlannedKind;
  /** YYYY-MM-DD */
  date: string;
  end_date: string | null;
  /** HH:MM */
  time: string | null;
  from: string | null;
  to: string | null;
  city: string | null;
  title: string | null;
  booked: boolean;
  note: string | null;
}

const CATEGORY: Record<PlannedKind, Category> = {
  flight: "flight",
  train: "transport",
  bus: "transport",
  ferry: "transport",
  transfer: "transport",
  car_rental: "transport",
  stay: "stay",
  activity: "activity",
  other: "other",
};
const WORD: Partial<Record<PlannedKind, string>> = { flight: "Uçuş", train: "Tren", bus: "Otobüs", ferry: "Feribot", transfer: "Transfer" };
const TRAVEL: PlannedKind[] = ["flight", "train", "bus", "ferry", "transfer"];

const slug = (s: string | null) =>
  (s ?? "")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "x";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The model's input with every missing field as null (the tool is not always schema-constrained). */
export function plannedInput(raw: any): PlannedInput {
  return {
    kind: raw?.kind,
    date: typeof raw?.date === "string" ? raw.date.trim() : raw?.date,
    end_date: text(raw?.end_date),
    time: text(raw?.time),
    from: text(raw?.from),
    to: text(raw?.to),
    city: text(raw?.city),
    title: text(raw?.title),
    booked: raw?.booked === true,
    note: text(raw?.note),
  };
}

/** Checks what the model passed; a wrong date is refused rather than guessed. */
export function checkPlanned(input: PlannedInput): string | null {
  if (!(PLANNED_KINDS as readonly string[]).includes(input.kind)) return `Bilinmeyen tür: ${input.kind}`;
  if (!isoDate(input.date)) return `Tarih YYYY-AA-GG olmalı: ${input.date}`;
  if (input.end_date && (!isoDate(input.end_date) || input.end_date < input.date)) return `Bitiş tarihi geçersiz: ${input.end_date}`;
  if (input.kind === "stay" && input.end_date && input.end_date <= input.date) return "Konaklamanın çıkış günü girişten sonra olmalı.";
  if (input.time && !TIME.test(input.time)) return `Saat SS:DD olmalı: ${input.time}`;
  if (TRAVEL.includes(input.kind) && !input.to && !input.city) return "Nereye gidildiğini (to) yaz.";
  if ((input.kind === "car_rental" || input.kind === "stay") && !input.city && !input.to) return "Hangi şehirde olduğunu (city) yaz.";
  return null;
}

function nameOf(i: PlannedInput): string {
  if (i.title?.trim()) return i.title.trim().slice(0, 80);
  const where = i.city ?? i.to;
  if (WORD[i.kind]) return `${WORD[i.kind]} · ${i.from ? `${i.from} → ` : ""}${i.to ?? i.city ?? ""}`.trim();
  if (i.kind === "car_rental") return `Araç kiralama${where ? ` · ${where}` : ""}`;
  if (i.kind === "stay") return `Konaklama${where ? ` · ${where}` : ""}`;
  return where ? `Plan · ${where}` : "Plan";
}

function needKeyOf(i: PlannedInput): string {
  if (i.kind === "flight") return `flight:${slug(i.from)}-${slug(i.to)}`;
  if (TRAVEL.includes(i.kind)) return `transport:${slug(i.from)}-${slug(i.to ?? i.city)}`;
  if (i.kind === "car_rental") return `transport:car-${slug(i.city ?? i.to)}`;
  return `${CATEGORY[i.kind]}:${slug(i.city ?? i.to)}`;
}

/** The board item for a plan said in the chat. */
export function plannedItem(input: PlannedInput, tripId: string, id: string, now: number): Item {
  const travel = TRAVEL.includes(input.kind);
  const at = input.time ? `${input.date}T${input.time}` : null;
  return {
    id,
    tripId,
    captureIds: [],
    key: null,
    category: CATEGORY[input.kind],
    needKey: needKeyOf(input),
    name: nameOf(input),
    provider: null,
    summary: input.note?.trim() ?? "",
    optionDetail: null,
    url: null,
    imageUrl: null,
    city: travel ? (input.to ?? input.city) : (input.city ?? input.to),
    country: null,
    countryCode: null,
    location: { address: null, area: null, approximate: false },
    dates: { start: input.date, end: input.end_date, source: "unverified" },
    guests: { adults: null, children: null, rooms: null },
    price: { amount: null, currency: null, scope: "unknown", taxesIncluded: "unknown", source: "none", observedAt: now },
    priceHistory: [],
    cancellation: { summary: null, freeUntil: null, source: "none" },
    rating: { value: null, scale: null, count: null, source: "none" },
    flight: travel || at ? { from: travel ? input.from : null, to: travel ? (input.to ?? input.city) : null, departure: at, arrival: null, carrier: null, flightNumber: null, stops: null } : null,
    metrics: EMPTY_METRICS,
    geo: null,
    highlights: [],
    concerns: [],
    reviewSummary: null,
    missing: [],
    status: input.booked ? "booked" : "chosen",
    statusNote: input.note?.trim() || null,
    origin: "chat",
    plannedKind: input.kind,
    createdAt: now,
    updatedAt: now,
  };
}

const GENERATED = /^(Uçuş|Tren|Otobüs|Feribot|Transfer|Araç kiralama|Konaklama|Plan)( ·|$)/;
const where = (s: string | null | undefined) => (s ? cityKeyOf(s) : null);

/**
 * The same plan said again ("uçağı aldık", "Porto'dan değil Lizbon'dan"): same kind, same day and the
 * same place (for a trip: where it goes, and where from when both say it; for an activity: its name).
 */
export function samePlan(a: Item, b: Item): boolean {
  if (a.origin !== "chat" || b.origin !== "chat" || a.category !== b.category || a.dates.start !== b.dates.start) return false;
  if (a.plannedKind && b.plannedKind && a.plannedKind !== b.plannedKind) return false;
  const kind = a.plannedKind ?? b.plannedKind;
  if (kind && TRAVEL.includes(kind)) {
    const fromA = where(a.flight?.from);
    const fromB = where(b.flight?.from);
    if (fromA && fromB && fromA !== fromB) return false;
    return where(a.flight?.to ?? a.city) === where(b.flight?.to ?? b.city);
  }
  if (a.category === "activity" || a.category === "other") return a.needKey === b.needKey && slug(a.name) === slug(b.name);
  return a.needKey === b.needKey;
}

/** A plan said again keeps what was said before and isn't said now (where from, the time, the note). */
export function fillPlanned(input: PlannedInput, before: Item): PlannedInput {
  const time = before.flight?.departure?.slice(11, 16) || null;
  return {
    ...input,
    end_date: input.end_date ?? before.dates.end,
    time: input.time ?? time,
    from: input.from ?? before.flight?.from ?? null,
    to: input.to ?? before.flight?.to ?? null,
    city: input.city ?? before.city,
    title: input.title ?? (GENERATED.test(before.name) ? null : before.name),
    note: input.note ?? before.statusNote,
  };
}
