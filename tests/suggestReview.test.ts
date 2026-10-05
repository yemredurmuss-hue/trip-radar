// The AI review for suggestions: when it's due, what it keeps, and that a missing key or an error never sticks.
import { describe, expect, it, vi } from "vitest";
import { MissingKeyError, type LlmProvider } from "../src/lib/llm";
import { acceptReview, REVIEW_EVERY_MS, reviewDue, reviewKey, reviewPrompt, runReview, type ReviewAnswer } from "../src/lib/suggestReview";
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
  it("asks once at first, then only for a big change, at most once a day", () => {
    expect(reviewDue(null, key, 0)).toBe(true);
    expect(reviewDue({ key, at: 0 }, key, DAY * 5)).toBe(false); // nothing changed
    expect(reviewDue({ key: "other", at: 0 }, key, DAY / 2)).toBe(false); // changed, but asked today
    expect(reviewDue({ key: "other", at: 0 }, key, DAY + 1)).toBe(true);
  });
  it("a failure isn't done: asked again, but not before a day", () => {
    expect(reviewDue({ key, at: 0, failed: true }, key, DAY / 2)).toBe(false);
    expect(reviewDue({ key, at: 0, failed: true }, key, DAY + 1)).toBe(true);
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
  it("at most three, each checked: no price or time, allowed sections only", () => {
    const answer: ReviewAnswer = {
      suggestions: [
        one({ title: "Pirinç terasları" }),
        one({ title: "Motor kiralama", section: "transport", template: "moto", why: "Günlükten %60 ucuz." }),
        one({ title: "İlham", section: "inspo" }),
        one({ title: "Campuhan sırtı yürüyüşü" }),
        one({ title: "Tirta Empul" }),
        one({ title: "Monkey Forest" }),
      ],
    };
    const { added, list } = acceptReview(answer, [], 1);
    expect(added.map((s) => s.title)).toEqual(["Pirinç terasları", "Campuhan sırtı yürüyüşü", "Tirta Empul"]);
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
    const p = reviewPrompt({ mains: ubud, nights: { ubud: 31 }, range, items: [stay], sectionOf: () => "stay", suggestions: [{ ...one(), key: "k", kind: "add", section: "todo", source: "ai", createdAt: 1, state: "dismissed" } as Suggestion] });
    expect(p).toMatch(/^<suggest_review>/);
    expect(JSON.parse(p.split("\n")[1])).toMatchObject({ places: [{ name: "Ubud", nights: 31 }], dates: range, not_needed: ["Tegallalang pirinç terasları"] });
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
    expect(s.get().suggestReview).toEqual({ key: "k1", at: 50 });
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
    expect(s.get().suggestReview).toEqual({ key: "k1", at: 7, failed: true });
    expect(s.get().suggestions).toBeUndefined();
  });
});
