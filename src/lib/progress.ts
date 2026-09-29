// Where the trip's decisions stand, for the strip under the trip's summary: what's still open (in date
// order, the near ones marked), how many are made, what's chosen but not booked, and which free
// cancellations run out soon. Also the money: booked, chosen and a guess for what's still open. Pure.
import { totalPrice, type DecisionContext, type GroupDecision } from "./decision";
import { formatDateRange, nightsBetween } from "./items";
import { departureDay, liveGroups, type Plan } from "./plan";
import type { Timeline, TimelineEntry } from "./timeline";
import { isTrip } from "./travelKinds";
import type { Item } from "./types";

export interface OpenDecision {
  key: string;
  /** The timeline entry to scroll to (its key). */
  target: string;
  title: string;
  date: string;
  /** "3 seçenek · Jardim Stay önde", "seçenek yok", "nasıl geçeceksin?". */
  note: string;
  /** Days until it (negative once it's past). */
  days: number;
  /** Within two weeks. */
  soon: boolean;
}

export interface Reminder {
  key: string;
  itemId: string;
  text: string;
  tone: "red" | "amber";
}

export interface DecisionProgress {
  made: number;
  total: number;
  open: OpenDecision[];
  reminders: Reminder[];
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

/** One entry of the timeline as a decision: made or not, and how to name it when it's not. */
function asDecision(e: TimelineEntry, decisions: Map<string, GroupDecision> | undefined): { made: boolean; open?: Omit<OpenDecision, "soon" | "days"> } | null {
  const options = (n: number, lead: string | null) => `${n} seçenek${lead ? ` · ${lead} önde` : ""}`;
  if (e.kind === "stay") {
    const b = e.block;
    if (b.kind !== "open") return { made: true };
    const count = new Set(b.groups.flatMap((g) => g.items.map((i) => i.id))).size;
    return {
      made: false,
      open: {
        key: e.key,
        target: e.key,
        title: `${b.city ?? "Konaklama"} konaklama · ${formatDateRange(b.range.start, b.range.end)}`,
        date: b.range.start,
        note: count ? options(count, winnerOf(b.groups.map((g) => g.key), decisions)) : "seçenek yok",
      },
    };
  }
  if (e.kind !== "travel") return null;
  const t = e.travel;
  if (t?.settled || (e.role === "move" && e.leg?.choice?.mode)) return { made: true };
  if (e.role === "other" && !t) return null;
  const count = t?.items.length ?? 0;
  const title =
    e.role === "arrival"
      ? `Varış · ${fmt(e.date)}`
      : e.role === "departure"
        ? `Dönüş · ${fmt(e.date)}`
        : `${e.subtitle ?? "Ulaşım"} · ${fmt(e.date)}`;
  const note =
    count === 1
      ? `kayıtlı: ${t!.items[0].name}`
      : count
        ? options(count, winnerOf(t ? [t.group.key] : [], decisions))
        : e.role === "move"
          ? "nasıl geçeceksin?"
          : "kayıtlı uçuş yok";
  return { made: false, open: { key: e.key, target: e.key, title, date: e.date, note } };
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

export function decisionProgress(
  timeline: Timeline,
  items: Item[],
  plan: Plan,
  decisions: Map<string, GroupDecision> | undefined,
  today: string,
): DecisionProgress {
  let made = 0;
  let total = 0;
  const open: OpenDecision[] = [];
  for (const e of timeline.entries) {
    const d = asDecision(e, decisions);
    if (!d) continue;
    total++;
    if (d.made) made++;
    else if (d.open) {
      const days = daysUntil(d.open.date, today);
      open.push({ ...d.open, days, soon: days >= 0 && days <= SOON_DAYS });
    }
  }
  open.sort((a, b) => a.date.localeCompare(b.date));

  // Chosen but not booked, and free cancellations running out: the booking-side to-dos.
  const closed = new Set(plan.closed.map((c) => c.item.id));
  const reminders: Reminder[] = [];
  for (const item of items) {
    if (closed.has(item.id) || !["stay", "flight", "transport", "activity"].includes(item.category)) continue;
    const alert = dateAlert(item, today);
    if (alert) reminders.push({ key: `r:${item.id}`, itemId: item.id, text: `${item.name}: ${alert.text.charAt(0).toLocaleLowerCase("tr")}${alert.text.slice(1)}`, tone: alert.tone });
  }
  // Running out first, then the nearest, then by name, so the strip doesn't reshuffle.
  const when = (r: Reminder) => {
    const item = items.find((i) => i.id === r.itemId)!;
    return (r.tone === "red" ? item.cancellation.freeUntil : departureDay(item)) ?? "9999";
  };
  reminders.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "red" ? -1 : 1) || when(a).localeCompare(when(b)) || a.text.localeCompare(b.text, "tr"));
  return { made, total, open, reminders };
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
