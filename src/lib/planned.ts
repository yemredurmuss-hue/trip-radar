// Plans the traveller states in the chat, with or without a link: "7 Ekim'de İstanbul'dan Porto'ya
// uçuyoruz", "11 Ekim'de Madeira'ya uçakla geçeriz", "Madeira'da araba kiralarız". Each becomes an item
// on the board straight away, on its day and in its place, planned until they say it's booked. When a
// saved page for the same need is chosen or booked, it takes the plan's place (see plan.ts). Pure.
import { EMPTY_METRICS } from "./items";
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

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Checks what the model passed; a wrong date is refused rather than guessed. */
export function checkPlanned(input: PlannedInput): string | null {
  if (!(PLANNED_KINDS as readonly string[]).includes(input.kind)) return `Bilinmeyen tür: ${input.kind}`;
  if (!DATE.test(input.date) || Number.isNaN(Date.parse(input.date))) return `Tarih YYYY-AA-GG olmalı: ${input.date}`;
  if (input.end_date && (!DATE.test(input.end_date) || input.end_date < input.date)) return `Bitiş tarihi geçersiz: ${input.end_date}`;
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
    createdAt: now,
    updatedAt: now,
  };
}

/** The same plan said again ("uçağı aldık"): same kind of need, same day. */
export const samePlan = (a: Item, b: Item) =>
  a.origin === "chat" && b.origin === "chat" && a.category === b.category && a.needKey === b.needKey && a.dates.start === b.dates.start;
