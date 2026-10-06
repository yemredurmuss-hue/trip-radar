// The day's times from what's fixed: Emre's examples, the night, the traveller's own time, and the rules that
// must always hold (never leave after being due at the airport, never check out after leaving, never a wrong time).
import { afterEach, describe, expect, it } from "vitest";
import { applyDayTimes } from "../src/lib/dayTimes";
import { setLang } from "../src/lib/i18n";
import type { DayRow } from "../src/lib/journey";

afterEach(() => setLang("tr"));

const row = (key: string, over: Partial<DayRow>): DayRow =>
  ({ key, kind: "info", time: null, estimated: false, hint: null, otherDay: null, title: key, sub: null, line: null, state: "info", status: "", notes: [], entry: null, leg: null, item: null, items: [], rental: null, stayKey: null, ...over }) as DayRow;
const checkout = (time: string | null) => row("out", { title: "Check-out", time, stayKey: "stay:a" });
const checkin = (time: string | null) => row("in", { title: "Check-in", time, stayKey: "stay:b" });
const toAirport = (before: string | null) => row("go", { kind: "leg", state: "open", title: "Otel → Havalimanı", leg: { kind: "departure", before, after: null, via: "flight" } as never });
const fromAirport = (after: string | null) => row("come", { kind: "leg", state: "open", title: "Havalimanı → Otel", leg: { kind: "arrival", before: null, after, via: "flight" } as never });
const flight = (time: string) => row("fly", { kind: "travel", state: "done", title: "Uçuş", time });
/** A flight on a ticket: its departure, and its landing when the page or ticket said it. */
const ticket = (key: string, dep: string, arrival: string | null, day = "2026-10-07") =>
  row(key, { kind: "travel", state: "done", title: "Uçuş", time: dep, entry: { kind: "travel", travel: { settled: { flight: { departure: `${day}T${dep}`, arrival } }, items: [] } } as never });
const times = (rows: DayRow[]) => Object.fromEntries(rows.map((r) => [r.key, `${r.estimated ? "~" : ""}${r.time ?? "—"}`]));

describe("leaving: flight 15:00, at the airport by 13:00", () => {
  it("transfer at 12:00; check-out stays at the hotel's 11:00", () => {
    expect(times(applyDayTimes([checkout("11:00"), toAirport("13:00"), flight("15:00")]))).toEqual({ out: "11:00", go: "~12:00", fly: "15:00" });
  });
  it("a later check-out moves before leaving", () => {
    const rows = applyDayTimes([checkout("12:00"), toAirport("13:00"), flight("15:00")]);
    expect(times(rows)).toMatchObject({ out: "~11:45", go: "~12:00" });
    expect(rows[0].why).toBe("Yola çıkış 12:00: ondan önce çıkış");
    expect(rows[1].why).toBe("En geç 13:00 havalimanında olmalısın; transfer ~1 sa");
  });
});

describe("arriving", () => {
  it("lands 22:00: transfer 22:45, check-in 23:45", () => {
    expect(times(applyDayTimes([fromAirport("22:00"), checkin("15:00")]))).toEqual({ come: "~22:45", in: "~23:45" });
  });
  it("lands 10:05: transfer 10:50, the room still at 15:00", () => {
    expect(times(applyDayTimes([fromAirport("10:05"), checkin("15:00")]))).toEqual({ come: "~10:50", in: "15:00" });
  });
});

describe("the traveller's own time", () => {
  it("is kept, the rest follow it, and a late one is warned about", () => {
    const rows = applyDayTimes([checkout("11:00"), toAirport("13:00"), flight("15:00")], { go: "12:30" });
    expect(times(rows)).toMatchObject({ go: "12:30", out: "11:00" });
    expect(rows[1]).toMatchObject({ user: true, warn: "13:00'da havalimanında olmalısın: bu saatle geç kalabilirsin." });
    expect(times(applyDayTimes([checkout("11:00"), toAirport("13:00")], { go: "10:30" }))).toMatchObject({ out: "~10:15", go: "10:30" });
  });
  it("moves the check-in after an arrival transfer they set", () => {
    expect(times(applyDayTimes([fromAirport("10:05"), checkin("15:00")], { come: "16:00" }))).toEqual({ come: "16:00", in: "~17:00" });
  });
  it("ignores what isn't a time", () => {
    expect(times(applyDayTimes([toAirport("13:00")], { go: "soon" }))).toEqual({ go: "~12:00" });
  });
});

describe("never a wrong time", () => {
  it("leaves it empty when it would cross midnight", () => {
    expect(times(applyDayTimes([checkout("11:00"), toAirport("00:30")]))).toEqual({ out: "11:00", go: "—" });
    // Landing late: never the hotel's 15:00 then, but the night in words (0.36.13).
    const late = applyDayTimes([fromAirport("23:40"), checkin("15:00")]);
    expect(times(late)).toEqual({ come: "—", in: "—" });
    expect(late.map((r) => r.hint)).toEqual(["gece ~00:25", "gece ~01:25"]);
    expect(late[1].why).toContain("Geç girişi otelle ayarla");
  });
  it("without a flight time, nothing is made up", () => {
    expect(times(applyDayTimes([checkout("11:00"), toAirport(null), checkin(null)]))).toEqual({ out: "11:00", go: "—", in: "—" });
  });
  it("always: leave before being due, check out before leaving", () => {
    for (let h = 2; h < 24; h++) {
      for (const out of ["09:00", "11:00", "12:00", "23:00"]) {
        const by = `${String(h).padStart(2, "0")}:15`;
        const [o, g] = applyDayTimes([checkout(out), toAirport(by)]);
        expect(g.time! < by).toBe(true);
        expect(o.time! < g.time!).toBe(true);
      }
    }
  });
});

describe("the trip in is the anchor (Emre's 7 October: Istanbul → Copenhagen → Amsterdam → Porto)", () => {
  const legs = (last: string | null) => [ticket("a", "09:40", "2026-10-07T12:30"), ticket("b", "16:30", "2026-10-07T18:00"), ticket("c", "20:30", last), checkin("15:00")];
  it("the last flight's landing unknown: no 15:00 while still in the air, \"varıştan sonra\" instead", () => {
    const rows = applyDayTimes(legs(null));
    expect(times(rows).in).toBe("—");
    expect(rows[3].hint).toBe("varıştan sonra");
    expect(rows[3].why).toContain("20:30");
  });
  it("its landing known (on the ticket, no transfer line): out at 22:45, checked in ~23:45", () => {
    const rows = applyDayTimes(legs("2026-10-07T22:00"));
    expect(times(rows).in).toBe("~23:45");
    expect(rows[3].why).toBe("Havalimanından çıkış 22:45 + yol ~1 sa");
  });
  it("landing the next day: the night in words", () => {
    const rows = applyDayTimes([ticket("a", "22:30", "2026-10-08T01:35"), checkin("15:00")]);
    expect(rows[1]).toMatchObject({ time: null, hint: "gece ~03:20" });
  });
  it("an early landing keeps the hotel's hour (the room isn't ready before)", () => {
    expect(times(applyDayTimes([ticket("a", "06:00", "2026-10-07T08:00"), checkin("15:00")])).in).toBe("15:00");
  });
  it("the traveller's own check-in time stands", () => {
    expect(times(applyDayTimes([ticket("a", "20:30", null), checkin("15:00")], { in: "23:00" })).in).toBe("23:00");
  });
});

describe("arrivalAt: the landing the traveller types", () => {
  it("on the flight's day, or the next when it's before take-off", async () => {
    const { arrivalAt } = await import("../src/lib/userEdits");
    const { makeItem } = await import("./fixtures/makeItem");
    const f = (dep: string) => makeItem({ category: "flight", flight: { from: "AMS", to: "OPO", departure: dep, arrival: null, carrier: null, flightNumber: "KL1577", stops: 0 } });
    expect(arrivalAt(f("2026-10-07T20:30"), "22:00")).toBe("2026-10-07T22:00");
    expect(arrivalAt(f("2026-10-07T22:30"), "01:35")).toBe("2026-10-08T01:35");
    expect(arrivalAt(f("2026-10-07T20:30"), "2200")).toBeNull();
  });
});
