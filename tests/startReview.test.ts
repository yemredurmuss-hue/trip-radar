// tests/startReview.test.ts — the start chat review's fixes: a bad draft can't break the screen, a guessed start is
// said and kept apart, placeholders never become a "bilet alınmadı" to-do, a page saved for DPS replaces the flight
// made for Denpasar, a remade route takes the old untouched stays away, drafts saved at once lose nothing, and the
// chat answers one message at a time.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { ChatBusyError, sendMessage } from "../src/lib/assistant";
import { db, listItems } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import type { LlmProvider } from "../src/lib/llm/types";
import { buildPlan, cityKeyOf, placeKeyOf } from "../src/lib/plan";
import { decisionProgress } from "../src/lib/progress";
import { memoryKV } from "../src/lib/share/store";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { listDrafts, removeDraft, saveDraft } from "../src/lib/startDrafts";
import {
  acceptExtraction, acceptRoute, applyAnswer, applyText, approxDates, canGenerate, checklist, creationOf, missingForGenerate, replyText, skip, isPlaceholder, knownStyles, mergeExtracted, monthParts,
  newStart, parseRouteText, parseStartText, placeholderPrint, splitLinks, startLead, wantText, type StartState,
} from "../src/lib/startTrip";
import { buildTimeline } from "../src/lib/timeline";
import { acceptStyle } from "../src/lib/tripStyle";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

setLang("tr");
const TODAY = "2026-10-06";
const ctx = { myName: null, fromGuess: "İstanbul", today: TODAY };

function interview(confirmRoute = true, id = `s-${Math.random()}`): StartState {
  const text = "Sabine'yle 10 Aralık'tan 1 ay Bali";
  let s = newStart(id, "plan", 1);
  s = { ...s, messages: [{ role: "user", text, at: 1 }] };
  s = applyText(s, text, mergeExtracted(parseStartText(text, TODAY), null), 2).state;
  s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
  s = applyAnswer(s, { q: "want", styles: ["nature"], budget: null }, 4);
  const route = acceptRoute({ stops: [{ city: "Ubud", nights: 12, country_code: "ID" }, { city: "Canggu", nights: 19, country_code: "ID" }], arrival_airport_city: "Denpasar", departure_airport_city: "Denpasar" }, 31)!;
  return { ...s, route: { ...route, confirmed: confirmRoute } };
}

async function runAll(s: StartState): Promise<StartState> {
  let state = s;
  for (const step of stepsFor(state, creationOf(state)!)) {
    const { tripId } = await runStep(step.id, state, { provider: "gemini" });
    if (step.id === "trip") state = { ...state, tripId };
  }
  return state;
}

describe("a bad draft or answer can't break the screen", () => {
  it("style ids off the list (or an object's own words) are dropped everywhere", () => {
    expect(knownStyles(["nature", "toString", "__proto__", "constructor", 7 as never])).toEqual(["nature"]);
    expect(acceptStyle(["toString", "beach"])).toEqual(["beach"]);
    const raw = { destination: "", destination_country: "", destination_country_code: "", origin: "", companions: "", names: [], start_date: "", start_month: 0, duration_days: 0, duration_months: 0, styles: ["toString", "hasOwnProperty", "food"], budget: "" };
    expect(acceptExtraction(raw, TODAY).styles).toEqual(["food"]);
    const bad = { ...newStart("x", "plan", 1), styles: ["toString", "valueOf"] as never, budget: "constructor" as never };
    expect(wantText(bad)).toBe("");
    expect(() => checklist(bad, ctx)).not.toThrow();
  });
  it("drafts are cleaned as they're read: unknown styles out, broken lists made lists", async () => {
    const kv = memoryKV();
    await kv.set("startDrafts", [{ ...interview(), id: "d", styles: ["nature", "toString"], who: { kind: "partner", names: "Sabine" }, skipped: null }]);
    const [d] = await listDrafts(kv);
    expect(d.styles).toEqual(["nature"]);
    expect(d.who).toEqual({ kind: "partner", names: [] });
    expect(d.skipped).toEqual([]);
    expect(() => checklist(d, ctx)).not.toThrow();
  });
  it("saves at the same moment are done one after another: none is lost", async () => {
    const kv = memoryKV();
    await Promise.all([saveDraft({ ...interview(), id: "a", updatedAt: 1 }, kv), saveDraft({ ...interview(), id: "b", updatedAt: 2 }, kv), saveDraft({ ...interview(), id: "c", updatedAt: 3 }, kv)]);
    expect((await listDrafts(kv)).map((d) => d.id)).toEqual(["c", "b", "a"]);
    await Promise.all([removeDraft("a", kv), saveDraft({ ...interview(), id: "d", updatedAt: 4 }, kv)]);
    expect((await listDrafts(kv)).map((d) => d.id)).toEqual(["d", "c", "b"]);
  });
});

describe("a start never made up", () => {
  it("a month's parts are from today on; the end is a week before its last day", () => {
    expect(monthParts("2026-12-01", TODAY).map((p) => p.date)).toEqual(["2026-12-01", "2026-12-15", "2026-12-25"]);
    expect(monthParts("2026-10-13", TODAY).map((p) => p.part)).toEqual(["mid", "end"]);
  });
  it("a month only can't generate yet; skipping its day takes the 1st and says so", () => {
    let s = interview(false);
    s = applyAnswer(s, { q: "start", date: "2026-12-01", approx: true }, 5);
    expect(canGenerate(s)).toBe(false);
    expect(missingForGenerate(s)).toEqual(["başlangıç günü"]);
    expect(checklist(s, ctx).find((r) => r.id === "when")?.done).toBe(false);
    const skipped = skip(s, "day", 6);
    expect(skipped.start).toEqual({ date: "2026-12-01", approx: true, part: "begin" });
    expect(canGenerate(skipped)).toBe(true);
    expect(replyText(s, skipped, ctx)).toMatch(/^1 Aralık'ı başlangıç aldım, değiştirebilirsin\./);
    // A length with no start yet isn't said back ("1 hafta · başlangıç?"): the start is asked.
    const len = applyAnswer(newStart("l", "plan", 1), { q: "duration", duration: { unit: "week", n: 1 } }, 2);
    expect(replyText(newStart("l", "plan", 1), len, ctx)).toBe("Nereye gidiyoruz?");
  });
  it("a guessed start goes on the trip; the hero says \"tarih yaklaşık\" while the trip starts on it", async () => {
    let s = interview(false);
    s = applyAnswer(s, { q: "start", date: "2026-12-01", approx: true }, 5);
    s = applyAnswer(s, { q: "day", date: "2026-12-15", part: "mid" }, 6);
    const made = await runAll(s);
    const trip = (await (await db()).get("trips", made.tripId!))!;
    expect(trip.startGuide?.approxStart).toBe("2026-12-15");
    expect(approxDates(trip)).toBe(true);
    const items = await listItems(trip.id);
    const plan = buildPlan(trip, items);
    expect(startLead(trip, items, plan.nights.open)).toBe("2 uçuş ve 31 gece seni bekliyor · tarih yaklaşık.");
    // The dates changed (said in the chat), or confirmed ("Bu tarih doğru"): no longer a guess.
    expect(approxDates({ ...trip, confirmedDates: { start: "2026-12-16", end: "2027-01-16" } })).toBe(false);
    expect(approxDates({ ...trip, startGuide: { ...trip.startGuide!, approxStart: null } })).toBe(false);
  });
});

describe("placeholders", () => {
  it("never a \"bilet alınmadı\" to-do: \"uçuş bul\" for a flight, nothing for a stay (its open nights are one)", async () => {
    const made = await runAll(interview());
    const trip = (await (await db()).get("trips", made.tripId!))!;
    const items = await listItems(trip.id);
    const plan = buildPlan(trip, items);
    const timeline = buildTimeline(plan, [], items);
    const progress = decisionProgress(timeline, items, plan, undefined, TODAY, (i) => isPlaceholder(trip, i));
    expect(progress.todos.filter((t) => t.kind === "book")).toEqual([]);
    const finds = progress.todos.filter((t) => t.key.startsWith("find:"));
    expect(finds).toHaveLength(2);
    expect(finds.every((t) => t.kind === "plan" && t.note.startsWith("uçuş bul · "))).toBe(true);
    // Without the start's knowledge the same records would be "bilet alınmadı" (as the chat's own plans are).
    expect(decisionProgress(timeline, items, plan, undefined, TODAY).todos.some((t) => t.kind === "book")).toBe(true);
  });
  it("a flight page saved for DPS takes the place of the one made for Denpasar (or Bali's airport)", () => {
    expect(placeKeyOf("DPS")).toBe(cityKeyOf("Denpasar"));
    expect(placeKeyOf("Ngurah Rai International Airport")).toBe(cityKeyOf("Denpasar"));
    const trip: Trip = { id: "t", title: "Bali", confirmedDates: { start: "2026-12-10", end: "2027-01-10" }, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 };
    const flight = (over: Partial<Item>) => makeItem({ tripId: "t", category: "flight", needKey: "flight:x", dates: { start: "2026-12-10", end: null, source: "page" }, ...over });
    const made = flight({ id: "ph", origin: "chat", status: "chosen", flight: { from: "İstanbul", to: "Denpasar", departure: null, arrival: null, carrier: null, flightNumber: null, stops: null } });
    const page = flight({ id: "pg", status: "chosen", needKey: "flight:ist-dps", flight: { from: "IST", to: "DPS", departure: "2026-12-10T21:00", arrival: null, carrier: "TK", flightNumber: null, stops: 1 } });
    const plan = buildPlan(trip, [made, page]);
    expect(plan.closed.map((c) => c.item.id)).toContain("ph");
  });
  it("a single stop on Bali flies to Denpasar; a typed route's stops know their country", () => {
    const c = creationOf(interview(false))!;
    expect([c.travel[0].to, c.travel[1].from]).toEqual(["Denpasar", "Denpasar"]);
    const typed = parseRouteText("Lizbon 7, Porto 7", 14);
    expect("route" in typed && typed.route.stops.map((x) => x.code)).toEqual(["PT", "PT"]);
  });
  it("made again after another route: the untouched stays and flights of before go, the traveller's stay", async () => {
    const first = await runAll(interview());
    const d = await db();
    let items = await listItems(first.tripId!);
    // The traveller booked the Ubud stay meanwhile: it's theirs now.
    const ubud = items.find((i) => i.city === "Ubud")!;
    await d.put("items", { ...ubud, status: "booked" });
    const again = { ...first, route: { stops: [{ city: "Ubud", nights: 10, code: "ID" }, { city: "Uluwatu", nights: 21, code: "ID" }], arrive: "Denpasar", leave: "Denpasar", confirmed: true, source: "user" as const } };
    for (const id of ["route", "travel"] as const) await runStep(id, again, { provider: "gemini" });
    items = await listItems(first.tripId!);
    expect(items.filter((i) => i.category === "stay").map((i) => `${i.city} ${i.status}`).sort()).toEqual(["Ubud booked", "Uluwatu chosen"]);
    expect(items.filter((i) => i.category === "flight")).toHaveLength(2);
    const trip = (await d.get("trips", first.tripId!))!;
    // Every print kept is for a record there is.
    expect(Object.keys(trip.startGuide!.placeholders!).every((id) => items.some((i) => i.id === id))).toBe(true);
    expect(items.filter((i) => i.city === "Uluwatu").every((i) => trip.startGuide!.placeholders![i.id] === placeholderPrint(i))).toBe(true);
  });
});

describe("the home's box", () => {
  it("links typed with words: the links go to capture, the words to the conversation", () => {
    expect(splitLinks("Bali'ye 3 hafta https://www.airbnb.com/rooms/1 bakalım")).toEqual({ links: ["https://www.airbnb.com/rooms/1"], words: "Bali'ye 3 hafta bakalım" });
    expect(splitLinks("https://a.example/x")).toEqual({ links: ["https://a.example/x"], words: "" });
    expect(splitLinks("Porto'da bir otel daha")).toEqual({ links: [], words: "Porto'da bir otel daha" });
  });
});

describe("the chat answers one message at a time", () => {
  it("a second message while the first is answered is refused, not interleaved", async () => {
    const d = await db();
    await d.put("trips", { id: "busy", title: "Busy", confirmedDates: null, budget: null, heroImage: null, createdAt: 1, updatedAt: 1 });
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    const llm: LlmProvider = {
      id: "gemini",
      extract: async () => ({}) as never,
      generateJson: async () => ({}) as never,
      chatStep: async () => {
        await held;
        return { content: [], text: "Tamam.", calls: [], refused: false };
      },
      userContent: (texts) => texts,
      assistantContent: (text) => [text],
      toolResultContent: (results) => results.map((r) => r.content),
    };
    const first = sendMessage("busy", "bir", llm);
    await new Promise((r) => setTimeout(r, 20));
    await expect(sendMessage("busy", "iki", llm)).rejects.toBeInstanceOf(ChatBusyError);
    release();
    await first;
    // Once answered, the next goes.
    await expect(sendMessage("busy", "üç", llm)).resolves.toBeUndefined();
  });
});
