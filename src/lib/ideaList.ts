// Yapılacak şeyler and Restoranlar as a pool of ideas by city (fikir havuzu v1, docs/mockups/
// 2026-10-05-fikir-havuzu-v1.html). Each idea stands somewhere: in the pool (no day), on a day still ahead,
// missed (its day went by without "Yaptım": during the trip it waits apart, "Bugüne al"), or done. The tabs
// filter by that (Hepsi · Havuzda · Günü var · Kaçtı · Yapıldı, with their counts), the chips by kind.
// Grouped: during the trip "Bugün · 10 Eki" first, then what was missed, then the cities (tonight's first),
// done last; before it, the cities in the trip's order. Within a city what's on a day comes first. A missed
// day is worked out on every view, never written. Pure.
import { cityOfNight, recordOf, type CatEntry } from "./categories";
import { ideaKindOf, type IdeaKind } from "./ideaKinds";
import { ideaDay } from "./ideas";
import { sameCity, type Plan } from "./plan";
import type { Item } from "./types";

export type IdeaStatus = "pool" | "day" | "missed" | "done";

export interface IdeaRowData {
  entry: CatEntry;
  /** The record (an idea, a restaurant); null for a block the list can't draw as a row (drawn as its card). */
  item: Item | null;
  /** Its day while that's still ahead; null in the pool and when missed. */
  day: string | null;
  /** The day it was on, gone by without "Yaptım": "9 Eki'ye konmuştu · havuza döndü". */
  returned: string | null;
  status: IdeaStatus;
  kind: IdeaKind | null;
}

export interface IdeaGroup {
  key: string;
  kind: "today" | "missed" | "city" | "done";
  /** The city (a city group), else null. */
  city: string | null;
  /** This is where the traveller sleeps tonight (during the trip). */
  here: boolean;
  rows: IdeaRowData[];
}

export type IdeaTab = "all" | IdeaStatus;

/** Every idea where it stands today. */
export function ideaRows(entries: CatEntry[], today: string): IdeaRowData[] {
  return entries.map((entry) => {
    const item = recordOf(entry);
    const at = item ? ideaDay(item, today) : { day: entry.date, returned: null };
    const status: IdeaStatus = item?.doneAt ? "done" : at.returned ? "missed" : at.day ? "day" : "pool";
    return { entry, item, ...at, status, kind: item ? ideaKindOf(item) : null };
  });
}

export const isDuringTrip = (plan: Pick<Plan, "range">, today: string): boolean => !!plan.range && plan.range.start <= today && today <= plan.range.end;

/** The tabs with their counts: Kaçtı only during the trip (before it nothing can be missed; after it, nothing matters). */
export function ideaTabs(rows: IdeaRowData[], plan: Pick<Plan, "range">, today: string): { tab: IdeaTab; count: number }[] {
  const n = (s: IdeaStatus) => rows.filter((r) => r.status === s).length;
  const tabs: { tab: IdeaTab; count: number }[] = [
    { tab: "all", count: rows.length },
    { tab: "pool", count: n("pool") + (isDuringTrip(plan, today) ? 0 : n("missed")) },
    { tab: "day", count: n("day") },
  ];
  if (isDuringTrip(plan, today)) tabs.push({ tab: "missed", count: n("missed") });
  tabs.push({ tab: "done", count: n("done") });
  return tabs;
}

/** The kinds the rows have, in their list's order, with their counts (the chips). */
export function kindCounts(rows: IdeaRowData[], order: readonly IdeaKind[]): { kind: IdeaKind; count: number }[] {
  return order.map((kind) => ({ kind, count: rows.filter((r) => r.kind === kind).length })).filter((k) => k.count > 0);
}

export function ideaGroups(
  entries: CatEntry[],
  plan: Pick<Plan, "range" | "stayBlocks">,
  today: string,
  filter: { tab?: IdeaTab; kind?: IdeaKind | null } = {},
): IdeaGroup[] {
  const during = isDuringTrip(plan, today);
  const tonight = during ? cityOfNight(plan, today) : null;
  const tab = filter.tab ?? "all";
  // Outside the trip a missed day is just the pool (its note says which day it was on).
  const statusOf = (r: IdeaRowData): IdeaStatus => (r.status === "missed" && !during ? "pool" : r.status);
  const rows = ideaRows(entries, today).filter((r) => (tab === "all" || statusOf(r) === tab) && (!filter.kind || r.kind === filter.kind));
  const done = rows.filter((r) => r.status === "done");
  const todays = during ? rows.filter((r) => r.status === "day" && r.day === today) : [];
  const missed = during ? rows.filter((r) => r.status === "missed") : [];
  const rest = rows.filter((r) => !done.includes(r) && !todays.includes(r) && !missed.includes(r));

  // The cities in the trip's order (tonight's first during the trip), then any other by name, then none.
  const order: string[] = [];
  const add = (c: string | null | undefined) => {
    if (c && !order.some((o) => sameCity(o, c))) order.push(c);
  };
  add(tonight);
  for (const b of plan.stayBlocks) add(b.city);
  const extra = rest.map(cityOf).filter((c): c is string => !!c && !order.some((o) => sameCity(o, c)));
  for (const c of [...new Set(extra)].sort((a, b) => a.localeCompare(b, "tr"))) add(c);

  const groups: IdeaGroup[] = [];
  if (todays.length) groups.push({ key: "today", kind: "today", city: tonight, here: false, rows: todays });
  if (missed.length) groups.push({ key: "missed", kind: "missed", city: null, here: false, rows: missed });
  for (const city of order) {
    const list = rest.filter((r) => {
      const c = cityOf(r);
      return !!c && sameCity(c, city);
    });
    if (list.length) groups.push({ key: `city:${city}`, kind: "city", city, here: !!tonight && sameCity(city, tonight), rows: byDay(list) });
  }
  const nowhere = rest.filter((r) => !cityOf(r));
  if (nowhere.length) groups.push({ key: "city:", kind: "city", city: null, here: false, rows: byDay(nowhere) });
  if (done.length) groups.push({ key: "done", kind: "done", city: null, here: false, rows: done });
  return groups;
}

const cityOf = (r: IdeaRowData): string | null => r.item?.city ?? r.entry.city;

/** What's on a day first, by day then time; then the pool in the order it came (saved order). */
function byDay(list: IdeaRowData[]): IdeaRowData[] {
  return list
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      if (a.r.day && b.r.day) return a.r.day.localeCompare(b.r.day) || (a.r.entry.time ?? "").localeCompare(b.r.entry.time ?? "") || a.i - b.i;
      if (a.r.day || b.r.day) return a.r.day ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.r);
}
