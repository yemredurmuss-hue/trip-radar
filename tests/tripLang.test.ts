// The trip's own language (0.39.0, Emre: "İngilizce başladıysa başlık vs. İngilizce olsun"): a trip whose start chat
// began in English has an English title ("Bali Trip"), English places to fill ("Flight · …", "Stay · …"), an English
// chat and an English AI review, even on a Turkish board; one begun in Turkish stays Turkish.
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, listItems, listMessages } from "../src/lib/db";
import { L, lang, setLang, withLang } from "../src/lib/i18n";
import { packSystemPrompt } from "../src/lib/prepPack";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { applyText, creationOf, mergeExtracted, newStart, nextQuestion, parseStartText, questionOf, tripTitle, withTypedLang, type StartState } from "../src/lib/startTrip";

const systems: string[] = [];
vi.mock("../src/lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/llm")>()),
  // The review's model, never called for real: it answers nothing and keeps the system prompt it was given.
  getProvider: async () => ({
    generateJson: async (system: string) => {
      systems.push(system);
      return { suggestions: [] };
    },
  }),
}));

const TODAY = "2026-10-19";
const ctx = { myName: "Emre", fromGuess: null, today: TODAY };

/** One typed line as the start chat takes it (StartChat.send): the language first, then the code's reading. */
function typed(s: StartState, text: string, at: number): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const out = applyText(asked, text, mergeExtracted(parseStartText(text, TODAY, q), null), at, q);
    return out.understood ? out.state : asked;
  });
}

/** The start screen opened from the home's "Yeni gezi planla" on the board's language: the chip, then the first question. */
function opened(id: string): StartState {
  const s = newStart(id, "plan", 1);
  return { ...s, messages: [{ role: "user", text: withLang(s.lang, () => L("Yeni gezi planla", "Create a new trip")), at: 1 }, { role: "assistant", text: withLang(s.lang, () => questionOf(s, "where", ctx).text), at: 1 }] };
}

async function make(s: StartState): Promise<StartState> {
  for (const step of stepsFor(s, withLang(s.lang, () => creationOf(s))!)) {
    const { tripId } = await runStep(step.id, s, { provider: "gemini" });
    if (step.id === "trip") s = { ...s, tripId };
  }
  return s;
}

afterEach(() => setLang("tr"));

describe("the trip's language", () => {
  it("begun in English on a Turkish board: English title, places to fill, chat and review", async () => {
    setLang("tr");
    let s = typed(opened(`en-${Math.random()}`), "2 weeks in Bali with my wife in December", 2);
    expect(s.lang).toBe("en");
    // The lines said before the language was known are said again in it.
    expect(s.messages.map((m) => m.text)).toEqual(["Plan a new trip", "Where are we going?", "2 weeks in Bali with my wife in December"]);
    s = typed({ ...s, asking: "from" }, "Istanbul", 3);
    s = await make(s);
    const trip = (await (await db()).get("trips", s.tripId!))!;
    expect(trip.title).toBe("Bali Trip");
    expect(trip.lang).toBe("en");
    const names = (await listItems(s.tripId!)).map((i) => i.name).sort();
    expect(names).toEqual(["Flight · Denpasar → Istanbul", "Flight · Istanbul → Denpasar", "Stay · Bali"]);
    const chat = (await listMessages(s.tripId!)).map((m) => m.text).join("\n");
    expect(chat).toMatch(/^Plan a new trip\n/);
    expect(chat).toContain("Bali Trip is ready");
    expect(chat).not.toMatch(/Nereye|Yeni gezi|gece|hazır/);
    // The AI review (the start's last step registers it) is asked in English.
    const { reviewNewTrip } = await import("../src/app/start/registerReview");
    systems.length = 0;
    await reviewNewTrip(s.tripId!);
    expect(systems).toHaveLength(1);
    expect(systems[0]).toMatch(/English/);
    expect(systems[0]).not.toMatch(/Türkçe yaz/);
    // The packing list's prompt in the trip's language (usePackAi), whatever the board's.
    expect(withLang(trip.lang, packSystemPrompt)).toBe(withLang("en", packSystemPrompt));
    expect(lang()).toBe("tr");
  });

  it("begun in Turkish on an English board: all Turkish, as before", async () => {
    setLang("en");
    let s = typed(opened(`tr-${Math.random()}`), "Aralıkta eşimle 2 hafta Bali'ye gitmek istiyoruz", 2);
    expect(s.lang).toBe("tr");
    expect(s.messages.slice(0, 2).map((m) => m.text)).toEqual(["Yeni gezi planla", "Nereye gidiyoruz?"]);
    s = typed({ ...s, asking: "from" }, "İstanbul", 3);
    s = await make(s);
    const trip = (await (await db()).get("trips", s.tripId!))!;
    expect(trip.title).toBe("Bali Gezisi");
    expect(trip.lang).toBe("tr");
    const names = (await listItems(s.tripId!)).map((i) => i.name).sort();
    expect(names).toEqual(["Konaklama · Bali", "Uçuş · Denpasar → İstanbul", "Uçuş · İstanbul → Denpasar"]);
    expect(lang()).toBe("en");
  });

  it("a bare name doesn't decide, and the English title is title case", () => {
    setLang("tr");
    const s = typed(opened("bare"), "Bali", 2);
    expect(s.langFixed).toBe(false);
    expect(s.messages[1].text).toBe("Nereye gidiyoruz?");
    expect(withLang("en", () => tripTitle({ where: { place: "Sri Lanka", country: "Sri Lanka", code: "LK" }, intent: null }))).toBe("Sri Lanka Trip");
    expect(withLang("tr", () => tripTitle({ where: { place: "Sri Lanka", country: "Sri Lanka", code: "LK" }, intent: null }))).toBe("Sri Lanka Gezisi");
  });
});
