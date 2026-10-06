// "Book etmemiz gerekenleri yaptık, gerisi fikir olarak kalsın" (0.36.47): what's on the plan and not booked stays
// there as an idea, out of "Rezerve et" and the booked percentage; the chat does it one step at a time, saying each
// step while the board changes with it; a model that never answers ends the turn instead of "Düşünüyor…" for ever.
import "fake-indexeddb/auto";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AnswerTimeout, liveTiming, sendMessage } from "../src/lib/assistant";
import { bookingOf, setAside } from "../src/lib/booking";
import { categorize, planStages, type CatSection } from "../src/lib/categories";
import { chatStepsOf, onChatStatus, type ChatStep } from "../src/lib/chatStatus";
import { db, listItems } from "../src/lib/db";
import { heroNumbers } from "../src/lib/lifecycle";
import { buildLegs } from "../src/lib/legs";
import { anthropicProvider } from "../src/lib/llm/anthropic";
import { buildPlan } from "../src/lib/plan";
import { plannedItem } from "../src/lib/planned";
import { buildTimeline } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

type Block = Anthropic.ContentBlock;
const say = (text: string): Partial<Anthropic.Message> => ({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] as Block[] });
const use = (...calls: { name: string; input: unknown }[]): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: calls.map((c, i) => ({ type: "tool_use", id: `tu${i}-${Math.random()}`, name: c.name, input: c.input, caller: { type: "direct" } })) as Block[],
});
function fake(responses: (Partial<Anthropic.Message> | "never")[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  const client = {
    messages: {
      create: async (params: Anthropic.MessageCreateParams) => {
        calls.push(structuredClone(params));
        const next = responses.shift();
        if (next === "never") return new Promise(() => undefined);
        if (!next) throw new Error("no more fake responses");
        return next;
      },
    },
  } as unknown as Anthropic;
  return { llm: anthropicProvider(client, "claude-opus-5"), calls };
}
const resultsOf = (calls: Anthropic.MessageCreateParams[], n: number) => calls[n].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];

const T = "trip";
const trip: Trip = { id: T, title: "Porto", confirmedDates: { start: "2026-10-08", end: "2026-10-11" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
const flight = (id: string, from: string, to: string, day: string, status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({
    tripId: T,
    id,
    name: `${from} → ${to}`,
    category: "flight",
    needKey: `flight:${from}-${to}`.toLowerCase(),
    city: to === "IST" ? "İstanbul" : "Porto",
    dates: { start: day, end: null, source: "page" },
    status,
    flight: { from, to, departure: `${day}T09:00`, arrival: `${day}T12:00`, carrier: null, flightNumber: null, stops: 0 },
    ...over,
  });
const stay = (status: Item["status"], over: Partial<Item> = {}) =>
  makeItem({ tripId: T, id: "jardim", name: "Jardim Stay", category: "stay", city: "Porto", needKey: "stay:porto", dates: { start: "2026-10-08", end: "2026-10-11", source: "url" }, status, ...over });

function sectionsOf(items: Item[], t: Trip = trip): CatSection[] {
  const plan = buildPlan(t, items);
  const legs = buildLegs(plan, t);
  const timeline = buildTimeline(plan, legs, items);
  return categorize({ plan, timeline, items, legs, today: "2026-10-01" });
}
const flightsAndStays = (s: CatSection[]) => s.filter((x) => x.id === "flight" || x.id === "stay");

async function put(items: Item[]) {
  const d = await db();
  for (const store of ["items", "messages", "trips"] as const) await d.clear(store);
  await d.put("trips", trip);
  for (const i of items) await d.put("items", i);
}

const timing = { ...liveTiming };
beforeEach(() => {
  liveTiming.stepMs = 0;
});
afterEach(() => {
  Object.assign(liveTiming, timing);
});

describe("set aside as needing no booking", () => {
  it("an idea: never 'Rezerve et', out of the percentage, the row and the card say Fikir; a booking made still wins", () => {
    const items = [flight("out", "IST", "OPO", "2026-10-08", "booked"), stay("chosen"), flight("home", "OPO", "IST", "2026-10-11", "chosen")];
    expect(heroNumbers(planStages(flightsAndStays(sectionsOf(items))))).toMatchObject({ done: 1, inPlan: 3, pct: 33 });

    const aside = items.map((i) => (i.status === "chosen" ? { ...i, noBooking: 1 } : i));
    expect(aside.filter(setAside).map((i) => i.id)).toEqual(["jardim", "home"]);
    expect(bookingOf(aside[1])).toBe("none");
    const sections = flightsAndStays(sectionsOf(aside));
    expect(heroNumbers(planStages(sections))).toMatchObject({ done: 1, inPlan: 1, pct: 100 });
    const rows = sections.flatMap((s) => s.entries.map((e) => [e.row.name, e.row.status]));
    expect(rows).toContainEqual(["Jardim Stay", "Fikir"]);
    expect(rows).toContainEqual(["Porto → İstanbul", "Fikir"]);

    // Booked later: a booking again, whatever was said before.
    const booked = { ...aside[1], status: "booked" as const };
    expect(setAside(booked)).toBe(false);
    expect(bookingOf(booked)).toBe("needed");
  });
});

describe("a stay said in the chat with no place yet", () => {
  it("set aside: an idea too, out of the stages, the row says Fikir", () => {
    const said = plannedItem({ kind: "stay", date: "2026-10-08", end_date: "2026-10-11", time: null, from: null, to: null, city: "Porto", title: null, booked: false, note: null }, T, "said", 1);
    const items = [flight("out", "IST", "OPO", "2026-10-08", "booked"), said];
    const before = heroNumbers(planStages(flightsAndStays(sectionsOf(items))));
    expect(before.planned).toBe(1);
    const sections = flightsAndStays(sectionsOf([items[0], { ...said, noBooking: 1 }]));
    expect(heroNumbers(planStages(sections))).toMatchObject({ planned: 0, pct: 100 });
    expect(sections.flatMap((s) => s.entries.map((e) => e.row.status))).toContain("Fikir");
    // With a hotel saved there too: the need still takes no booking; the option waits as an option.
    const option = stay("saved", { id: "loft", name: "Ribeira Loft" });
    const withOption = flightsAndStays(sectionsOf([items[0], { ...said, noBooking: 1 }, option]));
    expect(heroNumbers(planStages(withOption))).toMatchObject({ planned: 0, pct: 100 });
  });
});

describe("the chat: set_booking_need", () => {
  it("'gerisi fikir olarak kalsın' sets every unbooked plan aside one step at a time, each said as it goes, and takes it back", async () => {
    const option = stay("saved", { id: "loft", name: "Ribeira Loft" });
    await put([flight("out", "IST", "OPO", "2026-10-08", "booked"), stay("chosen"), flight("home", "OPO", "IST", "2026-10-11", "chosen"), option]);
    const seen: ChatStep[][] = [];
    const stop = onChatStatus((id) => id === T && seen.push(chatStepsOf(T)));
    const { llm, calls } = fake([use({ name: "set_booking_need", input: { all_unbooked: true, item_ids: [], leg_keys: [], needed: false } }), say("Rezerve edilmeyenleri fikir olarak bıraktım.")]);
    await sendMessage(T, "book etmemiz gerekenleri yaptık, gerisi fikir olarak kalsın", llm);
    stop();

    const [result] = resultsOf(calls, 1);
    expect(result.is_error).toBeFalsy();
    expect(JSON.parse(String(result.content))).toMatchObject({ kept_as_ideas: ["Jardim Stay", "OPO → IST"] });
    const after = new Map((await listItems(T)).map((i) => [i.id, i]));
    expect(after.get("jardim")!.noBooking).toBeTypeOf("number");
    expect(after.get("home")!.noBooking).toBeTypeOf("number");
    // Nothing deleted or ruled out; the booking and the option untouched.
    expect([...after.values()].map((i) => [i.id, i.status])).toEqual(expect.arrayContaining([["out", "booked"], ["jardim", "chosen"], ["home", "chosen"], ["loft", "saved"]]));
    expect(after.get("loft")!.noBooking).toBeUndefined();
    expect(heroNumbers(planStages(flightsAndStays(sectionsOf([...after.values()]))))).toMatchObject({ pct: 100 });

    // Said while done, in order, each ticked when the next started; gone when the turn ended.
    const texts = seen.map((s) => s.map((x) => `${x.done ? "✓" : "…"} ${x.text}`));
    expect(texts).toContainEqual(["✓ Rezerve edilmemiş planlara bakıyorum", "✓ Jardim Stay fikre alınıyor", "… OPO → IST fikre alınıyor"]);
    expect(chatStepsOf(T)).toEqual([]);

    // "Otel için rezervasyon gerekiyormuş": back to book.
    const back = fake([use({ name: "set_booking_need", input: { all_unbooked: false, item_ids: ["jardim"], leg_keys: [], needed: true } }), say("Oteli yeniden rezerve edilecekler arasına aldım.")]);
    await sendMessage(T, "otel için rezervasyon gerekiyormuş", back.llm);
    expect(JSON.parse(String(resultsOf(back.calls, 1)[0].content))).toMatchObject({ to_book_again: ["Jardim Stay"] });
    expect((await listItems(T)).find((i) => i.id === "jardim")!.noBooking).toBeUndefined();
  });

  it("an unknown id changes nothing and says so", async () => {
    await put([stay("chosen")]);
    const { llm, calls } = fake([use({ name: "set_booking_need", input: { all_unbooked: false, item_ids: ["nope"], leg_keys: [], needed: false } }), say("Bulamadım.")]);
    await sendMessage(T, "şunu fikir yap", llm);
    expect(resultsOf(calls, 1)[0].is_error).toBe(true);
    expect((await listItems(T))[0].noBooking).toBeUndefined();
  });
});

describe("a model that never answers", () => {
  it("ends the turn with the honest line instead of thinking for ever", async () => {
    await put([stay("chosen")]);
    liveTiming.answerMs = 30;
    const { llm } = fake(["never"]);
    await expect(sendMessage(T, "merhaba", llm)).rejects.toBeInstanceOf(AnswerTimeout);
    expect(chatStepsOf(T)).toEqual([]);
  });
});
