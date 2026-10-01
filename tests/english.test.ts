// The board in English: the same engine, its words in English. What the reader wrote in English (findings,
// reviews) is classified like Turkish, whatever the board's language, since a shared trip can hold both.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cardFacts, durationText } from "../src/lib/cardFacts";
import { choiceOf, tradeText } from "../src/lib/choice";
import { againstRequirement, CRITERION_LABELS, decideGroup, LEVEL_LABELS, makeContext, saidTopics, touchesTopic } from "../src/lib/decision";
import { setLang } from "../src/lib/i18n";
import { MODE_LABELS } from "../src/lib/legs";
import { coverageText, isInfoFinding, isTrivialFinding, monthLabel, natureOf, questionFor, saysSame, stillText, stillTrue } from "../src/lib/listing";
import { pivotalFindings } from "../src/lib/pivots";
import { dateAlert } from "../src/lib/progress";
import type { Finding, Listing, Trip } from "../src/lib/types";
import { finding, LATER_REVIEWS, review, SCAFFOLDING, scaffoldingScene, stay, TODAY } from "./fixtures/scaffolding";

beforeEach(() => setLang("en"));
afterEach(() => setLang("tr"));

/** The scaffolding scene decided, with trip settings that may name the scaffolding finding's key. */
function decide(over: (key: string) => Partial<Trip> = () => ({})) {
  const scene = scaffoldingScene();
  const key = `item:${scene.a.id}#condition:negative`;
  const ctx = makeContext({ ...scene.trip, ...over(key) }, scene.items, { listings: scene.listings, today: TODAY });
  const d = decideGroup(scene.items, ctx);
  return { ...scene, ctx, d, casa: d.options.find((o) => o.item.id === scene.a.id)! };
}

describe("the scaffolding case, in English", () => {
  it("asks before choosing, says why it's in doubt, and puts the pick in a sentence", () => {
    const { casa, d, ctx } = decide();
    expect(casa.fit).toBe("check");
    expect(casa.fitNotes).toEqual(["is the scaffolding still up? (last said Mar 2026, the 10 reviews since don't mention it)"]);
    const c = choiceOf(d, ctx);
    expect(c.verify).toEqual([{ itemId: casa.item.id, name: "Casa Andaime", what: casa.fitNotes[0] }]);
    expect(c.headline).toBe("My pick is Casa Andaime: best value.");
    expect(c.ranked[0].badges).toEqual(["Best value"]);
    expect(d.summary).toMatch(/^Casa Andaime comes out ahead \(\d+ – \d+\): .* the difference\.$/);
  });

  it("says each option against #1 in English: the money, what it gives, what it gives up", () => {
    const { d, ctx, b } = decide();
    const bravo = choiceOf(d, ctx).ranked.find((r) => r.option.item.id === b.id)!;
    expect(bravo.vsRank).toBe(1);
    expect(tradeText(bravo.trade!, ctx.currency)).toBe("+€60 (+€20 a night) · kahvaltı çok iyi · 2 reviews · downside: oda küçük · 2 reviews");
  });

  it("rules it out only when the traveller says it matters, in their words", () => {
    const { casa } = decide((key) => ({ confirmedFindings: [key] }));
    expect(casa).toMatchObject({ fit: "unfit", eliminated: { reason: "Dışarıda iskele kuruldu (2 reviews); you said it matters" } });
  });

  it("shows the card in English: price for the nights, counts, the comparison", () => {
    const { a, d, ctx } = decide();
    const card = cardFacts(a, d, ctx);
    expect(card.price).toMatchObject({ text: "€240", label: "3 nights total", perNight: "€80 / night" });
    expect(card.pros.map((p) => p.text)).toEqual(expect.arrayContaining(["Cheapest", "Free cancellation"]));
  });

  it("flags the one thing a ranking hangs on, with an English question and evidence", () => {
    const s = scaffoldingScene();
    const key = `item:${s.a.id}`;
    const l = s.listings.get(key)!;
    const listings = new Map(s.listings);
    listings.set(key, {
      ...l,
      reviews: [
        review("r1", "2026-09", "Scaffolding was put up outside, noisy in the morning."),
        review("r2", "2026-09", "Scaffolding on the building."),
        review("r3", "2026-09", "Scaffolding blocks the view."),
        ...LATER_REVIEWS.map((r) => ({ ...r, date: "2026-08" })),
      ],
      findings: [{ ...SCAFFOLDING, text: "Scaffolding put up outside", reviewIds: ["r1", "r2", "r3"] }, ...l.findings.slice(1)],
    });
    const items = s.items.map((i) => (i.id === s.a.id ? { ...i, price: { ...i.price, amount: 285 } } : i));
    const ctx = makeContext(s.trip, items, { listings, today: TODAY });
    const [pivot] = pivotalFindings(decideGroup(items, ctx), ctx);
    expect(pivot).toMatchObject({ from: 2, to: 1, evidence: "3 reviews, Sep 2026", question: "Is the scaffolding still up?" });
  });
});

describe("findings the reader wrote in English", () => {
  const f = (text: string, topic: Finding["topic"] = "amenities"): Finding => finding({ text, polarity: "negative", topic });

  it("leaves standard trivia out, whatever the board's language", () => {
    for (const lang of ["en", "tr"] as const) {
      setLang(lang);
      expect(isTrivialFinding(f("No hair dryer"))).toBe(true);
      expect(isTrivialFinding(f("No clothes hangers in the wardrobe"))).toBe(true);
      expect(isTrivialFinding(f("Shower gel not provided"))).toBe(true);
      expect(isTrivialFinding(f("No kitchen"))).toBe(false);
    }
  });

  it("takes a plain fact or an unknown as information, a complaint as a complaint", () => {
    expect(isInfoFinding(f("Check-in from 3 PM", "check_in"))).toBe(true);
    expect(isInfoFinding(f("Check-out by 11:00", "check_in"))).toBe(true);
    expect(isInfoFinding(f("Check-in at 3 PM was confusing, nobody answered", "check_in"))).toBe(false);
    expect(isInfoFinding(f("Check-in only from 8 PM", "check_in"))).toBe(false); // out of the usual: worth saying
    expect(isInfoFinding(f("Lift not mentioned", "access"))).toBe(true);
    expect(isInfoFinding(f("The page doesn't say whether there is parking"))).toBe(true);
    expect(isInfoFinding(f("Parking is expensive"))).toBe(false);
  });

  it("tells a passing event from a lasting thing, and knows when guests say it's over", () => {
    expect(natureOf({ text: "Pool closed for renovation", source: "reviews" })).toBe("event");
    expect(natureOf({ text: "Roadworks outside the building", source: "reviews" })).toBe("event");
    expect(natureOf({ text: "The air conditioning stopped working", source: "reviews" })).toBe("event");
    expect(natureOf({ text: "Thin walls", source: "reviews" })).toBe("lasting");
    const s = scaffoldingScene();
    const listing = s.listings.get(`item:${s.a.id}`)!;
    const english = { ...SCAFFOLDING, text: "Scaffolding put up outside" };
    const april = listing.reviews.filter((r) => !r.date || r.date <= "2026-04");
    const over: Listing = { ...listing, reviews: [...april.slice(0, 2), review("r8", "2026-04", "The scaffolding is gone, great view again!")] };
    expect(stillText(stillTrue(english, over, TODAY))).toBe("last said Mar 2026; 1 later review says it's over");
  });

  it("asks the right question in English, its own words otherwise", () => {
    expect(questionFor({ text: "Bed bugs in the room" })).toBe("Has the pest problem been dealt with?");
    expect(questionFor({ text: "Lift out of order" })).toBe("Is the lift working?");
    expect(questionFor({ text: "Door lock is hard to open" })).toBe("“Door lock is hard to open”: is this still so?");
    setLang("tr");
    expect(questionFor({ text: "Pool closed" })).toBe("Havuz açık mı?");
  });

  it("reads topics, musts and sameness from English words", () => {
    expect([...saidTopics(["We want a quiet place near the centre"])]).toEqual(expect.arrayContaining(["noise", "location"]));
    expect(touchesTopic({ topic: "condition", text: "Construction noise in the morning" }, "noise")).toBe(true);
    const kitchen = { requirements: [{ kind: "amenity" as const, amenity: "mutfak" as const }] };
    expect(againstRequirement(f("No kitchen in the flat"), kitchen)).toBe(true);
    expect(againstRequirement(f("Kitchen is missing a kettle and the oven"), kitchen)).toBe(true);
    expect(againstRequirement(f("Small but well equipped kitchen"), kitchen)).toBe(false);
    const pos = (text: string): Finding => finding({ text, polarity: "positive", topic: "amenities" });
    expect(saysSame(pos("Lovely views from the balcony"), pos("Great view of the river"))).toBe(true);
    expect(saysSame(pos("Lovely views from the balcony"), pos("Washing machine in the flat"))).toBe(false);
  });
});

describe("words, numbers and dates in English", () => {
  it("names months and counts reviews in English, in Turkish when switched back", () => {
    expect(monthLabel("2026-09")).toBe("Sep 2026");
    const s = scaffoldingScene();
    const listing = { ...s.listings.get(`item:${s.a.id}`)!, reviewTotal: 1204 };
    expect(coverageText(listing)).toBe("12 reviews read (1,204 on the site) · Mar 2026 – Sep 2026");
    setLang("tr");
    expect(monthLabel("2026-09")).toBe("Eyl 2026");
    expect(coverageText(listing)).toBe("12 yorum incelendi (sitede 1.204) · Mar 2026 – Eyl 2026");
  });

  it("reads label maps at the time, not when the module loaded", () => {
    expect(CRITERION_LABELS.price).toBe("Price");
    expect(LEVEL_LABELS[4]).toBe("Very important");
    expect(LEVEL_LABELS.map((l) => l)).toHaveLength(5);
    expect(MODE_LABELS.train).toBe("Train");
    expect(durationText(130)).toBe("2 h 10 min");
    setLang("tr");
    expect(CRITERION_LABELS.price).toBe("Fiyat");
    expect(LEVEL_LABELS[4]).toBe("Çok önemli");
    expect(durationText(130)).toBe("2 sa 10 dk");
  });

  it("says what's left to do in English", () => {
    const item = stay("Casa", { status: "chosen", dates: { start: "2026-10-09", end: "2026-10-11", source: "url" } });
    expect(dateAlert(item, TODAY)).toEqual({ tone: "amber", text: "Not booked · 9 days to check-in" });
    const noFree = { ...item, cancellation: { summary: null, freeUntil: "2026-10-01", source: "page" as const } };
    expect(dateAlert(noFree, TODAY)?.text).toBe("Not booked · 9 days to check-in · free cancellation, so booking now is risk-free");
  });
});
