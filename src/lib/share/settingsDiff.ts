// What changed in the shared settings, in words, field by field (paylaşım güvenliği, 0.37):
// "Tarihler: 7–18 Ekim → 8–18 Ekim", "Bütçe: ₺100.000 → ₺80.000", "Öncelikler: Fiyat çok önemli → önemli".
// Written when shown (the board's language at the time), from the two settings kept. Pure.
import { amenityLabel, CRITERION_LABELS, LEVEL_LABELS, requirementLabel } from "../decision";
import { L } from "../i18n";
import { lowerText } from "../i18nText";
import { CATEGORY_LABELS, formatDateRange, formatPrice } from "../items";
import type { Amenity, Category, CriterionId, Requirement, Trip } from "../types";
import { asSettings, changedFields, stableJson, type SyncedField, type SyncedSettings } from "./settings";

export interface DiffLine {
  field: SyncedField;
  /** "Tarihler", "Bütçe", "Öncelikler"… */
  label: string;
  /** What inside the field ("Fiyat", "Konaklama · Konum"), when it's one of several. */
  subject: string | null;
  before: string;
  after: string;
}

const none = () => L("yok", "none");

/** The field's name, as a row's bold start ("Tarihler:"). */
export function fieldLabel(field: SyncedField): string {
  switch (field) {
    case "title":
      return L("Ad", "Name");
    case "confirmedDates":
      return L("Tarihler", "Dates");
    case "budget":
      return L("Bütçe", "Budget");
    case "priorities":
    case "categoryPriorities":
      return L("Öncelikler", "Priorities");
    case "wantedAmenities":
      return L("İstenen olanaklar", "Wanted amenities");
    case "requirements":
      return L("Şartlar", "Requirements");
    case "travellers":
      return L("Gidenler", "Who's going");
  }
}

/** The field as the object of "değiştirdi" ("Sabine tarihleri değiştirdi"). */
function fieldObject(field: SyncedField): string {
  switch (field) {
    case "title":
      return L("gezinin adını", "the trip's name");
    case "confirmedDates":
      return L("tarihleri", "the dates");
    case "budget":
      return L("bütçeyi", "the budget");
    case "priorities":
    case "categoryPriorities":
      return L("öncelikleri", "the priorities");
    case "wantedAmenities":
      return L("istenen olanakları", "the wanted amenities");
    case "requirements":
      return L("şartları", "the requirements");
    case "travellers":
      return L("gidenleri", "who's going");
  }
}

/** "Sabine tarihleri değiştirdi", "Sabine changed the trip settings" (several fields). */
export function changeHeadline(author: string, fields: readonly SyncedField[]): string {
  const objects = [...new Set(fields.map(fieldObject))];
  return objects.length === 1
    ? L(`${author} ${objects[0]} değiştirdi`, `${author} changed ${objects[0]}`)
    : L(`${author} gezi ayarlarını değiştirdi`, `${author} changed the trip settings`);
}

const datesText = (v: unknown): string => {
  const d = v as Trip["confirmedDates"];
  return d && typeof d.start === "string" ? formatDateRange(d.start, typeof d.end === "string" ? d.end : null) : none();
};

const budgetText = (v: unknown): string => {
  const b = v as Trip["budget"];
  if (!b || typeof b.amount !== "number") return none();
  const amount = formatPrice(b.amount, b.currency ?? null);
  return typeof b.ceiling === "number" ? L(`${amount} (en fazla ${formatPrice(b.ceiling, b.currency ?? null)})`, `${amount} (at most ${formatPrice(b.ceiling, b.currency ?? null)})`) : amount;
};

const levelText = (v: unknown): string => (typeof v === "number" && LEVEL_LABELS[v] ? lowerText(LEVEL_LABELS[v]) : L("varsayılan", "default"));
const criterionText = (c: string) => CRITERION_LABELS[c as CriterionId] ?? c;
const categoryText = (c: string) => CATEGORY_LABELS[c as Category] ?? c;

const record = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** One line per criterion whose level changed ("Fiyat çok önemli → önemli"). */
function levelLines(field: SyncedField, a: unknown, b: unknown, prefix: string | null): DiffLine[] {
  const x = record(a);
  const y = record(b);
  const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => x[k] !== y[k]);
  return keys.map((k) => ({
    field,
    label: fieldLabel(field),
    subject: prefix ? `${prefix} · ${criterionText(k)}` : criterionText(k),
    before: levelText(x[k]),
    after: levelText(y[k]),
  }));
}

const listText = (values: string[]) => (values.length ? values.join(", ") : none());

const amenitiesText = (v: unknown): string =>
  listText((Array.isArray(v) ? v : []).filter((a): a is Amenity => typeof a === "string").map((a) => amenityLabel(a)));

const requirementsText = (v: unknown): string =>
  listText(
    (Array.isArray(v) ? v : [])
      .filter((r): r is Requirement => Boolean(r && typeof r === "object" && typeof (r as Requirement).kind === "string"))
      .map((r) => {
        try {
          return requirementLabel(r);
        } catch {
          return String((r as Requirement).kind);
        }
      }),
  );

/** "Sabine, Ali · 3 kişi", "yok". */
const travellersText = (v: unknown): string => {
  const t = record(v);
  const names = (Array.isArray(t.names) ? t.names : []).filter((n): n is string => typeof n === "string" && n.trim() !== "");
  const count = typeof t.count === "number" && t.count > 0 ? t.count : null;
  if (!names.length && !count) return none();
  const people = count ? L(`${count} kişi`, count === 1 ? "1 person" : `${count} people`) : null;
  return [names.join(", "), people].filter(Boolean).join(" · ");
};

/** What one field changed from and to, as lines (priorities: one per criterion). */
function fieldLines(field: SyncedField, a: unknown, b: unknown): DiffLine[] {
  const line = (before: string, after: string): DiffLine[] => (before === after ? [] : [{ field, label: fieldLabel(field), subject: null, before, after }]);
  switch (field) {
    case "title":
      return line(typeof a === "string" && a ? a : none(), typeof b === "string" && b ? b : none());
    case "confirmedDates":
      return line(datesText(a), datesText(b));
    case "budget":
      return line(budgetText(a), budgetText(b));
    case "priorities":
      return levelLines(field, a, b, null);
    case "categoryPriorities": {
      const x = record(a);
      const y = record(b);
      return [...new Set([...Object.keys(x), ...Object.keys(y)])]
        .filter((c) => stableJson(x[c]) !== stableJson(y[c]))
        .flatMap((c) => levelLines(field, x[c], y[c], categoryText(c)));
    }
    case "wantedAmenities":
      return line(amenitiesText(a), amenitiesText(b));
    case "requirements":
      return line(requirementsText(a), requirementsText(b));
    case "travellers":
      return line(travellersText(a), travellersText(b));
  }
}

/** Every change between two settings, field by field, in SYNCED_FIELDS order. */
export function diffSettings(prev: SyncedSettings | unknown, next: SyncedSettings | unknown): DiffLine[] {
  const a = asSettings(prev);
  const b = asSettings(next);
  return changedFields(a, b).flatMap((f) => fieldLines(f, a[f], b[f]));
}

/** "Tarihler: 7–18 Ekim → 8–18 Ekim", "Öncelikler: Fiyat çok önemli → önemli". */
export const lineText = (l: DiffLine): string => `${l.label}: ${l.subject ? `${l.subject} ` : ""}${l.before} → ${l.after}`;
