// The category's date rail (plan v14, onay paketi 2026-10-21: "kategori içi zaman çizgisi"): what the date column says
// beside each intent of a dated category (Uçuş, Konaklama, Ulaşım) and which of a stay's stretches is an empty night the
// rail draws amber. A day is "24 Mar" over its weekday ("Çarşamba"); a stretch of nights is one range ("24–27 Mar") over
// its weekdays ("Çar → Cmt") and its count ("3 gece"); a rental the same in days ("28–30 Mar", "3 gün"). Nothing known,
// nothing said (C19): an intent with no day has an empty column and its dot alone.
// Pure; app/plan/v82/TimelineRail.tsx draws what it says.
import { L, locale } from "./i18n";
import type { IntentVM } from "./intents";
import type { Item } from "./types";
import { isoDate } from "./items";
import { addDays } from "./plan";

/** The categories whose intents are laid on the date rail (the rest keep their grid). */
export const DATED_SECTIONS = ["flight", "stay", "transport"] as const;
export const isDatedSection = (section: string): boolean => (DATED_SECTIONS as readonly string[]).includes(section);

export interface RailDate {
  /** Big: "24 Mar", or a stretch "24–27 Mar" / "31 Mar – 2 Nis". */
  when: string;
  /** Under it: the weekday ("Çarşamba"), a stretch's two ("Çar → Cmt"). */
  sub: string | null;
  /** A stretch's count in its colour: "3 gece", a rental's "3 gün"; null for a day. */
  span: string | null;
  /** A stretch's notches on the rail: one per night (a rental: per day); 0 for a day. */
  notches: number;
}

const at = (date: string) => new Date(`${date}T12:00:00Z`);
const dayMonth = (date: string) => at(date).toLocaleDateString(locale(), { day: "numeric", month: "short", timeZone: "UTC" });
const dayOnly = (date: string) => at(date).toLocaleDateString(locale(), { day: "numeric", timeZone: "UTC" });
const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);
/** "27 Kasım": a stay's check-in on its rail, the month in full (onay paketi 2026-10-22). */
export const dayMonthLong = (date: string) => at(date).toLocaleDateString(locale(), { day: "numeric", month: "long", timeZone: "UTC" });
export const weekdayLong = (date: string) => at(date).toLocaleDateString(locale(), { weekday: "long", timeZone: "UTC" });
export const weekdayShort = (date: string) => at(date).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" }).replace(/\.$/, "");

/** "24–27 Mar" within a month, "31 Mar – 2 Nis" across two. */
export function stretchText(start: string, end: string): string {
  if (start === end) return dayMonth(start);
  return sameMonth(start, end) ? `${dayOnly(start)}–${dayMonth(end)}` : `${dayMonth(start)} – ${dayMonth(end)}`;
}

/** A stay's nights ("3 gece") or a rental's days ("3 gün"). */
export function spanText(n: number, unit: "night" | "day"): string {
  return unit === "night" ? L(`${n} gece`, `${n} night${n === 1 ? "" : "s"}`) : L(`${n} gün`, `${n} day${n === 1 ? "" : "s"}`);
}

/** A rental's days and its return day, from its ticket (a car, a scooter, a camper, a bike). */
function rentalStretch(vm: Pick<IntentVM, "ticket" | "head" | "chosen">): { start: string; end: string; days: number } | null {
  const r = vm.ticket?.rental;
  if (!r) return null;
  const start = isoDate(vm.head.date) ?? isoDate(vm.chosen?.item.dates.start);
  const end = isoDate(vm.chosen?.item.dates.end);
  if (!start) return null;
  if (end && end > start) {
    const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
    return { start, end, days };
  }
  if (r.days && r.days > 1) return { start, end: addDays(start, r.days - 1), days: r.days };
  return null;
}

/** What the date column says beside an intent; null when it has no day. */
export function railDate(vm: Pick<IntentVM, "kind" | "head" | "ticket" | "chosen">): RailDate | null {
  const start = isoDate(vm.head.date);
  if (!start) return null;
  // A stay: its check-in in full and its nights, always two lines, a month changing or not (onay paketi 2026-10-22, "B · giriş
  // ve gece"); its check-out day is its card's third line (stayCheckOut).
  if (vm.kind === "stay" && vm.head.nights > 0) {
    return { when: dayMonthLong(start), sub: null, span: spanText(vm.head.nights, "night"), notches: vm.head.nights };
  }
  const rental = rentalStretch(vm);
  if (rental) {
    return { when: stretchText(rental.start, rental.end), sub: `${weekdayShort(rental.start)} → ${weekdayShort(rental.end)}`, span: spanText(rental.days, "day"), notches: rental.days };
  }
  return { when: dayMonth(start), sub: weekdayLong(start), span: null, notches: 0 };
}

/** A stay's check-out in words for its card's third line: "Çıkış 1 Aralık Salı". */
export function stayCheckOut(vm: Pick<IntentVM, "kind" | "head">): string | null {
  const start = isoDate(vm.head.date);
  if (vm.kind !== "stay" || !start || vm.head.nights <= 0) return null;
  const end = addDays(start, vm.head.nights);
  return L(`Çıkış ${dayMonthLong(end)} ${weekdayLong(end)}`, `Check-out ${weekdayLong(end)} ${dayMonthLong(end)}`);
}

/** A stretch the rail draws as a slice (its dot at the start, the slice's end at the last night or day). */
export const isStretch = (d: RailDate | null): boolean => d != null && d.notches > 0;

/**
 * The empty nights (onay paketi, Konaklama: "boş gece amber"): a stay intent nothing is saved for, between two stays on
 * the rail, short (at most two nights), not yet looked for with options. Its row says which night and why it's open; its
 * one button stays "Ara".
 */
export const EMPTY_NIGHT_MAX = 2;

export function emptyNights(list: readonly Pick<IntentVM, "key" | "kind" | "status" | "head" | "itemIds" | "options">[]): Set<string> {
  const stays = list.filter((v) => v.kind === "stay" && isoDate(v.head.date) && v.head.nights > 0).sort((a, b) => a.head.date!.localeCompare(b.head.date!));
  const out = new Set<string>();
  stays.forEach((v, i) => {
    if (i === 0 || i === stays.length - 1) return;
    if (v.itemIds.length || v.options.length || v.status !== "searching" || v.head.nights > EMPTY_NIGHT_MAX) return;
    out.add(v.key);
  });
  return out;
}

/** The empty night's two lines: "30 Mar gecesi boş" and "Chiang Mai çıkışı 30 Mar, Bangkok girişi 31 Mar". */
export function emptyNightText(
  gap: Pick<IntentVM, "head">,
  before: Pick<IntentVM, "head"> | null,
  after: Pick<IntentVM, "head"> | null,
): { title: string; line: string | null } {
  const start = gap.head.date!;
  const n = gap.head.nights;
  const title = n === 1 ? L(`${dayMonth(start)} gecesi boş`, `${dayMonth(start)}: no bed yet`) : L(`${stretchText(start, addDays(start, n))} · ${n} gece boş`, `${stretchText(start, addDays(start, n))}: ${n} nights with no bed`);
  const out = before?.head.city && before.head.date ? L(`${before.head.city} çıkışı ${dayMonth(addDays(before.head.date, before.head.nights))}`, `${before.head.city} check-out ${dayMonth(addDays(before.head.date, before.head.nights))}`) : null;
  const into = after?.head.city && after.head.date ? L(`${after.head.city} girişi ${dayMonth(after.head.date)}`, `${after.head.city} check-in ${dayMonth(after.head.date)}`) : null;
  return { title, line: [out, into].filter(Boolean).join(", ") || null };
}

export interface Overlap {
  /** The later of the two stays' record (the row of the intent holding it carries the warning). */
  key: string;
  /** The first night both hold, and how many. */
  night: string;
  nights: number;
  /** Their two lines' words: "Chiang Mai (27–30 Mar)". */
  first: string;
  second: string;
}

type StayRecord = Pick<Item, "id" | "category" | "status" | "city" | "name" | "dates">;
const held = (i: StayRecord) => i.category === "stay" && (i.status === "chosen" || i.status === "booked") && isoDate(i.dates.start) != null && isoDate(i.dates.end) != null && i.dates.end! > i.dates.start!;
const stayWords = (i: StayRecord) => `${i.city ?? i.name} (${stretchText(i.dates.start!.slice(0, 10), i.dates.end!.slice(0, 10))})`;

/**
 * The empty night's opposite (onay paketi, Kaçırdıklarımız 3): two stays chosen or booked for the same night, one of them paid
 * for nothing (the plan shows the one that wins the nights; the other still holds them). Each such pair once, keyed by the
 * later record; nights only one of them holds aren't counted.
 */
export function overlapNights(items: readonly StayRecord[]): Map<string, Overlap> {
  const stays = items.filter(held).sort((a, b) => a.dates.start!.localeCompare(b.dates.start!));
  const out = new Map<string, Overlap>();
  for (let i = 0; i < stays.length; i++) {
    for (let j = i + 1; j < stays.length; j++) {
      const a = stays[i], b = stays[j];
      const start = b.dates.start!.slice(0, 10) > a.dates.start!.slice(0, 10) ? b.dates.start!.slice(0, 10) : a.dates.start!.slice(0, 10);
      const end = a.dates.end!.slice(0, 10) < b.dates.end!.slice(0, 10) ? a.dates.end!.slice(0, 10) : b.dates.end!.slice(0, 10);
      if (start >= end || out.has(b.id)) continue;
      const nights = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
      out.set(b.id, { key: b.id, night: start, nights, first: stayWords(a), second: stayWords(b) });
    }
  }
  return out;
}

/** "29 Mar gecesi iki konaklama" and "Chiang Mai (27–30 Mar) ve Pai (29–31 Mar) çakışıyor · biri boşa ödenir". */
export function overlapText(o: Overlap): { title: string; line: string } {
  const title = o.nights === 1 ? L(`${dayMonth(o.night)} gecesi iki konaklama`, `Two stays on the night of ${dayMonth(o.night)}`) : L(`${stretchText(o.night, addDays(o.night, o.nights))} · ${o.nights} gece iki konaklama`, `Two stays for ${o.nights} nights, ${stretchText(o.night, addDays(o.night, o.nights))}`);
  return { title, line: L(`${o.first} ve ${o.second} çakışıyor · biri boşa ödenir`, `${o.first} and ${o.second} overlap · one is paid for nothing`) };
}

/** A closed category's alerts (Kaçırdıklarımız 6): "1 gece boş" in amber, "1 gece çakışıyor" in red; none, nothing. */
export function nightAlerts(list: readonly Pick<IntentVM, "key" | "kind" | "status" | "head" | "itemIds" | "options">[], items: readonly StayRecord[] = []): { text: string; tone: "warn" | "bad" }[] {
  const gap = [...emptyNights(list)].reduce((n, k) => n + (list.find((v) => v.key === k)?.head.nights ?? 0), 0);
  const clash = [...overlapNights(items).values()].reduce((n, o) => n + o.nights, 0);
  return [
    ...(gap ? [{ text: L(`${gap} gece boş`, `${gap} night${gap > 1 ? "s" : ""} with no bed`), tone: "warn" as const }] : []),
    ...(clash ? [{ text: L(`${clash} gece çakışıyor`, `${clash} night${clash > 1 ? "s" : ""} overlap`), tone: "bad" as const }] : []),
  ];
}

/**
 * Kaçırdıklarımız (tarihsiz niyet): on the date rail the needs with no day yet go under it, in the order they had, after a
 * "Tarihi yok" line; the rest keep theirs. `first`: the key the line goes over (null: every one has its day).
 */
export function undatedLast<T extends Pick<IntentVM, "key" | "head">>(list: readonly T[]): { list: T[]; first: string | null } {
  const dated = list.filter((v) => isoDate(v.head.date) != null);
  const undated = list.filter((v) => isoDate(v.head.date) == null);
  return { list: [...dated, ...undated], first: undated[0]?.key ?? null };
}
