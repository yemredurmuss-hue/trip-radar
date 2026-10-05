// Editing a plan on its card (spec 0.33 §3): the fields a card offers, in the order Tab goes through
// them, what an empty one says, the box each opens, and the record a change makes. A change goes through
// editedItem, so the note, the PNR, a rental's or a stay's time and the plan's own kind stay. Only plans
// made by hand or said in the chat (origin "chat"); a saved page is updated by saving the page again.
// Pure, except saveField, which writes it.
import { addEvent, db, notifyChanged } from "./db";
import { L } from "./i18n";
import { nightsBetween } from "./items";
import { addDays } from "./plan";
import { editedItem, formOf, type FormValues } from "./templates";
import type { Item } from "./types";

export type FieldKey = "name" | "from" | "to" | "city" | "date" | "end" | "time" | "price";

/** The card's fields in Tab order (none for a saved page). */
export function editableFields(item: Item): FieldKey[] {
  if (item.origin !== "chat") return [];
  const { template } = formOf(item, "EUR");
  switch (template.form) {
    case "trip":
      return ["from", "to", "date", "time", "price"];
    case "rental":
      return ["city", "date", "end", "price"];
    case "stay":
      return ["name", "city", "date", "end", "price"];
    case "named":
      return template.kind === "activity" || template.kind === "food" ? ["name", "city", "date", "time", "price"] : ["name", "city", "date", "price"];
  }
}

/** The field after (or, `back`, before) this one; null past the ends. */
export function nextField(fields: FieldKey[], key: FieldKey, back = false): FieldKey | null {
  const i = fields.indexOf(key);
  if (i < 0) return null;
  return fields[back ? i - 1 : i + 1] ?? null;
}

type Form = "trip" | "rental" | "stay" | "named";
const formKind = (item: Item): Form => formOf(item, "EUR").template.form;

/** What the field is called (its box's label). */
export function fieldLabel(key: FieldKey, item: Item): string {
  const form = formKind(item);
  switch (key) {
    case "name":
      return L("Ad", "Name");
    case "from":
      return L("Nereden", "From");
    case "to":
      return L("Nereye", "To");
    case "city":
      return form === "rental" ? L("Yer", "Place") : L("Şehir", "City");
    case "date":
      return form === "stay" ? L("Giriş", "Check-in") : form === "rental" ? L("Başlangıç", "Start") : L("Tarih", "Date");
    case "end":
      return form === "stay" ? L("Çıkış", "Check-out") : L("Bitiş", "End");
    case "time":
      return L("Saat", "Time");
    case "price":
      return L("Fiyat", "Price");
  }
}

/** What an empty field says on the card ("Tarih ekle", "Fiyat ekle"); a trip's ends read "Nereden" / "Nereye". */
export function fieldPlaceholder(key: FieldKey, item: Item): string {
  if (key === "from" || key === "to") return fieldLabel(key, item);
  const label = fieldLabel(key, item);
  return L(`${label} ekle`, `Add ${label.toLowerCase()}`);
}

/** The box a field opens: a date picker, a time picker, a number (with the currency beside it), or text. */
export const fieldInput = (key: FieldKey): "date" | "time" | "number" | "text" =>
  key === "date" || key === "end" ? "date" : key === "time" ? "time" : key === "price" ? "number" : "text";

/** The field's value as its box starts (the form's value: a name the kind's word stands in for is blank). */
export const fieldValue = (item: Item, key: FieldKey, currency: string): string => formOf(item, currency).values[key];

/**
 * The record with one field (or the price and its currency) changed, what's wrong with the value, or null
 * when nothing changed. A stay's or a rental's start moved keeps its length (the end moves with it).
 */
export function editField(item: Item, change: Partial<FormValues>, now: number, currency = "EUR"): Item | string | null {
  const { template, values } = formOf(item, currency);
  const next: FormValues = { ...values, ...change };
  for (const k of Object.keys(change) as (keyof FormValues)[]) next[k] = next[k].trim();
  if ((Object.keys(change) as (keyof FormValues)[]).every((k) => next[k] === values[k])) return null;
  const ranged = template.form === "stay" || template.form === "rental";
  if (ranged && change.date !== undefined && change.end === undefined && values.date && values.end && next.date) {
    next.end = addDays(values.end, nightsBetween(values.date, next.date));
  }
  return editedItem(item, template, next, now, { partial: true });
}

/** editField, written: the record and a line in the trip's history. */
export async function saveField(item: Item, change: Partial<FormValues>, currency: string, now = Date.now()): Promise<Item | string | null> {
  const d = await db();
  const fresh = (await d.get("items", item.id)) ?? item;
  const next = editField(fresh, change, now, currency);
  if (next == null || typeof next === "string") return next;
  await d.put("items", next);
  await addEvent(item.tripId, L(`${next.name} güncellendi`, `${next.name} updated`));
  notifyChanged();
  return next;
}
