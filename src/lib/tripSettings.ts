// The trip settings the chat can change (0.37): the money the board shows the trip in, and who goes. Pure, so
// what "bütçeyi euro göster" or "Sabine de geliyor" does is tested without a model. The chat's tools (assistant.ts)
// and the hero's travellers popover write through these; the undo keeps the fields' values from before.
import { convert, type Rates } from "./currency";
import { currencyCode, formatPrice } from "./items";
import { L } from "./i18n";
import type { Item, Travellers, Trip } from "./types";

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

/**
 * Who goes as "nobody named": `{ names: [] }`, never a missing field. A shared trip sends a missing field as
 * null, which a board keeps its names over (the older-board guard in share/settings.applySettings), so taking
 * Sabine back out would bring her back on the other computer.
 */
const NOBODY = { names: [] as string[] };

/** The trip with these fields as they were (a field that wasn't there goes again; who goes: nobody named). */
export function restoreFields(trip: Trip, { fields, before }: TripFieldsBefore): Trip {
  const next = { ...trip } as Record<string, unknown>;
  for (const f of fields) {
    const value = (before as Record<string, unknown>)[f];
    if (f === "travellers") next[f] = value ?? NOBODY;
    else if (value === undefined) delete next[f];
    else next[f] = value;
  }
  return next as unknown as Trip;
}

export const fieldsBefore = (trip: Trip, fields: (keyof Trip)[]): TripFieldsBefore => ({
  fields,
  before: Object.fromEntries(fields.map((f) => [f, f === "travellers" ? (trip.travellers ?? NOBODY) : trip[f]])) as Partial<Trip>,
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
    // Always from the budget as the traveller said it (its first money): TRY → EUR → TRY gives the same lira back,
    // never a figure rounded twice. Back in that money, the budget is exactly what was said.
    const said = budget.source ?? { amount: budget.amount, currency: budget.currency, ...(budget.ceiling != null ? { ceiling: budget.ceiling } : {}) };
    if (said.currency === to) {
      nextBudget = { amount: said.amount, currency: to, ...(said.ceiling != null ? { ceiling: said.ceiling } : {}) };
    } else {
      const amount = convert(said.amount, said.currency, to, rates);
      const ceiling = said.ceiling != null ? convert(said.ceiling, said.currency, to, rates) : null;
      if (amount == null || (said.ceiling != null && ceiling == null)) {
        return L(`${said.currency} → ${to} kuru yok; bütçeyi yanlış bir tutarla yazmamak için hiçbir şey değişmedi.`, `No ${said.currency} → ${to} rate; nothing changed rather than writing the budget with a wrong amount.`);
      }
      nextBudget = { amount: Math.round(amount), currency: to, ...(ceiling != null ? { ceiling: Math.round(ceiling) } : {}), source: said };
    }
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
  /**
   * Who comes from somewhere else (kişiye özel rezervasyon): the name and the place ("Sabine", "Alicante"); an
   * empty place takes it off (they leave from where the trip does). A name not on the trip is added, never me.
   */
  from?: { name: unknown; place: unknown }[];
  /** A name written another way ("Sabina" → "Sabine"): the place they come from goes along (their plans: ownersAfter). */
  rename?: { from: unknown; to: unknown }[];
  /** My name (the profile's): never added to the names, though it may have a place. */
  me?: string | null;
}

/** "Me" said instead of a name ("ben", "me"). */
export const ME_WORD = /^(ben|me|i|myself|benim|kendim)$/i;

const cleanPlace = (place: unknown) => (typeof place === "string" ? place.replace(/\s+/g, " ").trim().slice(0, 60) : "");

/** The key `from` holds a name under: the spelling on the trip, else the one given. */
const keyIn = (map: Record<string, string>, name: string) => Object.keys(map).find((k) => sameName(k, name)) ?? null;

/** The names and count after a change; `missing` = names asked to go that weren't there. A bad count: the reason. */
export function withTravellers(current: Travellers | undefined, change: TravellersChange): { travellers: Travellers; missing: string[] } | string {
  const count = change.count;
  if (count != null && count !== 0 && (!Number.isInteger(count) || count < 1 || count > MAX_COUNT)) {
    return L(`Kişi sayısı 1 ile ${MAX_COUNT} arasında tam sayı olmalı: ${count}`, `The number of people must be a whole number from 1 to ${MAX_COUNT}: ${count}`);
  }
  const remove = (change.remove ?? []).map(clean).filter(Boolean);
  const renames = (change.rename ?? []).map((r) => [clean(r?.from), clean(r?.to)] as const).filter(([a, b]) => a && b && a !== b);
  const before = current?.names ?? [];
  const missing = remove.filter((r) => !before.some((n) => sameName(n, r)));
  const kept = before
    .filter((n) => !remove.some((r) => sameName(n, r)))
    .map((n) => renames.find(([a]) => sameName(n, a))?.[1] ?? n);
  // "Ben İzmir'den geliyorum": me by my name; with no name yet, nothing (never a traveller called "Ben").
  const places = (change.from ?? [])
    .map((f) => [clean(f?.name), cleanPlace(f?.place)] as const)
    .map(([n, p]) => [ME_WORD.test(n) ? (clean(change.me) || "") : n, p] as const)
    .filter(([n]) => n);
  // Someone said to come from somewhere is going (Sabine Alicante'den geliyor), unless it's me.
  const comers = places.filter(([n, p]) => p && !sameName(n, change.me)).map(([n]) => n);
  const names = uniqueNames([...kept, ...(change.add ?? []).map(clean).filter((n) => !ME_WORD.test(n)), ...comers]).slice(0, MAX_NAMES);
  const nextCount = count === 0 || count === undefined ? (current?.count ?? null) : count;
  // Where each comes from: a name taken off leaves it, a name changed takes it along, then what was said now.
  const from: Record<string, string> = {};
  for (const [name, place] of Object.entries(current?.from ?? {})) {
    if (remove.some((r) => sameName(name, r))) continue;
    const renamed = renames.find(([a]) => sameName(name, a))?.[1] ?? name;
    from[names.find((n) => sameName(n, renamed)) ?? renamed] = place;
  }
  for (const [name, place] of places) {
    const key = keyIn(from, name) ?? names.find((n) => sameName(n, name)) ?? name;
    if (place) from[key] = place;
    else delete from[key];
  }
  return { travellers: { names, ...(nextCount != null ? { count: nextCount } : {}), ...(Object.keys(from).length ? { from } : {}) }, missing };
}

/** Where this person comes from, when it isn't where the trip leaves from (null: with the trip). */
export function fromOf(travellers: Travellers | undefined, name: string | null | undefined): string | null {
  if (!name || !travellers?.from) return null;
  const key = keyIn(travellers.from, name);
  return key ? travellers.from[key] : null;
}

/**
 * The plans whose owners a change of names touches (kişiye özel rezervasyon): a name changed is changed on them,
 * a name taken off leaves them, and a plan left with nobody is everyone's again (`after` null). Pure.
 */
export function ownersAfter(
  items: Item[],
  change: { removed?: string[]; renamed?: (readonly [string, string])[] },
): { item: Item; before: string[]; after: string[] | null }[] {
  const out: { item: Item; before: string[]; after: string[] | null }[] = [];
  for (const item of items) {
    const before = item.forWho ?? [];
    if (!before.length) continue;
    const next = uniqueNames(
      before
        .filter((n) => !(change.removed ?? []).some((r) => sameName(n, r)))
        .map((n) => change.renamed?.find(([a]) => sameName(n, a))?.[1] ?? n),
    );
    if (next.length === before.length && next.every((n, i) => n === before[i])) continue;
    out.push({ item, before, after: next.length ? next : null });
  }
  return out;
}

/** The names a change took off (as they were written) and changed (old → new), from the names before and after. */
export function namesChanged(before: Travellers | undefined, change: TravellersChange): { removed: string[]; renamed: [string, string][] } {
  const names = before?.names ?? [];
  const removed = names.filter((n) => (change.remove ?? []).some((r) => sameName(n, clean(r))));
  const renamed = (change.rename ?? [])
    .map((r) => [clean(r?.from), clean(r?.to)] as [string, string])
    .filter(([a, b]) => a && b && !sameName(a, b) && names.some((n) => sameName(n, a)));
  return { removed, renamed };
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
