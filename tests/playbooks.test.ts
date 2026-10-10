// tests/playbooks.test.ts — Niyet oyun kitapları (spec 2026-10-06-niyet-planlayici §2): a festival, a ski trip, a
// honeymoon and a wellness retreat each open their own cards, keep their suggestions to the kind and add their
// preparation list; a classic trip is made exactly as before.
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, listItems } from "../src/lib/db";
import { setLang, withLang } from "../src/lib/i18n";
import { isPrep } from "../src/lib/prep";
import { allowedSuggestions, matchChip, moneyOf, playbookAsks, playbookFor, playbookPromptLine, playbookQuestions, startPlaybook, validEffect, validQuestion, validQuestions } from "../src/lib/playbooks";
import { playbookCards, runStep, stepsFor, wouldMake } from "../src/lib/startCreate";
import {
  acceptExtraction, applyAnswer, applyText, creationOf, essentialsDone, isPlaceholder, knownLines, mergeExtracted, newStart, nextQuestion, parseStartText, pbAsks, pbCurrent, pbPromptOf, questionOf, skip,
  withTypedLang, type RawExtraction, type StartState,
} from "../src/lib/startTrip";
import { acceptReview, reviewSystem } from "../src/lib/suggestReview";
import { ruleSuggestions } from "../src/lib/suggestions";
import type { Item, Suggestion } from "../src/lib/types";

const TODAY = "2026-10-06";

const raw = (over: Partial<RawExtraction>): RawExtraction => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
});

/** One typed line as the chat takes it: the code's reading, and the model's when given. */
function typed(s: StartState, text: string, model: Partial<RawExtraction> | null = null, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const read = mergeExtracted(parseStartText(text, TODAY, q), model ? acceptExtraction(raw(model), TODAY) : null);
    const out = applyText(asked, text, read, at, q);
    return out.understood ? out.state : asked;
  });
}

const titles = (items: Item[]) => items.map((i) => i.name);

/** Ozora as the model reads it (it isn't in the table): an event, its place, its dates. */
function ozora(): StartState {
  let s = typed(newStart("oz", "plan", 1, "tr"), "Ozora festivaline gitmek istiyorum", {
    event: "Ozora Festival", event_kind: "event", event_place: "Ozora", event_country_code: "HU", destination_country: "Macaristan", event_start: "2027-07-27", event_end: "2027-08-02",
  });
  s = { ...s, intent: { ...s.intent!, url: "https://ozorafestival.eu" } };
  s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
  return s;
}

beforeEach(() => setLang("tr"));
afterEach(() => setLang("tr"));

describe("which playbook", () => {
  it("reads the kind from the event and the words said, in Turkish or English", () => {
    expect(playbookFor({ kind: "event", name: "AfrikaBurn", id: "afrikaburn" })).toBe("festival");
    expect(playbookFor({ kind: "event", name: "Ozora Festival", id: null })).toBe("festival");
    expect(playbookFor(null, "Ozora festivaline gidiyoruz")).toBe("festival");
    expect(playbookFor(null, "Bulgaristan'da kayak")).toBe("ski");
    expect(playbookFor(null, "kayağa gidiyoruz, Bansko'da")).toBe("ski");
    expect(playbookFor(null, "ski trip to Bansko")).toBe("ski");
    expect(playbookFor(null, "Maldivler balayı")).toBe("honeymoon");
    expect(playbookFor(null, "our honeymoon in Bali")).toBe("honeymoon");
    expect(playbookFor(null, "İsveç'te wellness festivali")).toBe("wellness");
    expect(playbookFor({ kind: "event", name: "Wellness Festival", id: null }, "İsveç'te wellness festivali")).toBe("wellness");
    expect(playbookFor(null, "a yoga retreat in Ubud")).toBe("wellness");
  });
  it("leaves everything else classic: a city, the table's other events, kayaking, Spain", () => {
    expect(playbookFor(null, "İstanbul'dan Roma'ya 5 gün")).toBe("classic");
    expect(playbookFor({ kind: "event", name: "Oktoberfest", id: "oktoberfest" })).toBe("classic");
    expect(playbookFor({ kind: "event", name: "Formula 1 Belçika GP", id: "f1-belgium" }, "f1 spa")).toBe("classic");
    expect(playbookFor({ kind: "event", name: "Monaco Grand Prix", id: null })).toBe("classic");
    expect(playbookFor(null, "sea kayaking in Croatia")).toBe("classic");
    expect(playbookFor(null, "two weeks in Spain")).toBe("classic");
    // An event's own name says what it is: yoga at a burn is still a festival.
    expect(playbookFor({ kind: "event", name: "AfrikaBurn", id: "afrikaburn" }, "AfrikaBurn'de yoga yapacağız")).toBe("festival");
  });
  it("asks at most three questions, none on a classic trip", () => {
    expect(playbookQuestions("festival")).toEqual(["Kamp mı yapacaksın, otelde mi kalacaksın?", "Biletini aldın mı?", "Festivalden kaç gün önce gitmek istersin?"]);
    expect(playbookQuestions("ski").length).toBe(3);
    expect(playbookQuestions("classic")).toEqual([]);
  });
});

describe("Ozora: a festival", () => {
  it("opens the transfer to the site and the ticket on the festival's days with its site, and the festival list", () => {
    const s = ozora();
    expect(startPlaybook(s)).toBe("festival");
    const made = wouldMake(s)!;
    expect(made.trip.intent).toEqual({ playbook: "festival", name: "Ozora Festival", url: "https://ozorafestival.eu" });
    const transfer = made.items.find((i) => i.plannedKind === "transfer")!;
    expect(transfer).toMatchObject({ category: "transport", city: "Ozora" });
    const ticket = made.items.find((i) => i.name === "Festival bileti")!;
    expect(ticket).toMatchObject({ category: "activity", city: "Ozora", dates: { start: "2027-07-26", end: "2027-08-01" }, statusNote: "Resmî site: https://ozorafestival.eu" });
    const prep = made.items.filter(isPrep);
    expect(titles(prep)).toEqual(["Çadır", "Uyku tulumu", "Kafa lambası", "Nakit", "Kulak tıkacı"]);
  });
  it("suggests no tours or activities, from the rules or the AI review", () => {
    const tour: Suggestion = { key: "ai:activity:add:activity:douro-tekne-turu", section: "activity", kind: "add", title: "Douro tekne turu", why: "x", source: "ai", createdAt: 1, state: "open" };
    const boat: Suggestion = { ...tour, key: "ai:todo:boat", section: "todo", title: "Douro boat tour" };
    const insurance: Suggestion = { ...tour, key: "rule:insurance", section: "other", title: "Seyahat sigortası" };
    expect(allowedSuggestions("festival", [tour, boat, insurance])).toEqual([insurance]);
    expect(allowedSuggestions("classic", [tour, boat, insurance])).toEqual([tour, boat, insurance]);
    const answer = {
      suggestions: [
        { section: "activity", kind: "add", title: "Douro tekne turu", why: "Porto'dayken nehri görmek güzel olur.", template: "activity", city: "", start: "", end: "" },
        { section: "other", kind: "add", title: "Seyahat sigortası", why: "Planda sigorta yok.", template: "insurance", city: "", start: "", end: "" },
      ],
    };
    expect(acceptReview(answer, [], 1, "festival").added.map((x) => x.title)).toEqual(["Seyahat sigortası"]);
    expect(acceptReview(answer, [], 1).added.map((x) => x.title)).toEqual(["Douro tekne turu", "Seyahat sigortası"]);
    expect(reviewSystem("festival")).toContain("Tur, tekne turu");
    expect(reviewSystem()).not.toContain("Tur, tekne turu");
  });
  it("keeps the rules' suggestions to the kind too", () => {
    const made = wouldMake(ozora())!;
    const rules = ruleSuggestions({ trip: made.trip, plan: { range: null, stayBlocks: [] }, items: made.items, timeline: { entries: [] }, legs: [], mains: [], home: "TR", today: TODAY });
    expect(rules.some((r) => r.section === "activity")).toBe(false);
  });
  it("gives the model its tone and its tip, the tip until a line said it", () => {
    const s = ozora();
    const line = playbookPromptLine(s);
    expect(line).toContain("Gezi türü: festival");
    expect(line).toContain("Enerjik");
    expect(line).toContain("Çoğu kişi 1–2 gün erken gidip iyi kamp yeri kapıyor.");
    expect(withLang("tr", () => knownLines(s, { myName: null, fromGuess: null, today: TODAY }))).toContain("Gezi türü: festival");
    const said = { ...s, messages: [...s.messages, { role: "assistant" as const, text: "Ozora! Çoğu kişi 1–2 gün erken gidip iyi kamp yeri kapıyor.", at: 9 }] };
    expect(playbookPromptLine(said)).not.toContain("tavsiye");
    expect(playbookPromptLine(typed(newStart("r", "plan", 1, "tr"), "İstanbul'dan Roma'ya 5 gün"))).toBe("");
  });
  it("makes them for real, as places to fill, and a retry never doubles them", async () => {
    let s = ozora();
    for (const step of stepsFor(s, withLang(s.lang, () => creationOf(s))!)) {
      const { tripId } = await runStep(step.id, s, { provider: "gemini" });
      if (step.id === "trip") s = { ...s, tripId };
    }
    await runStep("route", s, { provider: "gemini" });
    await runStep("travel", s, { provider: "gemini" });
    const trip = (await (await db()).get("trips", s.tripId!))!;
    expect(trip.intent?.playbook).toBe("festival");
    const items = await listItems(trip.id);
    expect(items.filter((i) => i.name === "Festival bileti")).toHaveLength(1);
    expect(items.filter((i) => i.plannedKind === "transfer")).toHaveLength(1);
    expect(items.filter((i) => i.name === "Çadır")).toHaveLength(1);
    expect(isPlaceholder(trip, items.find((i) => i.name === "Festival bileti")!)).toBe(true);
    // The list is the traveller's to tick, not a place to fill.
    expect(isPlaceholder(trip, items.find((i) => i.name === "Çadır")!)).toBe(false);
  });
});

describe("a ski trip, a honeymoon, a retreat", () => {
  it("Bulgaristan'da kayak: the resort transfer, the pass, the equipment, the school; gloves on the list", () => {
    let s = typed(newStart("ski", "plan", 1, "tr"), "Bulgaristan'da kayak, 10 Ocak'tan 5 gün");
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    expect(startPlaybook(s)).toBe("ski");
    const made = wouldMake(s)!;
    expect(made.trip.intent).toEqual({ playbook: "ski" });
    expect(made.items.some((i) => i.plannedKind === "transfer")).toBe(true);
    expect(titles(made.items.filter((i) => i.category === "activity"))).toEqual(["Kayak pası", "Ekipman kiralama", "Kayak okulu"]);
    const pass = made.items.find((i) => i.name === "Kayak pası")!;
    expect(pass.dates).toMatchObject({ start: "2027-01-10", end: "2027-01-14" });
    expect(titles(made.items.filter(isPrep))).toContain("Eldiven");
  });
  it("Maldivler balayı: the seaplane or speedboat transfer, the resort, a spa, a private dinner, a dive", () => {
    let s = typed(newStart("hm", "plan", 1, "tr"), "Maldivler balayı, 3 Mart'tan 7 gece");
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    expect(startPlaybook(s)).toBe("honeymoon");
    const made = wouldMake(s)!;
    expect(made.items.find((i) => i.plannedKind === "transfer")?.name).toBe("Deniz uçağı ya da sürat teknesi transferi");
    expect(made.items.filter((i) => i.category === "stay")).toHaveLength(1);
    expect(titles(made.items.filter((i) => i.category === "activity"))).toEqual(["Çift spası", "Özel akşam yemeği", "Dalış"]);
  });
  it("İsveç'te wellness festivali: the programme block first, a quiet list, one activity suggested at most", () => {
    let s = typed(newStart("wl", "plan", 1, "tr"), "İsveç'te wellness festivali, 12 Haziran'dan 4 gün");
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    expect(startPlaybook(s)).toBe("wellness");
    const cards = withLang("tr", () => playbookCards(s, creationOf(s)!));
    expect(cards.plan.map((x) => x.title)).toEqual(["Wellness programı"]);
    expect(cards.prep.map((x) => x.title)).toContain("Yoga matı");
    const a: Suggestion = { key: "ai:a", section: "activity", kind: "add", title: "Sauna", why: "x", source: "ai", createdAt: 1, state: "open" };
    const b: Suggestion = { ...a, key: "ai:b", title: "Göl kenarında yürüyüş" };
    expect(allowedSuggestions("wellness", [a, b])).toEqual([a]);
    expect(allowedSuggestions("wellness", [b], [a])).toEqual([]);
  });
});

describe("a classic trip", () => {
  it("is made exactly as before: the stays and the flights, no intent, nothing more", () => {
    let s = typed(newStart("rome", "plan", 1, "tr"), "Roma'ya 10 Mayıs'tan 5 gün");
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    expect(startPlaybook(s)).toBe("classic");
    const made = wouldMake(s)!;
    expect("intent" in made.trip).toBe(false);
    expect(made.items.map((i) => i.category).sort()).toEqual(["flight", "flight", "stay"]);
    expect(withLang("tr", () => playbookCards(s, creationOf(s)!))).toEqual({ travel: [], plan: [], prep: [] });
  });
});

// --- the trip kind's own questions (2026-10-07): data, asked after the essentials, never holding the trip back -----

const ctx = { myName: null, fromGuess: null, today: TODAY };
/** A chip of the question on screen pressed (by its label). */
function chip(s: StartState, label: string): StartState {
  expect(nextQuestion(s)).toBe("pb");
  const c = withLang(s.lang, () => questionOf(s, "pb", ctx)).chips.find((x) => x.label === label);
  expect(c, label).toBeTruthy();
  return applyAnswer(s, c!.answer, 9);
}
const skipAll = (s: StartState): StartState => {
  while (nextQuestion(s) === "pb") s = skip(s, "pb", 9);
  return s;
};
/** Ozora, ten days, alone: the essentials in. */
const ozoraReady = () => applyAnswer(applyAnswer(ozora(), { q: "duration", duration: { unit: "day", n: 10 } }, 4), { q: "who", kind: "solo" }, 5);
const stays = (items: Item[]) => items.filter((i) => i.category === "stay").map((i) => `${i.city} ${i.dates.start}..${i.dates.end}`);

describe("the trip kind's questions", () => {
  it("come only after the essentials, one per turn, with their chips and Atla", () => {
    let s = ozora();
    expect(nextQuestion(s)).not.toBe("pb");
    expect(essentialsDone(s)).toBe(false);
    s = ozoraReady();
    expect(essentialsDone(s)).toBe(true);
    expect(nextQuestion(s)).toBe("pb");
    const q = withLang("tr", () => questionOf(s, "pb", ctx));
    expect(q.text).toBe("Kamp mı yapacaksın, otelde mi kalacaksın?");
    expect(q.chips.map((c) => c.label)).toEqual(["Kamp", "Otel"]);
    s = skip(s, "pb", 6);
    expect(withLang("tr", () => questionOf(s, "pb", ctx)).chips.map((c) => c.label)).toEqual(["Aldım", "Henüz değil"]);
    s = skip(s, "pb", 7);
    expect(withLang("tr", () => questionOf(s, "pb", ctx)).chips.map((c) => c.label)).toEqual(["1 gün", "2 gün", "Aynı gün"]);
    s = skip(s, "pb", 8);
    expect(nextQuestion(s)).toBe("want");
  });
  it("are never asked on a classic trip", () => {
    let s = typed(newStart("rome", "plan", 1, "tr"), "Roma'ya 10 Mayıs'tan 5 gün");
    s = applyAnswer(applyAnswer(s, { q: "from", city: "İstanbul" }, 3), { q: "who", kind: "solo" }, 4);
    expect(pbAsks(s)).toEqual([]);
    expect(nextQuestion(s)).toBe("want");
  });
  it("skipped, all of them: the trip made exactly as without them", () => {
    const s = ozoraReady();
    const plain = wouldMake(s, 1)!;
    const skipped = wouldMake(skipAll(s), 1)!;
    expect(skipped.items).toEqual(plain.items);
    expect(skipped.trip).toEqual(plain.trip);
  });
  it("Ozora + Kamp: no room for the festival's nights, a camping spot on the list; the ticket and transfer stay", () => {
    const s = ozoraReady();
    expect(stays(wouldMake(s)!.items).some((x) => x.startsWith("Ozora"))).toBe(true);
    const camp = chip(s, "Kamp");
    const made = wouldMake(camp)!;
    expect(stays(made.items).some((x) => x.startsWith("Ozora"))).toBe(false);
    expect(stays(made.items).length).toBeGreaterThan(0);
    expect(titles(made.items.filter(isPrep))).toContain("Kamp yeri ayır");
    expect(made.items.find((i) => i.name === "Festival bileti")).toBeTruthy();
    expect(made.items.find((i) => i.plannedKind === "transfer")).toMatchObject({ city: "Ozora", dates: { start: "2027-07-26" } });
    // Typed: "kamp yapacağız" is read by the code the same way.
    expect(stays(wouldMake(typed(s, "kamp yapacağız"))!.items)).toEqual(stays(made.items));
  });
  it("Otel keeps the stay by the site; the ticket bought is opened as booked, never a place to fill", () => {
    const s = chip(chip(ozoraReady(), "Otel"), "Aldım");
    const made = wouldMake(s)!;
    expect(stays(made.items).some((x) => x.startsWith("Ozora"))).toBe(true);
    expect(made.items.find((i) => i.name === "Festival bileti")?.status).toBe("booked");
  });
  it("'2 gün': the trip starts two days before the festival; 'Aynı gün' on its first day", () => {
    const base = skip(skip(ozoraReady(), "pb", 6), "pb", 7);
    const two = chip(base, "2 gün");
    expect(creationOf(two)!.dates?.start).toBe("2027-07-24");
    expect(creationOf(chip(base, "Aynı gün"))!.dates?.start).toBe("2027-07-26");
    // Just the festival said (its own 7 days): made long enough to hold the two days before it.
    const just = skip(skip(applyAnswer(applyAnswer(ozora(), { q: "duration", duration: { unit: "day", n: 7 } }, 4), { q: "who", kind: "solo" }, 5), "pb", 6), "pb", 7);
    expect(creationOf(chip(just, "2 gün"))!.dates).toEqual({ start: "2027-07-24", end: "2027-08-01" });
    // Typed "2 gün önce" answers the question, never the trip's length.
    const typedTwo = typed(base, "2 gün önce");
    expect(typedTwo.duration).toEqual(two.duration);
    expect(creationOf(typedTwo)!.dates).toEqual(creationOf(two)!.dates);
  });
  it("Bulgaristan'da kayak: 'orta seviye', 'bansko', 'Var': in Bansko, the school kept, no rental", () => {
    let s = typed(newStart("ski", "plan", 1, "tr"), "Bulgaristan'da kayak, 10 Ocak'tan 5 gün");
    s = applyAnswer(applyAnswer(s, { q: "from", city: "İstanbul" }, 3), { q: "who", kind: "solo" }, 4);
    expect(withLang("tr", () => questionOf(s, "pb", ctx)).chips.map((c) => c.label)).toEqual(["Başlangıç", "Orta", "İleri"]);
    s = typed(s, "orta seviye");
    expect(withLang("tr", () => questionOf(s, "pb", ctx)).chips.map((c) => c.label)).toEqual(["Bansko", "Borovets", "Pamporovo"]);
    s = typed(s, "bansko");
    s = chip(s, "Var");
    expect(nextQuestion(s)).toBe("want");
    const made = wouldMake(s)!;
    expect(stays(made.items)).toEqual(["Bansko 2027-01-10..2027-01-14"]);
    expect(made.items.find((i) => i.category === "stay")?.countryCode).toBe("BG");
    expect(made.items.find((i) => i.name === "Kayak pası")?.city).toBe("Bansko");
    expect(made.items.find((i) => i.plannedKind === "transfer")?.city).toBe("Bansko");
    expect(titles(made.items.filter((i) => i.category === "activity"))).toEqual(["Kayak pası", "Kayak okulu"]);
  });
  it("ski 'İleri' drops the school; a resort said as the destination isn't asked which resort", () => {
    let s = typed(newStart("ski2", "plan", 1, "tr"), "Bansko'da kayak, 10 Ocak'tan 5 gün");
    if (!s.where) s = applyAnswer(s, { q: "where", place: "Bansko", country: "Bulgaristan", code: "BG" }, 2);
    s = applyAnswer(applyAnswer(s, { q: "from", city: "İstanbul" }, 3), { q: "who", kind: "solo" }, 4);
    s = chip(s, "İleri");
    expect(withLang("tr", () => questionOf(s, "pb", ctx)).text).toBe("Ekipmanın var mı, yoksa kiralayacak mısın?");
    s = chip(s, "Kiralayacağım");
    expect(titles(wouldMake(s)!.items.filter((i) => i.category === "activity"))).toEqual(["Kayak pası", "Ekipman kiralama"]);
  });
  it("Maldivler balayı: '8000 euro' is the budget, 'İki resort' two stays splitting the nights", () => {
    let s = typed(newStart("hm", "plan", 1, "tr"), "Maldivler balayı, 3 Mart'tan 7 gece");
    s = applyAnswer(applyAnswer(s, { q: "from", city: "İstanbul" }, 3), { q: "who", kind: "partner" }, 4);
    expect(withLang("tr", () => questionOf(s, "pb", ctx)).chips.map((c) => c.label)).toEqual(["3.000 €", "6.000 €", "10.000 €"]);
    s = typed(s, "8000 euro civarı");
    s = chip(s, "İki resort");
    const made = wouldMake(s)!;
    expect(made.trip.budget).toEqual({ amount: 8000, currency: "EUR" });
    expect(stays(made.items)).toEqual(["Maldivler 2027-03-03..2027-03-07", "Maldivler 2027-03-07..2027-03-10"]);
  });
  it("a typed answer the code can't place goes to the model's pick among the options, bound to that question", () => {
    const s = ozoraReady();
    const key = pbCurrent(s)!.key;
    const read = { ...parseStartText("bir şeyler ayarlarız", TODAY, "pb"), choice: "hotel" };
    const out = applyText(s, "bir şeyler ayarlarız", read, 9, "pb", key);
    expect(out.understood).toBe(true);
    expect(out.state.pbAnswers).toEqual({ [key]: "hotel" });
    // The same reading landing late answers that question only, never the next one.
    expect(applyText(out.state, "bir şeyler ayarlarız", { ...read, choice: "have" }, 10, "pb", key).understood).toBe(false);
    // "skip" from the model: no answer, asked no more; a value not among the options: nothing.
    expect(applyText(s, "bilmem", { ...read, choice: "skip" }, 9, "pb", key).state.pbAnswers).toEqual({ [key]: null });
    expect(applyText(s, "bilmem", { ...read, choice: "yacht" }, 9, "pb", key).understood).toBe(false);
    // The model is given the question with its options.
    expect(withLang("tr", () => pbPromptOf(s, key))).toBe('"Kamp mı yapacaksın, otelde mi kalacaksın?" (seçenekler: camp = Kamp; hotel = Otel)');
  });
  it("the validator drops a malformed question or an unknown operation, never crashes", () => {
    expect(validEffect({ op: "teleport", to: "Mars" })).toBeNull();
    expect(validEffect({ op: "splitStay", n: 9 })).toBeNull();
    expect(validEffect({ op: "setBudget", amount: 5000, currency: "EUR" })).toEqual({ op: "setBudget", amount: 5000, currency: "EUR" });
    expect(validQuestion({ id: "x" })).toBeNull();
    expect(validQuestion(null)).toBeNull();
    const raw = { id: "x", text: { tr: "Soru?" }, chips: [{ value: "a", label: { en: "A" }, effects: [{ op: "nope" }, { op: "dropCard", card: "pass" }] }, "junk"] };
    expect(validQuestion({ ...raw, askIf: "full moon" })).toBeNull();
    const ok = validQuestion(raw)!;
    expect(ok).toEqual({ id: "x", text: { tr: "Soru?", en: "Soru?" }, chips: [{ value: "a", label: { tr: "A", en: "A" }, effects: [{ op: "dropCard", card: "pass" }] }] });
    expect(validQuestions([ok, ok, { bad: 1 }, { ...ok, id: "y" }, { ...ok, id: "z" }, { ...ok, id: "w" }]).map((q) => q.id)).toEqual(["x", "y", "z"]);
  });
  it("reads the obvious answers by their words, Turkish endings and money included", () => {
    const [stay] = playbookAsks("festival");
    expect(matchChip(stay.chips, "otelde kalırım")?.value).toBe("hotel");
    expect(matchChip(stay.chips, "Kampta")?.value).toBe("camp");
    expect(matchChip(stay.chips, "kamp değil otel")).toBeNull();
    expect(moneyOf("5.000 €")).toEqual({ amount: 5000, currency: "EUR" });
    expect(moneyOf("150 bin TL")).toEqual({ amount: 150000, currency: "TRY" });
    expect(moneyOf("2 kişi 5000 euro")).toEqual({ amount: 5000, currency: "EUR" });
    expect(moneyOf("5 gün")).toBeNull();
  });
});
