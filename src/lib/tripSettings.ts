// The trip settings the chat can change (0.37): the money the board shows the trip in, and who goes. Pure, so
// what "bütçeyi euro göster" or "Sabine de geliyor" does is tested without a model. The chat's tools (assistant.ts)
// and the hero's travellers popover write through these; the undo keeps the fields' values from before.
import { convert, type Rates } from "./currency";
import { currencyCode, formatPrice } from "./items";
import { L } from "./i18n";
import type { Travellers, Trip } from "./types";

/** "euro", "avro", "dolar", "TL" said in words, else an ISO code ("eur", "€" via currencyCode). */
const CURRENCY_WORDS: Record<string, string> = {
  euro: "EUR", euros: "EUR", avro: "EUR", öro: "EUR",
  dolar: "USD", dollar: "USD", dollars: "USD", "amerikan doları": "USD", "us dollar": "USD",
  lira: "TRY", tl: "TRY", "türk lirası": "TRY", "turkish lira": "TRY",
  sterlin: "GBP", pound: "GBP", pounds: "GBP", "pound sterling": "GBP",
  frank: "CHF", "isviçre frangı": "CHF", "swiss franc": "CHF",
};

export function currencyOf(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const word = raw.trim().toLocaleLowerCase("tr-TR");
  return CURRENCY_WORDS[word] ?? CURRENCY_WORDS[raw.trim().toLowerCase()] ?? currencyCode(raw);
}

/** The fields a settings change touched and what they held before: the undo puts exactly these back. */
export interface TripFieldsBefore {
  fields: (keyof Trip)[];
  before: Partial<Trip>;
}

/** The trip with these fields as they were (a field that wasn't there goes again). */
export function restoreFields(trip: Trip, { fields, before }: TripFieldsBefore): Trip {
  const next = { ...trip } as Record<string, unknown>;
  for (const f of fields) {
    const value = (before as Record<string, unknown>)[f];
    if (value === undefined) delete next[f];
    else next[f] = value;
  }
  return next as unknown as Trip;
}

export const fieldsBefore = (trip: Trip, fields: (keyof Trip)[]): TripFieldsBefore => ({
  fields,
  before: Object.fromEntries(fields.map((f) => [f, trip[f]])) as Partial<Trip>,
});

export interface CurrencyChange {
  trip: Trip;
  from: string;
  to: string;
  /** The budget before and after, in words ("₺81.755 → €1.640"), when there is one. */
  budget: { before: string; after: string } | null;
}

/**
 * The trip shown in another money: the budget (target and ceiling) converted with the day's rates, so every price
 * on the board compares in it. `from` is the money shown now (DecisionContext.currency). Without the rates for both
 * it refuses (the reason, never a wrong amount); the same money again changes nothing (null).
 */
export function withCurrency(trip: Trip, rawTo: unknown, from: string, rates: Rates | null): CurrencyChange | null | string {
  const to = currencyOf(rawTo);
  if (!to) return L(`Bunu bir para birimi olarak tanımadım: ${String(rawTo)}. Hiçbir şey değişmedi.`, `I don't know that as a currency: ${String(rawTo)}. Nothing changed.`);
  const budget = trip.budget;
  if (to === from && (!budget || budget.currency === to) && (trip.currency ?? to) === to) return null;
  if (to !== from || (budget && budget.currency !== to)) {
    if (!rates) return L("Kur bilgisi yok (bağlantı yok ya da kurlar okunamadı); sonra tekrar dene. Hiçbir şey değişmedi.", "No exchange rates right now (offline, or they couldn't be read); try again later. Nothing changed.");
    if (!rates.rates[to]) return L(`${to} için kur bilgisi yok; hiçbir şey değişmedi.`, `There's no exchange rate for ${to}; nothing changed.`);
    if (!rates.rates[from]) return L(`${from} için kur bilgisi yok; hiçbir şey değişmedi.`, `There's no exchange rate for ${from}; nothing changed.`);
  }
  let nextBudget = budget;
  let words: CurrencyChange["budget"] = null;
  if (budget) {
    const amount = convert(budget.amount, budget.currency, to, rates);
    const ceiling = budget.ceiling != null ? convert(budget.ceiling, budget.currency, to, rates) : null;
    if (amount == null || (budget.ceiling != null && ceiling == null)) {
      return L(`${budget.currency} → ${to} kuru yok; bütçeyi yanlış bir tutarla yazmamak için hiçbir şey değişmedi.`, `No ${budget.currency} → ${to} rate; nothing changed rather than writing the budget with a wrong amount.`);
    }
    nextBudget = { amount: Math.round(amount), currency: to, ...(ceiling != null ? { ceiling: Math.round(ceiling) } : {}) };
    words = { before: formatPrice(budget.amount, budget.currency), after: formatPrice(nextBudget.amount, to) };
  }
  return { trip: { ...trip, currency: to, budget: nextBudget }, from, to, budget: words };
}

// --- who goes ---------------------------------------------------------------------------------------

const MAX_NAMES = 20;
const MAX_COUNT = 50;
// Case aside in any language: a Turkish lower case would make "SABINE" "sabıne"; I, İ, ı and i are one letter here.
const keyOf = (name: string) => name.trim().toLowerCase().replace(/̇/g, "").replace(/ı/g, "i");
const clean = (name: unknown) => (typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, 40) : "");

/** Each name once, whatever its case or spaces ("emre" and "Emre "), the first spelling kept. */
export function uniqueNames(names: (string | null | undefined)[]): string[] {
  const seen = new Map<string, string>();
  for (const n of names) {
    const name = clean(n);
    if (name && !seen.has(keyOf(name))) seen.set(keyOf(name), name);
  }
  return [...seen.values()];
}

export const sameName = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && keyOf(a) === keyOf(b));

export interface TravellersChange {
  add?: unknown[];
  remove?: unknown[];
  /** How many go; 0 or undefined leaves it, null clears it (as many as the names, or the saves). */
  count?: number | null;
}

/** The names and count after a change; `missing` = names asked to go that weren't there. A bad count: the reason. */
export function withTravellers(current: Travellers | undefined, change: TravellersChange): { travellers: Travellers; missing: string[] } | string {
  const count = change.count;
  if (count != null && count !== 0 && (!Number.isInteger(count) || count < 1 || count > MAX_COUNT)) {
    return L(`Kişi sayısı 1 ile ${MAX_COUNT} arasında tam sayı olmalı: ${count}`, `The number of people must be a whole number from 1 to ${MAX_COUNT}: ${count}`);
  }
  const remove = (change.remove ?? []).map(clean).filter(Boolean);
  const before = current?.names ?? [];
  const missing = remove.filter((r) => !before.some((n) => sameName(n, r)));
  const kept = before.filter((n) => !remove.some((r) => sameName(n, r)));
  const names = uniqueNames([...kept, ...(change.add ?? []).map(clean)]).slice(0, MAX_NAMES);
  const nextCount = count === 0 || count === undefined ? (current?.count ?? null) : count;
  return { travellers: { names, ...(nextCount != null ? { count: nextCount } : {}) }, missing };
}

export interface Who {
  /** Everyone known by name, me first (when anyone is named). */
  names: string[];
  /** How many go: never fewer than the names. */
  count: number;
  /** My name as it shows ("Emre"), or null: "Ben". */
  me: string | null;
}

/**
 * Who goes, as the hero and the budget see it: the names typed or said (trip.travellers), the shared trip's people
 * and me, each once; how many: the count said, else the saves' adults, never fewer than the names.
 */
export function whoGoes(opts: { travellers?: Travellers; me?: string | null; members?: string[]; shared?: boolean; adults?: number | null }): Who {
  const me = clean(opts.me) || null;
  const said = opts.travellers?.names ?? [];
  const named = opts.shared || said.length > 0;
  const names = named ? uniqueNames([opts.shared ? me : (me ?? L("Ben", "Me")), ...(opts.members ?? []), ...said]) : [];
  const count = Math.max(names.length, opts.travellers?.count ?? opts.adults ?? 0);
  return { names, count, me };
}
