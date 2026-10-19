// 0.38.5: Emre's Bali start, "Bali de 3 hafta bir sabit yerde kalmalı canggu da plan yap sabinle". What went wrong:
// the one place said (Canggu) was lost and a four-stop route was proposed, Sabin was never read, and the questions
// after the chips ("Kasım ayının hangi günü…", "Bu gezide en çok ne istiyorsun?") were always the code's fixed lines.
import { afterEach, describe, expect, it, vi } from "vitest";

const prompts: { system: string; prompt: string }[] = [];
let answer: Record<string, unknown> = { text: "", question: "" };
vi.mock("../src/lib/llm", () => ({
  getProvider: async () => ({
    generateJson: async (system: string, prompt: string) => {
      prompts.push({ system, prompt });
      return answer;
    },
  }),
}));

import { askNext } from "../src/app/start/model";
import { withLang } from "../src/lib/i18n";
import {
  acceptExtraction, applyAnswer, applyText, knownLines, mergeExtracted, modelWordsQuestion, newStart, nextPrompt, nextQuestion, parseStartText, peopleCount,
  questionOf, replyText, routeForGenerate, routeToPrepare, wantsRouteAdvice, whoText, type RawExtraction, type StartState,
} from "../src/lib/startTrip";

const TODAY = "2026-10-19";
const ctx = { myName: null, fromGuess: "İstanbul", today: TODAY };
const LINE = "Bali de 3 hafta bir sabit yerde kalmalı canggu da plan yap sabinle";
const tr = <T,>(fn: () => T) => withLang("tr", fn);
const empty: RawExtraction = {
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "",
};

/** The first line typed, read by the code alone (no key), as the chat applies it. */
function first(line = LINE): { before: StartState; after: StartState } {
  const before = { ...newStart("bali", "plan", 1, "tr"), messages: [] };
  const code = tr(() => parseStartText(line, TODAY, "where"));
  return { before, after: tr(() => applyText(before, line, code, 2, "where")).state };
}

afterEach(() => {
  prompts.length = 0;
  answer = { text: "", question: "" };
});

describe("one place for the whole trip", () => {
  it("Emre's line without the model: Bali, Canggu 21 nights as the only stop, never a route to agree on", () => {
    const { before, after } = first();
    expect(after.where?.place).toBe("Bali");
    expect(after.base).toBe("Canggu");
    expect(after.route).toMatchObject({ stops: [{ city: "Canggu", nights: 21, code: "ID" }], confirmed: true });
    expect(wantsRouteAdvice(after)).toBe(false);
    expect(routeToPrepare(after)).toBeNull();
    // Said back in one line, then the start, the place named.
    expect(tr(() => replyText(before, after, ctx))).toBe("Sabin ile Bali, 3 hafta, tek yer: Canggu.\nCanggu'ya ne zaman yola çıkmayı düşünüyorsunuz?");
    // Kasım, Sonu, the styles: the route is never asked.
    const month = applyAnswer(after, { q: "start", date: "2026-11-01", approx: true }, 3);
    expect(nextQuestion(month)).toBe("day");
    expect(tr(() => questionOf(month, "day", ctx).text)).toBe("Canggu'ya Kasım'da hangi gün çıkıyorsunuz?");
    const day = applyAnswer(month, { q: "day", date: "2026-11-24", part: "end" }, 4);
    expect(tr(() => replyText(month, day, ctx, false, true))).toBe("24 Kasım'ı başlangıç aldım, değiştirebilirsin.\nCanggu'da en çok ne yapmak istersiniz? (birden çok seçebilirsiniz)");
    const want = applyAnswer(day, { q: "want", styles: ["nature", "beach", "nightlife"], budget: null }, 5);
    expect(nextQuestion(want)).not.toBe("route");
    expect(want.route).toMatchObject({ stops: [{ city: "Canggu", nights: 21 }], confirmed: true });
    expect(routeForGenerate(want)?.stops).toEqual([{ city: "Canggu", nights: 21, code: "ID" }]);
  });

  it("the model reads it too: one_place, even when it gives the town as the destination", () => {
    const { before } = first();
    const code = tr(() => parseStartText(LINE, TODAY, "where"));
    const model = acceptExtraction({ ...empty, destination: "Canggu", destination_country: "Endonezya", destination_country_code: "ID", names: ["Sabin"], duration_days: 22, one_place: "Canggu" }, TODAY);
    expect(model.base).toBe("Canggu");
    const s = tr(() => applyText(before, LINE, mergeExtracted(code, model), 2, "where")).state;
    expect(s.route?.stops.map((x) => [x.city, x.nights])).toEqual([["Canggu", 21]]);
    expect(s.route?.confirmed).toBe(true);
    expect(nextQuestion(s)).toBe("start");
  });

  it("other ways of saying it; a town said in passing is no base", () => {
    expect(first("Bali'ye 2 hafta, sadece Ubud").after.route?.stops).toEqual([{ city: "Ubud", nights: 14, code: "ID" }]);
    expect(first("Bali'ye 10 gün, Canggu'da kalacağız").after.base).toBe("Canggu");
    expect(first("Bali 3 hafta, tek yerde kalacağız").after.route?.stops).toEqual([{ city: "Bali", nights: 21, code: "ID" }]);
    // Not said: the route is proposed as before.
    const free = first("Bali 3 hafta canggu ve ubud görmek istiyoruz").after;
    expect(free.base).toBeUndefined();
    expect(free.route?.confirmed).toBe(false);
  });
});

describe("who: a name glued or in lower case", () => {
  const who = (line: string) => tr(() => parseStartText(line, TODAY, null)).who;
  it("Sabin, Ayşe; two people", () => {
    for (const line of ["Bali'ye sabinle", "Bali'ye Sabin ile", "Bali'ye sabin ile", "Bali'ye Sabinle"]) expect(who(line)?.names, line).toEqual(["Sabin"]);
    for (const line of ["Ayşe'yle Bali", "ayşeyle Bali"]) expect(who(line)?.names, line).toEqual(["Ayşe"]);
    const { after } = first();
    expect(peopleCount(after.who)).toBe(2);
    expect(tr(() => whoText(after.who, null))).toBe("Sabin ile · 2 kişi");
    // The who question is answered: never asked.
    expect(after.who).not.toBeNull();
  });
  it("never a word that only looks like one", () => {
    expect(who("eşimle Bali")).toEqual({ kind: "partner", names: [] });
    for (const line of ["Bali'ye arabayla", "Bali'ye otobüsle", "hızla Bali'ye", "annemle Bali", "arkadaşınla Bali", "böyle Bali", "çocuklarla Bali", "Bali'ye 2 hafta ile"]) {
      expect(who(line)?.names ?? [], line).toEqual([]);
    }
  });
});

describe("a chip's next question in the model's words", () => {
  it("asked with what is known and the answer given; its question kept when it is one", async () => {
    const { after } = first();
    const month = applyAnswer(after, { q: "start", date: "2026-11-01", approx: true }, 3);
    expect(modelWordsQuestion(nextQuestion(month))).toBe(true);
    answer = { text: "", question: "Kasım güzel seçim; ayın başı mı, ortası mı, sonu mu, yoksa belli bir gün var mı?" };
    const q = await askNext({ today: TODAY, known: tr(() => knownLines(month, ctx)), answered: "start", label: "Kasım", next: "day", open: [], lang: "tr" });
    expect(q).toBe("Kasım güzel seçim; ayın başı mı, ortası mı, sonu mu, yoksa belli bir gün var mı?");
    expect(prompts[0].prompt).toContain("Kalınacak tek yer: Canggu");
    expect(prompts[0].prompt).toContain("Kimle: Sabin ile · 2 kişi");
    expect(prompts[0].prompt).toContain("başlangıç tarihi → Kasım");
    expect(prompts[0].prompt).toContain("Sıradaki soru: ayın hangi günü başlanacağı");
    expect(prompts[0].system).toContain("Yanıtı Türkçe yaz.");
    // No question, another language, a price: the code's line stands.
    for (const bad of ["", "Which day in November?", "Kasım'da 500 TL'ye uçuş var, hangi gün?"]) {
      answer = { text: "", question: bad };
      expect(await askNext({ today: TODAY, known: "", answered: "start", label: "Kasım", next: "day", lang: "tr" }), bad).toBeNull();
    }
  });
  it("never for the route, a trip kind's own question or a guess", () => {
    for (const q of ["route", "pb", "guess", "clash", "venue", null] as const) expect(modelWordsQuestion(q)).toBe(false);
    expect(tr(() => nextPrompt({ today: TODAY, known: "x", answered: "want", label: "Doğa", next: "who" }))).toMatch(/^<start_reply>[\s\S]*<\/start_reply>$/);
  });
});
