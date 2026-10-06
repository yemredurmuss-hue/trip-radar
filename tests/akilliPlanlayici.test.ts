// tests/akilliPlanlayici.test.ts — Akıllı planlayıcı (spec 2026-10-07-akilli-planlayici): the model understands what
// the trip is for and plans what it needs. Its playbook is checked piece by piece (a sea is never a city), a trip for
// one experience only gets no tours and no other stops, a liveaboard sleeps on the boat (no hotel to find), and what
// must hold ("babam merdiven çıkamaz", "özel araç") reaches the stay picks, the transfer and the suggestions alike.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setLang, withLang } from "../src/lib/i18n";
import { allowedSuggestions, isOwnStay, notAPlace, playbookPromptLine, realPlace, startPlaybook, validModelPlaybook, type RawPlan } from "../src/lib/playbooks";
import { planSummary, playbookCards, wouldMake } from "../src/lib/startCreate";
import {
  acceptExtraction, applyAnswer, applyText, circuitRoute, creationOf, knownLines, mergeExtracted, newStart, nextQuestion, parseStartText, pbAsks, turnSchema, wantsRouteAdvice,
  withTypedLang, type RawExtraction, type StartState,
} from "../src/lib/startTrip";
import { reviewSystem } from "../src/lib/suggestReview";
import { pickThree } from "../src/lib/stayPicks";
import type { StayCandidate } from "../src/lib/offerSources";
import type { Suggestion } from "../src/lib/types";
import { schemaLoad, fitsStrict } from "../src/lib/llm/schemaBudget";
import { z } from "zod";

const TODAY = "2026-10-07";

const raw = (over: Partial<RawExtraction> & { plan?: RawPlan }): RawExtraction & { plan?: RawPlan } => ({
  destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0,
  duration_days: 0, duration_months: 0, styles: [], budget: "", ...over,
});

const NONE = { card: "", to: "", n: 0, amount: 0, currency: "", items: [] as string[] };
const plan = (over: Partial<RawPlan>): RawPlan => ({
  label: "", base: "classic", focus: "around", stay_type: "hotel", stay_port: "", cards: [], questions: [], blocked_sections: [], blocked_words: [], prep: [], tip: "", tone: "", avoid: "", musts: [], ...over,
});

/** One typed line as the chat takes it: the code's reading and the model's. */
function typed(s: StartState, text: string, model: (Partial<RawExtraction> & { plan?: RawPlan }) | null = null, at = 2): StartState {
  const before = withTypedLang(s, text);
  const q = nextQuestion(before);
  const asked = { ...before, messages: [...before.messages, { role: "user" as const, text, at }] };
  return withLang(before.lang, () => {
    const read = mergeExtracted(parseStartText(text, TODAY, q), model ? acceptExtraction(raw(model), TODAY) : null);
    const out = applyText(asked, text, read, at, q);
    return out.understood ? out.state : asked;
  });
}

const LIVEABOARD = plan({
  label: "Kızıldeniz liveaboard dalış gezisi", focus: "only", stay_type: "boat", stay_port: "Hurgada",
  cards: [
    { ref: "transfer", kind: "transfer", title: "Limana transfer", place: "Hurgada", anchor: "arrive" },
    { ref: "gear", kind: "activity", title: "Dalış ekipmanı kiralama", place: "Red Sea", anchor: "stay" },
  ],
  questions: [{ id: "gear", text: "Kendi ekipmanın var mı?", chips: [
    { value: "own", label: "Var", aliases: ["var"], effects: [{ ...NONE, op: "dropCard", card: "gear" }] },
    { value: "rent", label: "Kiralayacağım", aliases: ["kira"], effects: [] },
  ] }],
  prep: ["Dalış sertifikası"], tip: "Uçuşla son dalış arasında en az 18 saat bırak.",
  musts: [{ id: "level", text: "İleri seviye dalgıç" }],
});

/** "Kasımda Kızıldeniz'de bir haftalık liveaboard dalış, ileri seviyeyim", from İstanbul, alone, the 10th. */
function liveaboard(): StartState {
  let s = typed(newStart("lb", "plan", 1, "tr"), "Kasımda Kızıldeniz'de bir haftalık liveaboard dalış, ileri seviyeyim", {
    destination: "Kızıldeniz", destination_country: "Mısır", destination_country_code: "EG", start_date: "2026-11-10", duration_days: 8, plan: LIVEABOARD,
  });
  s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
  return s;
}

beforeEach(() => setLang("tr"));
afterEach(() => setLang("tr"));

describe("the model's playbook, checked", () => {
  it("keeps what holds and drops the rest, piece by piece", () => {
    const p = validModelPlaybook(plan({
      label: "Liveaboard", stay_type: "boat", stay_port: "Red Sea",
      cards: [
        { ref: "Gear", kind: "activity", title: "Ekipman", place: "Kızıldeniz", anchor: "stay" },
        { ref: "x", kind: "stay", title: "Otel", place: "Hurgada", anchor: "stay" },
        { ref: "y", kind: "flight", title: "Uçuş", place: "", anchor: "arrive" },
        { ref: "gear", kind: "todo", title: "İkinci", place: "", anchor: "stay" },
      ],
      questions: [1, 2, 3, 4].map((i) => ({ id: `q${i}`, text: `Soru ${i}?`, chips: [
        { value: "a", label: "A", aliases: [], effects: [{ ...NONE, op: "dropCard", card: "nope" }, { ...NONE, op: "teleport" }, { ...NONE, op: "dropCard", card: "GEAR" }] },
      ] })),
      blocked_sections: ["activity", "flight", "nonsense"],
      musts: [{ id: "step_free", text: "Babam merdiven çıkamaz" }, { id: "whatever", text: "Glütensiz" }],
    }))!;
    // A sea is never the port; the card's "Kızıldeniz" becomes no place (the destination's then).
    expect(p.stayPort).toBeNull();
    expect(p.cards).toEqual([{ ref: "gear", kind: "activity", title: "Ekipman", place: null, anchor: "stay" }]);
    expect(p.questions.length).toBe(3);
    expect(p.questions[0].chips[0].effects).toEqual([{ op: "dropCard", card: "gear" }]);
    expect(p.blocked.sections).toEqual(["activity"]);
    expect(p.musts).toEqual([{ id: "step_free", text: "Babam merdiven çıkamaz" }, { id: "other", text: "Glütensiz" }]);
  });
  it("is none without a label", () => {
    expect(validModelPlaybook(plan({ label: "" }))).toBeNull();
    expect(validModelPlaybook(null)).toBeNull();
  });
  it("tells a sea from a town", () => {
    for (const x of ["Red Sea", "Kızıldeniz", "Ege Denizi", "Akdeniz", "Indian Ocean", "Persian Gulf"]) expect(notAPlace(x)).toBe(true);
    for (const x of ["Hurgada", "Denizli", "Marsa Alam", "Fethiye"]) expect(realPlace(x)).toBe(x);
  });
  it("stays inside Claude's strict schema limits", () => {
    const load = schemaLoad(z.toJSONSchema(turnSchema));
    expect(fitsStrict(load)).toBe(true);
  });
});

describe("a liveaboard: sleeps on the boat, flies to the port", () => {
  it("is understood as its own kind, the model's playbook kept and said back", () => {
    const s = liveaboard();
    expect(startPlaybook(s)).toBe("custom");
    expect(s.playbook?.label).toBe("Kızıldeniz liveaboard dalış gezisi");
    expect(withLang("tr", () => knownLines(s, { myName: null, fromGuess: null, today: TODAY }))).toContain("Kalıp hazır: Kızıldeniz liveaboard dalış gezisi");
    expect(pbAsks(s).map((a) => a.key)).toEqual(["custom:gear"]);
  });
  it("never makes the sea a city: the nights are on the boat from Hurgada, the flight goes there", () => {
    const c = creationOf(liveaboard())!;
    expect(c.stays.map((x) => [x.city, x.title])).toEqual([["Hurgada", "Liveaboard · Hurgada"]]);
    expect(c.travel[0]).toMatchObject({ kind: "flight", from: "İstanbul" });
    expect(c.travel[0].to).not.toMatch(/Kızıldeniz|Red Sea/);
    expect(c.stayAs).toEqual({ kind: "boat", city: "Hurgada" });
  });
  it("makes the boat a boat (no hotel to find), the transfer and the gear, and keeps the musts", () => {
    const made = wouldMake(liveaboard())!;
    const stay = made.items.find((i) => i.category === "stay")!;
    expect(stay.metrics?.stayKind).toBe("boat");
    expect(isOwnStay(stay)).toBe(true);
    expect(made.items.find((i) => i.name === "Limana transfer")).toMatchObject({ category: "transport" });
    expect(made.items.find((i) => i.name === "Dalış ekipmanı kiralama")).toMatchObject({ category: "activity", city: "Hurgada" });
    expect(made.trip.intent).toMatchObject({ playbook: "custom", label: "Kızıldeniz liveaboard dalış gezisi", musts: [{ id: "level", text: "İleri seviye dalgıç" }] });
  });
  it("drops the gear when they have their own", () => {
    let s = liveaboard();
    s = applyAnswer(s, { q: "pb", key: "custom:gear", value: "own" }, 4);
    expect(playbookCards(s, creationOf(s)!).plan.map((x) => x.title)).not.toContain("Dalış ekipmanı kiralama");
  });
});

describe("one experience only: no tours, no other stops", () => {
  it("draws no route round the country and suggests no tours", () => {
    let s = typed(newStart("eg", "plan", 1, "tr"), "Sadece dalış için Tayland'a 10 gün gidip geleceğim", {
      destination: "Tayland", destination_country: "Tayland", destination_country_code: "TH", start_date: "2026-11-10", duration_days: 11,
      plan: plan({ label: "Tayland'da dalış", focus: "only", cards: [{ ref: "dive", kind: "activity", title: "Dalış paketi", place: "", anchor: "stay" }] }),
    });
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    expect(wantsRouteAdvice(s)).toBe(false);
    expect(circuitRoute(s)).toBeNull();
    const intent = wouldMake(s)!.trip.intent!;
    const tour: Suggestion = { key: "ai:a", section: "activity", kind: "add", title: "Bangkok şehir turu", why: "x", source: "ai", createdAt: 1, state: "open" };
    const visa: Suggestion = { ...tour, key: "ai:b", section: "todo", title: "Tayland vizesi" };
    expect(allowedSuggestions(intent, [tour, visa])).toEqual([visa]);
    expect(reviewSystem(intent)).toContain("yalnız bu deneyim için");
  });
  it("leaves a holiday around it as it was", () => {
    const s = typed(newStart("eg2", "plan", 1, "tr"), "Tayland'a 10 gün, biraz dalış biraz gezi", {
      destination: "Tayland", destination_country: "Tayland", destination_country_code: "TH", start_date: "2026-11-10", duration_days: 11,
      plan: plan({ label: "Tayland gezisi", focus: "around" }),
    });
    // Only a label: the trip stays classic, made as before.
    expect(startPlaybook(s)).toBe("classic");
    expect(circuitRoute(s)).not.toBeNull();
  });
});

describe("what must hold, the same everywhere", () => {
  const rome = (musts: RawPlan["musts"]) => {
    let s = typed(newStart("ro", "plan", 1, "tr"), "Babamla Roma'ya 4 gün, babam merdiven çıkamaz, özel araç olsun", {
      destination: "Roma", destination_country: "İtalya", destination_country_code: "IT", start_date: "2026-11-10", duration_days: 5,
      plan: plan({ label: "Babayla Roma", musts }),
    });
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    return s;
  };
  it("a classic trip keeps its shape and carries the musts", () => {
    const s = rome([{ id: "step_free", text: "Babam merdiven çıkamaz" }]);
    expect(startPlaybook(s)).toBe("classic");
    const made = wouldMake(s)!;
    expect(made.trip.intent).toEqual({ playbook: "classic", label: "Babayla Roma", musts: [{ id: "step_free", text: "Babam merdiven çıkamaz" }] });
    expect(made.trip.wantedAmenities).toEqual(["asansör", "engelli erişimi"]);
    expect(withLang("tr", () => playbookPromptLine(s))).toContain("Babam merdiven çıkamaz");
  });
  it("step-free: the stay picks put the hotel with a lift first", () => {
    const made = wouldMake(rome([{ id: "step_free", text: "Babam merdiven çıkamaz" }]))!;
    const cand = (id: string, labels: string[]): StayCandidate => ({
      id, name: id, rating: 4.5, reviews: 400, photo: null, geo: null, area: null, labels, url: `https://x/${id}`, nightly: 120, total: 480, nights: 4, priceRange: null, source: "x", currency: "EUR", fetchedAt: 1,
    });
    const cheap = { ...cand("Z", []), nightly: 70, total: 280 };
    const comfy = { ...cand("Y", []), rating: 4.9, nightly: 260, total: 1040 };
    const picks = pickThree([cand("A", []), cand("B", ["Asansör"]), cheap, comfy], { centre: null, trip: made.trip });
    expect(picks.best?.cand.id).toBe("B");
  });
  it("a car of their own: a private transfer is opened, a shared ride never suggested", () => {
    const s = rome([{ id: "private_transfer", text: "Özel araç olsun" }]);
    const c = creationOf(s)!;
    expect(playbookCards(s, c).travel).toEqual([expect.objectContaining({ kind: "transfer", title: "Özel transfer", to: "Roma" })]);
    const intent = wouldMake(s)!.trip.intent!;
    const shared: Suggestion = { key: "r:a", section: "transport", kind: "add", title: "Paylaşımlı havalimanı transferi", why: "x", source: "ai", createdAt: 1, state: "open" };
    const taxi: Suggestion = { ...shared, key: "r:b", title: "Havalimanı taksisi" };
    expect(allowedSuggestions(intent, [shared, taxi])).toEqual([taxi]);
    expect(reviewSystem(intent)).toContain("Özel araç olsun");
  });
});

describe("a camper van tour: nights in the van", () => {
  it("makes every night a van night and the camper rental its own card", () => {
    let s = typed(newStart("cv", "plan", 1, "tr"), "Toskana'da 7 gün karavanla gezmek istiyoruz", {
      destination: "Floransa", destination_country: "İtalya", destination_country_code: "IT", start_date: "2026-11-10", duration_days: 8,
      plan: plan({ label: "Toskana karavan turu", stay_type: "vehicle", cards: [{ ref: "rv", kind: "rv_rental", title: "Karavan kiralama", place: "Floransa", anchor: "stay" }] }),
    });
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    const made = wouldMake(s)!;
    const stays = made.items.filter((i) => i.category === "stay");
    expect(stays.length).toBeGreaterThan(0);
    expect(stays.every((x) => x.metrics?.stayKind === "vehicle")).toBe(true);
    expect(made.items.find((i) => i.name === "Karavan kiralama")).toMatchObject({ category: "transport", city: "Floransa" });
  });
});

describe("a kind with a playbook of its own keeps it", () => {
  it("Ozora stays the festival's (its tested cards), the model's musts go on", () => {
    let s = typed(newStart("oz", "plan", 1, "tr"), "Ozora festivaline gitmek istiyorum, glütensiz yiyorum", {
      event: "Ozora Festival", event_kind: "event", event_place: "Ozora", event_country_code: "HU", destination_country: "Macaristan", event_start: "2027-07-27", event_end: "2027-08-02",
      plan: plan({ label: "Ozora Festivali", base: "festival", focus: "only", cards: [{ ref: "x", kind: "activity", title: "Başka bir şey", place: "", anchor: "stay" }], musts: [{ id: "diet", text: "Glütensiz" }] }),
    });
    s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
    expect(startPlaybook(s)).toBe("festival");
    const made = wouldMake(s)!;
    expect(made.items.some((i) => i.name === "Festival bileti")).toBe(true);
    expect(made.items.some((i) => i.name === "Başka bir şey")).toBe(false);
    expect(made.trip.intent).toMatchObject({ playbook: "festival", label: "Ozora Festivali", musts: [{ id: "diet", text: "Glütensiz" }] });
    expect(made.trip.intent?.custom).toBeUndefined();
  });
});

describe("the plan said back before it's made", () => {
  it("gives the route with the boat marked, the days, the concept and what must hold", () => {
    const sum = planSummary(liveaboard(), { myName: null })!;
    expect(sum.rows.map((r) => r.label)).toEqual(["Rota", "Tarih", "Konsept"]);
    expect(sum.rows[0].value).toContain("⛴ Hurgada");
    expect(sum.rows[0].value).not.toMatch(/Kızıldeniz/);
    expect(sum.rows[2].value).toBe("Kızıldeniz liveaboard dalış gezisi · yalnız bu deneyim");
    expect(sum.musts).toEqual(["İleri seviye dalgıç"]);
  });
});
