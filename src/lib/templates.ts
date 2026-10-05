// "+ Ekle": what can be added by hand, the record one tap on a tile makes at once (quickItem), the short
// form a plan's "Düzenle" opens, and an edit. The item is the one a plan said in the chat makes
// (plannedItem, origin "chat"), so a page saved for it later takes its place and the chat can change it.
// Unlike the chat, a template never merges into a plan already there. Pure, except addFromTemplate,
// addQuick and saveEdit, which write it.
import { cardKindLabel, type CardKind, type TransportMode } from "./cardKinds";
import { addEvent, db, notifyChanged } from "./db";
import { L } from "./i18n";
import { liveLabels } from "./i18nText";
import { isoDate } from "./items";
import { ALL_PLANNED_KINDS, checkPlanned, isGeneratedName, plannedItem, type PlannedInput } from "./planned";
import { addDays } from "./plan";
import { cityOfAirport } from "./airports";
import type { TimelineEntry, TimelineSection } from "./timeline";
import type { Item, PlannedKind } from "./types";

export type TemplateId = TransportMode | "hotel" | "home" | "activity" | "todo" | "food" | "esim" | "insurance" | "note";
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
  tp("activity", "activity", "other", "named"), tp("todo", "todo", "other", "named"), tp("food", "food", "other", "named"), tp("esim", "esim", "other", "named"),
  tp("insurance", "insurance", "other", "named"), tp("note", "note", "other", "named"),
];

const OTHER_LABELS = liveLabels({
  hotel: ["Otel", "Hotel"], home: ["Ev · daire", "Home · flat"], activity: ["Etkinlik · tur", "Activity · tour"], todo: ["Yapılacak", "To-do"],
  food: ["Restoran", "Restaurant"], esim: ["eSIM", "eSIM"], insurance: ["Sigorta", "Insurance"], note: ["Not", "Note"],
});
export const templateLabel = (id: TemplateId): string =>
  id in OTHER_LABELS ? OTHER_LABELS[id as keyof typeof OTHER_LABELS] : cardKindLabel(id as TransportMode);
/** A plan made by hand and not named yet goes by its kind alone ("Restoran", "Otel"): the card shows where. */
const KIND_WORD = liveLabels({
  hotel: ["Otel", "Hotel"], home: ["Ev", "Home"], activity: ["Etkinlik", "Activity"], todo: ["Yapılacak", "To-do"], food: ["Restoran", "Restaurant"],
  esim: ["eSIM", "eSIM"], insurance: ["Seyahat sigortası", "Travel insurance"], note: ["Not", "Note"],
});
const KIND_WORDS = new Set(["Otel", "Hotel", "Ev", "Home", "Etkinlik", "Activity", "Yapılacak", "To-do", "Restoran", "Restaurant", "eSIM", "Seyahat sigortası", "Travel insurance", "Not", "Note"]);
/** A name that is only the kind's word (in either language): the form shows it blank, an edit keeps it. */
export const isKindWord = (name: string) => KIND_WORDS.has(name.trim());

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
  /** After a stay (no day): its last night, the one a place to stay added there takes. */
  night?: string | null;
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

/**
 * The form as a plan (checked like a plan said in the chat), or what's wrong with it. `keep` is what an
 * edit carries over that the form doesn't ask: the plan's own kind when it opened in the nearest form
 * (a transfer as a taxi), and its time for a rental or a stay (no time there). `partial`: an edit on the
 * card, where what's still missing (a name, where, which day) may stay missing.
 */
export function templateInput(tpl: Template, f: FormValues, keep: { kind?: PlannedKind; time?: string | null; partial?: boolean } = {}): TemplateResult | string {
  const v = (s: string) => s.trim() || null;
  const amount = f.price.trim() ? parseAmount(f.price) : null;
  if (f.price.trim() && amount == null) return L("Fiyat bir sayı olmalı (örneğin 68 ya da 1.240).", "The price must be a number (e.g. 68 or 1,240).");
  const base: PlannedInput = { kind: keep.kind ?? tpl.kind, date: v(f.date), end_date: null, time: keep.time ?? null, from: null, to: null, city: v(f.city), title: null, booked: false, note: null };
  const input: PlannedInput =
    tpl.form === "trip"
      ? { ...base, from: v(f.from), to: v(f.to), time: v(f.time) }
      : tpl.form === "rental"
        ? { ...base, end_date: v(f.end) }
        : tpl.form === "stay"
          ? { ...base, end_date: v(f.end), title: v(f.name) }
          : // A restaurant's or an activity's hour: carried by formOf, changed on the card (the sheet has no box for it).
            { ...base, title: v(f.name), time: v(f.time) };
  if (tpl.form === "named" && !input.title && !keep.partial && input.kind !== "esim" && input.kind !== "insurance") return L("Adını yaz.", "Give it a name.");
  const problem = checkPlanned(input, ALL_PLANNED_KINDS, { complete: !keep.partial });
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
  const made = plannedItem(r.input, tripId, id, now);
  // "Yapılacak" is never a booking; "Etkinlik · tur" is one by its evidence (a price, ticket words), like the
  // rest (booking.ts): named "Porto Belo Pazarı" it's a to-do.
  const item: Item = tpl.id === "todo" ? { ...made, booking: "none" } : made;
  return r.price ? withPrice(item, r.price, now) : item;
}

/**
 * "Düzenle" and an edit on the card: the same record with what the form says now. Only what the form asks
 * changes; the rest (status, note, summary, files, a rental's or a stay's time, a transfer's kind) stays.
 * Not named yet (the kind's word), it keeps that word. `partial`: an edit on the card (templateInput).
 */
export function editedItem(before: Item, tpl: Template, f: FormValues, now: number, opts: { partial?: boolean } = {}): Item | string {
  const ownKind = before.plannedKind && FOR_KIND.get(before.plannedKind) === tpl ? before.plannedKind : undefined;
  const time = before.flight?.departure?.slice(11, 16) ?? null;
  const timeless = tpl.form === "rental" || tpl.form === "stay";
  const r = templateInput(tpl, f, { kind: ownKind, time: timeless && time && /^\d{2}:\d{2}$/.test(time) ? time : null, partial: opts.partial });
  if (typeof r === "string") return r;
  const fresh = plannedItem(r.input, before.tripId, before.id, now);
  const was = before.flight;
  const flight = fresh.flight && {
    ...fresh.flight,
    carrier: was?.carrier ?? null,
    flightNumber: was?.flightNumber ?? null,
    stops: was?.stops ?? null,
    arrival: was && fresh.flight.departure === was.departure ? was.arrival : null,
  };
  const next: Item = {
    ...before,
    category: fresh.category,
    needKey: fresh.needKey,
    name: !r.input.title && isKindWord(before.name) ? before.name : fresh.name,
    city: fresh.city,
    dates: fresh.dates,
    flight,
    plannedKind: fresh.plannedKind,
    price: r.price ? before.price : fresh.price,
    updatedAt: now,
  };
  const samePrice = r.price && before.price.amount === r.price.amount && before.price.currency === r.price.currency;
  return r.price && !samePrice ? withPrice(next, r.price, now) : next;
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
      name: isGeneratedName(item.name) || isKindWord(item.name) ? "" : item.name,
      date: isoDate(item.dates.start) ?? "",
      end: isoDate(item.dates.end) ?? "",
      time: /^\d{2}:\d{2}$/.test(time) ? time : "",
      price: item.price.amount != null ? String(item.price.amount) : "",
      currency: item.price.currency ?? currency,
    },
  };
}

/**
 * The "+" under a card of the plan: its city and day. A trip's city is the leg's (a station or an airport
 * code never is one), else the city of its airport; after the flight home there's no city. After a stay,
 * its city and no day: which night is picked in the form.
 */
export function insertAt(entry: TimelineEntry): InsertAt {
  switch (entry.kind) {
    case "stay":
      return { city: entry.block.city, date: null, night: addDays(entry.block.range.end, -1) };
    case "travel": {
      if (entry.role === "departure") return { city: null, date: entry.date };
      const f = (entry.travel?.settled ?? entry.travel?.items[0])?.flight;
      return { city: entry.leg?.to.city ?? (f?.to ? cityOfAirport(f.to) : null), date: entry.date };
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

/** The "+" at the very top of the plan (before the way in): the first day, no city (the way to the airport is at home). */
export const insertAtStart = (sections: TimelineSection[]): InsertAt => ({ city: null, date: firstDate(sections) });

/** The "+" at the head of a city's block: that city, its first day. */
export const insertAtCity = (section: Extract<TimelineSection, { kind: "city" }>): InsertAt => ({ city: section.city, date: section.range?.start ?? null });

/** The "+" on a day of the itinerary (its head, or an empty day): that day and its city. */
export const insertAtDay = (date: string, city: string | null): InsertAt => ({ city, date });

function firstDate(sections: TimelineSection[]): string | null {
  const s = sections[0];
  if (!s) return null;
  if (s.kind === "travel") return s.entry.date;
  if (s.kind === "journey") return s.journey.date;
  return s.range?.start ?? s.entries[0]?.date ?? null;
}

/**
 * One tap on a tile (spec 0.33 §2): the record at once, no form. Its kind; the city and day of where it
 * was added; a way of travel leaves from that city to "?" (a taxi stays in it); a place to stay takes one
 * night (the day pressed, else the stay's last night it was added after); the rest goes by its kind's
 * word. No price; planned ("Planlanıyor"), like a plan said in the chat. The card then opens for editing.
 */
export function quickItem(tpl: Template, at: InsertAt | null, tripId: string, id: string, now: number): Item {
  const city = at?.city ?? null;
  const night = tpl.form === "stay" ? (at?.date ?? at?.night ?? null) : null;
  const input: PlannedInput = {
    kind: tpl.kind,
    date: tpl.form === "stay" ? night : (at?.date ?? null),
    end_date: night ? addDays(night, 1) : null,
    time: null,
    from: tpl.form === "trip" && tpl.kind !== "taxi" ? city : null,
    to: null,
    city: tpl.form === "trip" && tpl.kind !== "taxi" ? null : city,
    title: null,
    booked: false,
    note: null,
  };
  const made = plannedItem(input, tripId, id, now);
  return tpl.id in KIND_WORD ? { ...made, name: KIND_WORD[tpl.id as keyof typeof KIND_WORD] } : made;
}

export async function addQuick(tripId: string, tpl: Template, at: InsertAt | null, id: string, now = Date.now()): Promise<Item> {
  const made = quickItem(tpl, at, tripId, id, now);
  await (await db()).put("items", made);
  await addEvent(tripId, L(`${made.name} plana eklendi`, `${made.name} added to the plan`));
  notifyChanged();
  return made;
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
