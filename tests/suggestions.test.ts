// Öneriler (spec 2026-10-06 §1): each rule fires, doesn't fire, and goes by itself once resolved; dedupe by key;
// "Gerek yok" for good; "Plana ekle" makes the right record; suggestions never count anywhere.
import { describe, expect, it } from "vitest";
import { categorize, planProgress } from "../src/lib/categories";
import { sectionTally } from "../src/lib/heroInfo";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import {
  checkSuggestionInput,
  mergeIncoming,
  ruleSuggestions,
  SECTION_TEMPLATES,
  shownSuggestions,
  suggestedItem,
  withState,
  type RuleInput,
} from "../src/lib/suggestions";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Suggestion, Trip } from "../src/lib/types";
import { SECTION_META } from "../src/app/plan/sectionMeta";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-06";
const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1", title: "Bali", confirmedDates: { start: "2026-12-10", end: "2027-01-10" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1, ...over,
});
const stay = (city: string, start: string, end: string, over: Partial<Item> = {}) =>
  makeItem({ category: "stay", name: `${city} Villa`, needKey: `stay:${city.toLowerCase()}`, city, countryCode: "ID", dates: { start, end, source: "page" }, status: "chosen", ...over });
const flight = (from: string, to: string, dep: string, arr: string, over: Partial<Item> = {}) =>
  makeItem({
    category: "flight", name: `${from}-${to}`, needKey: `flight:${from}-${to}`.toLowerCase(), dates: { start: dep.slice(0, 10), end: null, source: "page" },
    flight: { from, to, departure: dep, arrival: arr, carrier: null, flightNumber: null, stops: 0 }, status: "booked", ...over,
  });

/** The rules for a trip as the board would see it (plan, legs, timeline built from the items). */
function rulesFor(items: Item[], over: Partial<RuleInput> & { trip?: Trip } = {}) {
  const t = over.trip ?? trip();
  const plan = buildPlan(t, items);
  const legs = buildLegs(plan, t);
  const timeline = buildTimeline(plan, legs, items, new Set(t.hidden ?? []));
  return ruleSuggestions({ trip: t, plan, items, timeline, legs, mains: [], home: "TR", today: TODAY, ...over });
}
const keys = (list: Suggestion[]) => list.map((s) => s.key);
/** The record "Plana ekle" makes for the suggestion with this key. */
const addOf = (list: Suggestion[], key: string, id = "added") => suggestedItem(list.find((s) => s.key === key)!, "t1", id, 5)!;

describe("rule: a long stay in one place and no vehicle → a monthly rental in Ulaşım", () => {
  const ubud = [stay("Ubud", "2026-12-10", "2027-01-10")];

  it("fires for 21+ nights, with a factual why (no invented percentage) and the place's dates", () => {
    const s = rulesFor(ubud).find((x) => x.key === "rule:monthly-vehicle:ubud")!;
    expect(s).toMatchObject({ section: "transport", kind: "add", template: "moto", source: "rule", payload: { city: "Ubud", start: "2026-12-10", end: "2027-01-10" } });
    expect(s.why).toContain("31 gece Ubud'da kalıyorsun");
    expect(s.why).not.toMatch(/%|~/);
  });

  it("is a car rental outside scooter countries, and counts a main place's members together", () => {
    const madeira = [stay("Funchal", "2026-12-10", "2026-12-22", { countryCode: "PT" }), stay("Gaula", "2026-12-22", "2027-01-05", { countryCode: "PT" })];
    const s = rulesFor(madeira, { mains: [{ name: "Madeira", members: ["Funchal", "Gaula"] }] }).find((x) => x.key.startsWith("rule:monthly-vehicle"))!;
    // Keyed by the place's city key (the alias table reads Madeira as its capital): stable across both towns.
    expect(s).toMatchObject({ key: "rule:monthly-vehicle:funchal", template: "car", payload: { city: "Madeira", start: "2026-12-10", end: "2027-01-05" } });
    expect(s.why).toContain("26 gece Madeira'da");
    // Each town on its own is under 21 nights: nothing.
    expect(keys(rulesFor(madeira)).some((k) => k.startsWith("rule:monthly-vehicle"))).toBe(false);
  });

  it("doesn't fire under 21 nights", () => {
    expect(keys(rulesFor([stay("Ubud", "2026-12-10", "2026-12-30")])).some((k) => k.startsWith("rule:monthly-vehicle"))).toBe(false);
  });

  it("goes by itself once a vehicle covers those days (the one Plana ekle makes, or a car said in the chat)", () => {
    const rental = addOf(rulesFor(ubud), "rule:monthly-vehicle:ubud");
    expect(rental).toMatchObject({ category: "transport", plannedKind: "moto_rental", city: "Ubud", dates: { start: "2026-12-10", end: "2027-01-10" }, status: "chosen" });
    expect(keys(rulesFor([...ubud, rental])).some((k) => k.startsWith("rule:monthly-vehicle"))).toBe(false);
    const car = makeItem({ category: "transport", plannedKind: "car_rental", name: "Araba", dates: { start: "2026-12-12", end: "2026-12-20", source: "page" }, status: "chosen" });
    expect(keys(rulesFor([...ubud, car])).some((k) => k.startsWith("rule:monthly-vehicle"))).toBe(false);
    // A bike isn't a vehicle for this.
    const bike = makeItem({ category: "transport", plannedKind: "bike_rental", name: "Bisiklet", dates: { start: "2026-12-12", end: "2026-12-20", source: "page" }, status: "chosen" });
    expect(keys(rulesFor([...ubud, bike]))).toContain("rule:monthly-vehicle:ubud");
  });

  it("says nothing once the trip is over", () => {
    expect(rulesFor(ubud, { today: "2027-02-01" })).toEqual([]);
  });
});

describe("rules: abroad without insurance or an eSIM → Diğer", () => {
  const ubud = [stay("Ubud", "2026-12-10", "2027-01-10")];

  it("fires for a trip outside the traveller's country, naming the country", () => {
    const list = rulesFor(ubud);
    expect(list.find((s) => s.key === "rule:insurance")).toMatchObject({ section: "other", template: "insurance" });
    const esim = list.find((s) => s.key === "rule:esim")!;
    expect(esim).toMatchObject({ section: "other", template: "esim" });
    expect(esim.title).toMatch(/^eSIM \(.+\)$/);
  });

  it("doesn't fire at home, or when no country is known", () => {
    expect(keys(rulesFor(ubud, { home: "ID" }))).not.toContain("rule:insurance");
    expect(keys(rulesFor(ubud, { home: "id" }))).not.toContain("rule:esim");
    expect(keys(rulesFor([stay("Ubud", "2026-12-10", "2027-01-10", { countryCode: null })]))).not.toContain("rule:insurance");
  });

  it("reads abroad from a flight's landing airport too", () => {
    const f = flight("IST", "LIS", "2026-12-10T08:00", "2026-12-10T11:00");
    expect(keys(rulesFor([f]))).toContain("rule:insurance");
  });

  it("goes once a policy or an eSIM is on the plan (the records Plana ekle makes count)", () => {
    const list = rulesFor(ubud);
    const policy = addOf(list, "rule:insurance", "p");
    const esim = addOf(list, "rule:esim", "e");
    expect(policy).toMatchObject({ plannedKind: "insurance", category: "other", name: "Seyahat sağlık sigortası" });
    expect(esim).toMatchObject({ plannedKind: "esim", category: "esim" });
    const after = keys(rulesFor([...ubud, policy, esim]));
    expect(after).not.toContain("rule:insurance");
    expect(after).not.toContain("rule:esim");
    // A policy saved from a page counts too; one ruled out doesn't.
    const page = makeItem({ category: "other", name: "World Nomads travel insurance" });
    expect(keys(rulesFor([...ubud, page]))).not.toContain("rule:insurance");
    expect(keys(rulesFor([...ubud, { ...page, status: "dismissed" }]))).toContain("rule:insurance");
  });
});

describe("rule: landing at night with no transfer → a taxi in Ulaşım", () => {
  const items = (arr: string) => [flight("IST", "DPS", "2026-12-10T08:00", arr), stay("Ubud", "2026-12-10", "2027-01-10")];

  it("fires after 22:00, with the landing time and the arrival's day and city", () => {
    const s = rulesFor(items("2026-12-10T23:30")).find((x) => x.key.startsWith("rule:night-arrival-taxi"))!;
    expect(s).toMatchObject({ key: "rule:night-arrival-taxi:2026-12-10", section: "transport", template: "taxi", title: "Havalimanı transferi · Taksi", payload: { city: "Ubud", start: "2026-12-10", time: "23:30" } });
    expect(s.why).toContain("23:30");
  });

  it("doesn't fire for a landing in the afternoon", () => {
    expect(keys(rulesFor(items("2026-12-10T15:00"))).some((k) => k.startsWith("rule:night-arrival"))).toBe(false);
  });

  it("goes once a transfer is planned (the taxi Plana ekle makes lands on that arrival), or it's said not needed", () => {
    const list = rulesFor(items("2026-12-10T23:30"));
    const taxi = addOf(list, "rule:night-arrival-taxi:2026-12-10");
    expect(taxi).toMatchObject({ plannedKind: "taxi", city: "Ubud", dates: { start: "2026-12-10" } });
    expect(taxi.flight?.departure).toBe("2026-12-10T23:30");
    expect(keys(rulesFor([...items("2026-12-10T23:30"), taxi])).some((k) => k.startsWith("rule:night-arrival"))).toBe(false);
    const t = trip();
    const plan = buildPlan(t, items("2026-12-10T23:30"));
    const arrival = buildLegs(plan, t).find((l) => l.kind === "arrival")!;
    expect(keys(rulesFor(items("2026-12-10T23:30"), { trip: trip({ hidden: [`leg:${arrival.key}`] }) })).some((k) => k.startsWith("rule:night-arrival"))).toBe(false);
  });
});

describe("rule: a short connection between separate tickets → a warning in Uçuş", () => {
  const leg1 = flight("IST", "DOH", "2026-12-10T02:00", "2026-12-10T06:00", { id: "f1" });
  it("fires under 60 minutes", () => {
    const s = rulesFor([leg1, flight("DOH", "DPS", "2026-12-10T06:40", "2026-12-10T20:00", { id: "f2" })]).find((x) => x.section === "flight")!;
    expect(s).toMatchObject({ key: "rule:short-layover:f1:f2", kind: "warning" });
    expect(s.template).toBeUndefined();
    expect(s.title).toContain("40 dk");
  });
  it("doesn't fire for 90 minutes, another airport, or an option not taken", () => {
    expect(rulesFor([leg1, flight("DOH", "DPS", "2026-12-10T07:30", "2026-12-10T20:00")]).some((s) => s.section === "flight")).toBe(false);
    expect(rulesFor([leg1, flight("DXB", "DPS", "2026-12-10T06:40", "2026-12-10T20:00")]).some((s) => s.section === "flight")).toBe(false);
    expect(rulesFor([leg1, flight("DOH", "DPS", "2026-12-10T06:40", "2026-12-10T20:00", { status: "saved" })]).some((s) => s.section === "flight")).toBe(false);
  });
});

describe("rule: open nights → Konaklama bul, never twice", () => {
  const t = trip({ confirmedDates: { start: "2026-12-10", end: "2026-12-14" } });
  it("doesn't duplicate the empty-nights block the board already shows", () => {
    expect(keys(rulesFor([], { trip: t })).some((k) => k.startsWith("rule:find-stay"))).toBe(false);
  });
  it("fires for open nights the board doesn't show, and not for nights said not needed", () => {
    const plan = buildPlan(t, []);
    const input: RuleInput = { trip: t, plan, items: [], timeline: { entries: [] }, legs: [], mains: [], home: "TR", today: TODAY };
    expect(ruleSuggestions(input).find((s) => s.key.startsWith("rule:find-stay"))).toMatchObject({ section: "stay", template: "hotel", payload: { start: "2026-12-10", end: "2026-12-14" } });
    const hidden = { ...t, hidden: ["nights:2026-12-10_2026-12-14"] };
    expect(ruleSuggestions({ ...input, trip: hidden }).some((s) => s.key.startsWith("rule:find-stay"))).toBe(false);
  });
});

describe("shown suggestions: dedupe, Gerek yok for good, rule beats a repeat", () => {
  const rule = (key: string, template?: string): Suggestion => ({ key, section: "other", kind: "add", title: key, why: "x", source: "rule", template, createdAt: 0, state: "open" });
  const chat = (key: string, template: string, section: Suggestion["section"] = "transport"): Suggestion => ({ key, section, kind: "add", title: key, why: "x", source: "chat", template, createdAt: 3, state: "open" });

  it("shows open rules and stored chat/AI suggestions, each key once", () => {
    const shown = shownSuggestions([chat("chat:a", "todo", "todo"), chat("chat:a", "todo", "todo")], [rule("rule:esim", "esim")]);
    // In the Plan's order of sections: Yapılacak şeyler before Diğer.
    expect(keys(shown)).toEqual(["chat:a", "rule:esim"]);
  });

  it("a rule's key dismissed or added doesn't show again; put back to open, the rule shows it again", () => {
    const r = rule("rule:insurance", "insurance");
    let stored = withState([], r, "dismissed", 10);
    expect(stored).toEqual([{ ...r, state: "dismissed", stateAt: 10 }]);
    expect(shownSuggestions(stored, [r])).toEqual([]);
    stored = withState(stored, r, "open", 11);
    expect(stored).toEqual([]);
    expect(keys(shownSuggestions(stored, [r]))).toEqual(["rule:insurance"]);
    expect(shownSuggestions(withState([], r, "added", 12), [r])).toEqual([]);
  });

  it("a dismissed key never comes back from any source, nor its topic (a vehicle, insurance, an eSIM)", () => {
    const stored = withState([], chat("chat:transport:moto:aylik-motor", "moto"), "dismissed", 5);
    expect(mergeIncoming(stored, [chat("chat:transport:moto:aylik-motor", "moto")]).outcomes).toEqual(["dismissed_before"]);
    expect(mergeIncoming(stored, [chat("ai:transport:car:aylik-araba", "car")]).outcomes).toEqual(["dismissed_before"]);
    const ok = mergeIncoming(stored, [chat("chat:todo:todo:pirinc-teraslari", "todo", "todo")]);
    expect(ok.outcomes).toEqual(["added"]);
    expect(ok.list).toHaveLength(2);
    expect(mergeIncoming(ok.list, [chat("chat:todo:todo:pirinc-teraslari", "todo", "todo")]).outcomes).toEqual(["already_there"]);
    // The rule's dismissed vehicle hides a chat suggestion of a vehicle on the board, too.
    const ruleGone = withState([], rule("rule:monthly-vehicle:ubud", "moto"), "dismissed", 6);
    expect(shownSuggestions([...ruleGone, chat("chat:x", "car")], [])).toEqual([]);
  });

  it("the chat repeating what a rule shows isn't a second card; an AI suggestion put back opens again", () => {
    expect(keys(shownSuggestions([chat("chat:x", "insurance", "other")], [rule("rule:insurance", "insurance")]))).toEqual(["rule:insurance"]);
    const ai: Suggestion = { ...chat("ai:x", "todo", "todo"), source: "ai" };
    const gone = withState([ai], ai, "dismissed", 7);
    expect(shownSuggestions(gone, [])).toEqual([]);
    expect(keys(shownSuggestions(withState(gone, ai, "open", 8), []))).toEqual(["ai:x"]);
  });
});

describe("a suggestion from the model, checked", () => {
  const input = { section: "transport", kind: "add", title: "Aylık motor kiralama", why: "Ubud'da bir ay kalıyorsun; aylık kiralama günlükten genellikle çok daha ucuzdur.", template: "moto", city: "Ubud", start: "", end: "" };

  it("passes a good one, keyed by source, section, template and title", () => {
    const s = checkSuggestionInput(input, "chat", 9) as Suggestion;
    expect(s).toMatchObject({ key: "chat:transport:moto:aylik-motor-kiralama", section: "transport", template: "moto", source: "chat", state: "open", createdAt: 9, payload: { city: "Ubud", start: null, end: null } });
  });

  it("refuses prices, times, percentages, two sentences", () => {
    expect(typeof checkSuggestionInput({ ...input, why: "Günlükten ~%60 ucuz." }, "ai", 1)).toBe("string");
    expect(typeof checkSuggestionInput({ ...input, why: "Aylık 80 € civarı." }, "ai", 1)).toBe("string");
    expect(typeof checkSuggestionInput({ ...input, title: "Taksi 23:30" }, "ai", 1)).toBe("string");
    expect(typeof checkSuggestionInput({ ...input, why: "Uzun kalıyorsun. Ucuz olur." }, "ai", 1)).toBe("string");
  });

  it("refuses a section or kind that isn't allowed, and a template of another section", () => {
    expect(typeof checkSuggestionInput({ ...input, section: "inspo" }, "ai", 1)).toBe("string");
    expect(typeof checkSuggestionInput({ ...input, kind: "todo" }, "ai", 1)).toBe("string");
    expect(checkSuggestionInput({ ...input, section: "todo" }, "chat", 1)).toMatch(/transport/);
    expect(typeof checkSuggestionInput({ ...input, kind: "warning" }, "ai", 1)).toBe("string");
    expect(typeof checkSuggestionInput({ ...input, template: "" }, "ai", 1)).toBe("string"); // Ulaşım has many templates
    expect(typeof checkSuggestionInput({ ...input, start: "12 Aralık" }, "ai", 1)).toBe("string");
  });

  it("picks a section's only template when none was given, and makes the idea under its own name", () => {
    const s = checkSuggestionInput({ ...input, section: "todo", template: "", title: "Tegallalang pirinç terasları", why: "Ubud'a yakın, sabah erken sakin olur." }, "ai", 1) as Suggestion;
    expect(s.template).toBe("todo");
    expect(suggestedItem(s, "t1", "x", 2)).toMatchObject({ name: "Tegallalang pirinç terasları", plannedKind: "todo", booking: "none", city: "Ubud" });
  });

  it("a warning has nothing to add", () => {
    const s = checkSuggestionInput({ ...input, section: "flight", kind: "warning", template: "", title: "Aktarma kısa", why: "İki ayrı bilet var." }, "chat", 1) as Suggestion;
    expect(suggestedItem(s, "t1", "x", 2)).toBeNull();
  });
});

describe("suggestions never count", () => {
  it("leave the plan, the sections' x/y, the hero's tallies and the day flow as they are", () => {
    const items = [stay("Ubud", "2026-12-10", "2027-01-10"), flight("IST", "DPS", "2026-12-10T08:00", "2026-12-10T23:30")];
    const bare = trip();
    const withSome = trip({ suggestions: [{ key: "chat:x", section: "transport", kind: "add", title: "Aylık motor", why: "x", source: "chat", template: "moto", createdAt: 1, state: "open" }] });
    const view = (t: Trip) => {
      const plan = buildPlan(t, items);
      const legs = buildLegs(plan, t);
      const timeline = buildTimeline(plan, legs, items);
      const sections = categorize({ plan, timeline, items, legs, today: TODAY });
      return { plan, timeline, progress: planProgress(sections), tally: sectionTally(sections), counts: sections.map((s) => [s.id, s.settled, s.entries.length]) };
    };
    expect(JSON.stringify(view(withSome))).toBe(JSON.stringify(view(bare)));
    // The rules' own suggestions are worked out beside the plan, never inside it.
    expect(rulesFor(items).length).toBeGreaterThan(0);
  });

  it("each section's templates are its own '+ Ekle' tiles", () => {
    for (const [id, templates] of Object.entries(SECTION_TEMPLATES)) expect(templates).toEqual(SECTION_META[id as keyof typeof SECTION_META].templates);
  });
});
