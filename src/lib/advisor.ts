// The start's advisor (omurga Tur 18, Emre 2026-10-31: "ChatGPT'ye sorsam zaten plan yapar"): a planner that thinks the
// trip's spine through once, in the background, from the first message, while the chat goes on. Nobody sees its answer:
// it guides the plan. The traveller's words stay the law (source "user"); the advisor only fills what was assumed, and
// the code judges (startCreate.ts oneWay). A fast model (Claude Haiku with a Claude key, else Gemini Flash-Lite), one
// call, structured output; late or failed: the plan is made as before.
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getSettings } from "./db";
import { L, withLang, type Lang } from "./i18n";
import { anthropicProvider } from "./llm/anthropic";
import { geminiProvider } from "./llm/gemini";
import type { LlmProvider } from "./llm/types";
import { cityKeyOf } from "./plan";
import type { SpecialStay, StartState, WantedActivity } from "./startTrip";

export const ADVISOR_CLAUDE = "claude-haiku-5-5";
export const ADVISOR_GEMINI = "gemini-3.5-flash-lite";
/** The call's own limit (it runs while the chat goes on). */
const CALL_MS = 30_000;

const source = z.enum(["user", "assumed"]);
export const adviceSchema = z.object({
  // Never "thinking": a model reads that as asking for its own reasoning and refuses (Sonnet, 2026-10-31).
  rationale: z.string(),
  stays: z.array(z.object({ place: z.string(), nights: z.number().int(), kind: z.enum(["hotel", "special", "camp", "apartment", "villa", "resort"]), what: z.string().nullable(), source })),
  legs: z.array(z.object({ from: z.string(), to: z.string(), day: z.number().int(), mode: z.enum(["flight", "transfer", "bus", "train", "ferry", "taxi", "car_rental", "bike", "walk"]), source })),
  anchors: z.array(z.object({ what: z.string(), day: z.number().int().nullable(), source })),
  facts: z.array(z.string()),
  question: z.object({ text: z.string(), choices: z.array(z.string()) }),
});
export type Advice = z.infer<typeof adviceSchema>;

export function adviceSystem(): string {
  return L(
    `Sen deneyimli bir seyahat planlayıcısısın. Gezinin OMURGASINI kur: nerede kaç gece, nasıl gidip gelinir, hangi birkaç şey yapılır. Otel, tur, mekân ismi ve fiyat yazma, sadece tür yaz. Kısa yaz.
Kurallar:
1. Kullanıcının söylediği kesindir, değiştirme (source "user"). Senin eklediğin her şey varsayımdır (source "assumed").
2. Gece = yatak. stays gecelerinin toplamı söylenen gece sayısına eşit; her gecenin bir yeri var. Gün 1 = varış günü. place, gezinin duraklarından biri olsun ("Tromsø"); şehir dışındaki özel bir yer için de en yakın durak.
3. Her bacağa tek ulaşım biçimi seç. Araç kiralarsan (car_rental) havalimanı bacaklarını da o karşılar, ayrıca transfer yazma. Yer değiştirilen günlerde bacak yaz.
4. Çapa bütçesi: her 2 geceye en fazla 1, toplam en fazla 3, kullanıcının istekleri dahil. Özel konaklama çapa değildir. Kalan günler boş kalır.
5. rationale: 2-3 cümle gerekçe. facts: yere özgü en fazla 3 kısa bilgi.
6. question: planı en çok netleştirecek tek soru, 2-4 kısa seçenek.`,
    `You are an experienced travel planner. Build the trip's SPINE: where for how many nights, how they get there and around, and the few things they do. No hotel, tour or venue names and no prices: kinds only. Keep it short.
Rules:
1. What the traveller said is fixed, never changed (source "user"). Everything you add is an assumption (source "assumed").
2. A night is a bed. The stays' nights add up to the nights said; every night has a place. Day 1 = the day they arrive. place is one of the trip's stops ("Tromsø"), the nearest stop for a special place outside town.
3. One way per leg. A rental car (car_rental) covers the airport legs too: no transfer besides it. A leg on every day they change places.
4. Anchor budget: at most 1 per 2 nights, 3 in all, the traveller's wishes included. A special stay is not an anchor. The other days stay free.
5. rationale: 2-3 sentences. facts: at most 3 short facts about the place.
6. question: the one question that would shape the plan most, 2-4 short choices.`,
  );
}

export function advicePrompt(text: string, today: string, known: string): string {
  return L(
    `Bugün: ${today}\nBilinenler:\n${known || "yok"}\nKullanıcı: "${text}"`,
    `Today: ${today}\nKnown:\n${known || "nothing"}\nTraveller: "${text}"`,
  );
}

/** The advisor's model: the traveller's own key, the fast model of its kind; null without a key of their own. */
async function advisorModel(): Promise<LlmProvider | null> {
  const s = await getSettings();
  const claude = () => anthropicProvider(new Anthropic({ apiKey: s.apiKey!, dangerouslyAllowBrowser: true }), ADVISOR_CLAUDE);
  if (s.provider !== "gemini" && s.apiKey) return claude();
  if (s.geminiKey) return geminiProvider(new GoogleGenAI({ apiKey: s.geminiKey }), ADVISOR_GEMINI);
  return s.apiKey ? claude() : null;
}

/** The latest advice asked for a start (the draft's id), and what was known when it was asked. */
let pending: { id: string; known: string; answer: Promise<Advice | null> } | null = null;

/**
 * Asks the advisor in the background (never awaited here): from the first message, and again whenever what is known
 * changes on the checklist (the dates, who goes, the route; Emre 2026-10-31: "topladığımız bilgiler danışmana gitmiyor"),
 * the newest ask taking the place of the one before. Nothing asked before the destination is known.
 */
export function adviseStart(a: { id: string; text: string; known: string; today: string; lang: Lang }, model: () => Promise<LlmProvider | null> = advisorModel): void {
  if (!a.known.trim() || (pending?.id === a.id && pending.known === a.known)) return;
  const answer = (async () => {
    try {
      const llm = await model();
      if (!llm) return null;
      const [system, prompt] = withLang(a.lang, () => [adviceSystem(), advicePrompt(a.text, a.today, a.known)]);
      const signal = AbortSignal.timeout(CALL_MS);
      return await llm.generateJson(system, prompt, adviceSchema, [], { signal, maxRetries: 0 });
    } catch (error) {
      console.warn("[start] the advisor", error);
      return null;
    }
  })();
  pending = { id: a.id, known: a.known, answer };
}

/** The advice for this start, waited for `ms` at most (the generating screen's map runs meanwhile); null when none. */
export async function adviceFor(id: string, ms: number): Promise<Advice | null> {
  if (pending?.id !== id) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ms)));
  try {
    return await Promise.race([pending.answer, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** For the tests. */
export const resetAdvice = () => void (pending = null);

const key = (t: string | null | undefined) => (t ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
/** Words too common to tell two things apart ("husky turu", "kuzey ışığı turu"). */
const COMMON = new Set("turu|turlari|gecesi|gezisi|konaklama|tour|night|stay|trip".split("|"));
/** Two phrases about the same thing: one holds the other, or they share a telling word ("cam tavanlı kulübe", "cam tavanlı yer"). */
const sameThing = (a: string, b: string) => {
  const x = key(a), y = key(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const telling = (w: string) => w.length >= 4 && !COMMON.has(w);
  const words = new Set(x.split(" ").filter(telling));
  return y.split(" ").some((w) => telling(w) && words.has(w));
};

/**
 * The advice folded into the start (pure): the stays asked for in words get their place among the city's nights, the
 * traveller's wishes missed by the reading are added, the anchors the advisor chose come within the budget, the question
 * when none was asked, and the ways by day for the judge. Never overrules what the traveller said.
 */
export function applyAdvice(s: StartState, a: Advice | null): StartState {
  if (!a) return s;
  const stops = [...new Set([s.where?.place, ...(s.route?.stops ?? []).map((x) => x.city)].filter((x): x is string => Boolean(x)))];
  const atStop = (place: string, fallback: string | null) => stops.find((x) => cityKeyOf(x) === cityKeyOf(place)) ?? fallback ?? stops[0] ?? place;
  // The stays in order, each at a stop (a place outside town: the stop before it), with the nights before it there.
  const seen = new Map<string, number>();
  let last: string | null = null;
  const placed = a.stays.map((x) => {
    const city = atStop(x.place, last);
    last = city;
    const k = cityKeyOf(city) ?? city;
    const after = seen.get(k) ?? 0;
    seen.set(k, after + x.nights);
    return { ...x, city, after };
  });
  const specials: SpecialStay[] = [...(s.specialStays ?? [])].map((sp) => {
    const at = placed.find((x) => x.kind === "special" && x.what && sameThing(x.what, sp.what) && cityKeyOf(x.city) === cityKeyOf(sp.city));
    return at && sp.after == null ? { ...sp, after: at.after } : sp;
  });
  for (const x of placed) {
    if (x.kind !== "special" || x.source !== "user" || !x.what || specials.some((sp) => sameThing(sp.what, x.what!))) continue;
    specials.push({ city: x.city, nights: x.nights, what: x.what, after: x.after });
  }
  // The anchors: the traveller's always; the advisor's own while the budget lasts (a special stay is no anchor).
  const nights = a.stays.reduce((n, x) => n + x.nights, 0);
  const budget = Math.min(3, Math.max(1, Math.floor(nights / 2)));
  const wanted: WantedActivity[] = [...(s.wanted ?? [])];
  const fresh = a.anchors.filter((x) => !wanted.some((w) => sameThing(w.what, x.what)) && !specials.some((sp) => sameThing(sp.what, x.what)));
  for (const x of [...fresh.filter((x) => x.source === "user"), ...fresh.filter((x) => x.source !== "user")]) {
    if (x.source !== "user" && wanted.length >= budget) continue;
    wanted.push({ city: stops[0] ?? null, what: x.what, day: null });
  }
  const q = a.question.text.trim();
  const asks = !s.spineQuestion && q.endsWith("?") && q.split("?").length === 2 && q.length <= 120;
  const choices = a.question.choices.map((c) => c.trim()).filter((c) => c && c.length <= 30).slice(0, 4);
  return {
    ...s,
    specialStays: specials,
    wanted,
    ...(asks ? { spineQuestion: q, spineChoices: choices.length >= 2 ? choices : [] } : {}),
    advice: { legs: a.legs.map((l) => ({ day: l.day, mode: l.mode })), rationale: a.rationale, facts: a.facts.slice(0, 3) },
  };
}
