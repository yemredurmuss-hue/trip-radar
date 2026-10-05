// The day-by-day view as cards (0.34.1, approved widget "günlük akış v4"): one card a day, its photo on
// the left and what happens as a short list; tapping it opens the day on its own page. Days with
// nothing planned in a row (in the same city) are one card. Pure.
import { cityOfAirport } from "./airports";
import { cardKind, legTransportMode, type CardKind } from "./cardKinds";
import type { LegMode } from "./types";
import { formatDateRange } from "./items";
import { L } from "./i18n";
import { dayRows, type DayRow } from "./journey";
import type { RentalEntry, TimelineSection } from "./timeline";
import type { Listing } from "./types";

export interface DayCard {
  key: string;
  /** The first day; `end` the last when empty days are merged. */
  date: string;
  end: string | null;
  /** "2. gün", "5–6. gün"; null for a trip on the line outside the trip's days. */
  dayNo: string | null;
  city: string | null;
  /** A day that moves: "Porto → Lizbon". */
  route: string | null;
  title: string;
  rows: DayRow[];
}

/** What isn't only information or an idea: what the day is about. */
export const isPlanRow = (r: DayRow) => r.kind !== "info" && r.kind !== "ideas" && r.kind !== "idea" && !(r.kind === "leg" && r.state === "info");
/** Ideas saved for the day (to pick from, or to do without booking). */
export const ideaCount = (rows: DayRow[]) => rows.reduce((n, r) => n + (r.kind === "ideas" ? r.items.length : r.kind === "idea" ? 1 : 0), 0);

/** The days in order: a city day titled by its city, a day that moves by its route. */
export function dayCards(sections: TimelineSection[], opts: { rentals?: RentalEntry[]; listings?: Map<string, Listing> } = {}): DayCard[] {
  const out: DayCard[] = [];
  for (const section of sections) {
    if (section.kind === "journey") {
      const j = section.journey;
      // An airport code reads as its city: "İstanbul → Porto", not "IST → Porto".
      const place = (p: string | null) => (p && /^[A-Z]{3}$/.test(p) ? (cityOfAirport(p) ?? p) : p);
      const from = place(j.from);
      const to = place(j.to);
      const route = from && to ? `${from} → ${to}` : to ? `→ ${to}` : from ? `${from} →` : null;
      const word = j.role === "arrival" ? L("Varış", "Arrival") : j.role === "departure" ? L("Dönüş", "Return") : L("Şehir değişimi", "Change of city");
      out.push({
        key: section.key,
        date: j.date,
        end: null,
        dayNo: j.dayNo ? L(`${j.dayNo}. gün`, `Day ${j.dayNo}`) : null,
        city: j.role === "departure" ? from : to,
        route,
        title: route ?? word,
        rows: dayRows({ journey: section, rentals: opts.rentals, listings: opts.listings }),
      });
    } else if (section.kind === "travel") {
      const e = section.entry;
      const rows = dayRows({ journey: { kind: "journey", key: section.key, journey: { key: section.key, role: "move", date: e.date, dayNo: null, from: null, to: null, out: null, in: null }, entries: [e] } });
      out.push({ key: section.key, date: e.date, end: null, dayNo: null, city: null, route: null, title: rows.find(isPlanRow)?.title ?? formatDateRange(e.date, null), rows });
    } else {
      for (const e of section.entries) {
        if (e.kind !== "day") continue;
        const rows = dayRows({ day: e, rentals: opts.rentals, listings: opts.listings });
        const prev = out.at(-1);
        // A free day after a free day in the same city: one card for both.
        if (!rows.length && prev && !prev.rows.length && prev.city === section.city && prev.dayNo) {
          prev.end = e.date;
          prev.dayNo = prev.dayNo.replace(/^(\d+)(?:–\d+)?/, `$1–${e.dayNo}`).replace(/^Day (\d+)(?:–\d+)?/, `Days $1–${e.dayNo}`);
          prev.title = section.city ? L(`${section.city} · boş günler`, `${section.city} · free days`) : L("Boş günler", "Free days");
          continue;
        }
        out.push({
          key: e.key,
          date: e.date,
          end: null,
          dayNo: L(`${e.dayNo}. gün`, `Day ${e.dayNo}`),
          city: section.city,
          route: null,
          title: rows.length ? (section.city ?? e.title) : section.city ? L(`${section.city} · boş gün`, `${section.city} · free day`) : L("Boş gün", "Free day"),
          rows,
        });
      }
    }
  }
  return out;
}

/** The closed card's list: at most four lines; with more, three and "+N daha" (their times). */
export function foldRows(rows: DayRow[]): { shown: DayRow[]; more: DayRow[] } {
  const plans = rows.filter(isPlanRow);
  if (plans.length <= 4) return { shown: plans, more: [] };
  return { shown: plans.slice(0, 3), more: plans.slice(3) };
}

/** A row's word on the closed card: ✓ booked; what's left to do in a word; nothing for what needs nothing. */
export function rowMark(r: DayRow): { done: boolean; text: string } | null {
  switch (r.state) {
    case "done":
      return { done: true, text: "✓" };
    case "pending":
      return { done: false, text: L("rezerve et", "book") };
    case "decide":
      return { done: false, text: L("karar ver", "decide") };
    case "open":
      return { done: false, text: L("planla", "plan") };
    default:
      return null;
  }
}

/** A trip's two ends for its card, the kind's word left out: "Uçuş LIS → IST" → ["LIS", "IST"]; null when it isn't one. */
export function endsOf(title: string): [string, string] | null {
  const parts = title.split(" → ");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const from = parts[0].replace(/^(Uçuş|Tren|Otobüs|Minibüs|Vapur|Feribot|Taksi|Transfer|Flight|Train|Bus|Minibus|Ferry|Taxi)\s+/i, "");
  return [from, parts[1]];
}

/** What a row is, as the Plan's cards say it (their icon and colour): a booking's own kind, a trip by its way. */
export function rowKind(r: DayRow): CardKind {
  if (r.item) return cardKind(r.item);
  if (r.rental) return "car";
  if (r.entry?.kind === "travel") {
    const settled = r.entry.travel?.settled ?? null;
    if (settled) return cardKind(settled);
    const mode = (r.entry.travel?.mode ?? r.entry.leg?.mode ?? null) as LegMode | null;
    return legTransportMode(mode) ?? (mode === "flight" ? "flight" : "transport");
  }
  if (r.leg) return legTransportMode(r.leg.choice?.mode ?? null) ?? "taxi";
  if (r.kind === "ideas" || r.kind === "idea") return r.item ? cardKind(r.item) : "todo";
  return r.stayKey ? "stay" : "other";
}

/** The day's highlight: its first thing to do there (a tour, a table), else its trip (the flight, not the taxi to it), else its first line. */
export function highlightOf(card: DayCard): DayRow | null {
  const plans = card.rows.filter(isPlanRow);
  return plans.find((r) => r.item && (r.item.category === "activity" || r.item.category === "food")) ?? plans.find((r) => r.kind === "travel") ?? plans[0] ?? null;
}

/**
 * The day's photo: the highlight's own picture when its page had one; else a search for it in its city
 * ("Douro tekne turu Porto"); a day that only travels or has nothing, its city.
 */
export function dayPhoto(card: DayCard): { url: string } | { query: string } | null {
  const h = highlightOf(card);
  if (h?.item?.imageUrl) return { url: h.item.imageUrl };
  if (h?.item && (h.item.category === "activity" || h.item.category === "food")) return { query: [h.item.name, h.item.city ?? card.city].filter(Boolean).join(" ") };
  return card.city ? { query: card.city } : null;
}

/**
 * The whole day, in order, nothing folded: every line (check-in, the transfer, the flight, the tour) and
 * each idea saved for it on its own line. A closed card lists these; an open one shows each as its card.
 */
export function flowRows(card: DayCard): DayRow[] {
  return card.rows.flatMap((r) =>
    r.kind === "ideas" ? r.items.map((i) => ({ ...r, key: `idea:${i.id}`, kind: "idea" as const, title: i.name, sub: null, item: i, items: [] })) : [r],
  );
}
