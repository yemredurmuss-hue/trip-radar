// A booked flight's real data (flightData.ts): which flights are asked about, when again, and what the board
// reads from it (a landing the page didn't give; the traveller's own still wins).
import { describe, expect, it } from "vitest";
import type { FlightLive } from "../supabase/functions/flight/shape";
import { liveKey, liveLine, refreshFlights, withLive } from "../src/lib/flightData";
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
  it("the live line: only what's known, red when late or cancelled", () => {
    expect(liveLine(kl())).toEqual({ text: "Terminal 1", alert: false });
    const late = kl({ status: "Delayed", departure: { ...kl().departure, revised: "2026-10-07T20:55", gate: "D5" } });
    expect(liveLine(late)).toEqual({ text: "Rötar 25 dk · Terminal 1 · Kapı D5", alert: true });
    expect(liveLine(kl({ status: "Canceled" }))?.alert).toBe(true);
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
