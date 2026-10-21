// The options beside the plan (plan v13, docs/superpowers/specs/2026-10-21-plan-niyet-karti-v13-design.md K82–K83): which tab
// an option is in (the traveller's saves or the AI's), its day, the order the drawer lists them in, and for flights spread
// over several days what decides between them (the cheapest, the shortest, the fewest stops, the bag) instead of the clock.
// Pure: app/plan/v82/IntentDrawer.tsx draws what it says.
import type { OptionVM } from "./intents";
import { L } from "./i18n";
import { isoDate } from "./items";

export type DrawerTab = "all" | "mine" | "ai";
export type SortKey = "fit" | "price" | "mins" | "score" | "dist";

/** Kaydettiklerin (a link the traveller sent, a fellow traveller's) or AI önerileri. */
export const optionTab = (o: OptionVM): Exclude<DrawerTab, "all"> => (o.source?.kind === "ai" ? "ai" : "mine");

/** The option's day ("2027-01-15", a time after it set aside); else its flight's leaving day; null when neither says. */
export const optionDay = (o: OptionVM): string | null => isoDate(o.item.dates?.start?.slice(0, 10)) ?? isoDate(o.item.flight?.departure?.slice(0, 10));

/** What it costs for everyone going: a per-person fare times the people, else its own amount; null with no price. */
export function totalAmount(o: OptionVM, people: number): number | null {
  const p = o.item.price;
  if (!p || p.amount == null) return null;
  return p.scope === "per_person" ? p.amount * Math.max(1, people) : p.amount;
}

const minutesOf = (o: OptionVM): number | null => o.item.metrics?.durationMinutes ?? null;
const stopsOf = (o: OptionVM): number | null => o.item.flight?.stops ?? null;
const ratingOf = (o: OptionVM): number | null => {
  const r = o.item.rating;
  return r?.value != null ? r.value / (r.scale ?? 10) : null;
};

/** Ascending with the unknown last. */
const byNum = (f: (o: OptionVM) => number | null, desc = false) => (a: OptionVM, b: OptionVM): number => {
  const x = f(a), y = f(b);
  if (x == null && y == null) return a.place - b.place;
  if (x == null) return 1;
  if (y == null) return -1;
  return (desc ? y - x : x - y) || a.place - b.place;
};

const SORTERS: Readonly<Record<SortKey, (people: number) => (a: OptionVM, b: OptionVM) => number>> = {
  fit: () => byNum((o) => o.score, true),
  price: (people) => byNum((o) => totalAmount(o, people)),
  mins: () => byNum(minutesOf),
  score: () => byNum(ratingOf, true),
  dist: () => byNum((o) => o.item.metrics?.distanceToCenterKm ?? null),
};

/** The drawer's list: the tab's options on the day asked for (every day: "all"), in the order asked for. */
export function drawerList(options: readonly OptionVM[], tab: DrawerTab, day: string | "all", sort: SortKey, people = 1): OptionVM[] {
  return options
    .filter((o) => tab === "all" || optionTab(o) === tab)
    .filter((o) => day === "all" || optionDay(o) === day)
    .sort(SORTERS[sort](people));
}

/** The days the options are on, each with its cheapest total (unknown prices aside), earliest first. */
export function optionDays(options: readonly OptionVM[], people = 1): { day: string; cheapest: number | null }[] {
  const by = new Map<string, number | null>();
  for (const o of options) {
    const d = optionDay(o);
    if (!d) continue;
    const t = totalAmount(o, people);
    const was = by.get(d);
    by.set(d, was == null ? t : t == null ? was : Math.min(was, t));
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, cheapest]) => ({ day, cheapest }));
}

/** Flights on more than one day are compared by what decides (K83); a single day keeps the clock in front. */
export function compareMode(options: readonly OptionVM[], kind: string): boolean {
  if (kind !== "flight" || options.length < 2) return false;
  return new Set(options.map(optionDay).filter(Boolean)).size > 1;
}

/** The option that is cheapest, shortest and (only when one alone has it) fewest-stops; what isn't known never wins. */
export function winners(options: readonly OptionVM[], people = 1): { price?: string; mins?: string; stops?: string } {
  const out: { price?: string; mins?: string; stops?: string } = {};
  const best = (f: (o: OptionVM) => number | null): { id: string; n: number; ties: number } | null => {
    let won: { id: string; n: number; ties: number } | null = null;
    for (const o of options) {
      const v = f(o);
      if (v == null) continue;
      if (!won || v < won.n) won = { id: o.id, n: v, ties: 1 };
      else if (v === won.n) won.ties += 1;
    }
    return won;
  };
  const p = best((o) => totalAmount(o, people));
  if (p) out.price = p.id;
  const m = best(minutesOf);
  if (m) out.mins = m.id;
  const s = best(stopsOf);
  if (s && s.ties === 1) out.stops = s.id;
  return out;
}

/** Every option has a checked bag included: said once over the list, not on each card. */
export const bagAll = (options: readonly OptionVM[]): boolean => options.length > 0 && options.every((o) => o.item.metrics?.checkedBagIncluded === true);

/**
 * The pick's own reasons for the drawer's "Önerim." line (mockup v13): choice.ts's sentence without "Önerim <name>:" and without
 * the alternatives after it ("Tasarruf için 3. …"); "İsteklerine en çok bu uyuyor." when it gives none or speaks of another.
 */
export function pickReason(headline: string | null, name: string): string {
  const plain = L("İsteklerine en çok bu uyuyor.", "It fits what you asked best.");
  if (!headline) return plain;
  const prefix = [L(`Önerim ${name}: `, `My pick is ${name}: `), `Önerim ${name}: `].find((p) => headline.startsWith(p));
  if (!prefix) return plain;
  const rest = headline.slice(prefix.length);
  // The reasons end at the first full stop followed by a new sentence (a thousands dot has a digit after it).
  const end = rest.search(/\.\s+\p{Lu}/u);
  const own = (end >= 0 ? rest.slice(0, end + 1) : rest).trim();
  return own ? own.charAt(0).toLocaleUpperCase("tr") + own.slice(1) : plain;
}
