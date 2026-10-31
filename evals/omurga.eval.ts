// The trip's spine against the real models (omurga Tur 18-19 ölçüm seti, 2026-10-31): each case is a sentence a traveller
// types; the start's advisor (Haiku, as the extension asks it) thinks it through, the plan is made by the real steps, then
// the code checks the hard rules (every night a bed, one way per leg, the ring closed, the wishes kept, the anchor budget,
// no first question about what the plan decided) and a stronger model, as a travel advisor, answers each case's yes/no
// questions (a rest after a long flight, a honeymoon's pace, a spare night for the lights). The code's checks decide a
// case; the judge's answers are a second opinion, written to evals/out/omurga-<model>.json for the trend.
//   ANTHROPIC_API_KEY=… npx vitest run --config vitest.eval.config.ts evals/omurga.eval.ts
import "fake-indexeddb/auto";
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { ADVISOR_CLAUDE, adviceFor, adviseStart, applyAdvice, type Advice } from "../src/lib/advisor";
import { db, listItems } from "../src/lib/db";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { setLang, withLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { applyAnswer, asksDecided, creationOf, knownLines, newStart, type StartState } from "../src/lib/startTrip";
import type { Item, Trip } from "../src/lib/types";

const key = process.env.ANTHROPIC_API_KEY ?? "";
const JUDGE = process.env.EVAL_JUDGE ?? "claude-opus-5-5";
const claude = (model: string) => anthropicProvider(new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }), model);

interface Case {
  id: string;
  said: string;
  where: { place: string; country: string; code: string };
  nights: number;
  start: string;
  from: string;
  who: StartState["who"];
  /** Several stops, as agreed on the route. */
  stops?: { city: string; nights: number }[];
  way?: StartState["way"];
  /** Words the plan's records must hold (each a wish said). */
  wishes: string[];
  /** The judge's yes/no questions: yes is good. */
  judge: string[];
}

const CASES: Case[] = [
  {
    id: "tromso", said: "Norveç'te Tromsø'ya kuzey ışıklarını görmeye gitmek istiyorum, 5 gece. Bir gecesi cam tavanlı bir yerde olsun, bir de husky turu istiyorum.",
    where: { place: "Tromsø", country: "Norveç", code: "NO" }, nights: 5, start: "2027-02-15", from: "İstanbul", who: { kind: "partner", names: [] },
    wishes: ["cam", "husky"],
    judge: ["Kuzey ışıkları için birden fazla gece şans tanınmış mı?", "Plan beş gecelik bir geziye göre sade mi (her güne bir etkinlik yığılmamış)?", "Cam tavanlı gece bir yatak gecesi olarak plana girmiş mi?"],
  },
  {
    id: "bali", said: "Balayı için Bali'ye gidiyoruz, 14 gece: önce Ubud'da ormana bakan bir yerde, sonra Uluwatu'da denize yakın kalmak istiyoruz.",
    where: { place: "Bali", country: "Endonezya", code: "ID" }, nights: 14, start: "2027-05-01", from: "İstanbul", who: { kind: "partner", names: [] },
    stops: [{ city: "Ubud", nights: 7 }, { city: "Uluwatu", nights: 7 }],
    wishes: [],
    judge: ["Balayına uygun sakin bir tempo var mı?", "Ubud ile Uluwatu arası motosikletle değil, transferle mi geçiliyor?", "Varış transferi havalimanının olduğu yerden (Denpasar) ilk durağa mı?"],
  },
  {
    id: "tokyo", said: "İstanbul'dan Tokyo'ya ilk kez gidiyorum, 7 gece; tapınaklar ve yemek ilgimi çekiyor.",
    where: { place: "Tokyo", country: "Japonya", code: "JP" }, nights: 7, start: "2027-04-03", from: "İstanbul", who: { kind: "solo", names: [] },
    wishes: [],
    judge: ["Uzun uçuştan sonra varış günü hafif bırakılmış mı (jet lag için etkinlik yok ya da çok hafif)?", "Etkinlik sayısı yedi gece için ölçülü mü?"],
  },
  {
    id: "amalfi", said: "Napoli'ye uçup Amalfi kıyısını arabayla 6 gece gezmek istiyoruz, eşimle.",
    where: { place: "Amalfi", country: "İtalya", code: "IT" }, nights: 6, start: "2027-06-10", from: "İstanbul", who: { kind: "partner", names: [] },
    stops: [{ city: "Napoli", nights: 1 }, { city: "Positano", nights: 3 }, { city: "Ravello", nights: 2 }],
    wishes: [],
    judge: ["Kıyı boyunca araçla gidiş planda var mı?", "Aynı gün için hem araç kiralama hem havalimanı otobüsü/transferi gibi çelişen ulaşım yok mu?"],
  },
  {
    id: "maldivler", said: "Balayı için Maldivler'de 7 gece, su üstü villada kalmak istiyoruz.",
    where: { place: "Maldivler", country: "Maldivler", code: "MV" }, nights: 7, start: "2027-03-05", from: "İstanbul", who: { kind: "partner", names: [] },
    wishes: ["su üstü"],
    judge: ["Havalimanından resorta deniz uçağı ya da tekne transferi düşünülmüş mü?", "Plan dinlenmeye yer bırakıyor mu (her gün dolu değil)?"],
  },
  {
    id: "paris-aile", said: "İki çocuğumuzla (5 ve 8 yaşında) Paris'e 5 gece gidiyoruz; Disneyland'e bir gün gitmek istiyoruz.",
    where: { place: "Paris", country: "Fransa", code: "FR" }, nights: 5, start: "2027-07-12", from: "İstanbul", who: { kind: "family", names: [] },
    wishes: ["disney"],
    judge: ["Plan çocuklu bir aileye göre ölçülü mü (fazla etkinlik yüklenmemiş)?", "Disneyland günü plana girmiş mi?"],
  },
];

function state(c: Case): StartState {
  let s = applyAnswer(newStart(`ev-${c.id}`, "plan", 1, "tr"), { q: "where", place: c.where.place, country: c.where.country, code: c.where.code }, 2);
  s = applyAnswer(s, { q: "duration", duration: { unit: "night", n: c.nights } }, 3);
  s = applyAnswer(s, { q: "start", date: c.start, approx: false }, 4);
  return {
    ...s,
    from: c.from,
    who: c.who,
    ...(c.way ? { way: c.way } : {}),
    ...(c.stops ? { route: { stops: c.stops.map((x) => ({ ...x, code: c.where.code })), arrive: null, leave: null, confirmed: true, source: "user" as const } } : {}),
    messages: [{ role: "user" as const, text: c.said, at: 1 }],
  };
}

const plain = (t: string | null | undefined) => (t ?? "").toLocaleLowerCase("tr");
const day = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const AIRPORT = new Set(["transfer", "taxi", "bus", "train", "ferry"]);

/** The code's checks: what is wrong, each in a line (none: as it must be). */
function checks(c: Case, s: StartState, items: Item[], advice: Advice | null, said: string[]): string[] {
  const wrong: string[] = [];
  const stays = items.filter((i) => i.category === "stay" && i.dates.start && i.dates.end);
  for (let n = 0; n < c.nights; n++) {
    const night = day(c.start, n);
    if (!stays.some((x) => x.dates.start! <= night && night < x.dates.end!)) wrong.push(`${night} gecesi yataksız`);
  }
  const ways = items.filter((i) => i.category === "transport");
  const rentals = ways.filter((i) => (i.plannedKind ?? "").endsWith("_rental"));
  for (const w of ways.filter((i) => AIRPORT.has(i.plannedKind ?? "") && i.dates.start)) {
    if (rentals.some((r) => r.plannedKind === "car_rental" && r.dates.start && w.dates.start! >= r.dates.start && w.dates.start! <= (r.dates.end ?? r.dates.start))) wrong.push(`${w.dates.start}: araç kiralama + ${w.plannedKind}`);
  }
  const flights = items.filter((i) => i.category === "flight");
  const first = ways.find((i) => AIRPORT.has(i.plannedKind ?? "") && i.dates.start === c.start);
  const end = day(c.start, c.nights);
  if (flights.length >= 2 && first && !ways.some((i) => AIRPORT.has(i.plannedKind ?? "") && i.dates.start === end)) wrong.push("varış transferi var, dönüş transferi yok");
  // (a wish for the whole stay, "su üstü villa", is kept as the trip's preference, read by the stay search)
  const text = [...items.map((i) => plain(i.name)), ...said.map(plain)].join(" | ");
  for (const w of c.wishes) if (!text.includes(plain(w))) wrong.push(`istek planda yok: ${w}`);
  const acts = items.filter((i) => i.category === "activity").length;
  const budget = Math.min(3, Math.max(1, Math.floor(c.nights / 2))) + c.wishes.length;
  if (acts > budget) wrong.push(`etkinlik ${acts} > bütçe ${budget}`);
  if (advice && s.spineQuestion === advice.question.text && asksDecided(advice.question.topic)) wrong.push(`ilk soru planın kararını soruyor: ${s.spineQuestion}`);
  return wrong;
}

const verdict = z.object({ answers: z.array(z.object({ question: z.string(), yes: z.boolean(), why: z.string() })) });

async function judgeOf(c: Case, items: Item[], trip: Trip): Promise<z.infer<typeof verdict>["answers"]> {
  // The board's own changes of city (its legs, "Şehir değişimi"), which hold the way between two stops without a record.
  const moves = buildLegs(buildPlan(trip, items), trip).filter((l) => l.kind === "move").map((l) => `- ${l.date} · şehir değişimi (ulaşımı henüz seçilmedi) · ${l.from.city ?? l.from.label} → ${l.to.city ?? l.to.label}`);
  const lines = items
    .filter((i) => i.status !== "dismissed")
    .sort((a, b) => (a.dates.start ?? "9999").localeCompare(b.dates.start ?? "9999"))
    .map((i) => `- ${i.dates.start ?? "tarihsiz"}${i.dates.end ? ` → ${i.dates.end}` : ""} · ${i.category}${i.plannedKind ? `/${i.plannedKind}` : ""} · ${i.name}${i.city ? ` (${i.city})` : ""}`)
    .concat(moves)
    .join("\n");
  const system = "Deneyimli bir seyahat danışmanısın. Sana bir gezginin isteği ve uygulamanın çizdiği ilk plan (omurga) verilir. Her soruyu yalnız plana bakarak evet ya da hayır diye yanıtla; why tek kısa cümle. Planda olmayanı varsayma.";
  const prompt = `İstek: ${c.said}\nGeceler: ${c.nights}, başlangıç ${c.start}\n\nPlan:\n${lines}\n\nSorular:\n${c.judge.map((q, n) => `${n + 1}. ${q}`).join("\n")}`;
  return (await claude(JUDGE).generateJson(system, prompt, verdict, [], { maxRetries: 1 })).answers;
}

const rows: { id: string; ok: boolean; wrong: string[]; advisor: boolean; question: string | null; judge: { question: string; yes: boolean; why: string }[]; seconds: number }[] = [];

describe.skipIf(!key)("omurga: the start's spine on the real models", () => {
  afterAll(() => {
    mkdirSync("evals/out", { recursive: true });
    const judged = rows.flatMap((r) => r.judge);
    const summary = { advisor: ADVISOR_CLAUDE, judge: JUDGE, cases: rows.length, code_ok: rows.filter((r) => r.ok).length, judge_yes: `${judged.filter((j) => j.yes).length}/${judged.length}`, rows };
    writeFileSync(`evals/out/omurga-${ADVISOR_CLAUDE}.json`, JSON.stringify(summary, null, 2));
    console.log(`omurga: kod ${summary.code_ok}/${summary.cases} · yargıç ${summary.judge_yes}`);
  });

  for (const c of CASES) {
    it(c.id, async () => {
      setLang("tr");
      const started = Date.now();
      let s = state(c);
      adviseStart({ id: s.id, text: c.said, known: withLang("tr", () => knownLines(s, { myName: null } as never)), today: "2026-10-31", lang: "tr" }, async () => claude(ADVISOR_CLAUDE));
      const advice = await adviceFor(s.id, 60_000);
      s = applyAdvice(s, advice);
      for (const step of stepsFor(s, creationOf(s)!)) {
        if (step.id === "suggestions") continue;
        const { tripId } = await runStep(step.id, s, { provider: "anthropic" });
        if (step.id === "trip") s = { ...s, tripId };
      }
      const items = (await listItems(s.tripId!)).filter((i) => i.status !== "dismissed");
      const wrong = checks(c, s, items, advice, (await (await db()).get("trips", s.tripId!))?.wants?.said ?? []);
      const trip = (await (await db()).get("trips", s.tripId!))!;
      const judge = await judgeOf(c, items, trip).catch((e) => [{ question: "yargıç", yes: false, why: String(e).slice(0, 120) }]);
      rows.push({ id: c.id, ok: wrong.length === 0, wrong, advisor: Boolean(advice), question: s.spineQuestion ?? null, judge, seconds: (Date.now() - started) / 1000 });
      expect(advice, "danışman cevap vermedi").toBeTruthy();
      expect(wrong).toEqual([]);
    });
  }
});
