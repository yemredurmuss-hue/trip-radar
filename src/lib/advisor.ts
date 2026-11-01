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
import { acceptRoute, asksDecided, circuitRoute, countriesNamed, maxStops, totalNights, QUESTION_TOPICS, type SpecialStay, type StartRoute, type StartState, type WantedActivity } from "./startTrip";

// (Sonnet, not Haiku, Tur 22: the spine is drawn here once a trip, the route too; Haiku flew a backpacker between every
// stop and zigzagged Bangkok → Siem Reap → Luang Prabang → Chiang Mai → Krabi)
export const ADVISOR_CLAUDE = "claude-sonnet-5-5";
export const ADVISOR_GEMINI = "gemini-3.5-flash-lite";
/** The call's own limit (it runs while the chat goes on). */
const CALL_MS = 60_000;

const source = z.enum(["user", "assumed"]);
/** The ways a leg can go (Tur 22: a night train, a night bus, a boat, the slow boat down the Mekong). */
export const LEG_MODES = ["flight", "transfer", "bus", "night_bus", "train", "night_train", "ferry", "boat", "taxi", "car_rental", "moto_rental", "bike_rental", "walk"] as const;
export const adviceSchema = z.object({
  // Never "thinking": a model reads that as asking for its own reasoning and refuses (Sonnet, 2026-10-31).
  rationale: z.string(),
  stays: z.array(z.object({ place: z.string(), country_code: z.string(), nights: z.number().int(), kind: z.enum(["hotel", "special", "camp", "apartment", "villa", "resort"]), what: z.string().nullable(), source })),
  legs: z.array(z.object({ from: z.string(), to: z.string(), day: z.number().int(), mode: z.enum(LEG_MODES), note: z.string(), source })),
  arrival_airport_city: z.string(),
  departure_airport_city: z.string(),
  anchors: z.array(z.object({ what: z.string(), day: z.number().int().nullable(), source })),
  facts: z.array(z.string()),
  wishes: z.array(z.object({ place: z.string().nullable(), about: z.enum(["stay", "food", "activity", "transport", "general"]), text: z.string() })),
  question: z.object({ text: z.string(), topic: z.enum(QUESTION_TOPICS), choices: z.array(z.string()) }),
});
export type Advice = z.infer<typeof adviceSchema>;

export function adviceSystem(): string {
  return L(
    `Sen deneyimli bir seyahat planlayıcısısın. Gezinin OMURGASINI kur: nerede kaç gece, nasıl gidip gelinir, hangi birkaç şey yapılır. Otel, tur, mekân ismi ve fiyat yazma, sadece tür yaz. Kısa yaz.
Kurallar:
1. Kullanıcının söylediği kesindir, değiştirme (source "user"). Senin eklediğin her şey varsayımdır (source "assumed").
2. Gece = yatak. stays gecelerinin toplamı söylenen gece sayısına eşit; her gecenin bir yeri var. Gün 1 = varış günü. place, gezinin duraklarından biri olsun ("Tromsø"); şehir dışındaki özel bir yer için de en yakın durak. country_code: durağın ISO 3166-1 alpha-2 kodu.
3. Her bacağa tek ulaşım biçimi seç. Araç kiralarsan (car_rental) havalimanı bacaklarını da o karşılar, ayrıca transfer yazma. Yer değiştirilen günlerde bacak yaz.
4. Çapa bütçesi: her 2 geceye en fazla 1, toplam en fazla 3, kullanıcının istekleri dahil. Özel konaklama çapa değildir. Kalan günler boş kalır.
5. rationale: 2-3 cümle gerekçe. facts: yere özgü en fazla 3 kısa bilgi.
6. question: (topic: sorunun konusu) gezinin en büyük kartını (gezinin sebebi olan deneyim, ana konaklama, uçuş) şekillendiren ve kullanıcının niyetini netleştiren tek soru, 2-4 kısa seçenek. Senin karar verdiğin şeyi (gece bölüşü, özel gecenin yeri, ulaşım) sorma; o kararları gerekçende söyle.
7. wishes: kullanıcının KENDİ sözlerinde geçen istekler, yeriyle ve türüyle ("Ubud'da ormana bakan bir yer" → place "Ubud", about "stay", text "ormana bakan"). Kısa, kullanıcının kelimeleriyle; senin önerin buraya girmez. Yoksa boş liste.
8. Kiralama (araç, motosiklet, bisiklet) bir durak içindir: duraklar uzaksa aralarını transferle bağla, kiralamayı her durağın kendi günlerine yaz. Gezinin türüne uymuyorsa (balayı, yaşlı aile, ilk kez giden) kiralama koyma.
9. Rota (Bilinenler'de onaylı bir rota yoksa durakları sen çizersin): gezilecek sırayla, haritada bir çizgi ya da halka, zikzak yok. Kullanıcının saydığı her ülke ve yer rotada; durak, kullanıcının istediği konaklamanın olduğu yerdir (su üstü villa: resort atolü, başkent ya da yerel ada değil). Ortalama 3 gecede bir durak; uzun bir gezide (2 hafta ve üstü, birkaç ülke) bölgenin bilinen güzergâhını izle, durakları azaltmak için geceleri bir yere yığma. Bir durağa gezinin yarısından fazlası verilmez (kullanıcı istemediyse); geceler orada görülecek şeyle orantılı. Yolda geçen gece (ör. yavaş teknede Pakbeng) 1 gecelik bir durak olur. Bir şehir rotada bir kez geçer: dönüş için ilk şehre geri dönülecekse ona gece verme, departure_airport_city yaz. arrival_airport_city / departure_airport_city: ilk uçuşun indiği, dönüşün kalktığı havalimanlı şehir.
10. Duraklar arası yol, gezinin tarzına ve bölgenin bilinen yoluna uyar: sırt çantası ya da ekonomik gezide kara ve su yolu (gece treni, gece otobüsü, tekne, sınır geçişi); uçak yalnız kara yolu bir günden uzunsa ya da tarz rahatsa. note: yolun kısa adı ve süresi ("Huay Xai sınırından 2 günlük yavaş tekne", "gece treni, 12 saat"); yoksa "".`,
    `You are an experienced travel planner. Build the trip's SPINE: where for how many nights, how they get there and around, and the few things they do. No hotel, tour or venue names and no prices: kinds only. Keep it short.
Rules:
1. What the traveller said is fixed, never changed (source "user"). Everything you add is an assumption (source "assumed").
2. A night is a bed. The stays' nights add up to the nights said; every night has a place. Day 1 = the day they arrive. place is one of the trip's stops ("Tromsø"), the nearest stop for a special place outside town. country_code: the stop's ISO 3166-1 alpha-2 code.
3. One way per leg. A rental car (car_rental) covers the airport legs too: no transfer besides it. A leg on every day they change places.
4. Anchor budget: at most 1 per 2 nights, 3 in all, the traveller's wishes included. A special stay is not an anchor. The other days stay free.
5. rationale: 2-3 sentences. facts: at most 3 short facts about the place.
6. question: (topic: what it is about) the one question that shapes the trip's biggest card (the experience it is for, the main stay, the flights) and makes the traveller's intent clearer, 2-4 short choices. Never what you decided yourself (how the nights split, where the special stay goes, the ways): say those in rationale.
7. wishes: what the traveller asked for in THEIR OWN words, with its place and kind ("somewhere facing the jungle in Ubud" → place "Ubud", about "stay", text "facing the jungle"). Short, their words; nothing of yours. An empty list when none.
8. A rental (car, motorbike, bike) belongs to one stop: when the stops are far apart, a transfer joins them and each stop gets its own rental days. None when the trip's kind doesn't suit it (a honeymoon, an elderly family, a first visit).
9. The route (you draw the stops unless Known holds an agreed route): in travel order, a line or a loop on the map, never a zigzag. Every country and place the traveller named is on it; a stop is where the stay they asked for is (an overwater villa: a resort atoll, never the capital or a local island). About one stop per 3 nights; on a long trip (2 weeks and more, several countries) follow the region's known circuit, never heaping nights on one place to keep the stops few. No stop gets more than half the trip (unless the traveller asked); the nights follow what there is to see. A night spent on the way (Pakbeng on the slow boat) is a stop of 1 night. A city is on the route once: going back to the first city for the flight home gets no nights, departure_airport_city says it. arrival_airport_city / departure_airport_city: the city with the airport the first flight lands in and the flight home leaves from.
10. The way between stops suits the trip's style and the region's known way: on a backpacking or budget trip by land and water (a night train, a night bus, a boat, a border crossing); a flight only when the land way takes longer than a day or the style is comfort. note: the way's short name and length ("2-day slow boat from the Huay Xai border", "night train, 12 h"); "" when none.`,
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
 * Asks the advisor in the background (never awaited here), with all the checklist knows (Emre 2026-10-31: "topladığımız
 * bilgiler danışmana gitmiyor"): the chat asks once it is complete, or at "Oluştur". The same knowledge is never asked
 * twice; a change before "Oluştur" asks again, the newest ask taking the place of the one before.
 */
export function adviseStart(a: { id: string; text: string; known: string; today: string; lang: Lang; nights?: number | null; home?: string | null }, model: () => Promise<LlmProvider | null> = advisorModel): void {
  if (!a.known.trim() || (pending?.id === a.id && pending.known === a.known)) return;
  const answer = (async () => {
    try {
      const llm = await model();
      if (!llm) return (console.info(L("[danışman] sorulmadı: AI anahtarı yok", "[advisor] not asked: no AI key")), null);
      const [system, prompt] = withLang(a.lang, () => [adviceSystem(), advicePrompt(a.text, a.today, a.known)]);
      const signal = AbortSignal.timeout(CALL_MS);
      const started = Date.now();
      let got = await llm.generateJson(system, prompt, adviceSchema, [], { signal, maxRetries: 0 });
      // The code judges the route (Tur 22): what breaks a rule goes back once with its reasons; the answer with fewer
      // faults stays (never dropped in silence).
      const faults = a.nights ? withLang(a.lang, () => routeFaults(got, a.text, a.nights!, a.home ?? null)) : [];
      // (asked again only while there is time: a long trip's first answer can take most of a minute)
      if (faults.length && Date.now() - started < 35_000) {
        console.info(L(`[danışman] rota kurala uymadı, bir kez daha soruldu: ${faults.join("; ")}`, `[advisor] the route broke a rule, asked once more: ${faults.join("; ")}`));
        const again = await llm
          .generateJson(system, `${prompt}\n${withLang(a.lang, () => L("Önceki önerinin sorunları, düzelt", "What was wrong with your last answer, fix it"))}: ${faults.join("; ")}`, adviceSchema, [], { signal: AbortSignal.timeout(CALL_MS), maxRetries: 0 })
          .catch(() => null);
        if (again && withLang(a.lang, () => routeFaults(again, a.text, a.nights!, a.home ?? null)).length < faults.length) got = again;
      }
      // One line for whoever tests (the traveller never sees it): the advisor worked, how fast, what it decided.
      const used = llm.id === "anthropic" ? ADVISOR_CLAUDE : ADVISOR_GEMINI;
      const sec = ((Date.now() - started) / 1000).toFixed(1);
      const nights = got.stays.map((x) => `${x.place} ${x.nights}${x.kind === "special" ? ` (${x.what})` : ""}`).join(", ");
      const legs = got.legs.map((l) => `${l.day}:${l.mode}`).join(", ");
      const acts = got.anchors.map((x) => x.what).join(", ") || "-";
      console.info(withLang(a.lang, () => L(`[danışman] ${used} · ${sec} sn · geceler: ${nights} · ulaşım: ${legs} · etkinlik: ${acts}`, `[advisor] ${used} · ${sec} s · nights: ${nights} · ways: ${legs} · activities: ${acts}`)), got);
      last = { id: a.id, advice: got };
      return got;
    } catch (error) {
      console.warn("[advisor] failed", error);
      return null;
    }
  })();
  pending = { id: a.id, known: a.known, answer };
}

/** The last advice that came for a start: the one the route was drawn from stands when a later ask is late. */
let last: { id: string; advice: Advice } | null = null;

/** The advice for this start, waited for `ms` at most (the generating screen's map runs meanwhile); null when none. */
export async function adviceFor(id: string, ms: number): Promise<Advice | null> {
  if (pending?.id !== id) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ms)));
  try {
    const got = await Promise.race([pending.answer, late.then(() => "late" as const)]);
    const before = last?.id === id ? last.advice : null;
    if (got === "late") console.info(before ? L(`[danışman] yeni cevap ${ms / 1000} sn içinde yetişmedi, rotanın çizildiği cevap kullanıldı`, `[advisor] the new answer not in within ${ms / 1000} s: the one the route came from is used`) : L(`[danışman] ${ms / 1000} sn içinde yetişmedi, plan danışmansız kuruldu`, `[advisor] not in within ${ms / 1000} s: the plan was made without it`));
    return got === "late" || !got ? before : got;
  } finally {
    clearTimeout(timer);
  }
}

/** For the tests. */
export const resetAdvice = () => void ((pending = null), (last = null));

/** A stop's name without what the model added to it ("Chiang Khong (Huay Xai)", "Ella / Haputale" → the first). */
const bare = (place: string) => place.replace(/\s*\([^)]*\)/g, "").split(/\s*[/,]\s*/)[0].trim();

/** The stays' places in order, the nights of each run at one place added up ("Bangkok 3, Chiang Mai 4, …"). */
const stopsOf = (a: Pick<Advice, "stays">) => {
  const out: { city: string; nights: number; code: string; user: boolean }[] = [];
  for (const x of a.stays) {
    const prev = out.at(-1);
    if (prev && cityKeyOf(prev.city) === cityKeyOf(x.place)) {
      prev.nights += x.nights;
      prev.user ||= x.source === "user";
    } else out.push({ city: bare(x.place), nights: x.nights, code: x.country_code.trim().toUpperCase(), user: x.source === "user" });
  }
  return out;
};

/**
 * What breaks the route's rules, each in a line for the advisor to fix (Tur 22, Emre's Thailand · Laos · Cambodia: 4 stops,
 * 17 nights in Siem Reap, no way between them): the nights add up, every country named is on it, at most one stop per 3
 * nights, no stop of the advisor's more than half the trip, and a way for every change of place. Pure.
 */
export function routeFaults(a: Pick<Advice, "stays" | "legs"> & Partial<Pick<Advice, "departure_airport_city">>, said: string, nights: number, home: string | null): string[] {
  const out: string[] = [];
  const stops = stopsOf(a);
  const sum = stops.reduce((n, x) => n + x.nights, 0);
  if (sum !== nights) out.push(L(`gecelerin toplamı ${sum}, olmalı ${nights}`, `the nights add up to ${sum}, they must be ${nights}`));
  const codes = new Set(stops.map((x) => x.code));
  for (const [code, name] of countriesNamed(said, home)) if (!codes.has(code)) out.push(L(`söylenen ülke rotada yok: ${name}`, `a country named is not on the route: ${name}`));
  if (stops.length > maxStops(nights)) out.push(L(`${stops.length} durak, bu gece sayısına en fazla ${maxStops(nights)}`, `${stops.length} stops, at most ${maxStops(nights)} for these nights`));
  if (stops.length > 1) for (const x of stops) if (!x.user && x.nights * 2 > nights) out.push(L(`${x.city} gezinin yarısından fazlası (${x.nights} gece)`, `${x.city} takes more than half the trip (${x.nights} nights)`));
  const k = (t: string) => cityKeyOf(t);
  for (const [n, x] of stops.entries()) if (stops.findIndex((y) => k(y.city) === k(x.city)) < n) out.push(L(`${x.city} rotada iki kez geçiyor (dönüş uçuşu için departure_airport_city yeter)`, `${x.city} is on the route twice (departure_airport_city says the flight home)`));
  for (let n = 1; n < stops.length; n++) {
    const [from, to] = [stops[n - 1].city, stops[n].city];
    if (!a.legs.some((l) => k(bare(l.from)) === k(from) && k(bare(l.to)) === k(to))) out.push(L(`${from} → ${to} arası yol yok`, `no way from ${from} to ${to}`));
  }
  // The flight home leaves from elsewhere than the last stop: the way there is part of the spine (Kampot → Bangkok).
  const lastStop = stops.at(-1)?.city;
  const out2 = a.departure_airport_city?.trim() ? bare(a.departure_airport_city) : null;
  if (lastStop && out2 && k(out2) !== k(lastStop) && !a.legs.some((l) => k(bare(l.from)) === k(lastStop) && k(bare(l.to)) === k(out2))) out.push(L(`dönüş uçuşu ${out2} havalimanından; ${lastStop} → ${out2} yolu yok`, `the flight home leaves ${out2}; no way from ${lastStop} to ${out2}`));
  return out;
}

/** The leg modes that are a ticket between places, as the plan's kinds (a night train is a train, a boat a ferry). */
export const WAY_KIND: Partial<Record<(typeof LEG_MODES)[number], "flight" | "train" | "bus" | "ferry">> = { flight: "flight", train: "train", night_train: "train", bus: "bus", night_bus: "bus", ferry: "ferry", boat: "ferry" };

/**
 * The route the advisor drew (Tur 22: one brain draws the spine, the route proposal is its), each stop with the way to it;
 * null when it doesn't hold (the same rules as any proposal: real names, whole nights adding up to the total).
 */
export function routeOfAdvice(a: Advice, total: number, origin: string | null, whereCode: string | null): StartRoute | null {
  // A city come back to (Peru's "… Uyuni 4, Lima 2" for the flight home) gives its nights to the stop before it: the
  // route stands, the flight home leaves from there.
  const stops = stopsOf(a).reduce<ReturnType<typeof stopsOf>>((out, x) => {
    if (out.length && out.some((y) => cityKeyOf(y.city) === cityKeyOf(x.city))) out[out.length - 1] = { ...out[out.length - 1], nights: out[out.length - 1].nights + x.nights };
    else out.push(x);
    return out;
  }, []);
  const route = acceptRoute({ stops: stops.map((x) => ({ city: x.city, nights: x.nights, country_code: x.code })), arrival_airport_city: a.arrival_airport_city, departure_airport_city: a.departure_airport_city }, total, origin, whereCode);
  if (!route) return (console.info(L(`[danışman] rotası kullanılamadı: ${stops.map((x) => `${x.city} ${x.nights}`).join(", ")}`, `[advisor] its route can't be used: ${stops.map((x) => `${x.city} ${x.nights}`).join(", ")}`)), null);
  const k = (t: string) => cityKeyOf(t);
  const lastStop = route.stops.at(-1)!.city;
  const home = route.leave && k(route.leave) !== k(lastStop) ? a.legs.find((l) => k(bare(l.from)) === k(lastStop) && k(bare(l.to)) === k(route.leave!)) : null;
  return {
    ...route,
    ...(home ? { leaveWay: { mode: home.mode, note: home.note.trim() || null } } : {}),
    stops: route.stops.map((x, n) => {
      const leg = n ? a.legs.find((l) => k(bare(l.from)) === k(route.stops[n - 1].city) && k(bare(l.to)) === k(x.city)) : null;
      return leg ? { ...x, way: { mode: leg.mode, note: leg.note.trim() || null } } : x;
    }),
  };
}

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

/** A wish as the trip's preferences keep it ("Ubud · Konaklama → ormana bakan"): one per place and kind, the latest wins. */
function wishLine(w: Advice["wishes"][number]): string[] {
  const text = w.text.trim().slice(0, 80);
  if (!text) return [];
  const about = { stay: L("Konaklama", "Stay"), food: L("Yemek", "Food"), activity: L("Etkinlik", "Activity"), transport: L("Ulaşım", "Transport"), general: L("Genel", "General") }[w.about];
  return [`${w.place?.trim() ? `${w.place.trim()} · ` : ""}${about} → ${text}`];
}

/**
 * The advice folded into the start (pure): the stays asked for in words get their place among the city's nights, the
 * traveller's wishes missed by the reading are added, the anchors the advisor chose come within the budget, the question
 * when none was asked, and the ways by day for the judge. Never overrules what the traveller said.
 */
/** The anchor budget for a trip of these nights (Tur 18): one per two nights, at least one, three at most. */
export const anchorBudget = (nights: number): number => Math.min(3, Math.max(1, Math.floor(nights / 2)));

export function applyAdvice(s: StartState, a: Advice | null): StartState {
  if (!a) return s;
  const stops = [...new Set([s.where?.place, ...(s.route?.stops ?? []).map((x) => x.city)].filter((x): x is string => Boolean(x)))];
  const atStop = (place: string, fallback: string | null) => stops.find((x) => cityKeyOf(x) === cityKeyOf(place)) ?? fallback ?? stops[0] ?? place;
  // The stays in order, each at a stop (a place outside town: the stop before it), with the nights before it there.
  const seen = new Map<string, number>();
  let last: string | null = null;
  // (a stay in a country the agreed route doesn't go to is the advisor's other route, never folded into a stop: Peru's
  // Uyuni put after Urubamba's nights, the plan fell to one stop called "Peru")
  const codes = new Set([s.where?.code, ...(s.route?.stops ?? []).map((x) => x.code)].filter(Boolean).map((c) => c!.toUpperCase()));
  const elsewhere = (x: Advice["stays"][number]) => !stops.some((y) => cityKeyOf(y) === cityKeyOf(x.place)) && Boolean(x.country_code?.trim()) && codes.size > 0 && !codes.has(x.country_code.trim().toUpperCase());
  const placed = a.stays.filter((x) => !elsewhere(x)).map((x) => {
    const city = atStop(x.place, last);
    last = city;
    const k = cityKeyOf(city) ?? city;
    const after = seen.get(k) ?? 0;
    seen.set(k, after + x.nights);
    return { ...x, city, after };
  });
  const specials: SpecialStay[] = [...(s.specialStays ?? [])].map((sp) => {
    const at = placed.find((x) => x.what && sameThing(x.what, sp.what) && cityKeyOf(x.city) === cityKeyOf(sp.city));
    return at && sp.after == null ? { ...sp, after: at.after } : sp;
  });
  // (a stay asked for in words for part of a stop's nights is a stay of its own, whatever kind it was written as: "bir gece
  // ryokan" came as a hotel; one for all of a stop's nights is a wish for that stay, kept in the preferences instead)
  const cityNights = (city: string) => placed.filter((y) => cityKeyOf(y.city) === cityKeyOf(city)).reduce((n, y) => n + y.nights, 0);
  const own = (x: (typeof placed)[number]) => x.kind === "special" || (Boolean(x.what) && x.source === "user" && x.nights < cityNights(x.city));
  // The nights a stop has on the route (a special night must fall inside them).
  const routeNights = (city: string) => s.route?.stops.find((y) => cityKeyOf(y.city) === cityKeyOf(city))?.nights ?? null;
  for (const x of placed) {
    if (!own(x) || x.source !== "user" || !x.what || specials.some((sp) => sameThing(sp.what, x.what!))) continue;
    const room = routeNights(x.city);
    if (room != null && x.after + x.nights > room) continue;
    specials.push({ city: x.city, nights: x.nights, what: x.what, after: x.after });
  }
  // The anchors: the traveller's always; the advisor's own while the budget lasts (a special stay is no anchor).
  const nights = a.stays.reduce((n, x) => n + x.nights, 0);
  const budget = anchorBudget(nights);
  const wanted: WantedActivity[] = [...(s.wanted ?? [])];
  const fresh = a.anchors.filter((x) => !wanted.some((w) => sameThing(w.what, x.what)) && !specials.some((sp) => sameThing(sp.what, x.what)));
  for (const x of [...fresh.filter((x) => x.source === "user"), ...fresh.filter((x) => x.source !== "user")]) {
    if (x.source !== "user" && wanted.length >= budget) continue;
    wanted.push({ city: stops[0] ?? null, what: x.what, day: null, ...(x.source !== "user" ? { assumed: true } : {}) });
  }
  const q = a.question.text.trim();
  // The advisor's question over the reading's (it asked with everything the checklist knows, the route too: Emre's Bali
  // asked "Ubud'da kaç gece?" after the route was agreed 7 and 7).
  // Never about what the plan decided itself (the nights split, the special night's place, the ways): the model names the
  // question's topic, the code holds the rule (Emre's Bali: "Ubud'daki ormana bakan villada kaç gece?" after 7 and 7).
  const asks = q.endsWith("?") && q.split("?").length === 2 && q.length <= 120 && !asksDecided(a.question.topic);
  const choices = a.question.choices.map((c) => c.trim()).filter((c) => c && c.length <= 30).slice(0, 4);
  return {
    ...s,
    specialStays: specials,
    wanted,
    ...(asks ? { spineQuestion: q, spineChoices: choices.length >= 2 ? choices : [], spineTopic: a.question.topic } : {}),
    advice: { legs: a.legs.map((l) => ({ day: l.day, mode: l.mode, from: l.from, to: l.to, note: l.note?.trim() || null })), rationale: a.rationale, facts: a.facts.slice(0, 3), wishes: a.wishes.flatMap(wishLine).slice(0, 6) },
  };
}

/**
 * The route once "Oluştur" was pressed while it was still drawn (Tur 22c): the advisor's, else the country's classic
 * circuit (no key of their own, late, failed), else the stand-in's one stop; still Önerimiz on the board until agreed.
 */
export function routeAfterDrawing(s: StartState, a: Advice | null): StartRoute | null {
  if (!s.route?.drawing) return s.route;
  const drawn = a ? routeOfAdvice(a, totalNights(s) ?? 0, s.from, s.where?.code ?? null) : null;
  const best = drawn ?? circuitRoute(s);
  return best ? { ...best, confirmed: true, proposed: true } : { ...s.route, drawing: false };
}
