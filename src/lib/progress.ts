// What's left to do on the trip, for the slim strip under its summary: what to decide (options
// waiting), what to book (chosen or planned, not booked), what to plan (nothing saved yet: nights,
// a flight, a transfer) and the free cancellations running out. Each points at its place on the
// board. Also the money: booked, chosen and a guess for what's still open. Pure.
import { totalPrice, type DecisionContext, type GroupDecision } from "./decision";
import { formatDateRange, nightsBetween } from "./items";
import { BOOKABLE, MODE_LABELS, type Leg } from "./legs";
import { departureDay, liveGroups, type Plan } from "./plan";
import type { Timeline, TimelineEntry } from "./timeline";
import { isTrip } from "./travelKinds";
import type { Item } from "./types";

export type TodoKind = "decide" | "book" | "plan" | "deadline";

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
  count: Record<TodoKind, number>;
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

const options = (n: number, lead: string | null) => (n === 1 ? "1 seçenek · seç ya da başka ekle" : `${n} seçenek${lead ? ` · ${lead} önde` : ""}`);
const LEG_WORDS = { arrival: "Varış transferi", departure: "Ayrılış transferi", change: "Otel değişimi", move: "Şehir değişimi" } as const;

type Draft = Omit<Todo, "days" | "soon">;

/** What an entry of the timeline still needs, if anything. */
function entryTodo(e: TimelineEntry, decisions: Map<string, GroupDecision> | undefined): Draft | null {
  if (e.kind === "stay") {
    const b = e.block;
    if (b.kind !== "open" || e.skipped) return null;
    const count = new Set(b.groups.flatMap((g) => g.items.map((i) => i.id))).size;
    const title = `${b.city ? `${b.city} konaklama` : "Konaklama"} · ${formatDateRange(b.range.start, b.range.end)}`;
    return count
      ? { key: e.key, kind: "decide", target: { entry: e.key }, title, note: options(count, winnerOf(b.groups.map((g) => g.key), decisions)), date: b.range.start }
      : { key: e.key, kind: "plan", target: { entry: e.key }, title, note: "seçenek yok · ara ya da sohbette söyle", date: b.range.start };
  }
  if (e.kind !== "travel") return null;
  const t = e.travel;
  // Chosen or booked: the booking side is the item's own to-do.
  if (t?.settled) return null;
  const title =
    e.role === "arrival" ? `Gidiş uçuşu · ${fmt(e.date)}` : e.role === "departure" ? `Dönüş uçuşu · ${fmt(e.date)}` : `${e.subtitle ?? "Ulaşım"} · ${fmt(e.date)}`;
  if (t?.items.length) {
    return { key: e.key, kind: "decide", target: { entry: e.key }, title, note: options(t.items.length, winnerOf([t.group.key], decisions)), date: e.date };
  }
  if (e.role === "move") {
    const leg = e.leg;
    const mode = leg?.choice?.mode ?? null;
    if (leg?.choice?.booked) return null;
    if (mode) {
      if (!BOOKABLE.includes(mode)) return null;
      return { key: e.key, kind: "book", target: { entry: e.key }, title, note: `${MODE_LABELS[mode]} · ${mode === "flight" || mode === "train" || mode === "ferry" ? "bilet alınmadı" : "rezerve edilmedi"}`, date: e.date };
    }
    return { key: e.key, kind: "plan", target: { entry: e.key }, title, note: "nasıl geçeceksin?", date: e.date };
  }
  if (e.role === "other") return null;
  return { key: e.key, kind: "plan", target: { entry: e.key }, title, note: "uçuş yok · kaydet ya da sohbette söyle", date: e.date };
}

/** A transfer on the board: its options, its booking, or nothing planned yet. */
function legTodo(leg: Leg): Draft | null {
  const title = `${LEG_WORDS[leg.kind]} · ${fmt(leg.date)}`;
  const key = `leg:${leg.key}`;
  const where = `${leg.from.label} → ${leg.to.label}`;
  switch (leg.status) {
    case "options":
      return { key, kind: "decide", target: { leg: leg.key }, title, note: `${leg.options.length} seçenek · ${where}`, date: leg.date };
    case "planned":
      return leg.choice?.mode && BOOKABLE.includes(leg.choice.mode)
        ? { key, kind: "book", target: { leg: leg.key }, title, note: `${MODE_LABELS[leg.choice.mode]} · rezerve edilmedi`, date: leg.date }
        : null;
    case "empty":
      return { key, kind: "plan", target: { leg: leg.key }, title, note: `${where} · nasıl?`, date: leg.date };
    default:
      // Chosen: its item's to-do. Booked: done.
      return null;
  }
}

/** "Rezerve edilmedi · girişe 9 gün" / "Ücretsiz iptal için 6 gün kaldı (5 Eki)": null when nothing's near. */
export function dateAlert(item: Item, today: string): { tone: "red" | "amber"; text: string } | null {
  if (item.status === "booked") {
    const until = item.cancellation.freeUntil;
    if (!until || until < today) return null;
    const days = daysUntil(until, today);
    if (days > SOON_DAYS) return null;
    return { tone: "red", text: days === 0 ? "Ücretsiz iptal bugün bitiyor" : `Ücretsiz iptal için ${days} gün kaldı (${fmt(until)})` };
  }
  if (item.status !== "chosen") return null;
  const start = departureDay(item);
  if (!start || start < today) return null;
  const days = daysUntil(start, today);
  if (days > 30) return null;
  const what = item.category === "stay" ? "girişe" : item.category === "flight" ? "uçuşa" : item.category === "activity" ? "etkinliğe" : "yolculuğa";
  const ticket = item.category === "flight" || item.category === "activity" || (item.category === "transport" && isTrip(item));
  const safe = item.cancellation.freeUntil && item.cancellation.freeUntil >= today ? " · ücretsiz iptalli, şimdi ayırmak risksiz" : "";
  return { tone: "amber", text: `${ticket ? "Bilet alınmadı" : "Rezerve edilmedi"} · ${what} ${days} gün${safe}` };
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
    }
  })?.key;
}

const BOOK_CATEGORIES = ["stay", "flight", "transport", "activity"];

export function decisionProgress(
  timeline: Timeline,
  items: Item[],
  plan: Plan,
  decisions: Map<string, GroupDecision> | undefined,
  today: string,
): DecisionProgress {
  const drafts: Draft[] = [];
  for (const e of timeline.entries) {
    if (e.kind === "leg") drafts.push(...[legTodo(e.leg)].filter((d): d is Draft => d != null));
    else if (e.kind === "day") drafts.push(...e.legs.map(legTodo).filter((d): d is Draft => d != null));
    else if (e.kind === "plan") {
      // A car said in the chat with pages saved for it but none picked yet.
      const saved = e.items.filter((i) => i.status === "saved");
      if (saved.length && !e.items.some((i) => i.status === "chosen" || i.status === "booked")) {
        drafts.push({ key: `${e.key}:options`, kind: "decide", target: { entry: e.key }, title: `${saved[0].city ?? e.city ?? ""} · ${saved[0].category === "transport" ? "araç kiralama" : "planlar"}`.replace(/^ · /, ""), note: options(saved.length, null), date: null });
      }
    } else {
      const d = entryTodo(e, decisions);
      if (d) drafts.push(d);
    }
  }

  // Chosen but not booked (a chat plan as much as a saved page), and free cancellations running out.
  const closed = new Set(plan.closed.map((c) => c.item.id));
  for (const item of items) {
    if (closed.has(item.id) || !BOOK_CATEGORIES.includes(item.category)) continue;
    const start = departureDay(item);
    if (item.status === "chosen") {
      if (start && start < today) continue;
      const ticket = item.category === "flight" || item.category === "activity" || (item.category === "transport" && isTrip(item));
      const free = item.cancellation.freeUntil && item.cancellation.freeUntil >= today ? " · ücretsiz iptalli" : "";
      drafts.push({
        key: `book:${item.id}`,
        kind: "book",
        target: { item: item.id, entry: entryOf(timeline, item.id) },
        title: item.name,
        note: `${ticket ? "bilet alınmadı" : "rezerve edilmedi"} · ${start ? fmt(start) : "gün belli değil"}${free}`,
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
        note: days === 0 ? "ücretsiz iptal bugün bitiyor" : `ücretsiz iptal ${fmt(until)}'e kadar`,
        date: until,
      });
    }
  }

  const todos: Todo[] = drafts.map((d) => {
    const days = d.date ? daysUntil(d.date, today) : null;
    return { ...d, days, soon: days != null && days >= 0 && days <= SOON_DAYS };
  });
  // By date (undated last), then by name, so the list doesn't reshuffle.
  todos.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.title.localeCompare(b.title, "tr"));
  const count: Record<TodoKind, number> = { decide: 0, book: 0, plan: 0, deadline: 0 };
  for (const t of todos) count[t.kind]++;
  return { todos, count };
}

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
}

/** What the trip costs so far and what's likely still to come, in the trip's currency. */
export function budgetBar(plan: Plan, items: Item[], ctx: DecisionContext, decisions: Map<string, GroupDecision> | undefined): BudgetBar {
  const closed = new Set(plan.closed.map((c) => c.item.id));
  let booked = 0;
  let chosen = 0;
  let open = 0;
  let uncounted = 0;
  const add = (item: Item, to: "booked" | "chosen" | "open") => {
    const price = totalPrice(item, ctx);
    if (price == null) {
      uncounted++;
      return;
    }
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
  return { currency: ctx.currency, total: budget && budget.currency === ctx.currency ? budget.amount : null, booked, chosen, open, uncounted };
}
