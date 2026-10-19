// The words of the hero's strip and its windows (v82, v83 B9 and C19, Etsy T5): where the backbone stands ("%61 planda
// · %33 alındı" and its sentence), what a new backbone says instead ("18 ihtiyaç · 5'inde önerimiz var"), the dates'
// tip city by city (and only the nights while the dates are a guess, D15), the budget window's lines and each person's
// share, the bookings whose file is missing (B15), the weather's one chip and the facts' chips (country, money, plug,
// time, language, visa; a trip of several countries each one's own, D9). Nothing is said that isn't known: a missing
// part is left out, never written as "yok". Pure.
import { weatherTitle, type CityWeather, type Sky } from "./climate";
import { countryInfo } from "./countries";
import { countryNames, currencyName, nPeople, offsetText, plugFit, plugFitText } from "./heroInfo";
import { formatDateRange, formatPrice, nightsBetween } from "./items";
import { L, locale } from "./i18n";
import { nNights } from "./i18nText";
import { bookedShare, DOC_SOON_DAYS, planShare, type IntentStatus, type Share } from "./intents";
import { numberPossessive, percentPossessive } from "./lifecycle";
import type { BudgetBar } from "./progress";
import type { CountryFacts, TripFacts } from "./tripFacts";

export interface HeroCounts {
  /** Every intent but those said not needed. */
  total: number;
  plan: Share;
  booked: Share;
  /** Waiting for the traveller: to find, to decide, our pick to take. */
  open: number;
  /** Of those, our pick (Önerimiz). */
  suggested: number;
  /** Nothing picked or bought by the traveller yet (v83 "omurga yeni"). */
  fresh: boolean;
}

const OPEN: readonly IntentStatus[] = ["searching", "deciding", "suggested"];

export function heroCounts(intents: readonly { status: IntentStatus }[]): HeroCounts {
  const plan = planShare(intents);
  const booked = bookedShare(intents);
  return {
    total: plan.total,
    plan,
    booked,
    open: intents.filter((i) => OPEN.includes(i.status)).length,
    suggested: intents.filter((i) => i.status === "suggested").length,
    fresh: !intents.some((i) => i.status === "chosen" || i.status === "booked"),
  };
}

/** Turkish "5'inde", "6'sında", "10'unda": the number's possessive in the locative. */
export function numberLocative(n: number): string {
  const p = numberPossessive(n);
  return `${p}${/[ıu]$/.test(p) ? "nda" : "nde"}`;
}

/** The strip's line: "%61 planda · %33 alındı". */
export const shareWords = (c: HeroCounts): { plan: string; booked: string } => ({
  plan: L(`%${c.plan.pct ?? 0} planda`, `${c.plan.pct ?? 0}% planned`),
  booked: L(`%${c.booked.pct ?? 0} alındı`, `${c.booked.pct ?? 0}% booked`),
});

/** Its tip, a whole sentence: "Omurganın %61'i planda (18 ihtiyaçtan 11'i), %33'ü alındı (6). 7 karar bekliyor." */
export function shareSentence(c: HeroCounts): string {
  const p = c.plan.pct ?? 0;
  const b = c.booked.pct ?? 0;
  const open = c.open ? L(`${c.open} karar bekliyor.`, `${c.open} to decide.`) : L("Karar bekleyen yok.", "Nothing left to decide.");
  return L(
    `Omurganın ${percentPossessive(p)} planda (${c.total} ihtiyaçtan ${numberPossessive(c.plan.count)}), ${percentPossessive(b)} alındı (${c.booked.count}). ${open}`,
    `${p}% of the plan's needs are planned (${c.plan.count} of ${c.total}), ${b}% booked (${c.booked.count}). ${open}`,
  );
}

/** A new backbone's line in its place (C19): "18 ihtiyaç · 5'inde önerimiz var". */
export function freshWords(c: HeroCounts): string {
  const needs = L(`${c.total} ihtiyaç`, `${c.total} ${c.total === 1 ? "need" : "needs"}`);
  if (!c.suggested) return needs;
  return `${needs} · ${L(`${numberLocative(c.suggested)} önerimiz var`, `${c.suggested} with our pick`)}`;
}

/** B15: the bookings with no file in their last two weeks (their boxes' amber "belge yok"), for the hero's count. */
export function docsMissing<T extends { status: IntentStatus; access: { docMissing: boolean } | null }>(intents: readonly T[]): T[] {
  return intents.filter((i) => i.status === "booked" && Boolean(i.access?.docMissing));
}

/** The count's words and its tip: "1 belge yok"; "2 rezervasyonun belgesi eklenmedi; 14 gün içinde başlıyor." */
export function docsWords(n: number): { text: string; tip: string } {
  return {
    text: L(`${n} belge yok`, n === 1 ? "1 file missing" : `${n} files missing`),
    tip: L(
      `${n} rezervasyonun belgesi eklenmedi; ${DOC_SOON_DAYS} gün içinde başlıyor. Basınca ilkine gider.`,
      `${n === 1 ? "A booking has" : `${n} bookings have`} no file yet and ${n === 1 ? "starts" : "start"} within ${DOC_SOON_DAYS} days. A click goes to the first.`,
    ),
  };
}

/**
 * The dates' big line: "8–14 Ekim", "~8–14 Ekim" when read from the saves; "~ · 10 gece" while they are still the guess
 * made from a month or a season (D15): only the nights are known then, a day would be made up.
 */
export function datesWords(d: { range: { start: string; end: string }; estimated: boolean; rough?: boolean }, short = false): string {
  if (d.rough) return `~ · ${nNights(nightsBetween(d.range.start, d.range.end))}`;
  return `${d.estimated ? "~" : ""}${short ? shortRange(d.range.start, d.range.end) : formatDateRange(d.range.start, d.range.end)}`;
}

/** The dates' tip: each city's own days ("Porto 8–11 Ekim · Lizbon 11–14 Ekim"), and that they are a guess. */
export function datesTip(places: readonly { city: string; start: string; end: string }[], estimated: boolean): string | null {
  const parts = places.map((p) => `${p.city} ${formatDateRange(p.start, p.end)}`);
  if (estimated) parts.push(L("Tahmini · kayıtlardan", "Estimated · from saves"));
  return parts.length ? parts.join(" · ") : null;
}

/** "8–14 Eki", "29 Eki – 3 Kas": the dates in the thin bar. */
export function shortRange(start: string, end: string): string {
  const day = (d: string) => Number(d.slice(8, 10));
  const mon = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { month: "short", timeZone: "UTC" });
  if (start === end) return `${day(start)} ${mon(start)}`;
  return start.slice(0, 7) === end.slice(0, 7) ? `${day(start)}–${day(end)} ${mon(end)}` : `${day(start)} ${mon(start)} – ${day(end)} ${mon(end)}`;
}

/** The weather in one chip: the coolest night to the warmest day ("6–19°"), its sky, and each city in its tip. */
export function weatherChip(list: readonly CityWeather[], month: string): { text: string; sky: Sky; tip: string } | null {
  if (!list.length) return null;
  const low = Math.min(...list.map((w) => w.low));
  const high = Math.max(...list.map((w) => w.high));
  const skies = list.map((w) => w.sky);
  const sky = (["sun", "partly", "cloud", "rain"] as const).reduce((best, s) => (skies.filter((x) => x === s).length > skies.filter((x) => x === best).length ? s : best), skies[0]);
  return { text: low === high ? `${high}°` : `${low}–${high}°`, sky, tip: list.map((w) => weatherTitle(w, month)).join(" · ") };
}

export interface BudgetView {
  currency: string;
  /** How the likely total is said: "~" (what it will likely cost), "≈" when prices in another money were converted (D17). */
  sign: "~" | "≈";
  /** What it will likely cost: booked + chosen + each open decision's leading option. */
  likely: number;
  /** The trip's budget; null when none is set. */
  total: number | null;
  /** Over the budget by this much (likely against the budget); 0 when it fits or there is none. */
  over: number;
  lines: { key: "booked" | "planned" | "free" | "over"; label: string; amount: number }[];
  /** Kişi başı (T5): the likely total shared out, only with a budget and two or more going. */
  perPerson: { amount: number; people: number } | null;
  /** The window's closing words: what the open decisions add, the likely total against the budget, prices not counted. */
  note: string[];
}

/** The budget segment and its window; null when nothing is known about money (no budget, no price): no segment (C19). */
export function budgetView(bar: BudgetBar | null, people: number): BudgetView | null {
  if (!bar) return null;
  const known = bar.booked + bar.chosen;
  const likely = known + bar.open;
  if (bar.total == null && likely <= 0) return null;
  const money = (n: number) => formatPrice(n, bar.currency);
  const overKnown = bar.total != null && known > bar.total ? known - bar.total : 0;
  const lines: BudgetView["lines"] = [
    { key: "booked" as const, label: L("Rezerve", "Booked"), amount: bar.booked },
    { key: "planned" as const, label: L("Planlanan", "Planned"), amount: bar.chosen },
    { key: "free" as const, label: L("Boşta", "Free"), amount: bar.total != null && !overKnown ? bar.total - known : 0 },
    { key: "over" as const, label: L("Aşıyor", "Over"), amount: overKnown },
  ].filter((l) => l.amount > 0);
  const note: string[] = [];
  if (bar.open > 0) note.push(L(`Karar bekleyenler seçilince yaklaşık ${money(bar.open)} daha eklenir.`, `About ${money(bar.open)} more once the open decisions are made.`));
  if (bar.total != null && likely > 0)
    note.push(
      likely <= bar.total
        ? L(`Tahmini toplam ~${money(likely)}, bütçeye sığar · ${money(bar.total - likely)} pay.`, `Likely total ~${money(likely)}, fits the budget · ${money(bar.total - likely)} to spare.`)
        : L(`Tahmini toplam ~${money(likely)}, bütçeyi ${money(likely - bar.total)} aşar.`, `Likely total ~${money(likely)}, ${money(likely - bar.total)} over the budget.`),
    );
  if (bar.uncounted > 0) note.push(L(`${bar.uncounted} fiyat sayılamadı.`, bar.uncounted === 1 ? "1 price couldn't be counted." : `${bar.uncounted} prices couldn't be counted.`));
  return {
    currency: bar.currency,
    sign: bar.converted ? "≈" : "~",
    likely,
    total: bar.total,
    over: bar.total != null && likely > bar.total ? likely - bar.total : 0,
    lines,
    perPerson: bar.total != null && people >= 2 && likely > 0 ? { amount: Math.round(likely / people), people } : null,
    note,
  };
}

/**
 * A budget typed in the budget window (D16): "1500", "1.500", "1 500 €", "1,500.50" as a whole amount; null for anything
 * that isn't a positive number.
 */
export function budgetAmount(text: string): number | null {
  const raw = text.replace(/[^\d.,]/g, "");
  if (!/\d/.test(raw)) return null;
  // The last "," or "." followed by one or two digits is the decimal point; any other is a thousands mark.
  const dec = /[.,](\d{1,2})$/.exec(raw);
  const whole = (dec ? raw.slice(0, dec.index) : raw).replace(/[.,]/g, "");
  const n = Number(`${whole || "0"}${dec ? `.${dec[1]}` : ""}`);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// --- the chips under the strip ------------------------------------------------------------------------------------

export type ChipKey = "country" | "weather" | "money" | "plug" | "time" | "lang" | "visa";

export interface FactChip {
  key: ChipKey;
  text: string;
  /** What it says on hover or focus; null: nothing more to say. */
  tip: string | null;
  /** Green (no visa needed, got it), amber (a visa to get, C25). */
  tone?: "ok" | "warn";
  /** "n ülke" (D9): each country's own money, time, plug and visa under the tip, a row each. */
  rows?: CountryRow[];
}

export interface CountryRow {
  code: string;
  name: string;
  /** Its money, its time against the traveller's, its plug, its visa: only what's known. */
  parts: string[];
}

/**
 * D9: a trip of several countries, a row for each in the trip's order: its money, its clock, its plug and its visa
 * ("Schengen vizesi" for each country of the regime). A country nothing is known of has no row; a fact not known has no
 * part.
 */
export function countryRows(list: readonly CountryFacts[], names: readonly string[], visaDone: boolean): CountryRow[] {
  return list.flatMap((c, n): CountryRow[] => {
    const parts: string[] = [];
    if (c.local) {
      parts.push(currencyName(c.local.currency));
      const offset = offsetText(c.local.hours);
      if (offset) parts.push(offset);
      if (c.local.info.plugs.length) parts.push(L(`${c.local.info.plugs.join("/")} priz`, `${c.local.info.plugs.join("/")} plug`));
    }
    if (c.visa?.kind === "visa") parts.push(visaDone ? L(`${c.visa.label} alındı`, `${c.visa.label} got`) : L(`${c.visa.label} gerekiyor`, `${c.visa.label} needed`));
    else if (c.visa?.kind === "arrival") parts.push(visaDone ? L("Vize alındı", "Visa got") : c.visa.label);
    else if (c.visa?.kind === "free") parts.push(c.visa.label);
    else if (c.visa?.kind === "none") parts.push(L("Vize gerekmiyor", "No visa needed"));
    return parts.length ? [{ code: c.country, name: names[n] ?? c.country, parts }] : [];
  });
}

/** "Sende 12:00 iken orada 18:00": the difference as an hour, against the traveller's own clock. */
export function timeTip(hours: number | null): string {
  if (hours == null || !hours) return L("Senin saatinle aynı.", "The same time as yours.");
  const there = (((12 + hours) % 24) + 24) % 24;
  const clock = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
  return L(`Sende ${clock(12)} iken orada ${clock(there)}. Uçuş saatleri yerel saattir.`, `When it's ${clock(12)} for you it's ${clock(there)} there. Flight times are local.`);
}

/**
 * The country (one by name, more as "n ülke", D9), the weather, the money, the plug, the time, the language, the visa
 * (C25: amber while one is to get). Only what's known; a fact with nothing more to say has no tip.
 */
export function factChips(input: {
  facts: TripFacts;
  /** The trip's countries by name, in the order its places come. */
  countries: string[];
  cities: string[];
  weather: { text: string; tip: string } | null;
  /** The traveller's passport country (home's plugs and the visa rules). */
  home: string;
  visaDone: boolean;
  /** With several countries, each one's facts in the same order as `countries` (D9). */
  perCountry?: readonly CountryFacts[];
}): FactChip[] {
  const { facts, countries, cities } = input;
  const out: FactChip[] = [];
  const where = cities.length ? `${cities.join(", ")} · ${L(`${cities.length} şehir`, `${cities.length} ${cities.length === 1 ? "city" : "cities"}`)}` : null;
  if (countries.length === 1) out.push({ key: "country", text: countries[0], tip: where });
  else if (countries.length > 1) {
    const rows = countryRows(input.perCountry ?? [], countries, input.visaDone);
    out.push({ key: "country", text: L(`${countries.length} ülke`, `${countries.length} countries`), tip: [countries.join(", "), where].filter(Boolean).join(" · "), ...(rows.length ? { rows } : {}) });
  }
  if (input.weather) out.push({ key: "weather", text: input.weather.text, tip: input.weather.tip });
  const local = facts.local;
  if (local) {
    out.push({ key: "money", text: currencyName(local.currency), tip: local.rateText });
    if (local.info.plugs.length) {
      const fit = plugFit(input.home, facts.country);
      const own = countryInfo(input.home)?.plugs;
      const homeName = countryNames([input.home])[0];
      const tip = fit ? [plugFitText(fit), own?.length && homeName ? L(`${homeName} ${own.join("/")} kullanıyor`, `${homeName} uses ${own.join("/")}`) : null].filter(Boolean).join(" · ") : null;
      out.push({ key: "plug", text: L(`${local.info.plugs.join("/")} priz`, `${local.info.plugs.join("/")} plug`), tip });
    }
    const offset = offsetText(local.hours);
    if (offset) out.push({ key: "time", text: offset, tip: timeTip(local.hours) });
    out.push({ key: "lang", text: L(local.info.language.tr, local.info.language.en), tip: null });
  }
  const visa = facts.visa;
  if (visa?.kind === "visa")
    out.push(
      input.visaDone
        ? { key: "visa", text: L("Vize alındı", "Visa got"), tip: visa.label, tone: "ok" }
        : { key: "visa", text: L(`${visa.label} gerekiyor`, `${visa.label} needed`), tip: L(`Türk pasaportuyla ${visa.label} gerekir. Nereye başvurulacağı resmî kaynakta.`, `A Turkish passport needs a ${visa.label}. Where to apply is on the official source.`), tone: "warn" },
    );
  else if (visa?.kind === "arrival")
    out.push(
      input.visaDone
        ? { key: "visa", text: L("Vize alındı", "Visa got"), tip: visa.label, tone: "ok" }
        : { key: "visa", text: visa.label, tip: visa.days ? L(`${visa.days} güne kadar · ücretli`, `up to ${visa.days} days · a fee is paid`) : null, tone: "warn" },
    );
  else if (visa?.kind === "free")
    out.push({ key: "visa", text: L("Vize gerekmiyor", "No visa needed"), tip: visa.days ? L(`Türk pasaportuyla ${visa.days} güne kadar vizesiz`, `Visa-free for up to ${visa.days} days on a Turkish passport`) : null, tone: "ok" });
  return out;
}

/**
 * The folded summary's one line (and the thin bar's): "8–14 Ekim · 2 kişi · %61 planda · ~€1.019 / €1.500"; a part not
 * known is left out, a new backbone says how many needs instead of "%0".
 */
export function heroLine({ range, estimated, rough = false, people, counts, budget, short = false }: {
  range: { start: string; end: string } | null;
  estimated: boolean;
  /** The dates are a guess from a month or a season: only the nights are said ("~ · 10 gece"). */
  rough?: boolean;
  people: number;
  counts: HeroCounts;
  budget: BudgetView | null;
  /** The thin bar's: short month, no share and no money (it has its own). */
  short?: boolean;
}): string {
  const dates = range ? datesWords({ range, estimated, rough }, short) : null;
  const who = people > 0 ? nPeople(people) : null;
  if (short) return [dates, who].filter(Boolean).join(" · ");
  const share = counts.total ? (counts.fresh ? freshWords(counts) : shareWords(counts).plan) : null;
  const money = budget ? `${budget.sign}${formatPrice(budget.likely, budget.currency)}${budget.total != null ? ` / ${formatPrice(budget.total, budget.currency)}` : ""}` : null;
  return [dates, who, share, money].filter(Boolean).join(" · ");
}
