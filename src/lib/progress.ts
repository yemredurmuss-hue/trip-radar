// What's left to do on the trip, for the slim strip under its summary: what to decide (options
// waiting), what to book (chosen or planned, not booked), what to plan (nothing saved yet: nights,
// a flight, a transfer) and the free cancellations running out. Each points at its place on the
// board. Also the money: booked, chosen and a guess for what's still open. Pure.
import { totalPrice, type DecisionContext, type GroupDecision } from "./decision";
import { L, locale } from "./i18n";
import { count, liveLabels, nOptions } from "./i18nText";
import { formatDateRange, nightsBetween } from "./items";
import { BOOKABLE, MODE_LABELS, type Leg } from "./legs";
import { departureDay, liveGroups, type Plan } from "./plan";
import type { Timeline, TimelineEntry } from "./timeline";
import { needsBooking } from "./booking";
import { isTrip } from "./travelKinds";
import type { Item } from "./types";

export type TodoKind = "decide" | "book" | "plan" | "deadline" | "doc";

export interface Todo {
  key: string;
  kind: TodoKind;
  /** Where it is on the board: the card of an item, a transfer, or a timeline entry (tried in that order). */
  target: { item?: string; leg?: string; entry?: string };
  title: string;
  /** "3 seçenek · Jardim Stay önde", "seçenek yok", "bilet alınmadı". */
  note: string;
  date: string | null;
  /** Days until it (for a deadline, until it runs out); null without a date. */
  days: number | null;
  /** Within two weeks. */
  soon: boolean;
}

export interface DecisionProgress {
  todos: Todo[];
  // What this strip makes ("doc", a file missing, comes only from planList.ts).
  count: Record<Exclude<TodoKind, "doc">, number>;
}

const SOON_DAYS = 14;
const daysUntil = (date: string, today: string) => nightsBetween(today, date);
const fmt = (d: string) => formatDateRange(d, null);

/** A DOM id for a timeline entry, so the strip can take you to it. */
export const entryDomId = (key: string) => `tl-${key.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;

function winnerOf(keys: string[], decisions: Map<string, GroupDecision> | undefined): string | null {
  for (const k of keys) {
    const name = decisions?.get(k)?.winner?.item.name;
    if (name) return name;
  }
  return null;
}

const options = (n: number, lead: string | null) =>
  n === 1 ? L("1 seçenek · seç ya da başka ekle", "1 option · pick it or add another") : `${nOptions(n)}${lead ? L(` · ${lead} önde`, ` · ${lead} leads`) : ""}`;
const LEG_WORDS = liveLabels({
  arrival: ["Varış transferi", "Arrival transfer"],
  departure: ["Ayrılış transferi", "Departure transfer"],
  change: ["Otel değişimi", "Hotel change"],
  move: ["Şehir değişimi", "Change of city"],
});
const W = liveLabels({
  noTicket: ["bilet alınmadı", "no ticket yet"],
  notBooked: ["rezerve edilmedi", "not booked"],
  how: ["nasıl?", "how?"],
});

type Draft = Omit<Todo, "days" | "soon">;

/** What an entry of the timeline still needs, if anything. */
function entryTodo(e: TimelineEntry, decisions: Map<string, GroupDecision> | undefined): Draft | null {
  if (e.kind === "stay") {
    const b = e.block;
    if (b.kind !== "open" || e.skipped) return null;
    const count = new Set(b.groups.flatMap((g) => g.items.map((i) => i.id))).size;
    const stay = b.city ? L(`${b.city} konaklama`, `${b.city} stay`) : L("Konaklama", "Stay");
    const title = `${stay} · ${formatDateRange(b.range.start, b.range.end)}`;
    return count
      ? { key: e.key, kind: "decide", target: { entry: e.key }, title, note: options(count, winnerOf(b.groups.map((g) => g.key), decisions)), date: b.range.start }
      : { key: e.key, kind: "plan", target: { entry: e.key }, title, note: L("seçenek yok · ara ya da sohbette söyle", "no options · search, or say it in the chat"), date: b.range.start };
  }
  if (e.kind !== "travel") return null;
  const t = e.travel;
  // Chosen or booked: the booking side is the item's own to-do.
  if (t?.settled) return null;
  const title =
    e.role === "arrival"
      ? `${L("Gidiş uçuşu", "Flight out")} · ${fmt(e.date)}`
      : e.role === "departure"
        ? `${L("Dönüş uçuşu", "Flight home")} · ${fmt(e.date)}`
        : `${e.subtitle ?? L("Ulaşım", "Transport")} · ${fmt(e.date)}`;
  if (t?.items.length) {
    return { key: e.key, kind: "decide", target: { entry: e.key }, title, note: options(t.items.length, winnerOf([t.group.key], decisions)), date: e.date };
  }
  if (e.role === "move") {
    const leg = e.leg;
    const mode = leg?.choice?.mode ?? null;
    if (leg?.choice?.booked) return null;
    if (mode) {
      if (!BOOKABLE.includes(mode)) return null;
      return { key: e.key, kind: "book", target: { entry: e.key }, title, note: `${MODE_LABELS[mode]} · ${mode === "flight" || mode === "train" || mode === "ferry" ? W.noTicket : W.notBooked}`, date: e.date };
    }
    return { key: e.key, kind: "plan", target: { entry: e.key }, title, note: L("nasıl geçeceksin?", "how will you get there?"), date: e.date };
  }
  if (e.role === "other") return null;
  return { key: e.key, kind: "plan", target: { entry: e.key }, title, note: L("uçuş yok · kaydet ya da sohbette söyle", "no flight · save one, or say it in the chat"), date: e.date };
}

/** A transfer on the board: its options, its booking, or nothing planned yet. */
function legTodo(leg: Leg, entry?: string): Draft | null {
  const title = `${LEG_WORDS[leg.kind]} · ${fmt(leg.date)}`;
  const key = `leg:${leg.key}`;
  const where = `${leg.from.label} → ${leg.to.label}`;
  const target = { leg: leg.key, ...(entry ? { entry } : {}) };
  switch (leg.status) {
    case "options":
      return { key, kind: "decide", target, title, note: `${nOptions(leg.options.length)} · ${where}`, date: leg.date };
    case "planned":
      return leg.choice?.mode && BOOKABLE.includes(leg.choice.mode)
        ? { key, kind: "book", target, title, note: `${MODE_LABELS[leg.choice.mode]} · ${W.notBooked}`, date: leg.date }
        : null;
    case "empty":
      return { key, kind: "plan", target, title, note: `${where} · ${W.how}`, date: leg.date };
    default:
      // Chosen: its item's to-do. Booked: done.
      return null;
  }
}

/** A date running out: the sentence (the card's details, a stay's card) and its short form for a card's strip ("4 gün"). */
export interface DateAlert {
  tone: "red" | "amber";
  text: string;
  short: string;
}

/** "Rezerve edilmedi · girişe 9 gün" / "Ücretsiz iptal için 6 gün kaldı (5 Eki)": null when nothing's near. */
export function dateAlert(item: Item, today: string): DateAlert | null {
  if (item.status === "booked") {
    const until = item.cancellation.freeUntil;
    if (!until || until < today) return null;
    const days = daysUntil(until, today);
    if (days > SOON_DAYS) return null;
    return {
      tone: "red",
      text:
        days === 0
          ? L("Ücretsiz iptal bugün bitiyor", "Free cancellation ends today")
          : L(`Ücretsiz iptal için ${days} gün kaldı (${fmt(until)})`, `${count(days, "gün", "day")} left to cancel for free (${fmt(until)})`),
      short: days === 0 ? L("iptal bugün biter", "cancel by today") : L(`iptale ${days} gün`, `${count(days, "day", "day")} to cancel`),
    };
  }
  if (item.status !== "chosen") return null;
  const start = departureDay(item);
  if (!start || start < today) return null;
  const days = daysUntil(start, today);
  if (days > 30) return null;
  const what =
    item.category === "stay"
      ? L("girişe", "check-in")
      : item.category === "flight"
        ? L("uçuşa", "the flight")
        : item.category === "activity"
          ? L("etkinliğe", "the activity")
          : L("yolculuğa", "the journey");
  const ticket = item.category === "flight" || item.category === "activity" || (item.category === "transport" && isTrip(item));
  const safe = item.cancellation.freeUntil && item.cancellation.freeUntil >= today ? L(" · ücretsiz iptalli, şimdi ayırmak risksiz", " · free cancellation, so booking now is risk-free") : "";
  const state = ticket ? L("Bilet alınmadı", "No ticket yet") : L("Rezerve edilmedi", "Not booked");
  return {
    tone: "amber",
    text: L(`${state} · ${what} ${days} gün${safe}`, `${state} · ${count(days, "gün", "day")} to ${what}${safe}`),
    short: days === 0 ? L("bugün", "today") : count(days, "gün", "day"),
  };
}

/** The timeline entry an item sits in, so a to-do about it can take you there even when its card is folded. */
function entryOf(timeline: Timeline, id: string): string | undefined {
  const has = (list: Item[] | undefined) => Boolean(list?.some((i) => i.id === id));
  return timeline.entries.find((e) => {
    switch (e.kind) {
      case "stay":
        return e.block.kind === "booked"
          ? e.block.item.id === id || has(e.block.clashes)
          : (e.block.kind === "chosen" && e.block.item.id === id) || e.block.groups.some((g) => has(g.items));
      case "travel":
        return has(e.travel?.items);
      case "day":
        return has(e.items) || e.legs.some((l) => has(l.options));
      case "plan":
        return has(e.items);
      case "leg":
        return has(e.leg.options);
      case "rental":
        return has(e.group.items);
    }
  })?.key;
}


export function decisionProgress(
  timeline: Timeline,
  items: Item[],
  plan: Plan,
  decisions: Map<string, GroupDecision> | undefined,
  today: string,
  /** A flight, stay or car the start chat only made room for (startTrip.ts isPlaceholder): nothing to buy yet. */
  placeholder: (item: Item) => boolean = () => false,
): DecisionProgress {
  const drafts: Draft[] = [];
  for (const e of timeline.entries) {
    if (e.kind === "leg") drafts.push(...[legTodo(e.leg, e.key)].filter((d): d is Draft => d != null));
    else if (e.kind === "day") drafts.push(...e.legs.map((l) => legTodo(l)).filter((d): d is Draft => d != null));
    else if (e.kind === "plan") {
      // A car said in the chat with pages saved for it but none picked yet.
      const saved = e.items.filter((i) => i.status === "saved");
      if (saved.length && !e.items.some((i) => i.status === "chosen" || i.status === "booked")) {
        const what = saved[0].category === "transport" ? L("araç kiralama", "car rental") : L("planlar", "plans");
        drafts.push({ key: `${e.key}:options`, kind: "decide", target: { entry: e.key }, title: `${saved[0].city ?? e.city ?? ""} · ${what}`.replace(/^ · /, ""), note: options(saved.length, null), date: null });
      }
    } else if (e.kind === "rental") {
      // A car with pages saved and none picked: a decision, above the day it starts.
      const items = e.group.items;
      if (!items.some((i) => i.status === "chosen" || i.status === "booked")) {
        drafts.push({
          key: `${e.key}:decide`,
          kind: "decide",
          target: { entry: e.key },
          title: `${L("Araç kiralama", "Car rental")} · ${formatDateRange(e.date, e.end)}`,
          note: options(items.length, winnerOf([e.group.key], decisions)),
          date: e.date,
        });
      }
    } else {
      const d = entryTodo(e, decisions);
      if (d) drafts.push(d);
    }
  }

  // Chosen but not booked (a chat plan as much as a saved page), and free cancellations running out.
  const closed = new Set(plan.closed.map((c) => c.item.id));
  for (const item of items) {
    // Only what needs booking (booking.ts): an idea or a to-do is never "Rezerve et".
    if (closed.has(item.id) || !needsBooking(item)) continue;
    const start = departureDay(item);
    if (item.status === "chosen" && placeholder(item)) {
      // Room made, nothing picked: "Uçuş bul", never "bilet alınmadı". Its nights are the open stay's own to-do.
      if ((start && start < today) || item.category === "stay") continue;
      const flight = item.category === "flight";
      drafts.push({
        key: `find:${item.id}`,
        kind: "plan",
        target: { item: item.id, entry: entryOf(timeline, item.id) },
        title: item.name,
        note: `${flight ? L("uçuş bul", "find a flight") : L("araç bul", "find a car")} · ${start ? fmt(start) : L("gün belli değil", "no date yet")}`,
        date: start,
      });
    } else if (item.status === "chosen") {
      if (start && start < today) continue;
      const ticket = item.category === "flight" || item.category === "activity" || (item.category === "transport" && isTrip(item));
      const free = item.cancellation.freeUntil && item.cancellation.freeUntil >= today ? L(" · ücretsiz iptalli", " · free cancellation") : "";
      drafts.push({
        key: `book:${item.id}`,
        kind: "book",
        target: { item: item.id, entry: entryOf(timeline, item.id) },
        title: item.name,
        note: `${ticket ? W.noTicket : W.notBooked} · ${start ? fmt(start) : L("gün belli değil", "no date yet")}${free}`,
        date: start,
      });
    } else if (item.status === "booked") {
      const until = item.cancellation.freeUntil;
      if (!until || until < today || daysUntil(until, today) > SOON_DAYS) continue;
      const days = daysUntil(until, today);
      drafts.push({
        key: `deadline:${item.id}`,
        kind: "deadline",
        target: { item: item.id, entry: entryOf(timeline, item.id) },
        title: item.name,
        note: days === 0 ? L("ücretsiz iptal bugün bitiyor", "free cancellation ends today") : L(`ücretsiz iptal ${fmt(until)}'e kadar`, `free cancellation until ${fmt(until)}`),
        date: until,
      });
    }
  }

  const todos: Todo[] = drafts.map((d) => {
    const days = d.date ? daysUntil(d.date, today) : null;
    return { ...d, days, soon: days != null && days >= 0 && days <= SOON_DAYS };
  });
  // By date (undated last), then by name, so the list doesn't reshuffle.
  todos.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.title.localeCompare(b.title, locale()));
  const count: Record<Exclude<TodoKind, "doc">, number> = { decide: 0, book: 0, plan: 0, deadline: 0 };
  for (const t of todos) if (t.kind !== "doc") count[t.kind]++;
  return { todos, count };
}

/**
 * The hero's next step as a thing to do: "Karar ver: Porto konaklama · 8–11 Ekim", "Rezerve et: Douro
 * tekne turu", "Planla: Varış transferi · 8 Ekim", "Lisboa Loft: ücretsiz iptal 6 gün içinde biter".
 */
export function nextStepText(todo: Todo): string {
  switch (todo.kind) {
    case "decide":
      return L(`Karar ver: ${todo.title}`, `Decide: ${todo.title}`);
    case "book":
      return L(`Rezerve et: ${todo.title}`, `Book: ${todo.title}`);
    case "plan":
      return L(`Planla: ${todo.title}`, `Plan: ${todo.title}`);
    case "doc":
      return L(`Belge ekle: ${todo.title}`, `Add the file: ${todo.title}`);
    case "deadline":
      return !todo.days
        ? L(`${todo.title}: ücretsiz iptal bugün bitiyor`, `${todo.title}: free cancellation ends today`)
        : L(`${todo.title}: ücretsiz iptal ${todo.days} gün içinde biter`, `${todo.title}: free cancellation ends in ${count(todo.days, "gün", "day")}`);
  }
}

export type BudgetSlice = "flight" | "stay" | "transport" | "activity" | "other";
export const BUDGET_SLICES: BudgetSlice[] = ["flight", "stay", "transport", "activity", "other"];
const sliceOf = (c: Item["category"]): BudgetSlice =>
  c === "flight" || c === "stay" || c === "transport" ? c : c === "activity" || c === "food" ? "activity" : "other";

export interface BudgetBar {
  currency: string;
  /** The trip's budget in that currency; null when none is set (the bar then shows the sums only). */
  total: number | null;
  booked: number;
  chosen: number;
  /** A guess for what's still open: each open decision's leading option. */
  open: number;
  /** Prices that couldn't be counted (missing, or no exchange rate yet). */
  uncounted: number;
  /** Booked + chosen, by kind (what the hero's bar shows). */
  byCategory: Record<BudgetSlice, number>;
  /** Booked + chosen + each open decision's leading option, by kind: what each part is likely to cost. */
  expected: Record<BudgetSlice, number>;
}

/**
 * v11 "€500 ayrıldı" in a section's header: the trip's budget shared out by what each part is likely to cost
 * (BudgetBar.expected), to the nearest 10; null with no budget or nothing priced yet.
 */
export function sectionAllotments(bar: Pick<BudgetBar, "total" | "expected">): Record<BudgetSlice, number> | null {
  if (bar.total == null || bar.total <= 0) return null;
  const sum = BUDGET_SLICES.reduce((a, s) => a + bar.expected[s], 0);
  if (sum <= 0) return null;
  const out = { flight: 0, stay: 0, transport: 0, activity: 0, other: 0 } as Record<BudgetSlice, number>;
  for (const s of BUDGET_SLICES) out[s] = Math.round(((bar.total * bar.expected[s]) / sum) / 10) * 10;
  return out;
}

/** What the trip costs so far and what's likely still to come, in the trip's currency. */
export function budgetBar(plan: Plan, items: Item[], ctx: DecisionContext, decisions: Map<string, GroupDecision> | undefined): BudgetBar {
  const closed = new Set(plan.closed.map((c) => c.item.id));
  let booked = 0;
  let chosen = 0;
  let open = 0;
  let uncounted = 0;
  const byCategory: Record<BudgetSlice, number> = { flight: 0, stay: 0, transport: 0, activity: 0, other: 0 };
  const expected: Record<BudgetSlice, number> = { flight: 0, stay: 0, transport: 0, activity: 0, other: 0 };
  const add = (item: Item, to: "booked" | "chosen" | "open") => {
    const price = totalPrice(item, ctx);
    if (price == null) {
      uncounted++;
      return;
    }
    if (to !== "open") byCategory[sliceOf(item.category)] += price;
    expected[sliceOf(item.category)] += price;
    if (to === "booked") booked += price;
    else if (to === "chosen") chosen += price;
    else open += price;
  };
  for (const item of items) {
    if (closed.has(item.id)) continue;
    if (item.status === "booked") add(item, "booked");
    else if (item.status === "chosen") add(item, "chosen");
  }
  for (const group of liveGroups(plan)) {
    if (group.items.some((i) => i.status === "chosen" || i.status === "booked")) continue;
    const lead = decisions?.get(group.key)?.winner?.item;
    if (lead) add(lead, "open");
  }
  const budget = ctx.trip.budget;
  return { currency: ctx.currency, total: budget && budget.currency === ctx.currency ? budget.amount : null, booked, chosen, open, uncounted, byCategory, expected };
}
