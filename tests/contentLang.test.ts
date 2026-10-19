// What the AI writes is in the board's language at the time (0.39.1, Emre: "Dili İngilizce yapmama rağmen AI tavsiyeleri
// Türkçe gelmiş. Packing de aynı şekilde"). His Bali Gezisi was begun in Turkish (trip.lang "tr"); his board is English.
// The review, the Bavul's list and the mood sentence are asked in English, and what they wrote in Turkish before (still
// open, untouched) is written again in English once; what he put on the plan or dismissed stays.
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentLang, contentTag, setLang } from "../src/lib/i18n";
import { moodKey } from "../src/lib/heroText";
import type { LlmProvider } from "../src/lib/llm";
import { packListLang, packRedo } from "../src/lib/prepPack";
import { acceptReview, REVIEW_CHANGE_MS, reviewDue, reviewKey, reviewPrompt, runReview, staleLang, suggestionLang, type ReviewAnswer } from "../src/lib/suggestReview";
import type { PackList, Suggestion, Trip } from "../src/lib/types";

afterEach(() => setLang("tr"));

const range = { start: "2026-12-10", end: "2027-01-10" };
const bali = [{ name: "Canggu" }, { name: "Mengwi" }, { name: "Tabanan" }];

/** What Emre's board showed: the earlier review's cards in Turkish (stored before 0.39.1: no lang). */
const old = (over: Partial<Suggestion>): Suggestion => ({
  key: `ai:${over.title}`, section: "todo", kind: "add", title: "Nusa Penida", why: "Canggu'dan tekneyle gidilen adada manzara noktaları var.", source: "ai",
  template: "todo", createdAt: 1, state: "open", ...over,
});
const stored: Suggestion[] = [
  old({ title: "Nusa Penida" }),
  old({ title: "Echo Beach", section: "food", template: "food", why: "Canggu'da akşam deniz mahsulleri yenir." }),
  old({ title: "Yağmur sezonu", section: "other", kind: "warning", template: undefined, why: "Aralık ve ocak Bali'de yağmur sezonudur." }),
  old({ title: "Tanah Lot Tapınağı", state: "added", why: "Tabanan'da gün batımında görülür." }),
  old({ title: "Seyahat sigortası", section: "other", template: "insurance", state: "dismissed", why: "Planda sigorta yok." }),
  { key: "rule:esim", section: "other", kind: "add", title: "eSIM", why: "Planda eSIM yok.", source: "rule", template: "esim", createdAt: 1, state: "open" },
];
const english: ReviewAnswer = {
  suggestions: [
    { section: "todo", kind: "add", title: "Nusa Penida", why: "The island is a boat ride from Canggu and has famous viewpoints.", template: "todo", city: "Canggu", start: "", end: "", place: "Nusa Penida, Bali" },
    { section: "other", kind: "warning", title: "Rainy season", why: "December and January are the rainy season in Bali.", template: "", city: "", start: "", end: "" },
  ],
};

describe("the board's language, whatever the trip's", () => {
  it("contentLang: the board's once it's known; the trip's only before", () => {
    // Nothing set yet in this file: the board's language isn't known, the trip's stands in.
    expect(contentLang("en")).toBe("en");
    expect(contentLang(null)).toBe("tr");
    setLang("en");
    expect(contentLang("tr")).toBe("en");
    setLang("tr");
    expect(contentLang("en")).toBe("tr");
  });

  it("the key's language part: none when it's the language written before (the trip's, else Turkish)", () => {
    expect(contentTag("tr", "tr")).toBe("");
    expect(contentTag(null, "tr")).toBe("");
    expect(contentTag("tr", "en")).toBe("en");
    expect(contentTag("en", "tr")).toBe("tr");
    expect(contentTag("en", "en")).toBe("");
    expect(moodKey(["Canggu", "Tabanan"], contentTag("tr", "en"))).toBe("canggu|tabanan@en");
    expect(moodKey(["Canggu", "Tabanan"], contentTag("tr", "tr"))).toBe("canggu|tabanan");
  });
});

describe("the review on another language", () => {
  it("its key carries the language: a change asks again soon, once", () => {
    const before = reviewKey(bali, range, []);
    const now = reviewKey(bali, range, [], contentTag("tr", "en"));
    expect(now).toMatch(/^en:canggu,mengwi,tabanan\|2026-12-10_2027-01-10\|/);
    expect(before).toMatch(/^canggu,mengwi,tabanan\|/);
    const last = { key: before, at: 0, state: "done" as const };
    expect(reviewDue(last, before, 60 * 60 * 1000)).toBe(false);
    expect(reviewDue(last, now, REVIEW_CHANGE_MS)).toBe(true);
    // Done in English: not again.
    expect(reviewDue({ key: now, at: REVIEW_CHANGE_MS, state: "done" }, now, REVIEW_CHANGE_MS * 3)).toBe(false);
  });

  it("an older card's language is read from its words; only open review cards in another language are stale", () => {
    expect(stored.map(suggestionLang)).toEqual(["tr", "tr", "tr", "tr", "tr", null]);
    expect(stored.map((s) => staleLang(s, "en"))).toEqual([true, true, true, false, false, false]);
    expect(stored.some((s) => staleLang(s, "tr"))).toBe(false);
    expect(staleLang({ ...stored[0], lang: "en" }, "en")).toBe(false);
  });

  it("the prompt doesn't count the stale ones as already suggested, so they can come again in English", () => {
    const prompt = reviewPrompt({ mains: [], nights: {}, range, items: [], sectionOf: () => "todo", suggestions: stored, lang: "en" });
    const data = JSON.parse(prompt.replace(/<\/?suggest_review>/g, ""));
    expect(data.already_suggested).toEqual(["Tanah Lot Tapınağı", "eSIM"]);
    expect(data.not_needed).toEqual(["Seyahat sigortası"]);
  });

  it("the English answer takes the place of the open Turkish cards; what's on the plan or dismissed stays", () => {
    const { list, added } = acceptReview(english, stored, 5, undefined, "en");
    expect(added.map((s) => [s.title, s.lang])).toEqual([["Nusa Penida", "en"], ["Rainy season", "en"]]);
    expect(list.map((s) => s.title)).toEqual(["Tanah Lot Tapınağı", "Seyahat sigortası", "eSIM", "Nusa Penida", "Rainy season"]);
    // An empty answer leaves the old ones rather than empty sections.
    expect(acceptReview({ suggestions: [] }, stored, 5, undefined, "en").list).toEqual(stored);
    // The same language: nothing replaced.
    expect(acceptReview(english, stored, 5, undefined, "tr").list.slice(0, stored.length)).toEqual(stored);
  });

  it("runReview asks in English and stores the English cards with their language", async () => {
    let t: Trip = { id: "bali", title: "Bali Gezisi", lang: "tr", confirmedDates: range, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, suggestions: stored };
    const ask = vi.fn(async (_system: string) => english);
    const provider = async () => ({ generateJson: ask }) as unknown as LlmProvider;
    setLang("en");
    const key = reviewKey(bali, range, [], contentTag(t.lang));
    expect(await runReview({ key, prompt: "p", lang: contentLang(t.lang), now: 9, provider, save: async (change) => void (t = change(t)) })).toBe("done");
    expect(ask.mock.calls[0][0]).toMatch(/Write in English\.$/);
    expect(t.suggestions!.filter((s) => s.state === "open" && s.source === "ai").map((s) => [s.title, s.lang])).toEqual([["Nusa Penida", "en"], ["Rainy season", "en"]]);
    expect(t.suggestReview).toEqual({ key, at: 9, state: "done" });
  });
});

describe("the Bavul's AI list on another language", () => {
  const list = (over: Partial<PackList> = {}): PackList => ({
    at: 1,
    groups: [{ title: "Giysi", lines: [{ name: "Yağmurluk", why: "Aralıkta yağmur sezonu.", buy: false }, { name: "Mayo", why: null, buy: false }] }],
    ask: [{ id: "q1", text: "Sörf yapacak mısınız?", options: [{ label: "Evet", add: [] }, { label: "Hayır", add: [] }] }],
    tips: [],
    ...over,
  });

  it("made again once in the board's language when nothing of it was touched", () => {
    expect(packListLang(list())).toBe("tr");
    expect(packRedo({ list: list() }, "en")).toBe(true);
    expect(packRedo({ list: list() }, "tr")).toBe(false);
    // The new one says its language: no second time (no loop).
    expect(packRedo({ list: list({ lang: "en", groups: [{ title: "Clothes", lines: [{ name: "Rain jacket", why: null, buy: false }] }] }) }, "en")).toBe(false);
    expect(packRedo(undefined, "en")).toBe(false);
  });

  it("a list the traveller ticked or answered stays as it is", () => {
    expect(packRedo({ list: list(), ready: ["yağmurluk"] }, "en")).toBe(false);
    expect(packRedo({ list: list(), answers: { q1: "Evet" } }, "en")).toBe(false);
    // A tick on something that isn't on this list (a record of their own) doesn't count.
    expect(packRedo({ list: list(), ready: ["pasaport"] }, "en")).toBe(true);
  });
});
