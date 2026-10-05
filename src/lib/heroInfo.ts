// What the hero's one-line tally and its facts column say beyond tripFacts: how many flights, stays,
// transport and experiences the plan holds, the countries by name, whether a plug fits, and the time
// difference in short. Pure.
import { countryInfo } from "./countries";
import { L, locale } from "./i18n";
import type { Plan } from "./plan";
import type { Item } from "./types";

export interface HeroTally {
  flight: number;
  stay: number;
  transport: number;
  /** Activities and restaurants on the plan (chosen or booked): "deneyim". */
  experience: number;
}

/**
 * Each need counts once: a flight or a transfer with three options is one flight; a stay is one block of
 * nights with something saved for it. Experiences are the chosen or booked activities and restaurants.
 */
export function heroTally(plan: Plan, items: Item[]): HeroTally {
  const closed = new Set(plan.closed.map((c) => c.item.id));
  const groups = (category: string) => plan.groups.filter((g) => g.category === category && g.items.length > 0).length;
  const stays =
    plan.stayBlocks.filter((b) => b.kind !== "open" || b.groups.length > 0).length + plan.looseStays.filter((g) => g.items.length > 0).length;
  const experience = items.filter(
    (i) => (i.category === "activity" || i.category === "food") && (i.status === "chosen" || i.status === "booked") && !closed.has(i.id),
  ).length;
  return { flight: groups("flight"), stay: stays, transport: groups("transport"), experience };
}

/** Country names in the order the cities come, each once ("Portekiz", "Portekiz, İspanya"). */
export function countryNames(codes: (string | null | undefined)[]): string[] {
  const seen: string[] = [];
  for (const c of codes) {
    const code = c?.toUpperCase();
    if (code && /^[A-Z]{2}$/.test(code) && !seen.includes(code)) seen.push(code);
  }
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale()], { type: "region" });
  } catch {
    names = null;
  }
  return seen.map((code) => names?.of(code) ?? code);
}

export type PlugFit = "fits" | "some" | "adapter";

/**
 * Whether the plugs from home go in there: every home type fits ("adaptör gerekmez"), some do (a Schuko
 * plug in a Swiss socket doesn't, a two-pin one does), or none. Null when either country isn't known.
 */
export function plugFit(home: string | null, there: string | null): PlugFit | null {
  const a = countryInfo(home)?.plugs;
  const b = countryInfo(there)?.plugs;
  if (!a?.length || !b?.length) return null;
  const fitting = a.filter((p) => b.includes(p)).length;
  return fitting === a.length ? "fits" : fitting > 0 ? "some" : "adapter";
}

export const plugFitText = (fit: PlugFit): string =>
  ({
    fits: L("Adaptör gerekmez", "No adapter needed"),
    some: L("Bazı fişler için adaptör gerekir", "Some plugs need an adapter"),
    adapter: L("Adaptör gerekir", "Adapter needed"),
  })[fit];

/** "−2 saat", "+5,5 saat" ("−2 h"); "Aynı saat" when the same time; null when it isn't known. */
export function offsetText(hours: number | null): string | null {
  if (hours == null) return null;
  if (!hours) return L("Aynı saat", "Same time");
  const n = Math.abs(hours).toLocaleString(locale(), { maximumFractionDigits: 1 });
  return `${hours > 0 ? "+" : "−"}${n} ${L("saat", "h")}`;
}

/** "Euro", "İngiliz Sterlini": the money's name in the board's language. */
export function currencyName(code: string): string {
  try {
    const name = new Intl.DisplayNames([locale()], { type: "currency" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(locale()) + name.slice(1) : code;
  } catch {
    return code;
  }
}

/** Initials for a traveller's circle: "Sabine" → "S", "Emre Durmuş" → "ED". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toLocaleUpperCase(locale()))
    .join("");
}

/** The trip's country codes in the order its places come (by date), each once; flights left out: they start at home. */
export function countryCodesOf(items: Item[]): string[] {
  const placed = items
    .filter((i) => i.status !== "dismissed" && i.category !== "flight" && i.countryCode)
    .sort((a, b) => (a.dates.start ?? "9").localeCompare(b.dates.start ?? "9"));
  return [...new Set(placed.map((i) => i.countryCode!.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))];
}

/** The same countries by name, in the board's language. */
export const countriesOf = (items: Item[]): string[] => countryNames(countryCodesOf(items));

/** A country's flag as an emoji, from the two regional-indicator letters of its code ("PT" → 🇵🇹); "" for anything else. */
export function flagEmoji(code: string | null | undefined): string {
  const c = code?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/**
 * The travellers' card title: the names when the shared trip has them ("Emre & Sabine", "Emre, Sabine +1"),
 * else how many the saves say ("2 kişi"), else nothing.
 */
export function travellersTitle(names: string[], count: number): string {
  const n = names.map((x) => x.trim()).filter(Boolean);
  if (n.length === 1) return n[0];
  if (n.length === 2) return `${n[0]} & ${n[1]}`;
  if (n.length > 2) return `${n[0]}, ${n[1]} +${n.length - 2}`;
  return count > 0 ? nPeople(count) : "";
}

/** "2 kişi" / "2 people". */
export const nPeople = (n: number): string => L(`${n} kişi`, n === 1 ? "1 person" : `${n} people`);

/** Each city's own days (from its nights), else the whole trip's: what its weather is read for. */
export function cityRanges(plan: Plan, cities: string[], range: { start: string; end: string } | null): { city: string; start: string; end: string }[] {
  const out: { city: string; start: string; end: string }[] = [];
  for (const city of cities) {
    const blocks = plan.stayBlocks.filter((b) => b.city?.trim().toLowerCase() === city.trim().toLowerCase());
    const start = blocks.map((b) => b.range.start).sort()[0] ?? range?.start;
    const end = blocks.map((b) => b.range.end).sort().at(-1) ?? range?.end;
    if (start && end) out.push({ city, start, end });
  }
  return out;
}
