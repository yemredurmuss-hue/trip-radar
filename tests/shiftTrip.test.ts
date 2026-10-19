// 0.38.7 (V1): Emre's Bali trip (Bodrum → Bali, Canggu only, with Sabine, 1 Aralık – 1 Ocak) moved in the chat ("10
// Aralık'tan 10 Ocak'a kaydır"). The start's places (both flights, Canggu's nights) and what the chat planned on the
// trip's days (the transfer, the motorbike) move with it; a booked flight stays where it is and the reply says so;
// the board's range is the new one (no stay left on 1 Aralık to widen it back); a length change goes to the last stop.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { sendMessage } from "../src/lib/assistant";
import { db, listItems } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { tripRange } from "../src/lib/plan";
import { shiftText, shiftTrip } from "../src/lib/shiftTrip";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { applyAnswer, applyText, creationOf, isPlaceholder, newStart, parseStartText, placeholderPrint, type StartState } from "../src/lib/startTrip";
import type { Item, Suggestion, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

setLang("tr");
const TODAY = "2026-10-19";
const LINE = "Bali'de 1 ay kalırız canggu da sabit sabinle bunu planla";

async function create(): Promise<Trip> {
  let s = newStart(`v1-${Math.random()}`, "plan", 1, "tr");
  s = { ...s, messages: [{ role: "user", text: LINE, at: 1 }] };
  s = applyText(s, LINE, parseStartText(LINE, TODAY, "where"), 2, "where").state;
  s = applyAnswer(s, { q: "from", city: "Bodrum" }, 3);
  s = applyAnswer(s, { q: "start", date: "2026-12-01", approx: false }, 4);
  let state: StartState = applyAnswer(s, { q: "want", styles: ["romantic", "nature"], budget: null }, 5);
  for (const step of stepsFor(state, creationOf(state)!)) {
    const { tripId } = await runStep(step.id, state, { provider: "gemini" });
    if (step.id === "trip") state = { ...state, tripId };
  }
  return (await (await db()).get("trips", state.tripId!))!;
}

function fakeClient(responses: Partial<Anthropic.Message>[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams) => {
        calls.push(structuredClone(params));
        const next = responses.shift();
        if (!next) throw new Error("no more fake responses");
        return next;
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const tool = (id: string, name: string, input: Record<string, unknown>): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id, name, input, caller: { type: "direct" } }] as Anthropic.ContentBlock[],
});
const done = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Anthropic.ContentBlock[] });

const chat = (tripId: string, over: Partial<Item>) =>
  makeItem({ tripId, origin: "chat", status: "chosen", dates: { start: null, end: null, source: "unverified" }, createdAt: 50, ...over });

describe("Emre's Bali trip moved in the chat: 1 Aralık – 1 Ocak → 10 Aralık – 10 Ocak", () => {
  it("the start's places, the transfer and the motorbike move 9 days; the booked flight stays; the reply says only that", async () => {
    const trip = await create();
    const d = await db();
    const made = await listItems(trip.id);
    expect(trip.confirmedDates).toEqual({ start: "2026-12-01", end: "2027-01-01" });
    expect(made.filter((i) => isPlaceholder(trip, i)).length).toBeGreaterThanOrEqual(3);
    const transfer = chat(trip.id, { id: "v1-transfer", category: "transport", plannedKind: "transfer", name: "Havalimanı transferi", city: "Canggu", dates: { start: "2026-12-01", end: null, source: "unverified" }, flight: { from: "Denpasar", to: "Canggu", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } });
    const moto = chat(trip.id, { id: "v1-moto", category: "transport", plannedKind: "moto_rental", name: "Motor kiralama", city: "Canggu", dates: { start: "2026-12-01", end: "2027-01-01", source: "unverified" } });
    const sabine = chat(trip.id, { id: "v1-sabine", category: "flight", status: "booked", name: "Sabine'nin uçuşu", dates: { start: "2026-12-01", end: null, source: "unverified" }, flight: { from: "Frankfurt", to: "Denpasar", departure: "2026-12-01T09:00", arrival: null, carrier: null, flightNumber: null, stops: null } });
    for (const i of [transfer, moto, sabine]) await d.put("items", i);
    await d.put("trips", { ...trip, suggestions: [{ key: "chat:surf", section: "activity", kind: "add", title: "Sörf dersi", why: "", source: "chat", payload: { city: "Canggu", start: "2026-12-03", end: null }, createdAt: 1, state: "open" } satisfies Suggestion] });

    const { client, calls } = fakeClient([
      tool("t1", "update_trip", { title: null, start: "2026-12-10", end: "2027-01-10", budget_amount: null, budget_currency: null, budget_ceiling: null }),
      done("Tamam."),
    ]);
    await sendMessage(trip.id, "10 Aralık'tan 10 Ocak'a kaydır", anthropicProvider(client, "claude-opus-5"));

    const after = (await d.get("trips", trip.id))!;
    const items = await listItems(trip.id);
    const byId = (id: string) => items.find((i) => i.id === id)!;
    expect(after.confirmedDates).toEqual({ start: "2026-12-10", end: "2027-01-10" });
    // Every place the start made: 9 days on, still a place to fill.
    for (const was of made.filter((i) => isPlaceholder(trip, i))) {
      const now = byId(was.id);
      expect(now.dates.start, was.name).toBe(was.dates.start === "2027-01-01" ? "2027-01-10" : "2026-12-10");
      if (was.dates.end) expect(now.dates.end, was.name).toBe("2027-01-10");
      expect(isPlaceholder(after, now), was.name).toBe(true);
    }
    const stay = items.find((i) => i.category === "stay" && isPlaceholder(after, i))!;
    expect([stay.dates.start, stay.dates.end]).toEqual(["2026-12-10", "2027-01-10"]);
    expect(byId("v1-transfer").dates).toMatchObject({ start: "2026-12-10", end: null });
    expect(byId("v1-moto").dates).toMatchObject({ start: "2026-12-10", end: "2027-01-10" });
    // The booked flight never moves.
    expect(byId("v1-sabine").dates.start).toBe("2026-12-01");
    expect(byId("v1-sabine").flight?.departure).toBe("2026-12-01T09:00");
    // The open suggestion's day moved too.
    expect(after.suggestions?.[0].payload?.start).toBe("2026-12-12");
    // The board reads the new range: nothing left on 1 Aralık widens it.
    expect(tripRange(after, items)).toEqual({ start: "2026-12-10", end: "2027-01-10" });

    // What the model is told is what was done, booked flight named.
    const result = JSON.stringify(calls[1].messages.at(-1));
    expect(result).toContain("Gezi 10 Aralık – 10 Ocak.");
    expect(result).toMatch(/\d+ kayıt yeni tarihlere kaydı\./);
    expect(result).toContain("1 alınmış uçuş değişmedi, tarihini kontrol et: Sabine'nin uçuşu.");
  });
});

describe("shiftTrip (pure)", () => {
  const trip = (placeholders: Record<string, string> = {}) => ({ confirmedDates: { start: "2026-12-01", end: "2027-01-01" }, startGuide: { createdAt: 1, placeholders }, suggestions: [] });

  it("a length change goes to the last stop: the first stop keeps its nights", () => {
    const ubud = chat("t", { id: "ubud", category: "stay", city: "Ubud", dates: { start: "2026-12-01", end: "2026-12-11", source: "unverified" } });
    const canggu = chat("t", { id: "canggu", category: "stay", city: "Canggu", dates: { start: "2026-12-11", end: "2027-01-01", source: "unverified" } });
    const home = chat("t", { id: "home", category: "flight", dates: { start: "2027-01-01", end: null, source: "unverified" }, flight: { from: "Denpasar", to: "Bodrum", departure: "2027-01-01T23:50", arrival: "2027-01-02T10:00", carrier: null, flightNumber: null, stops: null } });
    const s = shiftTrip(trip(), [ubud, canggu, home], { start: "2026-12-10", end: "2027-01-15" });
    const at = (id: string) => s.moved.find((i) => i.id === id)!;
    expect(at("ubud").dates).toMatchObject({ start: "2026-12-10", end: "2026-12-20" });
    expect(at("canggu").dates).toMatchObject({ start: "2026-12-20", end: "2027-01-15" });
    expect(at("home").dates.start).toBe("2027-01-15");
    expect(at("home").flight).toMatchObject({ departure: "2027-01-15T23:50", arrival: "2027-01-16T10:00" });
  });

  it("a page's own dates and a day the traveller corrected stay; a placeholder keeps its print", () => {
    const page = makeItem({ id: "airbnb", category: "stay", url: "https://airbnb.com/rooms/1", status: "chosen", dates: { start: "2026-12-01", end: "2027-01-01", source: "url" } });
    const fixed = chat("t", { id: "fixed", category: "activity", dates: { start: "2026-12-05", end: null, source: "user" } });
    const flight = chat("t", { id: "there", category: "flight", dates: { start: "2026-12-01", end: null, source: "unverified" } });
    const s = shiftTrip(trip({ there: placeholderPrint(flight) }), [page, fixed, flight], { start: "2026-12-10", end: "2027-01-10" });
    expect(s.moved.map((i) => i.id)).toEqual(["there"]);
    expect(s.own.map((i) => i.id)).toEqual(["airbnb", "fixed"]);
    expect(s.prints.there).toBe(placeholderPrint(s.moved[0]));
    expect(shiftText(s)).toBe("Gezi 10 Aralık – 10 Ocak. 1 kayıt yeni tarihlere kaydı. 2 kayıt kendi tarihinde kaldı: Item, Item.");
  });

  it("a trip with no dates yet moves nothing", () => {
    const s = shiftTrip({ confirmedDates: null }, [chat("t", { dates: { start: "2026-12-01", end: null, source: "unverified" } })], { start: "2026-12-10", end: "2027-01-10" });
    expect(s.moved).toEqual([]);
  });
});
