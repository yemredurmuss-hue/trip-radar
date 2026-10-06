// tests/playbooks.test.ts — Niyet oyun kitapları (spec 2026-10-06-niyet-planlayici §2): a festival, a ski trip, a
// honeymoon and a wellness retreat each open their own cards, keep their suggestions to the kind and add their
// preparation list; a classic trip is made exactly as before.
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, listItems } from "../src/lib/db";
import { setLang, withLang } from "../src/lib/i18n";
import { isPrep } from "../src/lib/prep";
import { allowedSuggestions, playbookFor, playbookPromptLine, playbookQuestions, startPlaybook } from "../src/lib/playbooks";
import { playbookCards, runStep, stepsFor, wouldMake } from "../src/lib/startCreate";
import { acceptExtraction, applyAnswer, applyText, creationOf, isPlaceholder, knownLines, mergeExtracted, newStart, nextQuestion, parseStartText, withTypedLang, type RawExtraction, type StartState } from "../src/lib/startTrip";
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
    expect(ticket).toMatchObject({ category: "activity", city: "Ozora", dates: { start: "2027-07-27", end: "2027-08-02" }, statusNote: "Resmî site: https://ozorafestival.eu" });
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
