// The v82 Plan's view model (lib/intents.ts, v82 geçişi aşama 0): every intent in one of the eight states from the plan as
// categories.ts builds it, the head never repeating the trip's head count, the wants only as ✓ / ✕ (B5), an estimate only
// from three real prices (B4), a booking's code always there (B1) with "… ödendi" (B10), "Önerimiz" on a train and an eSIM
// too (B2), and the hero's two shares (B9).
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { showBookingRef } from "../src/lib/cardTime";
import { categorize } from "../src/lib/categories";
import { db, listItems } from "../src/lib/db";
import { decideTrip, makeContext } from "../src/lib/decision";
import { loadDemoTrip } from "../src/lib/demo";
import { draftOf } from "../src/lib/draft";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { withLang } from "../src/lib/i18n";
import { bookedShare, collectionsOf, collectionSummary, frameOf, planShare, statusWord, suggestsFor, type IntentInput, type IntentStatus, type IntentVM } from "../src/lib/intents";
import { EMPTY_METRICS } from "../src/lib/items";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { isPlaceholder } from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

const TODAY = "2026-10-01";
const base: Trip = {
  id: "t1", title: "Japonya", confirmedDates: { start: "2026-11-01", end: "2026-11-07" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1,
  travellers: { names: [], count: 2 },
};
const eur = (amount: number | null, scope: Item["price"]["scope"] = "total"): Item["price"] => ({ amount, currency: "EUR", scope, taxesIncluded: "yes", source: "page", observedAt: 1 });
const two = { adults: 2, children: null, rooms: 1 };
const metrics = (over: Partial<NonNullable<Item["metrics"]>>) => ({ ...EMPTY_METRICS, ...over });

let n = 0;
const next = (p: string) => `${p}${++n}`;
const flight = (from: string, to: string, day: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    id: next("f"), name: `${from}-${to}`, category: "flight", needKey: `flight:${from}-${to}`.toLowerCase(), city: to === "IST" ? "İstanbul" : "Tokyo", countryCode: "JP", status,
    dates: { start: day, end: null, source: "page" }, guests: two, price: eur(800),
    flight: { from, to, departure: `${day}T10:00`, arrival: `${day}T20:00`, carrier: null, flightNumber: null, stops: 0 }, ...over,
  });
const stay = (name: string, city: string, start: string, end: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({ id: next("s"), name, category: "stay", city, countryCode: "JP", needKey: `stay:${city.toLowerCase()}`, dates: { start, end, source: "url" }, guests: two, price: eur(600), status, ...over });
const ride = (name: string, kind: Item["plannedKind"], from: string, to: string, day: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    id: next("r"), name, category: "transport", plannedKind: kind, needKey: `transport:${from}-${to}`.toLowerCase(), city: to, countryCode: "JP", status, guests: two, price: eur(100),
    dates: { start: day, end: null, source: "page" }, flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T11:00`, carrier: null, flightNumber: null, stops: 0 }, ...over,
  });
const esim = (name: string, amount: number) =>
  makeItem({ id: next("e"), name, category: "esim", needKey: "esim:jp", city: null, country: "Japonya", countryCode: "JP", status: "saved", price: eur(amount) });

/** The board as TripPanel builds it (its decisions, its stageCtx), and the v82 categories on it. */
function board(trip: Trip, items: Item[], extra: Partial<IntentInput> = {}) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const decisions = decideTrip(items, ctx);
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const hidden = new Set(trip.hidden ?? []);
  const timeline = buildTimeline(plan, legs, items, hidden);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, hidden, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, decisions, ctx, ...extra };
  const all = collectionsOf(input);
  const intents = all.flatMap((c) => c.intents);
  return { input, decisions, all, intents, of: (name: string) => intents.find((i) => i.head.name === name)! };
}
const statuses = (all: ReturnType<typeof board>["all"]) => Object.fromEntries(all.map((c) => [c.section.id, c.intents.map((i) => i.status)]));

describe("the sample trip (Portekiz): each intent's state, its closed row, the hero's shares", () => {
  it("draws every need of the plan in one of the eight states", async () => {
    const id = await loadDemoTrip({ today: "2026-10-05" });
    const trip = (await (await db()).get("trips", id))!;
    const items = await listItems(id);
    const { ctx, decisions } = await loadDecisions(trip, items);
    const plan = buildPlan(trip, items);
    const legs = buildLegs(plan, trip, ctx.listings);
    const sections = categorize({ plan, timeline: buildTimeline(plan, legs, items), items, legs, today: "2026-10-05" });
    const all = collectionsOf({ trip, plan, sections, items, today: "2026-10-05", decisions, ctx });
    expect(statuses(all)).toEqual({
      flight: ["suggested", "booked"],
      stay: ["suggested", "booked"],
      // B2: the train's and the eSIM's best option stands as "Önerimiz" too.
      transport: ["suggested"],
      activity: ["chosen"],
      todo: ["deciding"],
      other: ["suggested"],
    });
    const row = (id: string) => all.find((c) => c.section.id === id)!.summary;
    expect(row("flight")).toMatchObject({ name: "Uçuş", line: "2 uçuş · gidiş ve dönüş · 3 fikir", countsText: "1 alındı · 1 karar", bar: { booked: 50, chosen: 0 } });
    expect(row("stay")).toMatchObject({ line: "2 şehir · 6 gece · 4 fikir", countsText: "1 alındı · 1 karar", spent: { amount: 390, currency: "EUR" } });
    expect(row("transport").line).toBe("1 yolculuk · tren · 1 fikir");
    expect(row("activity").countsText).toBe("1 planda");
    // The flight home is bought and has no file, three days before the trip: its box says so (B15), and what it cost (B10).
    const home = all.find((c) => c.section.id === "flight")!.intents[1];
    expect(home.frame).toBe("ticket");
    expect(home.paid).toMatch(/ödendi$/);
    expect(home.access).toMatchObject({ docMissing: true, doc: { count: 0, name: null } });
    // B9: on the plan are the two bookings and the activity on the plan; the drafts are not (they wait to be taken).
    const intents = all.flatMap((c) => c.intents);
    expect(planShare(intents)).toEqual({ count: 3, total: 8, pct: 38 });
    expect(bookedShare(intents)).toEqual({ count: 2, total: 8, pct: 25 });
  });
});

describe("one choice: flights, stays, ways of travel, an eSIM", () => {
  const out = flight("IST", "HND", "2026-11-01", "booked", { bookingRef: "K7T2QX", price: eur(1580) });
  const back = [
    flight("HND", "IST", "2026-11-07", "saved", { price: eur(700), metrics: metrics({ durationMinutes: 700 }) }),
    flight("HND", "IST", "2026-11-07", "saved", { price: eur(650), metrics: metrics({ durationMinutes: 840 }) }),
  ];
  const trains = [ride("Nozomi", "train", "Tokyo", "Kyoto", "2026-11-04", "saved", { price: eur(104, "per_person") }), ride("Hikari", "train", "Tokyo", "Kyoto", "2026-11-04", "saved", { price: eur(95, "per_person") })];
  const pickup = ride("Otelin servisi", "transfer", "HND", "Hyatt", "2026-11-01", "chosen", { noBooking: 1, arranged: true, city: "Tokyo", price: eur(null) });
  const items = [
    out,
    ...back,
    stay("Hyatt", "Tokyo", "2026-11-01", "2026-11-04", "chosen"),
    stay("Ryokan A", "Kyoto", "2026-11-04", "2026-11-07", "saved", { price: eur(null) }),
    stay("Ryokan B", "Kyoto", "2026-11-04", "2026-11-07", "saved", { price: eur(null) }),
    ...trains,
    pickup,
    esim("Airalo Japonya 10 GB", 9),
    esim("Holafly sınırsız", 34),
  ];
  const b = board(base, items);

  it("each need in its state and its frame", () => {
    expect(b.of("İstanbul → HND")).toMatchObject({ section: "flight", frame: "ticket", status: "booked", word: "Alındı" });
    expect(b.of("HND → İstanbul")).toMatchObject({ status: "suggested", word: "Önerimiz" });
    expect(b.of("Tokyo")).toMatchObject({ section: "stay", frame: "stay", status: "chosen", word: "Seçildi" });
    // Two places with no price: nothing to stand as our pick, a decision to make.
    expect(b.of("Kyoto")).toMatchObject({ status: "deciding", word: "Karar bekliyor", estimate: null });
    expect(b.of("Tokyo → Kyoto")).toMatchObject({ section: "transport", status: "suggested", head: { kindWord: "Tren" } });
    const arranged = b.intents.find((i) => i.itemIds.includes(pickup.id))!;
    expect(arranged).toMatchObject({ section: "transport", status: "arranged", word: "Ayarlandı", note: "sen hallettin" });
    expect(b.intents.find((i) => i.section === "other")).toMatchObject({ frame: "stay", kind: "esim", status: "suggested", head: { name: "eSIM · Japonya" } });
    expect(frameOf("activity")).toBe("collection");
  });

  it("B2: a train and an eSIM have our pick here; the old cards' draft stays a flight's and a stay's", () => {
    const d = b.decisions.get([...b.decisions.keys()].find((k) => b.decisions.get(k)!.options.some((o) => o.item.id === trains[0].id))!)!;
    expect(draftOf(trains, d)).toBeNull();
    expect(draftOf(trains, d, suggestsFor)?.id).toBe(b.of("Tokyo → Kyoto").chosen?.id);
    expect(b.of("Tokyo → Kyoto").options.filter((o) => o.ours)).toHaveLength(1);
  });

  it("the head: the trip's own head count is never written; a different one is", () => {
    const parts = b.intents.flatMap((i) => i.head.parts);
    expect(parts.some((p) => /kişi/.test(p))).toBe(false);
    expect(b.of("İstanbul → HND").head).toMatchObject({ route: { from: "İstanbul", to: "HND" }, parts: ["IST → HND", "1 Kas"] });
    expect(b.of("Tokyo").head.parts).toEqual(["3 gece", "1–4 Kasım"]);
    // One person on a trip for two says so; told the hero's count is one, it doesn't.
    const solo = [stay("Hyatt", "Tokyo", "2026-11-01", "2026-11-04", "chosen", { guests: { adults: 1, children: null, rooms: 1 } })];
    expect(board(base, solo).of("Tokyo").head.parts).toEqual(["3 gece", "1–4 Kasım", "1 kişi"]);
    expect(board(base, solo, { people: 1 }).of("Tokyo").head.parts).toEqual(["3 gece", "1–4 Kasım"]);
  });

  it("the options: best fit first, the first three and how many, En ucuz and En hızlı", () => {
    const home = b.of("HND → İstanbul");
    expect(home.optionCount).toBe(2);
    expect(home.options.map((o) => o.place)).toEqual([1, 2]);
    const cheap = home.options.find((o) => o.badges.includes("cheapest"))!;
    const fast = home.options.find((o) => o.badges.includes("fastest"))!;
    expect(cheap.item.price.amount).toBe(650);
    expect(fast.item.metrics?.durationMinutes).toBe(700);
    expect(home.options.every((o) => o.leg != null && o.ticket != null)).toBe(true);
  });

  it("B1 and B10: a booking's code is there long before the flight, and what was paid", () => {
    const booked = b.of("İstanbul → HND");
    expect(showBookingRef(out, TODAY)).toBe(false);
    expect(booked.access?.code).toEqual({ label: "PNR", value: "K7T2QX" });
    expect(booked.paid).toBe("€1.580 ödendi");
    expect(booked.access?.docMissing).toBe(false); // a month away: "belge yok" waits for the last two weeks
    expect(b.of("Tokyo").access).toBeNull();
  });
});

describe("B5: the wants only as ✓ or ✕", () => {
  it("a must the page doesn't answer isn't drawn, and the cancel chip doesn't repeat it", () => {
    const trip: Trip = { ...base, requirements: [{ kind: "free_cancellation" }] };
    const items = [
      stay("Ücretsiz", "Tokyo", "2026-11-01", "2026-11-04", "saved", { metrics: metrics({ cancellationType: "free" }), cancellation: { summary: "Ücretsiz iptal", freeUntil: "2026-10-20", source: "page" } }),
      stay("İadesiz", "Tokyo", "2026-11-01", "2026-11-04", "saved", { price: eur(500), metrics: metrics({ cancellationType: "non_refundable" }) }),
      stay("Bilinmez", "Tokyo", "2026-11-01", "2026-11-04", "saved", { price: eur(550) }),
    ];
    const tokyo = board(trip, items).of("Tokyo");
    expect(tokyo.head.wants).toEqual([{ label: "Ücretsiz iptal", must: true }]);
    const checks = Object.fromEntries(tokyo.options.map((o) => [o.title, o.checks.map((c) => c.ok)]));
    expect(checks).toEqual({ Ücretsiz: [true], İadesiz: [false], Bilinmez: [] });
    expect(tokyo.options.every((o) => o.cancel === null)).toBe(true);
    // Without that must, the chip says it in short.
    const plain = board(base, items).of("Tokyo");
    expect(plain.options.find((o) => o.title === "İadesiz")?.cancel).toBe("İade yok");
    expect(plain.options.find((o) => o.title === "Ücretsiz")?.cancel).toBe("Ücretsiz iptal");
  });
});

describe("B4: an estimate only from three real prices, never for insurance", () => {
  const trip: Trip = { ...base, travellers: undefined };
  const stays = [stay("Tokyo", "Tokyo", "2026-11-01", "2026-11-04", "booked"), stay("Kyoto", "Kyoto", "2026-11-04", "2026-11-07", "booked")];
  const bus = (amount: number | null) => ride(`Otobüs ${amount}`, "bus", "Tokyo", "Kyoto", "2026-11-04", "saved", { price: eur(amount) });
  it("two priced options: no range; three: the range", () => {
    expect(board(trip, [...stays, bus(20), bus(40), bus(null)]).of("Tokyo → Kyoto")).toMatchObject({ status: "deciding", estimate: null });
    expect(board(trip, [...stays, bus(20), bus(30), bus(40)]).of("Tokyo → Kyoto")).toMatchObject({ status: "deciding", estimate: { label: "~€20–40", unit: "total", n: 3 } });
  });
  it("insurance has none, whatever its prices", () => {
    const policy = (amount: number) =>
      makeItem({ id: next("i"), name: `Seyahat sigortası ${amount}`, category: "transport", plannedKind: "insurance", needKey: "insurance:jp", countryCode: "JP", status: "saved", price: eur(amount) });
    const intents = board(trip, [...stays, policy(25), policy(35), policy(45)]).intents.filter((i) => i.kind === "insurance");
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ status: "deciding", estimate: null });
  });
});

describe("what's missing, said not needed, covered by a ticket", () => {
  it("a trip with nights and nothing else: the ways in and home to find; nights said not needed fold away, out of the shares", () => {
    const trip: Trip = { ...base, hidden: ["nights:2026-11-04_2026-11-07"] };
    const b = board(trip, [stay("Hyatt", "Tokyo", "2026-11-01", "2026-11-04", "booked")]);
    expect(b.all.find((c) => c.section.id === "flight")!.intents.map((i) => i.status)).toEqual(["searching", "searching"]);
    const stays = b.all.find((c) => c.section.id === "stay")!;
    expect(stays.intents.map((i) => i.status)).toEqual(["booked", "skipped"]);
    expect(stays.summary.counts.skipped).toBe(1);
    expect(stays.summary.bar.booked).toBe(100);
    expect(planShare(b.intents)).toEqual({ count: 1, total: 3, pct: 33 });
  });

  it("C16: a suggested eSIM or policy is an intent still to find", () => {
    const suggestion = { key: "rule:insurance", section: "other" as const, kind: "add" as const, title: "Seyahat sağlık sigortası", why: "Yurt dışına çıkıyorsun.", source: "rule" as const, template: "insurance", createdAt: 1, state: "open" as const };
    const b = board(base, [stay("Hyatt", "Tokyo", "2026-11-01", "2026-11-04", "booked")], { suggestions: { other: [suggestion] } });
    expect(b.intents.find((i) => i.section === "other")).toMatchObject({ kind: "insurance", status: "searching", word: "Aranıyor", estimate: null, note: "Yurt dışına çıkıyorsun.", head: { name: "Seyahat sağlık sigortası", parts: ["1–7 Kasım"] } });
  });

  // Aşama 3b (spec §1.3, D3): Dahil follows what covers it. A camp made before the trip's parts were kept is covered by
  // the festival's ticket on the plan; with no ticket there it is a stay to find, never "Ayarlandı" by itself.
  it("a festival's camp is covered by its ticket: Dahil", () => {
    const trip: Trip = { ...base, intent: { playbook: "festival" } };
    const camp = stay("Çadır kampı", "Ozora", "2026-11-01", "2026-11-04", "chosen", { noBooking: 1, metrics: metrics({ stayKind: "camp" }), price: eur(null) });
    const ticket = makeItem({ id: next("a"), name: "Festival bileti", category: "activity", needKey: "activity:festival", city: "Ozora", status: "booked", dates: { start: "2026-11-01", end: "2026-11-04", source: "page" }, price: eur(245) });
    const b = board(trip, [camp, ticket]);
    expect(b.of("Ozora")).toMatchObject({ status: "included", word: "Dahil", cover: { by: "festival biletiyle", status: "booked", itemId: ticket.id } });
    expect(board(trip, [camp]).of("Ozora").status).toBe("searching");
    expect(board(base, [camp]).of("Ozora").status).toBe("searching");
  });
});

describe("many picks: things to book and do, one row per city", () => {
  const act = (name: string, status: Item["status"], city = "Tokyo") =>
    makeItem({ id: next("a"), name, category: "activity", needKey: `activity:${name}`, city, countryCode: "JP", status, price: eur(45), dates: { start: "2026-11-02", end: null, source: "page" } });
  const stays = [stay("Hyatt", "Tokyo", "2026-11-01", "2026-11-04", "booked"), stay("Ryokan", "Kyoto", "2026-11-04", "2026-11-07", "booked")];
  it("Planında and Öneriler, the chip counting them", () => {
    const b = board(base, [...stays, act("Shibuya Sky bileti", "booked"), act("teamLab bileti", "chosen"), act("Sumo turu", "saved"), act("Fushimi Inari turu", "saved", "Kyoto")]);
    const rows = b.all.find((c) => c.section.id === "activity")!;
    expect(rows.intents.map((i) => [i.head.name, i.status, i.word])).toEqual([
      ["Tokyo", "chosen", "2 planda · 1 alındı"],
      ["Kyoto", "deciding", "Karar bekliyor"],
    ]);
    expect(rows.intents[0].planned.map((o) => o.title)).toEqual(["Shibuya Sky bileti", "teamLab bileti"]);
    expect(rows.intents[0].options.map((o) => o.title)).toEqual(["Sumo turu"]);
    expect(rows.intents[0].optionCount).toBe(3);
    expect(rows.summary.countsText).toBe("1 alındı · 1 planda · 1 karar");
    expect(rows.summary.line).toBe("2 şehir için · 4 fikir");
  });
  it("every card on the plan bought: the row is bought", () => {
    const b = board(base, [...stays, act("Shibuya Sky bileti", "booked")]);
    expect(b.all.find((c) => c.section.id === "activity")!.intents[0]).toMatchObject({ status: "booked" });
  });
});

describe("B9: the hero's two shares", () => {
  const of = (list: [IntentStatus, number][]): Pick<IntentVM, "status">[] => list.flatMap(([status, k]) => Array.from({ length: k }, () => ({ status })));
  it("the sample in the spec: 15 needs, 8 on the plan (53%), 4 bought (27%)", () => {
    const intents = of([
      ["booked", 3],
      ["arranged", 1],
      ["chosen", 4],
      ["suggested", 1],
      ["deciding", 4],
      ["searching", 2],
      ["skipped", 2],
    ]);
    expect(planShare(intents)).toEqual({ count: 8, total: 15, pct: 53 });
    expect(bookedShare(intents)).toEqual({ count: 4, total: 15, pct: 27 });
  });
  // Aşama 3b (spec §1.3, Emre 18 Ekim): a Dahil box counts as its cover does, no longer "on the plan, never bought".
  it("our pick isn't on the plan until it's taken; what a ticket covers counts as the ticket does; nothing: no percentage", () => {
    expect(planShare(of([["suggested", 2]]))).toEqual({ count: 0, total: 2, pct: 0 });
    const covered = (status: IntentStatus | null) => [{ status: "included" as const, cover: { status } }, { status: "deciding" as const }];
    expect(planShare(covered("booked"))).toEqual({ count: 1, total: 2, pct: 50 });
    expect(bookedShare(covered("booked"))).toEqual({ count: 1, total: 2, pct: 50 });
    expect(planShare(covered("chosen"))).toEqual({ count: 1, total: 2, pct: 50 });
    expect(bookedShare(covered("chosen"))).toEqual({ count: 0, total: 2, pct: 0 });
    expect(planShare(covered("searching"))).toEqual({ count: 0, total: 2, pct: 0 });
    expect(planShare(of([["included", 1], ["deciding", 1]]))).toEqual({ count: 0, total: 2, pct: 0 });
    expect(planShare(of([["skipped", 3]]))).toEqual({ count: 0, total: 0, pct: null });
  });
});

describe("Hazırlık's closed row (aşama 7): the open list's count, the Bavul apart", () => {
  const chore = (name: string, over: Partial<Item> = {}) =>
    makeItem({ id: next("p"), category: "other", needKey: `other:prep-${name}`, name, plannedKind: "prep", origin: "chat", status: "chosen", booking: "none", ...over });
  const items = [
    chore("Decathlon'dan yağmurluk al"),
    chore("Döviz bozdur", { dates: { start: "2026-10-28", end: null, source: "page" }, doneAt: 1 }),
    chore("Vize başvurusu yap", { dates: { start: "2026-10-20", end: null, source: "page" } }),
    // a thing to take: a Bavul line, never one of the chores
    chore("Kulak tıkacı"),
  ];
  const prepRow = (extra: Partial<IntentInput> = {}) => {
    const { input } = board(base, items, extra);
    return collectionSummary(input.sections.find((s) => s.id === "prep")!, [], input);
  };
  it("given the list's own summary, says its line and its count", () => {
    const said = { total: 6, done: 2, next: null, line: "Gezi öncesi 6 iş · sıradaki: Yen bozdur, 31 Eki'den önce", nextText: null };
    expect(prepRow({ prep: said })).toMatchObject({ line: said.line, ready: { done: 2, total: 6 }, bar: { booked: 33, chosen: 0 } });
  });
  it("without it, the stored chores by day, the Bavul's lines left out", () => {
    expect(prepRow()).toMatchObject({ line: "Gezi öncesi 3 iş · sıradaki: Vize başvurusu yap, 20 Eki", ready: { done: 1, total: 3 }, bar: { booked: 33, chosen: 0 } });
    expect(withLang("en", () => prepRow().line)).toBe("3 things before the trip · next: Vize başvurusu yap, 20 Oct");
  });
});

describe("the words", () => {
  it("in both languages", () => {
    expect(statusWord("searching")).toBe("Aranıyor");
    expect(statusWord("booked", "stay")).toBe("Rezerve");
    expect(statusWord("booked", "flight")).toBe("Alındı");
    expect(withLang("en", () => statusWord("deciding"))).toBe("To decide");
    expect(withLang("en", () => statusWord("included"))).toBe("Included");
  });
});
