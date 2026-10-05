// "+ Ekle": what can be added by hand, the short form each one asks, and the plan item it makes. The item
// is the one a plan said in the chat makes (plannedItem, origin "chat"), so a page saved for it later
// takes its place and the chat can change it. Unlike the chat, a template never merges into a plan
// already there. Pure, except addFromTemplate and saveEdit, which write it.
import { cardKindLabel, type CardKind, type TransportMode } from "./cardKinds";
import { addEvent, db, notifyChanged } from "./db";
import { L } from "./i18n";
import { liveLabels } from "./i18nText";
import { isoDate } from "./items";
import { ALL_PLANNED_KINDS, checkPlanned, isGeneratedName, plannedItem, type PlannedInput } from "./planned";
import type { TimelineEntry } from "./timeline";
import type { Item, PlannedKind } from "./types";

export type TemplateId = TransportMode | "hotel" | "home" | "activity" | "food" | "esim" | "insurance" | "note";
/** trip: from, to, day, time · rental: place, start, end · stay: name, city, check-in, check-out · named: name, day. All with a price. */
export type TemplateFormKind = "trip" | "rental" | "stay" | "named";
export interface Template {
  id: TemplateId;
  kind: PlannedKind;
  group: "move" | "stay" | "other";
  form: TemplateFormKind;
}

const tp = (id: TemplateId, kind: PlannedKind, group: Template["group"], form: TemplateFormKind): Template => ({ id, kind, group, form });
export const TEMPLATES: readonly Template[] = [
  tp("flight", "flight", "move", "trip"), tp("train", "train", "move", "trip"), tp("bus", "bus", "move", "trip"),
  tp("minibus", "minibus", "move", "trip"), tp("ferry", "ferry", "move", "trip"), tp("taxi", "taxi", "move", "trip"),
  tp("car", "car_rental", "move", "rental"), tp("moto", "moto_rental", "move", "rental"), tp("rv", "rv_rental", "move", "rental"),
  tp("bike", "bike_rental", "move", "rental"),
  tp("hotel", "stay", "stay", "stay"), tp("home", "stay", "stay", "stay"),
  tp("activity", "activity", "other", "named"), tp("food", "food", "other", "named"), tp("esim", "esim", "other", "named"),
  tp("insurance", "insurance", "other", "named"), tp("note", "note", "other", "named"),
];

const OTHER_LABELS = liveLabels({
  hotel: ["Otel", "Hotel"], home: ["Ev · daire", "Home · flat"], activity: ["Etkinlik · tur", "Activity · tour"],
  food: ["Restoran", "Restaurant"], esim: ["eSIM", "eSIM"], insurance: ["Sigorta", "Insurance"], note: ["Not", "Note"],
});
export const templateLabel = (id: TemplateId): string =>
  id in OTHER_LABELS ? OTHER_LABELS[id as keyof typeof OTHER_LABELS] : cardKindLabel(id as TransportMode);
/** How a tile is drawn (its colour and icon); "home" has its own icon in the sheet. */
export const templateCardKind = (id: TemplateId): CardKind => (id === "hotel" || id === "home" ? "stay" : id);

export interface FormValues {
  from: string;
  to: string;
  city: string;
  name: string;
  date: string;
  end: string;
  time: string;
  price: string;
  currency: string;
}
/** Where the sheet was opened: the city and day of the card above the "+" (null from the header's "Ekle"). */
export interface InsertAt {
  city: string | null;
  date: string | null;
}

export function emptyForm(tpl: Template, at: InsertAt | null, currency: string): FormValues {
  const city = at?.city ?? "";
  return { from: tpl.form === "trip" ? city : "", to: "", city, name: "", date: at?.date ?? "", end: "", time: "", price: "", currency };
}

/** "68", "1.240", "68,50", "€ 1.240,50": a separator followed by exactly three digits groups thousands, else it's the decimals. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  const decimals = last >= 0 && s.length - last - 1 !== 3 ? s.slice(last + 1) : "";
  const whole = (decimals ? s.slice(0, last) : s).replace(/[.,]/g, "");
  const n = Number(`${whole}${decimals ? `.${decimals}` : ""}`);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface TemplateResult {
  input: PlannedInput;
  price: { amount: number; currency: string } | null;
}

/** The form as a plan (checked like a plan said in the chat), or what's wrong with it. */
export function templateInput(tpl: Template, f: FormValues): TemplateResult | string {
  const v = (s: string) => s.trim() || null;
  const amount = f.price.trim() ? parseAmount(f.price) : null;
  if (f.price.trim() && amount == null) return L("Fiyat bir sayı olmalı (örneğin 68 ya da 1.240).", "The price must be a number (e.g. 68 or 1,240).");
  const base: PlannedInput = { kind: tpl.kind, date: v(f.date), end_date: null, time: null, from: null, to: null, city: v(f.city), title: null, booked: false, note: null };
  const input: PlannedInput =
    tpl.form === "trip"
      ? { ...base, from: v(f.from), to: v(f.to), time: v(f.time) }
      : tpl.form === "rental"
        ? { ...base, end_date: v(f.end) }
        : tpl.form === "stay"
          ? { ...base, end_date: v(f.end), title: v(f.name) }
          : { ...base, title: v(f.name) };
  if (tpl.form === "named" && !input.title && tpl.kind !== "esim" && tpl.kind !== "insurance") return L("Adını yaz.", "Give it a name.");
  const problem = checkPlanned(input, ALL_PLANNED_KINDS);
  if (problem) return problem;
  return { input, price: amount != null ? { amount, currency: f.currency } : null };
}

export function withPrice(item: Item, price: { amount: number; currency: string }, now: number): Item {
  return {
    ...item,
    price: { amount: price.amount, currency: price.currency, scope: "total", taxesIncluded: "unknown", source: "user", observedAt: now },
    priceHistory: [...item.priceHistory, { amount: price.amount, currency: price.currency, observedAt: now }],
  };
}

/**
 * The new plan item, or what's wrong with the form. Always new: a second restaurant, hotel or flight
 * on the same day is added next to the first (unlike a plan said again in the chat, see planToSave).
 */
export function templateItem(tpl: Template, f: FormValues, tripId: string, id: string, now: number): Item | string {
  const r = templateInput(tpl, f);
  if (typeof r === "string") return r;
  const item = plannedItem(r.input, tripId, id, now);
  return r.price ? withPrice(item, r.price, now) : item;
}

/** "Düzenle": the same record (id, status, files) with what the form says now. */
export function editedItem(before: Item, tpl: Template, f: FormValues, now: number): Item | string {
  const r = templateInput(tpl, f);
  if (typeof r === "string") return r;
  const fresh = plannedItem(r.input, before.tripId, before.id, now);
  const next: Item = { ...before, ...fresh, id: before.id, createdAt: before.createdAt, status: before.status, statusAt: before.statusAt, captureIds: before.captureIds };
  return r.price ? withPrice(next, r.price, now) : next;
}

const FOR_KIND = new Map<PlannedKind, Template>(TEMPLATES.filter((x) => x.id !== "home").map((x) => [x.kind, x]));
FOR_KIND.set("transfer", TEMPLATES.find((x) => x.id === "taxi")!);
FOR_KIND.set("other", TEMPLATES.find((x) => x.id === "note")!);

/** The form a plan was saved from (a chat plan of a kind with no tile opens as the nearest one). */
export function formOf(item: Item, currency: string): { template: Template; values: FormValues } {
  const template = (item.plannedKind && FOR_KIND.get(item.plannedKind)) || FOR_KIND.get("other")!;
  const time = item.flight?.departure?.slice(11, 16) ?? "";
  return {
    template,
    values: {
      from: item.flight?.from ?? "",
      to: item.flight?.to ?? "",
      city: item.city ?? "",
      name: isGeneratedName(item.name) ? "" : item.name,
      date: isoDate(item.dates.start) ?? "",
      end: isoDate(item.dates.end) ?? "",
      time: /^\d{2}:\d{2}$/.test(time) ? time : "",
      price: item.price.amount != null ? String(item.price.amount) : "",
      currency: item.price.currency ?? currency,
    },
  };
}

/** The "+" under a card of the plan: its city and day. */
export function insertAt(entry: TimelineEntry): InsertAt {
  switch (entry.kind) {
    case "stay":
      return { city: entry.block.city, date: entry.block.range.start };
    case "travel": {
      const f = (entry.travel?.settled ?? entry.travel?.items[0])?.flight;
      return { city: f?.to ?? entry.leg?.to.city ?? null, date: entry.date };
    }
    case "leg":
      return { city: entry.leg.to.city ?? entry.leg.from.city, date: entry.date };
    case "event":
      return { city: entry.item.city, date: entry.date };
    case "day":
      return { city: null, date: entry.date };
    case "plan":
      return { city: entry.city, date: entry.date };
    case "rental":
      return { city: entry.group.items[0]?.city ?? null, date: entry.date };
  }
}

export async function addFromTemplate(tripId: string, tpl: Template, f: FormValues, id: string, now = Date.now()): Promise<Item | string> {
  const made = templateItem(tpl, f, tripId, id, now);
  if (typeof made === "string") return made;
  await (await db()).put("items", made);
  await addEvent(tripId, L(`${made.name} plana eklendi`, `${made.name} added to the plan`));
  notifyChanged();
  return made;
}

export async function saveEdit(before: Item, tpl: Template, f: FormValues, now = Date.now()): Promise<Item | string> {
  const next = editedItem(before, tpl, f, now);
  if (typeof next === "string") return next;
  await (await db()).put("items", next);
  await addEvent(before.tripId, L(`${next.name} güncellendi`, `${next.name} updated`));
  notifyChanged();
  return next;
}
