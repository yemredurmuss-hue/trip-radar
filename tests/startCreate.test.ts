// tests/startCreate.test.ts — "Gezimi oluştur": the real steps on the database (the board's own plan shows the
// nights by stop and the flights), a retry never doubles anything, the chat continues, drafts are kept apart.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { db, listItems, listMessages } from "../src/lib/db";
import { setLang } from "../src/lib/i18n";
import { buildPlan } from "../src/lib/plan";
import { memoryKV } from "../src/lib/share/store";
import { runStep, stepsFor, type StepId } from "../src/lib/startCreate";
import { getDraft, listDrafts, MAX_DRAFTS, removeDraft, saveDraft } from "../src/lib/startDrafts";
import { setSuggestionsReview } from "../src/lib/startHooks";
import { acceptRoute, applyAnswer, applyText, creationOf, mergeExtracted, newStart, parseStartText, type StartState } from "../src/lib/startTrip";

setLang("tr");
const TODAY = "2026-10-06";

function interview(confirmRoute: boolean): StartState {
  const text = "Sabine'yle 10 Aralık'tan 1 ay Bali";
  let s = newStart(`s-${Math.random()}`, "plan", 1);
  s = { ...s, messages: [{ role: "user", text, at: 1 }] };
  s = applyText(s, text, mergeExtracted(parseStartText(text, TODAY), null), 2).state;
  s = { ...s, messages: [...s.messages, { role: "assistant", text: "Nereden yola çıkıyorsun?", at: 2 }, { role: "user", text: "İstanbul", at: 3 }] };
  s = applyAnswer(s, { q: "from", city: "İstanbul" }, 3);
  s = applyAnswer(s, { q: "want", styles: ["nature"], budget: "mid" }, 4);
  const route = acceptRoute({ stops: [{ city: "Ubud", nights: 12 }, { city: "Canggu", nights: 10 }, { city: "Uluwatu", nights: 9 }], arrival_airport_city: "Denpasar", departure_airport_city: "Denpasar" }, 31)!;
  return { ...s, route: { ...route, confirmed: confirmRoute } };
}

async function runAll(s: StartState): Promise<StartState> {
  let state = s;
  for (const step of stepsFor(state, creationOf(state, { myName: "Emre" })!)) {
    const id = await runStep(step.id, state, { myName: "Emre", provider: "gemini" });
    if (step.id === "trip") state = { ...state, tripId: id };
  }
  return state;
}

describe("Gezimi oluştur", () => {
  it("makes the trip, the stays by stop, the flights, who and the style, and moves the chat over", async () => {
    const s = await runAll(interview(true));
    const d = await db();
    const trip = (await d.get("trips", s.tripId!))!;
    expect(trip.title).toBe("Bali Gezisi");
    expect(trip.confirmedDates).toEqual({ start: "2026-12-10", end: "2027-01-10" });
    expect(trip.startGuide?.createdAt).toBeGreaterThan(0);
    const items = await listItems(trip.id);
    const plan = buildPlan(trip, items);
    // The board's own plan: three stays said for those nights, waiting for a place each.
    expect(plan.stayBlocks.map((b) => [b.kind, b.city, b.range.start, b.range.end])).toEqual([
      ["open", "Ubud", "2026-12-10", "2026-12-22"],
      ["open", "Canggu", "2026-12-22", "2027-01-01"],
      ["open", "Uluwatu", "2027-01-01", "2027-01-10"],
    ]);
    const flights = items.filter((i) => i.category === "flight").sort((a, b) => a.dates.start!.localeCompare(b.dates.start!));
    expect(flights.map((f) => [f.name, f.origin, f.status])).toEqual([
      ["Uçuş · İstanbul → Denpasar", "chat", "chosen"],
      ["Uçuş · Denpasar → İstanbul", "chat", "chosen"],
    ]);
    // Two travel: on the plans, where the hero and the search links read it.
    expect(items.every((i) => i.guests.adults === 2)).toBe(true);
    const prefs = (await d.getAll("preferences")).filter((p) => p.tripId === trip.id);
    expect(prefs.map((p) => p.text).sort()).toEqual(["Kimle: Emre & Sabine · 2 kişi · Nereden: İstanbul", "Tarz: Doğa · Bütçe: Orta bütçe"]);
    const chat = await listMessages(trip.id);
    expect(chat.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(chat[0].text).toBe("Sabine'yle 10 Aralık'tan 1 ay Bali");
    expect(chat.at(-1)!.text).toMatch(/^Bali Gezisi hazır: 32 gün, 3 durak\./);
    expect(chat.every((m) => m.provider === "gemini")).toBe(true);
  });

  it("an unconfirmed route is one stay for all the nights", async () => {
    const s = await runAll(interview(false));
    const trip = (await (await db()).get("trips", s.tripId!))!;
    const plan = buildPlan(trip, await listItems(trip.id));
    expect(plan.stayBlocks.map((b) => [b.city, b.nights])).toEqual([["Bali", 31]]);
  });

  it("every step again (Tekrar dene) changes nothing: one trip, three stays, two flights, two notes, one chat", async () => {
    const s = await runAll(interview(true));
    const d = await db();
    const tripsBefore = (await d.getAll("trips")).length;
    for (const id of ["trip", "route", "travel", "people"] as StepId[]) await runStep(id, s, { myName: "Emre", provider: "gemini" });
    expect((await d.getAll("trips")).length).toBe(tripsBefore);
    const items = await listItems(s.tripId!);
    expect(items.filter((i) => i.category === "stay")).toHaveLength(3);
    expect(items.filter((i) => i.category === "flight")).toHaveLength(2);
    expect((await d.getAll("preferences")).filter((p) => p.tripId === s.tripId)).toHaveLength(2);
    expect((await listMessages(s.tripId!)).length).toBe(4);
  });

  it("a step before the trip exists stops with a reason; a second trip with the same name gets its own", async () => {
    await expect(runStep("route", interview(true), { myName: null, provider: "gemini" })).rejects.toThrow("Gezi kaydı bulunamadı.");
    const again = await runAll(interview(false));
    const trip = (await (await db()).get("trips", again.tripId!))!;
    expect(trip.title).toMatch(/^Bali Gezisi( · Aralık 2026| \d+)$/);
    const titles = (await (await db()).getAll("trips")).map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("the suggestions step shows only when their review is there, and runs it", async () => {
    const s = interview(true);
    const c = creationOf(s, { myName: null })!;
    expect(stepsFor(s, c).map((x) => x.id)).toEqual(["trip", "route", "travel", "people"]);
    const reviewed: string[] = [];
    setSuggestionsReview(async (tripId) => (reviewed.push(tripId), 2));
    expect(stepsFor(s, c).map((x) => x.id)).toEqual(["trip", "route", "travel", "people", "suggestions"]);
    const made = await runAll(s);
    expect(reviewed).toEqual([made.tripId]);
    setSuggestionsReview(null);
  });

  it("the step lines say what really happened", () => {
    const s = interview(true);
    const lines = stepsFor(s, creationOf(s, { myName: null })!).map((x) => x.done);
    expect(lines).toEqual([
      "Gezi açıldı: Bali Gezisi",
      "Rota çizildi: Ubud 12 gece → Canggu 10 gece → Uluwatu 9 gece",
      "Uçuşlar için yer açıldı: İstanbul ⇄ Denpasar",
      "Kişi ve tarz: Sabine ile · 2 kişi · Doğa · Orta bütçe",
    ]);
  });
});

describe("drafts (item 5)", () => {
  it("kept apart from the trips, newest first, only with something in them, and removed", async () => {
    const kv = memoryKV();
    const empty = newStart("empty", "plan", 1);
    await saveDraft(empty, kv);
    expect(await listDrafts(kv)).toEqual([]);
    const a = { ...interview(false), id: "a", updatedAt: 5 };
    const b = { ...interview(false), id: "b", updatedAt: 9 };
    await saveDraft(a, kv);
    await saveDraft(b, kv);
    expect((await listDrafts(kv)).map((d) => d.id)).toEqual(["b", "a"]);
    await saveDraft({ ...a, updatedAt: 12, from: "Ankara" }, kv);
    expect((await getDraft("a", kv))?.from).toBe("Ankara");
    expect(await removeDraft("a", kv)).toMatchObject({ id: "a" });
    expect((await listDrafts(kv)).map((d) => d.id)).toEqual(["b"]);
    for (let i = 0; i < MAX_DRAFTS + 3; i++) await saveDraft({ ...a, id: `x${i}`, updatedAt: 100 + i }, kv);
    expect((await listDrafts(kv)).length).toBe(MAX_DRAFTS);
    // Something else under the key (a broken write) is ignored, not shown.
    await kv.set("startDrafts", [{ nope: 1 }, b]);
    expect((await listDrafts(kv)).map((d) => d.id)).toEqual(["b"]);
  });
});
