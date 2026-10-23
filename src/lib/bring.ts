// Karar Masası, getirme anları (docs/superpowers/specs/2026-10-22-karar-masasi-kararlar.md, karar 11): what the traveller
// brings to a row (a link dropped or pasted on it or its drawer, a screenshot dragged there) goes to that row's need, and
// once it is read the row says where it stands and what we think of it, only from what is known ("önerimizden €86 pahalı
// ve aktarmalı"; no price on either, no word on the price). Pure; app/plan/v82 draws it.
import { airportCityOf } from "./airports";
import { needKey } from "./emptyCards";
import { L } from "./i18n";
import type { IntentVM, OptionVM } from "./intents";
import { formatPrice, isoDate } from "./items";
import { cityKeyOf } from "./plan";
import { deckLead } from "./rowView";
import type { Item } from "./types";

/**
 * The need a thing brought to this row joins (Capture.forNeed → Item.forNeed): a flight's way and day
 * ("flight:bangkok:istanbul:2027-04-02", plan.flightNeeds reads its ends). Null where nothing binds by a key (a stay groups
 * by its nights).
 */
export function bringKey(vm: Pick<IntentVM, "kind" | "head">): string | null {
  const route = vm.head.route;
  if (vm.kind !== "flight" || !route?.from || !route.to) return null;
  return needKey("flight", route.from, route.to, isoDate(vm.head.date) ?? "");
}

/** The option that came in: one not in the deck before (the newest when several came), within the row's own. */
export function arrivedOption(before: ReadonlySet<string>, options: readonly OptionVM[]): OptionVM | null {
  const fresh = options.filter((o) => !before.has(o.id));
  if (!fresh.length) return null;
  return [...fresh].sort((a, b) => b.item.createdAt - a.item.createdAt)[0];
}

const stopsOf = (o: OptionVM): number | null => o.item.flight?.stops ?? null;
const amountOf = (o: OptionVM): { n: number; cur: string; scope: string } | null => {
  const p = o.item.price;
  return p.amount != null && p.currency ? { n: p.amount, cur: p.currency, scope: p.scope } : null;
};

/**
 * What we think of what came in, set beside our pick (else the deck's first): "Artık önerimiz bu." when it leads, else its
 * price against ours ("önerimizden €86 pahalı", "€38 ucuz", "aynı fiyat") and its stops when they differ ("ve aktarmalı",
 * "ve direkt"). Null when there is nothing to set it beside or nothing known to say.
 */
export function deckVerdict(o: OptionVM, deck: readonly OptionVM[]): string | null {
  if (o.ours) return L("Artık önerimiz bu.", "It's our pick now.");
  const others = deck.filter((x) => x.id !== o.id);
  const ours = others.find((x) => x.ours) ?? deckLead(others);
  if (!ours) return null;
  const word = ours.ours ? L("önerimizden", "than our pick") : L("ilk sıradakinden", "than the top one");
  const a = amountOf(o), b = amountOf(ours);
  const parts: string[] = [];
  if (a && b && a.cur === b.cur && a.scope === b.scope) {
    const diff = Math.round(a.n - b.n);
    const money = formatPrice(Math.abs(diff), a.cur);
    parts.push(diff === 0 ? L(`${ours.ours ? "önerimizle" : "ilk sıradakiyle"} aynı fiyat`, `the same price as ${ours.ours ? "our pick" : "the top one"}`) : diff > 0 ? L(`${word} ${money} pahalı`, `${money} dearer ${word}`) : L(`${word} ${money} ucuz`, `${money} cheaper ${word}`));
  }
  const s1 = stopsOf(o), s2 = stopsOf(ours);
  if (s1 != null && s2 != null && s1 !== s2) parts.push(s1 > s2 ? L("aktarmalı", "with a stop") : L("direkt", "direct"));
  if (!parts.length) return null;
  const text = parts.join(L(" ve ", " and "));
  return `${text[0].toLocaleUpperCase(L("tr", "en"))}${text.slice(1)}.`;
}

/** A flight's end as the plan's city key: an airport's code, town or name is its city's ("BKK", "Bangkok"). */
const endKey = (end: string) => cityKeyOf(airportCityOf(end) ?? end);
const dayOf = (i: Pick<Item, "flight" | "dates">): string | null => isoDate(i.flight?.departure?.slice(0, 10)) ?? isoDate(i.dates.start);
const apart = (a: string, b: string) => Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;

export interface PlannedFlight {
  tripId: string;
  /** The deck's records on that way and day (a day either side counts, as plan.flightNeeds clusters them). */
  ids: string[];
  /** What a save from this search joins (Capture.forNeed). */
  forNeed: string;
  from: string;
  to: string;
  day: string;
}

/**
 * Benle gezen eklenti (seviye 1): a flight search the traveller has open (its way and day from its address) as the plan's
 * row it is for: the trip whose flights go that way on that day, a day either side, with the most of them. Null when no
 * trip has it. Pure.
 */
export function planFlightFor(items: readonly Pick<Item, "id" | "tripId" | "category" | "status" | "flight" | "dates">[], search: { from: string; to: string; day: string }): PlannedFlight | null {
  const from = endKey(search.from), to = endKey(search.to);
  if (!from || !to) return null;
  const by = new Map<string, string[]>();
  for (const i of items) {
    if (i.category !== "flight" || i.status === "dismissed" || !i.flight?.from || !i.flight.to) continue;
    const day = dayOf(i);
    if (!day || apart(day, search.day) > 1 || endKey(i.flight.from) !== from || endKey(i.flight.to) !== to) continue;
    by.set(i.tripId, [...(by.get(i.tripId) ?? []), i.id]);
  }
  const best = [...by.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (!best) return null;
  const fromCity = airportCityOf(search.from) ?? search.from;
  const toCity = airportCityOf(search.to) ?? search.to;
  return { tripId: best[0], ids: best[1], forNeed: needKey("flight", fromCity, toCity, search.day), from: fromCity, to: toCity, day: search.day };
}
