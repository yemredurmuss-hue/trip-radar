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
    expect(times(applyDayTimes([fromAirport("23:40"), checkin("15:00")]))).toEqual({ come: "—", in: "15:00" });
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
