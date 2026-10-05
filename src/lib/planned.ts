// Plans the traveller states in the chat, with or without a link: "7 Ekim'de İstanbul'dan Porto'ya
// uçuyoruz", "11 Ekim'de Madeira'ya uçakla geçeriz", "Madeira'da araba kiralarız". Each becomes an item
// on the board straight away, on its day and in its place, planned until they say it's booked. When a
// saved page for the same need is chosen or booked, it takes the plan's place (see plan.ts). Pure.
import { L } from "./i18n";
import { liveLabels } from "./i18nText";
import { EMPTY_METRICS, isoDate } from "./items";
import { cityKeyOf } from "./plan";
import { RENTAL_KINDS } from "./travelKinds";
import type { Category, Item, PlannedKind } from "./types";

export type { PlannedKind } from "./types";
/** Kinds the chat's plan_item tool may use. */
export const PLANNED_KINDS = ["flight", "train", "bus", "ferry", "transfer", "taxi", "car_rental", "stay", "activity", "esim", "todo", "other"] as const satisfies readonly PlannedKind[];
/** Kinds only the add sheet makes (the chat says them as one of the above). */
export const TEMPLATE_ONLY_KINDS = ["minibus", "moto_rental", "rv_rental", "bike_rental", "food", "insurance", "note"] as const satisfies readonly PlannedKind[];
export const ALL_PLANNED_KINDS: readonly PlannedKind[] = [...PLANNED_KINDS, ...TEMPLATE_ONLY_KINDS];

export interface PlannedInput {
  kind: PlannedKind;
  /** YYYY-MM-DD; null when not said yet ("Madeira'da araba kiralarız"): the plan then sits in its city. */
  date: string | null;
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
  taxi: "transport",
  car_rental: "transport",
  minibus: "transport",
  moto_rental: "transport",
  rv_rental: "transport",
  bike_rental: "transport",
  food: "food",
  insurance: "other",
  note: "other",
  todo: "other",
  stay: "stay",
  activity: "activity",
  esim: "esim",
  other: "other",
};
const WORD: Readonly<Partial<Record<PlannedKind, string>>> = liveLabels({
  flight: ["Uçuş", "Flight"],
  train: ["Tren", "Train"],
  bus: ["Otobüs", "Bus"],
  minibus: ["Minibüs", "Minibus"],
  ferry: ["Feribot", "Ferry"],
  transfer: ["Transfer", "Transfer"],
  taxi: ["Taksi", "Taxi"],
});
const RENTAL_WORD: Readonly<Partial<Record<PlannedKind, string>>> = liveLabels({
  car_rental: ["Araç kiralama", "Car rental"],
  moto_rental: ["Motosiklet kiralama", "Motorbike rental"],
  rv_rental: ["Karavan kiralama", "Camper van rental"],
  bike_rental: ["Bisiklet kiralama", "Bike rental"],
});
const TRAVEL: PlannedKind[] = ["flight", "train", "bus", "minibus", "ferry", "transfer", "taxi"];

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
    date: text(raw?.date),
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

/**
 * Checks what the model passed; a wrong date is refused rather than guessed. `complete: false` (an edit on
 * the card, a plan added in one tap): what's still missing (where, which day) may stay missing; a wrong
 * value is refused all the same.
 */
export function checkPlanned(input: PlannedInput, kinds: readonly string[] = PLANNED_KINDS, opts: { complete?: boolean } = {}): string | null {
  if (!kinds.includes(input.kind)) return L(`Bilinmeyen tür: ${input.kind}`, `Unknown kind: ${input.kind}`);
  if (input.date != null && !isoDate(input.date)) return L(`Tarih YYYY-AA-GG olmalı: ${input.date}`, `The date must be YYYY-MM-DD: ${input.date}`);
  if (input.end_date && (!isoDate(input.end_date) || (input.date && input.end_date < input.date))) return L(`Bitiş tarihi geçersiz: ${input.end_date}`, `Invalid end date: ${input.end_date}`);
  if (input.end_date && !input.date) return L("Bitiş varsa başlangıç tarihini de yaz.", "With an end date, give the start date too.");
  if (input.kind === "stay" && input.date && input.end_date && input.end_date <= input.date) return L("Konaklamanın çıkış günü girişten sonra olmalı.", "A stay's check-out day must be after check-in.");
  if (input.time && !TIME.test(input.time)) return L(`Saat SS:DD olmalı: ${input.time}`, `The time must be HH:MM: ${input.time}`);
  if (opts.complete === false) return null;
  // A ticket for a day ("12 Ekim'e uçak bileti") is a plan already; where it goes can come later.
  if (TRAVEL.includes(input.kind) && input.kind !== "taxi" && !input.to && !input.city && !input.date) return L("Nereye gidildiğini (to) ya da gününü (date) yaz.", "Give where it goes (to) or its day (date).");
  if (input.kind === "taxi" && !input.date) return L("Taksinin gününü (date) yaz.", "Give the taxi's day (date).");
  if ((RENTAL_KINDS.includes(input.kind) || input.kind === "stay") && !input.city && !input.to) return L("Hangi şehirde olduğunu (city) yaz.", "Give the city it's in (city).");
  return null;
}

function nameOf(i: PlannedInput): string {
  if (i.title?.trim()) return i.title.trim().slice(0, 80);
  const where = i.city ?? i.to;
  const at = where ? ` · ${where}` : "";
  if (WORD[i.kind] && !i.from && !i.to && !i.city) return WORD[i.kind]!;
  // Only where it leaves from (a bus added from the "+" after Porto): "Otobüs · Porto → ?".
  if (WORD[i.kind]) return `${WORD[i.kind]} · ${i.from ? `${i.from} → ` : ""}${i.to ?? i.city ?? "?"}`;
  if (RENTAL_WORD[i.kind]) return `${RENTAL_WORD[i.kind]}${at}`;
  if (i.kind === "insurance") return L("Seyahat sigortası", "Travel insurance");
  if (i.kind === "food") return `${L("Restoran", "Restaurant")}${at}`;
  if (i.kind === "note") return L("Not", "Note");
  if (i.kind === "todo") return `${L("Yapılacak", "To-do")}${at}`;
  if (i.kind === "stay") return `${L("Konaklama", "Stay")}${at}`;
  if (i.kind === "esim") return `eSIM${at}`;
  return where ? `Plan · ${where}` : "Plan";
}

function needKeyOf(i: PlannedInput): string {
  if (i.kind === "flight") return `flight:${slug(i.from)}-${slug(i.to)}`;
  if (TRAVEL.includes(i.kind)) return `transport:${slug(i.from)}-${slug(i.to ?? i.city)}`;
  if (RENTAL_KINDS.includes(i.kind)) return `transport:${i.kind === "car_rental" ? "car" : i.kind.replace("_rental", "")}-${slug(i.city ?? i.to)}`;
  if (i.kind === "insurance") return `other:insurance-${slug(i.city ?? i.to)}`;
  if (i.kind === "note") return `other:note-${slug(i.title)}`;
  if (i.kind === "todo") return `other:todo-${slug(i.title ?? i.city)}`;
  return `${CATEGORY[i.kind]}:${slug(i.city ?? i.to)}`;
}

/** The board item for a plan said in the chat. */
export function plannedItem(input: PlannedInput, tripId: string, id: string, now: number): Item {
  const travel = TRAVEL.includes(input.kind);
  const at = input.time && input.date ? `${input.date}T${input.time}` : null;
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
    // A taxi goes to "the airport" or "the hotel": its place is the city it's in, when said.
    city: input.kind === "taxi" ? input.city : travel ? (input.to ?? input.city) : (input.city ?? input.to),
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
    // Said as a thing to do with a ticket, it's a booking even without a price; a to-do, a restaurant or a
    // note is an idea (Fikirler). The rest is read by kind (booking.ts).
    ...(input.kind === "activity" ? { booking: "needed" as const } : input.kind === "todo" || input.kind === "food" || input.kind === "note" ? { booking: "none" as const } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

const GENERATED =
  /^(Uçuş|Tren|Otobüs|Minibüs|Feribot|Transfer|Taksi|Araç kiralama|Motosiklet kiralama|Karavan kiralama|Bisiklet kiralama|Konaklama|Restoran|Seyahat sigortası|Not|Yapılacak|eSIM|Plan|Flight|Train|Bus|Minibus|Ferry|Taxi|Car rental|Motorbike rental|Camper van rental|Bike rental|Stay|Restaurant|Travel insurance|Note|To-do)( ·|$)/;
/** A name nameOf made (in either language), not one the traveller gave. */
export const isGeneratedName = (name: string) => GENERATED.test(name);
const where = (s: string | null | undefined) => (s ? cityKeyOf(s) : null);

/**
 * The same plan said again ("uçağı aldık", "Porto'dan değil Lizbon'dan"): same kind, same day and the
 * same place (for a trip: where it goes, and where from when both say it; for an activity: its name).
 */
export function samePlan(a: Item, b: Item): boolean {
  if (a.origin !== "chat" || b.origin !== "chat" || a.category !== b.category) return false;
  // Said without a day first and with one later ("araba kiralarız" → "12–16 Ekim arası"): the same plan.
  if (a.dates.start && b.dates.start && a.dates.start !== b.dates.start) return false;
  if (a.plannedKind && b.plannedKind && a.plannedKind !== b.plannedKind) return false;
  const kind = a.plannedKind ?? b.plannedKind;
  if (kind && TRAVEL.includes(kind)) {
    const fromA = where(a.flight?.from);
    const fromB = where(b.flight?.from);
    if (fromA && fromB && fromA !== fromB) return false;
    // Where it goes said only once ("12 Ekim'e uçak bileti", then "Porto'dan İstanbul'a"): the same trip.
    const [toA, toB] = [where(a.flight?.to ?? a.city), where(b.flight?.to ?? b.city)];
    return !toA || !toB || toA === toB;
  }
  if (a.category === "activity" || a.category === "other") return a.needKey === b.needKey && slug(a.name) === slug(b.name);
  return a.needKey === b.needKey;
}

/** A plan said again keeps what was said before and isn't said now (where from, the time, the note). */
export function fillPlanned(input: PlannedInput, before: Item): PlannedInput {
  const time = before.flight?.departure?.slice(11, 16) || null;
  return {
    ...input,
    date: input.date ?? before.dates.start,
    end_date: input.end_date ?? before.dates.end,
    time: input.time ?? time,
    from: input.from ?? before.flight?.from ?? null,
    to: input.to ?? before.flight?.to ?? null,
    city: input.city ?? before.city,
    title: input.title ?? (GENERATED.test(before.name) ? null : before.name),
    note: input.note ?? before.statusNote,
  };
}

/**
 * What a plan becomes when saved: said again (samePlan), it updates the plan it repeats, keeping its id
 * and what was said before; else a new item. Planned until it's said to be booked.
 */
export function planToSave(said: PlannedInput, items: Item[], tripId: string, id: string, now: number): { item: Item; same: Item | null } {
  const probe = plannedItem(said, tripId, "", 0);
  const same = items.find((i) => samePlan(i, probe)) ?? null;
  const plan = same ? fillPlanned(said, same) : said;
  const fresh = plannedItem(plan, tripId, id, now);
  const status = plan.booked || same?.status === "booked" ? ("booked" as const) : ("chosen" as const);
  return { item: same ? { ...same, ...fresh, id: same.id, createdAt: same.createdAt, status } : { ...fresh, status }, same };
}
