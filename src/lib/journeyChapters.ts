// "Yolculuk sırasıyla" as the v81–v83 drawing has it (plan-v81-yolculuk; v82 "şehir bölümleri hero'daki fotoğraflarla";
// v83 "gezi sırasında"; C raporu §1.9): the trip in chapters in the order it is lived. "Yola çıkmadan" (Hazırlık, the eSIM,
// insurance), the way in ("İstanbul → Tokyo"), each city (its photo, its days and nights, "2 hazır · 1 karar"), the way
// home. Each step is one of the Plan's boxes, or one card of a city's row: its day ("esnek" in a city without one), the dot
// of its state, its kind and state, its name, one short line and the one thing to do with it now.
//
// Nothing is decided here. The chapters follow the timeline's front (timeline.ts board, the blocks journeyFlow lays out),
// the steps are intents.ts's boxes: a choice made in one view is in the other at once, and "›" goes to that box. D14: a
// night spent on the plane is no gap but an "Uçakta" line on the way. D15: with no dates there is no journey to tell
// (the view switch shows it faded). D8: the chapter today is in says so, the view opens there. K17: what was left open on
// a day gone by is "Kaçtı". Pure.
import { knownAirport } from "./airports";
import { bookingCopies } from "./bookingRows";
import type { Brand } from "./brands";
import { cardKind, cardKindLabel, TICKET_MODES, type CardKind } from "./cardKinds";
import type { SectionId } from "./categories";
import { L } from "./i18n";
import { count, nNights, nOptions } from "./i18nText";
import { shortDay } from "./ideas";
import { collectionsOf, storedPrep, type Collection, type IntentInput, type IntentStatus, type IntentVM, type OptionVM } from "./intents";
import { formatDateRange, isoDate } from "./items";
import { clockOf } from "./legs";
import { addDays, cityKeyOf, sameCity, type DateRange } from "./plan";
import { lookWord } from "./stageWords";
import type { Timeline } from "./timeline";
import { isAboardNight, isMissed, nightsAboard, nightsOf } from "./tripPhase";
import { wayName } from "./tripShape";
import type { Item } from "./types";

export type StepKind = "prep" | "intent" | "item" | "ideas" | "onboard";

/**
 * The step's one button: open Hazırlık, see the options, look for some, take our pick, book what's chosen (on its site),
 * open or add the booking's file, see a city's ideas; a booked flight in its last 48 hours, its check-in (F2).
 */
export type StepActionKind = "list" | "options" | "search" | "take" | "book" | "doc" | "addDoc" | "ideas" | "checkin";

export interface StepAction {
  kind: StepActionKind;
  label: string;
  /** The record it acts on: our pick to take, the choice to book, the booking whose file opens. */
  itemId: string | null;
  /** "Rezerve et" / "Satın al": the page to book it on, and its site's label. */
  url: string | null;
  brand: Brand | null;
}

/** "›": the box the step is in the Plan (intents.ts key and DOM keys), and the record when it's one card of a row. */
export interface StepTarget {
  intentKey: string;
  section: SectionId;
  domKeys: string[];
  itemId: string | null;
}

export interface JourneyStep {
  key: string;
  kind: StepKind;
  date: string | null;
  /** "2 Nis"; "esnek" for something in a city with no day yet; "" before the trip (Yola çıkmadan). */
  dateLabel: string;
  time: string | null;
  /** The dot on the line: the box's state (a card: chosen or booked); null for Hazırlık, the ideas and the night on the plane. */
  status: IntentStatus | null;
  /** Left open and its day has gone by (K17): "Kaçtı", no button, not counted. */
  missed: boolean;
  /** Bought, arranged or covered by another booking: counted in "n hazır". */
  ready: boolean;
  /** "Konaklama", "Tren", "Etkinlik", "Yer". */
  kindWord: string;
  /** What it is, for its picture when it has none (a stay's, a train's drawing); null for Hazırlık, the ideas, the night. */
  cardKind: CardKind | null;
  /** "Rezerve edildi", "Önerimiz, onayla", "Planda", "Kaçtı". */
  statusText: string;
  title: string;
  sub: string | null;
  image: string | null;
  code: { label: string; value: string } | null;
  /** Booked with no file, in the last two weeks (F2, B15): the amber "Belge yok". */
  docMissing: boolean;
  /** What our pick or the choice costs, short ("€213", "€104"); its unit is in `sub`. */
  price: string | null;
  action: StepAction | null;
  target: StepTarget | null;
}

export type ChapterKind = "before" | "travel" | "city";

export interface JourneyChapter {
  key: string;
  kind: ChapterKind;
  /** "Yola çıkmadan", "İstanbul → Tokyo", "Tokyo". */
  title: string;
  /** "Gezi öncesi", "1 Nisan", "2–5 Nisan · 3 gece". */
  sub: string;
  city: string | null;
  range: DateRange | null;
  nights: number;
  /** A way in or home: its day. */
  date: string | null;
  /** A city's picture, the hero's own (Trip.cityImages by cityKeyOf); no photo known: url null, never a guess. */
  photo: { key: string; url: string | null } | null;
  steps: JourneyStep[];
  /** "2 hazır · 1 karar": its steps done and still to do (the ideas, the night on the plane and what was missed aside). */
  summary: { ready: number; open: number; text: string };
  /** D8: today falls in it (the view opens here, with "Bugün" on it). */
  today: boolean;
  /** K17: its days are behind (folded during the trip). */
  past: boolean;
}

export interface JourneyView {
  /** D15: without dates there's no order to tell: the view switch shows it faded, with `reason`. */
  available: boolean;
  reason: string | null;
  chapters: JourneyChapter[];
  /** The chapter today is in (during the trip), else null. */
  todayKey: string | null;
}

export interface JourneyInput {
  input: IntentInput;
  timeline: Timeline;
  /** collectionsOf(input), when the Plan has it already. */
  collections?: readonly Collection[];
}

/** D15: why the view is shut on a trip without dates. */
export const journeyClosedReason = (): string => L("Tarihler belli olunca açılır", "Opens once the dates are set");

/** A price in a few words and its unit: a stay's by the night, a ticket's for one, else the whole. */
export function compactPrice(o: Pick<OptionVM, "price" | "ticket">): { amount: string; unit: string | null } | null {
  if (o.ticket?.each) return { amount: o.ticket.each, unit: L("kişi başı", "each") };
  if (o.price?.perNight) return { amount: o.price.perNight.split(" / ")[0], unit: L("/ gece", "/ night") };
  if (o.ticket) return { amount: o.ticket.total, unit: null };
  if (o.price) return { amount: o.price.text, unit: o.price.label };
  return null;
}
const priceWords = (p: { amount: string; unit: string | null } | null) => (p ? [p.amount, p.unit].filter(Boolean).join(" ") : null);

const ticketed = (kind: CardKind) => (TICKET_MODES as readonly string[]).includes(kind) || kind === "activity";

/** A booking's state in a step: a stay or a table "Rezerve edildi", an eSIM or a policy "Satın alındı", a ticket "Bilet alındı". */
function bookedWord(kind: CardKind): string {
  if (kind === "esim" || kind === "insurance") return L("Satın alındı", "Bought");
  return ticketed(kind) ? lookWord("booked", { as: "ticket" }) : L("Rezerve edildi", "Booked");
}

/** The words of a box's state on its step (v81: "tür · durum"). */
export function stepStatusText(status: IntentStatus, kind: CardKind): string {
  switch (status) {
    case "searching":
      return L("Aranıyor", "Searching");
    case "deciding":
      return L("Karar bekliyor", "To decide");
    case "suggested":
      return L("Önerimiz, onayla", "Our pick, take it");
    case "chosen":
      return lookWord("chosen");
    case "booked":
      return bookedWord(kind);
    case "arranged":
      return lookWord("arranged");
    case "included":
      return L("Dahil", "Included");
    case "skipped":
      return L("Gerek yok", "Not needed");
  }
}

/** The booking's file, by what it is: "Onay e-postası aç", "E-bilet aç", "QR kodu aç", "Rezervasyonu aç", "Bileti aç". */
export function docOpenLabel(kind: CardKind): string {
  if (kind === "stay") return L("Onay e-postası aç", "Open the confirmation");
  if (kind === "flight") return L("E-bilet aç", "Open the e-ticket");
  if (kind === "esim") return L("QR kodu aç", "Open the QR code");
  if (kind === "insurance") return L("Poliçeyi aç", "Open the policy");
  if (kind === "food") return L("Rezervasyonu aç", "Open the booking");
  return L("Bileti aç", "Open the ticket");
}

/** No file yet: "Onayı ekle", "Bileti ekle" (the quiet dashed button). */
export function docAddLabel(kind: CardKind): string {
  if (kind === "stay" || kind === "food") return L("Onayı ekle", "Add the confirmation");
  if (kind === "esim") return L("QR kodu ekle", "Add the QR code");
  if (kind === "insurance") return L("Poliçeyi ekle", "Add the policy");
  return L("Bileti ekle", "Add the ticket");
}

/** "Rezerve et" for a stay, a table or a car; "Satın al" for a ticket, an eSIM, a policy. */
export const bookLabel = (kind: CardKind): string => (ticketed(kind) || kind === "esim" || kind === "insurance" ? L("Satın al", "Buy") : L("Rezerve et", "Book"));

const action = (kind: StepActionKind, label: string, over: Partial<StepAction> = {}): StepAction => ({ kind, label, itemId: null, url: null, brand: null, ...over });

/** An airport the table can't name ("HND") stands for the city it serves on the trip ("Tokyo"). */
const unnamed = (place: string | null | undefined) => !place || (/^[A-Z]{3}$/.test(place) && !knownAirport(place));

interface Env {
  input: IntentInput;
  today: string;
  docs: (id: string) => number;
}

// --- one box's step ----------------------------------------------------------------------------------------------

function intentStep(i: IntentVM, env: Env, title: string): JourneyStep {
  const o = i.chosen;
  const missed = isMissed(i, env.today, env.input.plan);
  const kindWord =
    i.section === "flight" ? cardKindLabel("flight") : i.section === "stay" ? cardKindLabel("stay") : i.kind === "taxi" ? L("Transfer", "Transfer") : (i.head.kindWord ?? cardKindLabel(i.kind));
  const price = o ? compactPrice(o) : null;
  // A flight by its own name ("Turkish Airlines TK49"), any other way by the service ("Shinkansen Hikari").
  const way = o && i.frame === "ticket" ? (i.section === "flight" ? o.title : (wayName(o.item) ?? o.title)) : null;
  const times = o?.leg?.dep && o.leg.arr ? `${o.leg.dep} → ${o.leg.arr}` : null;
  let sub: (string | null)[] = [];
  switch (i.status) {
    case "deciding": {
      const best = i.options[0];
      const bestPrice = best ? compactPrice(best) : null;
      sub = [nOptions(i.optionCount), best ? L(`en iyi: ${best.title}`, `best: ${best.title}`) + (bestPrice ? ` ${bestPrice.amount}` : "") : null];
      break;
    }
    case "searching": {
      const est = i.estimate;
      const unit = est?.unit === "night" ? L(" / gece", " / night") : est?.unit === "person" ? L(" kişi başı", " each") : "";
      sub = [est ? L(`tahmini ${est.label.replace(/^~/, "")}${unit}`, `about ${est.label.replace(/^~/, "")}${unit}`) : null];
      break;
    }
    case "suggested":
    case "chosen":
      // A flight's own name says its airline; a train's service is told by its operator ("Shinkansen Hikari · JR").
      sub = i.frame === "ticket" ? [way, times, i.section === "flight" ? null : (o?.brand?.label ?? null)] : i.section === "stay" ? [o?.brand?.label ?? null, priceWords(price)] : [o?.title ?? null, priceWords(price)];
      break;
    case "booked": {
      const a = i.access;
      sub =
        i.section === "stay"
          ? [o?.brand?.label ?? null, a?.when ?? null, a?.checkIn ? L(`Giriş ${a.checkIn}`, `Check-in ${a.checkIn}`) : null, a?.where ?? null]
          : i.frame === "ticket"
            ? [way, a?.when ?? null]
            : [o?.title ?? null, a?.when ?? null];
      break;
    }
    case "arranged":
    case "included":
      sub = [i.section === "stay" ? null : (o?.title ?? null), i.cover?.by ?? i.note];
      break;
    case "skipped":
      break;
  }
  const date = i.head.date;
  let act: StepAction | null = null;
  if (!missed) {
    if (i.status === "searching") act = action("search", L("Ara", "Search"));
    else if (i.status === "deciding") act = action("options", L("Seçeneklere bak", "See the options"));
    else if (i.status === "suggested" && o) act = action("take", L("Bunu seç", "Take it"), { itemId: o.id });
    else if (i.status === "chosen" && o) act = action("book", bookLabel(i.kind), { itemId: o.id, url: o.item.url, brand: o.brand });
    // F2: a flight leaving within 48 hours leads with its check-in (its PNR is the step's code), as its box does.
    else if (i.status === "booked" && o && i.access?.primary === "checkin") act = action("checkin", L("Check-in", "Check in"), { itemId: o.id, url: o.item.url, brand: o.brand });
    else if (i.status === "booked" && o) act = (i.access?.doc.count ?? 0) > 0 ? action("doc", docOpenLabel(i.kind), { itemId: o.id }) : action("addDoc", docAddLabel(i.kind), { itemId: o.id });
  }
  return {
    key: `step:${i.key}`,
    kind: "intent",
    date,
    dateLabel: date ? shortDay(date) : "",
    time: i.frame === "ticket" ? (o?.leg?.dep ?? null) : null,
    status: i.status,
    missed,
    ready: i.status === "booked" || i.status === "arranged" || i.status === "included",
    kindWord,
    cardKind: i.kind,
    statusText: missed ? L("Kaçtı", "Missed") : stepStatusText(i.status, i.kind),
    // A stay is its city's (the chapter says the city): the place chosen, else the city.
    title: i.section === "stay" ? (o?.title ?? title) : title,
    sub: sub.filter(Boolean).join(" · ") || null,
    image: o?.image ?? i.options[0]?.image ?? i.head.image,
    code: i.status === "booked" ? (i.access?.code ?? null) : null,
    docMissing: i.status === "booked" && Boolean(i.access?.docMissing),
    price: i.status === "suggested" || i.status === "chosen" ? (price?.amount ?? null) : null,
    action: act,
    target: { intentKey: i.key, section: i.section, domKeys: i.domKeys, itemId: null },
  };
}

/** One card of a city's row (an event, a place, a table) put on the plan. */
function itemStep(i: IntentVM, o: OptionVM, env: Env): JourneyStep {
  const item = o.item;
  const booked = item.status === "booked";
  const activity = i.section === "activity";
  const kind = cardKind(item);
  const date = isoDate(item.dates.start) ?? isoDate(item.flight?.departure?.slice(0, 10));
  const time = clockOf(item.flight?.departure);
  const price = compactPrice(o);
  const when = date ? (time ? `${shortDay(date)} ${time}` : formatDateRange(date, null)) : null;
  const sub = activity
    ? booked
      ? [o.brand?.label ?? null, when, item.location.address ?? item.location.area]
      : [o.brand?.label ?? null, when, priceWords(price)]
    : [item.location.area ?? (item.summary.trim() || null)];
  const ref = booked ? item.bookingRef : null;
  const codeLabel = ref ? (Object.entries(bookingCopies(item, kind)).find(([, v]) => v.value === ref)?.[0] ?? L("Kod", "Code")) : null;
  let act: StepAction | null = null;
  if (booked) act = env.docs(item.id) > 0 ? action("doc", docOpenLabel(kind), { itemId: item.id }) : action("addDoc", docAddLabel(kind), { itemId: item.id });
  else if (activity && item.booking !== "none") act = action("book", bookLabel(kind), { itemId: item.id, url: item.url, brand: o.brand });
  return {
    key: `step:${i.key}:${item.id}`,
    kind: "item",
    date,
    dateLabel: date ? shortDay(date) : L("esnek", "flexible"),
    time,
    status: booked ? "booked" : "chosen",
    missed: false,
    ready: booked,
    kindWord: activity ? cardKindLabel("activity") : L("Yer", "Place"),
    cardKind: kind,
    statusText: booked ? bookedWord(activity ? "activity" : kind) : L("Planda", "On the plan"),
    title: o.title,
    sub: sub.filter(Boolean).join(" · ") || null,
    image: o.image,
    code: ref && codeLabel ? { label: codeLabel, value: ref } : null,
    docMissing: false,
    price: !booked && activity ? (price?.amount ?? null) : null,
    action: act,
    target: { intentKey: i.key, section: i.section, domKeys: i.domKeys, itemId: item.id },
  };
}

/** "Tokyo için 3 etkinlik önerisi › Önerilere bak": a city's ideas not put on the plan, in one line. */
function ideasStep(i: IntentVM): JourneyStep | null {
  const n = i.optionCount - i.planned.length;
  if (n <= 0) return null;
  const names = [...i.options.map((o) => o.title), ...i.suggestions.map((s) => s.title)];
  const city = i.head.city ?? i.head.name;
  return {
    key: `step:${i.key}:ideas`,
    kind: "ideas",
    date: null,
    dateLabel: "",
    time: null,
    status: null,
    missed: false,
    ready: false,
    kindWord: cardKindLabel("activity"),
    cardKind: null,
    statusText: "",
    title: L(`${city} için ${n} etkinlik önerisi`, `${count(n, "etkinlik önerisi", "activity idea")} for ${city}`),
    sub: names.slice(0, 2).join(" · ") + (n > 2 ? " …" : "") || null,
    image: null,
    code: null,
    docMissing: false,
    price: null,
    action: action("ideas", L("Önerilere bak", "See the ideas")),
    target: { intentKey: i.key, section: i.section, domKeys: i.domKeys, itemId: null },
  };
}

/**
 * Hazırlık in one line, counted as its closed row and its open list count it (IntentInput.prep: the stored chores and the ones
 * worked out from the trip, a visa, a check-in; the Bavul apart): "2/6 hazır · sıradaki 1 Nis'ten önce: Yen bozdur".
 */
function prepStep(input: IntentInput): JourneyStep | null {
  const section = input.sections.find((s) => s.id === "prep");
  const prep = input.prep ?? (section ? storedPrep(section) : null);
  if (!prep?.total) return null;
  return {
    key: "step:prep",
    kind: "prep",
    date: null,
    dateLabel: "",
    time: null,
    status: null,
    missed: false,
    ready: false,
    kindWord: "",
    cardKind: null,
    statusText: "",
    title: L("Hazırlık", "Prep"),
    sub: [L(`${prep.done}/${prep.total} hazır`, `${prep.done}/${prep.total} ready`), prep.nextText].filter(Boolean).join(" · "),
    image: null,
    code: null,
    docMissing: false,
    price: null,
    action: action("list", L("Listeyi aç", "Open the list")),
    target: { intentKey: "prep", section: "prep", domKeys: [], itemId: null },
  };
}

/** D14: "Uçakta": the night between leaving and landing, on the way's own chapter; the flight's hours once one is taken. */
function onboardStep(night: string, flights: readonly Item[]): JourneyStep {
  const flight = flights.length === 1 ? flights[0] : null;
  const f = flight?.flight;
  const times = clockOf(f?.departure) && clockOf(f?.arrival) ? `${clockOf(f?.departure)} → ${clockOf(f?.arrival)} (+1)` : null;
  return {
    key: `step:aboard:${night}`,
    kind: "onboard",
    date: night,
    dateLabel: shortDay(night),
    time: null,
    status: null,
    missed: false,
    ready: false,
    kindWord: L("Gece", "Night"),
    cardKind: null,
    statusText: L("uçakta", "on the plane"),
    title: L("Uçakta", "On the plane"),
    sub: flight ? [flight.name, times].filter(Boolean).join(" · ") || null : null,
    image: null,
    code: null,
    docMissing: false,
    price: null,
    action: null,
    target: null,
  };
}

// --- the chapters ------------------------------------------------------------------------------------------------

/** The order inside a chapter: by day (one with none after), the way there before the stay before the rest, by hour. */
const KIND_RANK: Record<StepKind, number> = { prep: 0, intent: 2, onboard: 1, item: 3, ideas: 9 };
function rankOf(s: JourneyStep): number {
  if (s.kind === "intent" && s.target) return s.target.section === "stay" ? 1.5 : s.target.section === "flight" || s.target.section === "transport" ? 0.5 : KIND_RANK.intent;
  return KIND_RANK[s.kind];
}

export function journeyChapters({ input, timeline, collections }: JourneyInput): JourneyView {
  const { plan, trip, today } = input;
  const board = timeline.board;
  const cityAt = board.flatMap((s, i) => (s.kind === "city" ? [i] : []));
  if (!plan.range || !plan.stayBlocks.length || !cityAt.length) return { available: false, reason: journeyClosedReason(), chapters: [], todayKey: null };
  const all = collections ?? collectionsOf(input);
  const env: Env = { input, today, docs: (id) => input.docsFor?.(id).length ?? 0 };
  const aboard = nightsAboard(input.items);
  const aboardDrawn = new Set<string>();
  const [first, last] = [cityAt[0], cityAt.at(-1)!];

  // Where each block of the front sits.
  const sectionOfKey = new Map<string, number>();
  board.forEach((s, n) => {
    if (s.kind === "travel") sectionOfKey.set(s.entry.key, n);
    else if (s.kind === "city") for (const e of [...s.stays, ...s.entries]) sectionOfKey.set(e.key, n);
    else for (const e of s.entries) sectionOfKey.set(e.key, n);
  });

  const make = (over: Partial<JourneyChapter> & Pick<JourneyChapter, "key" | "kind" | "title" | "sub">): JourneyChapter => ({
    city: null, range: null, nights: 0, date: null, photo: null, steps: [], summary: { ready: 0, open: 0, text: "" }, today: false, past: false, ...over,
  });
  const before = make({ key: "chapter:before", kind: "before", title: L("Yola çıkmadan", "Before you go"), sub: L("Gezi öncesi", "Before the trip") });
  const cities = new Map<number, JourneyChapter>();
  for (const n of cityAt) {
    const s = board[n];
    if (s.kind !== "city") continue;
    // The night on the plane isn't the city's (D14): its days and nights are the beds booked or to find.
    const beds = s.stays.filter((st) => !(st.block.kind === "open" && !st.block.groups.length && nightsOf(st.block.range).every((d) => aboard.has(d))));
    const range = beds.length ? { start: beds.map((b) => b.block.range.start).sort()[0], end: beds.map((b) => b.block.range.end).sort().at(-1)! } : s.range;
    const nights = beds.length ? beds.reduce((sum, b) => sum + b.block.nights, 0) : s.nights;
    const key = cityKeyOf(s.city);
    cities.set(
      n,
      make({
        key: `chapter:${s.key}`,
        kind: "city",
        title: s.city ?? L("Konaklama", "Stay"),
        sub: [range ? formatDateRange(range.start, range.end) : null, nights ? nNights(nights) : null].filter(Boolean).join(" · "),
        city: s.city,
        range,
        nights,
        photo: key ? { key, url: trip.cityImages?.[key] ?? null } : null,
      }),
    );
  }
  const cityList = cityAt.map((n) => cities.get(n)!);
  // The ways in and home, made when a flight goes there.
  const ways: { in: JourneyChapter | null; out: JourneyChapter | null } = { in: null, out: null };
  const wayIn = () => (ways.in ??= make({ key: "chapter:in", kind: "travel", title: "", sub: "" }));
  const wayOut = () => (ways.out ??= make({ key: "chapter:out", kind: "travel", title: "", sub: "" }));

  /** A city's chapter by name, the one whose days hold the date when the trip passes it twice; else by the date alone. */
  const cityFor = (city: string | null, date: string | null): JourneyChapter | null => {
    const holds = (d: JourneyChapter) => Boolean(date && d.range && d.range.start <= date && date < d.range.end);
    const same = city ? cityList.filter((d) => sameCity(d.city, city)) : [];
    if (same.length) return same.find(holds) ?? same[0];
    if (!date) return null;
    return cityList.find(holds) ?? (date === plan.range!.end ? cityList.at(-1)! : null);
  };

  /** Where a box goes: by its blocks on the front, else by its city and day; flights at the ends are the ways in and home. */
  const chapterOf = (i: IntentVM): JourneyChapter => {
    const at = i.domKeys.map((k) => sectionOfKey.get(k)).find((n) => n != null);
    const flight = i.section === "flight";
    if (at != null) {
      if (at < first) return flight ? wayIn() : cityList[0];
      if (at > last) return flight ? wayOut() : cityList.at(-1)!;
      return cities.get(at) ?? cityList.find((_, k) => cityAt[k] > at) ?? cityList.at(-1)!;
    }
    if (i.section === "other") return before;
    const date = i.head.date;
    if (flight && date) {
      if (date <= plan.range!.start) return wayIn();
      if (date >= plan.range!.end) return wayOut();
    }
    return cityFor(i.head.city, date) ?? before;
  };

  const prep = prepStep(input);
  if (prep) before.steps.push(prep);
  // The ways in and home: their ends as the trip says them ("İstanbul → Tokyo"), an unnamed airport as its city.
  const routeIn: { from: string | null; to: string | null } = { from: null, to: null };
  const routeOut: { from: string | null; to: string | null } = { from: null, to: null };
  const dates: { in: string | null; out: string | null } = { in: null, out: null };

  for (const c of all) {
    for (const i of c.intents) {
      if (i.status === "skipped") continue;
      if (i.frame === "collection") {
        for (const o of i.planned) {
          const item = o.item;
          const at = sectionOfKey.get(`event:${item.id}`);
          const home = (at != null ? cities.get(at) : null) ?? cityFor(item.city ?? i.head.city, isoDate(item.dates.start)) ?? cityFor(i.head.city, i.head.date) ?? before;
          home.steps.push(itemStep(i, o, env));
        }
        // Only an activity's ideas get their line (v81: "Tokyo için 3 etkinlik önerisi"); a city behind stays quiet.
        const home = cityFor(i.head.city, i.head.date);
        const step = i.section === "activity" && home && !(home.range && home.range.end <= today) ? ideasStep(i) : null;
        if (step && home) home.steps.push(step);
        continue;
      }
      // D14: an empty bed for a night the flight spends in the air is the "Uçakta" line on the way.
      if (isAboardNight(i, aboard) && i.head.date) {
        for (const night of nightsOf({ start: i.head.date, end: addDays(i.head.date, Math.max(1, i.head.nights)) })) {
          const flights = aboard.get(night)!;
          const owner = all.flatMap((x) => x.intents).find((x) => flights.some((f) => x.itemIds.includes(f.id)));
          (owner ? chapterOf(owner) : chapterOf(i)).steps.push(onboardStep(night, flights));
          aboardDrawn.add(night);
        }
        continue;
      }
      const home = chapterOf(i);
      let title = i.head.name;
      // A flight's ends as the chapters name them: an airport the table can't name is the city it serves.
      if (i.section === "flight" && i.head.route) {
        const r = i.head.route;
        const [isIn, isOut] = [home === ways.in, home === ways.out];
        const city = home.kind === "city" ? home.city : null;
        const from = (unnamed(r.from) ? (isOut ? cityList.at(-1)!.city : city) : null) ?? r.from;
        const to = (unnamed(r.to) ? (isIn ? cityList[0].city : city) : null) ?? r.to;
        title = `${from} → ${to}`;
        if (isIn && !routeIn.from) (routeIn.from = from), (routeIn.to = to), (dates.in = i.head.date);
        if (isOut && !routeOut.from) (routeOut.from = from), (routeOut.to = to), (dates.out = i.head.date);
      }
      home.steps.push(intentStep(i, env, title));
    }
  }

  // D14: once its flight is taken the Plan opens no bed for a night in the air (intents.ts), so that night's "Uçakta"
  // line comes from the night itself, beside the flight that spends it.
  for (const [night, flights] of aboard) {
    if (aboardDrawn.has(night)) continue;
    const owner = all.flatMap((x) => x.intents).find((x) => flights.some((f) => x.itemIds.includes(f.id)));
    if (owner) chapterOf(owner).steps.push(onboardStep(night, flights));
  }

  const { in: inbound, out: outbound } = ways;
  const drafts = [before, ...(inbound ? [inbound] : []), ...cityList, ...(outbound ? [outbound] : [])];
  if (inbound) Object.assign(inbound, travelHead(routeIn, dates.in ?? plan.range.start, cityList[0].city, "in"));
  if (outbound) Object.assign(outbound, travelHead(routeOut, dates.out ?? plan.range.end, cityList.at(-1)!.city, "out"));

  for (const c of drafts) {
    // Before the trip nothing has a day of the trip ("Yola çıkmadan"); in a city, what has none yet is "esnek".
    for (const s of c.steps) s.dateLabel = c.kind === "before" ? "" : s.dateLabel || (s.kind === "intent" || s.kind === "item" ? L("esnek", "flexible") : "");
    const order = new Map(c.steps.map((s, n) => [s.key, n]));
    if (c.kind !== "before") {
      c.steps.sort(
        (a, b) =>
          (a.kind === "ideas" ? 1 : 0) - (b.kind === "ideas" ? 1 : 0) ||
          (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
          rankOf(a) - rankOf(b) ||
          (a.time ?? "99").localeCompare(b.time ?? "99") ||
          order.get(a.key)! - order.get(b.key)!,
      );
    }
    // What was left open on a day gone by is no decision any more (K17): neither done nor to do.
    const counted = c.steps.filter((s) => (s.kind === "intent" || s.kind === "item") && !s.missed && (s.ready || !s.date || s.date >= today));
    const ready = counted.filter((s) => s.ready).length;
    const open = counted.length - ready;
    c.summary = { ready, open, text: [ready ? L(`${ready} hazır`, `${ready} ready`) : null, open ? L(`${open} karar`, `${open} to decide`) : null].filter(Boolean).join(" · ") };
    c.today = isToday(c, today);
    c.past = c.kind === "city" ? Boolean(c.range && c.range.end <= today) : c.kind === "travel" ? Boolean(c.date && c.date < today) : today >= plan.range.start;
  }
  const chapters = drafts.filter((c) => c.steps.length || c.kind === "city");
  // The way in or home leads on its own day; the last day with no flight home is the last city's.
  const now =
    chapters.find((c) => c.today && c.kind === "travel") ??
    chapters.find((c) => c.today) ??
    (today === plan.range.end ? (chapters.filter((c) => c.kind === "city").at(-1) ?? null) : null);
  for (const c of chapters) c.today = c === now;
  return { available: true, reason: null, chapters, todayKey: now?.key ?? null };
}

function travelHead(route: { from: string | null; to: string | null }, date: string, city: string | null, way: "in" | "out"): Pick<JourneyChapter, "title" | "sub" | "date"> {
  const from = route.from ?? (way === "out" ? city : null);
  const to = route.to ?? (way === "in" ? city : null);
  const title = from && to ? `${from} → ${to}` : way === "in" ? L("Gidiş", "Getting there") : L("Dönüş", "Getting home");
  return { title, sub: formatDateRange(date, null), date };
}

function isToday(c: JourneyChapter, today: string): boolean {
  if (c.kind === "travel") return c.date === today;
  if (c.kind === "city") return Boolean(c.range && c.range.start <= today && today < c.range.end);
  return false;
}
