// On the trip (v83 "gezi sırasında", D8, F2; lib/tripToday.ts and lib/tripPhase.ts): the "Bugün" strip hour by hour with
// the one thing to do with each line, tomorrow's first thing, the flight day as its live data says it (16 Nisan, late);
// the time-led "Sıradaki"; the trip's modes; what's no decision any more on the trip (row 127, H8); the last 14 days and
// 48 hours before (F2).
import { beforeEach, describe, expect, it } from "vitest";
import { withLive } from "../src/lib/flightData";
import { setLang, withLang } from "../src/lib/i18n";
import { bookedShare, planShare } from "../src/lib/intents";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { ruleSuggestions } from "../src/lib/suggestions";
import { buildTimeline } from "../src/lib/timeline";
import { checkinFlights, countedIntents, docsForward, flightFocus, hoursUntil, isMissed, localNow, tripModeOf } from "../src/lib/tripPhase";
import { timedNext, timedNextLabel, todayStrip, type TodayInput, type TodayVM } from "../src/lib/tripToday";
import type { DocMeta, Item } from "../src/lib/types";
import type { FlightLive } from "../supabase/functions/flight/shape";
import { boardOf, INSURANCE, JAPAN_TODAY, japan } from "./fixtures/v82Trips";

/** TK49 on 16 April, 25 minutes late and boarding (AeroDataBox as flightData.ts keeps it). */
const TK49_LATE: FlightLive = {
  number: "TK49", airline: "Turkish Airlines", status: "Boarding",
  departure: { iata: "KIX", airport: "Kansai", scheduled: "2027-04-16T11:00", revised: "2027-04-16T11:25", actual: null, terminal: "1", gate: "21", desk: null },
  arrival: { iata: "IST", airport: "Istanbul", scheduled: "2027-04-16T17:40", revised: "2027-04-16T18:05", actual: null, terminal: null, gate: null, belt: null },
  minutes: 760, fetchedAt: "2027-04-16T01:20:00Z",
};

/** The strip on a day of the trip, at an hour (Japan time is UTC+9: `at` is that moment). */
function stripOn(today: string, time: string, opts: { docs?: string[]; live?: boolean } = {}): { vm: TodayVM | null; t: TodayInput; by: Record<string, Item> } {
  const { trip, items: raw, by } = japan({ during: true });
  const items = opts.live ? raw.map((i) => withLive(i, { "TK49|2027-04-16": { flight: TK49_LATE, at: 1 } })) : raw;
  const b = boardOf(trip, items, today);
  const docsFor = (id: string): DocMeta[] => (opts.docs?.some((n) => items.find((i) => i.id === id)?.name.includes(n)) ? [{ id: `d-${id}`, itemId: id, tripId: trip.id, name: "belge.pdf", type: "application/pdf", size: 1, addedAt: 1 }] : []);
  const [h, m] = time.split(":").map(Number);
  const at = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)), h - 9, m));
  const t: TodayInput = { trip, plan: b.plan, timeline: b.timeline, items, today, time, at, docsFor, weather: [{ city: "Kyoto", high: 18, low: 8, sky: "sun", rainy: 1, days: 4, source: "forecast" }] };
  return { vm: todayStrip(t), t, by };
}
const rows = (vm: TodayVM) => vm.rows.map((r) => [`${r.time ?? ""}${r.estimated ? "~" : ""}`, r.phase, r.kindWord, r.title, r.sub, r.action?.label ?? null]);

beforeEach(() => setLang("tr"));

describe("the Bugün strip on the 6th of April, in Kyoto", () => {
  const { vm, t, by } = stripOn("2027-04-06", "12:40", { docs: ["Fushimi", "Gion Karyo"] });

  it("the day, its city and number, the weather the hero has", () => {
    expect(vm).toMatchObject({ date: "2027-04-06", dayNo: 6, total: 16, city: "Kyoto", title: "6 Nisan Salı · Kyoto · gezinin 6. günü", weather: { sky: "sun", high: 18, text: "18°" } });
  });

  it("hour by hour: what's gone by, what's on now, the next; each with the one thing to do then", () => {
    expect(rows(vm!)).toEqual([
      ["06:00", "past", "Etkinlik", "Fushimi Inari gün doğumu", "Viator · bilet VI-77310", "Bileti aç"],
      ["12:30", "now", "Yapılacak", "Nishiki pazarı", "öğle yemeği · planda", "Haritada aç"],
      ["15:00~", "next", "Konaklama", "Gion Hatanaka · 2. gece", "onay GH-5531", "Otele yaz"],
      ["19:30", "later", "Restoran", "Gion Karyo", "TableCheck · rezervasyon TC-4471", "Rezervasyonu aç"],
    ]);
    const [inari, nishiki, hotel] = vm!.rows;
    expect(inari.action).toEqual({ kind: "doc", label: "Bileti aç", itemId: by.inari.id, url: null });
    expect(nishiki.action?.url).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    expect(hotel.action).toMatchObject({ kind: "host", url: "mailto:info@hatanaka.example" });
    expect(vm!.nowKey).toBe(nishiki.key);
  });

  it("the hero's 'Sıradaki' in time: the next booking of the day, not the hotel's usual hour", () => {
    const next = timedNext(t, vm);
    expect(next).toMatchObject({ kind: "today", row: { title: "Gion Karyo", time: "19:30" } });
    expect(timedNextLabel(next!)).toBe("Sıradaki: Gion Karyo 19:30");
  });

  it("nothing on the 7th: no 'tomorrow' line is made up", () => {
    expect(vm!.tomorrow).toBeNull();
  });

  it("in English", () => {
    const en = withLang("en", () => stripOn("2027-04-06", "12:40").vm!);
    expect(en.title).toBe("Tuesday 6 April · Kyoto · day 6 of the trip");
    expect(en.rows.map((r) => r.kindWord)).toEqual(["Activity", "To-do", "Stay", "Restaurant"]);
    expect(en.rows[2].title).toBe("Gion Hatanaka · night 2");
  });
});

describe("tomorrow's first thing", () => {
  it("the train on the 9th, the evening before (its check-out isn't the first thing)", () => {
    const { vm, t } = stripOn("2027-04-08", "21:00");
    expect(vm!.tomorrow).toMatchObject({ time: "08:30", kindWord: "Tren", title: "Kyoto → Hakone", sub: "Odakyu · bilet OD-7721" });
    // Nothing left today but the hotel: the hero points at tomorrow.
    expect(timedNextLabel(timedNext(t, vm)!)).toBe("Sıradaki: yarın 08:30 Kyoto → Hakone");
  });

  it("a day on the move: the check-out goes first, before the train, without the hotel's usual hour", () => {
    const { vm } = stripOn("2027-04-05", "07:00");
    expect(rows(vm!).map((r) => r.slice(0, 4))).toEqual([
      ["", "later", "Konaklama", "Otelden çıkış"],
      ["09:00", "next", "Tren", "Tokyo → Kyoto"],
      ["", "later", "Konaklama", "Otele giriş"],
    ]);
  });
});

describe("the flight day: 16 Nisan, TK49 late", () => {
  const { vm, t, by } = stripOn("2027-04-16", "09:20", { live: true, docs: ["TK49"] });

  it("going home: out of the hotel, to the airport, the flight with its live state, landing at the new time", () => {
    expect(vm!.title).toBe("16 Nisan Cuma · Osaka · eve dönüş");
    expect(rows(vm!)).toEqual([
      ["07:10~", "past", "Konaklama", "Otelden çıkış", "Cross Hotel Osaka · onay CR-1180", null],
      ["07:25~", "now", "Transfer", "Cross Hotel Osaka → KIX havalimanı", null, "Yol tarifi"],
      ["11:25", "next", "Uçuş", "TK49 · KIX → IST", "Rötar +25 dk · Kapı 21 · Biniş başladı", "E-bileti aç"],
      ["18:05", "later", "Varış", "İstanbul", "IST · yeni saat", null],
    ]);
    expect(vm!.rows[2].alert).toBe(true);
    expect(vm!.rows[1].action?.url).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\//);
    expect(vm!.tomorrow).toBeNull();
  });

  it("the day's flight as its live data says it: gate, delay, new times, the plan moved with it", () => {
    expect(vm!.flight).toMatchObject({
      itemId: by.tk49.id, title: "TK49 · KIX → IST", departure: "11:25", arrival: "18:05", delay: 25, gate: "21", terminal: "1", stage: "Biniş başladı", alert: true,
      shift: "Planı yeni saate göre kaydırdım: iniş 18:05",
    });
    expect(vm!.flight!.tiles.map((x) => `${x.label} ${x.value}`)).toEqual(["Yeni kalkış 11:25", "Kapı 21", "Tahmini iniş 18:05", "Durum Biniş başladı"]);
    expect(timedNextLabel(timedNext(t, vm)!)).toBe("Sıradaki: TK49 · KIX → IST 11:25");
  });

  it("on time, no live line: the flight's own code", () => {
    const plain = stripOn("2027-04-16", "09:20").vm!;
    expect(plain.rows.find((r) => r.kind === "travel")).toMatchObject({ time: "11:00", sub: "PNR K7T2QX", alert: false });
    expect(plain.flight).toMatchObject({ delay: 0, shift: null, tiles: [] });
  });
});

describe("the way home overnight: it lands the next day", () => {
  it("its landing is the day's last line, at its own hour with +1, never gone by in the morning", () => {
    const { trip, items: raw, by } = japan({ during: true });
    const late = (i: Item): Item => (i.id === by.tk49.id ? { ...i, flight: { ...i.flight!, departure: "2027-04-16T20:40", arrival: "2027-04-17T01:35" } } : i);
    const items = raw.map(late);
    const b = boardOf(trip, items, "2027-04-16");
    const t: TodayInput = { trip, plan: b.plan, timeline: b.timeline, items, today: "2027-04-16", time: "09:20", at: new Date(Date.UTC(2027, 3, 16, 0, 20)) };
    const vm = todayStrip(t)!;
    const landing = vm.rows.at(-1)!;
    expect(landing).toMatchObject({ kind: "arrival", time: "01:35", nextDay: true, phase: "later", title: "İstanbul" });
    expect(vm.rows.slice(0, -1).every((r) => !r.nextDay)).toBe(true);
    expect(vm.rows.find((r) => r.kind === "travel")).toMatchObject({ time: "20:40" });
    expect(vm.nowKey).not.toBe(landing.key);
  });
});

describe("D14 on the strip: the night flight out", () => {
  it("leaves on its own day; the next day it lands, and the check-in waits for the way from the airport", () => {
    const first = stripOn("2027-04-01", "20:00").vm!;
    expect(rows(first)).toEqual([["23:55", "next", "Uçuş", "TK52 · IST → HND", "PNR TK8Q2L", null]]);
    expect(first.tomorrow).toMatchObject({ time: "18:40", kindWord: "Varış", title: "TK52 · IST → HND" });
    const second = stripOn("2027-04-02", "12:00").vm!;
    expect(rows(second).map((r) => r.slice(0, 4))).toEqual([
      ["18:40", "next", "Varış", "TK52 · IST → HND"],
      ["19:45", "later", "Transfer", "HND havalimanı → Konaklama"],
      ["20:25~", "later", "Konaklama", "Otele giriş"],
    ]);
    expect(second.rows[1].sub).toBe("Otelin servisi · sen hallettin");
  });
});

describe("D8: the strip only while the trip is on; afterwards the plan is an archive", () => {
  it("the modes", () => {
    const r = { start: "2027-04-01", end: "2027-04-16" };
    expect([tripModeOf(r, "2027-03-31"), tripModeOf(r, "2027-04-01"), tripModeOf(r, "2027-04-16"), tripModeOf(r, "2027-04-17"), tripModeOf(null, "2027-04-17")]).toEqual(["plan", "trip", "trip", "archive", "plan"]);
    expect(stripOn("2027-03-31", "10:00").vm).toBeNull();
    expect(stripOn("2027-04-17", "10:00").vm).toBeNull();
  });
});

describe("F2: in time", () => {
  const { trip, items, by } = japan({ during: true });
  const at = (utc: string) => new Date(utc);

  it("48 hours before a booked flight its main button is check-in; 49 hours before, still the e-ticket", () => {
    // TK49 leaves at 11:00 on the 16th (local times read as UTC, flightData.ts).
    expect(hoursUntil(by.tk49.flight!.departure, at("2027-04-14T12:00:00Z"))).toBe(47);
    expect(flightFocus(by.tk49, at("2027-04-14T12:00:00Z"))).toBe("checkin");
    expect(flightFocus(by.tk49, at("2027-04-14T10:00:00Z"))).toBe("ticket");
    expect(flightFocus(by.tk49, at("2027-04-16T12:00:00Z"))).toBe("ticket");
    // Not bought: no check-in to do.
    expect(flightFocus({ ...by.tk49, status: "chosen" }, at("2027-04-14T12:00:00Z"))).toBeNull();
    expect(checkinFlights(items, at("2027-04-14T12:00:00Z")).map((i) => i.id)).toEqual([by.tk49.id]);
  });

  it("before the trip, the hero's 'Sıradaki' is the check-in of the flight out in its last 48 hours", () => {
    const b = boardOf(trip, items, "2027-03-31");
    const t: TodayInput = { trip, plan: b.plan, timeline: b.timeline, items, today: "2027-03-31", time: "10:00", at: at("2027-03-31T01:00:00Z") };
    const next = timedNext(t);
    expect(next).toMatchObject({ kind: "checkin", item: { id: by.tk52.id }, hours: 47 });
    expect(timedNextLabel(next!)).toBe("Sıradaki: check-in · TK52");
    expect(timedNext({ ...t, today: "2027-03-28", at: at("2027-03-28T01:00:00Z") })).toBeNull();
  });

  it("the documents come forward 14 days before the first day, not 15", () => {
    const r = { start: "2027-04-01", end: "2027-04-16" };
    expect(docsForward(r, "2027-03-18")).toBe(true);
    expect(docsForward(r, "2027-03-17")).toBe(false);
    expect(docsForward(r, "2027-04-02")).toBe(false);
  });

  it("the trip's own clock", () => {
    expect(localNow(at("2027-04-06T03:40:00Z"), "Asia/Tokyo")).toEqual({ day: "2027-04-06", time: "12:40" });
    expect(localNow(at("2027-04-06T03:40:00Z"), "Europe/Istanbul")).toEqual({ day: "2027-04-06", time: "06:40" });
    expect(localNow(at("2027-04-06T03:40:00Z"), "Not/AZone").time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("row 127 / H8: on the trip, what's left behind is no decision; afterwards, nothing is", () => {
  const { trip, items } = japan();
  const b = boardOf(trip, items, "2027-04-13", { suggestions: { other: [INSURANCE] } });
  const missed = b.intents.filter((i) => isMissed(i, "2027-04-13", b.plan));

  it("the open needs of days gone by: the flight out, the bed of its night, Kyoto's bed and the train there", () => {
    expect(missed.map((i) => [i.section, i.head.name])).toEqual([
      ["flight", "İstanbul → Tokyo"],
      ["stay", "Konaklama yok"],
      ["stay", "Kyoto"],
      ["transport", "Tokyo → Kyoto"],
    ]);
    // Osaka's nights are still ahead; the policy covers the whole trip.
    expect(b.intents.find((i) => i.head.city === "Osaka" && i.section === "stay")).toBeDefined();
    expect(missed.some((i) => i.head.city === "Osaka" || i.kind === "insurance")).toBe(false);
  });

  it("the hero's shares and 'n karar' leave them out on the trip; after it no decision is left", () => {
    const all = b.intents;
    const on = countedIntents(all, { today: "2027-04-13", mode: "trip", plan: b.plan });
    expect(on.length).toBe(all.length - missed.length);
    expect(planShare(on).total).toBe(planShare(all).total - missed.length);
    expect(countedIntents(all, { today: "2026-10-18", mode: "plan" })).toHaveLength(all.length);
    // D14: with the records, the night on the plane is no need, before the trip too.
    const planning = countedIntents(all, { today: "2026-10-18", mode: "plan", items });
    expect(planning).toHaveLength(all.length - 1);
    expect(planning.some((i) => i.head.name === "Konaklama yok")).toBe(false);
    const after = countedIntents(all, { today: "2027-04-20", mode: "archive" });
    expect(after.some((i) => ["searching", "deciding", "suggested"].includes(i.status))).toBe(false);
    expect(bookedShare(after).count).toBe(bookedShare(all).count);
  });

  it("H8: the rules suggest no insurance or eSIM once the trip has begun", () => {
    const bare = items.filter((i) => i.category !== "esim");
    const rules = (today: string) => {
      const plan = buildPlan(trip, bare);
      const legs = buildLegs(plan, trip);
      return ruleSuggestions({ trip, plan, items: bare, timeline: buildTimeline(plan, legs, bare), legs, mains: [], home: "TR", today }).map((s) => s.key);
    };
    expect(rules(JAPAN_TODAY)).toEqual(expect.arrayContaining(["rule:insurance", "rule:esim"]));
    expect(rules("2027-04-06")).not.toContain("rule:insurance");
    expect(rules("2027-04-06")).not.toContain("rule:esim");
  });
});
