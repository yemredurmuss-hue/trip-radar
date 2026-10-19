// The AI review for suggestions: when it's due, what it keeps, and that a missing key or an error never sticks.
import { describe, expect, it, vi } from "vitest";
import { MissingKeyError, type LlmProvider } from "../src/lib/llm";
import { acceptReview, REVIEW_CHANGE_MS, REVIEW_EVERY_MS, REVIEW_MAX, REVIEW_STALE_MS, reviewDue, reviewKey, reviewPrompt, reviewSystem, reviewWait, runReview, tripTaste, type ReviewAnswer } from "../src/lib/suggestReview";
import { bySection, shownSuggestions, withState } from "../src/lib/suggestions";
import type { Suggestion, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const DAY = REVIEW_EVERY_MS;
const ubud = [{ name: "Ubud", members: ["Ubud"] }];
const range = { start: "2026-12-10", end: "2027-01-10" };
const stay = makeItem({ id: "s1", category: "stay", city: "Ubud" });
const one = (over: Partial<ReviewAnswer["suggestions"][number]> = {}) => ({
  section: "todo", kind: "add", title: "Tegallalang pirinç terasları", why: "Ubud'a yakın ve planda yok.", template: "todo", city: "Ubud", start: "", end: "", ...over,
});
const trip = (over: Partial<Trip> = {}): Trip => ({ id: "t1", title: "Bali", confirmedDates: range, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over });

describe("when the review is asked", () => {
  const key = reviewKey(ubud, range, [stay]);
  it("asks once at first, then only for a big change: a new stay at most once a day", () => {
    const newStay = reviewKey(ubud, range, [stay, makeItem({ id: "s2", category: "stay" })]);
    expect(reviewDue(null, key, 0)).toBe(true);
    expect(reviewDue({ key, at: 0 }, key, DAY * 5)).toBe(false); // nothing changed
    expect(reviewDue({ key: newStay, at: 0 }, key, DAY / 2)).toBe(false); // a new stay, but asked today
    expect(reviewDue({ key: newStay, at: 0 }, key, DAY + 1)).toBe(true);
  });
  it("other places or dates (the route, the days) are asked again the same day, a few minutes apart, never in a loop (0.38.5)", () => {
    // The start's review was of the skeleton (Ahangama alone); the chat then added Bali, or moved the days.
    const start = reviewKey([{ name: "Ahangama" }], range, [stay]);
    const routed = reviewKey([{ name: "Ahangama" }, { name: "Bali" }], range, [stay]);
    const moved = reviewKey([{ name: "Ahangama" }], { ...range, start: "2026-12-12" }, [stay]);
    expect(reviewDue({ key: start, at: 0, state: "done" }, routed, REVIEW_CHANGE_MS - 1)).toBe(false);
    expect(reviewWait({ key: start, at: 0, state: "done" }, routed, REVIEW_CHANGE_MS - 1)).toBe(1);
    expect(reviewDue({ key: start, at: 0, state: "done" }, routed, REVIEW_CHANGE_MS)).toBe(true);
    expect(reviewDue({ key: start, at: 0, state: "done" }, moved, DAY / 2)).toBe(true);
    // Once asked for the new route, the same route isn't asked again that day; nor while one is running.
    expect(reviewDue({ key: routed, at: 0, state: "done" }, routed, DAY / 2)).toBe(false);
    expect(reviewWait({ key: routed, at: 0, state: "done" }, routed, DAY / 2)).toBeNull();
    expect(reviewDue({ key: start, at: 0, state: "running" }, routed, REVIEW_CHANGE_MS)).toBe(false);
  });
  it("a failure isn't done: asked again, but not before a day", () => {
    expect(reviewDue({ key, at: 0, failed: true }, key, DAY / 2)).toBe(false);
    expect(reviewDue({ key, at: 0, failed: true }, key, DAY + 1)).toBe(true);
  });
  it("one running (another tab, a remount) isn't asked again, unless it's been stuck for 10 minutes", () => {
    expect(reviewDue({ key: "other", at: 0, state: "running" }, key, 5 * 60_000)).toBe(false);
    expect(reviewDue({ key: "other", at: 0, state: "running" }, key, REVIEW_STALE_MS + 1)).toBe(true);
  });
  it("a new main place, other dates or a new stay is a big change; nothing else is", () => {
    expect(reviewKey(ubud, range, [stay])).toBe(key);
    expect(reviewKey(ubud, range, [stay, makeItem({ category: "activity" })])).toBe(key);
    expect(reviewKey([...ubud, { name: "Canggu", members: ["Canggu"] }], range, [stay])).not.toBe(key);
    expect(reviewKey(ubud, { ...range, end: "2027-01-12" }, [stay])).not.toBe(key);
    expect(reviewKey(ubud, range, [stay, makeItem({ id: "s2", category: "stay" })])).not.toBe(key);
  });
});

describe("what the review keeps", () => {
  it("at most six, each checked: no price or time, allowed sections only (0.38.5: six)", () => {
    expect(REVIEW_MAX).toBe(6);
    const answer: ReviewAnswer = {
      suggestions: [
        one({ title: "Pirinç terasları" }),
        one({ title: "Motor kiralama", section: "transport", template: "moto", why: "Günlükten %60 ucuz." }),
        one({ title: "İlham", section: "inspo" }),
        one({ title: "Campuhan sırtı yürüyüşü" }),
        one({ title: "Tirta Empul" }),
        one({ title: "Monkey Forest" }),
        one({ title: "Havalimanından Ubud'a transfer", section: "transport", template: "taxi", why: "Denpasar'dan Ubud'a yol planda yok." }),
        one({ title: "Warung babi guling", section: "food", template: "food", why: "Ubud'un yerel yemeği planda yok." }),
        one({ title: "Goa Gajah" }),
        one({ title: "Seminyak gün batımı" }),
      ],
    };
    const { added, list } = acceptReview(answer, [], 1);
    expect(added.map((s) => s.title)).toEqual(["Pirinç terasları", "Campuhan sırtı yürüyüşü", "Tirta Empul", "Monkey Forest", "Havalimanından Ubud'a transfer", "Warung babi guling"]);
    expect(list.every((s) => s.source === "ai" && s.state === "open")).toBe(true);
  });
  it("never brings back one the traveller dismissed (by key or topic)", () => {
    const gone: Suggestion = { key: "rule:monthly-vehicle:ubud", section: "transport", kind: "add", title: "Aylık", why: "x", source: "rule", template: "moto", createdAt: 0, state: "dismissed" };
    const terraces = acceptReview({ suggestions: [one()] }, [], 1).added[0];
    const dismissedTerraces = { ...terraces, state: "dismissed" as const };
    const { added } = acceptReview({ suggestions: [one(), one({ section: "transport", template: "car", title: "Araç kiralama", why: "Uzun kalıyorsun." })] }, [gone, dismissedTerraces], 2);
    expect(added).toEqual([]);
  });
  it("the prompt carries the plan and what's not wanted, as data", () => {
    const p = reviewPrompt({ mains: ubud, nights: { ubud: 31 }, range, items: [stay], sectionOf: () => "stay", travellers: 2, suggestions: [{ ...one(), key: "k", kind: "add", section: "todo", source: "ai", createdAt: 1, state: "dismissed" } as Suggestion] });
    expect(p).toMatch(/^<suggest_review>/);
    expect(JSON.parse(p.split("\n")[1])).toMatchObject({ places: [{ name: "Ubud", nights: 31 }], dates: range, travellers: 2, not_needed: ["Tegallalang pirinç terasları"] });
  });
  it("says the trip's kind and style, and asks the activities to fit them (Emre's surf trip, 19 Ekim)", () => {
    const surf = trip({ intent: { playbook: "custom", label: "Sörf tatili" }, style: { key: "k", ids: ["beach", "nature", "bogus"] } });
    expect(tripTaste(surf)).toEqual({ kind: "Sörf tatili", style: ["Deniz", "Doğa"] });
    const p = reviewPrompt({ mains: [{ name: "Ahangama", members: ["Ahangama"] }], nights: {}, range, items: [], sectionOf: () => "stay", suggestions: [], ...tripTaste(surf) });
    expect(JSON.parse(p.split("\n")[1])).toMatchObject({ kind: "Sörf tatili", style: ["Deniz", "Doğa"] });
    // Nothing said: none made up.
    expect(tripTaste(trip())).toEqual({ kind: null, style: [] });
    expect(JSON.parse(reviewPrompt({ mains: ubud, nights: {}, range, items: [], sectionOf: () => "stay", suggestions: [] }).split("\n")[1])).toMatchObject({ kind: null, style: [] });
    expect(reviewSystem()).toContain("gezinin türüne (\"kind\") ve tarzına (\"style\") uysun");
  });
  it("is not asked for Etkinlik ve turlar (0.38.4: tours only from a real source)", () => {
    const rules = reviewSystem();
    expect(rules).toContain("section şunlardan biri: flight, stay, transport, todo, food, other.");
    expect(rules).not.toMatch(/activity: activity/);
    expect(rules).toContain("Tur ya da biletli etkinlik önerme");
  });
});

describe("Emre's Sri Lanka surf trip (0.38.5: AI suggestions come)", () => {
  const surf = trip({ title: "Sri Lanka", confirmedDates: { start: "2026-11-24", end: "2026-12-03" }, intent: { playbook: "custom", label: "Sörf tatili" }, style: { key: "k", ids: ["beach", "nature"] } });
  const ahangama = [{ name: "Ahangama", members: ["Ahangama", "Harumalgoda"] }];
  const home = makeItem({ id: "h1", name: "Harumalgoda Airbnb", category: "stay", city: "Harumalgoda", status: "booked" });

  it("the prompt asks for the backbone's own ways, things to do and food, fitting a surf trip", () => {
    const rules = reviewSystem(surf.intent);
    expect(rules).toContain("en fazla 6 öneri");
    expect(rules).toContain("araç ya da motosiklet kiralama");
    expect(rules).toContain("havalimanından şehre tren, otobüs ya da transfer");
    expect(rules).toContain("bölge bileti");
    // 0.38.8 (Emre, Patagonya): with a rental, no way of travel per road between the cities; only a ferry or a flight.
    expect(rules).toContain("planda bir kiralama varsa şehirler arası her yol için ayrıca ulaşım önerme");
    expect(rules).toContain("yalnız arabanın gidemediği yer için (feribot, uçuş) öner");
    expect(rules).toContain("Yapılacaklar (todo) ve yeme-içme (food)");
    expect(rules).toContain("sörf gezisinde sörf noktaları");
    expect(rules).toContain("omurgaya da, yapılacaklara da, yeme-içmeye de");
    const data = JSON.parse(reviewPrompt({ mains: ahangama, nights: { ahangama: 9 }, range: surf.confirmedDates!, items: [home], sectionOf: () => "stay", suggestions: [], ...tripTaste(surf) }).split("\n")[1]);
    expect(data).toMatchObject({ places: [{ name: "Ahangama", nights: 9, towns: ["Ahangama", "Harumalgoda"] }], dates: { start: "2026-11-24", end: "2026-12-03" }, kind: "Sörf tatili", style: ["Deniz", "Doğa"], plan: { stay: ["Harumalgoda Airbnb (Harumalgoda)"] } });
  });

  const answer: ReviewAnswer = {
    suggestions: [
      one({ section: "transport", template: "moto", title: "Motosiklet kiralama", why: "Ahangama'da sahil boyunca sörf noktaları arasında gezmek için.", city: "Ahangama", start: "2026-11-24", end: "2026-12-03" }),
      one({ section: "transport", template: "train", title: "Kolombo'dan Galle'ye tren", why: "Havalimanından Ahangama'ya yol planda yok.", city: "Colombo" }),
      one({ section: "todo", template: "todo", title: "Kabalana sörf noktası", why: "Ahangama'ya yakın ve sörf gezine uyuyor.", city: "Ahangama" }),
      one({ section: "food", template: "food", title: "Kottu roti", why: "Ahangama'nın yerel yemeği planda yok.", city: "Ahangama" }),
      one({ section: "activity", template: "activity", title: "Sörf dersi", why: "Sörf gezisi." }),
    ],
  };

  it("they show in their sections: the backbone's as intents, things to do and food among the ideas; none in Etkinlik", () => {
    const { list, added } = acceptReview(answer, [], 1, surf.intent);
    expect(added.map((s) => s.section)).toEqual(["transport", "transport", "todo", "food"]);
    const by = bySection(shownSuggestions(list, [], [home]));
    expect(by.transport?.map((s) => s.title)).toEqual(["Motosiklet kiralama", "Kolombo'dan Galle'ye tren"]);
    expect(by.todo?.map((s) => s.title)).toEqual(["Kabalana sörf noktası"]);
    expect(by.food?.map((s) => s.title)).toEqual(["Kottu roti"]);
    expect(by.activity).toBeUndefined();
  });

  it("one closed with × never comes back: not shown, not taken again from the next review", () => {
    const first = acceptReview(answer, [], 1, surf.intent).list;
    const kottu = first.find((s) => s.title === "Kottu roti")!;
    const closed = withState(first, kottu, "dismissed", 2);
    expect(shownSuggestions(closed, [], [home]).map((s) => s.title)).not.toContain("Kottu roti");
    // The next review (other dates) says it again, worded alike: it stays gone; it's told as not needed.
    const again = acceptReview({ suggestions: [one({ section: "food", template: "food", title: "Kottu Roti", why: "Yerel yemek.", city: "Ahangama" })] }, closed, 3, surf.intent);
    expect(again.added).toEqual([]);
    expect(JSON.parse(reviewPrompt({ mains: ahangama, nights: {}, range: surf.confirmedDates!, items: [], sectionOf: () => "stay", suggestions: closed }).split("\n")[1]).not_needed).toEqual(["Kottu roti"]);
  });
});

describe("one review", () => {
  const provider = (answer: () => Promise<unknown>) => async () => ({ generateJson: vi.fn(answer) }) as unknown as LlmProvider;
  const store = () => {
    let t = trip();
    return { save: async (change: (x: Trip) => Trip) => void (t = change(t)), get: () => t };
  };

  it("keeps what passes and remembers it's done for this state", async () => {
    const s = store();
    expect(await runReview({ key: "k1", prompt: "p", save: s.save, now: 50, provider: provider(async () => ({ suggestions: [one()] })) })).toBe("done");
    expect(s.get().suggestions).toMatchObject([{ source: "ai", section: "todo", title: "Tegallalang pirinç terasları" }]);
    expect(s.get().suggestReview).toEqual({ key: "k1", at: 50, state: "done" });
  });

  it("marks itself running before asking the model; a second ask meanwhile is skipped", async () => {
    const s = store();
    let seen: Trip["suggestReview"] = null;
    let release!: () => void;
    const first = runReview({
      key: "k1", prompt: "p", save: s.save, now: 10,
      provider: provider(async () => {
        seen = s.get().suggestReview;
        await new Promise<void>((r) => (release = r));
        return { suggestions: [] };
      }),
    });
    await vi.waitFor(() => expect(seen).toEqual({ key: "k1", at: 10, state: "running" }));
    const ask = vi.fn(async () => ({ suggestions: [] }));
    expect(await runReview({ key: "k1", prompt: "p", save: s.save, now: 11, provider: async () => ({ generateJson: ask }) as unknown as LlmProvider })).toBe("skipped");
    expect(ask).not.toHaveBeenCalled();
    release();
    expect(await first).toBe("done");
  });

  it("no key: silent, nothing stored", async () => {
    const s = store();
    expect(await runReview({ key: "k1", prompt: "p", save: s.save, provider: async () => { throw new MissingKeyError(); } })).toBe("no-key");
    expect(s.get().suggestReview).toBeUndefined();
  });

  it("an error is stored as failed (asked again after a day), with nothing suggested", async () => {
    const s = store();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await runReview({ key: "k1", prompt: "p", save: s.save, now: 7, provider: provider(async () => { throw new Error("503"); }) })).toBe("failed");
    warn.mockRestore();
    expect(s.get().suggestReview).toEqual({ key: "k1", at: 7, failed: true, state: "failed" });
    expect(s.get().suggestions).toBeUndefined();
  });

  it("a request that never reached the model (a reload mid-way, offline): no day-long wait, no warning; asked next time", async () => {
    const s = store();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await runReview({ key: "k1", prompt: "p", save: s.save, now: 7, provider: provider(async () => { throw new TypeError("Failed to fetch"); }) })).toBe("failed");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    info.mockRestore();
    expect(s.get().suggestReview).toBeNull();
    expect(reviewDue(s.get().suggestReview, "k1", 8)).toBe(true);
  });
});
