// What the hero's one-line tally and its facts column say beyond tripFacts: how many flights, stays,
// transport and experiences the plan holds, the countries by name, whether a plug fits, and the time
// difference in short. Pure.
import type { CatSection, SectionId } from "./categories";
import { countryInfo } from "./countries";
import { cityKeyOf, type Plan } from "./plan";
import { L, locale } from "./i18n";
import type { Item } from "./types";

export interface HeroTally {
  flight: number;
  stay: number;
  transport: number;
  /** Etkinlikler, Yapılacak şeyler and Restoranlar together: "deneyim". */
  experience: number;
}

/** The Plan's sections each cell of the hero's plan line counts, in the order a tap looks for one with something in it. */
export const TALLY_SECTIONS: Record<keyof HeroTally, readonly SectionId[]> = {
  flight: ["flight"],
  stay: ["stay"],
  transport: ["transport"],
  experience: ["activity", "todo", "food"],
};

/**
 * What the Plan's sections hold (revizyon 1, 2026-10-05): each cell counts its sections' entries, the
 * same number as each header's "x/y" ("y"), so the hero and the Plan always agree. A taxi or a transfer
 * counts in Ulaşım as the section shows it; what's hidden or "Gerek yok" doesn't, as in the section.
 */
export function sectionTally(sections: Pick<CatSection, "id" | "entries">[]): HeroTally {
  const count = (ids: readonly SectionId[]) => sections.filter((s) => ids.includes(s.id)).reduce((n, s) => n + s.entries.length, 0);
  return {
    flight: count(TALLY_SECTIONS.flight),
    stay: count(TALLY_SECTIONS.stay),
    transport: count(TALLY_SECTIONS.transport),
    experience: count(TALLY_SECTIONS.experience),
  };
}

/** The section a cell opens: the first of its sections with something in it, else its first ("deneyim": Etkinlikler). */
export function tallySection(kind: keyof HeroTally, sections: Pick<CatSection, "id" | "entries">[]): SectionId {
  const ids = TALLY_SECTIONS[kind];
  return ids.find((id) => sections.some((s) => s.id === id && s.entries.length > 0)) ?? ids[0];
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

/**
 * Each city's own days (from its nights), else the whole trip's: what its weather is read for. A main place
 * (destinations.ts) spans its members' nights: Madeira from Funchal's first night to Gaula's last.
 */
export function cityRanges(
  plan: Plan,
  cities: (string | { name: string; members: string[] })[],
  range: { start: string; end: string } | null,
): { city: string; start: string; end: string }[] {
  const out: { city: string; start: string; end: string }[] = [];
  for (const place of cities) {
    const city = typeof place === "string" ? place : place.name;
    const keys = new Set((typeof place === "string" ? [place] : [place.name, ...place.members]).map(cityKeyOf));
    const blocks = plan.stayBlocks.filter((b) => b.city && keys.has(cityKeyOf(b.city)));
    const start = blocks.map((b) => b.range.start).sort()[0] ?? range?.start;
    const end = blocks.map((b) => b.range.end).sort().at(-1) ?? range?.end;
    if (start && end) out.push({ city, start, end });
  }
  return out;
}
