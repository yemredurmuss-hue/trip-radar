// Yapılacaklar is "Things to do" (Emre, 0.38.9, the Şarm El-Şeyh trip): what's seen and done there. Renting gear is
// Hazırlık: never a Yapılacaklar card, a line on the trip's Bavul when it has one, else dropped. A car rental stays in Ulaşım.
import { describe, expect, it, vi } from "vitest";
import type { LlmProvider } from "../src/lib/llm";
import { withPrepLine } from "../src/lib/prepPack";
import { acceptReview, reviewSystem, runReview, type ReviewAnswer } from "../src/lib/suggestReview";
import { checkSuggestionInput, isGearChore, prepFromSuggestion, shownSuggestions } from "../src/lib/suggestions";
import type { PackList, Suggestion, Trip } from "../src/lib/types";

const raw = (over: Partial<ReviewAnswer["suggestions"][number]> = {}) => ({
  section: "todo", kind: "add", title: "Ras Muhammed'de gün batımı", why: "Şarm El-Şeyh'e yakın ve planda yok.", template: "todo", city: "Şarm El-Şeyh", start: "", end: "", ...over,
});
const gear = raw({ title: "Şnorkel ekipmanı kiralama", why: "Mercan resiflerinde şnorkel için gerekir.", place: "" });
const sunset = raw();
const car = raw({ section: "transport", template: "car", title: "Araç kiralama", why: "Duraklar arası yol için." });
const list = (): PackList => ({ at: 1, groups: [{ title: "Hava · 22–31°", lines: [{ name: "Güneş kremi", why: null, buy: false }] }], ask: [], tips: [] });
const trip = (over: Partial<Trip> = {}): Trip => ({ id: "t1", title: "Mısır", confirmedDates: { start: "2026-11-10", end: "2026-11-17" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over });

describe("what Yapılacaklar is, said to the model", () => {
  it("the review's rules say a rental, gear or things never go in things to do (both languages)", () => {
    const rules = reviewSystem();
    expect(rules).toMatch(/Yapılacaklar orada yapılacak ya da görülecek şeylerdir: gezilecek yer, manzara noktası, gün batımı, yerel yemek ya da tatlı, pazar, deneyim/);
    expect(rules).toMatch(/Kiralama, ekipman, eşya, hizmet, rezervasyon, ulaşım ya da belge Yapılacaklar'a yazılmaz/);
  });
});

describe("a chore in Yapılacaklar, in code", () => {
  it("knows gear to rent from a thing to do there; a vehicle rented and shopping there aren't chores", () => {
    for (const t of ["Şnorkel ekipmanı kiralama", "Dalış ekipmanı kirala", "Snorkel gear rental", "Rent diving equipment", "Şnorkel malzemesi satın al"]) expect(isGearChore(t)).toBe(true);
    for (const t of ["Ras Muhammed'de gün batımı", "Naama Bay", "Araç kiralama", "Scooter rental", "Motor kiralama", "Bisiklet kiralama", "Hediyelik eşya satın al"]) expect(isGearChore(t)).toBe(false);
  });

  it("\"Şnorkel ekipmanı kiralama\" is no Yapılacaklar card; \"Ras Muhammed'de gün batımı\" is; the car rental stays in Ulaşım", () => {
    expect(typeof checkSuggestionInput(gear, "chat", 1)).toBe("string");
    expect(checkSuggestionInput(sunset, "ai", 1)).toMatchObject({ section: "todo", template: "todo" });
    expect(checkSuggestionInput(car, "ai", 1)).toMatchObject({ section: "transport", template: "car", title: "Araç kiralama" });
    expect(prepFromSuggestion(gear, 1)).toEqual({ name: "Şnorkel ekipmanı kiralama", why: "Mercan resiflerinde şnorkel için gerekir." });
    expect(prepFromSuggestion(sunset, 1)).toBeNull();
    expect(prepFromSuggestion(car, 1)).toBeNull();
    // Gear sent as a way about isn't a chore made from Yapılacaklar.
    expect(prepFromSuggestion({ ...gear, section: "transport" }, 1)).toBeNull();
  });

  it("the review keeps the sunset and the car, and hands the gear over as a Hazırlık line", () => {
    const got = acceptReview({ suggestions: [gear, sunset, car] }, [], 1);
    expect(got.list.map((s) => [s.section, s.title])).toEqual([
      ["todo", "Ras Muhammed'de gün batımı"],
      ["transport", "Araç kiralama"],
    ]);
    expect(got.prep).toEqual([{ name: "Şnorkel ekipmanı kiralama", why: "Mercan resiflerinde şnorkel için gerekir." }]);
  });
});

describe("the Hazırlık line", () => {
  it("goes on the Bavul the trip has, in its gear group (made when missing), once", () => {
    const put = withPrepLine({ list: list(), ready: ["güneş kremi"] }, "Şnorkel ekipmanı kiralama", "Mercan resiflerinde şnorkel için gerekir.");
    expect(put?.ready).toEqual(["güneş kremi"]);
    expect(put?.list?.groups.map((g) => g.title)).toEqual(["Hava · 22–31°", "Ekipman"]);
    expect(put?.list?.groups[1].lines).toEqual([{ name: "Şnorkel ekipmanı kiralama", why: "Mercan resiflerinde şnorkel için gerekir.", buy: false }]);
    expect(withPrepLine(put!, "şnorkel ekipmanı kiralama.", null)).toBeNull();
    const own = { list: { ...list(), groups: [{ title: "Dalış ekipmanı", lines: [] }] } };
    expect(withPrepLine(own, "Şnorkel ekipmanı kiralama", null)?.list?.groups.map((g) => [g.title, g.lines.length])).toEqual([["Dalış ekipmanı", 1]]);
  });

  it("is dropped when the trip has no list yet", () => {
    expect(withPrepLine(undefined, "Şnorkel ekipmanı kiralama", null)).toBeNull();
    expect(withPrepLine({ ready: [] }, "Şnorkel ekipmanı kiralama", null)).toBeNull();
  });

  it("a review writes it on the trip's Bavul, never as a Yapılacaklar card", async () => {
    const provider = async () => ({ generateJson: vi.fn(async () => ({ suggestions: [gear, sunset] })) }) as unknown as LlmProvider;
    let t = trip({ packing: { list: list() } });
    const save = async (change: (x: Trip) => Trip) => void (t = change(t));
    expect(await runReview({ key: "k1", prompt: "p", save, now: 5, provider })).toBe("done");
    expect(t.suggestions?.map((s) => s.title)).toEqual(["Ras Muhammed'de gün batımı"]);
    expect(t.packing?.list?.groups.at(-1)).toEqual({ title: "Ekipman", lines: [{ name: "Şnorkel ekipmanı kiralama", why: "Mercan resiflerinde şnorkel için gerekir.", buy: false }] });

    let bare = trip();
    expect(await runReview({ key: "k1", prompt: "p", save: async (c) => void (bare = c(bare)), now: 5, provider })).toBe("done");
    expect(bare.suggestions?.map((s) => s.title)).toEqual(["Ras Muhammed'de gün batımı"]);
    expect(bare.packing).toBeUndefined();
  });
});

describe("one stored before", () => {
  it("an AI \"ekipman kiralama\" card in Yapılacaklar isn't shown; the sunset is", () => {
    const stored: Suggestion[] = [
      { key: "ai:todo:todo:ekipmani-kiralama-snorkel", section: "todo", kind: "add", title: "Şnorkel ekipmanı kiralama", why: "Mercan için.", source: "ai", template: "todo", createdAt: 1, state: "open" },
      { key: "ai:todo:todo:batimi-gun-muhammed-ras", section: "todo", kind: "add", title: "Ras Muhammed'de gün batımı", why: "Yakın.", source: "ai", template: "todo", createdAt: 1, state: "open" },
    ];
    expect(shownSuggestions(stored, []).map((s) => s.title)).toEqual(["Ras Muhammed'de gün batımı"]);
  });
});
