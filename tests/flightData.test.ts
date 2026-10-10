// A booked flight's real data (flightData.ts): which flights are asked about, when again, and what the board
// reads from it (a landing the page didn't give; the traveller's own still wins).
import { describe, expect, it } from "vitest";
import type { FlightLive } from "../supabase/functions/flight/shape";
import { flightAlert, flightTiles, liveKey, liveLine, phaseOf, refreshFlights, ticketDiff, withLive } from "../src/lib/flightData";
import { memoryKV } from "../src/lib/share/store";
import { makeItem } from "./fixtures/makeItem";

const kl = (over: Partial<FlightLive> = {}): FlightLive => ({
  number: "KL1577",
  airline: "KLM",
  status: "Expected",
  departure: { iata: "AMS", airport: "Schiphol", scheduled: "2026-10-07T20:30", revised: null, actual: null, terminal: "1", gate: null },
  arrival: { iata: "OPO", airport: "Porto", scheduled: "2026-10-07T22:15", revised: null, actual: null, terminal: "1", gate: null, belt: null },
  fetchedAt: "t",
  ...over,
});
const flight = (arrival: string | null, status: "booked" | "saved" = "booked") =>
  makeItem({ category: "flight", status, name: "KLM · Amsterdam → Porto", flight: { from: "AMS", to: "OPO", departure: "2026-10-07T20:30", arrival, carrier: "KLM", flightNumber: "KL 1577", stops: 0 } });

describe("which flight, which day", () => {
  it("its number and departure day", () => {
    expect(liveKey(flight(null))).toBe("KL1577|2026-10-07");
    expect(liveKey(makeItem({ category: "stay" }))).toBeNull();
  });
});

describe("what the board reads", () => {
  it("fills the landing the page didn't give, keeps one it did", () => {
    const stored = { "KL1577|2026-10-07": { flight: kl(), at: 1 } };
    expect(withLive(flight(null), stored).flight?.arrival).toBe("2026-10-07T22:15");
    expect(withLive(flight("2026-10-07T22:05"), stored).flight?.arrival).toBe("2026-10-07T22:05");
    expect(withLive(flight(null), {}).flightLive).toBeUndefined();
  });
  it("a late flight's new times stand in (the plan moves), the traveller's own still win", () => {
    const late = kl({ status: "Delayed", departure: { ...kl().departure, revised: "2026-10-07T20:55" }, arrival: { ...kl().arrival, revised: "2026-10-07T22:40" } });
    const stored = { "KL1577|2026-10-07": { flight: late, at: 1 } };
    const seen = withLive(flight("2026-10-07T22:05"), stored);
    expect([seen.flight?.departure, seen.flight?.arrival]).toEqual(["2026-10-07T20:55", "2026-10-07T22:40"]);
    expect(seen.flightLive?.ticket).toEqual({ departure: "2026-10-07T20:30", arrival: "2026-10-07T22:05" });
    const typed = { ...flight("2026-10-07T22:05"), userEdits: { arrival: "2026-10-07T22:30" } };
    expect(withLive(typed, stored).flight?.arrival).toBe("2026-10-07T22:05");
  });
  it("the ticket against the schedule", () => {
    const seen = withLive(flight("2026-10-07T22:05"), { "KL1577|2026-10-07": { flight: kl(), at: 1 } });
    expect(ticketDiff(seen.flightLive)).toBe("Biletinde iniş 22:05, tarifede 22:15");
    expect(ticketDiff(withLive(flight("2026-10-07T22:15"), { "KL1577|2026-10-07": { flight: kl(), at: 1 } }).flightLive)).toBeNull();
  });
});

describe("the boxes: only what's known, where the flight is", () => {
  const day = new Date("2026-10-07T12:00:00Z");
  it("far off: none", () => {
    expect(phaseOf(kl(), new Date("2026-10-01T12:00:00Z"))).toBe("far");
    expect(flightTiles(kl(), new Date("2026-10-01T12:00:00Z"))).toEqual([]);
    expect(liveLine(kl(), new Date("2026-10-01T12:00:00Z"))).toBeNull();
  });
  it("its day: expected departure, desks and gate when known", () => {
    const f = kl({ departure: { ...kl().departure, gate: "D5", desk: "12 - 16" } });
    expect(flightTiles(f, day).map((t) => `${t.label} ${t.value}`)).toEqual(["Tahmini kalkış 20:30", "Check-in masası 12–16", "Kapı D5"]);
    expect(flightTiles(kl(), day).map((t) => t.label)).toEqual(["Tahmini kalkış"]);
  });
  it("late: the new departure with how late, a changed gate, the new landing; red", () => {
    const f = { ...kl({ status: "Delayed", departure: { ...kl().departure, revised: "2026-10-07T20:55", gate: "D7" }, arrival: { ...kl().arrival, revised: "2026-10-07T22:40" } }), prevGate: "D5" };
    expect(flightTiles(f, day)).toEqual([
      { icon: "up", label: "Yeni kalkış", value: "20:55", note: "+25 dk", tone: "bad" },
      { icon: "gate", label: "Kapı (D5'ti)", value: "D7", tone: "bad" },
      { icon: "down", label: "Tahmini iniş", value: "22:40" },
    ]);
    expect(flightAlert(f, day)).toBe(true);
    expect(liveLine(f, day)?.text).toBe("Yeni kalkış 20:55 (+25 dk) · Kapı (D5'ti) D7 · Tahmini iniş 22:40");
  });
  it("in the air, landed, cancelled", () => {
    const air = kl({ status: "EnRoute", departure: { ...kl().departure, actual: "2026-10-07T20:34" }, arrival: { ...kl().arrival, revised: "2026-10-07T22:11" } });
    expect(flightTiles(air, day).map((t) => `${t.label} ${t.value}`)).toEqual(["Kalktı 20:34", "Tahmini iniş 22:11"]);
    const landed = kl({ status: "Arrived", arrival: { ...kl().arrival, actual: "2026-10-07T22:09", belt: "4" } });
    expect(flightTiles(landed, day).map((t) => `${t.label} ${t.value}`)).toEqual(["İndi 22:09", "Bagaj bandı 4", "Varış terminali 1"]);
    expect(flightTiles(kl({ status: "Canceled" }), day)).toEqual([{ icon: "alert", label: "Uçuş", value: "İptal edildi", tone: "bad" }]);
    expect(flightAlert(kl({ status: "Canceled" }), day)).toBe(true);
  });
});

describe("asking the server", () => {
  const answer = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  it("asks for planned flights, then not again while fresh", async () => {
    const kv = memoryKV();
    let calls = 0;
    const fetcher = (async (url: string) => {
      calls++;
      expect(url).toContain("number=KL1577&day=2026-10-07");
      return new Response(JSON.stringify({ flight: kl() }));
    }) as unknown as typeof fetch;
    const now = new Date("2026-10-01T10:00:00Z");
    expect(await refreshFlights([flight(null), flight(null, "saved")], { kv, now, fetcher })).toBe(true);
    expect(calls).toBe(1);
    expect(await refreshFlights([flight(null)], { kv, now: new Date("2026-10-01T12:00:00Z"), fetcher })).toBe(false);
    expect(calls).toBe(1); // a day while it's far
    await refreshFlights([flight(null)], { kv, now: new Date("2026-10-02T11:00:00Z"), fetcher });
    expect(calls).toBe(2);
  });
  it("quiet when the server can't answer", async () => {
    const kv = memoryKV();
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await refreshFlights([flight(null)], { kv, fetcher: down })).toBe(false);
    expect(await refreshFlights([flight(null)], { kv, fetcher: answer({ error: "not-configured" }) })).toBe(false);
  });
});

describe("a runway time isn't a landing (AeroDataBox forecasts it days ahead)", () => {
  it("KL1274 on 6 October: 'landed 17:47' was wrong, it's tomorrow", () => {
    const f = kl({ status: "Expected", departure: { ...kl().departure, scheduled: "2026-10-07T16:30" }, arrival: { ...kl().arrival, scheduled: "2026-10-07T17:55", actual: "2026-10-07T17:47", revised: "2026-10-07T17:47" } });
    expect(phaseOf(f, new Date("2026-10-06T13:00:00Z"))).toBe("before");
    expect(flightTiles(f, new Date("2026-10-06T13:00:00Z")).map((t) => `${t.label} ${t.value}`)).toEqual(["Tahmini kalkış 16:30"]);
    expect(phaseOf(f, new Date("2026-10-04T13:00:00Z"))).toBe("far");
    expect(phaseOf(f, new Date("2026-10-07T23:30:00Z"))).toBe("landed");
  });
});
