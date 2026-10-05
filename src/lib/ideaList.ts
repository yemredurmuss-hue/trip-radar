// Yapılacak şeyler and Restoranlar as one list by city (0.35.3): a pool of ideas per city, some put on a day.
// During the trip "Bugün · 9 Eki" comes first, then the city slept in tonight, then the others in the trip's
// order; before it, the trip's order. Within a city what's on a day comes first (by day), then the pool in the
// order saved. A day gone by without "Yaptım" puts an idea back in its city's pool, saying which day it was
// on (shown, never written). Done ones wait folded at the end ("Yapılanlar"). Pure.
import { cityOfNight, recordOf, type CatEntry } from "./categories";
import { ideaDay } from "./ideas";
import { sameCity, type Plan } from "./plan";
import type { Item } from "./types";

export interface IdeaRowData {
  entry: CatEntry;
  /** The record (an idea, a restaurant); null for a block the list can't draw as a row (drawn as its card). */
  item: Item | null;
  /** Its day while that's still ahead; null in the pool. */
  day: string | null;
  /** The day it was on, gone by without "Yaptım": "9 Eki için konmuştu · havuza döndü". */
  returned: string | null;
}

export interface IdeaGroup {
  key: string;
  kind: "today" | "city" | "done";
  /** The city (a city group), else null. */
  city: string | null;
  /** This is where the traveller sleeps tonight (during the trip). */
  here: boolean;
  rows: IdeaRowData[];
}

export function ideaGroups(entries: CatEntry[], plan: Pick<Plan, "range" | "stayBlocks">, today: string): IdeaGroup[] {
  const during = !!plan.range && plan.range.start <= today && today <= plan.range.end;
  const tonight = during ? cityOfNight(plan, today) : null;
  const rows: IdeaRowData[] = entries.map((entry) => {
    const item = recordOf(entry);
    const at = item ? ideaDay(item, today) : { day: entry.date, returned: null };
    return { entry, item, ...at };
  });
  const done = rows.filter((r) => r.item?.doneAt);
  const todays = during ? rows.filter((r) => !r.item?.doneAt && r.day === today) : [];
  const rest = rows.filter((r) => !done.includes(r) && !todays.includes(r));

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
  if (todays.length) groups.push({ key: "today", kind: "today", city: null, here: false, rows: todays });
  for (const city of order) {
    const list = rest.filter((r) => { const c = cityOf(r); return !!c && sameCity(c, city); });
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
