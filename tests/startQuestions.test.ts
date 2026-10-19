// tests/startQuestions.test.ts — 0.38.4: the start chat asks like a person, not a form. The model's own question for
// what is missing next is used (the code's line only stands without it); the code's own questions are warmer, to
// this person and this trip; the checklist's labels are never all capitals.
import { describe, expect, it } from "vitest";
import { withLang } from "../src/lib/i18n";
import {
  applyAnswer, assumeAnswered, checklist, modelReplyText, newStart, nextQuestion, questionOf, skip, stillOpen, turnPrompt, turnSystem,
  type QuestionId, type StartCtx, type StartState,
} from "../src/lib/startTrip";

const TODAY = "2026-10-19";
const ctx: StartCtx = { myName: "Emre", fromGuess: "İstanbul", today: TODAY };
const tr = <T>(f: () => T) => withLang("tr", f);
const en = <T>(f: () => T) => withLang("en", f);

/** Emre's trip: Ahangama (Sri Lanka), with Sabine, 2 weeks in November; the style and the route left aside. */
function ahangama(): StartState {
  let s = newStart("s1", "plan", 1, "tr");
  s = tr(() => applyAnswer(s, { q: "where", place: "Ahangama", country: "Sri Lanka" }, 2));
  return s;
}
const withSabine = (s: StartState) => ({ ...s, who: { kind: "partner" as const, names: ["Sabine"] } });
const ALL_CAPS = /^[^a-zçğıöşü]*[A-ZÇĞİÖŞÜ]{3,}[^a-zçğıöşü]*$/;

describe("the code's own questions read like a person asking", () => {
  it("names the trip and the person: never a bare 'Nereden?' or 'Kaç kişi?'", () => {
    const s = ahangama();
    const ask = (st: StartState, q: QuestionId) => tr(() => questionOf(st, q, ctx).text);
    expect(ask(s, "duration")).toBe("Ahangama'da kaç gün kalmak istersin?");
    expect(ask(s, "who")).toBe("Ahangama'ya kimle gidiyorsun?");
    expect(ask(s, "from")).toBe("Ahangama'ya nereden yola çıkıyorsun?");
    expect(ask(s, "start")).toBe("Ne zaman yola çıkmayı düşünüyorsun?");
    // Sabine comes too: "siz".
    expect(ask(withSabine(s), "from")).toBe("Ahangama'ya nereden yola çıkıyorsunuz?");
    expect(ask(withSabine(s), "duration")).toBe("Ahangama'da kaç gün kalmak istersiniz?");
    expect(ask(withSabine(s), "start")).toBe("Ne zaman yola çıkmayı düşünüyorsunuz?");
    // A group of friends or the family: how many, said as one would.
    expect(ask({ ...s, who: { kind: "friends", names: [] } }, "count")).toBe("Kaç kişisiniz, sen de dahil?");
    expect(ask({ ...s, who: { kind: "family", names: [] } }, "count")).toBe("Ailece kaç kişisiniz, sen de dahil?");
    // Nothing known yet: still a sentence.
    const none = newStart("s0", "plan", 1, "tr");
    expect(ask(none, "from")).toBe("Nereden yola çıkıyorsun?");
    expect(ask(none, "duration")).toBe("Kaç gün sürsün?");
  });
  it("an event is named with 'için' (its possessive ending never gets a wrong suffix)", () => {
    const s: StartState = { ...ahangama(), intent: { kind: "event", name: "Ozora Festivali", place: "Ozora" } as StartState["intent"] };
    expect(tr(() => questionOf(s, "from", ctx).text)).toBe("Ozora Festivali için nereden yola çıkıyorsun?");
    expect(tr(() => questionOf(s, "who", ctx).text)).toBe("Ozora Festivali için kimle gidiyorsun?");
  });
  it("the same in English, natural; no long dash, no all capitals in either language", () => {
    const s = withSabine(ahangama());
    expect(en(() => questionOf(s, "from", ctx).text)).toBe("Where are you setting off for Ahangama from?");
    expect(en(() => questionOf(s, "duration", ctx).text)).toBe("How long would you like to stay in Ahangama?");
    expect(en(() => questionOf(ahangama(), "who", ctx).text)).toBe("Who's coming with you to Ahangama?");
    for (const q of ["where", "from", "who", "duration", "start", "want"] as QuestionId[]) {
      for (const l of [tr, en]) {
        const text = l(() => questionOf(s, q, ctx).text);
        expect(text).not.toMatch(/—/);
        expect(text).not.toMatch(ALL_CAPS);
        expect(text.length).toBeGreaterThan(12);
      }
    }
  });
});

describe("the checklist's labels in normal case", () => {
  it("Nereye, Nereden… never NEREYE, NEREDEN", () => {
    const s = ahangama();
    expect(tr(() => checklist(s, ctx).map((r) => r.label))).toEqual(["Nereye", "Nereden", "Kimle", "Ne zaman", "Ne istiyorsun", "Rota"]);
    expect(en(() => checklist(s, ctx).map((r) => r.label))).toEqual(["Where to", "Where from", "Who's coming", "When", "What you're after", "Route"]);
  });
});

describe("the model's own question for what is missing next", () => {
  it("a message the code can't read: the model is told the question after the one answered, and its words stand", () => {
    // Ahangama known; the length asked; "iki haftalık bir kaçamak" read only by the model.
    const before = ahangama();
    expect(nextQuestion(before)).toBe("duration");
    const ahead = assumeAnswered(before, "duration");
    expect(nextQuestion(ahead)).toBe("start");
    // The model's reading: 2 weeks; its question asks the start, in its words.
    const after = tr(() => applyAnswer(before, { q: "duration", duration: { unit: "week", n: 2 } }, 3));
    expect(nextQuestion(after)).toBe("start");
    const reply = { text: "İki hafta Ahangama için tam kıvamında: sörf, palmiyeler ve sakin akşamlar.", question: "Kasım gibi mi düşünüyorsun, yoksa daha mı ileride?" };
    expect(tr(() => modelReplyText(before, after, ctx, reply, nextQuestion(ahead)))).toBe(`${reply.text}\n${reply.question}`);
    // (Before 0.38.4 it was told the question being answered, so the code's template always stood.)
    expect(tr(() => modelReplyText(before, after, ctx, reply, "duration"))).toBe(`${reply.text}\nNe zaman yola çıkmayı düşünüyorsun?`);
  });
  it("a reading that answers more than asked: the code's question, never one about something already known", () => {
    const before = ahangama();
    const ahead = nextQuestion(assumeAnswered(before, "duration"));
    let after = tr(() => applyAnswer(before, { q: "duration", duration: { unit: "week", n: 2 } }, 3));
    after = tr(() => applyAnswer(after, { q: "start", date: "2026-11-10", approx: false }, 4));
    const reply = { text: "Kasım Ahangama için güzel bir dönem.", question: "Ne zaman yola çıkıyorsunuz?" };
    const line = tr(() => modelReplyText(before, after, ctx, reply, ahead));
    expect(line.split("\n")[1]).toBe(tr(() => questionOf(after, nextQuestion(after)!, ctx).text));
  });
  it("the guess and a trip kind's question are taken as answered too", () => {
    const s = ahangama();
    const g: StartState = { ...s, where: null, guess: { place: { place: "Ahangama", country: "Sri Lanka" }, typed: "Ahangma", slot: "where" } as StartState["guess"] };
    expect(nextQuestion(g)).toBe("guess");
    expect(nextQuestion(assumeAnswered(g, "guess"))).not.toBe("guess");
    expect(assumeAnswered(s, null)).toBe(s);
  });
  it("the prompt lists what else is missing, so two can be asked in one sentence; the rules say not a form", () => {
    let s = ahangama();
    s = skip(s, "want", 3);
    const open = stillOpen(s);
    expect(nextQuestion(s)).toBe("duration");
    // The next one itself, the route and a trip kind's question are not in it; at most two.
    expect(open).toEqual(["start", "who"]);
    const prompt = tr(() => turnPrompt({ text: "Ahangama'ya gidiyorum", today: TODAY, pending: null, next: "duration", known: "Nereye: Ahangama", open }));
    expect(prompt).toContain("Sıradaki soru: kaç gün ya da gece");
    expect(prompt).toContain("Eksikler (önem sırasıyla): başlangıç tarihi; kimle gidileceği");
    expect(tr(() => turnPrompt({ text: "x", today: TODAY, pending: null, next: null, known: "" }))).not.toContain("Eksikler");
    const rules = tr(() => turnSystem(false));
    expect(rules).toContain("form gibi değil");
    expect(rules).toContain("en fazla iki şey");
    expect(en(() => turnSystem(false))).toContain("at most two things");
  });
});
