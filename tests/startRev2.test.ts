// tests/startRev2.test.ts — the start chat, revision 2 (2026-10-06 feedback): the chat speaks the language of its
// first message whatever the board's; an answer fills the question it answers ("İstanbul" to "Nereden?" never
// becomes the destination: the exact conversation that made an "Istanbul trip"); the most specific place wins and
// is read even misspelt ("Tayland Kohphandan"); a trip can be made with the destination alone; the model's reply is
// checked; what is prepared in the background (route, photos) belongs to one destination and its nights.
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, listItems, listMessages } from "../src/lib/db";
import { lang, setLang, withLang } from "../src/lib/i18n";
import { memoryKV } from "../src/lib/share/store";
import { runStep, stepsFor, wouldMake } from "../src/lib/startCreate";
import { getDraft, saveDraft } from "../src/lib/startDrafts";
import {
  acceptExtraction, acceptReply, acceptRoute, applyAnswer, applyText, bindToQuestion, canGenerate, checklist, creationOf, detectLang, editDistance,
  EMPTY_EXTRACTED, fuzzyPlaceOf, isComplete, knownLines, langSignal, mergeExtracted, missingInfo, modelReplyText, newStart, nextQuestion, parseStartText,
  photosToFind, preparedPhotos, preparedRoute, previewOf, questionOf, readyText, replyText, routeKey, routeToPrepare, saysWhereTo, turnPrompt, turnSystem,
  whereKey, withPhotos, withPreparedRoute, withTypedLang, type RawExtraction, type StartCtx, type StartRoute, type StartState,
} from "../src/lib/startTrip";

const TODAY = "2026-10-06";
const SENTENCE_TR = "Sabine ile beraber Tayland Kohphandan 1 ay 10 ocak civarları gitmeyi düşünüyorum";
const SENTENCE_EN = "Thinking of going to Koh Phangan, Thailand with Sabine around 10 January for a month";
const ctx: StartCtx = { myName: "Emre", fromGuess: "Istanbul", today: TODAY };

const raw = (over: Partial<RawExtraction> = {}): RawExtraction => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
});

/** One typed line as the start chat takes it: the language first, then the code's reading bound to the question, then the model's. */
function typed(s: StartState, text: string, model: RawExtraction | null = null, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const code = parseStartText(text, TODAY, q);
    const read = mergeExtracted(code, model ? acceptExtraction(model, TODAY) : null);
    const out = applyText(asked, text, read, at, q);
    return out.understood ? out.state : asked;
  });
}

/** "Evet" to the loose spelling asked back. */
const yes = (s: StartState) => withLang(s.lang, () => applyAnswer(s, { q: "guess", accept: true }, 3));
/** The owner's sentence without the model: "Kohphandan" is asked back ("Koh Phangan mı demek istedin?"), then "Evet". */
const opening = (id: string) => yes(typed(newStart(id, "plan", 1), SENTENCE_TR));

const ENGLISH = /\b(Got it|Where|people|nights|Great|sounds)\b/;

// The board is in English for these: the chat must not be.
beforeEach(() => setLang("en"));
afterEach(() => setLang("tr"));

describe("the chat's language (item 1)", () => {
  it("a Turkish first message on an English board: Turkish replies, questions, chips, checklist and title", () => {
    expect(lang()).toBe("en");
    expect(detectLang(SENTENCE_TR)).toBe("tr");
    expect(detectLang(SENTENCE_EN)).toBe("en");
    // A bare name says nothing: the board's language stands.
    expect(langSignal("Bali")).toBeNull();
    expect(detectLang("Lizbon", "tr")).toBe("tr");
    expect(langSignal("istanbuldan 2 hafta gitmek istiyoruz")).toBe("tr");
    const s0 = newStart("k1", "plan", 1);
    expect(s0.lang).toBe("en");
    const asked = typed(s0, SENTENCE_TR);
    expect(asked.lang).toBe("tr");
    expect(asked.langFixed).toBe(true);
    // The loose spelling asked back first, in Turkish, with its chips.
    const back = withLang(asked.lang, () => replyText(s0, asked, ctx));
    expect(back).toMatch(/Koh Phangan mı demek istedin\?$/);
    expect(back).not.toMatch(ENGLISH);
    expect(withLang(asked.lang, () => questionOf(asked, "guess", ctx)).chips.map((c) => c.label)).toEqual(["Evet", "Hayır, Kohphandan"]);
    const s1 = yes(asked);
    const reply = withLang(s1.lang, () => replyText(asked, s1, ctx));
    expect(reply).toMatch(/Nereden yola çıkıyorsun\?$/);
    expect(reply).toContain("Sabine ile Koh Phangan kulağa harika geliyor");
    expect(reply).not.toMatch(ENGLISH);
    const from = withLang(s1.lang, () => questionOf(s1, "from", ctx));
    // The English board's guess, said the Turkish way and only once.
    expect(from.chips.map((c) => c.label)).toEqual(["İstanbul", "Ankara", "İzmir", "Antalya"]);
    expect(withLang(s1.lang, () => checklist(s1, ctx).map((r) => r.label))).toEqual(["NEREYE", "NEREDEN", "KİMLE", "NE ZAMAN", "NE İSTİYORSUN", "ROTA"]);
    expect(withLang(s1.lang, () => creationOf(s1))!.title).toBe("Koh Phangan Gezisi");
    // The board's own language is untouched.
    expect(lang()).toBe("en");
    // Once decided, a later line in another language doesn't switch it.
    expect(withTypedLang(s1, "with my partner").lang).toBe("tr");
  });

  it("every model prompt of the start says which language to answer in", () => {
    expect(withLang("tr", turnSystem)).toMatch(/Yanıtı Türkçe yaz\.$/);
    expect(withLang("en", turnSystem)).toMatch(/Answer in English\.$/);
    const s = opening("k2");
    const prompt = withLang("tr", () => turnPrompt({ text: "İstanbul", today: TODAY, pending: "from", next: "want", known: knownLines(s, ctx) }));
    expect(prompt).toContain("Kullanıcının cevapladığı soru: nereden yola çıkılacağı (origin)");
    expect(prompt).toContain("Nereye: Koh Phangan (Tayland)");
    expect(prompt).toContain("Sıradaki soru: gezide ne istendiği");
  });

  it("the trip is written in the chat's language on an English board (title, records, the chat's last line)", async () => {
    let s = opening(`k3-${Math.random()}`);
    s = typed(s, "İstanbul", null, 3);
    for (const step of stepsFor(s, withLang(s.lang, () => creationOf(s))!)) {
      const { tripId } = await runStep(step.id, s, { provider: "gemini" });
      if (step.id === "trip") s = { ...s, tripId };
    }
    const trip = (await (await db()).get("trips", s.tripId!))!;
    expect(trip.title).toBe("Koh Phangan Gezisi");
    expect(trip.confirmedDates).toEqual({ start: "2027-01-10", end: "2027-02-10" });
    const items = await listItems(s.tripId!);
    expect(items.map((i) => i.name).sort()).toEqual(["Konaklama · Koh Phangan", "Uçuş · Koh Samui → İstanbul", "Uçuş · İstanbul → Koh Samui"]);
    expect(items.find((i) => i.category === "stay")?.countryCode).toBe("TH");
    const last = (await listMessages(s.tripId!)).at(-1)!;
    expect(last.text).toMatch(/^Koh Phangan Gezisi hazır: 31 gece, 1 durak\./);
    expect(last.text).toContain("Eksik kalanları buradan konuşalım: gezinin tarzı.");
    expect(lang()).toBe("en");
  });
});

describe("an answer fills the question it answers (item 2)", () => {
  it("the reported conversation, in Turkish: Koh Phangan stays the destination, İstanbul is where from", () => {
    const s0 = newStart("b1", "plan", 1);
    // With the model (it reads "Kohphandan" as Koh Phangan): nothing to ask back.
    const s1 = typed(s0, SENTENCE_TR, raw({ destination: "Koh Phangan", destination_country: "Tayland", destination_country_code: "TH", names: ["Sabine"] }));
    expect(s1.guess).toBeNull();
    expect(s1.where).toEqual({ place: "Koh Phangan", country: "Tayland", code: "TH" });
    expect(s1.who).toEqual({ kind: null, names: ["Sabine"] });
    expect(s1.start).toEqual({ date: "2027-01-10", approx: false });
    expect(s1.duration).toEqual({ unit: "month", n: 1 });
    expect(nextQuestion(s1)).toBe("from");
    // The model of the bug: it called "İstanbul" the destination and the origin both.
    const s2 = typed(s1, "İstanbul", raw({ destination: "İstanbul", destination_country: "Türkiye", destination_country_code: "TR", origin: "İstanbul" }), 3);
    expect(s2.where).toEqual({ place: "Koh Phangan", country: "Tayland", code: "TH" });
    expect(s2.from).toBe("İstanbul");
    // Without the model, and with a model that only says "destination".
    expect(typed(s1, "İstanbul", null, 3).where?.place).toBe("Koh Phangan");
    const onlyDest = typed(s1, "İstanbul", raw({ destination: "İstanbul" }), 3);
    expect([onlyDest.where?.place, onlyDest.from]).toEqual(["Koh Phangan", "İstanbul"]);
    // The route and its "Değiştir" come from the destination, never the origin.
    const change = applyAnswer(s2, { q: "route", action: "change" }, 4);
    expect(withLang("tr", () => questionOf(change, "route", ctx)).chips.map((c) => c.label)).toEqual(["Tek durak: Koh Phangan"]);
    const c = withLang("tr", () => creationOf(s2))!;
    expect(c.title).toBe("Koh Phangan Gezisi");
    expect(c.stays.map((x) => [x.city, x.date, x.end_date])).toEqual([["Koh Phangan", "2027-01-10", "2027-02-10"]]);
    expect(c.travel.map((x) => `${x.from}→${x.to}`)).toEqual(["İstanbul→Koh Samui", "Koh Samui→İstanbul"]);
    expect(c.countries).toEqual({ [Object.keys(c.countries)[0]]: { code: "TH", name: "Tayland" } });
  });

  it("the same conversation in English", () => {
    const s1 = typed(newStart("b2", "plan", 1), SENTENCE_EN);
    expect(s1.lang).toBe("en");
    expect(s1.where).toEqual({ place: "Koh Phangan", country: "Thailand", code: "TH" });
    expect(s1.who?.names).toEqual(["Sabine"]);
    expect(s1.start?.date).toBe("2027-01-10");
    expect(s1.duration).toEqual({ unit: "month", n: 1 });
    const s2 = typed(s1, "Istanbul", raw({ destination: "Istanbul", origin: "Istanbul" }), 3);
    expect([s2.where?.place, s2.from]).toEqual(["Koh Phangan", "Istanbul"]);
    const s3 = typed(s1, "London", null, 3);
    expect([s3.where?.place, s3.from]).toEqual(["Koh Phangan", "London"]);
    const reply = withLang("en", () => replyText(s1, s2, ctx));
    expect(reply).toMatch(/^Got it: from Istanbul\.|What are you after/);
    expect(withLang("en", () => creationOf(s2))!.title).toBe("Koh Phangan trip");
  });

  it("where changes only when the traveller says so; a place in the same country said more exactly refines it", () => {
    const s1 = opening("b3");
    // "Aslında Bali'ye gidelim" while "Nereden?" is asked: a change, said clearly.
    const bali = typed(s1, "Aslında Bali'ye gidelim", null, 3);
    expect(bali.where?.place).toBe("Bali");
    expect(bali.from).toBeNull();
    // A place said in passing changes nothing.
    const passing = bindToQuestion(s1, "Bangkok'ta bir gece kalırız", { ...EMPTY_EXTRACTED, where: { place: "Bangkok", country: "Tayland", code: "TH" } }, "want");
    expect(passing.where).toBeNull();
    // Thailand first, then Koh Phangan: the same country said more exactly.
    const thailand = typed(newStart("b4", "plan", 1), "Tayland'a gitmek istiyoruz");
    expect(thailand.where?.place).toBe("Tayland");
    const refined = bindToQuestion(thailand, "Koh Phangan", { ...EMPTY_EXTRACTED, where: { place: "Koh Phangan", country: "Tayland", code: "TH" } }, "from");
    expect(refined.where?.place).toBe("Koh Phangan");
    expect(saysWhereTo("İstanbul")).toBe(false);
    expect(saysWhereTo("let's go to Bali instead")).toBe(true);
  });

  it("places spelt loosely or with a Turkish ending typed on; never a different real country", () => {
    expect(editDistance("kohphandan", "kohphangan")).toBe(1);
    expect(fuzzyPlaceOf("Kohphandan")?.en).toBe("Koh Phangan");
    expect(fuzzyPlaceOf("Kophangan")?.en).toBe("Koh Phangan");
    expect(fuzzyPlaceOf("Ireland")).toBeNull();
    expect(fuzzyPlaceOf("Sabine")).toBeNull();
    expect(withLang("tr", () => parseStartText("Ko Pha-ngan", TODAY).where?.place)).toBe("Koh Phangan");
    expect(withLang("tr", () => parseStartText("istanbuldan Balide 2 hafta", TODAY))).toMatchObject({ from: "İstanbul", where: { place: "Bali" } });
    expect(withLang("tr", () => parseStartText("Koh Samui ve Koh Tao", TODAY).where?.place)).toBe("Koh Samui");
    // Answering "Nereden?", a bare known place is where from.
    expect(withLang("tr", () => parseStartText("İzmir", TODAY, "from"))).toMatchObject({ from: "İzmir", where: null });
  });

  it("a route through the origin is no route", () => {
    const stops = [{ city: "İstanbul", nights: 2, country_code: "TR" }, { city: "Koh Phangan", nights: 29, country_code: "TH" }];
    expect(acceptRoute({ stops, arrival_airport_city: "", departure_airport_city: "" }, 31, "İstanbul")).toBeNull();
    expect(acceptRoute({ stops, arrival_airport_city: "", departure_airport_city: "" }, 31, null)).not.toBeNull();
  });
});

describe("always generatable (item 4)", () => {
  it("the destination alone makes a trip; the label says it's for now until the list is full", () => {
    const s = typed(newStart("g1", "plan", 1), "Kohphangan'a gidelim");
    expect(s.where?.place).toBe("Koh Phangan");
    expect(s.lang).toBe("tr");
    expect(canGenerate(s)).toBe(true);
    expect(isComplete(s)).toBe(false);
    expect(withLang("tr", () => missingInfo(s))).toEqual(["nereden", "kimle", "ne zaman", "gezinin tarzı"]);
    const c = withLang("tr", () => creationOf(s))!;
    expect(c.dates).toBeNull();
    expect(withLang("tr", () => readyText(c, ["ne zaman"]))).toBe("Koh Phangan Gezisi hazır. Tarihleri söyleyince geceleri ve uçuşları yerleştiririm. Eksik kalanları buradan konuşalım: ne zaman.");
    expect(withLang("tr", () => stepsFor(s, c)).find((x) => x.id === "route")?.done).toBe("Koh Phangan'a konaklama yeri açıldı; geceler tarihle gelir");
  });

  it("the trip without dates is made: undated stay and flights, no dates on the trip", async () => {
    let s = typed(newStart(`g2-${Math.random()}`, "plan", 1), "Tayland'a gitmek istiyoruz");
    for (const step of stepsFor(s, withLang(s.lang, () => creationOf(s))!)) {
      const { tripId } = await runStep(step.id, s, { provider: "gemini" });
      if (step.id === "trip") s = { ...s, tripId };
    }
    const trip = (await (await db()).get("trips", s.tripId!))!;
    expect(trip.confirmedDates).toBeNull();
    const items = await listItems(s.tripId!);
    // No origin and no day: the flight there to fill, the stay undated; no flight home to nowhere.
    expect(items.map((i) => [i.category, i.dates.start, i.city ?? i.flight?.to]).sort()).toEqual([["flight", null, "Tayland"], ["stay", null, "Tayland"]]);
  });

  it("the preview: stops and nights, dates, who, the flights to the island's airport", () => {
    let s = opening("g3");
    s = typed(s, "İstanbul", null, 3);
    const p = withLang("tr", () => previewOf(s, ctx))!;
    expect(p.stops).toEqual([{ city: "Koh Phangan", nights: 31 }]);
    expect(p.when).toBe("10 Ocak – 10 Şubat · 31 gece");
    expect(p.people).toBe("Emre & Sabine · 2 kişi");
    expect(p.flights).toBe("İstanbul ⇄ Koh Samui");
    expect(p.country).toEqual({ code: "TH", name: "Tayland" });
  });
});

describe("the model's reply (item 5)", () => {
  it("kept only when it holds: short, no prices, no bookings, in the chat's language, a real question", () => {
    expect(acceptReply({ text: "Sabine ile Koh Phangan harika: palmiyeli koylar.", question: "Nereden yola çıkıyorsunuz?" }, "tr")).toEqual({
      text: "Sabine ile Koh Phangan harika: palmiyeli koylar.",
      question: "Nereden yola çıkıyorsunuz?",
    });
    expect(acceptReply({ text: "x".repeat(221), question: "" }, "tr")).toBeNull();
    expect(acceptReply({ text: "Uçuşlar 450 € civarı, harika.", question: "" }, "tr")).toBeNull();
    expect(acceptReply({ text: "Great, I've booked your hotel.", question: "" }, "en")).toBeNull();
    expect(acceptReply({ text: "Thailand with Sabine sounds incredible.", question: "Where from?" }, "tr")).toBeNull();
    expect(acceptReply({ text: "Leaving from İstanbul, lovely.", question: "Who's coming" }, "en")).toEqual({ text: "Leaving from İstanbul, lovely.", question: null });
  });

  it("its question only for the question the code asks next; the route and a guessed day are always the code's", () => {
    const s1 = opening("m1");
    const s2 = typed(s1, "İstanbul", null, 3);
    const reply = { text: "İstanbul'dan Koh Phangan'a uzun ama güzel bir yol.", question: "Bu gezide en çok ne arıyorsunuz?" };
    expect(withLang("tr", () => modelReplyText(s1, s2, ctx, reply, "want"))).toBe(`${reply.text}\n${reply.question}`);
    // Told another question: its line, the code's question.
    expect(withLang("tr", () => modelReplyText(s1, s2, ctx, reply, "who"))).toBe(`${reply.text}\nBu gezide en çok ne istiyorsun? (birden çok seçebilirsin)`);
    const route: StartRoute = { stops: [{ city: "Koh Phangan", nights: 31 }], arrive: null, leave: null, confirmed: false, source: "single" };
    const atRoute = { ...applyAnswer(s2, { q: "want", styles: ["calm"], budget: null }, 4), route };
    expect(withLang("tr", () => modelReplyText(s2, atRoute, ctx, reply, "route"))).toBe(withLang("tr", () => replyText(s2, atRoute, ctx)));
  });
});

describe("prepared while chatting (item 7)", () => {
  const route = (stops: [string, number][]): StartRoute => ({ stops: stops.map(([city, nights]) => ({ city, nights, code: "TH" })), arrive: "Koh Samui", leave: "Koh Samui", confirmed: false, source: "ai" });

  it("the route is asked once the place and nights are settled, once per place and nights", () => {
    const monthOnly = typed(newStart("p1", "plan", 1), "Koh Phangan 1 ay");
    // A month is 28 to 31 nights: it waits for the start.
    expect(routeToPrepare(monthOnly)).toBeNull();
    const s = opening("p2");
    const key = routeToPrepare(s)!;
    expect(key).toBe(routeKey(s));
    expect(key).toMatch(/^kohphangan\|TH\|31$/);
    const kept = withPreparedRoute(s, key, route([["Koh Phangan", 21], ["Koh Samui", 10]]));
    expect(kept.route?.stops.map((x) => x.city)).toEqual(["Koh Phangan", "Koh Samui"]);
    expect(kept.route?.confirmed).toBe(false);
    expect(routeToPrepare(kept)).toBeNull();
    expect(preparedRoute(kept)?.stops).toHaveLength(2);
    // A city is one stop: never asked.
    expect(routeToPrepare(typed(newStart("p3", "plan", 1), "Porto 10 Aralık'tan 1 hafta"))).toBeNull();
  });

  it("changing where drops the prepared route and photos; coming back brings the route back without asking again", () => {
    const s = opening("p4");
    const key = routeToPrepare(s)!;
    let kept = withPreparedRoute(s, key, route([["Koh Phangan", 21], ["Koh Samui", 10]]));
    kept = withPhotos(kept, whereKey(kept)!, { "Koh Phangan": "https://img.test/kp.jpg", Tayland: null });
    expect(preparedPhotos(kept)).toEqual([{ place: "Koh Phangan", url: "https://img.test/kp.jpg" }]);
    expect(photosToFind(kept)).toEqual(["Koh Samui"]);
    const bali = typed(kept, "Aslında Bali'ye gidelim", null, 3);
    expect(bali.where?.place).toBe("Bali");
    // Koh Phangan's route is gone; Bali's classic circuit is proposed at once (rev 3), the model still asked.
    expect(bali.route?.source).toBe("circuit");
    expect(bali.prepared.photos).toBeNull();
    expect(preparedPhotos(bali)).toEqual([]);
    expect(routeToPrepare(bali)).toBe("bali|ID|31");
    expect(photosToFind(bali)).toEqual(["Bali", "Ubud", "Sidemen", "Canggu"]);
    // Photos found for Koh Phangan after the change are not Bali's.
    expect(withPhotos(bali, whereKey(kept)!, { "Koh Phangan": "https://img.test/late.jpg" })).toBe(bali);
    const back = typed(bali, "Aslında Koh Phangan'a gidelim", null, 4);
    expect(back.route?.stops.map((x) => x.city)).toEqual(["Koh Phangan", "Koh Samui"]);
    expect(routeToPrepare(back)).toBeNull();
  });

  it("what Oluştur would write is worked out in memory only, in the chat's language", async () => {
    const s = typed(opening("p5"), "İstanbul", null, 3);
    const before = (await (await db()).getAll("trips")).length;
    const made = wouldMake(s)!;
    expect(made.trip.title).toBe("Koh Phangan Gezisi");
    expect(made.items.map((i) => i.name).sort()).toEqual(["Konaklama · Koh Phangan", "Uçuş · Koh Samui → İstanbul", "Uçuş · İstanbul → Koh Samui"]);
    expect((await (await db()).getAll("trips")).length).toBe(before);
  });

  it("a draft keeps its language and what was prepared; an old draft gets the board's language and nothing prepared", async () => {
    const kv = memoryKV();
    const s = withPhotos(opening("d1"), "kohphangan|TH", { "Koh Phangan": "https://img.test/kp.jpg" });
    await saveDraft(s, kv);
    const back = (await getDraft("d1", kv))!;
    expect(back.lang).toBe("tr");
    expect(back.prepared.photos?.urls).toEqual({ "Koh Phangan": "https://img.test/kp.jpg" });
    const old = { ...s, id: "d2" } as Partial<StartState>;
    delete old.lang;
    delete old.prepared;
    delete old.langFixed;
    await saveDraft(old as StartState, kv);
    const oldBack = (await getDraft("d2", kv))!;
    expect(oldBack.lang).toBe("en");
    expect(oldBack.prepared).toEqual({ photos: null, routes: {}, rules: null });
  });
});
