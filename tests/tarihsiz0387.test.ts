// 0.38.7 (V3): Emre's Bali (Canggu, 1 Aralık – 1 Ocak, Sabin ile). "Gün akışı, yolculuk sırasıyla olan şeyde de, etkinliklerin
// tarihi satın alınmamış ya da tarihi seçilmemişse otomatik tarih ataması yapmasın … tarihsiz olarak alt alta dizsin. Tarihi
// olanlar yukarıdan dizilsin, o destinasyonun altında." A tour the source found for Canggu is saved with the stop's days
// (offerSource.offerItem: need.start/end); that stretch is no day of its own (timeline.ownDay), the record keeps it.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { categorize } from "../src/lib/categories";
import { dayCards, undatedStops } from "../src/lib/dayCards";
import { db, listItems } from "../src/lib/db";
import { decideTrip, makeContext } from "../src/lib/decision";
import { isEmptyRecord } from "../src/lib/emptyCards";
import { tourNeeds } from "../src/lib/heroMosaic";
import { setLang } from "../src/lib/i18n";
import { onDay } from "../src/lib/ideas";
import { collectionsOf, type IntentInput } from "../src/lib/intents";
import { journeyChapters } from "../src/lib/journeyChapters";
import { buildLegs } from "../src/lib/legs";
import { offerItem, type Offer } from "../src/lib/offerSource";
import { buildPlan } from "../src/lib/plan";
import { runStep, stepsFor } from "../src/lib/startCreate";
import { applyAnswer, applyText, creationOf, isPlaceholder, newStart, parseStartText, type StartState } from "../src/lib/startTrip";
import { buildTimeline, ownDay } from "../src/lib/timeline";
import type { Item, Trip } from "../src/lib/types";
import { makeItem } from "./fixtures/makeItem";

setLang("tr");
const TODAY = "2026-10-19";
const LINE = "Bali'de 1 ay kalırız canggu da sabit sabinle bunu planla";

function interview(): StartState {
  let s = newStart(`s-${Math.random()}`, "plan", 1, "tr");
  s = { ...s, messages: [{ role: "user", text: LINE, at: 1 }] };
  s = applyText(s, LINE, parseStartText(LINE, TODAY, "where"), 2, "where").state;
  s = applyAnswer(s, { q: "from", city: "Bodrum" }, 3);
  s = applyAnswer(s, { q: "start", date: "2026-12-01", approx: false }, 4);
  return applyAnswer(s, { q: "want", styles: ["romantic", "nature"], budget: null }, 5);
}

async function create(): Promise<Trip> {
  let state = interview();
  for (const step of stepsFor(state, creationOf(state)!)) {
    const { tripId } = await runStep(step.id, state, { provider: "gemini" });
    if (step.id === "trip") state = { ...state, tripId };
  }
  return (await (await db()).get("trips", state.tripId!))!;
}

function board(trip: Trip, items: Item[]) {
  const ctx = makeContext(trip, items, { today: TODAY });
  const plan = buildPlan(trip, items);
  const legs = buildLegs(plan, trip);
  const timeline = buildTimeline(plan, legs, items);
  const stageCtx = (i: Item) => ({ placeholder: isPlaceholder(trip, i), empty: isEmptyRecord(trip, i, 0, items), docs: 0 });
  const sections = categorize({ plan, timeline, items, legs, today: TODAY, stageCtx });
  const input: IntentInput = { trip, plan, sections, items, today: TODAY, decisions: decideTrip(items, ctx), ctx };
  const journey = journeyChapters({ input, timeline, collections: collectionsOf(input) });
  const cards = dayCards(timeline.sections, { merge: false });
  return { plan, timeline, journey, cards, undated: undatedStops(cards, items, plan) };
}

const tour = (id: string, title: string): Offer => ({ id, kind: "activity", title, url: `https://www.viator.com/tours/${id}`, why: "", source: "Viator", fetchedAt: 1, price: 50, currency: "EUR" });

async function bali() {
  const trip = await create();
  const start = await listItems(trip.id);
  const need = tourNeeds(buildPlan(trip, start), ["Canggu"], 2)[0].need;
  const surf: Item = { ...offerItem(tour("surf", "Sörf dersi"), need, trip.id, "surf", 1), status: "chosen" };
  const sunset: Item = { ...offerItem(tour("sunset", "Tanah Lot gün batımı"), need, trip.id, "sunset", 1), status: "booked" };
  // A day the traveller gave it ("+ Gün"): its own day.
  const batur = onDay({ ...offerItem(tour("batur", "Mount Batur gün doğumu"), need, trip.id, "batur", 1), status: "chosen" }, "2026-12-05", null);
  const warung = makeItem({ id: "warung", tripId: trip.id, name: "Warung Bu Mi", category: "food", needKey: "food:warung", city: "Canggu", status: "chosen", booking: "none", dates: { start: null, end: null, source: "none" } });
  return { trip, items: [...start, surf, sunset, batur, warung], surf, sunset, batur };
}

describe("Emre's Bali: a tour with no day of its own gets none", () => {
  it("the stop's days a tour was looked for in are no day; one given by the traveller is", async () => {
    const { trip, items, surf, batur } = await bali();
    const { plan } = board(trip, items);
    // The record keeps what it was saved with: only the view reads it as no day.
    expect(surf.dates).toEqual({ start: "2026-12-01", end: "2027-01-01", source: "unverified" });
    expect(ownDay(surf, plan)).toBeNull();
    expect(ownDay(batur, plan)).toBe("2026-12-05");
    // A tour for two days said in the chat inside the stop keeps its day; a stay or a rental is not this rule's.
    expect(ownDay({ ...surf, dates: { start: "2026-12-07", end: "2026-12-09", source: "unverified" } }, plan)).toBe("2026-12-07");
    // The trip moved to 10 Aralık – 10 Ocak and the booked tour's old stretch stayed: still no day.
    const moved = buildPlan({ ...trip, confirmedDates: { start: "2026-12-10", end: "2027-01-10" } }, items);
    expect(ownDay(surf, moved)).toBeNull();
  });

  it("Gün gün: the first day holds no tour; the dated one is on its day; the rest under Canggu, 'Tarihsiz'", async () => {
    const { trip, items } = await bali();
    const { cards, undated } = board(trip, items);
    const day = (date: string) => cards.find((c) => c.date === date)!;
    expect(day("2026-12-01").rows.map((r) => r.item?.name ?? null)).not.toContain("Sörf dersi");
    expect(day("2026-12-01").rows.map((r) => r.item?.name ?? null)).not.toContain("Tanah Lot gün batımı");
    expect(day("2026-12-05").rows.map((r) => r.item?.name)).toContain("Mount Batur gün doğumu");
    expect(undated).toHaveLength(1);
    expect(undated[0].city).toBe("Canggu");
    expect(undated[0].items.map((i) => i.name).sort()).toEqual(["Sörf dersi", "Tanah Lot gün batımı", "Warung Bu Mi"]);
    // Under Canggu's last day, before the way home.
    const at = cards.findIndex((c) => c.key === undated[0].after);
    expect(cards[at].city).toBe("Canggu");
    expect(cards.slice(at + 1).every((c) => c.role === "departure")).toBe(true);
  });

  it("Yolculuk sırasıyla: under Canggu the dated first by day, then the undated with no date at all", async () => {
    const { trip, items } = await bali();
    const { journey } = board(trip, items);
    const canggu = journey.chapters.find((c) => c.title === "Canggu")!;
    const tours = canggu.steps.filter((s) => s.kind === "item");
    expect(tours.map((s) => [s.dateLabel, s.title])).toEqual([
      ["5 Ara", "Mount Batur gün doğumu"],
      ["tarihsiz", "Tanah Lot gün batımı"],
      ["tarihsiz", "Sörf dersi"],
      ["tarihsiz", "Warung Bu Mi"],
    ]);
    // No stretch, no "1 Aralık" anywhere on the undated ones.
    for (const s of tours.slice(1)) {
      expect(s.date).toBeNull();
      expect(s.sub ?? "").not.toMatch(/Aralık|Ocak/);
    }
  });
});
