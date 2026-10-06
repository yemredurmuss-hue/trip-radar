// tests/startRev2Review.test.ts — the review of the start chat's revision 2: language weighed (no "ve" in "we've",
// names with Turkish letters say nothing), a change of mind at "Nereden?" is where to (never where from), the place
// marked "to" wins, loose spellings only for long names and always asked back, no model call for a chip, start calls
// aborted and never retried, a domestic route may pass through home, the chat's language kept on the trip (its chat
// and its suggestions), budget chips that don't repeat the style "Lüks", and an undated trip dated in its chat
// without duplicates.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { db, listItems } from "../src/lib/db";
import { setLang, withLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { geminiProvider } from "../src/lib/llm/gemini";
import { runStep, stepsFor } from "../src/lib/startCreate";
import {
  acceptExtraction, acceptReply, acceptRoute, applyAnswer, applyText, budgetChips, creationOf, EMPTY_EXTRACTED, fuzzyPlaceOf, isPlaceholder, langSignal,
  mergeExtracted, newStart, nextQuestion, parseStartText, questionOf, questionParticle, routeToPrepare, withTypedLang, wantText,
  type RawExtraction, type StartCtx, type StartState,
} from "../src/lib/startTrip";
import { withTimeout } from "../src/app/start/model";
import { z } from "zod";

const TODAY = "2026-10-06";
const ctx: StartCtx = { myName: null, fromGuess: null, today: TODAY };
const raw = (over: Partial<RawExtraction> = {}): RawExtraction => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
});
function typed(s: StartState, text: string, model: RawExtraction | null = null, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const read = mergeExtracted(parseStartText(text, TODAY, q), model ? acceptExtraction(model, TODAY) : null);
    const out = applyText(asked, text, read, at, q);
    return out.understood ? out.state : asked;
  });
}
/** Koh Phangan known, "Nereden?" asked, in the given language. */
function atFrom(l: "tr" | "en"): StartState {
  // (Rev 3 asks when before where from: the dates are known here.)
  const s = {
    ...newStart(`f-${l}`, "plan", 1, l), langFixed: true, where: { place: "Koh Phangan", country: l === "tr" ? "Tayland" : "Thailand", code: "TH" },
    duration: { unit: "night" as const, n: 5 }, start: { date: "2026-11-10", approx: false },
  };
  expect(nextQuestion(s)).toBe("from");
  return s;
}

beforeEach(() => setLang("en"));
afterEach(() => setLang("tr"));

describe("1. language, weighed", () => {
  it("English lines with an apostrophe or a Turkish name stay English; Turkish lines stay Turkish", () => {
    for (const line of ["I've always wanted to go to Bali", "we've got two weeks", "Going to Bali with Şule", "Flying from İstanbul in May"]) expect(langSignal(line), line).toBe("en");
    for (const line of ["Sabine ile beraber Tayland Kohphandan 1 ay 10 ocak civarları gitmeyi düşünüyorum", "Aslında Bali'ye gidelim", "Hayır, Roma", "istanbuldan 2 hafta gitmek istiyoruz"])
      expect(langSignal(line), line).toBe("tr");
    expect(langSignal("Bali")).toBeNull();
    expect(langSignal("İstanbul")).toBeNull();
  });
  it("an English reply with \"I've\" is kept", () => {
    expect(acceptReply({ text: "I've heard Koh Phangan's coves are lovely in January.", question: "Where are you leaving from?" }, "en")).toEqual({
      text: "I've heard Koh Phangan's coves are lovely in January.",
      question: "Where are you leaving from?",
    });
    expect(acceptReply({ text: "Koh Phangan çok güzel, ben de bayılırım.", question: "" }, "en")).toBeNull();
  });
});

describe("2. a change of mind at \"Nereden?\" is where to", () => {
  const cases: [string, "tr" | "en", RegExp][] = [
    ["Rome instead", "en", /^Rome$/],
    ["Make it Lisbon", "en", /^Lisbon$/],
    ["How about Rome?", "en", /^Rome$/],
    ["Hayır, Roma", "tr", /^Roma$/],
    ["Bali değil Roma", "tr", /^Roma$/],
    ["Romaya gidelim", "tr", /^Roma$/],
  ];
  for (const [line, l, place] of cases) {
    it(`"${line}" → where changes, where from untouched`, () => {
      const after = typed(atFrom(l), line);
      expect(after.where?.place).toMatch(place);
      expect(after.from).toBeNull();
      // Even when the model calls it the origin too.
      const withModel = typed(atFrom(l), line, raw({ origin: after.where!.place, destination: after.where!.place }));
      expect([withModel.where?.place, withModel.from]).toEqual([after.where?.place, null]);
    });
  }
  it("a plain answer is still where from", () => {
    expect(typed(atFrom("tr"), "İstanbul")).toMatchObject({ from: "İstanbul", where: { place: "Koh Phangan" } });
  });
});

describe("3. the place marked as where to wins", () => {
  const cases: [string, string, string | null][] = [
    ["Istanbul to Bali", "Bali", "Istanbul"],
    ["London to Tokyo", "Tokyo", "London"],
    ["I live in Berlin and want to go to Bali", "Bali", "Berlin"],
    ["İstanbul'dan Bali'ye", "Bali", "İstanbul"],
  ];
  for (const [line, where, from] of cases) {
    it(`"${line}" → ${where}`, () => {
      const l = langSignal(line) ?? "en";
      const e = withLang(l, () => parseStartText(line, TODAY));
      expect(e.where?.place).toBe(where);
      expect(e.whereSure).toBe(true);
      expect(e.from).toBe(withLang(l, () => from));
    });
  }
  it("an unmarked place gives way to the model's reading; a marked one doesn't", () => {
    const code = withLang("en", () => parseStartText("Thailand, maybe Bali", TODAY));
    expect(code.whereSure).toBe(false);
    const model = acceptExtraction(raw({ destination: "Koh Phangan", destination_country: "Thailand", destination_country_code: "TH" }), TODAY);
    expect(mergeExtracted(code, model).where?.place).toBe("Koh Phangan");
    const marked = withLang("en", () => parseStartText("Istanbul to Bali", TODAY));
    expect(mergeExtracted(marked, model).where?.place).toBe("Bali");
  });
});

describe("4. loose spellings: long names only, never beside a person, always asked back", () => {
  it("Antakya is not Antalya; Frances, Franco, Athena, Lyndon are no places", () => {
    expect(fuzzyPlaceOf("Antakya")).toBeNull();
    for (const w of ["Frances", "Franco", "Athena", "Lyndon"]) expect(fuzzyPlaceOf(w), w).toBeNull();
    expect(withLang("tr", () => parseStartText("Antakya'ya gidiyoruz", TODAY)).where).toBeNull();
    const people = withLang("en", () => parseStartText("Frances and I, with Athena and Lyndon", TODAY));
    expect([people.where, people.from, people.guess]).toEqual([null, null, undefined]);
  });
  it("never next to with / and / ile / &, never while who's coming is asked", () => {
    expect(withLang("tr", () => parseStartText("Kohphandan ile", TODAY)).guess).toBeUndefined();
    expect(withLang("en", () => parseStartText("Kohphandan & me", TODAY)).guess).toBeUndefined();
    expect(withLang("en", () => parseStartText("with Kohphandan", TODAY)).guess).toBeUndefined();
    expect(withLang("tr", () => parseStartText("Kohphandan", TODAY, "who")).guess).toBeUndefined();
    expect(withLang("tr", () => parseStartText("Kohphandan", TODAY, "names")).guess).toBeUndefined();
  });
  it("asked back: \"Koh Phangan mı demek istedin?\" [Evet] [Hayır, Kohphandan]; nothing taken before the answer", () => {
    const s = typed(newStart("g", "plan", 1, "tr"), "Kohphandan'a gidelim");
    expect(s.where).toBeNull();
    expect(s.guess).toMatchObject({ typed: "Kohphandan", place: { place: "Koh Phangan" }, slot: "where" });
    expect(nextQuestion(s)).toBe("guess");
    // Nothing prepared for a place not yet agreed.
    expect(routeToPrepare(s)).toBeNull();
    const q = withLang("tr", () => questionOf(s, "guess", ctx));
    expect(q.text).toBe("Koh Phangan mı demek istedin?");
    expect(q.chips.map((c) => c.label)).toEqual(["Evet", "Hayır, Kohphandan"]);
    expect(withLang("tr", () => applyAnswer(s, { q: "guess", accept: true }, 3)).where?.place).toBe("Koh Phangan");
    const no = withLang("tr", () => applyAnswer(s, { q: "guess", accept: false }, 3));
    expect([no.where?.place, no.guess]).toEqual(["Kohphandan", null]);
    expect(withLang("en", () => questionOf(s, "guess", ctx)).text).toBe("Did you mean Koh Phangan?");
    expect([questionParticle("Antalya"), questionParticle("Berlin"), questionParticle("Porto"), questionParticle("Köln")]).toEqual(["mı", "mi", "mu", "mü"]);
  });
  it("the model reading the same place: no asking back", () => {
    const s = typed(newStart("g2", "plan", 1, "tr"), "Kohphandan'a gidelim", raw({ destination: "Koh Phangan", destination_country: "Tayland", destination_country_code: "TH" }));
    expect([s.where?.place, s.guess]).toEqual(["Koh Phangan", null]);
    // As the chat does it: the code's reading first (asks back), the model's a moment later (the question goes).
    const line = "Sabine ile Tayland Kohphandan 1 ay 10 ocak";
    const start = withTypedLang(newStart("g3", "plan", 1, "en"), line);
    const code = withLang("tr", () => parseStartText(line, TODAY, "where"));
    const first = withLang("tr", () => applyText(start, line, code, 2, "where")).state;
    expect([first.where?.place, first.guess?.place.place, nextQuestion(first)]).toEqual(["Tayland", "Koh Phangan", "guess"]);
    const model = acceptExtraction(raw({ destination: "Koh Phangan", destination_country: "Tayland", destination_country_code: "TH" }), TODAY);
    const more = withLang("tr", () => applyText(first, line, mergeExtracted(code, model), 3, "where")).state;
    expect([more.where?.place, more.guess, nextQuestion(more)]).toEqual(["Koh Phangan", null, "from"]);
  });
});

describe("5. cost: start calls aborted on time, not retried", () => {
  it("Gemini: the signal reaches the request and maxRetries 0 means one try", async () => {
    const calls: unknown[] = [];
    const client = {
      models: {
        generateContent: async (params: { config?: { abortSignal?: AbortSignal } }) => {
          calls.push(params.config?.abortSignal);
          throw new ApiError({ message: "busy", status: 503 });
        },
      },
    };
    const controller = new AbortController();
    const gemini = geminiProvider(client as never, "gemini-test", 0);
    await expect(gemini.generateJson("s", "p", z.object({ a: z.string() }), [], { signal: controller.signal, maxRetries: 0 })).rejects.toThrow();
    expect(calls).toEqual([controller.signal]);
    // Elsewhere: the provider's default (one retry).
    calls.length = 0;
    await expect(gemini.generateJson("s", "p", z.object({ a: z.string() }))).rejects.toThrow();
    expect(calls).toHaveLength(2);
  });
  it("Claude: the signal and maxRetries go with the request", async () => {
    const seen: unknown[] = [];
    const client = {
      messages: {
        parse: async (_body: unknown, opts: unknown) => {
          seen.push(opts);
          return { stop_reason: "end_turn", parsed_output: { a: "x" } };
        },
      },
    } as unknown as Anthropic;
    const controller = new AbortController();
    await anthropicProvider(client, "claude-opus-5").generateJson("s", "p", z.object({ a: z.string() }), [], { signal: controller.signal, maxRetries: 0 });
    expect(seen).toEqual([{ signal: controller.signal, maxRetries: 0 }]);
  });
  it("too slow: rejected and the request aborted", async () => {
    const controller = new AbortController();
    await expect(withTimeout(new Promise(() => undefined), 10, controller)).rejects.toThrow("timeout");
    expect(controller.signal.aborted).toBe(true);
  });
});

describe("7. a route may pass through home on a trip at home, never abroad", () => {
  const stops = [{ city: "İstanbul", nights: 2, country_code: "TR" }, { city: "Bodrum", nights: 5, country_code: "TR" }];
  it("domestic: kept; abroad: refused", () => {
    expect(acceptRoute({ stops, arrival_airport_city: "", departure_airport_city: "" }, 7, "İstanbul", "TR")?.stops.map((x) => x.city)).toEqual(["İstanbul", "Bodrum"]);
    expect(acceptRoute({ stops, arrival_airport_city: "", departure_airport_city: "" }, 7, "İstanbul", "TH")).toBeNull();
    expect(acceptRoute({ stops, arrival_airport_city: "", departure_airport_city: "" }, 7, "İstanbul", null)).toBeNull();
  });
});

describe("budget chips don't repeat the style \"Lüks\"", () => {
  it("Ekonomik · Orta · Yüksek bütçe; Budget · Mid-range · High budget", () => {
    expect(withLang("tr", budgetChips).map(([, l]) => l)).toEqual(["Ekonomik", "Orta", "Yüksek bütçe"]);
    expect(withLang("en", budgetChips).map(([, l]) => l)).toEqual(["Budget", "Mid-range", "High budget"]);
    expect(withLang("tr", () => wantText({ styles: ["luxury"], budget: "high" }))).toBe("Lüks · Yüksek bütçe");
  });
});

// --- the trip in its chat: the language, and the dates said later ---------------------------------------------

function fakeClient(responses: Partial<Anthropic.Message>[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams) => {
        calls.push(structuredClone(params));
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        return next;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const tool = (id: string, name: string, input: Record<string, unknown>): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input, caller: { type: "direct" } }] as Anthropic.ContentBlock[],
});
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });

async function undatedTrip(id: string): Promise<string> {
  let s: StartState = { ...newStart(id, "plan", 1, "tr"), langFixed: true, where: { place: "Koh Phangan", country: "Tayland", code: "TH" }, from: "İstanbul" };
  for (const step of stepsFor(s, withLang("tr", () => creationOf(s))!).filter((x) => x.id !== "suggestions")) {
    const { tripId } = await runStep(step.id, s, { provider: "anthropic" });
    if (step.id === "trip") s = { ...s, tripId };
  }
  return s.tripId!;
}

describe("the trip keeps the chat's language; an undated trip is dated in its chat", () => {
  it("trip.lang is the conversation's: the board's chat answers in it on an English board", async () => {
    const tripId = await undatedTrip("lang-1");
    const trip = (await (await db()).get("trips", tripId))!;
    expect(trip.lang).toBe("tr");
    const { client, calls } = fakeClient([done("Tamam.")]);
    await sendMessage(tripId, "tarihleri sonra söylerim", anthropicProvider(client, "claude-opus-5"));
    expect(String(calls[0].system)).toMatch(/[çğışü]/);
    expect(JSON.stringify(calls[0].messages)).toContain('"conversation_language\\":\\"tr\\"');
  });

  it("dates said later in the chat date the start's places (no second stay or flights), still places to fill", async () => {
    const tripId = await undatedTrip("dated-1");
    const before = await listItems(tripId);
    expect(before.map((i) => [i.category, i.dates.start]).sort()).toEqual([["flight", null], ["flight", null], ["stay", null]]);
    const { client } = fakeClient([
      tool("t1", "update_trip", { title: "", start: "2027-01-10", end: "2027-02-10", budget_amount: null, budget_currency: "", budget_ceiling: null }),
      // The model says the stay again with its days: the same plan, not a second one.
      tool("t2", "plan_item", { kind: "stay", date: "2027-01-10", end_date: "2027-02-10", time: null, from: null, to: null, city: "Koh Phangan", title: null, booked: false, note: null }),
      done("Tarihleri yazdım."),
    ]);
    await sendMessage(tripId, "10 Ocak'tan 10 Şubat'a", anthropicProvider(client, "claude-opus-5"));
    const after = await listItems(tripId);
    const trip = (await (await db()).get("trips", tripId))!;
    expect(trip.confirmedDates).toEqual({ start: "2027-01-10", end: "2027-02-10" });
    expect(after.map((i) => [i.category, i.dates.start, i.dates.end, i.flight?.from ?? i.city]).sort()).toEqual([
      ["flight", "2027-01-10", null, "İstanbul"],
      ["flight", "2027-02-10", null, "Koh Samui"],
      ["stay", "2027-01-10", "2027-02-10", "Koh Phangan"],
    ]);
    expect(after.filter((i) => i.category === "flight").every((i) => isPlaceholder(trip, i))).toBe(true);
    expect(EMPTY_EXTRACTED.where).toBeNull();
  });
});
