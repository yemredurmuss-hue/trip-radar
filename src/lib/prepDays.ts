// Hazırlık's chores and their days (v82 geçişi aşama 7; Etsy kararı T3 a, docs/superpowers/specs/2026-10-18-v82-gecis/
// etsy/etsy-kararlar.md; tasarım notu "v83 ek · Hazırlık"). Each chore carries its own day, the list goes by day and the
// ones without a day come last (never "tarih yok"). A day is only what the trip says, never a guess:
//   - a stored chore's own date: said in the chat ("vizeye 1 Mart'a kadar başvur"; later the payment left to pay at the
//     hotel, T4 b, rides on the same record: a chore with a date);
//   - worked out from a record: an online check-in opens 24 hours before a booked flight leaves; a bought eSIM is put in
//     before leaving; a Schengen visa is applied for at the latest 15 days before the trip (EU Visa Code, Regulation (EC)
//     No 810/2009 art. 9(1)); another visa the table knows (Sri Lanka's ETA, the UK's) before leaving, no lead time made
//     up; Japan's Visit Japan Web and Thailand's Digital Arrival Card are filled in before landing
//     (https://www.vjw.digital.go.jp/, https://tdac.immigration.go.th/).
// The worked-out ones aren't stored: only what the traveller did with one is (ticked: trip.prepDone; taken off:
// trip.hidden's `prep:<key>`). Pure.
import { cityOfAirport } from "./airports";
import { L, lang } from "./i18n";
import { ablative } from "./i18nText";
import { SCHENGEN, visaDoneOf, visaFor } from "./visa";
import type { Item, Trip } from "./types";

/** Where a chore (and its day) came from: its small label ("uçuş kartından"). */
export type PrepFrom = "flight" | "esim" | "visa" | "chat";

export interface PrepDay {
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM, when the day is a moment (a check-in opening, a time said with it). */
  time: string | null;
  /** On the day ("9 Nis"), at a moment ("15 Nis 11:00"), by a deadline ("1 Nis'e kadar"), before leaving ("1 Nis'ten önce"). */
  rel: "on" | "at" | "by" | "before";
}

export interface PrepTask {
  /** Stable: `item:<id>` for a stored chore, else what it's worked out from (`checkin:<flight id>`, `visa:schengen`). */
  key: string;
  title: string;
  sub: string | null;
  day: PrepDay | null;
  from: PrepFrom | null;
  done: boolean;
  /** When it was ticked ("Yapıldı · 12 Eki"); null when not, or not known. */
  doneAt: number | null;
  /** The stored chore it is; null for one worked out from the trip. */
  item: Item | null;
  /** The record it's worked out from (the flight, the eSIM). */
  of: Item | null;
  /** Its official page ("Resmî site ↗"). */
  official: string | null;
  /**
   * What its tick writes: the chore's own doneAt, the eSIM's "Kurdum", a mark on the trip (trip.prepDone), or for the visa
   * that mark with "✓ Vize alındı" (ticked by either; taken back from both).
   */
  tick: "record" | "installed" | "mark" | "visa";
}

export interface PrepInput {
  /** The stored chores (Hazırlık's records without the Bavul's lines: prepPack.ts isPackLine). */
  chores: Item[];
  /** The trip's records as the board shows them. */
  items: Item[];
  trip: Pick<Trip, "prepDone" | "hidden" | "visaDone">;
  /** The trip's first and last day. */
  range: { start: string; end: string } | null;
  /** The passport the visa rules answer for (Settings → Pasaport, else home); null: not known, no visa chore. */
  passport: string | null;
  /** The countries the trip goes to (ISO 3166-1 alpha-2), in the order its places come. */
  countries: string[];
  /** YYYY-MM-DD. */
  today: string;
}

/** A chore whose day is this close (or gone by) and still open is orange ("yaklaşan gün", F2's 14 days). */
export const PREP_SOON_DAYS = 14;
/** An online check-in opens this long before the flight leaves. */
export const CHECKIN_HOURS = 24;
/** A Schengen visa application is lodged at the latest this many days before the trip (EU Visa Code art. 9(1)). */
export const SCHENGEN_LEAD_DAYS = 15;

/** The key a worked-out chore taken off is kept under in trip.hidden. */
export const prepHiddenKey = (key: string) => `prep:${key}`;

const DAY_MS = 86_400_000;
const isDay = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** Whole days from `from` to `to` (negative when gone by). */
export const daysUntil = (to: string, from: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
const live = (i: Item) => i.status !== "dismissed" && !i.cancelledAt;

/** "2026-10-14T19:40" → its day and clock; null for anything else. */
function moment(text: string | null | undefined): { date: string; time: string } | null {
  const m = text?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m && isDay(m[1]) ? { date: m[1], time: m[2] } : null;
}

/** The day the trip leaves: its first flight's, else its first day. */
function leaveDay(items: Item[], range: PrepInput["range"]): string | null {
  const firsts = items
    .filter((i) => live(i) && i.category === "flight")
    .map((i) => moment(i.flight?.departure)?.date ?? (isDay(i.dates.start) ? i.dates.start : null))
    .filter(isDay)
    .sort();
  return firsts[0] ?? range?.start ?? null;
}

/** Online check-in per booked flight that hasn't left: it opens 24 hours before, at the same clock the day before. */
function checkins(items: Item[], today: string): PrepTask[] {
  return items
    .filter((i) => live(i) && i.category === "flight" && i.status === "booked")
    .flatMap((f): PrepTask[] => {
      const at = moment(f.flight?.departure);
      if (!at || at.date < today) return [];
      const no = f.flight?.flightNumber?.trim() || f.flight?.carrier?.trim() || null;
      const ends = f.flight?.from && f.flight?.to ? `${cityOfAirport(f.flight.from)} → ${cityOfAirport(f.flight.to)} · ` : "";
      return [
        {
          key: `checkin:${f.id}`,
          title: no ? `Online check-in · ${no}` : "Online check-in",
          sub: `${ends}${L(`kalkıştan ${CHECKIN_HOURS} saat önce açılır`, `opens ${CHECKIN_HOURS} hours before take-off`)}`,
          day: { date: addDays(at.date, -CHECKIN_HOURS / 24), time: at.time, rel: "at" },
          from: "flight",
          done: false,
          doneAt: null,
          item: null,
          of: f,
          official: null,
          tick: "mark",
        },
      ];
    });
}

/** A bought eSIM to put in before leaving: its card's "Kurdum" ticks it here too, and the other way round. */
function esims(items: Item[], leave: string | null): PrepTask[] {
  return items
    .filter((i) => live(i) && i.category === "esim" && i.status === "booked")
    .map((e) => ({
      key: `esim:${e.id}`,
      title: L(`eSIM'i kur · ${e.name}`, `Install the eSIM · ${e.name}`),
      sub: L("Yola çıkmadan kur", "Install it before you leave"),
      day: leave ? { date: leave, time: null, rel: "before" as const } : null,
      from: "esim" as const,
      done: Boolean(e.installedAt),
      doneAt: e.installedAt ?? null,
      item: null,
      of: e,
      official: null,
      tick: "installed" as const,
    }));
}

/** A Schengen visa to apply for, by the rule's last day; ticked with "✓ Vize alındı" too. */
function schengen(input: PrepInput): PrepTask | null {
  const there = input.countries.find((c) => SCHENGEN.includes(c) && visaFor(input.passport, c).kind === "visa");
  if (!there || !input.range) return null;
  return {
    key: "visa:schengen",
    title: L("Schengen vizesine başvur", "Apply for the Schengen visa"),
    sub: L(`Başvuru en geç gidişten ${SCHENGEN_LEAD_DAYS} gün önce`, `Apply at least ${SCHENGEN_LEAD_DAYS} days before you go`),
    day: { date: addDays(input.range.start, -SCHENGEN_LEAD_DAYS), time: null, rel: "by" },
    from: "visa",
    done: visaDoneOf(input.trip),
    doneAt: null,
    item: null,
    of: null,
    official: visaFor(input.passport, there).link,
    tick: "visa",
  };
}

/**
 * A visa outside Schengen the passport needs (the visa table: Sri Lanka's ETA, the UK's, the US's; Indonesia's e-VOA, or
 * the visa on arrival): got before leaving, from the visa rule, with its official page. No lead time is said where the rule
 * gives none. Ticked with Belgeler's "Var" too, and the other way round (one mark: visa.ts visaDoneOf).
 */
function otherVisas(input: PrepInput): PrepTask[] {
  const leave = leaveDay(input.items, input.range);
  return input.countries.flatMap((code): PrepTask[] => {
    if (SCHENGEN.includes(code)) return [];
    const visa = visaFor(input.passport, code);
    if ((visa.kind !== "visa" && visa.kind !== "arrival") || !visa.apply) return [];
    const sub = visa.kind === "arrival" ? L("Varışta da alınabilir, ücretli", "Can also be bought on arrival; a fee is paid") : null;
    return [{ key: `visa:${code}`, title: visa.apply, sub, day: leave ? { date: leave, time: null, rel: "before" } : null, from: "visa", done: visaDoneOf(input.trip), doneAt: null, item: null, of: null, official: visa.link, tick: "visa" }];
  });
}

/** The entry forms filled in online before landing, by country, with their official page. */
const ENTRY_FORMS: Readonly<Record<string, { title: () => string; sub: () => string; url: string; said: RegExp }>> = {
  JP: {
    title: () => L("Visit Japan Web'e kaydol", "Register on Visit Japan Web"),
    sub: () => L("Giriş ve gümrük formu; havalimanında QR kodla geçersin", "The entry and customs form; you pass with a QR code at the airport"),
    url: "https://www.vjw.digital.go.jp/",
    said: /visit japan/i,
  },
  TH: {
    title: () => L("Thailand Digital Arrival Card doldur", "Fill in the Thailand Digital Arrival Card"),
    sub: () => L("Varıştan önceki 3 gün içinde doldurulur", "Filled in within the 3 days before you land"),
    url: "https://tdac.immigration.go.th/",
    said: /\btdac\b|arrival card/i,
  },
};

/** The day one lands in a country: its first stay or plan there, else the trip's first day. */
function arriveIn(code: string, items: Item[], range: PrepInput["range"]): string | null {
  const there = items
    .filter((i) => live(i) && i.category !== "flight" && i.countryCode?.toUpperCase() === code && isDay(i.dates.start))
    .map((i) => i.dates.start!)
    .sort();
  return there[0] ?? range?.start ?? null;
}

function entries(input: PrepInput): PrepTask[] {
  return input.countries.flatMap((code): PrepTask[] => {
    const form = ENTRY_FORMS[code];
    if (!form || input.chores.some((c) => form.said.test(c.name))) return [];
    const by = arriveIn(code, input.items, input.range);
    return [{ key: `entry:${code}`, title: form.title(), sub: form.sub(), day: by ? { date: by, time: null, rel: "by" } : null, from: null, done: false, doneAt: null, item: null, of: null, official: form.url, tick: "mark" }];
  });
}

/** A stored chore: its own date when it has one (said in the chat), the time said with it. */
export function storedTask(item: Item): PrepTask {
  const date = isDay(item.dates.start) ? item.dates.start : null;
  const at = moment(item.flight?.departure);
  const time = date && at?.date === date ? at.time : null;
  return {
    key: `item:${item.id}`,
    title: item.name,
    sub: item.summary?.trim() || null,
    day: date ? { date, time, rel: time ? "at" : "on" } : null,
    // The label says where a day came from: a dated chore said in the chat.
    from: date && item.origin === "chat" ? "chat" : null,
    done: Boolean(item.doneAt),
    doneAt: item.doneAt ?? null,
    item,
    of: null,
    official: null,
    tick: "record",
  };
}

const VISA_SAID = /(^|[^\p{L}])(vize\p{L}*|visas?|schengen|eta)(?![\p{L}])/iu;
const CHECKIN_SAID = /check-?in/i;

/**
 * Hazırlık's list: the stored chores and the ones worked out from the trip, by day (a moment by its clock), the ones
 * without a day last in their own order. What's done stays where it is. A worked-out chore the traveller said themselves
 * ("vize başvurusu yap", "online check-in yap") isn't worked out again; one taken off stays off.
 */
export function prepTasks(input: PrepInput): PrepTask[] {
  const said = (re: RegExp) => input.chores.some((c) => re.test(c.name));
  const worked = [
    ...(said(CHECKIN_SAID) ? [] : checkins(input.items, input.today)),
    ...esims(input.items, leaveDay(input.items, input.range)),
    ...(said(VISA_SAID) ? [] : [schengen(input)].filter((t): t is PrepTask => t != null)),
    ...(said(VISA_SAID) ? [] : otherVisas(input)),
    ...entries(input),
  ]
    .filter((t) => !input.trip.hidden?.includes(prepHiddenKey(t.key)))
    .map((t) => {
      const at = input.trip.prepDone?.[t.key];
      return at && (t.tick === "mark" || t.tick === "visa") ? { ...t, done: true, doneAt: at } : t;
    });
  const all = [...input.chores.map(storedTask), ...worked];
  // A day's moments by their clock, then what's for the whole day; the chores without a day after all, in their own order.
  const order = (t: PrepTask) => (t.day ? `${t.day.date} ${t.day.time ?? "99:99"}` : "9999-99-99");
  return all
    .map((t, i) => ({ t, i, o: order(t) }))
    .sort((a, b) => (a.o < b.o ? -1 : a.o > b.o ? 1 : a.i - b.i))
    .map(({ t }) => t);
}

const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A Turkish abbreviation in the dative ("Nis'e", "Eki'ye", "Kas'a"): by its last vowel, a buffer y after a vowel. */
export function dative(word: string): string {
  const w = word.trim();
  const lower = w.toLocaleLowerCase("tr-TR");
  const last = [...lower].reverse().find((ch) => /[aıoueiöü]/.test(ch));
  const front = last != null && /[eiöü]/.test(last);
  return `${w}'${/[aıoueiöü]$/.test(lower) ? "y" : ""}${front ? "e" : "a"}`;
}

/** "15 Nis 11:00" · "1 Nis'e kadar" · "1 Nis'ten önce" · "9 Nis" (English: "15 Apr 11:00", "by 1 Apr", "before 1 Apr", "9 Apr"). */
export function prepDayText(day: PrepDay): string {
  const [, m, d] = day.date.split("-").map(Number);
  const tr = lang() === "tr";
  const month = (tr ? MONTHS_TR : MONTHS_EN)[m - 1];
  switch (day.rel) {
    case "by":
      return tr ? `${d} ${dative(month)} kadar` : `by ${d} ${month}`;
    case "before":
      return tr ? `${d} ${ablative(month)} önce` : `before ${d} ${month}`;
    default:
      return `${d} ${month}${day.time ? ` ${day.time}` : ""}`;
  }
}

/**
 * How a still open chore's day reads: "soon" (within PREP_SOON_DAYS: orange), "past" (gone by: said "geçti", a soft red, never the
 * orange of what is coming), else plain. A done one is plain.
 */
export function prepDayTone(task: Pick<PrepTask, "day" | "done">, today: string): "soon" | "past" | null {
  if (task.done || !task.day) return null;
  const days = daysUntil(task.day.date, today);
  return days < 0 ? "past" : days <= PREP_SOON_DAYS ? "soon" : null;
}

/** The small label of where it came from ("uçuş kartından", "sohbetten", "vize kuralından"). */
export function prepFromText(from: PrepFrom): string {
  switch (from) {
    case "flight":
      return L("uçuş kartından", "from the flight");
    case "esim":
      return L("eSIM kartından", "from the eSIM");
    case "visa":
      return L("vize kuralından", "from the visa rule");
    case "chat":
      return L("sohbetten", "from the chat");
  }
}

export interface PrepSummary {
  total: number;
  done: number;
  /** The first open chore with a day: what comes next. */
  next: PrepTask | null;
  /** The closed row's line: "Gezi öncesi 6 iş · sıradaki: Yen bozdur, 1 Nis'ten önce"; null with nothing to do. */
  line: string | null;
  /** The same next for another surface (Yolculuk sırasıyla): "sıradaki 1 Nis'ten önce: Yen bozdur"; null with none. */
  nextText: string | null;
}

/** What the closed Hazırlık row and the journey's prep step say. */
export function prepSummary(tasks: PrepTask[], today?: string): PrepSummary {
  const done = tasks.filter((t) => t.done).length;
  const next = tasks.find((t) => !t.done && t.day) ?? null;
  // (a day gone by is said so here too, as on its row: "23 Eyl'e kadar · geçti")
  const gone = next && today && prepDayTone(next, today) === "past" ? L(" · geçti", " · passed") : "";
  const when = next?.day ? `${prepDayText(next.day)}${gone}` : null;
  const total = tasks.length;
  const head = L(`Gezi öncesi ${total} iş`, total === 1 ? "1 thing before the trip" : `${total} things before the trip`);
  return {
    total,
    done,
    next,
    line: total ? (next ? L(`${head} · sıradaki: ${next.title}, ${when}`, `${head} · next: ${next.title}, ${when}`) : head) : null,
    nextText: next ? L(`sıradaki ${when}: ${next.title}`, `next ${when}: ${next.title}`) : null,
  };
}
