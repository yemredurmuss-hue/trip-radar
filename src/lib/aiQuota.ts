// When the free Gemini requests come back, and which model is answering meanwhile (F33, F34; T1 "Kota dolunca", 2026-10-20).
// Google: "Requests per day (RPD) quotas reset at midnight Pacific time" (ai.google.dev/gemini-api/docs/rate-limits, read
// 2026-10-20; limits are per project, per model). The traveller reads that moment on their own clock, plainly: "Kota yarın
// 10:00'da yenilenir", never "biraz bekle" when it is 20 hours away.
// The model chain (llm/gemini.ts onModels) and the Claude backup (llm/index.ts) note here when something other than the chosen
// model answered; the last such switch sits in chrome.storage.local ("aiSwitch") for the line where saves land (arrive/QuotaLine.tsx).
import { getSettings } from "./db";
import { L, locale } from "./i18n";

/** Where Google's day turns: midnight here is when every model's daily free requests come back. */
export const QUOTA_ZONE = "America/Los_Angeles";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zoneParts(at: number, timeZone?: string): Parts {
  const p: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  for (const part of fmt.formatToParts(at)) p[part.type] = part.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour % 24, minute: +p.minute, second: +p.second };
}

/** The zone's offset from UTC at that moment, in ms (its wall clock read as UTC, minus the moment). */
function offsetAt(at: number, timeZone: string): number {
  const p = zoneParts(at, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (at - (((at % 1000) + 1000) % 1000));
}

/**
 * The next midnight in Pacific time after `now` (epoch ms). DST-safe: the offset is asked of Intl for that very midnight, so
 * a 23- or 25-hour Pacific day (March, November) lands on the right hour. US clocks change at 02:00, never at midnight.
 */
export function nextQuotaReset(now: number = Date.now()): number {
  const p = zoneParts(now, QUOTA_ZONE);
  const midnight = Date.UTC(p.year, p.month - 1, p.day + 1); // tomorrow 00:00 on the Pacific wall clock, read as UTC
  const guess = midnight - offsetAt(now, QUOTA_ZONE);
  return midnight - offsetAt(guess, QUOTA_ZONE);
}

// Turkish says the time aloud and takes the locative from its last word: 10:00 "onda", 13:00 "on üçte", 11:00 "on birde",
// 10:30 "on otuzda", 12:45 "on iki kırk beşte". sıfır bir iki üç dört beş altı yedi sekiz dokuz; on yirmi otuz kırk elli.
const UNITS = ["da", "de", "de", "te", "te", "te", "da", "de", "de", "da"];
const TENS = ["da", "da", "de", "da", "ta", "de"];
const lastWord = (n: number) => (n % 10 ? UNITS[n % 10] : n === 0 ? UNITS[0] : TENS[n / 10]);
/** "10:00" → "10:00'da", "13:00" → "13:00'te", "11:30" → "11:30'da". */
export function trAt(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${time}'${lastWord(m ? m : h)}`;
}

const dayNumber = (p: Parts) => Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;

/**
 * When the free requests come back, on this device's clock (or `timeZone`'s, for the tests): "yarın 10:00'da" / "tomorrow at
 * 10:00", "bugün 10:00'da" / "today at 10:00". More than a day away (a 25-hour Pacific day seen from far east): its date.
 */
export function resetWhen(now: number = Date.now(), timeZone?: string): string {
  const reset = nextQuotaReset(now);
  const at = zoneParts(reset, timeZone);
  const time = `${String(at.hour).padStart(2, "0")}:${String(at.minute).padStart(2, "0")}`;
  const days = dayNumber(at) - dayNumber(zoneParts(now, timeZone));
  if (days <= 0) return L(`bugün ${trAt(time)}`, `today at ${time}`);
  if (days === 1) return L(`yarın ${trAt(time)}`, `tomorrow at ${time}`);
  const date = new Intl.DateTimeFormat(locale(), { timeZone, day: "numeric", month: "long" }).format(reset);
  return L(`${date} ${trAt(time)}`, `on ${date} at ${time}`);
}

/** "Kota yarın 10:00'da yenilenir" / "Quota resets tomorrow at 10:00": the T1 line's right side. */
export const quotaResetLine = (now: number = Date.now(), timeZone?: string): string => {
  const when = resetWhen(now, timeZone);
  return L(`Kota ${when} yenilenir`, `Quota resets ${when}`);
};

/** "gemini-3.5-flash-lite" → "Gemini 3.5 Flash-Lite". */
export function modelName(model: string): string {
  const words = model.replace(/^models\//, "").split("-").filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    const word = /^\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1);
    if (word === "Lite" && out.length) out[out.length - 1] += `-${word}`;
    else out.push(word);
  }
  return out.join(" ");
}

/** The Turkish "with" by how the name ends aloud: "Gemini 3.8 Flash'la", "Gemini 3.5 Flash-Lite'la" ("layt"), "Gemini 3 Pro'yla". */
export function trWith(name: string): string {
  const last = name.split(/[\s-]/).at(-1)?.toLowerCase() ?? "";
  const said = last === "lite" ? "layt" : last;
  const back = /[aıou][^aeıioöuü]*$/.test(said) || !/[aeıioöuü]/.test(said);
  const vowelEnd = /[aeıioöuü]$/.test(said);
  return `${name}'${vowelEnd ? "y" : ""}${back ? "la" : "le"}`;
}

// --- the last switch, for the line where saves land -------------------------------------------------------------------

/** Who answered instead of the chosen Gemini model: another flash model, Claude, or nobody (every model spent, no Claude key). */
export type AiSwitchBy = "gemini-fallback" | "claude" | "none";
export interface AiSwitch {
  /** The model that answered ("gemini-3.8-flash", a Claude model); the chosen one for "none". */
  model: string;
  by: AiSwitchBy;
  at: number;
  /** When Gemini's free requests come back (nextQuotaReset): the line is gone from then on. */
  resetAt: number;
  /** Closed with × (the line stays closed for this switch; a new kind of switch shows again). */
  dismissed?: boolean;
}

export const AI_SWITCH_KEY = "aiSwitch";

/** The storage it is kept in: chrome.storage.local, or none (the tests, a page without the extension). */
export interface SwitchStore {
  get(): Promise<AiSwitch | null>;
  set(value: AiSwitch): Promise<void>;
  hasClaudeKey(): Promise<boolean>;
}

const chromeStore: SwitchStore = {
  async get() {
    const v = (await chrome.storage.local.get(AI_SWITCH_KEY))[AI_SWITCH_KEY];
    return isSwitch(v) ? v : null;
  },
  set: (value) => chrome.storage.local.set({ [AI_SWITCH_KEY]: value }),
  hasClaudeKey: async () => Boolean((await getSettings()).apiKey),
};

let store: SwitchStore | null = null;
const currentStore = (): SwitchStore | null => store ?? (typeof chrome !== "undefined" && chrome.storage?.local ? chromeStore : null);
/** For the tests: an in-memory store (null: back to chrome.storage, or none). */
export function setSwitchStore(next: SwitchStore | null): void {
  store = next;
  last = null;
}

export const isSwitch = (v: unknown): v is AiSwitch =>
  !!v && typeof v === "object" && typeof (v as AiSwitch).model === "string" && ["gemini-fallback", "claude", "none"].includes((v as AiSwitch).by) && typeof (v as AiSwitch).resetAt === "number";

/** Shown now: not closed, and its day not over. */
export const switchShown = (s: AiSwitch | null, now: number = Date.now()): s is AiSwitch => !!s && !s.dismissed && s.resetAt > now;

/** This page's (or worker's) last word, so a call answered the same way as the one before writes nothing. */
let last: AiSwitch | null = null;
const same = (a: AiSwitch | null, b: AiSwitch) => !!a && a.by === b.by && a.model === b.model && a.resetAt > b.at;

async function note(next: AiSwitch): Promise<void> {
  const s = currentStore();
  if (!s || same(last, next)) return;
  // The stored one may be another page's, or closed with ×: the same switch, still today's, stays as it is; the next fallback
  // model of the same day keeps its reset time and its ×.
  const stored = await s.get();
  if (same(stored, next)) {
    last = stored;
    return;
  }
  if (stored && stored.by === next.by && stored.resetAt > next.at) next = { ...next, resetAt: stored.resetAt, ...(stored.dismissed ? { dismissed: true } : {}) };
  if (next.by === "none" && (await s.hasClaudeKey())) return; // Claude takes over at once and says so itself
  last = next;
  await s.set(next);
}

const quietly = (p: Promise<void>) => void p.catch(() => undefined);

/**
 * A fallback flash model answered because the chosen one's day is used up (llm/gemini.ts onModels). `spentAt`: when the chosen
 * model was found spent; its requests come back at the first Pacific midnight after that. Already back (the chain still skips
 * the model for its own hours): nothing to say.
 */
export function noteGeminiFallback(model: string, spentAt: number, now: number = Date.now()): void {
  const resetAt = nextQuotaReset(spentAt);
  if (resetAt <= now) return;
  quietly(note({ model, by: "gemini-fallback", at: now, resetAt }));
}

/** Claude took over: every Gemini model's free requests for today are used up (llm/index.ts). */
export function noteClaudeTakeover(model: string, now: number = Date.now()): void {
  quietly(note({ model, by: "claude", at: now, resetAt: nextQuotaReset(now) }));
}

/** Every Gemini model is spent and nothing goes on (no Claude key): the line turns red (llm/gemini.ts onModels). */
export function noteGeminiSpent(model: string, now: number = Date.now()): void {
  quietly(note({ model, by: "none", at: now, resetAt: nextQuotaReset(now) }));
}

/** The switch as stored now (null: none, or no storage here). */
export async function loadSwitch(): Promise<AiSwitch | null> {
  return (await currentStore()?.get().catch(() => null)) ?? null;
}

/** × on the line: closed for this switch (a new kind of switch shows again). */
export async function dismissSwitch(): Promise<void> {
  const s = currentStore();
  const stored = await s?.get();
  if (!s || !stored) return;
  last = { ...stored, dismissed: true };
  await s.set(last);
}

/** The T1 line's words for a switch: the pill, what changed, and the right side ("Kota yarın 10:00'da yenilenir"). */
export function switchText(s: AiSwitch, now: number = Date.now(), timeZone?: string): { pill: string; text: string; reset: string | null; addKey: boolean; tone: "warn" | "bad" } {
  if (s.by === "gemini-fallback") {
    const name = modelName(s.model);
    return {
      pill: L("Model değişti", "Model changed"),
      text: L(`Ücretsiz kotan dolduğu için ${trWith(name)} devam ediyorum`, `Your free quota ran out, so I'm going on with ${name}`),
      reset: quotaResetLine(now, timeZone),
      addKey: false,
      tone: "warn",
    };
  }
  if (s.by === "claude") {
    return {
      pill: L("Model değişti", "Model changed"),
      text: L("Gemini'nin bugünkü hakkı doldu, Claude'la devam ediyorum", "Gemini's requests for today are used up, I'm going on with Claude"),
      reset: null,
      addKey: false,
      tone: "warn",
    };
  }
  return {
    pill: L("Kota doldu", "Quota used up"),
    text: L("Gemini'nin bugünkü hakkı doldu", "Gemini's requests for today are used up"),
    reset: quotaResetLine(now, timeZone),
    addKey: true,
    tone: "bad",
  };
}
