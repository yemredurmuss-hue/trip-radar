// The day-by-day view as cards: one a day in order, a moving day titled by its route, free days in a
// row merged, at most four lines on a closed card.
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadDecisions } from "../src/lib/analysis";
import { db, listItems } from "../src/lib/db";
import { dayCards, endsOf, foldRows, isPlanRow, rowMark } from "../src/lib/dayCards";
import { loadDemoTrip } from "../src/lib/demo";
import type { DayRow } from "../src/lib/journey";
import { buildLegs } from "../src/lib/legs";
import { buildPlan } from "../src/lib/plan";
import { buildTimeline } from "../src/lib/timeline";

async function demoCards() {
  const id = await loadDemoTrip();
  const trip = (await (await db()).get("trips", id))!;
  const items = await listItems(id);
  const { ctx } = await loadDecisions(trip, items);
  const plan = buildPlan(trip, items);
  const timeline = buildTimeline(plan, buildLegs(plan, trip, ctx.listings), items);
  return dayCards(timeline.sections, { listings: ctx.listings });
}

describe("day cards", () => {
  it("one card a day of the sample trip, in order, free days merged", async () => {
    const cards = await demoCards();
    const line = cards.map((c) => `${c.dayNo} ${c.date}${c.end ? `–${c.end}` : ""} ${c.title}`);
    expect(line[0]).toBe("1. gün 2026-10-08 İstanbul → Porto");
    expect(line).toContain("4. gün 2026-10-11 Porto → Lizbon");
    expect(line.at(-1)).toMatch(/^7\. gün 2026-10-14 Lizbon →/);
    // Every date of the trip is on exactly one card.
    const covered = cards.flatMap((c) => (c.end ? [c.date, c.end] : [c.date]));
    expect(new Set(covered).size).toBe(covered.length);
    // Lisbon's two free days are one card.
    expect(cards.find((c) => c.end)?.title).toBe("Lizbon · boş günler");
  });
  it("folds a long day to three lines and the rest", () => {
    const r = (key: string, kind: DayRow["kind"] = "item", state: DayRow["state"] = "done") => ({ key, kind, state }) as DayRow;
    const rows = [r("a"), r("i", "info", "info"), r("b"), r("c"), r("d"), r("e"), r("x", "ideas", "info")];
    expect(rows.filter(isPlanRow).map((x) => x.key)).toEqual(["a", "b", "c", "d", "e"]);
    const { shown, more } = foldRows(rows);
    expect(shown.map((x) => x.key)).toEqual(["a", "b", "c"]);
    expect(more.map((x) => x.key)).toEqual(["d", "e"]);
    expect(foldRows(rows.slice(0, 5)).more).toEqual([]);
  });
  it("marks booked with ✓, says what's left in a word, nothing for information", () => {
    expect(rowMark({ state: "done" } as DayRow)).toEqual({ done: true, text: "✓" });
    expect(rowMark({ state: "pending" } as DayRow)?.text).toBe("rezerve et");
    expect(rowMark({ state: "open" } as DayRow)?.text).toBe("planla");
    expect(rowMark({ state: "info" } as DayRow)).toBeNull();
  });
});

describe("a trip's ends", () => {
  it("leave the kind's word out", () => {
    expect(endsOf("Uçuş LIS → IST")).toEqual(["LIS", "IST"]);
    expect(endsOf("Tren Porto → Lizbon")).toEqual(["Porto", "Lizbon"]);
    expect(endsOf("Otel → Gar")).toEqual(["Otel", "Gar"]);
    expect(endsOf("Douro tekne turu")).toBeNull();
  });
});

describe("a day's look", () => {
  it("each row has the Plan's kind; the photo comes from the day's highlight, else its city", async () => {
    const { rowKind, highlightOf, dayPhoto } = await import("../src/lib/dayCards");
    const cards = await demoCards();
    const move = cards.find((c) => c.title === "Porto → Lizbon")!;
    expect(move.rows.filter(isPlanRow).map(rowKind)).toEqual(["taxi", "train", "taxi"]);
    expect(dayPhoto(move)).toEqual({ query: "Lizbon" });
    expect(rowKind(highlightOf(move)!)).toBe("train"); // the train, not the taxi to the station
    expect(rowKind(highlightOf(cards.at(-1)!)!)).toBe("flight");
    const porto = cards.find((c) => c.dayNo === "2. gün")!;
    expect(highlightOf(porto)?.title).toBe("Douro tekne turu");
    expect(dayPhoto(porto)).toEqual({ query: "Douro tekne turu Porto" });
  });
});

describe("the whole day", () => {
  it("lists every line, ideas one by one, nothing folded", async () => {
    const { flowRows } = await import("../src/lib/dayCards");
    const r = (key: string, kind: DayRow["kind"], extra: Partial<DayRow> = {}) => ({ key, kind, state: "info", title: key, items: [], ...extra }) as DayRow;
    const card = { rows: [r("out", "info"), r("taxi", "leg", { state: "open" }), r("ideas", "ideas", { items: [{ id: "1", name: "Casa Guedes" }, { id: "2", name: "Jardim do Morro" }] as never })] } as never;
    expect(flowRows(card).map((x) => `${x.kind}:${x.title}`)).toEqual(["info:out", "leg:taxi", "idea:Casa Guedes", "idea:Jardim do Morro"]);
  });
});

describe("the trip as it goes", () => {
  it("travel days alone, a city's days together, in order", async () => {
    const { groupDays, daysLabel } = await import("../src/lib/dayCards");
    const cards = await demoCards();
    const groups = groupDays(cards);
    expect(groups.map((g) => (g.kind === "travel" ? `✈ ${g.card.title}` : `📍 ${g.city} ${daysLabel(g.cards)}`))).toEqual([
      "✈ İstanbul → Porto",
      "📍 Porto 2–3. gün",
      "✈ Porto → Lizbon",
      "📍 Lizbon 5–6. gün",
      "✈ Lizbon → İstanbul",
    ]);
  });
});
