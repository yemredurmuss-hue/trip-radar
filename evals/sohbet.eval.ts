// The trip chat against the real model (Sohbet Faz 4, 2026-10-24, docs/arastirma/2026-10-24-sohbet-ajan-plani.md): Emre's
// own conversations of that day, played as he typed them, each checked on what the board really is afterwards (never on
// how the reply sounds). The fake-model tests can't see this: whether the model, with the rules and board_after, does what
// was asked. Each scenario has its own trip; the table goes to evals/out/sohbet-<model>.json.
//   GEMINI_API_KEY=… npx vitest run --config vitest.eval.config.ts   (EVAL_MODEL to pick another model)
import "fake-indexeddb/auto";
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { db, listMessages } from "../src/lib/db";
import { geminiProvider } from "../src/lib/llm/gemini";
import { plannedInput, plannedItem } from "../src/lib/planned";
import type { Capture, Item, Trip } from "../src/lib/types";
import { withEdits } from "../src/lib/userEdits";

const key = process.env.GEMINI_API_KEY ?? "";
const model = process.env.EVAL_MODEL ?? "gemini-3-flash-preview";
const provider = () => geminiProvider(new GoogleGenAI({ apiKey: key }), model);

const trip = (id: string): Trip => ({ id, title: "İstanbul-Porto-Madeira", confirmedDates: { start: "2026-10-07", end: "2026-10-21" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 });
const plan = (tripId: string, id: string, raw: Record<string, unknown>): Item => plannedItem(plannedInput(raw), tripId, id, 1);
const stayIn = (tripId: string, id: string, city: string, start: string, end: string) => plan(tripId, id, { kind: "stay", city, date: start, end_date: end, title: `${city} Konaklama` });
const base = (tripId: string): Item[] => [stayIn(tripId, `${tripId}-porto`, "Porto", "2026-10-07", "2026-10-11"), stayIn(tripId, `${tripId}-madeira`, "Funchal", "2026-10-11", "2026-10-18")];

type Board = { live: Item[]; all: Item[]; replies: string[] };
interface Scenario {
  name: string;
  said: string[];
  seed?: (tripId: string) => Item[];
  captures?: (tripId: string) => Capture[];
  /** null: as asked; else what is wrong. */
  check: (b: Board) => string | null;
}

const taxis = (b: Board) => b.live.filter((i) => i.plannedKind === "taxi" || i.plannedKind === "transfer");
const uberLine = (b: Board) => taxis(b).filter((i) => /uber/i.test(i.name));
const whole = (i: Item) => !i.dates.start && !i.flight?.from && !i.flight?.to;
const airport = (tripId: string) => plan(tripId, `${tripId}-air`, { kind: "taxi", from: "Havalimanı", to: "Bonfim", city: "Porto", date: "2026-10-07", time: "15:00" });

const SCENARIOS: Scenario[] = [
  {
    name: "Uber yolculukları, toplu fiyat (tüm gezi kalemi)",
    said: ["Uber yolculuklarını ulaşıma ekle, toplu fiyat yazarım"],
    check: (b) => (uberLine(b).length !== 1 ? `Uber kalemi ${uberLine(b).length} tane` : !whole(uberLine(b)[0]) ? `Uber kalemi tarihli/uçlu: ${uberLine(b)[0].dates.start ?? ""} ${uberLine(b)[0].flight?.from ?? ""}→${uberLine(b)[0].flight?.to ?? ""}` : null),
  },
  {
    name: "Havalimanı taksisini sil, yerine genel Uber",
    seed: (t) => [airport(t)],
    said: ["havalimanı olanı sil, onun yerine genel uber yolculukları koy"],
    check: (b) => (b.live.some((i) => i.id.endsWith("-air")) ? "havalimanı taksisi duruyor" : uberLine(b).length !== 1 ? `Uber kalemi ${uberLine(b).length} tane` : !whole(uberLine(b)[0]) ? "Uber kalemi tüm gezi değil" : null),
  },
  {
    name: "Art arda: Uber ekle, sonra 'onu 300 euro yap'",
    said: ["genel taksi kullanımı için Uber yolculukları ekle", "onu 300 euro yap"],
    check: (b) => {
      const u = uberLine(b);
      return u.length !== 1 ? `Uber kalemi ${u.length} tane` : u[0].price.amount !== 300 ? `fiyat ${u[0].price.amount} ${u[0].price.currency}` : null;
    },
  },
  {
    name: "Porto için değil, genel olsun",
    seed: (t) => [plan(t, `${t}-ub`, { kind: "taxi", title: "Uber Yolculukları", city: "Porto", date: "2026-10-07" })],
    said: ["porto için değil genel uber yolculukları olacak bu sadece"],
    check: (b) => (uberLine(b).length !== 1 ? `Uber kalemi ${uberLine(b).length} tane` : !whole(uberLine(b)[0]) ? `hâlâ ${uberLine(b)[0].dates.start} / ${uberLine(b)[0].city}` : null),
  },
  {
    name: "Karavan karavan olur, 7 gün",
    said: ["Madeira'da 11-18 Ekim karavan kiralayacağız"],
    check: (b) => {
      const r = b.live.filter((i) => i.category === "transport" && /rental/.test(i.plannedKind ?? ""));
      return r.length !== 1 ? `kiralama ${r.length} tane` : r[0].plannedKind !== "rv_rental" ? `tür ${r[0].plannedKind}` : r[0].dates.start !== "2026-10-11" || r[0].dates.end !== "2026-10-18" ? `tarih ${r[0].dates.start}→${r[0].dates.end}` : null;
    },
  },
  {
    name: "Saatini değiştir, ikinci kayıt açma",
    seed: (t) => [airport(t)],
    said: ["havalimanı taksisinin saatini 10:00 yap"],
    check: (b) => (taxis(b).length !== 1 ? `taksi ${taxis(b).length} tane` : !taxis(b)[0].flight?.departure?.endsWith("10:00") ? `saat ${taxis(b)[0].flight?.departure}` : null),
  },
  {
    name: "Aynı planı iki kez söyle: tek kayıt",
    said: ["Lizbon'da 2 gece konaklama planla", "Lizbon için 2 gece konaklama ekle"],
    check: (b) => {
      const l = b.live.filter((i) => i.category === "stay" && /lizbon|lisbon/i.test(`${i.city} ${i.name}`));
      return l.length !== 1 ? `Lizbon konaklaması ${l.length} tane` : null;
    },
  },
  {
    name: "Ekran görüntüsünden sonra 'bunun fiyatı'",
    seed: (t) => [{ ...plan(t, `${t}-shot`, { kind: "stay", title: "Bonfim Konaklaması", city: "Porto", date: "2026-10-07", end_date: "2026-10-11" }), origin: undefined, captureIds: [`${t}-c1`], status: "booked" as const, createdAt: Date.now() - 20_000 }],
    captures: (t) => [{ id: `${t}-c1`, kind: "image", url: null, title: null, pageText: "", viewportText: "", selection: "", jsonLd: [], meta: {}, screenshot: "data:image/jpeg;base64,AAAA", capturedAt: Date.now() - 30_000, status: "done", error: null, itemId: `${t}-shot`, fromTripId: t } as Capture],
    said: ["bunun fiyatı 420 euro"],
    check: (b) => {
      // (the card's price: a page's option keeps a price said as its correction, userEdits)
      const s = withEdits(b.all.find((i) => i.id.endsWith("-shot"))!);
      return s.price.amount !== 420 ? `Bonfim fiyatı ${s.price.amount} ${s.price.currency}` : null;
    },
  },
  {
    name: "Karavanı sil",
    seed: (t) => [plan(t, `${t}-rv`, { kind: "rv_rental", title: "Madeira Karavan", city: "Funchal", date: "2026-10-11", end_date: "2026-10-18" })],
    said: ["karavanı sil"],
    check: (b) => (b.live.some((i) => i.id.endsWith("-rv")) ? "karavan duruyor" : null),
  },
  {
    name: "Yanlış iddia yok: olmayanı 'ekledim' demesin",
    said: ["Porto'da bir fado gösterisi fikri ekle"],
    check: (b) => {
      const said = b.replies.join(" ");
      const added = b.live.some((i) => /fado/i.test(i.name));
      return /ekledim|added/i.test(said) && !added ? "ekledim dedi ama yok" : !added ? "fado eklenmedi" : !b.replies.length ? "cevap yok" : null;
    },
  },
];

const results: { name: string; ok: boolean; why: string | null; replies: string[]; ms: number }[] = [];

describe.skipIf(!key)(`sohbet eval · ${model}`, () => {
  for (const [n, s] of SCENARIOS.entries()) {
    it(s.name, async () => {
      const tripId = `e${n}`;
      const d = await db();
      await d.put("trips", trip(tripId));
      for (const i of [...base(tripId), ...(s.seed?.(tripId) ?? [])]) await d.put("items", i);
      for (const c of s.captures?.(tripId) ?? []) await d.put("captures", c);
      const started = Date.now();
      let error: string | null = null;
      for (const text of s.said) {
        try {
          await sendMessage(tripId, text, provider());
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
          break;
        }
      }
      const all = (await d.getAll("items")).filter((i) => i.tripId === tripId);
      const live = all.filter((i) => i.status !== "dismissed");
      const replies = (await listMessages(tripId)).filter((m) => m.role === "assistant" && m.text.trim()).map((m) => m.text);
      const why = error ? `hata: ${error}` : s.check({ live, all, replies });
      results.push({ name: s.name, ok: why == null, why, replies, ms: Date.now() - started });
      expect(why).toBeNull();
    });
  }
});

afterAll(() => {
  if (!results.length) return;
  mkdirSync("evals/out", { recursive: true });
  writeFileSync(`evals/out/sohbet-${model}.json`, JSON.stringify({ model, at: new Date().toISOString(), passed: results.filter((r) => r.ok).length, of: results.length, results }, null, 2));
});
