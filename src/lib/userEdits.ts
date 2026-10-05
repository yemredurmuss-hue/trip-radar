// A saved page's card corrected by hand (spec 0.33 §3): the traveller's value stands in for the page's
// wherever the card, the plan, the timeline and the decision read it. One accessor, withEdits, is applied
// where the board reads the records (useBoard, the analysis run, the chat's view of the trip); the stored
// record keeps the page's values with the corrections beside them (Item.userEdits), so a page saved again
// (mergeItem) updates what's under them and "geri al" brings the page's value back. Pure, except
// saveUserEdit and clearUserEdit, which write it.
import { addEvent, db, notifyChanged } from "./db";
import { L } from "./i18n";
import type { FieldKey } from "./inlineEdit";
import { formatDateRange, formatPrice, isoDate, nightsBetween } from "./items";
import { addDays } from "./plan";
import { parseAmount, type FormValues } from "./templates";
import type { Item, PageValues, UserEdits } from "./types";

type EditKey = keyof UserEdits;
/** The card's field → the correction it writes. */
export const EDIT_KEY: Record<FieldKey, EditKey> = { name: "name", city: "city", from: "from", to: "to", date: "start", end: "end", time: "time", price: "price" };

const clock = (iso: string | null | undefined) => iso?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;
const startOf = (item: Item) => isoDate(item.flight?.departure?.slice(0, 10)) ?? isoDate(item.dates.start);

/** What the record itself says for a field (the page's value when the record is stored, not corrected). */
function ownValue(item: Item, key: EditKey): string | number | null {
  switch (key) {
    case "name":
      return item.name;
    case "city":
      return item.city;
    case "start":
      return startOf(item);
    case "end":
      return isoDate(item.dates.end);
    case "time":
      return clock(item.flight?.departure);
    case "price":
      return item.price.amount;
    case "currency":
      return item.price.currency;
    case "from":
      return item.flight?.from ?? null;
    case "to":
      return item.flight?.to ?? null;
  }
}

/** What the page says for a field, on the board's corrected copy or on a stored record alike. */
export function pageValue(item: Item, key: EditKey): string | number | null {
  return item.pageValues && key in item.pageValues ? (item.pageValues[key] ?? null) : ownValue(item, key);
}

/** The record as the traveller corrected it: the same object when there's nothing to correct. */
export function withEdits(item: Item): Item {
  const e = item.userEdits;
  if (!e || !Object.keys(e).length || item.pageValues) return item;
  const pageValues: PageValues = {};
  for (const key of Object.keys(e) as EditKey[]) (pageValues as Record<string, unknown>)[key] = ownValue(item, key);
  const f = item.flight;
  const startWas = startOf(item);
  const start = e.start ?? startWas;
  const time = e.time ?? clock(f?.departure);
  const timed = e.start !== undefined || e.time !== undefined;
  const departure = timed ? (start && time ? `${start}T${time}` : start && f?.departure ? `${start}${f.departure.slice(10)}` : (f?.departure ?? null)) : (f?.departure ?? null);
  // A trip moved to another day lands as many days later.
  const shift = e.start && startWas ? nightsBetween(startWas, e.start) : 0;
  const arrival = f?.arrival && shift ? `${addDays(f.arrival.slice(0, 10), shift)}${f.arrival.slice(10)}` : (f?.arrival ?? null);
  const flight =
    f || e.from !== undefined || e.to !== undefined || (e.time !== undefined && start)
      ? { from: e.from ?? f?.from ?? null, to: e.to ?? f?.to ?? null, departure, arrival, carrier: f?.carrier ?? null, flightNumber: f?.flightNumber ?? null, stops: f?.stops ?? null }
      : null;
  // The box opens with the page's amount as the page gives it (per night, per person...): the corrected
  // amount is in that same unit, so it keeps the page's scope (a flight per person stays per person).
  const scope = item.price.amount != null ? item.price.scope : ("total" as const);
  const price =
    e.price != null
      ? { amount: e.price, currency: e.currency ?? item.price.currency, scope, taxesIncluded: "unknown" as const, source: "user" as const, observedAt: item.price.observedAt }
      : item.price;
  return {
    ...item,
    name: e.name ?? item.name,
    city: e.city ?? item.city,
    dates: { ...item.dates, start: e.start ?? item.dates.start, end: e.end ?? item.dates.end },
    flight,
    price,
    pageValues,
  };
}

/**
 * A stored record whose fields the chat just set (set_price, set_details): the corrections over those
 * fields go, so the card shows what was said in the chat rather than an older correction on top of it.
 */
export function withoutEdits(item: Item, keys: EditKey[]): Item {
  if (!item.userEdits || !keys.some((k) => k in item.userEdits!)) return item;
  const rest: UserEdits = { ...item.userEdits };
  for (const k of keys) delete rest[k];
  const { userEdits: _was, ...bare } = item;
  return Object.keys(rest).length ? { ...bare, userEdits: rest } : bare;
}

/** A record saved from a page (its fields are the page's, read again when the page is saved again). */
export const fromPage = (item: Item): boolean => item.origin !== "chat" && item.captureIds.length > 0;

/** What the chat said about an option, field by field (null: not said). */
export type Said = Partial<Record<"start" | "end" | "time" | "from" | "to" | "city" | "price" | "currency", string | number | null>>;

/**
 * The corrections after the chat said something about a saved page's option ("karavan Gaula değil Madeira",
 * "o bilet 12 Ekim'di", "oteli 90 euroya aldım"). Kept beside the page's values like a correction made on the
 * card, so a page saved again (mergeItem) can't put the page's value back over what was said; the one said
 * now replaces a correction made before. A value the same as the page's needs no correction.
 */
export function saidEdits(item: Item, said: Said): UserEdits {
  const next: UserEdits = { ...item.userEdits };
  for (const [key, value] of Object.entries(said) as [EditKey, string | number | null | undefined][]) {
    if (value == null || value === "" || key === "currency" || key === "price") continue;
    if (value === pageValue(item, key)) delete next[key];
    else (next as Record<string, unknown>)[key] = value;
  }
  if (said.price != null) {
    const pageCurrency = pageValue(item, "currency") as string | null;
    const currency = (said.currency as string | null | undefined) || pageCurrency;
    if (said.price === pageValue(item, "price") && currency === pageCurrency) {
      delete next.price;
      delete next.currency;
    } else {
      next.price = Number(said.price);
      if (currency && currency !== pageCurrency) next.currency = currency;
      else delete next.currency;
    }
  }
  return next;
}

/** The page's value under a corrected field, in words, for "sayfadaki: X · geri al"; null when not corrected. */
export function correctionOf(item: Item, field: FieldKey): string | null {
  const key = EDIT_KEY[field];
  if (!item.userEdits || !(key in item.userEdits)) return null;
  const v = pageValue(item, key);
  if (v == null || v === "") return L("boş", "empty");
  if (key === "start" || key === "end") return formatDateRange(String(v), null);
  if (key === "price") return formatPrice(Number(v), (pageValue(item, "currency") as string | null) ?? null);
  return String(v);
}

/**
 * The corrections after a field changed on the card (FormValues as the box gives them: a date YYYY-MM-DD,
 * a time HH:MM, a price as typed with its currency), what's wrong with the value, or null when nothing
 * changes. A value emptied, or set back to the page's, takes the correction away. A stay's or a rental's
 * start moved keeps its length.
 */
export function editsAfter(item: Item, change: Partial<FormValues>): UserEdits | string | null {
  const before: UserEdits = { ...item.userEdits };
  const next: UserEdits = { ...before };
  const set = (key: EditKey, value: string | number | null) => {
    if (value == null || value === "" || value === pageValue(item, key)) delete next[key];
    else (next as Record<string, unknown>)[key] = value;
  };
  for (const [field, raw] of Object.entries(change) as [keyof FormValues, string][]) {
    const v = raw.trim();
    if (field === "currency") continue;
    if (field === "price") {
      const amount = v ? parseAmount(v) : null;
      if (v && amount == null) return L("Fiyat bir sayı olmalı (örneğin 68 ya da 1.240).", "The price must be a number (e.g. 68 or 1,240).");
      const currency = change.currency?.trim() || (pageValue(item, "currency") as string | null) || "EUR";
      set("price", amount);
      if (amount != null && currency !== pageValue(item, "currency")) next.currency = currency;
      else delete next.currency;
      continue;
    }
    if ((field === "date" || field === "end") && v && !isoDate(v)) return L(`Tarih YYYY-AA-GG olmalı: ${v}`, `The date must be YYYY-MM-DD: ${v}`);
    if (field === "time" && v && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return L(`Saat SS:DD olmalı: ${v}`, `The time must be HH:MM: ${v}`);
    const key = EDIT_KEY[field as FieldKey];
    if (key) set(key, v || null);
  }
  // A stay's or a rental's start moved: its end moves with it.
  const ranged = item.category === "stay" || Boolean(item.dates.end && item.category === "transport");
  const startNow = startOf(item);
  const endNow = isoDate(item.dates.end);
  if (ranged && change.date && change.end === undefined && startNow && endNow && isoDate(change.date.trim())) {
    set("end", addDays(endNow, nightsBetween(startNow, change.date.trim())));
  }
  const s = next.start ?? pageValue(item, "start");
  const e = next.end ?? pageValue(item, "end");
  if (item.category === "stay" && s && e && String(e) <= String(s)) return L("Konaklamanın çıkış günü girişten sonra olmalı.", "A stay's check-out day must be after check-in.");
  const same = JSON.stringify(Object.entries(before).sort()) === JSON.stringify(Object.entries(next).sort());
  return same ? null : next;
}

async function writeEdits(item: Item, edits: (fresh: Item) => UserEdits | string | null, event: (name: string) => string): Promise<Item | string | null> {
  const d = await db();
  const fresh = (await d.get("items", item.id)) ?? item;
  const next = edits(fresh);
  if (next == null || typeof next === "string") return next;
  const { userEdits: _was, pageValues: _view, ...rest } = fresh;
  const saved: Item = Object.keys(next).length ? { ...rest, userEdits: next, updatedAt: Date.now() } : { ...rest, updatedAt: Date.now() };
  await d.put("items", saved);
  await addEvent(item.tripId, event(withEdits(saved).name));
  notifyChanged();
  return withEdits(saved);
}

/** A field corrected on a saved page's card. */
export const saveUserEdit = (item: Item, change: Partial<FormValues>) =>
  writeEdits(item, (fresh) => editsAfter(withEdits(fresh), change), (name) => L(`${name} düzeltildi`, `${name} corrected`));

/** "geri al" under a corrected field: the page's value again (a price takes its currency with it). */
export const clearUserEdit = (item: Item, field: FieldKey) =>
  writeEdits(
    item,
    (fresh) => {
      const key = EDIT_KEY[field];
      if (!fresh.userEdits || !(key in fresh.userEdits)) return null;
      const rest: UserEdits = { ...fresh.userEdits };
      delete rest[key];
      if (key === "price") delete rest.currency;
      return rest;
    },
    (name) => L(`${name}: sayfadaki değere dönüldü`, `${name}: back to the page's value`),
  );
