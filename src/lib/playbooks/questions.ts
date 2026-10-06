// A playbook's few questions as data (2026-10-07): each has its words, its quick answers (chips) and what each answer
// does to the made trip, said as generic operations (drop a card, move the cards to a city, start N days early,
// split the stay, set the budget, add to the list, mark a card handled). The start chat and startCreate only run
// these operations; they never ask which kind of trip it is. A playbook made by the model later plugs in the same
// way: whatever it gives goes through the validator here, and a malformed question or an unknown operation is
// dropped, never a crash. Pure.
import { L } from "../i18n";
import { normWords } from "../startEvents";
import type { PlannedInput } from "../planned";

/** Words in both languages (one may be missing: the other is used). */
export interface Words {
  tr: string;
  en: string;
}
export const say = (w: Words): string => L(w.tr, w.en);

/**
 * What an answer does to the made trip. Cards are named by their `ref` in the playbook's skeleton ("ticket",
 * "rental"); stays by "stay:event" (the nights at the event's own place) or "stay:first".
 * - dropCard: not opened at all (camping: no stay at the festival; an advanced skier: no ski school).
 * - markHandled: opened as already booked (the ticket bought), never a place to fill.
 * - moveCards: the stays at the destination and the cards there go to `to` ("$value": the answer itself, a resort).
 * - setStartOffsetDays: the trip starts n days before the event (its days after it shrink or grow to fit).
 * - splitStay: the longest stay split into n stays of about equal nights (two resorts).
 * - setBudget: the trip's budget.
 * - addPrep: lines added to the preparation list.
 */
export type PbEffect =
  | { op: "dropCard"; card: string }
  | { op: "markHandled"; card: string }
  | { op: "moveCards"; to: string }
  | { op: "setStartOffsetDays"; n: number }
  | { op: "splitStay"; n: number }
  | { op: "setBudget"; amount: number; currency: string }
  | { op: "addPrep"; items: Words[] };

export interface PbChip {
  /** What the answer is (kept on the start, given to the model as the option's id). */
  value: string;
  label: Words;
  /** Other words that pick it when typed ("kamp yapacağız", "otelde"): plain, Turkish endings allowed after them. */
  aliases?: string[];
  effects: PbEffect[];
}

export interface PbQuestion {
  /** Unique within its playbook. */
  id: string;
  text: Words;
  chips: PbChip[];
  /** Chips by the destination's country (ISO alpha-2): ski resorts in Bulgaria. Used instead of `chips` when there. */
  byCountry?: Record<string, PbChip[]>;
  /** Asked only when the destination is a whole country, or when the event's days are known. */
  askIf?: "countryDestination" | "eventDates";
  /** An amount typed ("5000 euro", "150 bin TL") is an answer too: the trip's budget. */
  money?: boolean;
}

/** What the questions are asked against (from the start chat's state). */
export interface PbAskCtx {
  code: string | null;
  countryDestination: boolean;
  eventDates: boolean;
}

// --- the validator ----------------------------------------------------------------------------------------------

const str = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null);

function validWords(v: unknown): Words | null {
  if (!v || typeof v !== "object") return null;
  const w = v as Record<string, unknown>;
  const tr = str(w.tr);
  const en = str(w.en);
  return tr || en ? { tr: (tr ?? en)!, en: (en ?? tr)! } : null;
}

/** One operation as it is, or null (an unknown one, a missing or silly field). */
export function validEffect(v: unknown): PbEffect | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const n = typeof e.n === "number" && Number.isInteger(e.n) ? e.n : null;
  switch (e.op) {
    case "dropCard":
    case "markHandled": {
      const card = str(e.card, 40);
      return card ? { op: e.op, card } : null;
    }
    case "moveCards": {
      const to = str(e.to, 60);
      return to ? { op: "moveCards", to } : null;
    }
    case "setStartOffsetDays":
      return n != null && n >= 0 && n <= 14 ? { op: "setStartOffsetDays", n } : null;
    case "splitStay":
      return n != null && n >= 2 && n <= 4 ? { op: "splitStay", n } : null;
    case "setBudget": {
      const amount = typeof e.amount === "number" && Number.isFinite(e.amount) && e.amount > 0 && e.amount <= 10_000_000 ? e.amount : null;
      const currency = typeof e.currency === "string" && /^[A-Z]{3}$/.test(e.currency) ? e.currency : null;
      return amount && currency ? { op: "setBudget", amount, currency } : null;
    }
    case "addPrep": {
      const items = Array.isArray(e.items) ? e.items.map(validWords).filter((w): w is Words => !!w).slice(0, 10) : [];
      return items.length ? { op: "addPrep", items } : null;
    }
    default:
      return null;
  }
}

function validChips(v: unknown): PbChip[] {
  if (!Array.isArray(v)) return [];
  const out: PbChip[] = [];
  for (const raw of v.slice(0, 6)) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const value = str(c.value, 60);
    const label = validWords(c.label);
    if (!value || !label || out.some((x) => x.value === value)) continue;
    const aliases = Array.isArray(c.aliases) ? c.aliases.map((a) => str(a, 40)).filter((a): a is string => !!a).slice(0, 12) : [];
    // An answer that does nothing is fine ("Otel": the stay stays as it is); an unknown operation is dropped.
    const effects = Array.isArray(c.effects) ? c.effects.map(validEffect).filter((x): x is PbEffect => !!x) : [];
    out.push({ value, label, ...(aliases.length ? { aliases } : {}), effects });
  }
  return out;
}

/** A question as it is (its chips and their operations checked), or null when it can't be asked. */
export function validQuestion(v: unknown): PbQuestion | null {
  if (!v || typeof v !== "object") return null;
  const q = v as Record<string, unknown>;
  const id = str(q.id, 40);
  const text = validWords(q.text);
  if (!id || !text) return null;
  const chips = validChips(q.chips);
  const byCountry: Record<string, PbChip[]> = {};
  if (q.byCountry && typeof q.byCountry === "object") {
    for (const [code, list] of Object.entries(q.byCountry as Record<string, unknown>)) {
      const ok = validChips(list);
      if (/^[A-Z]{2}$/.test(code) && ok.length) byCountry[code] = ok;
    }
  }
  if (!chips.length && !Object.keys(byCountry).length && q.money !== true) return null;
  const askIf = q.askIf === "countryDestination" || q.askIf === "eventDates" ? q.askIf : undefined;
  // An unknown condition: not asked (never asked where it may not fit).
  if (q.askIf != null && !askIf) return null;
  return { id, text, chips, ...(Object.keys(byCountry).length ? { byCountry } : {}), ...(askIf ? { askIf } : {}), ...(q.money === true ? { money: true } : {}) };
}

/** A playbook's questions checked, at most three, ids unique. */
export function validQuestions(list: unknown): PbQuestion[] {
  const out: PbQuestion[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const q = validQuestion(raw);
    if (q && !out.some((x) => x.id === q.id)) out.push(q);
    if (out.length === 3) break;
  }
  return out;
}

/** The chips a question offers here (the country's own, else its own), or none: then it isn't asked. */
export function chipsFor(q: PbQuestion, ctx: PbAskCtx): PbChip[] | null {
  if (q.askIf === "countryDestination" && !ctx.countryDestination) return null;
  if (q.askIf === "eventDates" && !ctx.eventDates) return null;
  const chips = (ctx.code && q.byCountry?.[ctx.code]) || q.chips;
  return chips.length || q.money ? chips : null;
}

// --- reading a typed answer (the code's shortcut; the model reads the rest) ------------------------------------

/** A word typed matches a chip's word: the same, or with a Turkish ending ("otelde", "kampta", "Bansko'da"). */
const wordMatch = (typed: string, w: string) => typed === w || (/^\p{L}{3,}$/u.test(w) && typed.startsWith(w) && typed.length - w.length <= 6);

function chipMatches(chip: PbChip, words: string[]): boolean {
  const candidates = [chip.label.tr, chip.label.en, chip.value, ...(chip.aliases ?? [])].map((x) => normWords(x)).filter((x) => x.length);
  return candidates.some((cand) => cand.every((w) => words.some((t) => wordMatch(t, w))));
}

/** The one chip a typed answer picks by its words, or null (none, or more than one: the model decides). */
export function matchChip(chips: PbChip[], text: string): PbChip | null {
  const words = normWords(text);
  if (!words.length) return null;
  const hits = chips.filter((c) => chipMatches(c, words));
  return hits.length === 1 ? hits[0] : null;
}

const CURRENCY: [RegExp, string][] = [
  [/^(€|eur|euro|avro)$/u, "EUR"],
  [/^(\$|usd|dolar|dollars?)$/u, "USD"],
  [/^(₺|tl|try|lira)$/u, "TRY"],
  [/^(£|gbp|pounds?|sterlin)$/u, "GBP"],
];
const CUR = "€|euro|eur|avro|\\$|usd|dolar|dollars?|₺|tl|try|lira|£|gbp|pounds?|sterlin";
const MONEY = new RegExp(`(?:(${CUR})\\s*)?(\\d[\\d.,]*)\\s*(k|bin|thousand)?(?![\\p{L}])\\s*(${CUR})?`, "gu");

/** An amount typed next to its money ("5000 euro", "5.000 €", "150 bin TL", "$8k"), or null (no money said: never guessed). */
export function moneyOf(text: string): { amount: number; currency: string } | null {
  for (const m of text.toLocaleLowerCase("tr").matchAll(MONEY)) {
    const cur = m[1] ?? m[4];
    if (!cur) continue;
    const currency = CURRENCY.find(([re]) => re.test(cur))?.[1];
    let amount = Number(m[2].replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."));
    if (!currency || !Number.isFinite(amount) || amount <= 0) continue;
    if (m[3]) amount *= 1000;
    if (amount <= 10_000_000) return { amount: Math.round(amount), currency };
  }
  return null;
}

/**
 * The answer a typed message gives to a question: a chip's value, an amount (a money question), "skip" read by the
 * model as no answer (null), or undefined when nothing came of it. The model's `choice` counts only when it is one
 * of the question's own values (or "skip").
 */
export function readAnswer(q: PbQuestion, chips: PbChip[], text: string, choice?: string | null): string | null | undefined {
  const hit = matchChip(chips, text);
  if (hit) return hit.value;
  if (q.money) {
    const m = moneyOf(text);
    if (m) return `${m.amount} ${m.currency}`;
  }
  const c = choice?.trim();
  if (!c) return undefined;
  if (/^skip$/i.test(c)) return null;
  const picked = chips.find((x) => x.value.toLowerCase() === c.toLowerCase());
  if (picked) return picked.value;
  if (q.money) {
    const m = moneyOf(c);
    if (m) return `${m.amount} ${m.currency}`;
  }
  return undefined;
}

/** What an answer does: its chip's operations ("$value" said as the answer), or an amount typed as the budget. */
export function effectsOf(q: PbQuestion, chips: PbChip[], value: string | null | undefined): PbEffect[] {
  if (value == null) return [];
  const chip = chips.find((c) => c.value === value);
  if (chip) return chip.effects.map((e) => (e.op === "moveCards" && e.to === "$value" ? { ...e, to: chip.value } : e)).filter((e) => !(e.op === "moveCards" && e.to.startsWith("$")));
  const m = q.money ? value.match(/^(\d+) ([A-Z]{3})$/) : null;
  return m ? [{ op: "setBudget", amount: Number(m[1]), currency: m[2] }] : [];
}

/** The options as the model is given them ("camp = Kamp; hotel = Otel"). */
export const optionsText = (chips: PbChip[]): string => chips.map((c) => `${c.value} = ${say(c.label)}`).join("; ");

// --- the operations on the made trip -----------------------------------------------------------------------------

/** A skeleton card with its name for the operations ("ticket"); the name never goes into the plan. */
export type Card = PlannedInput & { ref?: string };

const sameCity = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && normWords(a).join(" ") === normWords(b).join(" ");

const addDay = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const nights = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * The stays as the operations leave them: dropped ("stay:event", "stay:first"; never the last one, the trip keeps a
 * place to stay), moved to a city (those at the destination), the longest split into equal parts (dated only).
 */
export function staysAfter(stays: PlannedInput[], effects: PbEffect[], at: { dest: string; eventPlace: string | null }): PlannedInput[] {
  let out = stays.map((x) => ({ ...x }));
  for (const e of effects) {
    if (e.op === "dropCard" && e.card.startsWith("stay:")) {
      const which = e.card === "stay:event" ? out.filter((x) => sameCity(x.city, at.eventPlace)) : e.card === "stay:first" ? out.slice(0, 1) : [];
      const kept = out.filter((x) => !which.includes(x));
      if (kept.length) out = kept;
    } else if (e.op === "moveCards") {
      out = out.map((x) => (sameCity(x.city, at.dest) ? { ...x, city: e.to } : x));
    } else if (e.op === "splitStay") {
      const dated = out.filter((x) => x.date && x.end_date);
      const longest = dated.sort((a, b) => nights(b.date!, b.end_date!) - nights(a.date!, a.end_date!))[0];
      const total = longest ? nights(longest.date!, longest.end_date!) : 0;
      if (!longest || total < e.n) continue;
      const parts: PlannedInput[] = [];
      let day = longest.date!;
      for (let i = 0; i < e.n; i++) {
        const end = i === e.n - 1 ? longest.end_date! : addDay(day, Math.floor(total / e.n) + (i < total % e.n ? 1 : 0));
        parts.push({ ...longest, date: day, end_date: end });
        day = end;
      }
      const i = out.indexOf(longest);
      out = [...out.slice(0, i), ...parts, ...out.slice(i + 1)];
    }
  }
  return out;
}

/** The skeleton's cards as the operations leave them: dropped, marked booked, moved with the stays. */
export function cardsAfter(cards: Card[], effects: PbEffect[], at: { dest: string }): Card[] {
  let out = cards.map((x) => ({ ...x }));
  for (const e of effects) {
    if (e.op === "dropCard") out = out.filter((x) => x.ref !== e.card);
    else if (e.op === "markHandled") out = out.map((x) => (x.ref === e.card ? { ...x, booked: true } : x));
    else if (e.op === "moveCards") out = out.map((x) => (x.kind !== "transfer" && sameCity(x.city, at.dest) ? { ...x, city: e.to } : x));
  }
  return out;
}

/** The lines the operations add to the preparation list, in the language now. */
export const prepAdded = (effects: PbEffect[]): string[] => effects.flatMap((e) => (e.op === "addPrep" ? e.items.map(say) : []));

/** How many days before the event the trip starts, when an answer said so (the last one wins). */
export const startOffset = (effects: PbEffect[]): number | null => effects.reduce<number | null>((n, e) => (e.op === "setStartOffsetDays" ? e.n : n), null);

/** The budget an answer set, when one did. */
export const budgetSet = (effects: PbEffect[]): { amount: number; currency: string } | null =>
  effects.reduce<{ amount: number; currency: string } | null>((b, e) => (e.op === "setBudget" ? { amount: e.amount, currency: e.currency } : b), null);
